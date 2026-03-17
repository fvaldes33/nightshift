import { z } from "zod";
import { createQueue } from "../lib/queue-builder";
import { getSession, updateSession } from "../services/session.service";
import { createWorktree, ensureClone } from "../services/workspace.service";

export const workspaceSetupQueue = createQueue({
  name: "workspace/setup",
  input: z.object({
    sessionId: z.uuid(),
  }),
  queueOptions: {
    retryLimit: 1,
  },
});

workspaceSetupQueue.work(async (job) => {
  const { sessionId } = job.data;
  console.log(`[workspace] Setting up workspace for session ${sessionId}`);

  const session = await getSession({ id: sessionId });

  if (!session.repoId || !session.repo) {
    await updateSession({
      id: sessionId,
      workspaceStatus: "failed",
      workspaceError: "No repo linked to session",
    });
    return;
  }

  await updateSession({ id: sessionId, workspaceStatus: "cloning" });

  try {
    const repo = session.repo;
    if (!repo.cloneUrl) {
      throw new Error(`Repo ${repo.owner}/${repo.name} has no clone URL`);
    }

    // Clone or fetch the repo
    const repoDir = ensureClone({
      owner: repo.owner,
      name: repo.name,
      cloneUrl: repo.cloneUrl,
    });

    // Create worktree if branch is specified
    let worktreePath = repoDir;
    if (session.branch) {
      worktreePath = createWorktree({
        repoDir,
        sessionId,
        branch: session.branch,
      });
    }

    await updateSession({
      id: sessionId,
      worktreePath,
      workspaceStatus: "ready",
    });

    console.log(`[workspace] Session ${sessionId} ready at ${worktreePath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[workspace] Setup failed for session ${sessionId}:`, message);
    await updateSession({
      id: sessionId,
      workspaceStatus: "failed",
      workspaceError: message,
    });
  }
});
