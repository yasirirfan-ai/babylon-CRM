import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from './index.js';
import * as schema from './schema.js';

const DEMO = {
    customerName: 'Acme Corp',
    internalUser: {
        name: 'Alice Internal',
        email: 'alice@babylon.internal',
    },
    customerUser: {
        name: 'Bob Acme',
        email: 'bob@acme.com',
    },
    permissions: [
        {
            name: 'requests:read',
            description: 'Can view requests',
        },
        {
            name: 'requests:manage',
            description: 'Can transition and manage requests',
        }
    ],
    roles: {
        customer: {
            name: 'Customer Admin',
            description: 'Customer portal role',
        },
        internal: {
            name: 'Internal Ops',
            description: 'Babylon internal operator role',
        },
    },
    rfqs: [
        { state: 'draft', rfq_number: 'RFQ-1001', target_ship_date: new Date(), sku_count: '2' },
        { state: 'pending_approval', rfq_number: 'RFQ-1002', target_ship_date: new Date(Date.now() + 3 * 24 * 3600 * 1000), sku_count: '4' },
        { state: 'confirmed', rfq_number: 'RFQ-1003', target_ship_date: new Date(Date.now() + 7 * 24 * 3600 * 1000), sku_count: '6' },
    ],
    orders: [
        { state: 'confirmed', order_number: 'ORD-2001', tracking_number: 'TRK-2001', batch_number: 'BATCH-01', eta: new Date(Date.now() + 4 * 24 * 3600 * 1000) },
        { state: 'in_production', order_number: 'ORD-2002', tracking_number: 'TRK-2002', batch_number: 'BATCH-02', eta: new Date(Date.now() + 9 * 24 * 3600 * 1000) },
        { state: 'shipped', order_number: 'ORD-2003', tracking_number: 'TRK-2003', batch_number: 'BATCH-03', eta: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
    ],
    requests: [
        {
            state: 'draft',
            title: 'First sample request',
            description: 'Need SDS document',
            category: 'docs',
        },
        {
            state: 'submitted',
            title: 'Change batch split',
            description: 'Split shipment into two lots',
            category: 'order_mod',
        }
    ],
    notifications: [
        {
            event_type: 'rfq.pending_approval',
            payload: { rfq_number: 'RFQ-1002' },
        },
        {
            event_type: 'order.shipped',
            payload: { order_number: 'ORD-2003', tracking: 'TRK123' },
        },
        {
            event_type: 'request.submitted',
            payload: { request_title: 'Change batch split' },
        }
    ],
};

export interface SeedSummary {
    customerId: string;
    customerMembershipId: string;
    internalMembershipId: string;
    customerEmail: string;
    internalEmail: string;
}

async function writeWebEnv(summary: SeedSummary) {
    const envPath = path.resolve(__dirname, '../../../web/.env.local');
    const envFile = [
        // Keep dev pointing at the namespaced API.
        `VITE_API_BASE=http://localhost:${config.port}/api`,
        `VITE_CUSTOMER_ID=${summary.customerId}`,
        `VITE_MEMBERSHIP_ID=${summary.customerMembershipId}`,
        `VITE_INTERNAL_MEMBERSHIP_ID=${summary.internalMembershipId}`,
        '',
    ].join('\n');

    await fs.writeFile(envPath, envFile, 'utf8');
    console.log(`Updated web env: ${envPath}`);
}

function formatError(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error);
}

function logSummary(summary: SeedSummary) {
    console.log(`Test Customer ID: ${summary.customerId}`);
    console.log(`Customer membership ID: ${summary.customerMembershipId} (${summary.customerEmail})`);
    console.log(`Internal membership ID: ${summary.internalMembershipId} (${summary.internalEmail})`);
}

async function ensureCustomer() {
    const [existingCustomer] = await db.select().from(schema.customers)
        .where(eq(schema.customers.name, DEMO.customerName));

    if (existingCustomer) return existingCustomer;

    const [customer] = await db.insert(schema.customers).values({
        name: DEMO.customerName,
    }).returning();

    return customer;
}

