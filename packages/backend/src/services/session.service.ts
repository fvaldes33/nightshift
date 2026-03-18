import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { insertSessionSchema, sessions, updateSessionSchema } from "@openralph/db/models/index";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";
import { cleanupWorktree, createWorktree, ensureClone } from "./workspace.service";

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
  return session;
});

export const createSession = fn(
  insertSessionSchema.pick({
    repoId: true,
    title: true,
    mode: true,
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

/** Resolve the working directory for a session.
 *  - If branch matches default (or no branch), return repo.localPath.
 *  - If different branch, create a worktree for that branch.
 */
export async function ensureWorktree(session: Awaited<ReturnType<typeof getSession>>): Promise<string | null> {
  if (!session.repo) return null;

  // Use localPath if available (linked local repo), otherwise clone
  let repoDir = session.repo.localPath;
  if (!repoDir) {
    if (!session.repo.cloneUrl) return null;
    repoDir = ensureClone({
      owner: session.repo.owner,
      name: session.repo.name,
      cloneUrl: session.repo.cloneUrl,
    });
  }

  // If no branch or branch matches default, use the repo dir directly
  if (!session.branch || session.branch === session.repo.defaultBranch) {
    return repoDir;
  }

  // Different branch — create a worktree
  return createWorktree({
    repoDir,
    sessionId: session.id,
    branch: session.branch,
  });
}

export const deleteSession = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: { repo: true },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND");

  // Only clean up branch-specific worktrees, not the repo clone
  if (session.branch && session.repo && session.branch !== session.repo.defaultBranch) {
    try {
      cleanupWorktree({
        owner: session.repo.owner,
        name: session.repo.name,
        worktreePath: `${process.env.NIGHTSHIFT_WORKSPACE_DIR ?? "/data/nightshift"}/worktrees/${session.id}`,
      });
    } catch {
      // Best-effort cleanup
    }
  }

  const [deleted] = await db.delete(sessions).where(eq(sessions.id, id)).returning();
  if (!deleted) throw new AppError("Failed to delete session", "INTERNAL_ERROR");
  return deleted;
});
