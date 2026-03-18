import { protectedProcedure, router } from "../lib/trpc";
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
});
