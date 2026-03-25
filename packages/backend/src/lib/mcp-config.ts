import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_DIR =
  process.env.NIGHTSHIFT_WORKSPACE_DIR ?? join(process.env.HOME ?? "", ".nightshift");
const MCP_CONFIG_PATH = join(BASE_DIR, "mcp-config.json");

/** Write the MCP config once to a persistent location. Reuses if already present. */
export async function ensureMcpConfig(): Promise<string> {
  if (existsSync(MCP_CONFIG_PATH)) return MCP_CONFIG_PATH;

  const mcpRunPath = join(import.meta.dirname, "../mcp/run.ts");
  console.log(`[mcp-config] MCP run.ts path: ${mcpRunPath}`);

  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true });
  }

  const config = {
    mcpServers: {
      openralph: {
        type: "stdio",
        command: "bun",
        args: ["run", mcpRunPath],
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? "",
        },
      },
    },
  };
  await writeFile(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`[mcp-config] Wrote MCP config to ${MCP_CONFIG_PATH}`);
  return MCP_CONFIG_PATH;
}
