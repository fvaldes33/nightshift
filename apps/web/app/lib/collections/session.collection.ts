import type { SessionListItem } from "@openralph/backend/types/session.types";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "../query-client";
import { vanillaTRPC } from "../trpc-vanilla";

export const sessionCollection = createCollection(
  queryCollectionOptions({
    id: "sessions",
    queryKey: ["session", "list", { input: {} }] as const,
    queryFn: async (ctx): Promise<SessionListItem[]> =>
      vanillaTRPC.session.list.query({}, { signal: ctx.signal }),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      await vanillaTRPC.session.create.mutate(transaction.mutations[0].modified as any);
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      await vanillaTRPC.session.update.mutate({ id: m.original.id, ...m.changes } as any);
    },
    onDelete: async ({ transaction }) => {
      await vanillaTRPC.session.delete.mutate({ id: transaction.mutations[0].original.id });
    },
  }),
);
