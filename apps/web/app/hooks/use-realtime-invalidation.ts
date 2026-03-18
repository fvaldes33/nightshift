import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const REALTIME_TABLES = [
  { table: "repos", queryKeyPrefix: "repo", debounceMs: 750 },
  { table: "sessions", queryKeyPrefix: "session", debounceMs: 750 },
  { table: "tasks", queryKeyPrefix: "task", debounceMs: 750 },
  { table: "loops", queryKeyPrefix: "loop", debounceMs: 750 },
  { table: "loop_events", queryKeyPrefix: "loop", debounceMs: 250 },
  { table: "messages", queryKeyPrefix: "message", debounceMs: 750 },
  { table: "docs", queryKeyPrefix: "doc", debounceMs: 750 },
] as const;

export function useRealtimeInvalidation(supabase: SupabaseClient, queryClient: QueryClient) {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const channel = supabase.channel("db-changes");

    for (const { table, queryKeyPrefix, debounceMs } of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          const key = `${table}:${queryKeyPrefix}`;
          const existing = timers.current.get(key);
          if (existing) clearTimeout(existing);

          timers.current.set(
            key,
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
              timers.current.delete(key);
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
  }, [supabase, queryClient]);
}
