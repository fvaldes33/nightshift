ALTER TABLE "sessions" ADD COLUMN "provider" text DEFAULT 'anthropic' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "model" text DEFAULT 'claude-sonnet-4-6' NOT NULL;