import type { TaskListItem } from "@openralph/backend/types/task.types";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "../query-client";
import { vanillaTRPC } from "../trpc-vanilla";

export const taskCollection = createCollection(
  queryCollectionOptions({
    id: "tasks",
    queryKey: ["task", "list", { input: {} }] as const,
    queryFn: async (ctx): Promise<TaskListItem[]> =>
      vanillaTRPC.task.list.query({}, { signal: ctx.signal }),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      await vanillaTRPC.task.create.mutate(transaction.mutations[0].modified as any);
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      await vanillaTRPC.task.update.mutate({ id: m.original.id, ...m.changes } as any);
    },
    onDelete: async ({ transaction }) => {
      await vanillaTRPC.task.delete.mutate({ id: transaction.mutations[0].original.id });
    },
  }),
);
