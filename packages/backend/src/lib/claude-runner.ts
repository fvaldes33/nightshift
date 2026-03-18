import { spawn, type ChildProcess } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeRunOptions {
  prompt: string;
  cwd: string;
  /** CLI args passed after `claude` (e.g. `--mcp-config`, `--allowedTools`) */
  args?: string[];
  /** Timeout in seconds. Default: 300 (5 min) */
  timeoutSec?: number;
  /** Grace period after SIGTERM before SIGKILL. Default: 10 */
  graceSec?: number;
  /** Called for each parsed stream-json event */
  onEvent?: (event: ClaudeStreamEvent) => void;
  /** Called for each stderr line */
  onLog?: (line: string) => void;
}

export interface ClaudeRunResult {
  exitCode: number;
  timedOut: boolean;
  sessionId: string | null;
  model: string | null;
  summary: string;
  costUsd: number | null;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number } | null;
  error: string | null;
}

export type ClaudeStreamEvent =
  | { type: "init"; sessionId: string; model: string }
  | { type: "assistant"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; name: string; toolUseId: string | null; input: unknown }
  | { type: "tool_result"; toolUseId: string; content: string; isError: boolean }
  | { type: "result"; text: string; usage: ClaudeRunResult["usage"]; costUsd: number | null };

// ---------------------------------------------------------------------------
// Env: strip vars that interfere with spawned claude processes
// ---------------------------------------------------------------------------

const STRIP_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  // Claude Code nesting guards — stripping these allows spawned processes
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_SESSION",
  "CLAUDE_CODE_PARENT_SESSION",
];

function buildEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  for (const key of STRIP_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

// ---------------------------------------------------------------------------
// Parse a single line of stream-json output
// ---------------------------------------------------------------------------

export function parseStreamLine(line: string): ClaudeStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const type = typeof event.type === "string" ? event.type : "";

  // system/init
  if (type === "system" && event.subtype === "init") {
    return {
      type: "init",
      sessionId: typeof event.session_id === "string" ? event.session_id : "",
      model: typeof event.model === "string" ? event.model : "",
    };
  }

  // assistant message blocks
  if (type === "assistant") {
    const message = asRecord(event.message);
    const content = Array.isArray(message?.content) ? message.content : [];
    const events: ClaudeStreamEvent[] = [];

    for (const block of content) {
      const b = asRecord(block);
      if (!b) continue;
      const blockType = typeof b.type === "string" ? b.type : "";

      if (blockType === "text" && typeof b.text === "string" && b.text) {
        events.push({ type: "assistant", text: b.text });
      } else if (blockType === "thinking" && typeof b.thinking === "string" && b.thinking) {
        events.push({ type: "thinking", text: b.thinking });
      } else if (blockType === "tool_use") {
        events.push({
          type: "tool_call",
          name: typeof b.name === "string" ? b.name : "unknown",
          toolUseId: typeof b.id === "string" ? b.id : null,
          input: b.input ?? {},
        });
      }
    }
    // Return first event (caller gets one event per line; multi-block is rare)
    return events[0] ?? null;
  }

  // user message (tool results)
  if (type === "user") {
    const message = asRecord(event.message);
    const content = Array.isArray(message?.content) ? message.content : [];

    for (const block of content) {
      const b = asRecord(block);
      if (!b || b.type !== "tool_result") continue;

      let text = "";
      if (typeof b.content === "string") {
        text = b.content;
      } else if (Array.isArray(b.content)) {
        text = b.content
          .map((p: unknown) => (asRecord(p) as any)?.text ?? "")
          .filter(Boolean)
          .join("\n");
      }

      return {
        type: "tool_result",
        toolUseId: typeof b.tool_use_id === "string" ? b.tool_use_id : "",
        content: text,
        isError: b.is_error === true,
      };
    }
  }

  // result
  if (type === "result") {
    const usageObj = asRecord(event.usage);
    const usage = usageObj
      ? {
          inputTokens: asNum(usageObj.input_tokens),
          outputTokens: asNum(usageObj.output_tokens),
          cachedTokens: asNum(usageObj.cache_read_input_tokens),
        }
      : null;
    const costRaw = event.total_cost_usd;
    const costUsd = typeof costRaw === "number" && Number.isFinite(costRaw) ? costRaw : null;

    return {
      type: "result",
      text: typeof event.result === "string" ? event.result : "",
      usage,
      costUsd,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auth error detection
// ---------------------------------------------------------------------------

const AUTH_RE =
  /not\s+logged\s+in|please\s+log\s+in|please\s+run\s+`?claude\s+login`?|login\s+required|requires\s+login|unauthorized|authentication\s+required/i;

export function detectAuthError(stdout: string, stderr: string): boolean {
  return AUTH_RE.test(stdout) || AUTH_RE.test(stderr);
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export function runClaude(opts: ClaudeRunOptions): Promise<ClaudeRunResult> {
  const {
    prompt,
    cwd,
    args: extraArgs = [],
    timeoutSec = 300,
    graceSec = 10,
    onEvent,
    onLog,
  } = opts;

  return new Promise((resolve, reject) => {
    const hasMcpConfig = extraArgs.includes("--mcp-config");

    const args = [
      "--print", "-",
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      // Only load MCP servers from the explicit --mcp-config, ignore user/project configs
      ...(hasMcpConfig ? ["--strict-mcp-config"] : []),
      ...extraArgs,
    ];

    const child = spawn("claude", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: buildEnv(),
    });

    // Pipe prompt via stdin
    child.stdin.write(prompt);
    child.stdin.end();

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let sessionId: string | null = null;
    let model: string | null = null;
    let lastAssistantText = "";
    let costUsd: number | null = null;
    let usage: ClaudeRunResult["usage"] = null;
    let lineBuffer = "";

    // Parse stream-json line by line
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      lineBuffer += chunk;

      let newlineIdx: number;
      while ((newlineIdx = lineBuffer.indexOf("\n")) !== -1) {
        const line = lineBuffer.slice(0, newlineIdx);
        lineBuffer = lineBuffer.slice(newlineIdx + 1);

        const event = parseStreamLine(line);
        if (!event) continue;

        if (event.type === "init") {
          sessionId = event.sessionId;
          model = event.model;
        } else if (event.type === "assistant") {
          lastAssistantText = event.text;
        } else if (event.type === "result") {
          // result.text is the authoritative summary; fall back to last assistant text
          lastAssistantText = event.text || lastAssistantText;
          usage = event.usage;
          costUsd = event.costUsd;
        }

        onEvent?.(event);
      }
    });

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      const lines = chunk.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) onLog?.(trimmed);
      }
    });

    // Timeout: SIGTERM → grace → SIGKILL
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    const timeoutTimer = timeoutSec > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          killTimer = setTimeout(() => {
            if (!child.killed) child.kill("SIGKILL");
          }, graceSec * 1000);
        }, timeoutSec * 1000)
      : null;

    child.on("error", (err) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      reject(err);
    });

    child.on("close", (code) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);

      const exitCode = code ?? 1;
      let error: string | null = null;

      if (timedOut) {
        error = `Timed out after ${timeoutSec}s`;
      } else if (exitCode !== 0) {
        if (detectAuthError(stdout, stderr)) {
          error = "Claude auth required — run `claude login`";
        } else {
          error = `Claude exited with code ${exitCode}: ${stderr.slice(0, 500)}`;
        }
      }

      resolve({
        exitCode,
        timedOut,
        sessionId,
        model,
        summary: lastAssistantText,
        costUsd,
        usage,
        error,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
