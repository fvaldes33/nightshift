import { db } from "@openralph/db/config/database";
import { and, eq, inArray, isNull } from "@openralph/db/drizzle";
import { docs, docTargetEnum, insertDocSchema, updateDocSchema } from "@openralph/db/models/index";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listDocs = fn(
  z.object({
    repoId: z.uuid().nullable().optional(),
    target: z.enum(docTargetEnum.enumValues).optional(),
  }),
  async ({ repoId, target }) => {
    return db.query.docs.findMany({
      where: and(
        repoId === null ? isNull(docs.repoId) : repoId ? eq(docs.repoId, repoId) : undefined,
        target ? eq(docs.target, target) : undefined,
      ),
      orderBy: (d, { asc }) => [asc(d.title)],
    });
  },
);

export const getDoc = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const doc = await db.query.docs.findFirst({ where: eq(docs.id, id) });
  if (!doc) throw new AppError("Doc not found", "NOT_FOUND");
  return doc;
});

export const createDoc = fn(
  insertDocSchema.pick({ repoId: true, title: true, content: true, target: true }),
  async (input) => {
    const [doc] = await db.insert(docs).values(input).returning();
    if (!doc) throw new AppError("Failed to create doc", "INTERNAL_ERROR");
    return doc;
  },
);

export const updateDoc = fn(updateDocSchema.required({ id: true }), async ({ id, ...fields }) => {
  const [doc] = await db.update(docs).set(fields).where(eq(docs.id, id)).returning();
  if (!doc) throw new AppError("Doc not found", "NOT_FOUND");
  return doc;
});

export const deleteDoc = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const [doc] = await db.delete(docs).where(eq(docs.id, id)).returning();
  if (!doc) throw new AppError("Doc not found", "NOT_FOUND");
  return doc;
});
