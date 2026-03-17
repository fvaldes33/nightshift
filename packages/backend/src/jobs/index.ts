import { ralphLoopQueue, ralphIterationQueue } from "./ralph.job";
import { workspaceSetupQueue } from "./workspace.job";

/** Initialize all queues (create in DB if needed). Called after boss.start(). */
export async function bootstrapQueues() {
  await ralphLoopQueue.init();
  await ralphIterationQueue.init();
  await workspaceSetupQueue.init();
  console.log("Job queues started");
}
