import { z } from "zod";
import { createQueue } from "../lib/queue-builder";

export const ralphLoopQueue = createQueue({
  name: "ralph/loop",
  input: z.object({
    loopId: z.string().uuid(),
  }),
  queueOptions: {
    retryLimit: 0,
  },
});

// Worker registration — handler will be fleshed out when we wire up the executor
ralphLoopQueue.work(async (job) => {
  const { loopId } = job.data;
  console.log(`[ralph] Starting loop ${loopId}`);
  // TODO: fetch loop config, run claude CLI iterations, update status
});
