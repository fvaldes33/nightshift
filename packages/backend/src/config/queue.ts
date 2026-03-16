import { remember } from "@epic-web/remember";
import { PgBoss } from "pg-boss";
import postgres from "postgres";

if (!process.env.QUEUE_DATABASE_URL) throw new Error("QUEUE_DATABASE_URL is required");

// Dedicated single connection for pg-boss — max:1 ensures transaction state
// persists across executeSql calls (BEGIN/COMMIT on same connection).
// Separate from the Drizzle pool so pg-boss transactions don't conflict.
const bossSql = remember("pgboss-sql", () =>
  postgres(process.env.QUEUE_DATABASE_URL!, {
    max: 1,
    prepare: false,
  }),
);

function coerceJsonRecordsetParams(sqlText: string, values?: unknown[]) {
  if (!values?.length) return values;
  if (!sqlText.includes("json_to_recordset")) return values;

  return values.map((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!(trimmed.startsWith("[") || trimmed.startsWith("{"))) return value;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  });
}

export const boss = remember("pgboss", () => {
  const instance = new PgBoss({
    db: {
      async executeSql(text: string, values?: unknown[]) {
        try {
          const coercedValues = coerceJsonRecordsetParams(text, values);
          const rows = await bossSql.unsafe(text, coercedValues as any[]);
          return { rows: Array.from(rows) };
        } catch (err) {
          console.error("[pg-boss sql error]", err, { text: text.slice(0, 200), values });
          throw err;
        }
      },
    },
  });

  instance.on("error", (err) => {
    console.error("[pg-boss error event]", err);
  });

  instance.setMaxListeners(50);

  return instance;
});
