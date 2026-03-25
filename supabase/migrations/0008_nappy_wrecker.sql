CREATE TYPE "public"."workspace_mode" AS ENUM('local', 'worktree');--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "workspace_mode" "workspace_mode" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "worktree_path" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pr_branch" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pr_number" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pr_url" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pr_status" text;--> statement-breakpoint
-- Migrate existing data: copy PR state and branch/worktree from loops to their sessions
UPDATE sessions SET
  workspace_mode = 'worktree',
  worktree_path = l.worktree,
  pr_number = l.pr_number,
  pr_url = l.pr_url,
  pr_status = l.pr_status
FROM (
  SELECT DISTINCT ON (session_id) session_id, worktree, pr_number, pr_url, pr_status
  FROM loops
  WHERE session_id IS NOT NULL AND branch IS NOT NULL
  ORDER BY session_id, created_at DESC
) l
WHERE sessions.id = l.session_id;--> statement-breakpoint
-- Set workspace_mode to worktree for sessions that already have a branch
UPDATE sessions SET workspace_mode = 'worktree' WHERE branch IS NOT NULL;--> statement-breakpoint
-- Delete orphaned loops (no session) — can't keep them with required sessionId
DELETE FROM loop_events WHERE loop_id IN (SELECT id FROM loops WHERE session_id IS NULL);--> statement-breakpoint
DELETE FROM loops WHERE session_id IS NULL;--> statement-breakpoint
ALTER TABLE "loops" DROP CONSTRAINT "loops_session_id_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "loops" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "loops" ADD CONSTRAINT "loops_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loops" DROP COLUMN "branch";--> statement-breakpoint
ALTER TABLE "loops" DROP COLUMN "worktree";--> statement-breakpoint
ALTER TABLE "loops" DROP COLUMN "pr_number";--> statement-breakpoint
ALTER TABLE "loops" DROP COLUMN "pr_url";--> statement-breakpoint
ALTER TABLE "loops" DROP COLUMN "pr_status";
