import { tool } from "ai";
import { z } from "zod";

/** Type-only tool definition — actual implementation is the MCP tool in ralph-server.ts.
 *  This provides type safety for addToolOutput in the frontend. */
export const confirm_loop_details = tool({
  description:
    "Present loop config for user confirmation. The user reviews and confirms in the nightshift UI.",
  inputSchema: z.object({
    name: z.string().describe("Loop name"),
    maxIterations: z.number().int().default(10).describe("Max iterations"),
    filterConfig: z
      .object({
        labels: z.array(z.string()).optional(),
        assignee: z.string().optional(),
      })
      .optional()
      .describe("Task filter config"),
  }),
  outputSchema: z.object({
    action: z.enum(["pending", "confirmed", "rejected"]),
    name: z.string(),
    maxIterations: z.number().int(),
    filterConfig: z
      .object({
        labels: z.array(z.string()).optional(),
        assignee: z.string().optional(),
      })
      .optional(),
    loop: z
      .object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
      })
      .optional(),
  }),
});
