import type { MessageListItem } from "@openralph/backend/types/message.types";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "../query-client";
import { vanillaTRPC } from "../trpc-vanilla";

export function createMessageCollection(sessionId: string) {
  const input = { sessionId };
  return createCollection(
    queryCollectionOptions({
      id: `messages-${sessionId}`,
      queryKey: ["message", "list", { input }] as const,
      queryFn: async (ctx): Promise<MessageListItem[]> =>
        vanillaTRPC.message.list.query(input, { signal: ctx.signal }),
      queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await vanillaTRPC.message.create.mutate(transaction.mutations[0].modified as any);
      },
    }),
  );
}
