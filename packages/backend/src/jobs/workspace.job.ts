import { z } from "zod";
import { createQueue } from "../lib/queue-builder";
import { getRepo, updateRepo } from "../services/repo.service";
import { ensureRepoWorkspace } from "../services/workspace.service";

export const workspaceSetupQueue = createQueue({
  name: "workspace/setup",
  input: z.object({
    repoId: z.uuid(),
  }),
  queueOptions: {
    retryLimit: 1,
  },
});

workspaceSetupQueue.work(async (job) => {
  const { repoId } = job.data;
  console.log(`[workspace] Setting up workspace for repo ${repoId}`);

  const repo = await getRepo({ id: repoId });

  try {
    const localPath = await ensureRepoWorkspace(repo);
    console.log(`[workspace] Repo ${repoId} ready at ${localPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[workspace] Setup failed for repo ${repoId}:`, message);
    await updateRepo({
      id: repoId,
      workspaceStatus: "failed",
      workspaceError: message,
    });
  }
});
