import { protectedProcedure, router } from "../lib/trpc";
import { createMessage, deleteMessage, listMessages } from "../services/message.service";

export const messageRouter = router({
  list: protectedProcedure.input(listMessages.schema).query(({ input }) => listMessages(input)),
  create: protectedProcedure
    .input(createMessage.schema)
    .mutation(({ input }) => createMessage(input)),
  delete: protectedProcedure
    .input(deleteMessage.schema)
    .mutation(({ input }) => deleteMessage(input)),
});
