import { createAnthropicLLM } from "@openralph/ai/models";
import { db } from "@openralph/db/config/database";
import { and, eq } from "@openralph/db/drizzle";
import { loopEvents, insertLoopSchema, loops, updateLoopSchema } from "@openralph/db/models/index";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { ClaudeStreamEvent } from "../lib/claude-runner";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";
import { getGitHubToken } from "./account.service";
import { gitPush, gitUnpushedCount } from "./git-cli.service";
import { createPullRequest, getPullRequest, listPullRequests } from "./github.service";
import { cleanupWorktree as removeWorktreeFromDisk } from "./workspace.service";

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
    // Carry forward PR info from sibling loops on the same session/branch
    let prFields: { prNumber: number; prUrl: string; prStatus: "open" | "merged" | "closed" } | undefined;
    if (input.sessionId && input.branch) {
      const sibling = await db.query.loops.findFirst({
        where: and(
          eq(loops.sessionId, input.sessionId),
          eq(loops.branch, input.branch),
        ),
        columns: { prNumber: true, prUrl: true, prStatus: true },
        orderBy: (l, { desc }) => [desc(l.createdAt)],
      });
      if (sibling?.prNumber && sibling.prUrl && sibling.prStatus) {
        prFields = { prNumber: sibling.prNumber, prUrl: sibling.prUrl, prStatus: sibling.prStatus };
      }
    }

    const [loop] = await db.insert(loops).values({ ...input, ...prFields }).returning();
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
// Check for existing PR on branch
// ---------------------------------------------------------------------------

export const checkExistingPR = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const loop = await db.query.loops.findFirst({
    where: eq(loops.id, id),
    with: { repo: true },
  });
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  if (!loop.repo || !loop.branch) return null;

  const token = await getGitHubToken({});

  const existingPRs = await listPullRequests({
    token,
    owner: loop.repo.owner,
    repo: loop.repo.name,
    state: "open",
    head: `${loop.repo.owner}:${loop.branch}`,
  });

  if (existingPRs.length === 0) return null;

  const pr = existingPRs[0]!;
  return { number: pr.number, url: pr.url, title: pr.title };
});

// ---------------------------------------------------------------------------
// Push to remote
// ---------------------------------------------------------------------------

export const pushToRemote = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const loop = await db.query.loops.findFirst({
    where: eq(loops.id, id),
    with: { repo: true },
  });
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  if (!loop.worktree) throw new AppError("Loop has no worktree", "BAD_REQUEST");

  if (gitUnpushedCount(loop.worktree) === 0) {
    throw new AppError("Nothing to push — remote is already up to date", "BAD_REQUEST");
  }

  try {
    gitPush(loop.worktree);
  } catch {
    throw new AppError("Failed to push", "BAD_REQUEST");
  }

  return { pushed: true };
});

// ---------------------------------------------------------------------------
// Worktree cleanup
// ---------------------------------------------------------------------------

export const cleanupLoopWorktree = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const loop = await db.query.loops.findFirst({
    where: eq(loops.id, id),
    with: { repo: true },
  });
  if (!loop) throw new AppError("Loop not found", "NOT_FOUND");
  if (!loop.worktree) throw new AppError("No worktree to clean up", "BAD_REQUEST");
  if (!loop.repo) throw new AppError("Loop has no associated repository", "BAD_REQUEST");

  const worktreePath = loop.worktree;

  // Remove from disk via git worktree remove
  removeWorktreeFromDisk({
    owner: loop.repo.owner,
    name: loop.repo.name,
    worktreePath,
  });

  // Null out worktree on all loops that reference this path
  await db
    .update(loops)
    .set({ worktree: null })
    .where(eq(loops.worktree, worktreePath));

  return { removed: worktreePath };
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

    // Always push latest commits first
    if (loop.worktree) {
      try {
        gitPush(loop.worktree);
      } catch {
        // Branch may already be pushed — continue and let the PR creation fail if not
      }
    }

    // Check if an open PR already exists for this branch
    const existingPRs = await listPullRequests({
      token,
      owner: loop.repo.owner,
      repo: loop.repo.name,
      state: "open",
      head: `${loop.repo.owner}:${loop.branch}`,
    });

    if (existingPRs.length > 0) {
      const existing = existingPRs[0]!;

      // Persist PR info on this loop (may be a follow-up loop on the same branch)
      const [updated] = await db
        .update(loops)
        .set({ prNumber: existing.number, prUrl: existing.url, prStatus: "open" })
        .where(eq(loops.id, id))
        .returning();

      return { url: existing.url, number: existing.number, pushed: true, loop: updated };
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

    return { ...pr, pushed: false, loop: updated };
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

  // Update all loops sharing this PR number
  await db
    .update(loops)
    .set({ prStatus })
    .where(eq(loops.prNumber, loop.prNumber));

  const updated = await db.query.loops.findFirst({
    where: eq(loops.id, id),
    with: { repo: true, task: true, session: true },
  });

  return updated!;
});
