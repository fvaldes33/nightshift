CREATE TYPE "public"."doc_target" AS ENUM('all', 'ralph', 'chat');--> statement-breakpoint
ALTER TABLE "docs" ADD COLUMN "target" "doc_target" DEFAULT 'all' NOT NULL;--> statement-breakpoint
CREATE INDEX "docs_target_idx" ON "docs" USING btree ("target");