import { boss } from "@openralph/backend/config/queue";
import { bootstrapQueues } from "@openralph/backend/jobs/index";
import { createRequestHandler } from "@react-router/express";
import express from "express";
import { createRequire } from "node:module";

const app = express();
const require = createRequire(import.meta.url);

app.disable("x-powered-by");

app.use(
  createRequestHandler({
    build: () => import("virtual:react-router/server-build"),
  }),
);

export async function initQueue() {
  try {
    await boss.start();
  } catch (error) {
    if (error instanceof Error && error.message.includes("already started")) {
      // Expected during HMR in development
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

// In dev mode, Vite loads this module via ssrLoadModule — start the queue here.
// In production, server.js calls initQueue() explicitly after import.
if (process.env.NODE_ENV !== "production") {
  initQueue().catch((err) => {
    console.error("Queue initialization failed:", err);
  });
}

export { app };
