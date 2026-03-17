import { protectedProcedure, router } from "../lib/trpc";
import {
  addTaskComment,
  bulkDeleteTasks,
  bulkUpdateTasks,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "../services/task.service";

export const taskRouter = router({
  list: protectedProcedure.input(listTasks.schema).query(({ input }) => listTasks(input)),
  get: protectedProcedure.input(getTask.schema).query(({ input }) => getTask(input)),
  create: protectedProcedure.input(createTask.schema).mutation(({ input }) => createTask(input)),
  update: protectedProcedure.input(updateTask.schema).mutation(({ input }) => updateTask(input)),
  addComment: protectedProcedure
    .input(addTaskComment.schema)
    .mutation(({ input }) => addTaskComment(input)),
  delete: protectedProcedure.input(deleteTask.schema).mutation(({ input }) => deleteTask(input)),
  bulkUpdate: protectedProcedure.input(bulkUpdateTasks.schema).mutation(({ input }) => bulkUpdateTasks(input)),
  bulkDelete: protectedProcedure.input(bulkDeleteTasks.schema).mutation(({ input }) => bulkDeleteTasks(input)),
});
