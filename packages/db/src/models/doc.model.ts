import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import type { z } from "zod";
import { repos } from "./repo.model";

export const docs = pgTable(
  "docs",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    repoId: uuid("repo_id").references(() => repos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("docs_repo_id_idx").on(table.repoId)],
);

export const insertDocSchema = createInsertSchema(docs);
export const selectDocSchema = createSelectSchema(docs);
export const updateDocSchema = createUpdateSchema(docs);

export type Doc = typeof docs.$inferSelect;
export type NewDoc = typeof docs.$inferInsert;
export type UpdateDoc = z.infer<typeof updateDocSchema>;
