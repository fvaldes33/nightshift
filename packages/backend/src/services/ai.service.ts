import { createUIMessageStream, type UIMessage } from "ai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { runClaude, type ClaudeStreamEvent } from "../lib/claude-runner";
import {
  collectPart,
  createAdapterState,
  writeClaudeEventToStream,
} from "../lib/claude-stream-adapter";
import { CHAT_ALLOWED_TOOLS, CHAT_DISALLOWED_TOOLS } from "../lib/claude-tools";
import { ensureMcpConfig } from "../lib/mcp-config";
import { createMessage } from "./message.service";
import { assembleChatDocs } from "./prompt.service";
import { resolveSessionCwd, updateSession, type getSession } from "./session.service";

interface StreamChatOptions {
  session: Awaited<ReturnType<typeof getSession>>;
  message: UIMessage;
}

async function buildSystemPrompt(session: StreamChatOptions["session"], branch: string) {
  const repo = session.repo;
  const repoLabel = repo ? `${repo.owner}/${repo.name}` : "none";

  const docsContent = await assembleChatDocs(repo?.id ?? null);

  let prompt = `You are the AI assistant inside nightshift — a self-hosted platform for running autonomous coding agents against GitHub repos.
  You're in an interactive chat session where the user explores code, plans work, and manages tasks before (optionally) handing execution off to autonomous ralph loops.

## Context

- **Session:** ${session.id}
- **Repo:** ${repoLabel}
- **Branch:** ${branch}

## How to collaborate

This is a conversation, not a batch job. The user wants to think alongside you.

- **Explore first.** When asked about code, architecture, or feasibility — read the files, then present a clear summary. Don't guess.
- **Plan visibly.** Before making changes, write a plan to \`.claude/plans/<name>.md\`. Nightshift auto-detects this and opens it in a side panel for review. Discuss and get approval before executing.
- **Stay scoped.** Make the changes the user asks for. Don't batch-create tasks, refactor surrounding code, or make sweeping changes without checking in first.
- **Be direct.** Lead with the answer or recommendation. Skip preamble.

## Available nightshift tools

You have MCP tools (prefixed \`mcp__openralph__\`) for interacting with nightshift:

**Tasks** — Create, list, update, and comment on tasks. Use these to break work into trackable units before kicking off loops.
**Docs** — Read context docs attached to the repo or globally. Check these for architecture decisions, conventions, or prior context.
**Sessions & Loops** — Get session state, list loops, and present loop configurations for user review.
**Git & PRs** — Push branches and create pull requests through nightshift so the UI tracks PR status.

### Tool rules

- For git push and PR operations, ALWAYS use nightshift MCP tools instead of running git/gh commands directly:
  - \`mcp__openralph__push_changes\` (sessionId: "${session.id}") instead of \`git push\`
  - \`mcp__openralph__create_pull_request\` (sessionId: "${session.id}") instead of \`gh pr create\`
- When the user wants to start a coding loop, use \`mcp__openralph__confirm_loop_details\` to present the config. The user will review and confirm in the nightshift UI before the loop starts.
- Check for context docs (\`mcp__openralph__list_docs\`) when starting work on an unfamiliar part of the codebase.`;

  if (docsContent) {
    prompt += `\n\n## Context Docs\n\n${docsContent}`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Shared: persist the user message
// ---------------------------------------------------------------------------

async function persistUserMessage(session: StreamChatOptions["session"], message: UIMessage) {
  try {
    const idParse = z.uuid().safeParse(message.id);
    await createMessage({
      ...(idParse.success ? { id: idParse.data } : {}),
      sessionId: session.id,
      role: message.role,
      parts: message.parts,
    });
  } catch (error) {
    console.error("[ai.service] Failed to save message:", error);
  }
}

// ---------------------------------------------------------------------------
// Chat streaming via Claude CLI
// ---------------------------------------------------------------------------

export function streamChat({ session, message }: StreamChatOptions) {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      if (message.role === "assistant") {
        return;
      }

      // Persist user message
      await persistUserMessage(session, message);

      // Resolve working directory
      const resolved = await resolveSessionCwd(session, { forceCheckout: true });
      if (!resolved) throw new Error("No working directory available for this session");
      const { cwd: worktreePath, branch } = resolved;

      // Extract user text from message
      const userText = message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      // Build CLI args
      const mcpConfig = await ensureMcpConfig();
      const systemPrompt = await buildSystemPrompt(session, branch);

      const args: string[] = [
        "--mcp-config",
        mcpConfig,
        "--allowedTools",
        CHAT_ALLOWED_TOOLS,
        "--disallowedTools",
        CHAT_DISALLOWED_TOOLS,
        "--system-prompt",
        systemPrompt,
        "--max-turns",
        "50",
      ];

      // Resume existing CLI session for multi-turn conversation
      if (session.claudeSessionId) {
        args.push("--resume", session.claudeSessionId);
      }

      // Set up streaming adapter
      const messageId = uuidv4();
      const adapterState = createAdapterState(messageId);
      const collectedParts: unknown[] = [];

      // Emit message start
      writer.write({ type: "start", messageId });
      writer.write({ type: "start-step" });
      adapterState.inStep = true;

      // Detect plan file reads/writes in the event stream
      const PLAN_PATH_RE = /(?:\.claude|\.nightshift)\/plans\/[^/]+\.md$/;
      const pendingPlanReads = new Map<string, string>(); // toolUseId → filePath

      function emitPlanData(filePath: string, content: string) {
        writer.write({
          type: "data-plan" as any,
          id: "plan",
          data: {
            filePath,
            title: filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Plan",
            content,
          },
          transient: true,
        });
      }

      function detectPlanEvent(event: ClaudeStreamEvent) {
        if (event.type === "tool_call") {
          const input = event.input as Record<string, unknown>;
          const filePath = input?.file_path;
          if (typeof filePath !== "string" || !PLAN_PATH_RE.test(filePath)) return;

          if (event.name === "Write") {
            emitPlanData(filePath, typeof input.content === "string" ? input.content : "");
          } else if (event.name === "Read" && event.toolUseId) {
            pendingPlanReads.set(event.toolUseId, filePath);
          }
        } else if (event.type === "tool_result") {
          const filePath = pendingPlanReads.get(event.toolUseId);
          if (filePath && !event.isError) {
            pendingPlanReads.delete(event.toolUseId);
            emitPlanData(filePath, event.content);
          }
        }
      }

      // Run Claude CLI
      const result = await runClaude({
        prompt: userText,
        cwd: worktreePath,
        timeoutSec: 600,
        args,
        onEvent: (event) => {
          detectPlanEvent(event);
          writeClaudeEventToStream(event, writer, adapterState);
          collectPart(event, collectedParts);
        },
        onLog: (line) => console.log(`[ai.service] ${line}`),
      });

      // Ensure step is closed and emit finish
      if (adapterState.inStep) {
        writer.write({ type: "finish-step" });
        adapterState.inStep = false;
      }
      writer.write({ type: "finish", finishReason: result.error ? "error" : "stop" });

      // Persist CLI session ID on first turn
      if (result.sessionId && !session.claudeSessionId) {
        await updateSession({ id: session.id, claudeSessionId: result.sessionId });
      }

      // Persist assistant message
      if (collectedParts.length > 0) {
        await createMessage({
          id: messageId,
          sessionId: session.id,
          role: "assistant",
          parts: collectedParts as UIMessage["parts"],
          metadata: result.usage
            ? { usage: result.usage, costUsd: result.costUsd, model: result.model }
            : undefined,
        });
      }

      if (result.error) {
        console.error("[ai.service] Claude CLI error:", result.error);
      }
    },
    onError: (error) => {
      console.error("[ai.service]", error);
      return "An error occurred while generating a response.";
    },
  });
}
