import { neonConfig, Pool } from "@neondatabase/serverless";
import { PgBoss } from "pg-boss";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.QUEUE_DATABASE_URL) throw new Error("QUEUE_DATABASE_URL is required");

// Dedicated pool for pg-boss using the non-pooled Neon endpoint.
// max:1 ensures transaction state persists across executeSql calls (BEGIN/COMMIT).
const pool = new Pool({
  connectionString: process.env.QUEUE_DATABASE_URL,
  max: 1,
});

let bossInstance: PgBoss | null = null;

export function getBoss() {
  if (bossInstance) return bossInstance;

  bossInstance = new PgBoss({
    db: {
      async executeSql(text: string, values?: unknown[]) {
        const result = await pool.query(text, values as unknown[]);
        return { rows: result.rows as unknown[] };
      },
    },
  });

  bossInstance.on("error", (err: unknown) => {
    console.error("[pg-boss error]", err);
  });

  return bossInstance;
}
