import { createAnthropicLLM } from "@openralph/ai/models";
import { db } from "@openralph/db/config/database";
import { and, eq } from "@openralph/db/drizzle";
import { loopEvents, insertLoopSchema, loops, updateLoopSchema } from "@openralph/db/models/index";
import { generateText, Output } from "ai";
import { execSync } from "node:child_process";
import { z } from "zod";
import type { ClaudeStreamEvent } from "../lib/claude-runner";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";
import { getGitHubToken } from "./account.service";
import { createPullRequest, getPullRequest } from "./github.service";

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

// ---------------------------------------------------------------------------
// PR generation
// ---------------------------------------------------------------------------

const prSummarySchema = z.object({
  title: z.string().describe("Short PR title, under 70 characters"),
  body: z.string().describe("Markdown PR description with ## Summary and ## Changes sections"),
});

export const generatePRSummary = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const loop = await db.query.loops.findFirst({
    where: eq(loops.id, id),
    with: { repo: true },
  });
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");

  const events = await db.query.loopEvents.findMany({
    where: eq(loopEvents.loopId, id),
    orderBy: (e, { asc }) => [asc(e.seq)],
  });

  // Build context from loop events — assistant messages, tool calls, and results
  const relevantEvents = events.filter((e) =>
    ["assistant", "result", "tool_call", "tool_result"].includes(e.eventType),
  );

  const eventSummary = relevantEvents
    .map((e) => {
      const payload = e.payload as Record<string, unknown>;
      if (e.eventType === "assistant" && typeof payload.message === "string") {
        return `[assistant] ${payload.message}`;
      }
      if (e.eventType === "result" && typeof payload.result === "string") {
        return `[result] ${payload.result}`;
      }
      if (e.eventType === "tool_call") {
        return `[tool_call] ${payload.name ?? "unknown"}: ${JSON.stringify(payload.input ?? payload.args ?? {})}`;
      }
      if (e.eventType === "tool_result") {
        const output = typeof payload.output === "string" ? payload.output : JSON.stringify(payload.output ?? payload.result ?? "");
        return `[tool_result] ${output.slice(0, 500)}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

  const repoLabel = loop.repo ? `${loop.repo.owner}/${loop.repo.name}` : "unknown";

  const anthropic = createAnthropicLLM();

  const { output } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    output: Output.object({ schema: prSummarySchema }),
    prompt: `You are writing a GitHub pull request title and description.

Repository: ${repoLabel}
Branch: ${loop.branch ?? "unknown"}

## Original task prompt
${loop.prompt}

## Work log (loop events)
${eventSummary || "(no events recorded)"}

Based on the task prompt and work log, generate a concise PR title and a markdown body.
The title should be under 70 characters. The body should have ## Summary and ## Changes sections.
Focus on what was accomplished, not the process.`,
  });

  if (!output) throw new AppError("Failed to generate PR summary", "INTERNAL_ERROR");

  return output;
});

export const openPR = fn(
  z.object({
    id: z.uuid(),
    title: z.string(),
    body: z.string(),
    base: z.string().default("main"),
    draft: z.boolean().default(false),
  }),
  async ({ id, title, body, base, draft }) => {
    const loop = await db.query.loops.findFirst({
      where: eq(loops.id, id),
      with: { repo: true },
    });
    if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
    if (!loop.repo) throw new AppError("Loop has no associated repository", "BAD_REQUEST");
    if (!loop.branch) throw new AppError("Loop has no branch set", "BAD_REQUEST");

    const token = await getGitHubToken({});

    // Push the branch to the remote if worktree is still available
    if (loop.worktree) {
      try {
        execSync("git push -u origin HEAD", { cwd: loop.worktree, stdio: "pipe" });
      } catch {
        // Branch may already be pushed — continue and let the PR creation fail if not
      }
    }

    const pr = await createPullRequest({
      token,
      owner: loop.repo.owner,
      repo: loop.repo.name,
      head: loop.branch,
      base,
      title,
      body,
      draft,
    });

    // Persist PR info on the loop
    const [updated] = await db
      .update(loops)
      .set({ prNumber: pr.number, prUrl: pr.url, prStatus: "open" })
      .where(eq(loops.id, id))
      .returning();

    return { ...pr, loop: updated };
  },
);

export const syncPRStatus = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const loop = await db.query.loops.findFirst({
    where: eq(loops.id, id),
    with: { repo: true },
  });
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  if (!loop.repo || !loop.prNumber) {
    throw new AppError("Loop has no PR to sync", "BAD_REQUEST");
  }

  const token = await getGitHubToken({});

  const pr = await getPullRequest({
    token,
    owner: loop.repo.owner,
    repo: loop.repo.name,
    pullNumber: loop.prNumber,
  });

  const prStatus: "open" | "merged" | "closed" = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open";

  const [updated] = await db
    .update(loops)
    .set({ prStatus })
    .where(eq(loops.id, id))
    .returning();

  return updated;
});
