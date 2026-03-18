import type { DocListItem } from "@openralph/backend/types/doc.types";
import type { LoopListItem } from "@openralph/backend/types/loop.types";
import type { MessageListItem } from "@openralph/backend/types/message.types";
import type { RepoListItem } from "@openralph/backend/types/repo.types";
import type { SessionListItem } from "@openralph/backend/types/session.types";
import type { TaskListItem } from "@openralph/backend/types/task.types";
import { useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createDocCollection,
  createLoopCollection,
  createMessageCollection,
  createRepoCollection,
  createSessionCollection,
  createTaskCollection,
} from "~/lib/collections";
import { useNightshift } from "~/lib/nightshift-context";

export function useRepos(opts?: { initialData?: RepoListItem[] }) {
  const queryClient = useQueryClient();
  const { vanillaTRPC } = useNightshift();
  const collection = useMemo(
    () => createRepoCollection({ queryClient, trpcClient: vanillaTRPC }),
    [queryClient, vanillaTRPC],
  );
  const { data } = useLiveQuery((q) => q.from({ item: collection as any }), [collection]);
  return {
    data: (data.length > 0 ? data : (opts?.initialData ?? [])) as RepoListItem[],
    collection,
  };
}

export function useSessions(opts?: { repoId?: string; initialData?: SessionListItem[] }) {
  const queryClient = useQueryClient();
  const { vanillaTRPC } = useNightshift();
  const collection = useMemo(
    () => createSessionCollection({ queryClient, trpcClient: vanillaTRPC, repoId: opts?.repoId }),
    [queryClient, vanillaTRPC, opts?.repoId],
  );
  const { data } = useLiveQuery((q) => q.from({ item: collection as any }), [collection]);
  return {
    data: (data.length > 0 ? data : (opts?.initialData ?? [])) as SessionListItem[],
    collection,
  };
}

export function useTasks(opts?: {
  repoId?: string;
  status?: string;
  assignee?: string;
  parentId?: string | null;
  initialData?: TaskListItem[];
}) {
  const queryClient = useQueryClient();
  const { vanillaTRPC } = useNightshift();
  const collection = useMemo(
    () =>
      createTaskCollection({
        queryClient,
        trpcClient: vanillaTRPC,
        repoId: opts?.repoId,
        status: opts?.status,
        assignee: opts?.assignee,
        parentId: opts?.parentId,
      }),
    [queryClient, vanillaTRPC, opts?.repoId, opts?.status, opts?.assignee, opts?.parentId],
  );
  const { data } = useLiveQuery((q) => q.from({ item: collection as any }), [collection]);
  return {
    data: (data.length > 0 ? data : (opts?.initialData ?? [])) as TaskListItem[],
    collection,
  };
}

export function useLoops(opts?: {
  sessionId?: string;
  repoId?: string;
  initialData?: LoopListItem[];
}) {
  const queryClient = useQueryClient();
  const { vanillaTRPC } = useNightshift();
  const collection = useMemo(
    () =>
      createLoopCollection({
        queryClient,
        trpcClient: vanillaTRPC,
        sessionId: opts?.sessionId,
        repoId: opts?.repoId,
      }),
    [queryClient, vanillaTRPC, opts?.sessionId, opts?.repoId],
  );
  const { data } = useLiveQuery((q) => q.from({ item: collection as any }), [collection]);
  return {
    data: (data.length > 0 ? data : (opts?.initialData ?? [])) as LoopListItem[],
    collection,
  };
}

export function useMessages(opts: { sessionId: string; initialData?: MessageListItem[] }) {
  const queryClient = useQueryClient();
  const { vanillaTRPC } = useNightshift();
  const collection = useMemo(
    () =>
      createMessageCollection({
        queryClient,
        trpcClient: vanillaTRPC,
        sessionId: opts.sessionId,
      }),
    [queryClient, vanillaTRPC, opts.sessionId],
  );
  const { data } = useLiveQuery((q) => q.from({ item: collection as any }), [collection]);
  return {
    data: (data.length > 0 ? data : (opts.initialData ?? [])) as MessageListItem[],
    collection,
  };
}

export function useDocs(opts?: { repoId?: string; initialData?: DocListItem[] }) {
  const queryClient = useQueryClient();
  const { vanillaTRPC } = useNightshift();
  const collection = useMemo(
    () => createDocCollection({ queryClient, trpcClient: vanillaTRPC, repoId: opts?.repoId }),
    [queryClient, vanillaTRPC, opts?.repoId],
  );
  const { data } = useLiveQuery((q) => q.from({ item: collection as any }), [collection]);
  return {
    data: (data.length > 0 ? data : (opts?.initialData ?? [])) as DocListItem[],
    collection,
  };
}
