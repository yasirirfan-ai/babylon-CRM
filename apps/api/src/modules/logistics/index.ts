import { Router } from 'express';
import { db } from '../../db/index.js';
import { orders } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { eq } from 'drizzle-orm';

export const logisticsRouter = Router();

// GET /logistics/shipping-rates
// Mocking Unishippers API
logisticsRouter.get('/shipping-rates', async (req, res) => {
    try {
        const { fromZip, toZip, weight } = req.query;

        // Simulating a delay and a response from Unishippers
        const rates = [
            { carrier: 'UPS Ground', rate: 12.50, days: 3 },
            { carrier: 'FedEx Express', rate: 45.00, days: 1 },
            { carrier: 'DHL Global', rate: 32.00, days: 2 },
        ];

        res.json({ rates, query: { fromZip, toZip, weight } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch shipping rates' });
    }
});

// GET /logistics/track/:orderId
logisticsRouter.get('/track/:orderId', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const orderId = req.params.orderId;

        const query = db.select().from(orders);
        const [order] = await withTenant(query, orders, customerId, eq(orders.id, orderId));

        if (!order) return res.status(404).json({ error: 'Order not found' });

        // Mocking tracking status
        const trackingInfo = {
            trackingNumber: order.tracking_number || 'TRK-MOCK-12345',
            carrierStatus: order.carrier_status || 'In Transit',
            lastUpdate: new Date().toISOString(),
            events: [
                { time: new Date(Date.now() - 86400000).toISOString(), location: 'Warehouse', status: 'Picked up' },
                { time: new Date().toISOString(), location: 'Local Sorting Center', status: 'Arrived' },
            ]
        };

        res.json({ tracking: trackingInfo });
    } catch (error) {
        res.status(500).json({ error: 'Failed to track shipment' });
    }
});