async function ensureUser(name: string, email: string) {
    const [existingUser] = await db.select().from(schema.users)
        .where(eq(schema.users.email, email));

    if (existingUser) return existingUser;

    const [user] = await db.insert(schema.users).values({ name, email }).returning();
    return user;
}

async function ensureMembership(customerId: string, userId: string, actorType: 'internal' | 'customer') {
    const [existingMembership] = await db.select().from(schema.memberships)
        .where(and(
            eq(schema.memberships.customer_id, customerId),
            eq(schema.memberships.user_id, userId),
        ));

    if (existingMembership) return existingMembership;

    const [membership] = await db.insert(schema.memberships).values({
        customer_id: customerId,
        user_id: userId,
        actor_type: actorType,
    }).returning();

    return membership;
}

async function ensureRole(customerId: string, name: string, description: string) {
    const [existingRole] = await db.select().from(schema.roles)
        .where(and(
            eq(schema.roles.customer_id, customerId),
            eq(schema.roles.name, name),
        ));

    if (existingRole) return existingRole;

    const [role] = await db.insert(schema.roles).values({
        customer_id: customerId,
        name,
        description,
    }).returning();

    return role;
}

async function ensureRolePermission(customerId: string, roleId: string, permissionId: string) {
    const [existingLink] = await db.select().from(schema.rolePermissions)
        .where(and(
            eq(schema.rolePermissions.customer_id, customerId),
            eq(schema.rolePermissions.role_id, roleId),
            eq(schema.rolePermissions.permission_id, permissionId),
        ));

    if (existingLink) return existingLink;

    const [link] = await db.insert(schema.rolePermissions).values({
        customer_id: customerId,
        role_id: roleId,
        permission_id: permissionId,
    }).returning();

    return link;
}

async function ensureMembershipRole(customerId: string, membershipId: string, roleId: string) {
    const [existingLink] = await db.select().from(schema.membershipRoles)
        .where(and(
            eq(schema.membershipRoles.customer_id, customerId),
            eq(schema.membershipRoles.membership_id, membershipId),
            eq(schema.membershipRoles.role_id, roleId),
        ));

    if (existingLink) return existingLink;

    const [link] = await db.insert(schema.membershipRoles).values({
        customer_id: customerId,
        membership_id: membershipId,
        role_id: roleId,
    }).returning();

    return link;
}

async function ensureRfq(customerId: string, rfq: { state: string; rfq_number: string }) {
    const [existingRfq] = await db.select().from(schema.rfqs)
        .where(and(
            eq(schema.rfqs.customer_id, customerId),
            eq(schema.rfqs.rfq_number, rfq.rfq_number),
        ));

    if (existingRfq) {
        await db.update(schema.rfqs)
            .set({ ...rfq })
            .where(eq(schema.rfqs.id, existingRfq.id));
        return { ...existingRfq, ...rfq };
    }

    const [createdRfq] = await db.insert(schema.rfqs).values({
        customer_id: customerId,
        ...rfq,
    }).returning();

    return createdRfq;
}

async function ensureOrder(customerId: string, order: { state: string; order_number: string }) {
    const [existingOrder] = await db.select().from(schema.orders)
        .where(and(
            eq(schema.orders.customer_id, customerId),
            eq(schema.orders.order_number, order.order_number),
        ));

    if (existingOrder) {
        await db.update(schema.orders)
            .set({ ...order })
            .where(eq(schema.orders.id, existingOrder.id));
        return { ...existingOrder, ...order };
    }

    const [createdOrder] = await db.insert(schema.orders).values({
        customer_id: customerId,
        ...order,
    }).returning();

    return createdOrder;
}

async function ensureThreadWithMessages(customerId: string, requestId: string, membershipId: string) {
    const [existingThread] = await db.select().from(schema.threads)
        .where(and(
            eq(schema.threads.customer_id, customerId),
            eq(schema.threads.context_type, 'request'),
            eq(schema.threads.context_id, requestId),
        ));

    let threadId = existingThread?.id;

    if (!threadId) {
        const [thread] = await db.insert(schema.threads).values({
            customer_id: customerId,
            context_type: 'request',
            context_id: requestId,
        }).returning();
        threadId = thread.id;
    }

    const existingMessages = await db.select().from(schema.messages)
        .where(and(eq(schema.messages.customer_id, customerId), eq(schema.messages.thread_id, threadId)));

    if (existingMessages.length === 0) {
        await db.insert(schema.messages).values([
            {
                customer_id: customerId,
                thread_id: threadId,
                sender_membership_id: membershipId,
                message_type: 'comment',
                body: 'Hi team, can you take a look at this?',
            },
            {
                customer_id: customerId,
                thread_id: threadId,
                sender_membership_id: membershipId,
                message_type: 'comment',
                body: 'Sure, working on it now.',
            },
        ]);
    }
}

