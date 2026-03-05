ALTER TABLE "orders" ADD COLUMN "tracking_number" text;
ALTER TABLE "orders" ADD COLUMN "batch_number" text;
ALTER TABLE "orders" ADD COLUMN "eta" timestamptz;
