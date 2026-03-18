import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { createQueue } from "../lib/queue-builder";
import { getLoop, updateLoop } from "../services/loop.service";
import { createMessage } from "../services/message.service";
import { assembleRalphPrompt } from "../services/prompt.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_DIR = process.env.NIGHTSHIFT_WORKSPACE_DIR ?? join(process.env.HOME ?? "", ".nightshift");
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

/** Spawn `claude -p` with prompt piped via stdin */
function runClaude(opts: {
  prompt: string;
  mcpConfig: string;
  cwd: string;
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
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

    const args = [
      "-p",
      "-",
      "--mcp-config",
      opts.mcpConfig,
      "--allowedTools",
      allowedTools,
      "--output-format",
      "json",
    ];

    console.log(`[ralph] Spawning: claude ${args.join(" ")}`);

    const child = spawn("claude", args, {
      cwd: opts.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    // Pipe prompt via stdin
    child.stdin.write(opts.prompt);
    child.stdin.end();

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      console.error(`[ralph] Spawn error:`, err);
      reject(err);
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
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
    const prompt = loop.repoId
      ? await assembleRalphPrompt(loop.repoId)
      : loop.prompt;

    console.log(`[ralph] Prompt length: ${prompt.length} chars`);
    console.log(`[ralph] Prompt preview:\n${prompt.slice(0, 500)}`);
    console.log(`[ralph] cwd: ${cwd}`);
    console.log(`[ralph] MCP config: ${mcpConfig}`);

    const { stdout, stderr, exitCode } = await runClaude({
      prompt,
      mcpConfig,
      cwd,
    });

    console.log(`[ralph] Exit code: ${exitCode}`);
    console.log(`[ralph] stdout length: ${stdout.length}`);
    if (stdout.length < 2000) {
      console.log(`[ralph] stdout:\n${stdout}`);
    } else {
      console.log(`[ralph] stdout (first 1000):\n${stdout.slice(0, 1000)}`);
    }

    if (stderr) {
      console.error(`[ralph] stderr (iteration ${iteration + 1}):`, stderr);
    }

    // Update iteration count
    await updateLoop({ id: loopId, currentIteration: iteration + 1 });

    // Parse Claude's JSON output
    let resultText = stdout;
    try {
      const parsed = JSON.parse(stdout);
      resultText = parsed.result ?? stdout;
    } catch {
      // stdout wasn't valid JSON — use raw text
    }

    // Write iteration result as a message to the session
    if (loop.sessionId) {
      await createMessage({
        sessionId: loop.sessionId,
        role: "assistant",
        name: "ralph",
        parts: [{ type: "text", text: resultText }],
      });
    }

    // If Claude exited with non-zero, fail this iteration (pgboss may retry)
    if (exitCode !== 0) {
      throw new Error(`Claude exited with code ${exitCode}`);
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
