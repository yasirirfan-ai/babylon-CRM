import { Router } from 'express';
import { db } from '../../db/index.js';
import { orders } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { orderDetailRouter } from './detail.js';

export const ordersRouter = Router();

// GET /orders
ordersRouter.get('/', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const query = db.select().from(orders);
        const data = await withTenant(query, orders, customerId);
        res.json({ orders: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

ordersRouter.use('/', orderDetailRouter);