async function ensureRequest(customerId: string, membershipId: string, request: typeof DEMO.requests[number]) {
    const [existingRequest] = await db.select().from(schema.requests)
        .where(and(
            eq(schema.requests.customer_id, customerId),
            eq(schema.requests.title, request.title),
        ));

    if (existingRequest) return existingRequest;

    const [createdRequest] = await db.insert(schema.requests).values({
        customer_id: customerId,
        created_by_membership_id: membershipId,
        ...request,
    }).returning();

    return createdRequest;
}

async function ensureNotification(customerId: string, notification: typeof DEMO.notifications[number]) {
    const [existingNotification] = await db.select().from(schema.outboxEvents)
        .where(and(
            eq(schema.outboxEvents.customer_id, customerId),
            eq(schema.outboxEvents.event_type, notification.event_type),
        ));

    if (existingNotification) return existingNotification;

    const [createdNotification] = await db.insert(schema.outboxEvents).values({
        customer_id: customerId,
        ...notification,
    }).returning();

    return createdNotification;
}

export async function seedDatabase(): Promise<SeedSummary> {
    console.log('Seeding database...');

    const customer = await ensureCustomer();
    const internalUser = await ensureUser(DEMO.internalUser.name, DEMO.internalUser.email);
    const customerUser = await ensureUser(DEMO.customerUser.name, DEMO.customerUser.email);

    const internalMembership = await ensureMembership(customer.id, internalUser.id, 'internal');
    const customerMembership = await ensureMembership(customer.id, customerUser.id, 'customer');

    await db.insert(schema.permissions).values(DEMO.permissions).onConflictDoNothing();

    const permissionRows = await db.select().from(schema.permissions);
    const permissionsByName = new Map(permissionRows.map((permission) => [permission.name, permission.id]));

    const customerRole = await ensureRole(
        customer.id,
        DEMO.roles.customer.name,
        DEMO.roles.customer.description,
    );
    const internalRole = await ensureRole(
        customer.id,
        DEMO.roles.internal.name,
        DEMO.roles.internal.description,
    );

    await ensureRolePermission(customer.id, customerRole.id, permissionsByName.get('requests:read')!);
    await ensureRolePermission(customer.id, internalRole.id, permissionsByName.get('requests:read')!);
    await ensureRolePermission(customer.id, internalRole.id, permissionsByName.get('requests:manage')!);

    await ensureMembershipRole(customer.id, customerMembership.id, customerRole.id);
    await ensureMembershipRole(customer.id, internalMembership.id, internalRole.id);

    for (const rfq of DEMO.rfqs) {
        await ensureRfq(customer.id, rfq);
    }

    for (const order of DEMO.orders) {
        await ensureOrder(customer.id, order);
    }

    for (const request of DEMO.requests) {
        const req = await ensureRequest(customer.id, customerMembership.id, request);
        await ensureThreadWithMessages(customer.id, req.id, customerMembership.id);
    }

    for (const notification of DEMO.notifications) {
        await ensureNotification(customer.id, notification);
    }

    const summary: SeedSummary = {
        customerId: customer.id,
        customerMembershipId: customerMembership.id,
        internalMembershipId: internalMembership.id,
        customerEmail: customerUser.email,
        internalEmail: internalUser.email,
    };

    try {
        await writeWebEnv(summary);
    } catch (error) {
        console.warn(`Could not update web env automatically: ${formatError(error)}`);
        console.warn('Continuing with existing web env values.');
    }
    console.log('Seed data is ready.');
    logSummary(summary);

    return summary;
}

async function main() {
    try {
        await seedDatabase();
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

main();
