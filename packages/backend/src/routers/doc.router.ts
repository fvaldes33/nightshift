import { protectedProcedure, router } from "../lib/trpc";
import { createDoc, deleteDoc, getDoc, listDocs, updateDoc } from "../services/doc.service";

export const docRouter = router({
  list: protectedProcedure.input(listDocs.schema).query(({ input }) => listDocs(input)),
  get: protectedProcedure.input(getDoc.schema).query(({ input }) => getDoc(input)),
  create: protectedProcedure.input(createDoc.schema).mutation(({ input }) => createDoc(input)),
  update: protectedProcedure.input(updateDoc.schema).mutation(({ input }) => updateDoc(input)),
  delete: protectedProcedure.input(deleteDoc.schema).mutation(({ input }) => deleteDoc(input)),
});
