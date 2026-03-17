import { appRouter } from "../routers";
import { createCallerFactory } from "./trpc";

const factory = createCallerFactory(appRouter);

/**
 * Create a server-side tRPC caller for use in React Router loaders.
 * Requires ActorContext to already be active (set up via RR7 middleware).
 */
export function createCaller(request: Request): ReturnType<typeof factory> {
  return factory({ request, responseHeaders: new Headers() });
}
