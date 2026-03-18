import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { insertRepoSchema, repos, updateRepoSchema } from "@openralph/db/models/index";
import { Octokit } from "octokit";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";
import { getGitHubToken } from "./account.service";
import {
  gitDefaultBranch,
  gitRemoteUrl,
  isGitRepo,
  parseGitHubRemote,
} from "./git-cli.service";

export const listRepos = fn(z.object({}), async () => {
  return db.query.repos.findMany({ orderBy: (r, { desc }) => [desc(r.createdAt)] });
});

export const getRepo = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
  if (!repo) throw new AppError("Repo not found", "NOT_FOUND");
  return repo;
});

export const createRepo = fn(
  insertRepoSchema.pick({ owner: true, name: true, defaultBranch: true, cloneUrl: true }),
  async (input) => {
    const [repo] = await db.insert(repos).values(input).returning();
    if (!repo) throw new AppError("Failed to create repo", "INTERNAL_ERROR");
    return repo;
  },
);

export const updateRepo = fn(updateRepoSchema.required({ id: true }), async ({ id, ...fields }) => {
  const [repo] = await db.update(repos).set(fields).where(eq(repos.id, id)).returning();
  if (!repo) throw new AppError("Repo not found", "NOT_FOUND");
  return repo;
});

export const deleteRepo = fn(z.object({ id: z.uuid() }), async ({ id }) => {
  const [repo] = await db.delete(repos).where(eq(repos.id, id)).returning();
  if (!repo) throw new AppError("Repo not found", "NOT_FOUND");
  return repo;
});

/** Validate a local path and return repo info from git. */
export const resolveLocalRepo = fn(
  z.object({ path: z.string().min(1) }),
  async ({ path }) => {
    const absPath = resolve(path);

    if (!existsSync(absPath)) {
      throw new AppError("Directory does not exist", "BAD_REQUEST");
    }
    if (!isGitRepo(absPath)) {
      throw new AppError("Not a git repository", "BAD_REQUEST");
    }

    const remoteUrl = gitRemoteUrl(absPath);
    const parsed = remoteUrl ? parseGitHubRemote(remoteUrl) : null;
    const defaultBranch = gitDefaultBranch(absPath);

    // Use the directory name as fallback if no GitHub remote
    const dirName = absPath.split("/").pop() ?? "repo";

    return {
      path: absPath,
      owner: parsed?.owner ?? "local",
      name: parsed?.name ?? dirName,
      defaultBranch,
      cloneUrl: remoteUrl,
    };
  },
);

/** Link an existing local directory as a workspace. Skips cloning. */
export const linkLocalRepo = fn(
  z.object({ path: z.string().min(1) }),
  async ({ path }) => {
    const info = await resolveLocalRepo({ path });

    const [repo] = await db
      .insert(repos)
      .values({
        owner: info.owner,
        name: info.name,
        defaultBranch: info.defaultBranch,
        cloneUrl: info.cloneUrl,
        localPath: info.path,
        workspaceStatus: "ready",
      })
      .returning();

    if (!repo) throw new AppError("Failed to create repo", "INTERNAL_ERROR");
    return repo;
  },
);

export const listGitHubRepos = fn(z.object({}), async () => {
  const githubToken = await getGitHubToken({});
  const octokit = new Octokit({ auth: githubToken });
  const { data } = await octokit.request("GET /user/repos", {
    sort: "updated",
    per_page: 50,
    affiliation: "owner,collaborator,organization_member",
  });

  return data.map((r) => ({
    githubId: r.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    cloneUrl: r.clone_url,
    private: r.private,
  }));
});
