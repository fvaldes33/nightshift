import { existsSync } from "node:fs";
import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { insertSessionSchema, sessions, updateSessionSchema } from "@openralph/db/models/index";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";
import { getGitHubToken } from "./account.service";
import { gitCheckout, gitCurrentBranch } from "./git-cli.service";
import { getPullRequest } from "./github.service";
import {
  cleanupWorktree,
  createWorktree,
  ensureClone,
  handoffWorktree,
  migrateClaudeSession,
} from "./workspace.service";

export const listSessions = fn(z.object({ repoId: z.uuid().optional() }), async ({ repoId }) => {
  return db.query.sessions.findMany({
    where: repoId ? eq(sessions.repoId, repoId) : undefined,
    orderBy: (s, { desc }) => [desc(s.updatedAt)],
    with: { repo: true },
  });
});

export const getSession = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: { repo: true, messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] } },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND");

  // Fire-and-forget: sync PR status from GitHub if there's an open PR
  // Realtime will push the update to the frontend if status changed
  if (session.prNumber && session.prStatus === "open" && session.repo) {
    syncPRStatusInBackground(session.id, session.repo, session.prNumber, session.prStatus).catch(() => {});
  }

  return session;
});

async function syncPRStatusInBackground(
  sessionId: string,
  repo: { owner: string; name: string },
  prNumber: number,
  currentStatus: string | null,
) {
  const token = await getGitHubToken({});
  const pr = await getPullRequest({
    token,
    owner: repo.owner,
    repo: repo.name,
    pullNumber: prNumber,
  });

  const prStatus: "open" | "merged" | "closed" = pr.merged
    ? "merged"
    : pr.state === "closed"
      ? "closed"
      : "open";

  if (prStatus !== currentStatus) {
    await db.update(sessions).set({ prStatus }).where(eq(sessions.id, sessionId));
  }
}

export const createSession = fn(
  insertSessionSchema.pick({
    repoId: true,
    title: true,
    mode: true,
    workspaceMode: true,
    branch: true,
    provider: true,
    model: true,
  }),
  async (input) => {
    const [session] = await db.insert(sessions).values(input).returning();
    if (!session) throw new AppError("Failed to create session", "INTERNAL_ERROR");
    return session;
  },
);

export const updateSession = fn(
  updateSessionSchema.required({ id: true }),
  async ({ id, ...fields }) => {
    const [session] = await db.update(sessions).set(fields).where(eq(sessions.id, id)).returning();
    if (!session) throw new AppError("Session not found", "NOT_FOUND");
    return session;
  },
);

// ---------------------------------------------------------------------------
// Resolve working directory for a session
// ---------------------------------------------------------------------------

type SessionWithRepo = Awaited<ReturnType<typeof getSession>>;

/** Resolve the repo's base directory (localPath or clone). */
function resolveRepoDir(session: SessionWithRepo): string | null {
  if (!session.repo) return null;

  if (session.repo.localPath) return session.repo.localPath;

  if (!session.repo.cloneUrl) return null;
  return ensureClone({
    owner: session.repo.owner,
    name: session.repo.name,
    cloneUrl: session.repo.cloneUrl,
  });
}

/** Resolve the working directory and current branch for a session.
 *  - Local mode: use repo dir directly, detect current branch.
 *  - Worktree mode: create worktree lazily on first call.
 */
export async function resolveSessionCwd(
  session: SessionWithRepo,
  { forceCheckout = false } = {},
): Promise<{ cwd: string; branch: string } | null> {
  const repoDir = resolveRepoDir(session);
  if (!repoDir) return null;

  if (session.workspaceMode === "local") {
    if (session.branch && forceCheckout) {
      const current = gitCurrentBranch(repoDir);
      if (current !== session.branch) {
        gitCheckout(repoDir, session.branch);
      }
      return { cwd: repoDir, branch: session.branch };
    }
    const branch = gitCurrentBranch(repoDir);
    return { cwd: repoDir, branch };
  }

  if (session.worktreePath) {
    if (existsSync(session.worktreePath)) {
      return { cwd: session.worktreePath, branch: session.branch ?? "main" };
    }

    // Worktree path is stale — clear it and fall through to lazy recreation
    console.warn(
      `[resolveSessionCwd] Worktree path missing for session ${session.id}: ${session.worktreePath}`,
    );
    await db
      .update(sessions)
      .set({ worktreePath: null })
      .where(eq(sessions.id, session.id));
  }

  if (!session.branch) {
    throw new AppError("Worktree session requires a branch", "BAD_REQUEST");
  }

  // If the branch is already checked out at the main repo, use it directly
  const currentBranch = gitCurrentBranch(repoDir);
  if (currentBranch === session.branch) {
    return { cwd: repoDir, branch: session.branch };
  }

  const worktreePath = createWorktree({
    repoDir,
    id: session.id,
    branch: session.branch,
  });

  await db
    .update(sessions)
    .set({ worktreePath })
    .where(eq(sessions.id, session.id));

  return { cwd: worktreePath, branch: session.branch };
}

// ---------------------------------------------------------------------------
// Handoff: transition a worktree session back to the main repo checkout
// ---------------------------------------------------------------------------

export async function handoffSession(sessionId: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: { repo: true },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND");

  if (session.workspaceMode !== "worktree") {
    throw new AppError("Session is not in worktree mode", "BAD_REQUEST");
  }
  if (!session.worktreePath) {
    throw new AppError("Session has no worktree path", "BAD_REQUEST");
  }

  const repoDir = resolveRepoDir(session as SessionWithRepo);
  if (!repoDir) {
    throw new AppError("Cannot resolve repo directory", "INTERNAL_ERROR");
  }

  const branch = session.branch ?? "main";

  // Checkout branch in main repo and remove worktree
  handoffWorktree(repoDir, session.worktreePath, branch);

  // Migrate Claude session data to the new cwd
  let keepClaudeSession = true;
  if (session.claudeSessionId) {
    keepClaudeSession = migrateClaudeSession(
      session.worktreePath,
      repoDir,
      session.claudeSessionId,
    );
  }

  // Update session DB state
  const [updated] = await db
    .update(sessions)
    .set({
      worktreePath: null,
      workspaceMode: "local",
      ...(keepClaudeSession ? {} : { claudeSessionId: null }),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (!updated) throw new AppError("Failed to update session", "INTERNAL_ERROR");
  return updated;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export const deleteSession = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: { repo: true },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND");

  if (session.worktreePath && session.repo) {
    try {
      cleanupWorktree({
        owner: session.repo.owner,
        name: session.repo.name,
        worktreePath: session.worktreePath,
      });
    } catch {
      // Best-effort cleanup
    }
  }

  const [deleted] = await db.delete(sessions).where(eq(sessions.id, id)).returning();
  if (!deleted) throw new AppError("Failed to delete session", "INTERNAL_ERROR");
  return deleted;
});
