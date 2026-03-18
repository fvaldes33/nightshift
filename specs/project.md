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

Runs locally on your dev machine. Exposed to the internet via Tailscale (mesh VPN — works from anywhere, not just LAN).

- Express + React Router 7 (SSR) + shadcn UI
- pgboss queue (backed by Postgres on Neon)
- Ralph job executor (spawns `claude -p` CLI)
- BetterAuth for auth
- Tailscale for remote access (`your-machine.tailnet.ts.net:3000`)

```
┌─────────────────────────────────────┐
│  Local machine                      │
│                                     │
│  Express + React Router 7 (SSR)     │
│  ├─ pgboss worker (queue consumer)  │
│  ├─ ralph executor (claude -p CLI)  │
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

## Claude Max auth

Running locally eliminates the auth problem entirely. Claude CLI is already authenticated via Max subscription on the local machine. `claude -p` just works — no token management, no sidecar, no expiry concerns. `ANTHROPIC_API_KEY` is not set so all CLI usage goes through the Max subscription.

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
- **Hosting:** Local machine, exposed via Tailscale
- **Notifications:** Slack webhooks
