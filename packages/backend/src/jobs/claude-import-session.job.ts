import type { UIMessage } from "ai";
import fs from "node:fs";
import readline from "node:readline";
import { db } from "@openralph/db/config/database";
import { messages, sessions } from "@openralph/db/models/index";
import { z } from "zod";
import { createQueue } from "../lib/queue-builder";

// ---------------------------------------------------------------------------
// Queue: claude-import/session — imports a single Claude Code session
// ---------------------------------------------------------------------------

export const claudeImportSessionQueue = createQueue({
  name: "claude-import/session",
  input: z.object({
    repoId: z.uuid(),
    sessionId: z.string(),
    filePath: z.string(),
  }),
  queueOptions: {
    retryLimit: 1,
  },
});

// ---------------------------------------------------------------------------
// JSONL record types
// ---------------------------------------------------------------------------

interface JsonlRecord {
  type: string;
  uuid: string;
  timestamp: string;
  sessionId: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
}

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | ContentBlock[];
}

// ---------------------------------------------------------------------------
// Anthropic → UIMessage parts mapping
// ---------------------------------------------------------------------------

function buildToolResultMap(records: JsonlRecord[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const record of records) {
    if (record.type !== "user" || !record.message) continue;
    const content = record.message.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        map.set(block.tool_use_id, block.content ?? "");
      }
    }
  }
  return map;
}

function isToolResultOnly(content: string | ContentBlock[]): boolean {
  if (typeof content === "string") return false;
  return content.length > 0 && content.every((b) => b.type === "tool_result");
}

function mapAssistantParts(
  content: string | ContentBlock[],
  toolResults: Map<string, unknown>,
): UIMessage["parts"] {
  if (typeof content === "string") {
    return [{ type: "text" as const, text: content }];
  }

  const parts: UIMessage["parts"] = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      parts.push({ type: "text" as const, text: block.text });
    } else if (block.type === "thinking" && block.thinking) {
      parts.push({ type: "reasoning" as const, text: block.thinking });
    } else if (block.type === "tool_use" && block.id && block.name) {
      parts.push({
        type: "dynamic-tool" as const,
        toolCallId: block.id,
        toolName: block.name,
        input: block.input ?? {},
        state: "output-available" as const,
        output: toolResults.get(block.id) ?? "",
      });
    }
  }
  return parts;
}

function mapUserParts(content: string | ContentBlock[]): UIMessage["parts"] {
  if (typeof content === "string") {
    return [{ type: "text" as const, text: content }];
  }

  const parts: UIMessage["parts"] = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      parts.push({ type: "text" as const, text: block.text });
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

claudeImportSessionQueue.work(async (job) => {
  const { repoId, sessionId, filePath } = job.data;
  console.log(`[claude-import/session] Importing session ${sessionId}`);

  // Read and parse all JSONL records
  const records: JsonlRecord[] = [];
  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    try {
      const record = JSON.parse(line);
      if (record.sessionId && record.message) {
        records.push(record);
      }
    } catch {
      // Skip malformed lines
    }
  }

  stream.destroy();

  if (records.length === 0) {
    console.log(`[claude-import/session] No valid records in ${filePath}`);
    return;
  }

  // Build tool_use_id → tool_result map from user tool_result messages
  const toolResults = buildToolResultMap(records);

  // Find first user text message for title
  let title = "Imported session";
  let model = "claude-sonnet-4-6";
  let latestTimestamp = "";

  for (const record of records) {
    if (!record.message) continue;

    // Extract title from first user text message
    if (record.message.role === "user" && title === "Imported session") {
      const content = record.message.content;
      if (typeof content === "string" && content.length > 0) {
        title = content.slice(0, 100);
      } else if (Array.isArray(content)) {
        const textBlock = content.find((b) => b.type === "text" && b.text);
        if (textBlock?.text) {
          title = textBlock.text.slice(0, 100);
        }
      }
    }

    // Extract model from first assistant message
    if (record.message.role === "assistant" && record.message.model && model === "claude-sonnet-4-6") {
      model = record.message.model;
    }

    // Track latest timestamp
    if (record.timestamp > latestTimestamp) {
      latestTimestamp = record.timestamp;
    }
  }

  // Determine status: active if latest timestamp within 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const status = latestTimestamp && new Date(latestTimestamp) > threeDaysAgo ? "active" : "archived";

  // Create session
  const [session] = await db
    .insert(sessions)
    .values({
      repoId,
      title,
      claudeSessionId: sessionId,
      mode: "chat",
      provider: "anthropic",
      model,
      status: status as "active" | "archived",
      workspaceMode: "local",
    })
    .returning();

  if (!session) {
    throw new Error(`Failed to create session for ${sessionId}`);
  }

  // Build message records
  const messageValues: Array<{
    sessionId: string;
    role: "user" | "assistant";
    parts: UIMessage["parts"];
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }> = [];

  for (const record of records) {
    if (!record.message) continue;
    const { role, content } = record.message;

    if (role === "user") {
      // Skip user messages that are only tool_results
      if (isToolResultOnly(content)) continue;

      const parts = mapUserParts(content);
      if (parts.length === 0) continue;

      messageValues.push({
        sessionId: session.id,
        role: "user",
        parts,
        metadata: record.message.usage
          ? { usage: record.message.usage }
          : null,
        createdAt: new Date(record.timestamp),
      });
    } else if (role === "assistant") {
      const parts = mapAssistantParts(content, toolResults);
      if (parts.length === 0) continue;

      messageValues.push({
        sessionId: session.id,
        role: "assistant",
        parts,
        metadata: record.message.usage
          ? { usage: record.message.usage }
          : null,
        createdAt: new Date(record.timestamp),
      });
    }
  }

  // Bulk insert messages in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < messageValues.length; i += BATCH_SIZE) {
    const batch = messageValues.slice(i, i + BATCH_SIZE);
    await db.insert(messages).values(batch);
  }

  console.log(
    `[claude-import/session] Session ${sessionId} imported: ${messageValues.length} messages`,
  );
});
