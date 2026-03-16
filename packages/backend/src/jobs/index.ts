import { ralphLoopQueue } from "./ralph.job";

/** Initialize all queues (create in DB if needed). Called after boss.start(). */
export async function bootstrapQueues() {
  await ralphLoopQueue.init();
  console.log("Job queues started");
}
