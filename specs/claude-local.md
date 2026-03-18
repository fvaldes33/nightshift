# Claude Local Chat

## Problem

The interactive chat (`ai.service.streamChat`) uses the Vercel AI SDK `streamText` with Anthropic/Groq API providers, which burns API tokens. Meanwhile, ralph loops already run via the Claude CLI subprocess (`claude-runner.ts`) using Claude Max auth at zero per-token cost. The chat should work the same way.

## Approach

Replace `streamText` with `runClaude` in `ai.service.ts`. Translate Claude CLI `stream-json` events into UIMessageStream chunks via `writer.write()`, so the frontend chat UI works unchanged.

### Event mapping

| Claude CLI Event | UIMessageStream Chunks |
|---|---|
| `assistant` | `text-start` → `text-delta` → `text-end` |
| `thinking` | `reasoning-start` → `reasoning-delta` → `reasoning-end` |
| `tool_call` | `tool-input-start` → `tool-input-available` |
| `tool_result` | `tool-output-available` / `tool-output-error` |
| `result` | `finish` |

### What changes

- `streamChat` calls `runClaude` instead of `streamText`
- `onEvent` callback translates each CLI event into the corresponding `writer.write()` calls
- Multi-turn context handled via Claude CLI `--session-id` (stored on session model) instead of passing full message arrays
- Tools configured via `--allowedTools` and `--mcp-config` flags

### What stays the same

- `createUIMessageStream` wrapper and `writer` — same streaming transport to the frontend
- Frontend `useChat`, message rendering, `onData` callbacks — completely unchanged
- Message persistence in `onFinish` — still saves assistant messages to DB

## Tradeoffs

- **No token-by-token streaming** — CLI `stream-json` emits complete events per turn, so text appears all at once rather than typewriter-style. Tool activity still streams in real-time.
- **Different tool set** — Claude Code's native tools (Read, Write, Edit, Bash, Glob, Grep) instead of custom AI SDK tools. Custom tools available via MCP config.
- **Session model change** — Need to store a `claudeSessionId` on the session to support `--session-id` for conversation continuity.

## Open questions

1. **Tool scope** — Native Claude Code filesystem tools, custom MCP tools (task management, etc.), or both? Control with `--allowedTools` and `--mcp-config`.
2. **Step boundaries** — `stream-json` doesn't emit explicit step markers. Need to infer from the tool_call → tool_result → assistant sequence, or emit `start-step`/`finish-step` manually.
3. **Fallback** — Keep `streamText` path for Groq/other providers that don't have a CLI equivalent? Could be a per-session toggle (provider = "claude-local" vs "anthropic" vs "groq").
4. **Typewriter UX** — Could mitigate the lack of token streaming by showing real-time tool activity via `data-*` events (already done for exploration) so the user sees progress between text chunks.
