import { Router } from 'express';
import { db } from '../../db/index.js';
import { approvalInstances, approvalSteps, membershipRoles, outboxEvents, stateEvents } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';

export const approvalsRouter = Router();

// POST /approvals/:id/decision
approvalsRouter.post('/:id/decision', async (req, res) => {
    const { decision } = req.body as { decision: 'approved' | 'rejected' };
    const customerId = req.tenant!.customerId;
    const userId = req.auth?.userId;
    const membershipId = req.auth?.membershipId;
    if (!membershipId || !userId) return res.status(401).json({ error: 'Unauthorized' });
    if (decision !== 'approved' && decision !== 'rejected') {
        return res.status(400).json({ error: 'decision must be approved or rejected' });
    }

    const [instance] = await db.select().from(approvalInstances)
        .where(eq(approvalInstances.id, req.params.id));

    if (!instance || instance.customer_id !== customerId) {
        return res.status(404).json({ error: 'Not found' });
    }

    const [step] = await db.select().from(approvalSteps).where(eq(approvalSteps.approval_instance_id, instance.id));
    if (!step) return res.status(404).json({ error: 'Approval step not found' });
    if (instance.status !== 'pending' || step.status !== 'pending') {
        return res.status(409).json({ error: 'Approval is already decided' });
    }

    if (step.required_role_id) {
        const [authorizedRole] = await db.select().from(membershipRoles)
            .where(and(
                eq(membershipRoles.customer_id, customerId),
                eq(membershipRoles.membership_id, membershipId),
                eq(membershipRoles.role_id, step.required_role_id),
            ));

        if (!authorizedRole) {
            return res.status(403).json({ error: 'Membership is not allowed to act on this approval step' });
        }
    }

    await db.transaction(async (tx) => {
        await tx.update(approvalSteps)
            .set({ status: decision, acted_by_membership_id: membershipId || null, acted_at: new Date() })
            .where(eq(approvalSteps.id, step.id));

        await tx.update(approvalInstances)
            .set({ status: decision, decided_at: new Date() })
            .where(eq(approvalInstances.id, instance.id));

        if (decision === 'approved') {
            await tx.insert(stateEvents).values({
                customer_id: customerId,
                entity_type: instance.entity_type,
                entity_id: instance.entity_id,
                from_state: null,
                to_state: 'approved',
                actor_id: userId,
            });
            await tx.insert(outboxEvents).values({
                customer_id: customerId,
                event_type: `${instance.entity_type}.${instance.transition_key}.approved`,
                payload: { entityId: instance.entity_id },
                status: 'pending',
            });
        }
    });

    res.json({ status: decision });
});
