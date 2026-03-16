import { eq } from "@openralph/db/drizzle";
import { z } from "zod";
import { db } from "@openralph/db/config/database";
import { insertLoopSchema, loops, updateLoopSchema } from "@openralph/db/models/index";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";

export const listLoops = fn(
  z.object({ sessionId: z.string().uuid().optional() }),
  async ({ sessionId }) => {
    return db.query.loops.findMany({
      where: sessionId ? eq(loops.sessionId, sessionId) : undefined,
      orderBy: (l, { desc }) => [desc(l.createdAt)],
      with: { repo: true, task: true },
    });
  },
);

export const getLoop = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
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

export const updateLoop = fn(
  updateLoopSchema.required({ id: true }),
  async ({ id, ...fields }) => {
    const [loop] = await db.update(loops).set(fields).where(eq(loops.id, id)).returning();
    if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
    return loop;
  },
);

export const deleteLoop = fn(z.object({ id: z.string().uuid() }), async ({ id }) => {
  const [loop] = await db.delete(loops).where(eq(loops.id, id)).returning();
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  return loop;
});
