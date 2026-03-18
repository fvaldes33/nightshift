import { db } from "@openralph/db/config/database";
import { and, eq, ilike, inArray, isNull } from "@openralph/db/drizzle";
import {
  insertTaskSchema,
  taskStatusEnum,
  tasks,
  updateTaskSchema,
  zTaskCommentSchema,
} from "@openralph/db/models/index";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listTasks = fn(
  z.object({
    repoId: z.uuid().optional(),
    status: z.string().optional(),
    assignee: z.string().optional(),
    parentId: z.uuid().nullable().optional(),
  }),
  async ({ repoId, status, assignee, parentId }) => {
    return db.query.tasks.findMany({
      where: and(
        repoId ? eq(tasks.repoId, repoId) : undefined,
        status ? eq(tasks.status, status as (typeof tasks.status.enumValues)[number]) : undefined,
        assignee ? ilike(tasks.assignee, assignee) : undefined,
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

export const getTask = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { subtasks: true, repo: true },
  });
  if (!task) throw new AppError("Task not found", "NOT_FOUND");
  return task;
});

export const createTask = fn(
  insertTaskSchema.pick({
    repoId: true,
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

export const updateTask = fn(updateTaskSchema.required({ id: true }), async ({ id, ...fields }) => {
  const [task] = await db.update(tasks).set(fields).where(eq(tasks.id, id)).returning();
  if (!task) throw new AppError("Task not found", "NOT_FOUND");
  return task;
});

export const addTaskComment = fn(
  z.object({ id: z.uuid(), comment: zTaskCommentSchema }),
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

export const deleteTask = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const [task] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  if (!task) throw new AppError("Task not found", "NOT_FOUND");
  return task;
});

export const bulkUpdateTasks = fn(
  z.object({
    ids: z.array(z.uuid()).min(1),
    status: z.enum(taskStatusEnum.enumValues).optional(),
    priority: z.number().int().min(1).max(4).optional(),
    assignee: z.string().nullable().optional(),
  }),
  async ({ ids, ...fields }) => {
    const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(updates).length === 0) throw new AppError("No fields to update", "BAD_REQUEST");
    const result = await db.update(tasks).set(updates).where(inArray(tasks.id, ids)).returning({ id: tasks.id });
    return { updated: result.length };
  },
);

export const bulkDeleteTasks = fn(
  z.object({ ids: z.array(z.uuid()).min(1) }),
  async ({ ids }) => {
    const result = await db.delete(tasks).where(inArray(tasks.id, ids)).returning({ id: tasks.id });
    return { deleted: result.length };
  },
);
