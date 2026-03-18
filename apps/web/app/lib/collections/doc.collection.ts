import type { DocListItem } from "@openralph/backend/types/doc.types";
import type { QueryClient } from "@tanstack/react-query";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { VanillaTRPCClient } from "../trpc-vanilla";

export function createDocCollection(opts: {
  queryClient: QueryClient;
  trpcClient: VanillaTRPCClient;
  repoId?: string;
}) {
  const input = { repoId: opts.repoId };
  return createCollection(
    queryCollectionOptions({
      id: `docs-${opts.repoId ?? "all"}`,
      queryKey: ["doc", "list", { input }] as const,
      queryFn: async (ctx): Promise<DocListItem[]> =>
        opts.trpcClient.doc.list.query(input, { signal: ctx.signal }),
      queryClient: opts.queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await opts.trpcClient.doc.create.mutate(transaction.mutations[0].modified as any);
      },
      onUpdate: async ({ transaction }) => {
        const m = transaction.mutations[0];
        await opts.trpcClient.doc.update.mutate({ id: m.original.id, ...m.changes } as any);
      },
      onDelete: async ({ transaction }) => {
        await opts.trpcClient.doc.delete.mutate({ id: transaction.mutations[0].original.id });
      },
    }),
  );
}
