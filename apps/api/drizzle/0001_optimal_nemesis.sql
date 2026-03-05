ALTER TABLE "requests" RENAME COLUMN "status" TO "state";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "message_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "body" text NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "subcategory" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "priority" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "created_by_membership_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "assigned_to_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "context_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "context_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requests_state_idx" ON "requests" ("customer_id","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "threads_context_idx" ON "threads" ("customer_id","context_type","context_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_membership_id_memberships_id_fk" FOREIGN KEY ("sender_membership_id") REFERENCES "memberships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "requests" ADD CONSTRAINT "requests_created_by_membership_id_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "requests" ADD CONSTRAINT "requests_assigned_to_membership_id_memberships_id_fk" FOREIGN KEY ("assigned_to_membership_id") REFERENCES "memberships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN IF EXISTS "author_id";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN IF EXISTS "content";--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN IF EXISTS "created_by";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN IF EXISTS "entity_type";--> statement-breakpoint
ALTER TABLE "threads" DROP COLUMN IF EXISTS "entity_id";