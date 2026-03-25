import { createAnthropicLLM, createGroqLLM } from "@openralph/ai/models";
import {
  convertToModelMessages,
  createUIMessageStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { runClaude } from "../lib/claude-runner";
import {
  collectPart,
  createAdapterState,
  writeClaudeEventToStream,
} from "../lib/claude-stream-adapter";
import { AgentContext } from "../lib/context";
import { ensureMcpConfig } from "../lib/mcp-config";
import { allTools } from "../tools/index";
import { getGitHubToken } from "./account.service";
import { createMessage } from "./message.service";
import { ensureWorktree, updateSession, type getSession } from "./session.service";

interface StreamChatOptions {
  session: Awaited<ReturnType<typeof getSession>>;
  message: UIMessage;
}

const SYSTEM_PROMPT = `You are nightshift, an AI coding assistant.`;

function buildSystemPrompt(session: StreamChatOptions["session"]) {
  const repo = session.repo;
  return `${SYSTEM_PROMPT}
Repo: ${repo ? `${repo.owner}/${repo.name}` : "none"} | Branch: ${session.branch ?? "main"}

Be conversational. When the user asks you to evaluate, explore, or plan something:
1. Run your exploration, then present what you found in a clear summary.
2. Discuss your findings and recommendations with the user.
3. Wait for the user to confirm or adjust before taking action (e.g. creating tasks, writing code).

Never batch-create tasks or make sweeping changes without checking in first. Work collaboratively — the user wants to be part of the decision-making, not just handed a finished result.

You have tools to explore the repo, create and manage tasks, and work with code. Use them thoughtfully.`;
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
// Shared: reconstruct UIMessages from DB messages for AI SDK path
// ---------------------------------------------------------------------------

function toUIMessages(session: Awaited<ReturnType<typeof getSession>>): UIMessage[] {
  return session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.parts as UIMessage["parts"],
      createdAt: m.createdAt,
    }));
}

// ---------------------------------------------------------------------------
// Main entry: branch by provider
// ---------------------------------------------------------------------------

export function streamChat(opts: StreamChatOptions) {
  if (opts.session.provider === "anthropic") {
    return streamChatWithClaude(opts);
  }
  return streamChatWithAISDK(opts);
}

// ---------------------------------------------------------------------------
// Claude CLI path (zero-cost via Claude Max)
// ---------------------------------------------------------------------------

const CHAT_ALLOWED_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Bash",
  "Glob",
  "Grep",
  "mcp__openralph__list_tasks",
  "mcp__openralph__get_task",
  "mcp__openralph__create_task",
  "mcp__openralph__update_task",
  "mcp__openralph__add_task_comment",
].join(",");

function streamChatWithClaude({ session, message }: StreamChatOptions) {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      // Persist user message
      await persistUserMessage(session, message);

      // Resolve working directory
      const worktreePath = await ensureWorktree(session);
      if (!worktreePath) throw new Error("No worktree path available for this session");

      // Extract user text from message
      const userText = message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      // Build CLI args
      const mcpConfig = await ensureMcpConfig();
      const systemPrompt = buildSystemPrompt(session);

      const args: string[] = [
        "--mcp-config", mcpConfig,
        "--allowedTools", CHAT_ALLOWED_TOOLS,
        "--model", session.model,
        "--system-prompt", systemPrompt,
        "--max-turns", "25",
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

      // Run Claude CLI
      const result = await runClaude({
        prompt: userText,
        cwd: worktreePath,
        timeoutSec: 600,
        args,
        onEvent: (event) => {
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

// ---------------------------------------------------------------------------
// AI SDK path (Groq / other API providers)
// ---------------------------------------------------------------------------

function streamChatWithAISDK({ session, message }: StreamChatOptions) {
  const systemPrompt = buildSystemPrompt(session);

  return createUIMessageStream({
    execute: async ({ writer }) => {
      const githubToken = await getGitHubToken({});

      // Persist user message
      await persistUserMessage(session, message);

      // Reconstruct full message history from DB + new message
      const previousMessages = toUIMessages(session);
      const messages = [...previousMessages, message];

      // Recreate worktree if it was cleaned up
      const worktreePath = await ensureWorktree(session);

      const agentState = {
        githubToken,
        sessionId: session.id,
        repoId: session.repoId,
        repoOwner: session.repo?.owner ?? null,
        repoName: session.repo?.name ?? null,
        branch: session.branch,
        worktreePath,
      };

      const modelMessages = await convertToModelMessages(messages);

      const groq = createGroqLLM();
      const model = groq(session.model);

      const result = AgentContext.with({ ...agentState, writer }, () =>
        streamText({
          model,
          system: systemPrompt,
          messages: modelMessages,
          providerOptions: {
            anthropic: {
              thinking: { type: "enabled", budgetTokens: 10000 },
            },
          },
          tools: allTools,
          stopWhen: stepCountIs(10),
        }),
      );

      const existingIds = new Set(messages.map((m) => m.id));

      writer.merge(
        result.toUIMessageStream({
          generateMessageId: () => uuidv4(),
          originalMessages: messages,
          async onFinish({ messages: allMsgs }) {
            for (const msg of allMsgs) {
              if (existingIds.has(msg.id)) continue;

              try {
                const idParse = z.uuid().safeParse(msg.id);
                await createMessage({
                  ...(idParse.success ? { id: idParse.data } : {}),
                  sessionId: session.id,
                  role: msg.role,
                  parts: msg.parts,
                });
              } catch (error) {
                console.error("[ai.service] Failed to save assistant message:", error);
              }
            }
          },
        }),
      );
    },
    onError: (error) => {
      console.error("[ai.service]", error);
      return "An error occurred while generating a response.";
    },
  });
}
