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
    id: true,
    sessionId: true,
    role: true,
    name: true,
    parts: true,
    metadata: true,
  }),
  async (input) => {
    const [message] = await db
      .insert(messages)
      .values(input)
      .onConflictDoUpdate({
        target: messages.id,
        set: { parts: input.parts, metadata: input.metadata },
      })
      .returning();
    if (!message) throw new AppError("Failed to create message", "INTERNAL_ERROR");
    return message;
  },
);

export const patchToolOutput = fn(
  z.object({
    sessionId: z.uuid(),
    toolCallId: z.string(),
    output: z.unknown(),
  }),
  async ({ sessionId, toolCallId, output }) => {
    const sessionMessages = await db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
    });

    const target = sessionMessages.find((m) =>
      (m.parts as any[])?.some((p: any) => p.toolCallId === toolCallId),
    );

    if (!target) throw new AppError("Message with tool call not found", "NOT_FOUND");

    const updatedParts = (target.parts as any[]).map((p: any) =>
      p.toolCallId === toolCallId ? { ...p, state: "output-available", output } : p,
    );

    const [updated] = await db
      .update(messages)
      .set({ parts: updatedParts })
      .where(eq(messages.id, target.id))
      .returning();

    if (!updated) throw new AppError("Failed to update message", "INTERNAL_ERROR");
    return updated;
  },
);

export const deleteMessage = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const [message] = await db.delete(messages).where(eq(messages.id, id)).returning();
  if (!message) throw new AppError("Message not found", "NOT_FOUND");
  return message;
});
