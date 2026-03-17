# ── Stage 1: Install all dependencies ─────────────────────────────────────────
FROM oven/bun:1.3 AS deps

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock turbo.json ./

# Copy all package manifests (for workspace resolution)
COPY apps/web/package.json apps/web/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/common/package.json packages/common/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json

RUN bun install --frozen-lockfile

# ── Stage 2: Build the app ───────────────────────────────────────────────────
FROM oven/bun:1.3 AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Restore hoisted workspace node_modules
RUN bun install --frozen-lockfile

RUN bun run --filter web build

# ── Stage 3: Production image ────────────────────────────────────────────────
FROM oven/bun:1.3-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock turbo.json ./
COPY drizzle.config.ts ./

# Copy all package sources (needed at runtime — bun resolves workspace:* imports)
COPY packages/ packages/

# Copy web app build output + server files
COPY apps/web/package.json apps/web/
COPY apps/web/server.js apps/web/
COPY apps/web/server/ apps/web/server/
COPY --from=build /app/apps/web/build apps/web/build

# Install production deps
RUN bun install --frozen-lockfile --production

# Workspace dir for git clones + worktrees (mount a persistent volume here)
RUN mkdir -p /data/nightshift
ENV NIGHTSHIFT_WORKSPACE_DIR=/data/nightshift

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "start"]
