import { Router } from 'express';
import { db } from '../../db/index.js';
import { requests, productFormulas, prototypeFeedback } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';

export const rdRouter = Router();

rdRouter.get('/', async (req, res) => {
    const customerId = req.tenant?.customerId;
    if (!customerId) return res.status(400).json({ error: 'Missing tenant context' });

    const result = await db.select().from(requests)
        .where(and(
            eq(requests.customer_id, customerId),
            eq(requests.category, 'rd') // We'll treat category 'rd' as R&D requests
        ));

    res.json({ rdRequests: result });
});

rdRouter.get('/:id/formula', async (req, res) => {
    // id is product id
    const result = await db.select().from(productFormulas)
        .where(eq(productFormulas.product_id, req.params.id))
        .orderBy(productFormulas.version); // Latest last

    res.json({ formulas: result });
});

rdRouter.post('/:requestId/feedback', async (req, res) => {
    const membershipId = req.auth?.membershipId;
    if (!membershipId) return res.status(401).json({ error: 'Unauthorized' });

    const { feedback_text, rating } = req.body;
    await db.insert(prototypeFeedback).values({
        request_id: req.params.requestId,
        membership_id: membershipId,
        feedback_text,
        rating,
    });

    res.json({ status: 'ok' });
});

rdRouter.get('/:requestId/feedback', async (req, res) => {
    const result = await db.select().from(prototypeFeedback)
        .where(eq(prototypeFeedback.request_id, req.params.requestId));
    res.json({ feedback: result });
});

const rdStates = ['submitted', 'in_progress', 'awaiting_customer', 'approved', 'resolved'];
rdRouter.post('/:id/advance', async (req, res) => {
    const [item] = await db.select().from(requests).where(eq(requests.id, req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    
    const idx = rdStates.indexOf(item.state);
    const nextState = rdStates[(idx + 1) % rdStates.length];
    
    await db.update(requests).set({ state: nextState }).where(eq(requests.id, req.params.id));
    
    const [updated] = await db.select().from(requests).where(eq(requests.id, req.params.id));
    res.json({ rd: updated });
});
