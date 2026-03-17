import { auth } from "@openralph/backend/lib/auth";
import { ActorContext } from "@openralph/backend/lib/context";
import { appRouter } from "@openralph/backend/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Route } from "./+types/api.trpc.$";

export async function loader({ request }: Route.LoaderArgs) {
  return handleRequest(request);
}

export async function action({ request }: Route.ActionArgs) {
  return handleRequest(request);
}

async function handleRequest(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  return ActorContext.with(
    session?.user
      ? { type: "user", properties: { user: session.user } }
      : { type: "public", properties: {} },
    () =>
      fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: ({ req, resHeaders }) => ({
          request: req,
          responseHeaders: resHeaders,
        }),
      }),
  );
}
