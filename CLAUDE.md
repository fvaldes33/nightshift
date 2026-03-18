# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the monorepo root:

```bash
bun run dev          # Start all apps/packages in dev mode (Turborepo)
bun run build        # Production build
bun run typecheck    # Type-check all workspaces
bun run lint         # Lint all workspaces
bun run format       # Prettier across the repo

bun run db:generate  # Generate Drizzle migrations from schema changes
bun run db:push      # Push schema directly to DB (dev)
bun run db:migrate   # Run migrations (production)
bun run db:studio    # Open Drizzle Studio
```

The web app dev server starts on port 56677 (Express + Vite SSR).

## Architecture

OpenRalph is a self-hosted AI assistant infrastructure for running autonomous coding loops ("ralph") against GitHub repos. Runs locally on the dev machine, exposed to the internet via Tailscale. Express + React Router 7 SSR + pgBoss queue workers in a single process.

### Monorepo (Bun + Turborepo)

```
apps/web/           → React Router 7 SSR app (Express server, tRPC + BetterAuth)
packages/ai/        → AI SDK model factories (Anthropic, Groq, OpenAI, Perplexity)
packages/backend/   → Business logic: tRPC routers, services, jobs, tools, MCP server
packages/db/        → Drizzle ORM schemas, relations, database config
packages/ui/        → shadcn/ui components + AI chat elements
packages/common/    → Shared utilities
```

### Request flow

1. **Frontend** calls tRPC queries/mutations or POSTs to `/api/chat`
2. **tRPC handler** resolves BetterAuth session → sets `ActorContext` (AsyncLocalStorage) → routes to `appRouter`
3. **Routers** (`packages/backend/src/routers/`) call **services** (`packages/backend/src/services/`)
4. **Services** use the `fn()` wrapper (Zod input parsing + schema attachment for tRPC)
5. **Chat streaming** (`/api/chat` → `ai.service.streamChat()`) uses Vercel AI SDK with Anthropic, extended thinking, and tool use

### Key patterns

- **`fn()` wrapper** (`packages/backend/src/lib/fn.ts`): Wraps async handlers with Zod schema parsing. Attaches `.schema` for tRPC input inference.
- **`ActorContext` / `AgentContext`** (`packages/backend/src/lib/context.ts`): AsyncLocalStorage-based context. Actor = authenticated user or public. Agent = runtime state for ralph loops.
- **`QueueBuilder`** (`packages/backend/src/lib/queue-builder.ts`): Generic pgBoss queue with Zod schema validation. Pattern: `createQueue({ name, input, ... }).work(handler)`.
- **Singletons** via `@epic-web/remember` for LLM instances and queue boss.
- **Server-side tRPC caller** (`packages/backend/src/lib/caller.ts`): Used in React Router loaders to call tRPC procedures server-side.

### Database

PostgreSQL on Neon. Two connections:
- **Drizzle** (`packages/db/`): Uses `@neondatabase/serverless` HTTP adapter for queries
- **pgBoss**: Uses `postgres.js` direct TCP connection (separate `QUEUE_DATABASE_URL`)

Models in `packages/db/src/models/*.model.ts`: user/session/account (BetterAuth), repos, sessions, tasks (hierarchical with subtasks, jsonb comments), loops, messages (jsonb parts), docs.

### Ralph loops

pgBoss job that spawns `claude -p` CLI subprocess with MCP config. Runs locally so Claude Max auth just works — no API key needed, no token management. The MCP server (`packages/backend/src/mcp/ralph-server.ts`) exposes task/message/loop tools. Jobs: `workspace/setup` (clone + worktree), `ralph/loop` (init), `ralph/iteration` (run one claude CLI pass).

### Auth

BetterAuth with email/password + GitHub OAuth. User creation gated by email allowlist. GitHub OAuth scopes include `repo` and `read:org` for API access. Token retrieved via `account.service.getGitHubToken()`.

## Conventions

- **Dependencies**: Always use `bun add` — never edit package.json manually.
- **Types**: Import from `@openralph/db` or `@openralph/backend` and use `Pick`/`Omit`/`Extend` — never recreate types.
- **Schemas**: Use `drizzle-zod` to derive Zod schemas from Drizzle models. Forms use React Hook Form + `zodResolver`.
- **Frontend**: Tailwind v4, shadcn/ui components. Path alias `~/` maps to `apps/web/app/`.
- **tRPC**: SuperJSON transformer. `publicProcedure` and `protectedProcedure` (requires authenticated actor). AppError maps to TRPCError codes.
- **Scrolling**: `overflow-hidden` on shell layout, `overflow-auto` on page content. No absolute wrappers.
