import type { DocListItem } from "@openralph/backend/types/doc.types";
import type { LoopListItem } from "@openralph/backend/types/loop.types";
import type { MessageListItem } from "@openralph/backend/types/message.types";
import type { RepoListItem } from "@openralph/backend/types/repo.types";
import type { SessionListItem } from "@openralph/backend/types/session.types";
import type { TaskListItem } from "@openralph/backend/types/task.types";
import { useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import {
  repoCollection,
  sessionCollection,
  taskCollection,
  loopCollection,
  createMessageCollection,
  docCollection,
} from "~/lib/collections";

export function useRepos() {
  const { data } = useLiveQuery((q) => q.from({ item: repoCollection as any }), []);
  return {
    data: data as RepoListItem[],
    collection: repoCollection,
  };
}

export function useSessions(opts?: { repoId?: string }) {
  const { data: all } = useLiveQuery(
    (q) => q.from({ item: sessionCollection as any }),
    [],
  );
  const data = useMemo(() => {
    const items = all as SessionListItem[];
    if (opts?.repoId) return items.filter((s) => s.repoId === opts.repoId);
    return items;
  }, [all, opts?.repoId]);
  return { data, collection: sessionCollection };
}

export function useTasks(opts?: {
  repoId?: string;
  status?: string;
  assignee?: string;
  parentId?: string | null;
}) {
  const { data: all } = useLiveQuery(
    (q) => q.from({ item: taskCollection as any }),
    [],
  );
  const data = useMemo(() => {
    let items = all as TaskListItem[];
    if (opts?.repoId) items = items.filter((t) => t.repoId === opts.repoId);
    if (opts?.status) items = items.filter((t) => t.status === opts.status);
    if (opts?.assignee) items = items.filter((t) => t.assignee?.toLowerCase() === opts.assignee?.toLowerCase());
    if (opts?.parentId !== undefined) {
      items = items.filter((t) => t.parentId === opts.parentId);
    }
    return items;
  }, [all, opts?.repoId, opts?.status, opts?.assignee, opts?.parentId]);
  return { data, collection: taskCollection };
}

export function useLoops(opts?: {
  sessionId?: string;
  repoId?: string;
}) {
  const { data: all } = useLiveQuery(
    (q) => q.from({ item: loopCollection as any }),
    [],
  );
  const data = useMemo(() => {
    let items = all as LoopListItem[];
    if (opts?.repoId) items = items.filter((l) => l.repoId === opts.repoId);
    if (opts?.sessionId) items = items.filter((l) => l.sessionId === opts.sessionId);
    return items;
  }, [all, opts?.repoId, opts?.sessionId]);
  return { data, collection: loopCollection };
}

export function useMessages(opts: { sessionId: string }) {
  const collection = useMemo(
    () => createMessageCollection(opts.sessionId),
    [opts.sessionId],
  );
  const { data } = useLiveQuery((q) => q.from({ item: collection as any }), [collection]);
  return {
    data: data as MessageListItem[],
    collection,
  };
}

export function useDocs(opts?: { repoId?: string }) {
  const { data: all } = useLiveQuery(
    (q) => q.from({ item: docCollection as any }),
    [],
  );
  const data = useMemo(() => {
    const items = all as DocListItem[];
    if (opts?.repoId) return items.filter((d) => d.repoId === opts.repoId);
    return items;
  }, [all, opts?.repoId]);
  return { data, collection: docCollection };
}
