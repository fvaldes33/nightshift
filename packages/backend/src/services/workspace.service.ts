import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
    // Already cloned — fetch latest
    execSync("git fetch --all --prune", { cwd: repoDir, stdio: "pipe" });
    return repoDir;
  }

  ensureDir(join(REPOS_DIR, opts.owner));
  execSync(`git clone ${opts.cloneUrl} ${repoDir}`, { stdio: "pipe" });
  return repoDir;
}

/** Creates a git worktree on the given branch. Returns the worktree path. */
export function createWorktree(opts: {
  repoDir: string;
  sessionId: string;
  branch: string;
}): string {
  ensureDir(WORKTREES_DIR);
  const worktreePath = join(WORKTREES_DIR, opts.sessionId);

  if (existsSync(worktreePath)) {
    return worktreePath;
  }

  try {
    execSync(`git worktree add -b ${opts.branch} ${worktreePath}`, {
      cwd: opts.repoDir,
      stdio: "pipe",
    });
  } catch {
    // Branch already exists — reuse it
    execSync(`git worktree add ${worktreePath} ${opts.branch}`, {
      cwd: opts.repoDir,
      stdio: "pipe",
    });
  }

  return worktreePath;
}

/** Remove a worktree. Best-effort cleanup. */
export function removeWorktree(opts: { repoDir: string; worktreePath: string }) {
  try {
    execSync(`git worktree remove ${opts.worktreePath} --force`, {
      cwd: opts.repoDir,
      stdio: "pipe",
    });
  } catch {
    // best-effort
  }
}

/** Clean up a session's worktree given repo owner/name and worktree path. */
export function cleanupWorktree(opts: {
  owner: string;
  name: string;
  worktreePath: string;
}) {
  const repoDir = join(REPOS_DIR, opts.owner, opts.name);
  removeWorktree({ repoDir, worktreePath: opts.worktreePath });
}
