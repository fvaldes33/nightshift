import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { runClaude } from "../lib/claude-runner";
import { createQueue } from "../lib/queue-builder";
import { getLoop, insertLoopEvent, updateLoop } from "../services/loop.service";
import { createMessage } from "../services/message.service";
import { assembleRalphPrompt } from "../services/prompt.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_DIR =
  process.env.NIGHTSHIFT_WORKSPACE_DIR ?? join(process.env.HOME ?? "", ".nightshift");
const MCP_CONFIG_PATH = join(BASE_DIR, "mcp-config.json");

/** Write the MCP config once to a persistent location. Reuses if already present. */
async function ensureMcpConfig(): Promise<string> {
  if (existsSync(MCP_CONFIG_PATH)) return MCP_CONFIG_PATH;

  const mcpRunPath = join(import.meta.dirname, "../mcp/run.ts");
  console.log(`[ralph] MCP run.ts path: ${mcpRunPath}`);

  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true });
  }

  const config = {
    mcpServers: {
      openralph: {
        type: "stdio",
        command: "bun",
        args: ["run", mcpRunPath],
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? "",
        },
      },
    },
  };
  await writeFile(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`[ralph] Wrote MCP config to ${MCP_CONFIG_PATH}`);
  return MCP_CONFIG_PATH;
}

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

  const cwd = loop.worktree ?? ".";

  try {
    const mcpConfig = await ensureMcpConfig();

    // Assemble prompt from global docs + repo docs
    const prompt = loop.repoId ? await assembleRalphPrompt(loop.repoId) : loop.prompt;

    console.log(`[ralph] Prompt length: ${prompt.length} chars`);
    console.log(`[ralph] cwd: ${cwd}`);

    const allowedTools = [
      "Read",
      "Edit",
      "Write",
      "Bash",
      "Glob",
      "Grep",
      "mcp__openralph__list_tasks",
      "mcp__openralph__get_task",
      "mcp__openralph__update_task",
      "mcp__openralph__add_task_comment",
      "mcp__openralph__create_message",
      "mcp__openralph__get_loop",
      "mcp__openralph__update_loop",
      "mcp__openralph__list_docs",
      "mcp__openralph__get_doc",
    ].join(",");

    let seq = 0;

    const result = await runClaude({
      prompt,
      cwd,
      timeoutSec: 900, // 15 min per iteration
      args: ["--mcp-config", mcpConfig, "--allowedTools", allowedTools, "--max-turns", "50"],
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

    // Write iteration result as a message to the session
    if (loop.sessionId) {
      await createMessage({
        sessionId: loop.sessionId,
        role: "assistant",
        name: "ralph",
        parts: [{ type: "text", text: result.summary || "(no output)" }],
      });
    }

    // If Claude errored, fail this iteration (pgboss may retry)
    if (result.error) {
      throw new Error(result.error);
    }

    // Queue next iteration or mark complete
    const nextIteration = iteration + 1;
    if (nextIteration < loop.maxIterations) {
      await ralphIterationQueue.send({ loopId, iteration: nextIteration });
    } else {
      await updateLoop({ id: loopId, status: "complete" });
      console.log(`[ralph] Loop ${loopId} complete`);
    }
  } catch (error) {
    console.error(`[ralph] Iteration ${iteration + 1} error:`, error);
    throw error;
  }
});
