import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { repos } from "./repo.model";
import { sessions } from "./session.model";
import { tasks } from "./task.model";

export const loopStatusEnum = pgEnum("loop_status", ["queued", "running", "complete", "failed"]);

export const zLoopFilterConfigSchema = z.object({
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
});
export type LoopFilterConfig = z.infer<typeof zLoopFilterConfigSchema>;

export const loops = pgTable(
  "loops",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: loopStatusEnum("status").notNull().default("queued"),
    prompt: text("prompt").notNull(),
    branch: text("branch"),
    worktree: text("worktree"),
    filterConfig: jsonb("filter_config").$type<LoopFilterConfig>(),
    currentIteration: integer("current_iteration").notNull().default(0),
    maxIterations: integer("max_iterations").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("loops_session_id_idx").on(table.sessionId),
    index("loops_repo_id_idx").on(table.repoId),
    index("loops_task_id_idx").on(table.taskId),
    index("loops_status_idx").on(table.status),
  ],
);

const zLoopStatus = z.enum(loopStatusEnum.enumValues);

export const insertLoopSchema = createInsertSchema(loops, {
  status: zLoopStatus,
  filterConfig: zLoopFilterConfigSchema.nullish(),
});
export const selectLoopSchema = createSelectSchema(loops, {
  status: zLoopStatus,
  filterConfig: zLoopFilterConfigSchema.nullable(),
});
export const updateLoopSchema = createUpdateSchema(loops, {
  status: zLoopStatus.optional(),
  filterConfig: zLoopFilterConfigSchema.nullish(),
});

export type Loop = typeof loops.$inferSelect;
export type NewLoop = typeof loops.$inferInsert;
export type UpdateLoop = z.infer<typeof updateLoopSchema>;
export type LoopStatus = Loop["status"];
