import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { repos } from "./repo.model";

export const sessionModeEnum = pgEnum("session_mode", ["chat", "plan", "execute"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "archived"]);

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
    branch: text("branch"),
    claudeSessionId: text("claude_session_id"),
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

export const insertSessionSchema = createInsertSchema(sessions, {
  mode: zSessionMode,
  status: zSessionStatus,
});
export const selectSessionSchema = createSelectSchema(sessions, {
  mode: zSessionMode,
  status: zSessionStatus,
});
export const updateSessionSchema = createUpdateSchema(sessions, {
  mode: zSessionMode.optional(),
  status: zSessionStatus.optional(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type UpdateSession = z.infer<typeof updateSessionSchema>;
export type SessionMode = Session["mode"];
export type SessionStatus = Session["status"];
