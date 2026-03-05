import { Router } from 'express';
import { db } from '../../db/index.js';
import { outboxEvents } from '../../db/schema.js';
import { desc, eq } from 'drizzle-orm';

export const notificationsRouter = Router();

// GET /notifications
notificationsRouter.get('/', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        // Apply tenant filter before ordering to avoid builder errors on some drivers.
        const data = await db
            .select()
            .from(outboxEvents)
            .where(eq(outboxEvents.customer_id, customerId))
            .orderBy(desc(outboxEvents.created_at));
        res.json({ notifications: data });
    } catch (error) {
        console.error('notifications list failed', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
