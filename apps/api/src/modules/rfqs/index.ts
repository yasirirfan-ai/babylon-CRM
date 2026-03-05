import { Router } from 'express';
import { db } from '../../db/index.js';
import { rfqs } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { eq } from 'drizzle-orm';

export const rfqRouter = Router();

// GET /rfqs
rfqRouter.get('/', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const query = db.select().from(rfqs);
        const data = await withTenant(query, rfqs, customerId);
        res.json({ rfqs: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rfqs' });
    }
});

// GET /rfqs/:id
rfqRouter.get('/:id', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const [rfq] = await withTenant(
            db.select().from(rfqs),
            rfqs,
            customerId,
            eq(rfqs.id, req.params.id)
        );
        if (!rfq) return res.status(404).json({ error: 'Not found' });

        // mock items for now
        const items = [
            { sku: 'SKU-1', qty: 100 },
            { sku: 'SKU-2', qty: 50 },
        ];

        res.json({ rfq, items });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rfq' });
    }
});
