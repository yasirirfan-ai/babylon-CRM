-- Approvals scaffold

CREATE TABLE IF NOT EXISTS "approval_instances" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customer_id" uuid NOT NULL,
    "scope" text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id" uuid NOT NULL,
    "transition_key" text NOT NULL,
    "status" text NOT NULL DEFAULT 'pending',
    "created_by_membership_id" uuid NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "decided_at" timestamp
);

CREATE TABLE IF NOT EXISTS "approval_steps" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "customer_id" uuid NOT NULL,
    "approval_instance_id" uuid NOT NULL,
    "step_no" text NOT NULL,
    "required_role_id" uuid,
    "status" text NOT NULL DEFAULT 'pending',
    "acted_by_membership_id" uuid,
    "acted_at" timestamp
);

DO $$ BEGIN
 ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_created_by_membership_id_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_instance_id_approval_instances_id_fk" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_required_role_id_roles_id_fk" FOREIGN KEY ("required_role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_acted_by_membership_id_memberships_id_fk" FOREIGN KEY ("acted_by_membership_id") REFERENCES "memberships"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
