import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { insertMessageSchema, messages } from "@openralph/db/models/index";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listMessages = fn(z.object({ sessionId: z.uuid() }), async ({ sessionId }) => {
  return db.query.messages.findMany({
    where: eq(messages.sessionId, sessionId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });
});

export const createMessage = fn(
  insertMessageSchema.pick({
    sessionId: true,
    role: true,
    name: true,
    parts: true,
    metadata: true,
  }),
  async (input) => {
    const [message] = await db.insert(messages).values(input).returning();
    if (!message) throw new AppError("Failed to create message", "INTERNAL_ERROR");
    return message;
  },
);

export const deleteMessage = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const [message] = await db.delete(messages).where(eq(messages.id, id)).returning();
  if (!message) throw new AppError("Message not found", "NOT_FOUND");
  return message;
});
