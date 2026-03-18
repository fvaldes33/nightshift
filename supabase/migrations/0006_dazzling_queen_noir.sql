-- Phase 1: Add workspace columns to repos
ALTER TABLE "repos" ADD COLUMN "local_path" text;
--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "workspace_status" "workspace_status" DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "repos" ADD COLUMN "workspace_error" text;
--> statement-breakpoint

-- Phase 2: Populate repo workspace fields from existing session data
UPDATE "repos" SET "workspace_status" = 'ready'
WHERE "id" IN (
  SELECT DISTINCT "repo_id" FROM "sessions"
  WHERE "workspace_status" = 'ready' AND "repo_id" IS NOT NULL
);
--> statement-breakpoint

-- Phase 3: Delete orphan sessions (no repo) before making repo_id NOT NULL
DELETE FROM "sessions" WHERE "repo_id" IS NULL;
--> statement-breakpoint

-- Phase 4: Delete orphan tasks (no repo) before making repo_id NOT NULL
DELETE FROM "tasks" WHERE "repo_id" IS NULL;
--> statement-breakpoint

-- Phase 5: Alter sessions — drop workspace columns, make repo_id NOT NULL, cascade
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_repo_id_repos_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "repo_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "worktree_path";
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "workspace_status";
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "workspace_error";
--> statement-breakpoint

-- Phase 6: Alter tasks — drop session_id, make repo_id NOT NULL, cascade
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_repo_id_repos_id_fk";
--> statement-breakpoint
DROP INDEX "tasks_session_id_idx";
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "repo_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "session_id";
