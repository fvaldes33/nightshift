import { tool } from "ai";
import { z } from "zod";
import { AgentContext } from "../lib/context";
import {
  addTaskComment,
  createTask,
  getTask,
  listTasks,
  updateTask,
} from "../services/task.service";

export const list_tasks = tool({
  description:
    "List tasks for this session's repo, optionally filtered by status, assignee, or parent.",
  inputSchema: z.object({
    status: z.string().optional(),
    assignee: z.string().optional(),
    parentId: z.uuid().nullable().optional(),
  }),
  execute: async (input) => {
    const ctx = AgentContext.use();
    return listTasks({ ...input, repoId: ctx.repoId ?? undefined });
  },
});

export const get_task = tool({
  description: "Get a task by ID with its subtasks, repo, and session.",
  inputSchema: z.object({
    id: z.uuid(),
  }),
  execute: async (input) => getTask(input),
});

export const create_task = tool({
  description: "Create a new task. Used during planning to break work into trackable units.",
  inputSchema: z.object({
    parentId: z.uuid().optional().describe("Parent task ID for subtasks"),
    title: z.string().describe("Short task title"),
    description: z.string().optional().describe("Detailed task description"),
    status: z
      .enum(["backlog", "todo", "in_progress", "done", "canceled"])
      .default("todo")
      .describe("Task status"),
    priority: z.number().int().default(3).describe("Priority (1=highest, 5=lowest)"),
    assignee: z.string().optional().describe("Who this task is assigned to"),
    labels: z.array(z.string()).default([]).describe("Labels for categorization"),
    sortOrder: z.number().int().default(0).describe("Sort order within the list"),
  }),
  execute: async (input) => {
    const ctx = AgentContext.use();
    return createTask({
      ...input,
      repoId: ctx.repoId!,
      sessionId: ctx.sessionId,
    });
  },
});

export const update_task = tool({
  description: "Update a task's fields (status, title, description, assignee, priority, labels).",
  inputSchema: z.object({
    id: z.uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["backlog", "todo", "in_progress", "done", "canceled"]).optional(),
    priority: z.number().int().optional(),
    assignee: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    sortOrder: z.number().int().optional(),
  }),
  execute: async (input) => updateTask(input),
});

export const add_task_comment = tool({
  description: "Add a comment to a task with findings or learnings.",
  inputSchema: z.object({
    id: z.uuid(),
    content: z.string().describe("The comment text"),
  }),
  execute: async ({ id, content }) => {
    return addTaskComment({
      id,
      comment: {
        id: crypto.randomUUID(),
        author: "nightshift",
        content,
        createdAt: new Date().toISOString(),
      },
    });
  },
});
