import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { repos } from "./repo.model";

export const sessionModeEnum = pgEnum("session_mode", ["chat", "plan", "execute"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "archived"]);
export const workspaceModeEnum = pgEnum("workspace_mode", ["local", "worktree"]);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    mode: sessionModeEnum("mode").notNull().default("chat"),
    provider: text("provider").notNull().default("anthropic"),
    model: text("model").notNull().default("claude-sonnet-4-6"),
    status: sessionStatusEnum("status").notNull().default("active"),
    workspaceMode: workspaceModeEnum("workspace_mode").notNull().default("local"),
    branch: text("branch"),
    worktreePath: text("worktree_path"),
    claudeSessionId: text("claude_session_id"),
    prBranch: text("pr_branch"),
    prNumber: integer("pr_number"),
    prUrl: text("pr_url"),
    prStatus: text("pr_status").$type<"open" | "merged" | "closed">(),
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
const zWorkspaceMode = z.enum(workspaceModeEnum.enumValues);
const zPRStatus = z.enum(["open", "merged", "closed"]);

export const insertSessionSchema = createInsertSchema(sessions, {
  mode: zSessionMode,
  status: zSessionStatus,
  workspaceMode: zWorkspaceMode,
  prStatus: zPRStatus.nullish(),
});
export const selectSessionSchema = createSelectSchema(sessions, {
  mode: zSessionMode,
  status: zSessionStatus,
  workspaceMode: zWorkspaceMode,
  prStatus: zPRStatus.nullable(),
});
export const updateSessionSchema = createUpdateSchema(sessions, {
  mode: zSessionMode.optional(),
  status: zSessionStatus.optional(),
  workspaceMode: zWorkspaceMode.optional(),
  prStatus: zPRStatus.nullish(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type UpdateSession = z.infer<typeof updateSessionSchema>;
export type SessionMode = Session["mode"];
export type SessionStatus = Session["status"];
export type WorkspaceMode = Session["workspaceMode"];
