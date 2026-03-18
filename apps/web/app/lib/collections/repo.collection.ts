import type { RepoListItem } from "@openralph/backend/types/repo.types";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "../query-client";
import { vanillaTRPC } from "../trpc-vanilla";

export const repoCollection = createCollection(
  queryCollectionOptions({
    id: "repos",
    queryKey: ["repo", "list", { input: {} }] as const,
    queryFn: async (ctx): Promise<RepoListItem[]> =>
      vanillaTRPC.repo.list.query({}, { signal: ctx.signal }),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      await vanillaTRPC.repo.create.mutate(transaction.mutations[0].modified as any);
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      await vanillaTRPC.repo.update.mutate({ id: m.original.id, ...m.changes } as any);
    },
    onDelete: async ({ transaction }) => {
      await vanillaTRPC.repo.delete.mutate({ id: transaction.mutations[0].original.id });
    },
  }),
);
