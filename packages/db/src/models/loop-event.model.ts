import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { loops } from "./loop.model";

export const loopEvents = pgTable(
  "loop_events",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    loopId: uuid("loop_id")
      .notNull()
      .references(() => loops.id, { onDelete: "cascade" }),
    iteration: integer("iteration").notNull(),
    seq: integer("seq").notNull(),
    eventType: text("event_type").notNull(), // init, assistant, thinking, tool_call, tool_result, result
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("loop_events_loop_id_seq_idx").on(table.loopId, table.seq),
    index("loop_events_loop_id_iteration_idx").on(table.loopId, table.iteration),
  ],
);

export const insertLoopEventSchema = createInsertSchema(loopEvents);
export const selectLoopEventSchema = createSelectSchema(loopEvents);

export type LoopEvent = typeof loopEvents.$inferSelect;
export type NewLoopEvent = typeof loopEvents.$inferInsert;
