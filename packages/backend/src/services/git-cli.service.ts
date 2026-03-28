import { execSync } from "node:child_process";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: "pipe", encoding: "utf-8" }).trim();
}

function runSilent(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: "pipe" });
}

// ---------------------------------------------------------------------------
// Clone & fetch
// ---------------------------------------------------------------------------

export function gitClone(cloneUrl: string, dest: string): void {
  execSync(`git clone ${cloneUrl} ${dest}`, { stdio: "pipe" });
}

export function ghClone(owner: string, repo: string, dest: string): void {
  execSync(`gh repo clone ${owner}/${repo} ${dest}`, { stdio: "pipe" });
}

export function gitFetchAll(cwd: string): void {
  try {
    runSilent("git fetch --all --prune", cwd);
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Worktree
// ---------------------------------------------------------------------------

export function gitWorktreeAdd(opts: {
  repoDir: string;
  worktreePath: string;
  branch: string;
  createBranch?: boolean;
}): void {
  if (opts.createBranch) {
    // git worktree add -b <new-branch> <path>
    runSilent(`git worktree add -b ${opts.branch} ${opts.worktreePath}`, opts.repoDir);
  } else {
    // git worktree add <path> <existing-branch>
    runSilent(`git worktree add ${opts.worktreePath} ${opts.branch}`, opts.repoDir);
  }
}

export function gitWorktreeRemove(opts: { repoDir: string; worktreePath: string }): void {
  try {
    runSilent(`git worktree remove ${opts.worktreePath} --force`, opts.repoDir);
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Push & branch
// ---------------------------------------------------------------------------

export function gitPush(cwd: string): void {
  runSilent("git push -u origin HEAD", cwd);
}

export function gitCurrentBranch(cwd: string): string {
  return run("git branch --show-current", cwd);
}

export function gitUnpushedCount(cwd: string): number {
  const count = run("git rev-list --count @{u}..HEAD", cwd);
  return parseInt(count, 10) || 0;
}

export function gitLogOneline(cwd: string, base: string, maxCount = 50): string {
  try {
    return run(`git log --oneline ${base}..HEAD --max-count=${maxCount}`, cwd);
  } catch {
    // If base doesn't exist (e.g. no remote), fall back to recent commits
    try {
      return run(`git log --oneline -${maxCount}`, cwd);
    } catch {
      return "";
    }
  }
}

export function gitDiffStat(cwd: string, base: string): string {
  try {
    return run(`git diff --stat ${base}..HEAD`, cwd);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Repo info (for linking existing local repos)
// ---------------------------------------------------------------------------

/** Get the origin remote URL. Returns null if no origin remote. */
export function gitRemoteUrl(cwd: string): string | null {
  try {
    return run("git remote get-url origin", cwd);
  } catch {
    return null;
  }
}

/** Get the default branch (HEAD ref from origin). Falls back to "main". */
export function gitDefaultBranch(cwd: string): string {
  try {
    // e.g. "refs/remotes/origin/main" → "main"
    const ref = run("git symbolic-ref refs/remotes/origin/HEAD", cwd);
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    return "main";
  }
}

/** Parse owner/name from a GitHub remote URL. Returns null if not parseable. */
export function parseGitHubRemote(url: string): { owner: string; name: string } | null {
  // Handles:
  //   https://github.com/owner/repo.git
  //   git@github.com:owner/repo.git
  //   https://github.com/owner/repo
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], name: match[2] };
}

/** Check if a directory is a git repo. */
export function isGitRepo(path: string): boolean {
  try {
    run("git rev-parse --git-dir", path);
    return true;
  } catch {
    return false;
  }
}

/** Check if the working tree has uncommitted changes. */
export function gitIsDirty(cwd: string): boolean {
  const status = run("git status --porcelain", cwd);
  return status.length > 0;
}

/** Checkout a branch. */
export function gitCheckout(cwd: string, branch: string): void {
  runSilent(`git checkout ${branch}`, cwd);
}
