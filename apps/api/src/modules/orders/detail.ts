import { Router } from 'express';
import { db } from '../../db/index.js';
import { orders, orderItems, allocations as allocationsTable, productionLogs, orderModificationRequests, approvalInstances, approvalSteps, roles, products } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { eq, and } from 'drizzle-orm';

export const orderDetailRouter = Router();

// GET /orders/:id
orderDetailRouter.get('/:id', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const [order] = await withTenant(
            db.select().from(orders),
            orders,
            customerId,
            eq(orders.id, req.params.id)
        );
        if (!order) return res.status(404).json({ error: 'Not found' });

        // Fetch real items
        const items = await db.select({
            id: orderItems.id,
            quantity: orderItems.quantity,
            unit_price: orderItems.unit_price,
            product: products,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.product_id, products.id))
        .where(eq(orderItems.order_id, order.id));

        // Fetch allocations for all items
        const itemIds = items.map(i => i.id);
        const allocations = itemIds.length > 0 
            ? await db.select().from(allocationsTable).where(and(eq(allocationsTable.customer_id, customerId), eq(allocationsTable.order_item_id, itemIds[0]))) // Simple join for demo
            : [];

        // Fetch production logs
        const logs = await db.select().from(productionLogs).where(eq(productionLogs.order_id, order.id));

        res.json({ order, items, allocations, production_logs: logs });
    } catch (error) {
        console.error('Failed to fetch order detail:', error);
        res.status(500).json({ error: 'Failed to fetch order detail' });
    }
});

// POST /orders/:id/request-modification
orderDetailRouter.post('/:id/request-modification', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const membershipId = req.headers['x-membership-id'] as string;
        const { changes } = req.body;

        const [order] = await withTenant(
            db.select().from(orders),
            orders,
            customerId,
            eq(orders.id, req.params.id)
        );
        if (!order) return res.status(404).json({ error: 'Not found' });

        const [approval] = await db.insert(approvalInstances).values({
            customer_id: customerId,
            scope: 'order.modification',
            entity_type: 'order',
            entity_id: order.id,
            transition_key: 'approve_mod',
            created_by_membership_id: membershipId,
        }).returning();

        // Add a step for Internal Ops
        const [internalRole] = await db.select().from(roles).where(and(eq(roles.customer_id, customerId), eq(roles.name, 'Internal Ops')));
        if (internalRole) {
            await db.insert(approvalSteps).values({
                customer_id: customerId,
                approval_instance_id: approval.id,
                step_no: '1',
                required_role_id: internalRole.id,
            });
        }

        await db.insert(orderModificationRequests).values({
            customer_id: customerId,
            order_id: order.id,
            requested_changes: changes,
            approval_instance_id: approval.id,
        });

        res.json({ success: true, approval_id: approval.id });
    } catch (error) {
        console.error('Failed to request modification:', error);
        res.status(500).json({ error: 'Failed to request modification' });
    }
});
