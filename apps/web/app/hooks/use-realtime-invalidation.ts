import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { trpc } from "~/lib/trpc-react";

const DEBOUNCE_MS: Record<string, number> = {
  loop_events: 250,
};
const DEFAULT_DEBOUNCE = 750;

/** Maps DB table names → collection query key prefixes */
const TABLE_TO_COLLECTION_KEY: Record<string, string> = {
  repos: "repo",
  sessions: "session",
  tasks: "task",
  loops: "loop",
  loop_events: "loop",
  messages: "message",
  docs: "doc",
};

const REALTIME_TABLES = Object.keys(TABLE_TO_COLLECTION_KEY);

export function useRealtimeInvalidation(supabase: SupabaseClient) {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const channel = supabase.channel("db-changes");

    const invalidateTable = (table: string) => {
      // 1. Invalidate tRPC queries (detail views)
      switch (table) {
        case "repos":
          utils.repo.invalidate();
          break;
        case "sessions":
          utils.session.invalidate();
          break;
        case "tasks":
          utils.task.invalidate();
          break;
        case "loops":
        case "loop_events":
          utils.loop.invalidate();
          break;
        case "messages":
          utils.message.invalidate();
          // session.get includes messages — invalidate so navigating back shows fresh data
          utils.session.invalidate();
          break;
        case "docs":
          utils.doc.invalidate();
          break;
      }

      // 2. Invalidate TanStack DB collection queries (list views)
      const collectionKey = TABLE_TO_COLLECTION_KEY[table];
      if (collectionKey) {
        queryClient.invalidateQueries({ queryKey: [collectionKey] });
      }
    };

    for (const table of REALTIME_TABLES) {
      const debounceMs = DEBOUNCE_MS[table] ?? DEFAULT_DEBOUNCE;

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          const existing = timers.current.get(table);
          if (existing) clearTimeout(existing);

          timers.current.set(
            table,
            setTimeout(() => {
              invalidateTable(table);
              timers.current.delete(table);
            }, debounceMs),
          );
        },
      );
    }

    channel.subscribe();

    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
      supabase.removeChannel(channel);
    };
  }, [supabase, utils, queryClient]);
}
