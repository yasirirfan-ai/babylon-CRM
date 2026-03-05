import { registry, WorkflowTransition } from './workflowRegistry.js';
import { db } from '../../db/index.js';
import { stateEvents, outboxEvents, approvalInstances, approvalSteps } from '../../db/schema.js';
import { guardRegistry } from './guards/index.js';

export interface TransitionRequest {
    customerId: string;
    entityType: string;
    entityId: string;
    transitionKey: string;
    actorUserId: string;
    actorMembershipId: string;
    actorType: 'customer' | 'internal' | 'system';
    permissions: string[];
    currentState: string;
    payload?: any;
}

export async function executeTransition(req: TransitionRequest) {
    const transitions = registry.getAllowedTransitions(
        req.entityType,
        req.currentState,
        req.actorType,
        req.permissions
    );

    const transition = transitions.find(t => t.key === req.transitionKey);

    if (!transition) {
        throw new Error(`Transition '${req.transitionKey}' is invalid or unauthorized for current state '${req.currentState}'.`);
    }

    // Execute Guards
    if (transition.guards) {
        for (const guardDef of transition.guards) {
            const guardFn = guardRegistry[guardDef.name];
            if (!guardFn) {
                throw new Error(`Guard '${guardDef.name}' is not registered.`);
            }
            const passed = await guardFn(req, guardDef.params);
            if (!passed) {
                throw new Error(`Guard '${guardDef.name}' failed.`);
            }
        }
    }

    if (transition.requires_approval) {
        // Create approval instance + steps inside transaction for atomicity
        await db.transaction(async (tx) => {
            const [instance] = await tx.insert(approvalInstances).values({
                customer_id: req.customerId,
                scope: `${req.entityType}.transition`,
                entity_type: req.entityType,
                entity_id: req.entityId,
                transition_key: req.transitionKey,
                status: 'pending',
                created_by_membership_id: req.actorMembershipId,
            }).returning();

            // For now, single-step approval; could be expanded based on workflow config
            await tx.insert(approvalSteps).values({
                customer_id: req.customerId,
                approval_instance_id: instance.id,
                step_no: '1',
                status: 'pending',
            });
        });

        return { status: 'pending_approval' };
    }

    // Process synchronous transitions (using transactions in reality, but doing direct inserts for now)
    const nextState = transition.to_state;

    await db.transaction(async (tx) => {
        // 1. Audit event
        await tx.insert(stateEvents).values({
            customer_id: req.customerId,
            entity_type: req.entityType,
            entity_id: req.entityId,
            from_state: req.currentState,
            to_state: nextState,
            actor_id: req.actorUserId,
        });

        // 2. Outbox event
        await tx.insert(outboxEvents).values({
            customer_id: req.customerId,
            event_type: `${req.entityType}.${transition.key}`,
            payload: {
                entityId: req.entityId,
                actorUserId: req.actorUserId,
                actorMembershipId: req.actorMembershipId,
                transition: transition.key,
                state: nextState,
                data: req.payload,
            }
        });

        // NOTE: The actual entity update (e.g. UPDATE requests SET status = nextState) 
        // would ideally be handled by an effect or a wrapper service, to remain generic.
    });

    return { status: 'completed', nextState };
}
