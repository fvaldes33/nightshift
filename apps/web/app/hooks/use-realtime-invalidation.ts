import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";
import { trpc } from "~/lib/trpc-react";

const DEBOUNCE_MS: Record<string, number> = {
  loop_events: 250,
};
const DEFAULT_DEBOUNCE = 750;

const REALTIME_TABLES = [
  "repos",
  "sessions",
  "tasks",
  "loops",
  "loop_events",
  "messages",
  "docs",
];

export function useRealtimeInvalidation(supabase: SupabaseClient) {
  const utils = trpc.useUtils();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const channel = supabase.channel("db-changes");

    const invalidateTable = (table: string) => {
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
          utils.session.invalidate();
          break;
        case "docs":
          utils.doc.invalidate();
          break;
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
  }, [supabase, utils]);
}
