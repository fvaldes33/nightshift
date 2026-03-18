import type { TaskListItem } from "@openralph/backend/types/task.types";
import type { QueryClient } from "@tanstack/react-query";
import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { VanillaTRPCClient } from "../trpc-vanilla";

export function createTaskCollection(opts: {
  queryClient: QueryClient;
  trpcClient: VanillaTRPCClient;
  repoId?: string;
  sessionId?: string;
  status?: string;
  assignee?: string;
  parentId?: string | null;
}) {
  const input = {
    repoId: opts.repoId,
    status: opts.status,
    assignee: opts.assignee,
    parentId: opts.parentId,
  };
  return createCollection(
    queryCollectionOptions({
      id: `tasks-${opts.repoId ?? "all"}-${opts.status ?? "all"}-${opts.assignee ?? "all"}`,
      queryKey: ["task", "list", { input }] as const,
      queryFn: async (ctx): Promise<TaskListItem[]> =>
        opts.trpcClient.task.list.query(input, { signal: ctx.signal }),
      queryClient: opts.queryClient,
      getKey: (item) => item.id,
      onInsert: async ({ transaction }) => {
        await opts.trpcClient.task.create.mutate(transaction.mutations[0].modified as any);
      },
      onUpdate: async ({ transaction }) => {
        const m = transaction.mutations[0];
        await opts.trpcClient.task.update.mutate({ id: m.original.id, ...m.changes } as any);
      },
      onDelete: async ({ transaction }) => {
        await opts.trpcClient.task.delete.mutate({ id: transaction.mutations[0].original.id });
      },
    }),
  );
}
