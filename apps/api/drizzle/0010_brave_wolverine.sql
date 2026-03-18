CREATE TABLE IF NOT EXISTS "rfq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" text NOT NULL,
	"target_price" text,
	"agreed_price" text,
	"moq_satisfied" text DEFAULT 'false',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "negotiation_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "total_qty" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "notes" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
