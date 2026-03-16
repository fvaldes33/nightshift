import type { UIMessage } from "ai";
import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { sessions } from "./session.model";

export const messageRoleEnum = pgEnum("message_role", ["system", "user", "assistant"]);

// Loose Zod schema for JSONB — type annotation gives compile-time safety,
// z.any() avoids brittle structural checks on AI SDK's internal format.
export const messagePartSchema: z.ZodType<UIMessage["parts"]> = z.array(z.any());

export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    name: text("name"),
    parts: jsonb("parts").$type<UIMessage["parts"]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_session_id_idx").on(table.sessionId),
    index("messages_session_created_at_idx").on(table.sessionId, table.createdAt),
  ],
);

const zMessageRole = z.enum(messageRoleEnum.enumValues);

export const insertMessageSchema = createInsertSchema(messages, {
  role: zMessageRole,
  parts: messagePartSchema,
  metadata: z.record(z.string(), z.unknown()).nullish(),
});
export const selectMessageSchema = createSelectSchema(messages, {
  role: zMessageRole,
  parts: messagePartSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
});
export const updateMessageSchema = createUpdateSchema(messages, {
  role: zMessageRole.optional(),
  parts: messagePartSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type MessageRole = Message["role"];
