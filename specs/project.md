# OpenRalph

## What is it

A personal AI assistant infrastructure for running autonomous coding loops (called "ralph") against your own repos. Think a stripped-down, self-hosted version of OpenClaw — but tailored to one user's workflow instead of trying to be everything for everyone.

## Core requirements

- **GitHub access** — pull/write to repos
- **Queue system** — run autonomous ralph loops (iterative Claude CLI sessions that work until a task is complete)
- **Claude Code Max subscription** — avoid per-token API costs
- **Groq for fast inference** — use open source models (llama, qwen, etc.) for cheaper/faster tasks
- **Minimal UI** — manage sessions, edit skills/prompts/markdown context files
- **Notifications** — Slack webhooks initially, possibly an Expo app later

## Architecture

Single Render.com web service running:
- React Router 7 (SSR) + shadcn UI
- Express server
- pgboss queue (backed by Postgres)
- Ralph job executor
- BetterAuth for auth (not Supabase Auth)
- Postgres on Neon or Supabase (just the DB)

```
┌─────────────────────────────────────┐
│  Render.com Web Service (Docker)    │
│                                     │
│  Express + React Router 7 (SSR)     │
│  ├─ pgboss worker (queue consumer)  │
│  ├─ ralph executor                  │
│  ├─ model router (claude / groq)    │
│  ├─ GitHub ops (gh CLI / API)       │
│  ├─ BetterAuth                      │
│  └─ tRPC API                        │
│                                     │
└──────────────┬──────────────────────┘
               │
       ┌───────▼────────┐
       │  Postgres (Neon)│
       │  sessions       │
       │  messages        │
       │  pgboss tables   │
       │  auth tables     │
       └─────────────────┘
               │
       Slack webhooks for notifications
```

## The Claude Max auth question

This is the make-or-break decision. Claude Code Max subscription uses OAuth-based auth designed for interactive local use. Running it on Render means figuring out headless auth.

### Options discovered

1. **CLIProxyAPI** — Community tool that wraps Max subscription OAuth token as an OpenAI-compatible API (`localhost:8317/v1/chat/completions`). Runs as a sidecar process inside the same container. Internal port — doesn't need to be exposed by Render. Do the OAuth flow once via `cli-proxy-api --claude-login --no-browser`, it stores the token. Your app just makes HTTP calls to it.

2. **Direct Claude CLI on Render (Docker)** — Install `claude` in the Dockerfile, do OAuth flow once via Render shell. Problem: tokens expire (~8 hours), container restarts lose auth. Would need persistent disk or token stored in DB + restore on startup.

3. **Community fork for token refresh** — github.com/grll/claude-code-action handles automatic OAuth token refresh, but built for GitHub Actions. Could potentially be adapted.

4. **Just use ANTHROPIC_API_KEY** — Simplest. Pay per-token instead of using Max. Offset costs by routing cheaper tasks to Groq aggressively.

5. **Claude Code SDK** — The `@anthropic-ai/claude-code` npm package supports headless mode with `-p` flag. With Max subscription auth (no API key set), headless execution is included in the subscription. Key: `ANTHROPIC_API_KEY` must NOT be set, otherwise it falls back to API billing.

### Most promising path

CLIProxyAPI as a sidecar on Render. It gives:
- Max subscription billing (no per-token cost)
- OpenAI-compatible API format (same interface as Groq — easy model routing)
- Runs inside the container on a different port (no Render config needed)
- Token persistence is still a concern on container restarts

### Fallback

Use `ANTHROPIC_API_KEY` + lean heavily on Groq for anything that doesn't need Claude-level reasoning. Zero auth complexity.

## Model router concept

Jobs have a task type. A simple router decides which backend handles each job:

- **Claude (via Max/CLIProxyAPI or API)** — deep reasoning, code generation, complex refactors
- **Groq (llama, qwen)** — fast tasks: summarization, classification, triage, drafting

Same HTTP interface for both (OpenAI-compatible), just different base URLs.

## Ralph loop (existing)

The current ralph implementation (`run.sh`) is a bash loop that:
1. Pipes `prompt.md` into `claude --dangerously-skip-permissions --model opus`
2. Checks output for `<promise>COMPLETE</promise>`
3. Repeats up to N iterations
4. Sleeps 2s between iterations

This maps directly to a pgboss job handler — the queue picks up a job, runs the loop, stores output in DB, updates status.

## Monorepo structure

```
openralph/
├── apps/web/              React Router 7 + Express + shadcn
├── packages/
│   ├── ai/                AI SDK models (Claude, Groq)
│   ├── common/            Shared utilities
│   ├── ui/                shadcn components + ai-elements
│   ├── eslint-config/     Shared ESLint
│   └── typescript-config/ Shared TS configs
├── specs/                 This file
└── turbo.json
```

Still need to add: `packages/db` (drizzle models, pgboss), `packages/backend` (tRPC routers, services, auth, job handlers).

## Tech stack

- **Runtime:** Bun
- **Monorepo:** Turborepo
- **Frontend:** React Router 7 (SSR) + Tailwind v4 + shadcn
- **Backend:** Express + tRPC + BetterAuth
- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Queue:** pgboss
- **AI:** Vercel AI SDK v6, @ai-sdk/anthropic v3, @ai-sdk/groq v3
- **Hosting:** Render.com (Docker)
- **Notifications:** Slack webhooks
