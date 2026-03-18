import { createContext, useContext } from "react";
import type { VanillaTRPCClient } from "./trpc-vanilla";

export interface NightshiftContextValue {
  vanillaTRPC: VanillaTRPCClient;
}

export const NightshiftContext = createContext<NightshiftContextValue | null>(null);

export function useNightshift(): NightshiftContextValue {
  const ctx = useContext(NightshiftContext);
  if (!ctx) throw new Error("useNightshift must be used within NightshiftContext.Provider");
  return ctx;
}
