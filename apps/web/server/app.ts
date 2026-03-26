import { auth } from "@openralph/backend/lib/auth";
import { boss } from "@openralph/backend/config/queue";
import { bootstrapQueues } from "@openralph/backend/jobs/index";
import { ActorContext } from "@openralph/backend/lib/context";
import { appRouter } from "@openralph/backend/routers/index";
import { streamChat } from "@openralph/backend/services/ai.service";
import { createMessage } from "@openralph/backend/services/message.service";
import { getSession } from "@openralph/backend/services/session.service";
import { createRequestHandler } from "@react-router/express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createUIMessageStream, pipeUIMessageStreamToResponse, type UIMessage } from "ai";
import { v4 as uuidv4 } from "uuid";
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

  const { id: sessionId, message } = req.body as { id: string; message: UIMessage };
  if (!sessionId || !message) {
    res.status(400).json({ error: "Missing session id or message" });
    return;
  }

  await ActorContext.with(
    { type: "user", properties: { user: authSession.user } },
    async () => {
      // Tool output patch from addToolOutput — persist and return an ack message
      // to break the auto-send loop (lastAssistantMessageIsCompleteWithToolCalls
      // stops when the last assistant message has no tool calls).
      if (message.role === "assistant") {
        await createMessage({
          id: message.id,
          sessionId,
          role: "assistant",
          parts: message.parts,
        });

        const ackId = uuidv4();
        const textId = uuidv4();
        const ackText = "Done.";

        // Persist the ack so it survives page reloads
        await createMessage({
          id: ackId,
          sessionId,
          role: "assistant",
          parts: [{ type: "text" as const, text: ackText, state: "done" as const }],
        });

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            writer.write({ type: "start", messageId: ackId });
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: textId });
            writer.write({ type: "text-delta", id: textId, delta: ackText });
            writer.write({ type: "text-end", id: textId });
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish", finishReason: "stop" });
          },
        });
        pipeUIMessageStreamToResponse({ response: res, stream });
        return;
      }

      const session = await getSession({ id: sessionId });
      if (!session.repo || session.repo.workspaceStatus !== "ready") {
        res.status(400).json({ error: "Workspace is not ready" });
        return;
      }

      const stream = streamChat({ session, message });
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
