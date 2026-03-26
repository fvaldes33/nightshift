import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { db } from "@openralph/db/config/database";
import { eq, inArray } from "@openralph/db/drizzle";
import { sessions } from "@openralph/db/models/index";
import { z } from "zod";
import { fn } from "../lib/fn";

/** Encode an absolute path to the ~/.claude/projects/ directory convention. */
function encodeProjectPath(absolutePath: string): string {
  return absolutePath.replaceAll("/", "-");
}

/** Resolve the Claude projects directory for a given repo local path. */
function claudeProjectDir(localPath: string): string {
  const encoded = encodeProjectPath(localPath);
  return path.join(os.homedir(), ".claude", "projects", encoded);
}

interface ParsedSessionInfo {
  sessionId: string;
  firstMessage: string;
  timestamp: string;
  fileSize: number;
  filePath: string;
}

/** Parse the first few lines of a JSONL file to extract session metadata. */
async function parseSessionFile(filePath: string): Promise<ParsedSessionInfo | null> {
  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let sessionId: string | null = null;
  let firstMessage: string | null = null;
  let earliestTimestamp: string | null = null;
  let linesRead = 0;

  for await (const line of rl) {
    if (linesRead > 50) break;
    linesRead++;

    try {
      const record = JSON.parse(line);

      if (record.sessionId && !sessionId) {
        sessionId = record.sessionId;
      }

      if (record.timestamp) {
        if (!earliestTimestamp || record.timestamp < earliestTimestamp) {
          earliestTimestamp = record.timestamp;
        }
      }

      if (!firstMessage && record.type === "user" && record.message) {
        const content = record.message.content;
        if (typeof content === "string" && content.length > 0) {
          firstMessage = content.slice(0, 200);
        } else if (Array.isArray(content)) {
          const textBlock = content.find((b: any) => b.type === "text" && b.text);
          if (textBlock?.text) {
            firstMessage = textBlock.text.slice(0, 200);
          }
        }
      }
    } catch {
      // Skip malformed lines
    }

    if (sessionId && firstMessage && earliestTimestamp) break;
  }

  stream.destroy();

  if (!sessionId) return null;

  return {
    sessionId,
    firstMessage: firstMessage ?? "(no preview available)",
    timestamp: earliestTimestamp ?? new Date().toISOString(),
    fileSize: stat.size,
    filePath,
  };
}

export const discoverClaudeSessions = fn(
  z.object({ localPath: z.string() }),
  async ({ localPath }) => {
    const projectDir = claudeProjectDir(localPath);

    if (!fs.existsSync(projectDir)) {
      return { total: 0, alreadyImported: 0, importable: 0, sessions: [] };
    }

    // List top-level .jsonl files only (skip subdirectories)
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    const jsonlFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => path.join(projectDir, e.name));

    if (jsonlFiles.length === 0) {
      return { total: 0, alreadyImported: 0, importable: 0, sessions: [] };
    }

    // Parse each file to extract session info
    const parsed = await Promise.all(jsonlFiles.map(parseSessionFile));
    const validSessions = parsed.filter((s): s is ParsedSessionInfo => s !== null);

    if (validSessions.length === 0) {
      return { total: 0, alreadyImported: 0, importable: 0, sessions: [] };
    }

    // Cross-reference against DB to exclude already-imported sessions
    const sessionIds = validSessions.map((s) => s.sessionId);
    const existingSessions = await db
      .select({ claudeSessionId: sessions.claudeSessionId })
      .from(sessions)
      .where(inArray(sessions.claudeSessionId, sessionIds));

    const importedIds = new Set(existingSessions.map((s) => s.claudeSessionId));
    const importable = validSessions.filter((s) => !importedIds.has(s.sessionId));

    return {
      total: validSessions.length,
      alreadyImported: importedIds.size,
      importable: importable.length,
      sessions: importable.map(({ filePath: _fp, ...rest }) => rest),
    };
  },
);

/** Exported for use by the import job — includes filePath. */
export const discoverClaudeSessionsWithPaths = fn(
  z.object({ localPath: z.string() }),
  async ({ localPath }) => {
    const projectDir = claudeProjectDir(localPath);

    if (!fs.existsSync(projectDir)) {
      return { total: 0, alreadyImported: 0, importable: 0, sessions: [] };
    }

    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    const jsonlFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => path.join(projectDir, e.name));

    if (jsonlFiles.length === 0) {
      return { total: 0, alreadyImported: 0, importable: 0, sessions: [] };
    }

    const parsed = await Promise.all(jsonlFiles.map(parseSessionFile));
    const validSessions = parsed.filter((s): s is ParsedSessionInfo => s !== null);

    if (validSessions.length === 0) {
      return { total: 0, alreadyImported: 0, importable: 0, sessions: [] };
    }

    const sessionIds = validSessions.map((s) => s.sessionId);
    const existingSessions = await db
      .select({ claudeSessionId: sessions.claudeSessionId })
      .from(sessions)
      .where(inArray(sessions.claudeSessionId, sessionIds));

    const importedIds = new Set(existingSessions.map((s) => s.claudeSessionId));
    const importable = validSessions.filter((s) => !importedIds.has(s.sessionId));

    return {
      total: validSessions.length,
      alreadyImported: importedIds.size,
      importable: importable.length,
      sessions: importable,
    };
  },
);
