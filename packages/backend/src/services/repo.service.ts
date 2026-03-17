import { db } from "@openralph/db/config/database";
import { eq } from "@openralph/db/drizzle";
import { insertRepoSchema, repos, updateRepoSchema } from "@openralph/db/models/index";
import { Octokit } from "octokit";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { fn } from "../lib/fn";
import { getGitHubToken } from "./account.service";

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
