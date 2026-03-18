import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { repos, type Repo } from "@openralph/db/models/index";
import {
  gitClone,
  gitFetchAll,
  gitWorktreeAdd,
  gitWorktreeRemove,
} from "./git-cli.service";

const BASE_DIR = process.env.NIGHTSHIFT_WORKSPACE_DIR ?? "/data/nightshift";
const REPOS_DIR = join(BASE_DIR, "repos");
const WORKTREES_DIR = join(BASE_DIR, "worktrees");

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Returns the local clone path for a repo. Clones if not already present. */
export function ensureClone(opts: {
  owner: string;
  name: string;
  cloneUrl: string;
}): string {
  ensureDir(REPOS_DIR);
  const repoDir = join(REPOS_DIR, opts.owner, opts.name);

  if (existsSync(join(repoDir, ".git"))) {
    gitFetchAll(repoDir);
    return repoDir;
  }

  ensureDir(join(REPOS_DIR, opts.owner));
  gitClone(opts.cloneUrl, repoDir);
  return repoDir;
}

/** Ensure a repo has a local clone. Updates repo.localPath + repo.workspaceStatus. */
export async function ensureRepoWorkspace(repo: Repo): Promise<string> {
  if (repo.localPath && existsSync(join(repo.localPath, ".git"))) {
    gitFetchAll(repo.localPath);
    return repo.localPath;
  }

  if (!repo.cloneUrl) {
    throw new Error(`Repo ${repo.owner}/${repo.name} has no clone URL`);
  }

  await db.update(repos).set({ workspaceStatus: "cloning" }).where(eq(repos.id, repo.id));

  try {
    const localPath = ensureClone({
      owner: repo.owner,
      name: repo.name,
      cloneUrl: repo.cloneUrl,
    });

    await db
      .update(repos)
      .set({ localPath, workspaceStatus: "ready" })
      .where(eq(repos.id, repo.id));

    return localPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(repos)
      .set({ workspaceStatus: "failed", workspaceError: message })
      .where(eq(repos.id, repo.id));
    throw error;
  }
}

/** Creates a git worktree on the given branch. Returns the worktree path. */
export function createWorktree(opts: {
  repoDir: string;
  id: string;
  branch: string;
}): string {
  ensureDir(WORKTREES_DIR);
  const worktreePath = join(WORKTREES_DIR, opts.id);

  if (existsSync(worktreePath)) {
    return worktreePath;
  }

  gitFetchAll(opts.repoDir);

  try {
    gitWorktreeAdd({
      repoDir: opts.repoDir,
      worktreePath,
      branch: opts.branch,
      createBranch: true,
    });
  } catch {
    // Branch already exists — reuse it
    gitWorktreeAdd({
      repoDir: opts.repoDir,
      worktreePath,
      branch: opts.branch,
    });
  }

  return worktreePath;
}

/** Remove a worktree. Best-effort cleanup. */
export function removeWorktree(opts: { repoDir: string; worktreePath: string }) {
  gitWorktreeRemove(opts);
}

/** Clean up a session's worktree given repo owner/name and worktree path. */
export function cleanupWorktree(opts: {
  owner: string;
  name: string;
  worktreePath: string;
}) {
  const repoDir = join(REPOS_DIR, opts.owner, opts.name);
  removeWorktree({ repoDir, worktreePath: opts.worktreePath });
  gitFetchAll(repoDir);
}
