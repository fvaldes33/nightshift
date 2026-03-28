import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { repos, type Repo } from "@openralph/db/models/index";
import {
  gitCheckout,
  gitClone,
  gitCommitAndPush,
  gitFetchAll,
  gitIsDirty,
  gitWorktreeAdd,
  gitWorktreeRemove,
  isGitRepo,
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

// ---------------------------------------------------------------------------
// Worktree handoff
// ---------------------------------------------------------------------------

/** Check if a worktree path exists and is a valid git working directory. */
export function isWorktreeHealthy(worktreePath: string): boolean {
  return existsSync(worktreePath) && isGitRepo(worktreePath);
}

/**
 * Handoff a worktree session back to the main repo checkout.
 * 1. Commits and pushes any uncommitted worktree changes
 * 2. Removes the worktree (freeing the branch lock)
 * 3. Checks out the branch in the main repo
 *
 * Throws if the main repo has a dirty working tree.
 * Tolerates already-removed worktrees.
 */
export function handoffWorktree(
  repoDir: string,
  worktreePath: string,
  branch: string,
): void {
  if (gitIsDirty(repoDir)) {
    throw new Error(
      `Cannot handoff: main repo has uncommitted changes at ${repoDir}`,
    );
  }

  // Ensure all worktree changes are committed and pushed before removal
  if (existsSync(worktreePath) && isGitRepo(worktreePath)) {
    gitCommitAndPush(worktreePath, "chore: auto-commit before worktree handoff");
  }

  try {
    gitWorktreeRemove({ repoDir, worktreePath });
  } catch {
    // Worktree already removed — nothing to clean up
  }

  gitCheckout(repoDir, branch);
}

/**
 * Encode a cwd path the same way Claude Code encodes project directory names.
 * Only replaces `/` with `-`.
 */
function encodeClaudeProjectPath(cwd: string): string {
  return cwd.replaceAll("/", "-");
}

/**
 * Migrate a Claude Code session from one project directory to another.
 * Scans ~/.claude/projects/ to find the source directory, then copies
 * the session JSONL file (and matching directory if present) to the target.
 *
 * Returns true on success, false if source not found.
 */
export function migrateClaudeSession(
  fromCwd: string,
  toCwd: string,
  claudeSessionId: string,
): boolean {
  const claudeProjectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(claudeProjectsDir)) return false;

  const entries = readdirSync(claudeProjectsDir, { withFileTypes: true });
  const encodedFrom = encodeClaudeProjectPath(fromCwd);
  const encodedTo = encodeClaudeProjectPath(toCwd);

  // Find source directory by matching the encoded path
  const sourceEntry = entries.find(
    (e) => e.isDirectory() && e.name === encodedFrom,
  );
  if (!sourceEntry) return false;

  const sourceDir = join(claudeProjectsDir, sourceEntry.name);
  const jsonlFile = `${claudeSessionId}.jsonl`;
  const jsonlPath = join(sourceDir, jsonlFile);

  if (!existsSync(jsonlPath)) return false;

  // Find or create target directory
  const targetDir = join(claudeProjectsDir, encodedTo);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Copy the JSONL file
  cpSync(jsonlPath, join(targetDir, jsonlFile));

  // Copy matching directory if present (Claude stores additional session data)
  const sessionDirPath = join(sourceDir, claudeSessionId);
  if (existsSync(sessionDirPath)) {
    cpSync(sessionDirPath, join(targetDir, claudeSessionId), {
      recursive: true,
    });
  }

  return true;
}
