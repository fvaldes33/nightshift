import { z } from "zod";
import { claudeImportBulkQueue } from "../jobs/claude-import-bulk.job";
import { runClaude } from "../lib/claude-runner";
import { AppError } from "../lib/errors";
import { protectedProcedure, router } from "../lib/trpc";
import { getGitHubToken } from "../services/account.service";
import {
  discoverClaudeSessions,
  discoverClaudeSessionsWithPaths,
} from "../services/claude-import.service";
import {
  gitAheadCount,
  gitCurrentBranch,
  gitDefaultBranch,
  gitDiffStat,
  gitLogOneline,
  gitPush,
  gitUnpushedCount,
} from "../services/git-cli.service";
import { createPullRequest, listPullRequests } from "../services/github.service";
import { getRepo } from "../services/repo.service";
import {
  createSession,
  deleteSession,
  getSession,
  handoffSession,
  listSessions,
  resolveSessionCwd,
  updateSession,
} from "../services/session.service";

export const sessionRouter = router({
  list: protectedProcedure.input(listSessions.schema).query(({ input }) => listSessions(input)),
  get: protectedProcedure.input(getSession.schema).query(({ input }) => getSession(input)),
  create: protectedProcedure
    .input(createSession.schema)
    .mutation(({ input }) => createSession(input)),
  update: protectedProcedure
    .input(updateSession.schema)
    .mutation(({ input }) => updateSession(input)),
  delete: protectedProcedure
    .input(deleteSession.schema)
    .mutation(({ input }) => deleteSession(input)),

  handoff: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ input }) => handoffSession(input.id)),

  discoverClaudeSessions: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .query(async ({ input }) => {
      const repo = await getRepo({ id: input.repoId });
      if (!repo.localPath) throw new AppError("Repo has no local path", "BAD_REQUEST");
      return discoverClaudeSessions({ localPath: repo.localPath });
    }),

  importClaudeSessions: protectedProcedure
    .input(z.object({ repoId: z.uuid() }))
    .mutation(async ({ input }) => {
      const repo = await getRepo({ id: input.repoId });
      if (!repo.localPath) throw new AppError("Repo has no local path", "BAD_REQUEST");
      const result = await discoverClaudeSessionsWithPaths({ localPath: repo.localPath });

      if (result.importable === 0) {
        return { count: 0 };
      }

      await claudeImportBulkQueue.send({
        repoId: input.repoId,
        sessionFileInfos: result.sessions.map((s) => ({
          sessionId: s.sessionId,
          filePath: s.filePath,
        })),
      });

      return { count: result.importable };
    }),

  gitStatus: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
    const session = await getSession(input);
    const resolved = await resolveSessionCwd(session);
    if (!resolved) return { branch: null, unpushedCount: 0, defaultBranch: "main" };

    const { cwd, branch } = resolved;
    const defaultBranch = gitDefaultBranch(cwd);
    let unpushedCount = 0;
    try {
      unpushedCount = gitUnpushedCount(cwd);
    } catch {
      // No upstream set (new branch) — count commits ahead of default branch
      try {
        unpushedCount = gitAheadCount(cwd, `origin/${defaultBranch}`);
      } catch {
        // No remote at all
      }
    }
    return { branch, unpushedCount, defaultBranch };
  }),

  push: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
    const session = await getSession(input);
    const resolved = await resolveSessionCwd(session);
    if (!resolved) throw new Error("No working directory for this session");

    gitPush(resolved.cwd);
    const branch = gitCurrentBranch(resolved.cwd);
    return { pushed: true, branch };
  }),

  createPR: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string(),
        body: z.string().default(""),
        base: z.string().optional(),
        draft: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input: { id, title, body, base, draft } }) => {
      const session = await getSession({ id });
      if (!session.repo) throw new Error("Session has no associated repo");

      const resolved = await resolveSessionCwd(session);
      if (!resolved) throw new Error("No working directory for this session");

      const token = await getGitHubToken({});
      const branch = gitCurrentBranch(resolved.cwd);
      const defaultBranch = base ?? gitDefaultBranch(resolved.cwd);

      // Push first
      try {
        gitPush(resolved.cwd);
      } catch {
        /* may already be pushed */
      }

      // Check for existing PR
      const existingPRs = await listPullRequests({
        token,
        owner: session.repo.owner,
        repo: session.repo.name,
        state: "open",
        head: `${session.repo.owner}:${branch}`,
      });

      if (existingPRs.length > 0) {
        const existing = existingPRs[0]!;
        await updateSession({
          id,
          prNumber: existing.number,
          prUrl: existing.url,
          prStatus: "open",
          prBranch: branch,
        });
        return { url: existing.url, number: existing.number, existing: true };
      }

      const pr = await createPullRequest({
        token,
        owner: session.repo.owner,
        repo: session.repo.name,
        head: branch,
        base: defaultBranch,
        title,
        body,
        draft,
      });

      await updateSession({
        id,
        prNumber: pr.number,
        prUrl: pr.url,
        prStatus: "open",
        prBranch: branch,
      });

      return { url: pr.url, number: pr.number, created: true };
    }),

  generatePRSummary: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ input }) => {
      const session = await getSession(input);
      if (!session.repo) throw new Error("Session has no associated repo");

      const resolved = await resolveSessionCwd(session);
      if (!resolved) throw new Error("No working directory for this session");

      const { cwd } = resolved;
      const defaultBranch = gitDefaultBranch(cwd);
      const commitLog = gitLogOneline(cwd, `origin/${defaultBranch}`);
      const diffStat = gitDiffStat(cwd, `origin/${defaultBranch}`);

      if (!commitLog.trim()) {
        return { title: session.title, body: "" };
      }

      const prompt = `Generate a GitHub pull request title and description for these changes.

Repository: ${session.repo.owner}/${session.repo.name}
Session: ${session.title}

Commits:
${commitLog}

Files changed:
${diffStat}

Respond in EXACTLY this format (no other text):
TITLE: <concise PR title, under 70 chars>
BODY:
<markdown description with ## Summary section and bullet points>`;

      const result = await runClaude({
        prompt,
        cwd,
        args: ["--max-turns", "5"],
        timeoutSec: 60,
      });

      const text = result.summary || "";
      const titleMatch = text.match(/TITLE:\s*(.+)/);
      const bodyMatch = text.match(/BODY:\s*\n([\s\S]*)/);

      return {
        title: titleMatch?.[1]?.trim() || session.title,
        body: bodyMatch?.[1]?.trim() || text,
      };
    }),
});
