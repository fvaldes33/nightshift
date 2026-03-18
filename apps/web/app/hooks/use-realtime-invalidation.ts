import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const REALTIME_TABLES = [
  { table: "repos", queryKeyPrefix: "repo" },
  { table: "sessions", queryKeyPrefix: "session" },
  { table: "tasks", queryKeyPrefix: "task" },
  { table: "loops", queryKeyPrefix: "loop" },
  { table: "messages", queryKeyPrefix: "message" },
  { table: "docs", queryKeyPrefix: "doc" },
] as const;

const DEBOUNCE_MS = 750;

export function useRealtimeInvalidation(supabase: SupabaseClient, queryClient: QueryClient) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const channel = supabase.channel("db-changes");

    for (const { table, queryKeyPrefix } of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          const existing = timers.current.get(queryKeyPrefix);
          if (existing) clearTimeout(existing);

          timers.current.set(
            queryKeyPrefix,
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
              timers.current.delete(queryKeyPrefix);
            }, DEBOUNCE_MS),
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
  }, [supabase, queryClient]);
}
