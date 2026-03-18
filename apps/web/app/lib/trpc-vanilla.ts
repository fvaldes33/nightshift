import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@openralph/backend/routers/index";
import superjson from "superjson";

export function createVanillaTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });
}

export type VanillaTRPCClient = ReturnType<typeof createVanillaTRPCClient>;
