import { createUIMessageStream, type UIMessage } from "ai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { runClaude } from "../lib/claude-runner";
import {
  collectPart,
  createAdapterState,
  writeClaudeEventToStream,
} from "../lib/claude-stream-adapter";
import { ensureMcpConfig } from "../lib/mcp-config";
import { createMessage } from "./message.service";
import { resolveSessionCwd, updateSession, type getSession } from "./session.service";

interface StreamChatOptions {
  session: Awaited<ReturnType<typeof getSession>>;
  message: UIMessage;
}

const SYSTEM_PROMPT = `You are nightshift, an AI coding assistant.`;

function buildSystemPrompt(session: StreamChatOptions["session"], branch: string) {
  const repo = session.repo;
  return `${SYSTEM_PROMPT}
Repo: ${repo ? `${repo.owner}/${repo.name}` : "none"} | Branch: ${branch}

Be conversational. When the user asks you to evaluate, explore, or plan something:
1. Run your exploration, then present what you found in a clear summary.
2. Discuss your findings and recommendations with the user.
3. Wait for the user to confirm or adjust before taking action (e.g. creating tasks, writing code).

Never batch-create tasks or make sweeping changes without checking in first. Work collaboratively — the user wants to be part of the decision-making, not just handed a finished result.

You have tools to explore the repo, create and manage tasks, and work with code. Use them thoughtfully.

IMPORTANT: For git push and pull request operations, ALWAYS use the nightshift MCP tools instead of running git/gh commands directly:
- Use mcp__openralph__push_changes (with sessionId: "${session.id}") instead of \`git push\`
- Use mcp__openralph__create_pull_request (with sessionId: "${session.id}") instead of \`gh pr create\`
These tools update the nightshift UI with PR status. Direct git/gh commands bypass nightshift tracking.

When the user wants to start a coding loop, use the confirm_loop_details tool to present the config. The user will review and confirm in the nightshift UI before the loop starts.`;
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
  "mcp__openralph__get_session",
  "mcp__openralph__list_loops",
  "mcp__openralph__get_loop",
  "mcp__openralph__push_changes",
  "mcp__openralph__create_pull_request",
  "mcp__openralph__confirm_loop_details",
].join(",");

// Block git push/PR commands via Bash — force Claude to use MCP tools instead
const CHAT_DISALLOWED_TOOLS = [
  "Bash(git push*)",
  "Bash(git remote*)",
  "Bash(gh pr *)",
  "Bash(gh api *)",
].join(",");

export function streamChat({ session, message }: StreamChatOptions) {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      // Persist user message
      await persistUserMessage(session, message);

      // Resolve working directory
      const resolved = await resolveSessionCwd(session);
      if (!resolved) throw new Error("No working directory available for this session");
      const { cwd: worktreePath, branch } = resolved;

      // Extract user text from message
      const userText = message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");

      // Build CLI args
      const mcpConfig = await ensureMcpConfig();
      const systemPrompt = buildSystemPrompt(session, branch);

      const args: string[] = [
        "--mcp-config", mcpConfig,
        "--allowedTools", CHAT_ALLOWED_TOOLS,
        "--disallowedTools", CHAT_DISALLOWED_TOOLS,
        "--system-prompt", systemPrompt,
        "--max-turns", "50",
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
