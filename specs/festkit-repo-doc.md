# FestKit — Repo Context

## Commands

```bash
bun run typecheck    # Typecheck all packages (MUST pass before committing)
bun run lint         # Lint all packages
bun run format       # Prettier format
bun run db:generate  # Generate Drizzle migration after schema changes (NEVER write migrations manually)
```

## Architecture

Monorepo (Bun + Turborepo). Two apps, shared packages.

```
apps/organizer/     — RR7 + Express SSR (the main app)
apps/attendee/      — RR7 + react-router-serve (public-facing)
packages/backend/   — Drizzle models, tRPC routers, services, context
packages/auth/      — Supabase SSR auth (subpath exports, no barrel)
packages/ui/        — shadcn components
packages/map-core/  — MapLibre + Terra Draw
```

Domain flow: `models/*.model.ts → services/*.service.ts → routers/*.router.ts → types/*.types.ts`

## Key Conventions

- **Database**: Supabase PostgreSQL. Drizzle ORM. Never write migration SQL manually — always `bun run db:generate` after editing model files.
- **Auth**: Supabase Auth via `@supabase/ssr`, NOT BetterAuth. Cookie-based sessions.
- **Context**: `ActorContext` (AsyncLocalStorage) set by RR7 middleware. Actor types: `public`, `user`, `org`. tRPC procedures: `publicProcedure`, `protectedProcedure`, `orgProcedure`.
- **Frontend structure**: Domain-driven `features/<domain>/` with thin route files that delegate to screen components. No top-level `components/` or `hooks/` — use `features/<domain>/` or `shared/`.
- **Types**: All types come from `@festkit/backend/types/<domain>.types` — never recreate types in frontend code.
- **pgEnum refinements**: drizzle-zod generates broken types for pgEnum columns. Always refine with `z.enum(myEnum.enumValues)` in insert/select/update schemas.
- **`updatedAt`**: Never set manually — `moddatetime` trigger handles it.
- **Org context**: `org-layout.tsx` creates a nested tRPC provider with `x-org-id` header. Use `useOrg()` hook (from `useRouteLoaderData`), not custom React contexts.
- **Forms**: react-hook-form + zodResolver + drizzle-zod schemas from backend.
- **Combobox**: base-ui async pattern with `items` prop, object values, `filter={null}` for server-side search.
- **Tables**: `useTableParams` + server-side pagination. Never manual `useSearchParams` + debounce.

## Anti-Patterns

- No `@ts-ignore`, `as any`, or non-null assertions
- No `.then()` chains — use `await` + destructuring
- No React Router `action`/`useFetcher` — use tRPC mutations
- No `useEffect` for state syncing — derive state directly
- No utility functions in component files — put in `@festkit/common/` or `features/<domain>/lib/`
