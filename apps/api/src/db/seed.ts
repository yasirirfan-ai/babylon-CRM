import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from './index.js';
import * as schema from './schema.js';

const DEMO = {
    customerName: 'Acme Corp',
    customerLogo: 'https://placehold.co/400x120?text=Acme+Portal',
    customerTheme: {
        primaryColor: '#0066cc',
        sidebarColor: '#1a1a1a',
    },
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
    brands: [
        { name: 'Acme Brand A', logo_url: 'https://placehold.co/200x200?text=Brand+A' },
        { name: 'Acme Brand B', logo_url: 'https://placehold.co/200x200?text=Brand+B' },
    ],
    products: [
        { brandName: 'Acme Brand A', sku: 'SKU-001', name: 'Sample Product 1', description: 'High quality sample product' },
        { brandName: 'Acme Brand A', sku: 'SKU-002', name: 'Sample Product 2', description: 'Premium sample product' },
        { brandName: 'Acme Brand B', sku: 'SKU-003', name: 'Eco Product 1', description: 'Eco-friendly version' },
    ],
    rfqs: [
        { 
            state: 'draft', 
            rfq_number: 'RFQ-1001', 
            target_ship_date: new Date(), 
            sku_count: '2', 
            negotiation_status: 'draft',
            productName: 'Sample Product 1',
            items: [
                { productName: 'Sample Product 1', quantity: '100', target_price: '5.00' },
                { productName: 'Sample Product 2', quantity: '50', target_price: '12.00' }
            ]
        },
        { 
            state: 'pending_approval', 
            rfq_number: 'RFQ-1002', 
            target_ship_date: new Date(Date.now() + 3 * 24 * 3600 * 1000), 
            sku_count: '1', 
            negotiation_status: 'negotiating',
            productName: 'Sample Product 2',
            items: [
                { productName: 'Sample Product 2', quantity: '200', target_price: '11.50' }
            ]
        },
        { 
            state: 'confirmed', 
            rfq_number: 'RFQ-1003', 
            target_ship_date: new Date(Date.now() + 7 * 24 * 3600 * 1000), 
            sku_count: '1', 
            negotiation_status: 'approved',
            productName: 'Eco Product 1',
            items: [
                { productName: 'Eco Product 1', quantity: '500', target_price: '8.00', agreed_price: '8.25', moq_satisfied: 'true' }
            ]
        },
    ],
    orders: [
        { 
            state: 'confirmed', 
            order_number: 'ORD-2001', 
            tracking_number: 'TRK-2001', 
            batch_number: 'BATCH-01', 
            eta: new Date(Date.now() + 4 * 24 * 3600 * 1000),
            items: [
                { productName: 'Sample Product 1', quantity: '500', unit_price: '5.20' }
            ]
        },
        { 
            state: 'in_production', 
            order_number: 'ORD-2002', 
            tracking_number: 'TRK-2002', 
            batch_number: 'BATCH-02', 
            eta: new Date(Date.now() + 9 * 24 * 3600 * 1000),
            items: [
                { productName: 'Sample Product 2', quantity: '1000', unit_price: '11.00' }
            ],
            logs: [
                { stage: 'blending', status: 'done', notes: 'Blending completed successfully' },
                { stage: 'filling', status: 'in_progress', notes: 'Currently filling bottles' }
            ]
        },
        { 
            state: 'shipped', 
            order_number: 'ORD-2003', 
            tracking_number: 'TRK-2003', 
            batch_number: 'BATCH-03', 
            eta: new Date(Date.now() + 2 * 24 * 3600 * 1000),
            items: [
                { productName: 'Eco Product 1', quantity: '2000', unit_price: '8.50' }
            ],
            allocations: [
                { lot_number: 'LOT-A12', quantity: '1000', status: 'shipped' },
                { lot_number: 'LOT-A13', quantity: '1000', status: 'shipped' }
            ]
        },
        { 
            state: 'allocated', 
            order_number: 'ORD-2004', 
            tracking_number: null, 
            batch_number: 'BATCH-04', 
            eta: new Date(Date.now() + 6 * 24 * 3600 * 1000),
            items: [
                { productName: 'Sample Product 1', quantity: '150', unit_price: '5.50' }
            ],
            allocations: [
                { lot_number: 'LOT-B88', quantity: '150', status: 'reserved' }
            ]
        },
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
        },
        {
            state: 'in_progress',
            title: 'New SPF 50 Formulation',
            description: 'Customer requested a mineral-only version',
            category: 'rd',
            product_name: 'SPF 50 Mineral Sunscreen' // Use name to find ID in loop
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
    services: [
        { name: 'Custom Formulation', description: 'Expert chemists design your unique product formula', category: 'Design', attach_to: 'RFQ/Order', base_price: '2500.00', is_chargeable: 'true' },
        { name: 'Stability Testing', description: 'Ensures product shelf life and safety over 3 months', category: 'Quality', attach_to: 'Order', base_price: '800.00', is_chargeable: 'true' },
        { name: 'Label Design & Review', description: 'Creative artwork and regulatory compliance check', category: 'Marketing', attach_to: 'RFQ', base_price: '450.00', is_chargeable: 'true' },
        { name: 'Priority Samples', description: 'Get physical prototypes in 5 days instead of 14', category: 'Logistics', attach_to: 'Order', base_price: '150.00', is_chargeable: 'true' },
        { name: 'Basic Logistics Support', description: 'Standard shipping coordination', category: 'Logistics', attach_to: 'Request', base_price: '0.00', is_chargeable: 'false' },
    ]
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

    if (existingCustomer) {
        await db.update(schema.customers)
            .set({ 
                logo_url: DEMO.customerLogo, 
                theme_config: DEMO.customerTheme 
            })
            .where(eq(schema.customers.id, existingCustomer.id));
        return { ...existingCustomer, logo_url: DEMO.customerLogo, theme_config: DEMO.customerTheme };
    }

    const [customer] = await db.insert(schema.customers).values({
        name: DEMO.customerName,
        logo_url: DEMO.customerLogo,
        theme_config: DEMO.customerTheme,
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

async function ensureBrand(customerId: string, name: string, logo_url?: string) {
    const [existing] = await db.select().from(schema.brands)
        .where(and(eq(schema.brands.customer_id, customerId), eq(schema.brands.name, name)));

    if (existing) return existing;

    const [created] = await db.insert(schema.brands).values({ customer_id: customerId, name, logo_url }).returning();
    return created;
}

async function ensureProduct(customerId: string, brandId: string, sku: string, name: string, description?: string) {
    const [existing] = await db.select().from(schema.products)
        .where(and(eq(schema.products.customer_id, customerId), eq(schema.products.sku, sku)));

    if (existing) return existing;

    const [created] = await db.insert(schema.products).values({ customer_id: customerId, brand_id: brandId, sku, name, description }).returning();
    return created;
}

async function ensureRfqItem(rfqId: string, item: any) {
    const [existing] = await db.select().from(schema.rfqItems)
        .where(and(eq(schema.rfqItems.rfq_id, rfqId), eq(schema.rfqItems.product_id, item.product_id)));

    if (existing) return existing;

    const [created] = await db.insert(schema.rfqItems).values({ rfq_id: rfqId, ...item }).returning();
    return created;
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

async function ensureRfq(customerId: string, rfq: { state: string; rfq_number: string; product_id?: string; negotiation_status?: string }) {
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

async function ensureOrderItem(customerId: string, orderId: string, item: any) {
    const [existing] = await db.select().from(schema.orderItems)
        .where(and(eq(schema.orderItems.order_id, orderId), eq(schema.orderItems.product_id, item.product_id)));
    if (existing) return existing;
    const [created] = await db.insert(schema.orderItems).values({ ...item, customer_id: customerId, order_id: orderId }).returning();
    return created;
}

async function ensureAllocation(customerId: string, orderItemId: string, allocation: any) {
    const [existing] = await db.select().from(schema.allocations)
        .where(and(eq(schema.allocations.order_item_id, orderItemId), eq(schema.allocations.lot_number, allocation.lot_number)));
    if (existing) return existing;
    const [created] = await db.insert(schema.allocations).values({ ...allocation, customer_id: customerId, order_item_id: orderItemId }).returning();
    return created;
}

async function ensureProductionLog(customerId: string, orderId: string, log: any) {
    const [existing] = await db.select().from(schema.productionLogs)
        .where(and(eq(schema.productionLogs.order_id, orderId), eq(schema.productionLogs.stage, log.stage)));
    if (existing) return existing;
    const [created] = await db.insert(schema.productionLogs).values({ ...log, customer_id: customerId, order_id: orderId }).returning();
    return created;
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

async function ensureRequest(customerId: string, membershipId: string, request: any, productsByName: Map<string, string>) {
    const productId = request.product_name ? productsByName.get(request.product_name) : null;
    const { product_name, ...requestData } = request;

    const [existingRequest] = await db.select().from(schema.requests)
        .where(and(
            eq(schema.requests.customer_id, customerId),
            eq(schema.requests.title, request.title),
        ));

    if (existingRequest) return existingRequest;

    const [createdRequest] = await db.insert(schema.requests).values({
        customer_id: customerId,
        created_by_membership_id: membershipId,
        ...requestData,
        product_id: productId as any,
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

async function ensureService(service: typeof DEMO.services[number]) {
    const [existing] = await db.select().from(schema.services).where(eq(schema.services.name, service.name));
    if (existing) return existing;
    const [created] = await db.insert(schema.services).values(service).returning();
    return created;
}

async function ensureServiceAssignment(customerId: string, serviceId: string, entityType: string, entityId: string, status: string = 'pending') {
    const [existing] = await db.select().from(schema.serviceAssignments).where(and(
        eq(schema.serviceAssignments.customer_id, customerId),
        eq(schema.serviceAssignments.service_id, serviceId),
        eq(schema.serviceAssignments.entity_id, entityId)
    ));
    if (existing) return existing;
    await db.insert(schema.serviceAssignments).values({
        customer_id: customerId,
        service_id: serviceId,
        entity_type: entityType,
        entity_id: entityId,
        status,
    });
}

async function ensureProductFormula(productId: string, version: string, data: any) {
    const [existing] = await db.select().from(schema.productFormulas).where(and(
        eq(schema.productFormulas.product_id, productId),
        eq(schema.productFormulas.version, version)
    ));
    if (existing) return existing;
    await db.insert(schema.productFormulas).values({
        product_id: productId,
        version,
        formula_json: data,
        status: 'active',
    });
}

async function ensurePrototypeFeedback(requestId: string, membershipId: string, text: string, rating: string) {
    const [existing] = await db.select().from(schema.prototypeFeedback).where(and(
        eq(schema.prototypeFeedback.request_id, requestId),
        eq(schema.prototypeFeedback.membership_id, membershipId)
    ));
    if (existing) return existing;
    await db.insert(schema.prototypeFeedback).values({
        request_id: requestId,
        membership_id: membershipId,
        feedback_text: text,
        rating,
    });
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

    const brandsByName = new Map();
    for (const b of DEMO.brands) {
        const brand = await ensureBrand(customer.id, b.name, b.logo_url);
        brandsByName.set(b.name, brand.id);
    }

    const productsByName = new Map();
    for (const p of DEMO.products) {
        const brandId = brandsByName.get(p.brandName);
        const product = await ensureProduct(customer.id, brandId, p.sku, p.name, p.description);
        productsByName.set(p.name, product.id);
    }

    for (const rfq of DEMO.rfqs) {
        const { productName, items, ...rfqData } = rfq;
        const productId = productsByName.get(productName);
        const createdRfq = await ensureRfq(customer.id, { ...rfqData as any, product_id: productId });
        
        for (const item of items) {
            const itemProductId = productsByName.get((item as any).productName);
            await ensureRfqItem(createdRfq.id, {
                product_id: itemProductId,
                quantity: (item as any).quantity,
                target_price: (item as any).target_price,
                agreed_price: (item as any).agreed_price,
                moq_satisfied: (item as any).moq_satisfied,
            });
        }
    }

    for (const order of (DEMO as any).orders) {
        const { items, logs, allocations: orderAllocations, ...orderData } = order;
        const createdOrder = await ensureOrder(customer.id, orderData);
        
        for (const item of (items || [])) {
            const productId = productsByName.get(item.productName);
            const createdItem = await ensureOrderItem(customer.id, createdOrder.id, {
                product_id: productId,
                quantity: item.quantity,
                unit_price: item.unit_price,
            });

            // For simplicity, link allocations to the first item if provided at order level in DEMO
            if (orderAllocations) {
                for (const alloc of orderAllocations) {
                    await ensureAllocation(customer.id, createdItem.id, alloc);
                }
            }
        }

        if (logs) {
            for (const log of logs) {
                await ensureProductionLog(customer.id, createdOrder.id, log);
            }
        }
    }

    for (const request of DEMO.requests) {
        const req = await ensureRequest(customer.id, customerMembership.id, request, productsByName);
        await ensureThreadWithMessages(customer.id, req.id, customerMembership.id);
    }

    for (const notification of DEMO.notifications) {
        await ensureNotification(customer.id, notification);
    }

    const servicesByName = new Map();
    for (const s of DEMO.services) {
        const service = await ensureService(s);
        servicesByName.set(s.name, service.id);
    }

    // Assign some services to the first order
    const [firstOrder] = await db.select().from(schema.orders).limit(1);
    if (firstOrder) {
        await ensureServiceAssignment(customer.id, servicesByName.get('Stability Testing')!, 'order', firstOrder.id, 'approved');
        await ensureServiceAssignment(customer.id, servicesByName.get('Priority Samples')!, 'order', firstOrder.id, 'pending');
    }

    // Add formulas for products
    const productRows = await db.select().from(schema.products);
    for (const product of productRows) {
        await ensureProductFormula(product.id, '1.0', { 
            base: 'Purified Water', 
            actives: ['Vitamin C 10%', 'Ferulic Acid 0.5%'], 
            preservatives: ['Phenoxyethanol'] 
        });
    }

    // Add some feedback for the first request
    const [firstRequest] = await db.select().from(schema.requests).limit(1);
    if (firstRequest) {
        await ensurePrototypeFeedback(firstRequest.id, customerMembership.id, 'The texture is a bit too oily, can we make it more matte?', '3');
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
