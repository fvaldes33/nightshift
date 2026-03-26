import { z } from "zod";
import { createQueue } from "../lib/queue-builder";
import { claudeImportSessionQueue } from "./claude-import-session.job";

// ---------------------------------------------------------------------------
// Queue: claude-import/bulk — fan-out to individual session imports
// ---------------------------------------------------------------------------

export const claudeImportBulkQueue = createQueue({
  name: "claude-import/bulk",
  input: z.object({
    repoId: z.uuid(),
    sessionFileInfos: z.array(
      z.object({
        sessionId: z.string(),
        filePath: z.string(),
      }),
    ),
  }),
  queueOptions: {
    retryLimit: 0,
  },
});

claudeImportBulkQueue.work(async (job) => {
  const { repoId, sessionFileInfos } = job.data;
  console.log(`[claude-import/bulk] Fanning out ${sessionFileInfos.length} session imports`);

  for (const info of sessionFileInfos) {
    await claudeImportSessionQueue.send({
      repoId,
      sessionId: info.sessionId,
      filePath: info.filePath,
    });
  }

  console.log(`[claude-import/bulk] All ${sessionFileInfos.length} jobs queued`);
});
