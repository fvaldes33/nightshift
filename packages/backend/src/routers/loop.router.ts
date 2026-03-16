import { protectedProcedure, router } from "../lib/trpc";
import {
  createLoop,
  deleteLoop,
  getLoop,
  listLoops,
  updateLoop,
} from "../services/loop.service";

export const loopRouter = router({
  list: protectedProcedure.input(listLoops.schema).query(({ input }) => listLoops(input)),
  get: protectedProcedure.input(getLoop.schema).query(({ input }) => getLoop(input)),
  create: protectedProcedure.input(createLoop.schema).mutation(({ input }) => createLoop(input)),
  update: protectedProcedure.input(updateLoop.schema).mutation(({ input }) => updateLoop(input)),
  delete: protectedProcedure.input(deleteLoop.schema).mutation(({ input }) => deleteLoop(input)),
});
