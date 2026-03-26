import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { account } from "@openralph/db/models/auth.model";
import { z } from "zod";

import { getDoc, listDocs } from "../services/doc.service";
import { gitCurrentBranch, gitPush } from "../services/git-cli.service";
import { createPullRequest, listPullRequests } from "../services/github.service";
import { getLoop, listLoops, updateLoop } from "../services/loop.service";
import { createMessage } from "../services/message.service";
import { getSession, updateSession } from "../services/session.service";
import {
  addTaskComment,
  createTask,
  getTask,
  listTasks,
  updateTask,
} from "../services/task.service";

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

server.registerTool(
  "list_tasks",
  {
    description: "List tasks, optionally filtered by repo, status, assignee, or parent",
    inputSchema: {
      repoId: z.uuid().optional(),
      status: z.string().optional(),
      assignee: z.string().optional(),
      parentId: z.uuid().nullable().optional(),
    },
  },
  async ({ repoId, status, assignee, parentId }) => {
    const result = await listTasks({ repoId, status, assignee, parentId });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "get_task",
  {
    description: "Get a task by ID with its subtasks, repo, and session",
    inputSchema: { id: z.uuid() },
  },
  async ({ id }) => {
    const result = await getTask({ id });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "create_task",
  {
    description: "Create a new task. Used during planning to break work into trackable units.",
    inputSchema: {
      repoId: z.uuid(),
      parentId: z.uuid().optional(),
      title: z.string(),
      description: z.string().optional(),
      status: z.enum(["backlog", "todo", "in_progress", "done", "canceled"]).default("todo"),
      priority: z.number().int().default(3),
      assignee: z.string().optional(),
      labels: z.array(z.string()).default([]),
      sortOrder: z.number().int().default(0),
    },
  },
  async (args) => {
    const result = await createTask(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "update_task",
  {
    description: "Update a task's fields (status, title, description, assignee, priority, labels)",
    inputSchema: {
      id: z.uuid(),
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      status: z.enum(["backlog", "todo", "in_progress", "done", "canceled"]).optional(),
      priority: z.number().int().optional(),
      assignee: z.string().nullable().optional(),
      labels: z.array(z.string()).optional(),
      sortOrder: z.number().int().optional(),
    },
  },
  async (args) => {
    const result = await updateTask(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "add_task_comment",
  {
    description: "Add a comment to a task",
    inputSchema: {
      id: z.uuid(),
      comment: z.object({
        id: z.string(),
        author: z.string(),
        content: z.string(),
        createdAt: z.string(),
      }),
    },
  },
  async (args) => {
    const result = await addTaskComment(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Message tools ---

server.registerTool(
  "create_message",
  {
    description: "Write a message to a session (for iteration updates)",
    inputSchema: {
      sessionId: z.uuid(),
      role: z.enum(["system", "user", "assistant"]),
      name: z.string().optional(),
      parts: z.array(z.any()),
      metadata: z.record(z.string(), z.unknown()).optional(),
    },
  },
  async (args) => {
    const result = await createMessage(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Loop tools ---

server.registerTool(
  "list_loops",
  {
    description: "List loops, optionally filtered by session or repo. Returns status, iteration progress, and session info.",
    inputSchema: {
      sessionId: z.uuid().optional(),
      repoId: z.uuid().optional(),
    },
  },
  async (args) => {
    const result = await listLoops(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "get_loop",
  {
    description: "Get a loop by ID with its repo, task, and session",
    inputSchema: { id: z.uuid() },
  },
  async (args) => {
    const result = await getLoop(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "update_loop",
  {
    description: "Update a loop's fields (status, currentIteration, etc.)",
    inputSchema: {
      id: z.uuid(),
      status: z.enum(["queued", "running", "complete", "failed"]).optional(),
      currentIteration: z.number().int().optional(),
      prompt: z.string().optional(),
      maxIterations: z.number().int().optional(),
    },
  },
  async (args) => {
    const result = await updateLoop(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Doc tools ---

server.registerTool(
  "list_docs",
  {
    description: "List context docs, optionally filtered by repo (null for global docs)",
    inputSchema: { repoId: z.uuid().nullable().optional() },
  },
  async (args) => {
    const result = await listDocs(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

server.registerTool(
  "get_doc",
  {
    description: "Get a context doc by ID",
    inputSchema: { id: z.uuid() },
  },
  async (args) => {
    const result = await getDoc(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Session tools ---

server.registerTool(
  "get_session",
  {
    description: "Get a session by ID with its repo, branch, workspace mode, and PR state",
    inputSchema: { id: z.uuid() },
  },
  async (args) => {
    const result = await getSession(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// --- Loop tools (confirmation) ---

server.registerTool(
  "confirm_loop_details",
  {
    description:
      "Present loop configuration to the user for review before starting. The user will confirm in the nightshift UI. Always use this tool when the user wants to start a coding loop.",
    inputSchema: {
      name: z.string().describe("Loop name"),
      maxIterations: z.number().int().default(10).describe("Max iterations"),
      filterConfig: z
        .object({
          labels: z.array(z.string()).optional(),
          assignee: z.string().optional(),
        })
        .optional()
        .describe("Task filter config"),
    },
  },
  async (input) => {
    return {
      content: [{ type: "text", text: JSON.stringify({ ...input, action: "pending" }) }],
    };
  },
);

// --- Git / GitHub tools ---

server.registerTool(
  "push_changes",
  {
    description:
      "Push the current branch to the remote. Run this before creating a PR. Requires a sessionId so nightshift can track the push.",
    inputSchema: { sessionId: z.uuid() },
  },
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

server.registerTool(
  "create_pull_request",
  {
    description:
      "Create a GitHub pull request for the session's branch. Pushes first, then creates the PR. Updates the session with PR info so nightshift can track it.",
    inputSchema: {
      sessionId: z.uuid(),
      title: z.string(),
      body: z.string(),
      base: z.string().default("main"),
      draft: z.boolean().default(false),
    },
  },
  async ({ sessionId, title, body, base, draft }) => {
    const session = await getSession({ id: sessionId });
    if (!session.repo) throw new Error("Session has no associated repo");

    const cwd = session.worktreePath ?? session.repo.localPath;
    if (!cwd) throw new Error("No working directory for this session");

    const token = await getGitHubTokenFromDB();
    const branch = gitCurrentBranch(cwd);

    // Push first
    try {
      gitPush(cwd);
    } catch {
      /* may already be pushed */
    }

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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ url: existing.url, number: existing.number, existing: true }),
          },
        ],
      };
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

    return {
      content: [
        { type: "text", text: JSON.stringify({ url: pr.url, number: pr.number, created: true }) },
      ],
    };
  },
);

// --- Start server ---

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
