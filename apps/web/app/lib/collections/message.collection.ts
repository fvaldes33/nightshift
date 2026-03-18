import type { MessageListItem } from "@openralph/backend/types/message.types";
import type { QueryClient } from "@tanstack/react-query";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { VanillaTRPCClient } from "../trpc-vanilla";

export function createMessageCollection(opts: {
  queryClient: QueryClient;
  trpcClient: VanillaTRPCClient;
  sessionId: string;
}) {
  const input = { sessionId: opts.sessionId };
  return createCollection(
    queryCollectionOptions({
      id: `messages-${opts.sessionId}`,
      queryKey: ["message", "list", { input }] as const,
      queryFn: async (ctx): Promise<MessageListItem[]> =>
        opts.trpcClient.message.list.query(input, { signal: ctx.signal }),
      queryClient: opts.queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await opts.trpcClient.message.create.mutate(transaction.mutations[0].modified as any);
      },
    }),
  );
}
