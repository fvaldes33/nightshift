# Nightshift

Run autonomous AI coding agents against your GitHub repos — using your **Claude Max subscription**, with zero per-token API costs.

Nightshift runs entirely on your local machine. It spawns `claude -p` CLI subprocesses to execute tasks, so your existing Claude Max auth just works. No API key juggling, no usage bills — just connect a repo, create a task, and let it run.

## How it works

Nightshift is a single Express process: web UI, tRPC API, and pgBoss queue workers all in one. When you kick off a "ralph" loop, it:

1. Clones the target repo into a local worktree
2. Spawns `claude -p` CLI with an MCP server that exposes task/message tools
3. Runs iterative passes — Claude reads the task, explores the code, makes changes, creates PRs
4. Loops until the task is marked complete or the iteration limit is reached

```
┌─────────────────────────────────────┐
│  Local machine                      │
│                                     │
│  Express + React Router 7 (SSR)     │
│  ├─ pgBoss worker (queue consumer)  │
│  ├─ ralph executor (claude -p CLI)  │
│  ├─ model router (claude / groq)    │
│  ├─ GitHub ops (gh CLI / API)       │
│  ├─ BetterAuth                      │
│  └─ tRPC API                        │
│                                     │
└──────────────┬──────────────────────┘
               │
       ┌───────▼─────────┐
       │  Supabase (local)│
       │  PostgreSQL      │
       │  Realtime        │
       └─────────────────┘
```

Expose it to the internet via [Tailscale](https://tailscale.com) if you want to access it from anywhere.

## Tech stack

- **Runtime:** Bun + Turborepo monorepo
- **Frontend:** React Router 7 (SSR) + Tailwind v4 + shadcn/ui
- **Backend:** Express + tRPC + BetterAuth
- **Database:** PostgreSQL (local Supabase) + Drizzle ORM
- **Queue:** pgBoss
- **Realtime:** Supabase Realtime + TanStack DB
- **AI:** Claude Code CLI (Max subscription), Vercel AI SDK, Groq

## Monorepo structure

```
apps/web/           → React Router 7 SSR app (Express server)
packages/ai/        → AI SDK model factories (Anthropic, Groq, OpenAI, Perplexity)
packages/backend/   → tRPC routers, services, jobs, tools, MCP server
packages/db/        → Drizzle ORM schemas and database config
packages/ui/        → shadcn/ui components + AI chat elements
packages/common/    → Shared utilities
```

## Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase`)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`) — logged in with a Max subscription
- A [GitHub OAuth App](https://github.com/settings/developers) (callback URL: `http://localhost:56677/api/auth/callback/github`)
- Node.js >= 22

## Setup

**1. Clone and install dependencies**

```bash
git clone https://github.com/fvaldes33/nightshift.git
cd nightshift
bun install
```

**2. Start local Supabase**

```bash
bun run supabase:start
```

This starts a local Postgres instance on port 55322 with Supabase services. Note the `anon key` and `service_role key` from the output.

**3. Configure environment**

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection (local Supabase default works) |
| `QUEUE_DATABASE_URL` | Same as DATABASE_URL for local dev |
| `VITE_SUPABASE_URL` | `http://127.0.0.1:55321` |
| `VITE_SUPABASE_ANON_KEY` | Anon key from `supabase start` output |
| `SUPABASE_SECRET_KEY` | Service role key from `supabase start` output |
| `BETTER_AUTH_SECRET` | Random string (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | `http://localhost:56677` |
| `GITHUB_CLIENT_ID` | From your GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | From your GitHub OAuth App |

AI provider keys (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.) are optional — they power the session chat interface. Ralph loops use the Claude CLI with your Max subscription and don't need API keys.

**4. Set up the database**

```bash
bun run db:push
```

**5. Start dev server**

```bash
bun run dev
```

The app runs at [http://localhost:56677](http://localhost:56677).

## Commands

```bash
bun run dev          # Start all apps/packages in dev mode
bun run build        # Production build
bun run typecheck    # Type-check all workspaces
bun run lint         # Lint all workspaces
bun run format       # Prettier across the repo

bun run db:generate  # Generate Drizzle migrations from schema changes
bun run db:push      # Push schema to database
bun run db:studio    # Open Drizzle Studio

bun run supabase:start   # Start local Supabase
bun run supabase:stop    # Stop local Supabase
bun run supabase:reset   # Reset database (runs migrations + seed)
```

## Roadmap

- **Claude Local Chat** — Route the interactive chat through the Claude CLI instead of the Anthropic API, so chat uses your Max subscription too (zero API cost for everything). See `specs/claude-local.md`.
- **Codex CLI support** — Spawn OpenAI's Codex CLI for loops, same pattern as Claude CLI but for OpenAI Pro/Team subscribers.
- **Gemini CLI support** — Same idea — Google's Gemini CLI for Gemini Advanced subscribers.
- **Multi-agent orchestration** — Run multiple ralph loops in parallel across different repos or branches, with a coordinator that manages dependencies between tasks.
- **Cost dashboard** — Track token usage, API costs, and time-per-task across providers. Compare what a loop would have cost on API vs what it cost on Max.
- **Custom tool builder** — Define new MCP tools from the UI (shell scripts, API calls, database queries) that ralph can use during loops without touching code.
- **Session branching** — Fork a chat session at any point to explore alternative approaches without losing the original thread.

## License

MIT
