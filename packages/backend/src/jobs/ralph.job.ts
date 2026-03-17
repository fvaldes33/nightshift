import { spawn } from "node:child_process";
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createQueue } from "../lib/queue-builder";
import { getLoop, updateLoop } from "../services/loop.service";
import { createMessage } from "../services/message.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a temporary MCP config file pointing to our ralph-server */
async function writeMcpConfig(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ralph-mcp-"));
  const configPath = join(dir, "mcp.json");
  const config = {
    mcpServers: {
      openralph: {
        type: "stdio",
        command: "bun",
        args: ["run", join(import.meta.dirname, "../mcp/run.ts")],
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? "",
        },
      },
    },
  };
  await writeFile(configPath, JSON.stringify(config));
  return configPath;
}

/** Spawn `claude -p` and return its stdout */
function runClaude(opts: {
  prompt: string;
  mcpConfig: string;
  cwd: string;
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      opts.prompt,
      "--mcp-config",
      opts.mcpConfig,
      "--allowedTools",
      [
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
      ].join(","),
      "--output-format",
      "json",
    ];

    const child = spawn("claude", args, {
      cwd: opts.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", reject);
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
  let mcpConfig: string | undefined;

  try {
    mcpConfig = await writeMcpConfig();

    const { stdout, stderr, exitCode } = await runClaude({
      prompt: loop.prompt,
      mcpConfig,
      cwd,
    });

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
  } finally {
    if (mcpConfig) {
      await unlink(mcpConfig).catch(() => {});
    }
  }
});
