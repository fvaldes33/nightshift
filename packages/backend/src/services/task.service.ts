import { and, eq, isNull } from "@openralph/db/drizzle";
import { z } from "zod";
import { db } from "@openralph/db/config/database";
import {
  insertTaskSchema,
  tasks,
  updateTaskSchema,
  zTaskCommentSchema,
} from "@openralph/db/models/index";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listTasks = fn(
  z.object({
    repoId: z.string().uuid().optional(),
    status: z.string().optional(),
    assignee: z.string().optional(),
    parentId: z.string().uuid().nullable().optional(),
  }),
  async ({ repoId, status, assignee, parentId }) => {
    return db.query.tasks.findMany({
      where: and(
        repoId ? eq(tasks.repoId, repoId) : undefined,
        status ? eq(tasks.status, status as typeof tasks.status.enumValues[number]) : undefined,
        assignee ? eq(tasks.assignee, assignee) : undefined,
        parentId !== undefined
          ? parentId === null
            ? isNull(tasks.parentId)
            : eq(tasks.parentId, parentId)
          : undefined,
      ),
      orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.createdAt)],
      with: { subtasks: true },
    });
  },
);

export const getTask = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { subtasks: true, repo: true, session: true },
  });
  if (!task) throw new AppError("Task not found", "NOT_FOUND");
  return task;
});

export const createTask = fn(
  insertTaskSchema.pick({
    repoId: true,
    sessionId: true,
    parentId: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    assignee: true,
    labels: true,
    sortOrder: true,
  }),
  async (input) => {
    const [task] = await db.insert(tasks).values(input).returning();
    if (!task) throw new AppError("Failed to create task", "INTERNAL_ERROR");
    return task;
  },
);

export const updateTask = fn(
  updateTaskSchema.required({ id: true }),
  async ({ id, ...fields }) => {
    const [task] = await db.update(tasks).set(fields).where(eq(tasks.id, id)).returning();
    if (!task) throw new AppError("Task not found", "NOT_FOUND");
    return task;
  },
);

export const addTaskComment = fn(
  z.object({ id: z.string().uuid(), comment: zTaskCommentSchema }),
  async ({ id, comment }) => {
    const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!existing) throw new AppError("Task not found", "NOT_FOUND");
    const [task] = await db
      .update(tasks)
      .set({ comments: [...existing.comments, comment] })
      .where(eq(tasks.id, id))
      .returning();
    if (!task) throw new AppError("Failed to add comment", "INTERNAL_ERROR");
    return task;
  },
);

export const deleteTask = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
  const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (!task) throw new AppError("Task not found", "NOT_FOUND");
  return task;
});
