import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { repos } from "./repo.model";

export const docTargetEnum = pgEnum("doc_target", ["all", "ralph", "chat"]);

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
    target: docTargetEnum("target").notNull().default("all"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("docs_repo_id_idx").on(table.repoId),
    index("docs_target_idx").on(table.target),
  ],
);

const zDocTarget = z.enum(docTargetEnum.enumValues);

export const insertDocSchema = createInsertSchema(docs, { target: zDocTarget.optional() });
export const selectDocSchema = createSelectSchema(docs, { target: zDocTarget });
export const updateDocSchema = createUpdateSchema(docs, { target: zDocTarget.optional() });

export type Doc = typeof docs.$inferSelect;
export type NewDoc = typeof docs.$inferInsert;
export type UpdateDoc = z.infer<typeof updateDocSchema>;
export type DocTarget = Doc["target"];
