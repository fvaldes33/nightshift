import type { RepoListItem } from "@openralph/backend/types/repo.types";
import type { QueryClient } from "@tanstack/react-query";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { VanillaTRPCClient } from "../trpc-vanilla";

export function createRepoCollection(opts: {
  queryClient: QueryClient;
  trpcClient: VanillaTRPCClient;
}) {
  return createCollection(
    queryCollectionOptions({
      id: "repos",
      queryKey: ["repo", "list", { input: {} }] as const,
      queryFn: async (ctx): Promise<RepoListItem[]> =>
        opts.trpcClient.repo.list.query({}, { signal: ctx.signal }),
      queryClient: opts.queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await opts.trpcClient.repo.create.mutate(transaction.mutations[0].modified as any);
      },
      onUpdate: async ({ transaction }) => {
        const m = transaction.mutations[0];
        await opts.trpcClient.repo.update.mutate({ id: m.original.id, ...m.changes } as any);
      },
      onDelete: async ({ transaction }) => {
        await opts.trpcClient.repo.delete.mutate({ id: transaction.mutations[0].original.id });
      },
    }),
  );
}
