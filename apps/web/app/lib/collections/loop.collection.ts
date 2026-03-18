import type { LoopListItem } from "@openralph/backend/types/loop.types";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "../query-client";
import { vanillaTRPC } from "../trpc-vanilla";

export const loopCollection = createCollection(
  queryCollectionOptions({
    id: "loops",
    queryKey: ["loop", "list", { input: {} }] as const,
    queryFn: async (ctx): Promise<LoopListItem[]> =>
      vanillaTRPC.loop.list.query({}, { signal: ctx.signal }),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      await vanillaTRPC.loop.create.mutate(transaction.mutations[0].modified as any);
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      await vanillaTRPC.loop.update.mutate({ id: m.original.id, ...m.changes } as any);
    },
    onDelete: async ({ transaction }) => {
      await vanillaTRPC.loop.delete.mutate({ id: transaction.mutations[0].original.id });
    },
  }),
);
