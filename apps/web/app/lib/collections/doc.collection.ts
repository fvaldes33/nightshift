import type { DocListItem } from "@openralph/backend/types/doc.types";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "../query-client";
import { vanillaTRPC } from "../trpc-vanilla";

export const docCollection = createCollection(
  queryCollectionOptions({
    id: "docs",
    queryKey: ["doc", "list", { input: {} }] as const,
    queryFn: async (ctx): Promise<DocListItem[]> =>
      vanillaTRPC.doc.list.query({}, { signal: ctx.signal }),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      await vanillaTRPC.doc.create.mutate(transaction.mutations[0].modified as any);
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      await vanillaTRPC.doc.update.mutate({ id: m.original.id, ...m.changes } as any);
    },
    onDelete: async ({ transaction }) => {
      await vanillaTRPC.doc.delete.mutate({ id: transaction.mutations[0].original.id });
    },
  }),
);
