import { z } from "zod";
import { ralphLoopQueue } from "../jobs/ralph.job";
import { protectedProcedure, router } from "../lib/trpc";
import {
  createLoop,
  deleteLoop,
  getLoop,
  listLoopEvents,
  listLoops,
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

  /** Create a loop and immediately queue it for processing. */
  start: protectedProcedure
    .input(
      z.object({
        sessionId: z.uuid(),
        repoId: z.uuid(),
        name: z.string(),
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
