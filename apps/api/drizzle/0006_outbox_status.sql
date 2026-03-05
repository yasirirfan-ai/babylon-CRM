ALTER TABLE "outbox_events" ADD COLUMN "status" text NOT NULL DEFAULT 'pending';
