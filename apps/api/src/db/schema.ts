import { pgTable, text, timestamp, uuid, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';

export const actorTypeEnum = pgEnum('actor_type', ['internal', 'customer']);

// 1. Identity and Governance

export const customers = pgTable('customers', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const memberships = pgTable('memberships', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    user_id: uuid('user_id').notNull().references(() => users.id),
    actor_type: actorTypeEnum('actor_type').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    name: text('name').notNull(),
    description: text('description'),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = pgTable('permissions', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(), // e.g. 'requests:read'
    description: text('description'),
});

export const membershipRoles = pgTable('membership_roles', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    membership_id: uuid('membership_id').notNull().references(() => memberships.id),
    role_id: uuid('role_id').notNull().references(() => roles.id),
});

export const rolePermissions = pgTable('role_permissions', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    role_id: uuid('role_id').notNull().references(() => roles.id),
    permission_id: uuid('permission_id').notNull().references(() => permissions.id),
});

// 2.a Approvals

export const approvalInstances = pgTable('approval_instances', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    scope: text('scope').notNull(), // e.g. request.transition
    entity_type: text('entity_type').notNull(),
    entity_id: uuid('entity_id').notNull(),
    transition_key: text('transition_key').notNull(),
    status: text('status').notNull().default('pending'), // pending|approved|rejected|cancelled
    created_by_membership_id: uuid('created_by_membership_id').notNull().references(() => memberships.id),
    created_at: timestamp('created_at').defaultNow().notNull(),
    decided_at: timestamp('decided_at'),
});

export const approvalSteps = pgTable('approval_steps', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    approval_instance_id: uuid('approval_instance_id').notNull().references(() => approvalInstances.id),
    step_no: text('step_no').notNull(),
    required_role_id: uuid('required_role_id').references(() => roles.id),
    status: text('status').notNull().default('pending'), // pending|approved|rejected|skipped
    acted_by_membership_id: uuid('acted_by_membership_id').references(() => memberships.id),
    acted_at: timestamp('acted_at'),
});

// 2. Workflow and Audit Spine

export const workflows = pgTable('workflows', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    name: text('name').notNull(),
    config: jsonb('config').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const stateEvents = pgTable('state_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    entity_type: text('entity_type').notNull(), // e.g. 'request'
    entity_id: uuid('entity_id').notNull(),
    from_state: text('from_state'),
    to_state: text('to_state').notNull(),
    actor_id: uuid('actor_id').notNull().references(() => users.id),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const outboxEvents = pgTable('outbox_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    event_type: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    processed_at: timestamp('processed_at'),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const threads = pgTable('threads', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    context_type: text('context_type').notNull(),
    context_id: uuid('context_id').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    ctxIdx: index('threads_context_idx').on(table.customer_id, table.context_type, table.context_id),
}));

export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    thread_id: uuid('thread_id').notNull().references(() => threads.id),
    sender_membership_id: uuid('sender_membership_id').references(() => memberships.id),
    message_type: text('message_type').notNull(), // 'comment' or 'system_state_change'
    body: text('body').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    filename: text('filename').notNull(),
    storage_path: text('storage_path').notNull(),
    uploaded_by: uuid('uploaded_by').notNull().references(() => users.id),
    entity_type: text('entity_type'),
    entity_id: uuid('entity_id'),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const documentAccessLogs = pgTable('document_access_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    document_id: uuid('document_id').notNull().references(() => documents.id),
    user_id: uuid('user_id').notNull().references(() => users.id),
    action: text('action').notNull(), // e.g. 'view', 'download'
    accessed_at: timestamp('accessed_at').defaultNow().notNull(),
});

// 3. Business Starter Entity

export const requests = pgTable('requests', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    state: text('state').notNull().default('draft'),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category'),
    subcategory: text('subcategory'),
    priority: text('priority'),
    metadata: jsonb('metadata'),
    created_by_membership_id: uuid('created_by_membership_id').notNull().references(() => memberships.id),
    assigned_to_membership_id: uuid('assigned_to_membership_id').references(() => memberships.id),
    deadline: timestamp('deadline'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    stateIdx: index('requests_state_idx').on(table.customer_id, table.state),
}));

// Lightweight RFQs & Orders for UI wiring
export const rfqs = pgTable('rfqs', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    state: text('state').notNull().default('draft'),
    rfq_number: text('rfq_number').notNull(),
    target_ship_date: timestamp('target_ship_date'),
    sku_count: text('sku_count'),
    created_at: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    state: text('state').notNull().default('confirmed'),
    order_number: text('order_number').notNull(),
    tracking_number: text('tracking_number'),
    batch_number: text('batch_number'),
    eta: timestamp('eta'),
    expedite_fee: text('expedite_fee'),
    carrier_status: text('carrier_status'),
    created_at: timestamp('created_at').defaultNow().notNull(),
});
