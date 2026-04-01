# Team Agent Architecture Plan

## Context

OpenRalph currently runs as a single-user local app: Express + React Router 7 SSR + pgBoss + Claude CLI all in one process on one machine, exposed via Tailscale. The goal is to transform it into a team-friendly product where:

- **Hosted web app** (Render/Fly/etc): UI + API + DB + pgBoss (job creation & state)
- **Local agent** (Tauri tray app): Claude CLI execution + git operations + MCP server
- **Communication**: Agent <-> Server via WebSocket; presence tracking; dual invocation (chat + jobs)

**Key decisions (confirmed):**
- Multi-org model (users can belong to multiple orgs, org switcher in UI)
- MCP server connects to remote Supabase directly via DATABASE_URL (zero changes to ralph-server.ts)
- Team mode only (no local-only fallback)
- Tauri for the tray/agent app

---

## Phase 1: Org/Team Model + Agent Tokens

### 1.1 New DB Models

**`packages/db/src/models/org.model.ts`** — BetterAuth organization plugin tables (defined in Drizzle so we can query them):

| Table | Columns |
|-------|---------|
| `organization` | id, name, slug (unique), logo, createdAt, updatedAt |
| `member` | id, organizationId (FK), userId (FK), role ("owner"\|"admin"\|"member"), createdAt |
| `invitation` | id, organizationId (FK), email, role, status ("pending"\|"accepted"\|"rejected"\|"canceled"), inviterId (FK), expiresAt, createdAt |

**`packages/db/src/models/agent-token.model.ts`** — Long-lived API tokens for agent auth:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | text FK -> user | Token owner |
| orgId | text FK -> organization | Scoped to org |
| name | text | e.g. "Franco's MacBook Pro" |
| tokenHash | text unique | SHA-256 of raw token |
| tokenPrefix | text | e.g. "nsa_7f3k" for display |
| lastUsedAt | timestamptz | Updated on use (fire-and-forget) |
| expiresAt | timestamptz nullable | null = never expires |
| createdAt | timestamptz | |

Token format: `nsa_<base64url-32-bytes>` (~50 chars). Raw token shown once at creation. Only hash stored.

### 1.2 Add `orgId` to Data Tables

Add `orgId text NOT NULL FK -> organization` + index to:
- `repos`
- `sessions` (app sessions, not auth sessions)
- `tasks`
- `loops`
- `docs`

**NOT** `messages` or `loop_events` — these are scoped via their parent (session/loop).

Also add `activeOrganizationId text` to the BetterAuth `session` table (required by org plugin).

### 1.3 Migration Strategy

