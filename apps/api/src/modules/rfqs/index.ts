import { Router } from 'express';
import { db } from '../../db/index.js';
import { rfqs, products, brands, rfqItems } from '../../db/schema.js';
import { withTenant } from '../../db/tenant.js';
import { eq } from 'drizzle-orm';

export const rfqRouter = Router();

// GET /rfqs
rfqRouter.get('/', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const query = db.select({
            rfq: rfqs,
            product: products,
            brand: brands,
        })
        .from(rfqs)
        .leftJoin(products, eq(rfqs.product_id, products.id))
        .leftJoin(brands, eq(products.brand_id, brands.id));

        const data = await withTenant(query, rfqs, customerId);
        res.json({ rfqs: data });
    } catch (error) {
        console.error('Failed to fetch rfqs:', error);
        res.status(500).json({ error: 'Failed to fetch rfqs' });
    }
});

// GET /rfqs/:id
rfqRouter.get('/:id', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const query = db.select({
            rfq: rfqs,
            product: products,
            brand: brands,
        })
        .from(rfqs)
        .leftJoin(products, eq(rfqs.product_id, products.id))
        .leftJoin(brands, eq(products.brand_id, brands.id));

        const [data] = await withTenant(
            query,
            rfqs,
            customerId,
            eq(rfqs.id, req.params.id)
        );
        if (!data) return res.status(404).json({ error: 'Not found' });

        // Fetch real items
        const rawItems = await db.select({
            item: rfqItems,
            product: products,
        })
        .from(rfqItems)
        .innerJoin(products, eq(rfqItems.product_id, products.id))
        .where(eq(rfqItems.rfq_id, req.params.id));

        const items = rawItems.map(ri => ({
            ...ri.item,
            product: ri.product,
        }));

        res.json({ ...data, items });
    } catch (error) {
        console.error('Failed to fetch rfq:', error);
        res.status(500).json({ error: 'Failed to fetch rfq' });
    }
});

// POST /rfqs/:id/negotiate
rfqRouter.post('/:id/negotiate', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const { notes } = req.body;

        const [rfq] = await withTenant(
            db.select().from(rfqs),
            rfqs,
            customerId,
            eq(rfqs.id, req.params.id)
        );
        if (!rfq) return res.status(404).json({ error: 'Not found' });

        await db.update(rfqs)
            .set({ 
                negotiation_status: 'negotiating',
                state: 'pending_approval',
                notes: notes || rfq.notes 
            })
            .where(eq(rfqs.id, rfq.id));

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start negotiation' });
    }
});

// POST /rfqs/:id/approve-quotation
rfqRouter.post('/:id/approve-quotation', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;

        const [rfq] = await withTenant(
            db.select().from(rfqs),
            rfqs,
            customerId,
            eq(rfqs.id, req.params.id)
        );
        if (!rfq) return res.status(404).json({ error: 'Not found' });

        await db.update(rfqs)
            .set({ 
                negotiation_status: 'approved',
                state: 'confirmed'
            })
            .where(eq(rfqs.id, rfq.id));

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve quotation' });
    }
});
