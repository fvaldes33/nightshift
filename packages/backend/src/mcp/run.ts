import { startServer } from "./ralph-server";

startServer().catch((err) => {
  console.error("[mcp] Fatal error:", err);
  process.exit(1);
});
