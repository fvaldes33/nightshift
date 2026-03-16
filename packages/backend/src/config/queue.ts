import { PgBoss } from "pg-boss";
import postgres from "postgres";

if (!process.env.QUEUE_DATABASE_URL) throw new Error("QUEUE_DATABASE_URL is required");

// Dedicated single connection for pg-boss — max:1 ensures transaction state
// persists across executeSql calls (BEGIN/COMMIT on same connection).
const sql = postgres(process.env.QUEUE_DATABASE_URL, {
  max: 1,
  prepare: false,
});

let bossInstance: PgBoss | null = null;

export function getBoss() {
  if (bossInstance) return bossInstance;

  bossInstance = new PgBoss({
    db: {
      async executeSql(text: string, values?: unknown[]) {
        const rows = await sql.unsafe(text, values as any[]);
        return { rows: Array.from(rows) };
      },
    },
  });

  bossInstance.on("error", (err: unknown) => {
    console.error("[pg-boss error]", err);
  });

  return bossInstance;
}