1. Update Drizzle models with new tables + columns (orgId nullable initially)
2. Add BetterAuth `organization` + `bearer` plugins to auth config
3. Run `bun run db:generate` for the migration
4. Add manual backfill SQL into the migration:
   - Create a "Personal" org for each existing user
   - Create owner membership for each
   - Backfill `orgId` on all data tables (assign to the user's personal org)
5. ALTER columns to NOT NULL
6. `bun run db:push` or `bun run db:migrate`

### 1.4 BetterAuth Plugin Setup

**`packages/backend/src/lib/auth.ts`**:
```ts
import { organization } from "better-auth/plugins/organization";
import { bearer } from "better-auth/plugins/bearer";

plugins: [
  organization({ allowUserToCreateOrganization: true, creatorRole: "owner" }),
  bearer(),
]
```

**`apps/web/app/lib/auth-client.ts`** — add `organizationClient()` plugin for `useActiveOrganization`, `useListOrganizations`, `orgApi.setActive()`.

### 1.5 Extend ActorContext

**`packages/backend/src/lib/context.ts`**:

```ts
interface UserActor {
  type: "user";
  properties: { user: User; orgId: string; orgRole: string; };
}

interface AgentActor {
  type: "agent";
  properties: { user: User; orgId: string; tokenId: string; };
}

type Actor = PublicActor | UserActor | AgentActor;
```

Add `requireOrgId()` helper that extracts orgId from actor or throws.

### 1.6 Actor Resolution Middleware

**`apps/web/server/app.ts`** — refactor the inline actor creation into a `resolveActor(req)` function:

1. Check `Authorization: Bearer nsa_*` header -> validate against `agent_tokens` table -> return `AgentActor`
2. Fall back to BetterAuth session cookie -> read `activeOrganizationId` from session -> look up membership for role -> return `UserActor`
3. No auth -> return `PublicActor`

Used by both `/api/trpc` and `/api/chat` handlers.

### 1.7 Scope All Services

Every service that queries data tables adds `eq(table.orgId, orgId)` to WHERE clauses:
- **List**: filter by orgId
- **Create**: inject orgId into insert values
- **Get/Update/Delete**: verify record's orgId matches actor's orgId

Files to modify:
- `packages/backend/src/services/repo.service.ts`
- `packages/backend/src/services/session.service.ts`
- `packages/backend/src/services/task.service.ts`
- `packages/backend/src/services/loop.service.ts`
- `packages/backend/src/services/doc.service.ts`

### 1.8 Update `protectedProcedure`

**`packages/backend/src/lib/trpc.ts`** — accept both "user" and "agent" actors, enforce orgId is set.

### 1.9 New Routers

- **`packages/backend/src/routers/agent-token.router.ts`** — list, create (returns raw token once), revoke
- **`packages/backend/src/routers/org.router.ts`** — listMembers, invite (thin wrapper, BetterAuth handles most org CRUD via `/api/auth/organization/*`)
- Register both in `appRouter`

### 1.10 Frontend

- **Org switcher** in sidebar header (`apps/web/app/routes/app-layout.tsx`) — uses `useListOrganizations` + `useActiveOrganization`. Changing org calls `orgApi.setActive()`.
- **Org creation flow** — on first login, prompt to create or join an org
- **Agent token management** — new settings page `/settings/tokens` with create/list/revoke
- **Supabase Realtime scoping** — update `use-realtime-invalidation.ts` to filter `postgres_changes` by orgId

### 1.11 MCP Server Org Context

The MCP server (`ralph-server.ts`) uses `ActorContext.use()` to get the user. In the new model, the MCP server runs on the agent's machine with a direct DB connection. It needs to know the orgId.

Approach: Pass `ORG_ID` as an env var in the MCP config (alongside `DATABASE_URL`). The MCP server reads it and sets up an `ActorContext` with the org. The `ensureMcpConfig()` function (which moves to the agent) includes this env var.

---

## Phase 2: WebSocket Layer

### 2.1 Protocol

Typed envelope messages over WebSocket. All messages have `type` + optional `correlationId`.

**Server -> Agent:**
| type | purpose |
|------|---------|
| `chat:request` | User sent a message — run Claude CLI. Payload: sessionId, message, systemPrompt, cwd, branch, claudeSessionId, mcpConfig args |
| `chat:cancel` | User clicked stop. Payload: sessionId |
| `job:dispatch` | pgBoss job ready. Payload: jobId, jobType, data, cwd, mcpConfig args |
| `job:cancel` | Cancel running job. Payload: jobId |
| `agent:ping` | Keepalive |

**Agent -> Server:**
| type | purpose |
|------|---------|
| `agent:register` | First message after connect. Payload: userId, orgId, hostname, version |
| `agent:pong` | Keepalive response |
| `chat:event` | Streaming ClaudeStreamEvent. Payload: sessionId, event |
| `chat:result` | Chat completed. Payload: sessionId, result (ClaudeRunResult), collectedParts |
| `chat:error` | Chat failed. Payload: sessionId, error |
| `job:accepted` | Agent acknowledges dispatch. Payload: jobId |
| `job:progress` | Loop event. Payload: jobId, iteration, event (ClaudeStreamEvent) |
| `job:complete` | Job done. Payload: jobId, result |
| `job:failed` | Job failed. Payload: jobId, error |

### 2.2 Shared Protocol Types

**`packages/common/src/ws-protocol.ts`** — TypeScript discriminated union types for all messages. Imported by both server and agent.

### 2.3 Server-Side WS Infrastructure

New files in `packages/backend/src/ws/`:
- **`ws-server.ts`** — Attach `ws` WebSocket server to the Express HTTP server. Authenticate on upgrade (validate agent token from query param or first message). Register connection in AgentRegistry.
- **`agent-connection.ts`** — Wraps a single WS connection. Handles send/receive, heartbeat, reconnect detection.
- **`agent-registry.ts`** — `Map<userId, AgentConnection[]>`. Methods: `getAgentForUser(userId)`, `isOnline(userId)`, `dispatch(userId, message)`, `waitForResponse(correlationId, timeoutMs)`.

Integration in `apps/web/server.js`: pass the HTTP `server` object to `createWSServer()` after `app.listen()`.

### 2.4 Agent Status

In-memory via `AgentRegistry` is sufficient. Expose via tRPC:
- **`packages/backend/src/routers/agent.router.ts`** — `getStatus` returns online/offline for current user's agent(s)
- Frontend shows green/red dot next to user avatar or in sidebar

---

## Phase 3: Chat Streaming Refactor

### 3.1 New Flow

```
Browser -> POST /api/chat -> streamChatViaAgent() -> WS chat:request -> Agent
Agent -> runClaude() -> onEvent -> WS chat:event -> Server
Server -> writeClaudeEventToStream() + collectPart() -> SSE -> Browser
Agent -> WS chat:result -> Server persists assistant message
```

### 3.2 Implementation

**`packages/backend/src/services/ai.service.ts`** — add `streamChatViaAgent()`:

1. Persist user message (reuse existing code)
2. Build system prompt + CLI args (reuse existing `buildSystemPrompt`, `assembleChatDocs`)
3. Send `chat:request` to agent via `AgentRegistry.dispatch(userId, msg)`
4. Listen for `chat:event` messages keyed by `sessionId`
5. Each event feeds into existing `writeClaudeEventToStream()` + `collectPart()` pipeline (no changes to adapter)
6. On `chat:result` — persist assistant message, close stream
7. On `chat:error` — emit error, close stream

**`apps/web/server/app.ts`** — `/api/chat` handler checks agent online status:
- Agent online -> `streamChatViaAgent()`
- Agent offline -> return 503 with "Agent offline" error (UI shows status)

### 3.3 Agent-Side Chat Handler

**`apps/agent/src/handlers/chat.handler.ts`**:
1. Receive `chat:request`
2. Resolve workspace locally (clone/worktree if needed)
3. Write MCP config locally (pointing to remote DB)
4. Call `runClaude()` with provided args
5. `onEvent` callback sends each event as `chat:event` via WS
6. On completion, send `chat:result` with result + collected parts

---

## Phase 4: Job Dispatch Refactor

### 4.1 New Flow

```
tRPC loop.start -> pgBoss send -> worker picks up
  -> AgentRegistry.dispatch(userId, job:dispatch) -> Agent
Agent -> job:accepted -> runs Claude CLI iterations locally
  -> job:progress (loop events) -> Server inserts to DB
  -> job:complete -> Server updates loop status
```

### 4.2 Implementation

**`packages/backend/src/jobs/ralph.job.ts`** — refactor both queue workers:

**`ralphLoopQueue.work()`**:
1. Fetch loop data (unchanged)
2. Check agent online via `AgentRegistry.isOnline(userId)` — derive userId from loop's session/repo org membership
3. If offline: set loop to `failed` with "Agent offline" message (or keep `queued` and retry with delay)
4. If online: send `job:dispatch` with jobType `ralph/loop`
5. Wait for `job:accepted` (10s timeout)
6. pgBoss job completes — agent now owns execution

**Server-side WS handler** (`packages/backend/src/ws-handlers/job-ws.handler.ts`):
- `job:progress` -> call `insertLoopEvent()` + `updateLoop()` (same as current inline code)
- `job:complete` -> `updateLoop({ status: "complete" })`
- `job:failed` -> `updateLoop({ status: "failed" })`

**Agent-side job handler**:
1. Receive `job:dispatch`
2. Send `job:accepted`
3. Execute the full ralph loop logic locally (ensure workspace, resolve cwd, iterate with runClaude)
4. Send `job:progress` for each ClaudeStreamEvent
5. After each iteration, check remaining tasks (query DB directly)
6. Send `job:complete` or `job:failed`

### 4.3 Offline Handling

- **Chat**: UI shows "Agent offline — start your agent to chat" with a link to download instructions
- **Jobs**: pgBoss job stays `queued`. When agent reconnects, server pushes queued jobs. Use `expireInMinutes` on pgBoss jobs (e.g. 60 min) — expired jobs marked failed with "Agent was offline"

---

## Phase 5: Tauri Agent App

### 5.1 Project Structure

New workspace entry: `apps/agent/`

```
apps/agent/
  package.json              # bun workspace package
  src-tauri/
    Cargo.toml              # Rust dependencies (tauri, ws, etc.)
    tauri.conf.json         # Tauri config (tray, no window)
    src/
      main.rs               # Tauri entry, tray setup, sidecar management
      tray.rs                # Tray icon, context menu (status, config, quit)

  src/                       # TypeScript sidecar (the actual agent logic)
    main.ts                  # Entry point — WS client + message router
    config.ts                # Reads/writes agent config (server URL, token, workspace dir)

    connection/
      ws-client.ts           # WebSocket client with auto-reconnect + heartbeat
      message-router.ts      # Routes incoming WS messages to handlers

    handlers/
      chat.handler.ts        # chat:request -> runClaude -> chat:event/result
      job.handler.ts         # job:dispatch -> ralph loop execution -> job:progress/complete
      workspace.handler.ts   # Workspace setup (clone, worktree management)

    lib/
      claude-runner.ts       # Import from @openralph/backend (or copy)
      mcp-config.ts          # Generate MCP config with remote DATABASE_URL + ORG_ID
      claude-tools.ts        # Import from @openralph/backend (or copy)
```

### 5.2 Tauri Config

- **No window** — tray-only app
- **System tray**: icon with status indicator (green=connected, yellow=working, red=disconnected)
- **Context menu**: Status line, "Running: 2 jobs", separator, Settings (opens small window for server URL + token), Quit
- **Auto-start**: optional macOS login item

### 5.3 Agent Sidecar

The core agent logic runs as a Node/Bun sidecar process managed by Tauri. The Rust shell handles tray icon and process lifecycle. The TS sidecar does all the real work:

1. Read config (server URL, agent token)
2. Connect WebSocket to `wss://<server>/ws?token=nsa_...`
3. Send `agent:register` with hostname, version
4. Enter message loop — route incoming messages to handlers
5. Auto-reconnect with exponential backoff on disconnect

### 5.4 Dependencies

The agent needs access to:
- `@openralph/backend` — for `runClaude`, `parseStreamLine`, `ClaudeStreamEvent` types, tool configs
- `@openralph/common` — for WS protocol types
- `@openralph/db` — for Drizzle client (MCP server uses it)
- `ws` — WebSocket client

The MCP server code (`packages/backend/src/mcp/ralph-server.ts` + `run.ts`) runs on the agent's machine as a stdio subprocess of Claude CLI. It connects to the remote Supabase DB directly. No changes needed to the MCP server itself — just the `DATABASE_URL` env var points to remote instead of local.

---

## Phase 6: Deployment

### 6.1 Hosted Server

Deploy `apps/web` to Render/Fly/Railway:
- Express + React Router 7 SSR + tRPC + pgBoss + WebSocket server
- Environment: `DATABASE_URL` (remote Supabase), `QUEUE_DATABASE_URL`, `BETTER_AUTH_URL`, GitHub OAuth creds
- No Claude CLI, no git operations, no workspace management on the server

### 6.2 Remote Supabase

- Migrate from local Supabase to hosted Supabase project
- Enable Realtime on all tables (already configured)
- Connection pooler for Drizzle, direct connection for pgBoss

### 6.3 Agent Distribution

- Build Tauri app for macOS (initially), later Windows/Linux
- Distribute via GitHub Releases or direct download from the web app
- Auto-update via Tauri's built-in updater

---

## Implementation Order

| Step | What | Scope |
|------|------|-------|
| **1** | Org model + migration + BetterAuth plugins | DB + auth layer |
| **2** | ActorContext extension + requireOrgId + actor resolution middleware | Plumbing |
| **3** | Scope all services with orgId | Service layer (mechanical) |
| **4** | Agent token service + router | New service |
| **5** | Frontend: org switcher, org creation flow, token management page | UI |
| **6** | WS protocol types in `packages/common` | Shared types |
| **7** | WS server + AgentRegistry on Express | Server infrastructure |
| **8** | Chat streaming refactor (streamChatViaAgent) | Chat path |
| **9** | Job dispatch refactor (ralph.job.ts) | Job path |
| **10** | Tauri agent app scaffold + WS client + handlers | Agent app |
| **11** | Supabase Realtime scoping by orgId | Realtime |
| **12** | Remote Supabase + hosted deployment | Infra |

Steps 1-5 can be done first as a self-contained milestone (org model works even before the agent exists). Steps 6-10 are the agent architecture. Steps 11-12 are deployment.

---

## Critical Files

| File | Role |
|------|------|
| `packages/db/src/models/org.model.ts` | NEW — org/member/invitation tables |
| `packages/db/src/models/agent-token.model.ts` | NEW — agent token table |
| `packages/backend/src/lib/context.ts` | MODIFY — extend Actor types with orgId + AgentActor |
| `packages/backend/src/lib/auth.ts` | MODIFY — add organization + bearer plugins |
| `packages/backend/src/lib/trpc.ts` | MODIFY — protectedProcedure accepts agent actor |
| `apps/web/server/app.ts` | MODIFY — resolveActor middleware, WS server attachment |
| `apps/web/server.js` | MODIFY — pass HTTP server for WS |
| `packages/backend/src/services/*.service.ts` | MODIFY — add orgId scoping to all 5 data services |
| `packages/backend/src/services/agent-token.service.ts` | NEW — token CRUD |
| `packages/backend/src/routers/agent-token.router.ts` | NEW — token endpoints |
| `packages/backend/src/routers/org.router.ts` | NEW — org endpoints |
| `packages/backend/src/ws/ws-server.ts` | NEW — WebSocket server |
| `packages/backend/src/ws/agent-registry.ts` | NEW — agent presence tracking |
| `packages/backend/src/ws/agent-connection.ts` | NEW — per-connection wrapper |
| `packages/backend/src/ws-handlers/*.ts` | NEW — chat/job WS handlers |
| `packages/backend/src/services/ai.service.ts` | MODIFY — add streamChatViaAgent |
| `packages/backend/src/jobs/ralph.job.ts` | MODIFY — dispatch to agent instead of local runClaude |
| `packages/common/src/ws-protocol.ts` | NEW — shared WS message types |
| `apps/agent/` | NEW — entire Tauri tray app |

## Verification

1. **Org model**: Create org, invite member, switch orgs — verify data scoping
2. **Agent tokens**: Generate token, use it to authenticate a WS connection
3. **WS layer**: Connect mock agent script, verify registration + heartbeat
4. **Chat via agent**: Send chat message from browser, verify it streams through WS to agent and back
5. **Jobs via agent**: Start a ralph loop, verify iterations execute on agent, progress shows in UI
6. **Offline handling**: Disconnect agent, verify UI shows offline status, jobs queue properly
7. **Tauri app**: Install on clean Mac, paste token, verify auto-connect + tray status
