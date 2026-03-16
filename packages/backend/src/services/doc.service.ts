import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@openralph/db/config/database";
import { docs, insertDocSchema, updateDocSchema } from "@openralph/db/models/index";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listDocs = fn(
  z.object({ repoId: z.string().uuid().nullable().optional() }),
  async ({ repoId }) => {
    return db.query.docs.findMany({
      where: repoId === null
        ? isNull(docs.repoId)
        : repoId
          ? eq(docs.repoId, repoId)
          : undefined,
      orderBy: (d, { asc }) => [asc(d.title)],
    });
  },
);

export const getDoc = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
  const doc = await db.query.docs.findFirst({ where: eq(docs.id, id) });
  if (!doc) throw new AppError("Doc not found", "NOT_FOUND");
  return doc;
});

export const createDoc = fn(
  insertDocSchema.pick({ repoId: true, title: true, content: true }),
  async (input) => {
    const [doc] = await db.insert(docs).values(input).returning();
    if (!doc) throw new AppError("Failed to create doc", "INTERNAL_ERROR");
    return doc;
  },
);

export const updateDoc = fn(
  updateDocSchema.required({ id: true }),
  async ({ id, ...fields }) => {
    const [doc] = await db.update(docs).set(fields).where(eq(docs.id, id)).returning();
    if (!doc) throw new AppError("Doc not found", "NOT_FOUND");
    return doc;
  },
);

export const deleteDoc = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
  const [doc] = await db.delete(docs).where(eq(docs.id, id)).returning();
  if (!doc) throw new AppError("Doc not found", "NOT_FOUND");
  return doc;
});
