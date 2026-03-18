import { Octokit } from "octokit";
import { z } from "zod";
import { fn } from "../lib/fn";

function createOctokit(token: string) {
  return new Octokit({ auth: token });
}

export const createPullRequest = fn(
  z.object({
    token: z.string(),
    owner: z.string(),
    repo: z.string(),
    head: z.string(),
    base: z.string().default("main"),
    title: z.string(),
    body: z.string(),
    draft: z.boolean().default(false),
  }),
  async ({ token, owner, repo, head, base, title, body, draft }) => {
    const octokit = createOctokit(token);
    const { data } = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      head,
      base,
      title,
      body,
      draft,
    });
    return { url: data.html_url, number: data.number };
  },
);

export const getPullRequest = fn(
  z.object({
    token: z.string(),
    owner: z.string(),
    repo: z.string(),
    pullNumber: z.number().int(),
  }),
  async ({ token, owner, repo, pullNumber }) => {
    const octokit = createOctokit(token);
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner,
      repo,
      pull_number: pullNumber,
    });
    return {
      number: data.number,
      title: data.title,
      state: data.state,
      merged: data.merged,
      url: data.html_url,
      head: data.head.ref,
      base: data.base.ref,
    };
  },
);

export const listPullRequests = fn(
  z.object({
    token: z.string(),
    owner: z.string(),
    repo: z.string(),
    state: z.enum(["open", "closed", "all"]).default("open"),
    head: z.string().optional(),
  }),
  async ({ token, owner, repo, state, head }) => {
    const octokit = createOctokit(token);
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state,
      head,
    });
    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.html_url,
      head: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
    }));
  },
);

export const addPRReviewers = fn(
  z.object({
    token: z.string(),
    owner: z.string(),
    repo: z.string(),
    pullNumber: z.number().int(),
    reviewers: z.array(z.string()),
  }),
  async ({ token, owner, repo, pullNumber, reviewers }) => {
    const octokit = createOctokit(token);
    const { data } = await octokit.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
      { owner, repo, pull_number: pullNumber, reviewers },
    );
    return {
      number: data.number,
      requested_reviewers: data.requested_reviewers?.map((r) => r.login),
    };
  },
);

export const addPRLabels = fn(
  z.object({
    token: z.string(),
    owner: z.string(),
    repo: z.string(),
    issueNumber: z.number().int(),
    labels: z.array(z.string()),
  }),
  async ({ token, owner, repo, issueNumber, labels }) => {
    const octokit = createOctokit(token);
    const { data } = await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
      { owner, repo, issue_number: issueNumber, labels },
    );
    return data.map((l) => l.name);
  },
);
