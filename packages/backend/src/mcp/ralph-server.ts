import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getDoc, listDocs } from "../services/doc.service";
import { getLoop, updateLoop } from "../services/loop.service";
import { createMessage } from "../services/message.service";
import { addTaskComment, getTask, listTasks, updateTask } from "../services/task.service";

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
    branch: z.string().nullable().optional(),
    worktree: z.string().nullable().optional(),
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

// --- Start server ---

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
