import { Router } from 'express';
import { db } from '../../db/index.js';
import { requests, threads, messages } from '../../db/schema.js';
import { withTenant, withTenantUpdate } from '../../db/tenant.js';
import { executeTransition } from '../workflow/transitionService.js';
import { eq, and } from 'drizzle-orm';

export const requestsRouter = Router();

// GET /requests
requestsRouter.get('/', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const query = db.select().from(requests);
        const data = await withTenant(query, requests, customerId);
        res.json({ requests: data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// GET /requests/:id
requestsRouter.get('/:id', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const query = db.select().from(requests);
        const [request] = await withTenant(query, requests, customerId, eq(requests.id, req.params.id));

        if (!request) return res.status(404).json({ error: 'Not found' });

        res.json({ request });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch request' });
    }
});

// POST /requests
requestsRouter.post('/', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const payload = req.body;
        const membershipId = req.auth?.membershipId;
        if (!membershipId) return res.status(401).json({ error: 'Unauthorized' });
        if (!payload.title) return res.status(400).json({ error: 'title required' });

        const result = await db.transaction(async (tx) => {
            // 1. Create request
            const [newRequest] = await tx.insert(requests).values({
                customer_id: customerId,
                state: 'draft', // Forced to draft per requirements
                title: payload.title,
                description: payload.description,
                category: payload.category,
                subcategory: payload.subcategory,
                priority: payload.priority,
                deadline: payload.deadline ? new Date(payload.deadline) : null,
                metadata: payload.metadata,
                created_by_membership_id: membershipId,
            }).returning();

            // 2. Create thread
            const [newThread] = await tx.insert(threads).values({
                customer_id: customerId,
                context_type: 'request',
                context_id: newRequest.id,
            }).returning();

            // 3. Post system message
            await tx.insert(messages).values({
                customer_id: customerId,
                thread_id: newThread.id,
                message_type: 'system_state_change',
                body: 'Request created in state: draft',
            });

            return newRequest;
        });

        res.status(201).json({ request: result });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// GET /requests/:id/thread
requestsRouter.get('/:id/thread', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;

        // Verify request exists to enforce tenant
        const reqQuery = db.select().from(requests);
        const [request] = await withTenant(reqQuery, requests, customerId, eq(requests.id, req.params.id));
        if (!request) return res.status(404).json({ error: 'Not found' });

        // Fetch thread
        const threadQuery = db.select().from(threads);
        const [thread] = await withTenant(threadQuery, threads, customerId, and(eq(threads.context_id, request.id), eq(threads.context_type, 'request')));
        if (!thread) return res.json({ thread: null, messages: [] });

        // Fetch messages
        const msgsQuery = db.select().from(messages);
        const msgs = await withTenant(msgsQuery, messages, customerId, eq(messages.thread_id, thread.id));

        res.json({ thread, messages: msgs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch thread' });
    }
});

// POST /requests/:id/messages
requestsRouter.post('/:id/messages', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const membershipId = req.auth?.membershipId;
        if (!membershipId) return res.status(401).json({ error: 'Unauthorized' });
        if (!req.body.body?.trim()) return res.status(400).json({ error: 'body required' });

        // Tenant check
        const reqQuery = db.select().from(requests);
        const [request] = await withTenant(reqQuery, requests, customerId, eq(requests.id, req.params.id));
        if (!request) return res.status(404).json({ error: 'Not found' });

        const threadQuery = db.select().from(threads);
        const [thread] = await withTenant(threadQuery, threads, customerId, and(eq(threads.context_id, request.id), eq(threads.context_type, 'request')));
        if (!thread) return res.status(400).json({ error: 'Thread not found' });

        const [newMessage] = await db.insert(messages).values({
            customer_id: customerId,
            thread_id: thread.id,
            message_type: 'comment',
            body: req.body.body.trim(),
            sender_membership_id: membershipId,
        }).returning();

        res.status(201).json({ message: newMessage });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// POST /requests/:id/transition
requestsRouter.post('/:id/transition', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const { transitionKey, payload } = req.body;
        const auth = req.auth;
        if (!auth) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Fetch Request & Tenant Check
        const reqQuery = db.select().from(requests);
        const [request] = await withTenant(reqQuery, requests, customerId, eq(requests.id, req.params.id));
        if (!request) return res.status(404).json({ error: 'Not found' });

        // 2. Execute Transition
        const fromState = request.state;
        const result = await executeTransition({
            customerId,
            entityType: 'request',
            entityId: request.id,
            transitionKey,
            actorUserId: auth.userId,
            actorMembershipId: auth.membershipId,
            actorType: auth.actorType,
            permissions: auth.permissions,
            currentState: fromState,
            payload
        });

        if (result.status === 'pending_approval') {
            return res.json({ status: 'pending_approval' });
        }

        // 3. Update entity state and write system message
        const toState = result.nextState!;

        await db.transaction(async (tx) => {
            // Update state with tenant guard
            await tx.update(requests)
                .set({ state: toState, updated_at: new Date() })
                .where(withTenantUpdate(requests, customerId, eq(requests.id, request.id)));

            // Write System Message scoped to tenant
            const [thread] = await tx.select().from(threads)
                .where(and(eq(threads.context_id, request.id), eq(threads.context_type, 'request'), eq(threads.customer_id, customerId)));
            if (thread) {
                let body = `[System] Transitioned from ${fromState} to ${toState}`;
                if (transitionKey === 'reject_request' && payload?.reason) {
                    body += `\nReason: ${payload.reason}`;
                }
                await tx.insert(messages).values({
                    customer_id: customerId,
                    thread_id: thread.id,
                    message_type: 'system_state_change',
                    body,
                });
            }
        });

        res.json({ success: true, fromState, toState });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /requests/:id
requestsRouter.delete('/:id', async (req, res) => {
    try {
        const customerId = req.tenant!.customerId;
        const reqId = req.params.id;

        // Verify request exists to enforce tenant
        const reqQuery = db.select().from(requests);
        const [request] = await withTenant(reqQuery, requests, customerId, eq(requests.id, reqId));
        if (!request) return res.status(404).json({ error: 'Not found' });

        await db.transaction(async (tx) => {
            // Find thread
            const [thread] = await tx.select().from(threads)
                .where(and(eq(threads.context_id, reqId), eq(threads.context_type, 'request'), eq(threads.customer_id, customerId)));

            if (thread) {
                // Delete messages
                await tx.delete(messages).where(eq(messages.thread_id, thread.id));
                // Delete thread
                await tx.delete(threads).where(eq(threads.id, thread.id));
            }

            // Delete request
            await tx.delete(requests)
                .where(withTenantUpdate(requests, customerId, eq(requests.id, reqId)));
        });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to delete request' });
    }
});
