import { claudeImportBulkQueue } from "./claude-import-bulk.job";
import { claudeImportSessionQueue } from "./claude-import-session.job";
import { ralphLoopQueue, ralphIterationQueue } from "./ralph.job";
import { workspaceSetupQueue } from "./workspace.job";

/** Initialize all queues (create in DB if needed). Called after boss.start(). */
export async function bootstrapQueues() {
  await ralphLoopQueue.init();
  await ralphIterationQueue.init();
  await workspaceSetupQueue.init();
  await claudeImportBulkQueue.init();
  await claudeImportSessionQueue.init();
  console.log("Job queues started");
}
