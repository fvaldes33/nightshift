/**
 * Centralized tool permission lists for Claude CLI invocations.
 *
 * Both ralph loops and chat sessions reference these so they stay in sync.
 * MCP tools use a wildcard (`mcp__openralph__*`) so new tools registered in
 * ralph-server.ts are automatically available without updating this file.
 */

// ---------------------------------------------------------------------------
// Core Claude Code tools (non-MCP)
// ---------------------------------------------------------------------------

const CORE_TOOLS = ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Skill"];

// ---------------------------------------------------------------------------
// Allowed tools
// ---------------------------------------------------------------------------

/** Tools allowed during interactive chat sessions */
export const CHAT_ALLOWED_TOOLS = [...CORE_TOOLS, "mcp__openralph__*"].join(",");

/** Tools allowed during autonomous ralph loop iterations */
export const RALPH_ALLOWED_TOOLS = [...CORE_TOOLS, "mcp__openralph__*"].join(",");

// ---------------------------------------------------------------------------
// Disallowed tools
// ---------------------------------------------------------------------------

/** Block destructive git/gh commands via Bash — force use of MCP tools */
export const CHAT_DISALLOWED_TOOLS = [
  "Bash(git push*)",
  "Bash(git remote*)",
  "Bash(gh pr create*)",
  "Bash(gh pr merge*)",
  "Bash(gh pr close*)",
  "Bash(git worktree *)",
  "Bash(git checkout *)",
].join(",");

/** Block destructive git/gh commands from ralph loop iterations */
export const RALPH_DISALLOWED_TOOLS = [
  "Bash(git push*)",
  "Bash(git remote*)",
  "Bash(gh pr create*)",
  "Bash(gh pr merge*)",
  "Bash(gh pr close*)",
  "Bash(git worktree *)",
  "Bash(git checkout *)",
].join(",");
