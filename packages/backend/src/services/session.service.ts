import { eq } from "@openralph/db/drizzle";
import { z } from "zod";
import { db } from "@openralph/db/config/database";
import { insertSessionSchema, sessions, updateSessionSchema } from "@openralph/db/models/index";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listSessions = fn(z.object({}), async () => {
  return db.query.sessions.findMany({
    orderBy: (s, { desc }) => [desc(s.updatedAt)],
    with: { repo: true },
  });
});

export const getSession = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: { repo: true, messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] } },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND");
  return session;
});

export const createSession = fn(
  insertSessionSchema.pick({ repoId: true, title: true, mode: true }),
  async (input) => {
    const [session] = await db.insert(sessions).values(input).returning();
    if (!session) throw new AppError("Failed to create session", "INTERNAL_ERROR");
    return session;
  },
);

export const updateSession = fn(
  updateSessionSchema.required({ id: true }),
  async ({ id, ...fields }) => {
    const [session] = await db
      .update(sessions)
      .set(fields)
      .where(eq(sessions.id, id))
      .returning();
    if (!session) throw new AppError("Session not found", "NOT_FOUND");
    return session;
  },
);

export const deleteSession = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
  const [session] = await db.delete(sessions).where(eq(sessions.id, id)).returning();
  if (!session) throw new AppError("Session not found", "NOT_FOUND");
  return session;
});
