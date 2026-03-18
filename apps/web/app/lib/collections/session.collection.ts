import type { SessionListItem } from "@openralph/backend/types/session.types";
import type { QueryClient } from "@tanstack/react-query";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { VanillaTRPCClient } from "../trpc-vanilla";

export function createSessionCollection(opts: {
  queryClient: QueryClient;
  trpcClient: VanillaTRPCClient;
  repoId?: string;
}) {
  const input = { repoId: opts.repoId };
  return createCollection(
    queryCollectionOptions({
      id: `sessions-${opts.repoId ?? "all"}`,
      queryKey: ["session", "list", { input }] as const,
      queryFn: async (ctx): Promise<SessionListItem[]> =>
        opts.trpcClient.session.list.query(input, { signal: ctx.signal }),
      queryClient: opts.queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await opts.trpcClient.session.create.mutate(transaction.mutations[0].modified as any);
      },
      onUpdate: async ({ transaction }) => {
        const m = transaction.mutations[0];
        await opts.trpcClient.session.update.mutate({ id: m.original.id, ...m.changes } as any);
      },
      onDelete: async ({ transaction }) => {
        await opts.trpcClient.session.delete.mutate({ id: transaction.mutations[0].original.id });
      },
    }),
  );
}
