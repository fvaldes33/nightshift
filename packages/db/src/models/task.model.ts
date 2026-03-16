import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { repos } from "./repo.model";
import { sessions } from "./session.model";

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled",
]);

export const zTaskCommentSchema = z.object({
  id: z.string(),
  author: z.string(),
  content: z.string(),
  createdAt: z.string(),
});
export type TaskComment = z.infer<typeof zTaskCommentSchema>;

export const zTaskCommentsSchema = z.array(zTaskCommentSchema);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    repoId: uuid("repo_id").references(() => repos.id, { onDelete: "set null" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("backlog"),
    priority: integer("priority").notNull().default(3),
    assignee: text("assignee"),
    labels: text("labels").array().notNull().default([]),
    comments: jsonb("comments").$type<TaskComment[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tasks_repo_id_idx").on(table.repoId),
    index("tasks_session_id_idx").on(table.sessionId),
    index("tasks_parent_id_idx").on(table.parentId),
    index("tasks_status_idx").on(table.status),
    index("tasks_assignee_idx").on(table.assignee),
  ],
);

const zTaskStatus = z.enum(taskStatusEnum.enumValues);

export const insertTaskSchema = createInsertSchema(tasks, {
  status: zTaskStatus,
  comments: zTaskCommentsSchema,
  labels: z.array(z.string()),
});
export const selectTaskSchema = createSelectSchema(tasks, {
  status: zTaskStatus,
  comments: zTaskCommentsSchema,
  labels: z.array(z.string()),
});
export const updateTaskSchema = createUpdateSchema(tasks, {
  status: zTaskStatus.optional(),
  comments: zTaskCommentsSchema.optional(),
  labels: z.array(z.string()).optional(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type TaskStatus = Task["status"];
