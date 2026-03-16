import { router } from "../lib/trpc";
import { docRouter } from "./doc.router";
import { loopRouter } from "./loop.router";
import { messageRouter } from "./message.router";
import { repoRouter } from "./repo.router";
import { sessionRouter } from "./session.router";
import { taskRouter } from "./task.router";

export const appRouter = router({
  doc: docRouter,
  loop: loopRouter,
  message: messageRouter,
  repo: repoRouter,
  session: sessionRouter,
  task: taskRouter,
});

export type AppRouter = typeof appRouter;
