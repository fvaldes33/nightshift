import { tool } from "ai";
import { z } from "zod";
import { AgentContext } from "../lib/context";

export const run_exploration = tool({
  description:
    "Spawn a Claude Code process to explore the repository and return findings. Used during planning to understand the codebase before creating tasks.",
  inputSchema: z.object({
    prompt: z.string().describe("What to explore or investigate in the repo"),
  }),
  execute: async ({ prompt }) => {
    const ctx = AgentContext.use();
    const cwd = ctx.worktreePath;
    if (!cwd) throw new Error("No worktree path available for this session");

    console.log(`[exploration] Starting exploration in ${cwd}`);
    console.log(`[exploration] Prompt: ${prompt.slice(0, 200)}${prompt.length > 200 ? "..." : ""}`);

    const { spawn } = await import("node:child_process");
    const start = Date.now();

    return new Promise<{ result: string }>((resolve, reject) => {
      const child = spawn(
        "claude",
        ["-p", prompt, "--dangerously-skip-permissions", "--output-format", "text"],
        { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } },
      );
      child.stdout.setEncoding("utf-8");
      child.stderr.setEncoding("utf-8");

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d: string) => (stdout += d));
      child.stderr.on("data", (d: string) => {
        stderr += d;
        const line = d.trim();
        if (line) console.log(`[exploration] ${line}`);
      });
      child.on("error", (err) => {
        console.error(`[exploration] Spawn error:`, err);
        reject(err);
      });
      child.on("close", (code) => {
        const elapsed = Date.now() - start;
        if (code !== 0) {
          console.error(`[exploration] Failed (exit ${code}) after ${elapsed}ms: ${stderr}`);
          reject(new Error(`Exploration failed (exit ${code}): ${stderr}`));
          return;
        }
        console.log(`[exploration] Completed in ${elapsed}ms (${stdout.length} bytes)`);
        resolve({ result: stdout });
      });
    });
  },
});
