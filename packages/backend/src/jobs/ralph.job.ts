import { z } from "zod";
import { runClaude } from "../lib/claude-runner";
import { RALPH_ALLOWED_TOOLS, RALPH_DISALLOWED_TOOLS } from "../lib/claude-tools";
import { ensureMcpConfig } from "../lib/mcp-config";
import { createQueue } from "../lib/queue-builder";
import { getLoop, insertLoopEvent, updateLoop } from "../services/loop.service";
import { assembleRalphPrompt } from "../services/prompt.service";
import { getSession, resolveSessionCwd } from "../services/session.service";
import { listTasks } from "../services/task.service";
import { ensureRepoWorkspace } from "../services/workspace.service";

// ---------------------------------------------------------------------------
// Queue: ralph/loop — sets status to running and kicks off first iteration
// ---------------------------------------------------------------------------

export const ralphLoopQueue = createQueue({
  name: "ralph/loop",
  input: z.object({
    loopId: z.uuid(),
  }),
  queueOptions: {
    retryLimit: 0,
  },
});

ralphLoopQueue.work(async (job) => {
  const { loopId } = job.data;
  console.log(`[ralph] Starting loop ${loopId}`);

  const loop = await getLoop({ id: loopId });
  if (!loop.repo) throw new Error(`Loop ${loopId} has no associated repo`);

  // Ensure repo is cloned locally
  await ensureRepoWorkspace(loop.repo);

  // Resolve cwd from the loop's session
  const session = await getSession({ id: loop.sessionId });
  const resolved = await resolveSessionCwd(session, { forceCheckout: true });
  if (!resolved) throw new Error(`Could not resolve working directory for loop ${loopId}`);

  await updateLoop({ id: loopId, status: "running" });

  // Queue the first iteration
  await ralphIterationQueue.send({ loopId, iteration: loop.currentIteration });
});

// ---------------------------------------------------------------------------
// Queue: ralph/iteration — runs a single claude -p iteration
// ---------------------------------------------------------------------------

export const ralphIterationQueue = createQueue({
  name: "ralph/iteration",
  input: z.object({
    loopId: z.uuid(),
    iteration: z.number().int(),
  }),
  queueOptions: {
    retryLimit: 2,
  },
});

ralphIterationQueue.work(async (job) => {
  const { loopId, iteration } = job.data;
  console.log(`[ralph] Loop ${loopId} — iteration ${iteration + 1}`);

  const loop = await getLoop({ id: loopId });

  // Guard: loop may have been canceled or already completed
  if (loop.status !== "running") {
    console.log(`[ralph] Loop ${loopId} is ${loop.status}, skipping iteration`);
    return;
  }

  const cwd = loop.session?.worktreePath ?? loop.repo?.localPath ?? ".";

  try {
    const mcpConfig = await ensureMcpConfig();

    // Assemble prompt from global docs + repo docs
    const prompt = loop.repoId ? await assembleRalphPrompt(loop.repoId) : loop.prompt;

    console.log(`[ralph] Prompt length: ${prompt.length} chars`);
    console.log(`[ralph] cwd: ${cwd}`);

    const allowedTools = RALPH_ALLOWED_TOOLS;

    let seq = 0;

    const result = await runClaude({
      prompt,
      cwd,
      timeoutSec: Number(process.env.RALPH_ITERATION_TIMEOUT_SEC) || 900,
      args: [
        "--mcp-config",
        mcpConfig,
        "--allowedTools",
        allowedTools,
        "--disallowedTools",
        RALPH_DISALLOWED_TOOLS,
      ],
      onEvent: (event) => {
        const currentSeq = seq++;
        // Fire-and-forget: don't block the stream on DB writes
        insertLoopEvent(loopId, iteration, currentSeq, event).catch((err) =>
          console.error(`[ralph] Failed to insert loop event:`, err),
        );

        if (event.type === "tool_call") {
          console.log(`[ralph] [iter ${iteration + 1}] Tool: ${event.name}`);
        } else if (event.type === "assistant") {
          console.log(`[ralph] [iter ${iteration + 1}] Response: ${event.text.slice(0, 200)}`);
        }
      },
      onLog: (line) => console.log(`[ralph] [iter ${iteration + 1}] ${line}`),
    });

    console.log(`[ralph] Exit code: ${result.exitCode}`);
    if (result.usage) {
      console.log(
        `[ralph] Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out` +
          (result.costUsd != null ? ` ($${result.costUsd.toFixed(4)})` : ""),
      );
    }

    // Update iteration count
    await updateLoop({ id: loopId, currentIteration: iteration + 1 });

    // If Claude errored, fail this iteration (pgboss may retry)
    if (result.error) {
      throw new Error(result.error);
    }

    // Check if there's remaining work before queueing next iteration
    const nextIteration = iteration + 1;
    const remainingTasks = await listTasks({ repoId: loop.repoId, status: "todo" });
    const inProgressTasks = await listTasks({ repoId: loop.repoId, status: "in_progress" });
    const hasWork = remainingTasks.length > 0 || inProgressTasks.length > 0;

    if (!hasWork) {
      await updateLoop({ id: loopId, status: "complete" });
      console.log(`[ralph] Loop ${loopId} complete — no remaining tasks`);
    } else if (nextIteration < loop.maxIterations) {
      await ralphIterationQueue.send({ loopId, iteration: nextIteration });
    } else {
      await updateLoop({ id: loopId, status: "complete" });
      console.log(`[ralph] Loop ${loopId} complete — max iterations reached`);
    }
  } catch (error) {
    console.error(`[ralph] Iteration ${iteration + 1} error:`, error);
    throw error;
  }
});
