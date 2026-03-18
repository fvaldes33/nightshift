import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

export const workspaceStatusEnum = pgEnum("workspace_status", [
  "pending",
  "cloning",
  "ready",
  "failed",
]);

export const repos = pgTable("repos", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey()
    .notNull(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  defaultBranch: text("default_branch").notNull().default("main"),
  cloneUrl: text("clone_url"),
  localPath: text("local_path"),
  workspaceStatus: workspaceStatusEnum("workspace_status").notNull().default("pending"),
  workspaceError: text("workspace_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

const zWorkspaceStatus = z.enum(workspaceStatusEnum.enumValues);

export const insertRepoSchema = createInsertSchema(repos, {
  workspaceStatus: zWorkspaceStatus,
});
export const selectRepoSchema = createSelectSchema(repos, {
  workspaceStatus: zWorkspaceStatus,
});
export const updateRepoSchema = createUpdateSchema(repos, {
  workspaceStatus: zWorkspaceStatus.optional(),
});

export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;
export type UpdateRepo = z.infer<typeof updateRepoSchema>;
export type WorkspaceStatus = Repo["workspaceStatus"];
