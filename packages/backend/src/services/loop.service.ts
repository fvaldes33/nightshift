import { db } from "@openralph/db/config/database";
import { and, eq } from "@openralph/db/drizzle";
import { loopEvents, insertLoopSchema, loops, updateLoopSchema } from "@openralph/db/models/index";
import { z } from "zod";
import type { ClaudeStreamEvent } from "../lib/claude-runner";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listLoops = fn(
  z.object({ sessionId: z.uuid().optional(), repoId: z.uuid().optional() }),
  async ({ sessionId, repoId }) => {
    return db.query.loops.findMany({
      where: and(
        sessionId ? eq(loops.sessionId, sessionId) : undefined,
        repoId ? eq(loops.repoId, repoId) : undefined,
      ),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
      with: { repo: true, task: true },
    });
  },
);

export const getLoop = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const loop = await db.query.loops.findFirst({
    where: eq(loops.id, id),
    with: { repo: true, task: true, session: true },
  });
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  return loop;
});

export const createLoop = fn(
  insertLoopSchema.pick({
    sessionId: true,
    repoId: true,
    taskId: true,
    name: true,
    prompt: true,
    branch: true,
    worktree: true,
    filterConfig: true,
    maxIterations: true,
  }),
  async (input) => {
    const [loop] = await db.insert(loops).values(input).returning();
    if (!loop) throw new AppError("Failed to create loop", "INTERNAL_ERROR");
    return loop;
  },
);

export const updateLoop = fn(updateLoopSchema.required({ id: true }), async ({ id, ...fields }) => {
  const [loop] = await db.update(loops).set(fields).where(eq(loops.id, id)).returning();
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  return loop;
});

export async function insertLoopEvent(
  loopId: string,
  iteration: number,
  seq: number,
  event: ClaudeStreamEvent,
) {
  await db.insert(loopEvents).values({
    loopId,
    iteration,
    seq,
    eventType: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
}

export const listLoopEvents = fn(
  z.object({ loopId: z.uuid(), iteration: z.number().int().optional() }),
  async ({ loopId, iteration }) => {
    return db.query.loopEvents.findMany({
      where: and(
        eq(loopEvents.loopId, loopId),
        iteration != null ? eq(loopEvents.iteration, iteration) : undefined,
      ),
      orderBy: (e, { asc }) => [asc(e.seq)],
    });
  },
);

export const deleteLoop = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const [loop] = await db.delete(loops).where(eq(loops.id, id)).returning();
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  return loop;
});
