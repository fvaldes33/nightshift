import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { account } from "@openralph/db/models/auth.model";
import { sessions } from "@openralph/db/models/index";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getDoc, listDocs } from "../services/doc.service";
import { gitCurrentBranch, gitPush } from "../services/git-cli.service";
import { createPullRequest, listPullRequests } from "../services/github.service";
import { getLoop, updateLoop } from "../services/loop.service";
import { createMessage } from "../services/message.service";
import { getSession, updateSession } from "../services/session.service";
import { addTaskComment, getTask, listTasks, updateTask } from "../services/task.service";

/** Get the GitHub token from the first linked GitHub account in the DB. */
async function getGitHubTokenFromDB(): Promise<string> {
  const ghAccount = await db.query.account.findFirst({
    where: eq(account.providerId, "github"),
  });
  if (!ghAccount?.accessToken) {
    throw new Error("No GitHub account linked — connect GitHub in nightshift settings");
  }
  return ghAccount.accessToken;
}

const server = new McpServer({ name: "openralph", version: "1.0.0" });

// --- Task tools ---

server.tool(
  "list_tasks",
  "List tasks, optionally filtered by repo, status, assignee, or parent",
  {
    repoId: z.uuid().optional(),
    status: z.string().optional(),
    assignee: z.string().optional(),
    parentId: z.uuid().nullable().optional(),
  },
  async (input) => {
    const result = await listTasks(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.tool(
  "get_task",
  "Get a task by ID with its subtasks, repo, and session",
  { id: z.uuid() },
  async (input) => {
    const result = await getTask(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.tool(
  "update_task",
  "Update a task's fields (status, title, description, assignee, priority, labels)",
  {
    id: z.uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["backlog", "todo", "in_progress", "done", "canceled"]).optional(),
    priority: z.number().int().optional(),
    assignee: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  },
  async (input) => {
    const result = await updateTask(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.tool(
  "add_task_comment",
  "Add a comment to a task",
  {
    id: z.uuid(),
    comment: z.object({
      id: z.string(),
      author: z.string(),
      content: z.string(),
      createdAt: z.string(),
    }),
  },
  async (input) => {
    const result = await addTaskComment(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Message tools ---

server.tool(
  "create_message",
  "Write a message to a session (for iteration updates)",
  {
    sessionId: z.uuid(),
    role: z.enum(["system", "user", "assistant"]),
    name: z.string().optional(),
    parts: z.array(z.any()),
    metadata: z.record(z.string(), z.unknown()).optional(),
  },
  async (input) => {
    const result = await createMessage(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Loop tools ---

server.tool(
  "get_loop",
  "Get a loop by ID with its repo, task, and session",
  { id: z.uuid() },
  async (input) => {
    const result = await getLoop(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.tool(
  "update_loop",
  "Update a loop's fields (status, currentIteration, etc.)",
  {
    id: z.uuid(),
    status: z.enum(["queued", "running", "complete", "failed"]).optional(),
    currentIteration: z.number().int().optional(),
    prompt: z.string().optional(),
    maxIterations: z.number().int().optional(),
  },
  async (input) => {
    const result = await updateLoop(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Doc tools ---

server.tool(
  "list_docs",
  "List context docs, optionally filtered by repo (null for global docs)",
  { repoId: z.uuid().nullable().optional() },
  async (input) => {
    const result = await listDocs(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.tool("get_doc", "Get a context doc by ID", { id: z.uuid() }, async (input) => {
  const result = await getDoc(input);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

// --- Session tools ---

server.tool(
  "get_session",
  "Get a session by ID with its repo, branch, workspace mode, and PR state",
  { id: z.uuid() },
  async (input) => {
    const result = await getSession(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Git / GitHub tools ---

server.tool(
  "push_changes",
  "Push the current branch to the remote. Run this before creating a PR. Requires a sessionId so nightshift can track the push.",
  { sessionId: z.uuid() },
  async ({ sessionId }) => {
    const session = await getSession({ id: sessionId });
    if (!session.repo) throw new Error("Session has no associated repo");

    const cwd = session.worktreePath ?? session.repo.localPath;
    if (!cwd) throw new Error("No working directory for this session");

    gitPush(cwd);
    const branch = gitCurrentBranch(cwd);

    return { content: [{ type: "text", text: JSON.stringify({ pushed: true, branch }) }] };
  },
);

server.tool(
  "create_pull_request",
  "Create a GitHub pull request for the session's branch. Pushes first, then creates the PR. Updates the session with PR info so nightshift can track it.",
  {
    sessionId: z.uuid(),
    title: z.string(),
    body: z.string(),
    base: z.string().default("main"),
    draft: z.boolean().default(false),
  },
  async ({ sessionId, title, body, base, draft }) => {
    const session = await getSession({ id: sessionId });
    if (!session.repo) throw new Error("Session has no associated repo");

    const cwd = session.worktreePath ?? session.repo.localPath;
    if (!cwd) throw new Error("No working directory for this session");

    const token = await getGitHubTokenFromDB();
    const branch = gitCurrentBranch(cwd);

    // Push first
    try { gitPush(cwd); } catch { /* may already be pushed */ }

    // Check for existing PR on this branch
    const existingPRs = await listPullRequests({
      token,
      owner: session.repo.owner,
      repo: session.repo.name,
      state: "open",
      head: `${session.repo.owner}:${branch}`,
    });

    if (existingPRs.length > 0) {
      const existing = existingPRs[0]!;
      await updateSession({
        id: sessionId,
        prNumber: existing.number,
        prUrl: existing.url,
        prStatus: "open",
        prBranch: branch,
      });
      return { content: [{ type: "text", text: JSON.stringify({ url: existing.url, number: existing.number, existing: true }) }] };
    }

    const pr = await createPullRequest({
      token,
      owner: session.repo.owner,
      repo: session.repo.name,
      head: branch,
      base,
      title,
      body,
      draft,
    });

    // Update session with PR state
    await updateSession({
      id: sessionId,
      prNumber: pr.number,
      prUrl: pr.url,
      prStatus: "open",
      prBranch: branch,
    });

    return { content: [{ type: "text", text: JSON.stringify({ url: pr.url, number: pr.number, created: true }) }] };
  },
);

// --- Start server ---

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
