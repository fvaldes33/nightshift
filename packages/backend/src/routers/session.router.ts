import { z } from "zod";
import { AppError } from "../lib/errors";
import { protectedProcedure, router } from "../lib/trpc";
import { claudeImportBulkQueue } from "../jobs/claude-import-bulk.job";
import {
  discoverClaudeSessions,
  discoverClaudeSessionsWithPaths,
} from "../services/claude-import.service";
import { getRepo } from "../services/repo.service";
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  updateSession,
} from "../services/session.service";

export const sessionRouter = router({
  list: protectedProcedure.input(listSessions.schema).query(({ input }) => listSessions(input)),
  get: protectedProcedure.input(getSession.schema).query(({ input }) => getSession(input)),
  create: protectedProcedure.input(createSession.schema).mutation(({ input }) => createSession(input)),
  update: protectedProcedure
    .input(updateSession.schema)
    .mutation(({ input }) => updateSession(input)),
  delete: protectedProcedure
    .input(deleteSession.schema)
    .mutation(({ input }) => deleteSession(input)),

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
});
