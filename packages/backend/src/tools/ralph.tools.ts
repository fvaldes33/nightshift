import { tool } from "ai";
import { z } from "zod";
import { createLoop } from "../services/loop.service";
import { ralphLoopQueue } from "../jobs/ralph.job";
import { AgentContext } from "../lib/context";

export const start_loop = tool({
  description:
    "Kick off Ralph's execution loop. Creates a loop record and queues it for processing. This is a client-confirmed action — the UI should present an approval before executing.",
  inputSchema: z.object({
    name: z.string().describe("Loop name for identification"),
    prompt: z.string().describe("System prompt for each iteration"),
    maxIterations: z.number().int().default(10).describe("Maximum iterations before stopping"),
    filterConfig: z
      .object({
        labels: z.array(z.string()).optional(),
        assignee: z.string().optional(),
      })
      .optional()
      .describe("Filter which tasks Ralph should work on"),
  }),
  execute: async (input) => {
    const ctx = AgentContext.use();
    const loop = await createLoop({
      ...input,
      sessionId: ctx.sessionId,
      repoId: ctx.repoId!,
      branch: ctx.branch ?? undefined,
      worktree: ctx.worktreePath ?? undefined,
    });
    await ralphLoopQueue.send({ loopId: loop.id });
    return { loopId: loop.id, status: loop.status };
  },
});
