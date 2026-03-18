import { auth } from "@openralph/backend/lib/auth";
import { boss } from "@openralph/backend/config/queue";
import { bootstrapQueues } from "@openralph/backend/jobs/index";
import { ActorContext } from "@openralph/backend/lib/context";
import { appRouter } from "@openralph/backend/routers/index";
import { streamChat } from "@openralph/backend/services/ai.service";
import { getSession } from "@openralph/backend/services/session.service";
import { createRequestHandler } from "@react-router/express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { pipeUIMessageStreamToResponse, type UIMessage } from "ai";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import express from "express";

const app = express();

app.disable("x-powered-by");

// ── API: Auth (BetterAuth) ──────────────────────────────────────────────────
// Must come BEFORE express.json() or auth requests hang
app.all("/api/auth/{*splat}", toNodeHandler(auth));

// JSON parsing for remaining routes
app.use(express.json());

// ── API: tRPC ───────────────────────────────────────────────────────────────

const trpcMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext: () => ({}) as any,
});

app.use("/api/trpc", async (req, res, next) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  const actor = session?.user
    ? { type: "user" as const, properties: { user: session.user } }
    : { type: "public" as const, properties: {} as Record<string, never> };

  ActorContext.with(actor, () => trpcMiddleware(req, res, next));
});

// ── API: Chat (AI streaming) ────────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  const authSession = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!authSession?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id: sessionId, messages } = req.body as { id: string; messages: UIMessage[] };
  if (!sessionId || !messages?.length) {
    res.status(400).json({ error: "Missing session id or messages" });
    return;
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    res.status(400).json({ error: "Last message must be from user" });
    return;
  }

  await ActorContext.with(
    { type: "user", properties: { user: authSession.user } },
    async () => {
      const session = await getSession({ id: sessionId });
      if (session.workspaceStatus !== "ready") {
        res.status(400).json({ error: "Workspace is not ready" });
        return;
      }

      const stream = streamChat({ session, messages });
      pipeUIMessageStreamToResponse({ response: res, stream });
    },
  );
});

// ── React Router SPA handler ────────────────────────────────────────────────

app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
  }),
);

// ── Queue ───────────────────────────────────────────────────────────────────

export async function initQueue() {
  try {
    await boss.start();
  } catch (error) {
    if (error instanceof Error && error.message.includes("already started")) {
      return;
    }
    console.error("Failed to start job queue:", error);
    throw error;
  }

  await bootstrapQueues();
}

export async function shutdownQueue() {
  await boss.stop();
}

if (process.env.NODE_ENV !== "production") {
  initQueue().catch((err) => {
    console.error("Queue initialization failed:", err);
  });
}

export { app };
