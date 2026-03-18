CREATE TABLE "loop_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loop_id" uuid NOT NULL,
	"iteration" integer NOT NULL,
	"seq" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loop_events" ADD CONSTRAINT "loop_events_loop_id_loops_id_fk" FOREIGN KEY ("loop_id") REFERENCES "public"."loops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loop_events_loop_id_seq_idx" ON "loop_events" USING btree ("loop_id","seq");--> statement-breakpoint
CREATE INDEX "loop_events_loop_id_iteration_idx" ON "loop_events" USING btree ("loop_id","iteration");--> statement-breakpoint

ALTER PUBLICATION supabase_realtime ADD TABLE loop_events;
