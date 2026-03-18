import { workspaceSetupQueue } from "../jobs/workspace.job";
import { protectedProcedure, router } from "../lib/trpc";
import {
  createRepo,
  deleteRepo,
  getRepo,
  linkLocalRepo,
  listGitHubRepos,
  listRepos,
  resolveLocalRepo,
  updateRepo,
} from "../services/repo.service";

export const repoRouter = router({
  list: protectedProcedure.input(listRepos.schema).query(({ input }) => listRepos(input)),
  get: protectedProcedure.input(getRepo.schema).query(({ input }) => getRepo(input)),
  create: protectedProcedure.input(createRepo.schema).mutation(async ({ input }) => {
    const repo = await createRepo(input);
    await workspaceSetupQueue.send({ repoId: repo.id });
    return repo;
  }),
  update: protectedProcedure.input(updateRepo.schema).mutation(({ input }) => updateRepo(input)),
  delete: protectedProcedure.input(deleteRepo.schema).mutation(({ input }) => deleteRepo(input)),
  listGitHub: protectedProcedure
    .input(listGitHubRepos.schema)
    .query(({ input }) => listGitHubRepos(input)),
  resolveLocal: protectedProcedure
    .input(resolveLocalRepo.schema)
    .query(({ input }) => resolveLocalRepo(input)),
  linkLocal: protectedProcedure
    .input(linkLocalRepo.schema)
    .mutation(({ input }) => linkLocalRepo(input)),
});
