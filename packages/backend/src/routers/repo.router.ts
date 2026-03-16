import { protectedProcedure, router } from "../lib/trpc";
import { createRepo, deleteRepo, getRepo, listRepos, updateRepo } from "../services/repo.service";

export const repoRouter = router({
  list: protectedProcedure.input(listRepos.schema).query(({ input }) => listRepos(input)),
  get: protectedProcedure.input(getRepo.schema).query(({ input }) => getRepo(input)),
  create: protectedProcedure.input(createRepo.schema).mutation(({ input }) => createRepo(input)),
  update: protectedProcedure.input(updateRepo.schema).mutation(({ input }) => updateRepo(input)),
  delete: protectedProcedure.input(deleteRepo.schema).mutation(({ input }) => deleteRepo(input)),
});
