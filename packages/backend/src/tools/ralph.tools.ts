import { tool } from "ai";
import { z } from "zod";

/** Client-side tool — no execute. The UI renders a confirmation card and calls
 *  the tRPC loop.start mutation. Result is fed back via addToolOutput. */
export const start_loop = tool({
  description:
    "Kick off Ralph's execution loop. Creates a loop record and queues it for processing. The user will review the loop configuration and confirm before it starts.",
  inputSchema: z.object({
    name: z.string().describe("Loop name for identification"),
    maxIterations: z.number().int().default(10).describe("Maximum iterations before stopping"),
    filterConfig: z
      .object({
        labels: z.array(z.string()).optional(),
        assignee: z.string().optional(),
      })
      .optional()
      .describe("Filter which tasks Ralph should work on"),
  }),
  outputSchema: z.object({
    action: z.enum(["started", "skipped"]),
    loop: z
      .object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
      })
      .optional(),
  }),
});
