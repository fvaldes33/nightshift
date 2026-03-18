import { tool } from "ai";
import { z } from "zod";
import { execSync } from "node:child_process";
import { AgentContext } from "../lib/context";
import {
  addPRLabels,
  addPRReviewers,
  createPullRequest,
  listPullRequests,
} from "../services/github.service";

function getRepoInfo() {
  const ctx = AgentContext.use();
  if (!ctx.repoOwner || !ctx.repoName) {
    throw new Error("No repository associated with this session");
  }
  return { owner: ctx.repoOwner, repo: ctx.repoName };
}

function getWorktreePath() {
  const ctx = AgentContext.use();
  if (!ctx.worktreePath) {
    throw new Error("No worktree path available for this session");
  }
  return ctx.worktreePath;
}

// ---------------------------------------------------------------------------
// Local git operations (no API equivalent)
// ---------------------------------------------------------------------------

export const clone_repo = tool({
  description:
    "Clone a GitHub repository to a local directory for exploration. Uses `gh repo clone` which handles authentication for private repos.",
  inputSchema: z.object({
    destination: z.string().describe("Local directory path to clone into"),
  }),
  execute: async ({ destination }) => {
    const { owner, repo } = getRepoInfo();
    execSync(`gh repo clone ${owner}/${repo} ${destination}`, {
      stdio: "pipe",
    });
    return { path: destination, repo: `${owner}/${repo}` };
  },
});

export const create_worktree = tool({
  description:
    "Create a git worktree on a new branch. Used to isolate work from the main branch.",
  inputSchema: z.object({
    branch: z.string().describe("Branch name to create"),
    worktreePath: z.string().describe("Path for the new worktree directory"),
  }),
  execute: async ({ branch, worktreePath }) => {
    const repoDir = getWorktreePath();
    execSync(`git worktree add -b ${branch} ${worktreePath}`, {
      cwd: repoDir,
      stdio: "pipe",
    });
    return { worktreePath, branch };
  },
});

export const delete_worktree = tool({
  description: "Remove a git worktree. Used for cleanup after work finishes or on failure.",
  inputSchema: z.object({
    worktreePath: z.string().describe("Path of the worktree to remove"),
  }),
  execute: async ({ worktreePath }) => {
    const repoDir = getWorktreePath();
    execSync(`git worktree remove ${worktreePath} --force`, {
      cwd: repoDir,
      stdio: "pipe",
    });
    return { removed: worktreePath };
  },
});

export const push_branch = tool({
  description: "Push the current branch to the remote. Needed before creating a PR.",
  inputSchema: z.object({}),
  execute: async () => {
    const repoDir = getWorktreePath();
    execSync("git push -u origin HEAD", {
      cwd: repoDir,
      stdio: "pipe",
    });
    const branch = execSync("git branch --show-current", {
      cwd: repoDir,
      stdio: "pipe",
      encoding: "utf-8",
    }).trim();
    return { branch, pushed: true };
  },
});

// ---------------------------------------------------------------------------
// GitHub API operations — thin wrappers that read AgentContext and delegate
// ---------------------------------------------------------------------------

export const create_pull_request = tool({
  description:
    "Create a GitHub pull request. Used after completing work to submit changes for review.",
  inputSchema: z.object({
    title: z.string().describe("PR title"),
    body: z.string().describe("PR description in markdown"),
    base: z.string().default("main").describe("Branch to merge into"),
    draft: z.boolean().default(false).describe("Create as draft PR"),
  }),
  execute: async ({ title, body, base, draft }) => {
    const ctx = AgentContext.use();
    const { owner, repo } = getRepoInfo();
    const head = ctx.branch;
    if (!head) throw new Error("No branch set for this session");

    return createPullRequest({
      token: ctx.githubToken,
      owner,
      repo,
      head,
      base,
      title,
      body,
      draft,
    });
  },
});

export const list_pull_requests = tool({
  description: "List pull requests for this repository, optionally filtered by state.",
  inputSchema: z.object({
    state: z.enum(["open", "closed", "all"]).default("open").describe("PR state filter"),
    head: z.string().optional().describe("Filter by head branch (format: owner:branch)"),
  }),
  execute: async ({ state, head }) => {
    const ctx = AgentContext.use();
    const { owner, repo } = getRepoInfo();

    return listPullRequests({
      token: ctx.githubToken,
      owner,
      repo,
      state,
      head,
    });
  },
});

export const add_pr_reviewers = tool({
  description: "Request reviewers on a pull request.",
  inputSchema: z.object({
    pullNumber: z.number().int().describe("PR number"),
    reviewers: z.array(z.string()).describe("GitHub usernames to request review from"),
  }),
  execute: async ({ pullNumber, reviewers }) => {
    const ctx = AgentContext.use();
    const { owner, repo } = getRepoInfo();

    return addPRReviewers({
      token: ctx.githubToken,
      owner,
      repo,
      pullNumber,
      reviewers,
    });
  },
});

export const add_pr_labels = tool({
  description: "Add labels to a pull request or issue.",
  inputSchema: z.object({
    issueNumber: z.number().int().describe("Issue or PR number"),
    labels: z.array(z.string()).describe("Labels to add"),
  }),
  execute: async ({ issueNumber, labels }) => {
    const ctx = AgentContext.use();
    const { owner, repo } = getRepoInfo();

    return addPRLabels({
      token: ctx.githubToken,
      owner,
      repo,
      issueNumber,
      labels,
    });
  },
});
