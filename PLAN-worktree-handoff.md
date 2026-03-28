# Plan: Worktree Handoff & Management

## Problems

### 1. Stale worktree path
`sessions.worktreePath` points to a directory that no longer exists. `resolveSessionCwd()` returns a dead path. Chat and loops break silently.

### 2. Claude session is path-scoped
Claude Code stores session data at `~/.claude/projects/{encoded-cwd}/`. When worktree is gone and cwd changes, `--resume <sessionId>` can't find the JSONL because Claude looks under the new cwd's project dir. Chat goes dark.

### 3. Claude/Ralph can bypass worktree management
`Bash(git worktree *)` is not blocked. Either agent can create/remove worktrees outside nightshift's control.

---

## Design

### Handoff flow
User clicks "Handoff" → nightshift transitions the worktree session back to the main repo checkout.

1. **Checkout branch in main repo** — `git checkout <session.branch>` in `repo.localPath`
2. **Remove worktree** — `git worktree remove <worktreePath> --force` (skip if already gone)
3. **Migrate Claude session** — scan `~/.claude/projects/` for the encoded worktree dir, copy the `{claudeSessionId}.jsonl` file to the main repo's project dir. If not found, clear `claudeSessionId` (fresh session on next message, nightshift message history preserved).
4. **Update session DB** — `worktreePath = null`, `workspaceMode = "local"`, update `claudeSessionId` if migration succeeded

### Auto-reattach (existing behavior, hardened)
`resolveSessionCwd()` already lazily creates worktrees. Add a health check: if `worktreePath` is set but path doesn't exist, log a warning, clear `worktreePath`, and let the lazy creation recreate it.

---

## Tasks

### 1. Block git worktree commands from Claude/Ralph
**File:** `packages/backend/src/lib/claude-tools.ts`

- Add `"Bash(git worktree *)"` and `"Bash(git checkout *)"` to `CHAT_DISALLOWED_TOOLS`
- Export a new `RALPH_DISALLOWED_TOOLS` with the same patterns
- Wire `RALPH_DISALLOWED_TOOLS` into `ralph.job.ts` via `--disallowedTools` flag

### 2. Workspace service: handoff + Claude session migration
**File:** `packages/backend/src/services/workspace.service.ts`

New functions:
- `isWorktreeHealthy(worktreePath: string): boolean` — check path exists + is valid git dir
- `handoffWorktree(repoDir, worktreePath, branch)` — checkout branch in main repo, remove worktree (tolerant of already-removed)
- `migrateClaudeSession(fromCwd, toCwd, claudeSessionId)` — readdir `~/.claude/projects/`, find dir matching encoded `fromCwd`, copy `{sessionId}.jsonl` to dir matching encoded `toCwd` (create if needed). Return boolean success.

### 3. Session service: handoff orchestration + health check
**File:** `packages/backend/src/services/session.service.ts`

- `handoffSession(sessionId)` — validate worktree mode → call handoffWorktree → call migrateClaudeSession → update session DB
- Harden `resolveSessionCwd()` — if worktreePath is set but doesn't exist on disk, clear it from DB and let lazy creation handle it

### 4. tRPC router: handoff endpoint
**File:** `packages/backend/src/routers/session.router.ts`

- Add `handoff` mutation — calls `handoffSession()`, returns updated session

### 5. MCP server: handoff tool
**File:** `packages/backend/src/mcp/ralph-server.ts`

- Add `handoff_worktree` tool — takes `sessionId`, calls `handoffSession()`. Allows ralph/chat agents to trigger handoff when a loop finishes.

### 6. UI: Handoff button on session page
**File:** `apps/web/app/routes/sessions/session.tsx`

- Add "Handoff" button in action bar, next to PR button
- Only visible when `workspaceMode === "worktree"`
- Calls `session.handoff` mutation
- Shows confirmation dialog (warns if main repo has uncommitted changes)

### 7. UI: Handoff button on loop header + properties
**Files:** `apps/web/app/components/loops/loop-header.tsx`, `loop-properties.tsx`

- Same button pattern as session page
- Reads from `loop.session.workspaceMode`

---

## Edge cases

| Scenario | Behavior |
|---|---|
| Main repo has dirty working tree | Abort handoff with error message |
| Worktree already gone | Skip remove, proceed with DB update + branch checkout |
| Branch doesn't exist locally | `git fetch` first, then checkout |
| Claude session JSONL not found | Clear `claudeSessionId`, fresh session on next message |
| Another local-mode session on same repo | Show warning that branch will change |

---

## Files touched

| File | Change |
|---|---|
| `packages/backend/src/lib/claude-tools.ts` | Add worktree/checkout to disallowed, export RALPH_DISALLOWED_TOOLS |
| `packages/backend/src/jobs/ralph.job.ts` | Wire disallowed tools into iteration args |
| `packages/backend/src/services/workspace.service.ts` | Add handoff, health check, claude session migration |
| `packages/backend/src/services/session.service.ts` | Add handoffSession, harden resolveSessionCwd |
| `packages/backend/src/routers/session.router.ts` | Add handoff mutation |
| `packages/backend/src/mcp/ralph-server.ts` | Add handoff_worktree tool |
| `apps/web/app/routes/sessions/session.tsx` | Handoff button |
| `apps/web/app/components/loops/loop-header.tsx` | Handoff button |
| `apps/web/app/components/loops/loop-properties.tsx` | Handoff status/action |
