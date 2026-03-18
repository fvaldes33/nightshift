import { z } from "zod";
import { ralphLoopQueue } from "../jobs/ralph.job";
import { protectedProcedure, router } from "../lib/trpc";
import {
  createLoop,
  deleteLoop,
  generatePRSummary,
  getLoop,
  listLoopEvents,
  listLoops,
  openPR,
  syncPRStatus,
  updateLoop,
} from "../services/loop.service";

export const loopRouter = router({
  list: protectedProcedure.input(listLoops.schema).query(({ input }) => listLoops(input)),
  get: protectedProcedure.input(getLoop.schema).query(({ input }) => getLoop(input)),
  create: protectedProcedure.input(createLoop.schema).mutation(({ input }) => createLoop(input)),
  update: protectedProcedure.input(updateLoop.schema).mutation(({ input }) => updateLoop(input)),
  delete: protectedProcedure.input(deleteLoop.schema).mutation(({ input }) => deleteLoop(input)),

  events: protectedProcedure
    .input(listLoopEvents.schema)
    .query(({ input }) => listLoopEvents(input)),

  /** Generate a PR title + body from loop events using AI. */
  generatePRSummary: protectedProcedure
    .input(generatePRSummary.schema)
    .mutation(({ input }) => generatePRSummary(input)),

  /** Create a GitHub PR for this loop and persist the URL. */
  openPR: protectedProcedure.input(openPR.schema).mutation(({ input }) => openPR(input)),

  /** Refresh PR status (open/merged/closed) from GitHub. */
  syncPRStatus: protectedProcedure
    .input(syncPRStatus.schema)
    .mutation(({ input }) => syncPRStatus(input)),

  /** Create a loop and immediately queue it for processing. */
  start: protectedProcedure
    .input(
      z.object({
        sessionId: z.uuid(),
        repoId: z.uuid(),
        name: z.string(),
        branch: z.string().optional(),
        worktree: z.string().optional(),
        maxIterations: z.number().int().default(10),
        filterConfig: z
          .object({
            labels: z.array(z.string()).optional(),
            assignee: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const loop = await createLoop({ ...input, prompt: "" });
      await ralphLoopQueue.send({ loopId: loop.id });
      return loop;
    }),
});
