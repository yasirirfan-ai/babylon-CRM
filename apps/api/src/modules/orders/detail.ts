import { Router } from 'express';
import { db } from '../../db/index.js';
import { orders } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { eq } from 'drizzle-orm';

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

        // Mock allocations & shipments for now
        const allocations = [
            { lot: 'LOT-001', status: 'allocated', qty: 120 },
            { lot: 'LOT-002', status: 'allocated', qty: 80 },
        ];
        const shipments = [
            { carrier: 'DHL', tracking: order.tracking_number || 'TRK-123', eta: order.eta },
        ];

        res.json({ order, allocations, shipments });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch order detail' });
    }
});
