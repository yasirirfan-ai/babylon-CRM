import { Router } from 'express';
import { db } from '../../db/index.js';
import { services, serviceAssignments, customerServiceOverrides } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';

export const servicesRouter = Router();

servicesRouter.get('/', async (req, res) => {
    const customerId = req.tenant?.customerId;
    if (!customerId) return res.status(400).json({ error: 'Missing tenant context' });

    // Fetch base services
    const baseServices = await db.select().from(services);
    
    // Fetch overrides for this customer
    const overrides = await db.select().from(customerServiceOverrides)
        .where(eq(customerServiceOverrides.customer_id, customerId));

    // Merge overrides and map to frontend structure
    const result = baseServices.map(s => {
        const override = overrides.find(o => o.service_id === s.id);
        return {
            id: s.id,
            name: s.name,
            description: s.description,
            category: s.category,
            attachTo: s.attach_to, // Frontend expects attachTo
            chargeable: s.is_chargeable === 'true',
            status: 'available',
            base_price: override?.custom_price || s.base_price,
            is_enabled: override ? override.is_enabled === 'true' : true,
        };
    }).filter(s => s.is_enabled);

    res.json({ services: result });
});

servicesRouter.get('/assignments/:entityId', async (req, res) => {
    const customerId = req.tenant?.customerId;
    if (!customerId) return res.status(400).json({ error: 'Missing tenant context' });

    const result = await db.select().from(serviceAssignments)
        .where(and(
            eq(serviceAssignments.customer_id, customerId),
            eq(serviceAssignments.entity_id, req.params.entityId)
        ));

    res.json({ assignments: result.map(a => ({ serviceId: a.service_id, status: a.status })) });
});

servicesRouter.post('/assign', async (req, res) => {
    const customerId = req.tenant?.customerId;
    const { entityId, entityType, serviceId } = req.body;
    if (!customerId) return res.status(400).json({ error: 'Missing tenant context' });
    if (!entityId || !serviceId || !entityType) return res.status(400).json({ error: 'Missing fields' });

    // Get the price at assignment
    const [service] = await db.select().from(services).where(eq(services.id, serviceId));
    const [override] = await db.select().from(customerServiceOverrides)
        .where(and(eq(customerServiceOverrides.customer_id, customerId), eq(customerServiceOverrides.service_id, serviceId)));

    const price = override?.custom_price || service?.base_price || '0.00';

    await db.insert(serviceAssignments).values({
        customer_id: customerId,
        service_id: serviceId,
        entity_type: entityType,
        entity_id: entityId,
        price_at_assignment: price,
        status: 'pending',
    });

    const refreshed = await db.select().from(serviceAssignments).where(eq(serviceAssignments.entity_id, entityId));
    res.json({ assignments: refreshed.map(a => ({ serviceId: a.service_id, status: a.status })) });
});

servicesRouter.post('/approve', async (req, res) => {
    // Internal only
    if (req.auth?.actorType !== 'internal') return res.status(403).json({ error: 'Internal only' });

    const { entityId, serviceId } = req.body;
    await db.update(serviceAssignments)
        .set({ status: 'approved' })
        .where(and(
            eq(serviceAssignments.entity_id, entityId),
            eq(serviceAssignments.service_id, serviceId)
        ));

    const refreshed = await db.select().from(serviceAssignments).where(eq(serviceAssignments.entity_id, entityId));
    res.json({ assignments: refreshed.map(a => ({ serviceId: a.service_id, status: a.status })) });
});
