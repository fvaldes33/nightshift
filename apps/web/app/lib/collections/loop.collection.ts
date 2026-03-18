import type { LoopListItem } from "@openralph/backend/types/loop.types";
import type { QueryClient } from "@tanstack/react-query";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { VanillaTRPCClient } from "../trpc-vanilla";

export function createLoopCollection(opts: {
  queryClient: QueryClient;
  trpcClient: VanillaTRPCClient;
  sessionId?: string;
  repoId?: string;
}) {
  const input = { sessionId: opts.sessionId, repoId: opts.repoId };
  return createCollection(
    queryCollectionOptions({
      id: `loops-${opts.sessionId ?? "all"}-${opts.repoId ?? "all"}`,
      queryKey: ["loop", "list", { input }] as const,
      queryFn: async (ctx): Promise<LoopListItem[]> =>
        opts.trpcClient.loop.list.query(input, { signal: ctx.signal }),
      queryClient: opts.queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await opts.trpcClient.loop.create.mutate(transaction.mutations[0].modified as any);
      },
      onUpdate: async ({ transaction }) => {
        const m = transaction.mutations[0];
        await opts.trpcClient.loop.update.mutate({ id: m.original.id, ...m.changes } as any);
      },
    }),
  );
}
