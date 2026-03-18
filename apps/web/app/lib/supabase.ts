import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

export function useSupabaseClient(): SupabaseClient {
  return useMemo(
    () =>
      createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      }),
    [],
  );
}
