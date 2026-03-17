import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { repos } from "./repo.model";

export const sessionModeEnum = pgEnum("session_mode", ["chat", "plan", "execute"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "archived"]);
export const workspaceStatusEnum = pgEnum("workspace_status", [
  "pending",
  "cloning",
  "ready",
  "failed",
]);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    repoId: uuid("repo_id").references(() => repos.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    mode: sessionModeEnum("mode").notNull().default("chat"),
    status: sessionStatusEnum("status").notNull().default("active"),
    branch: text("branch"),
    worktreePath: text("worktree_path"),
    workspaceStatus: workspaceStatusEnum("workspace_status").notNull().default("pending"),
    workspaceError: text("workspace_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("sessions_repo_id_idx").on(table.repoId)],
);

const zSessionMode = z.enum(sessionModeEnum.enumValues);
const zSessionStatus = z.enum(sessionStatusEnum.enumValues);
const zWorkspaceStatus = z.enum(workspaceStatusEnum.enumValues);

export const insertSessionSchema = createInsertSchema(sessions, {
  mode: zSessionMode,
  status: zSessionStatus,
  workspaceStatus: zWorkspaceStatus,
});
export const selectSessionSchema = createSelectSchema(sessions, {
  mode: zSessionMode,
  status: zSessionStatus,
  workspaceStatus: zWorkspaceStatus,
});
export const updateSessionSchema = createUpdateSchema(sessions, {
  mode: zSessionMode.optional(),
  status: zSessionStatus.optional(),
  workspaceStatus: zWorkspaceStatus.optional(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type UpdateSession = z.infer<typeof updateSessionSchema>;
export type SessionMode = Session["mode"];
export type SessionStatus = Session["status"];
export type WorkspaceStatus = Session["workspaceStatus"];
