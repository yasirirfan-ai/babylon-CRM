import { Router } from 'express';
import { registry } from './workflowRegistry.js';

export const workflowRouter = Router();

// GET /workflows
workflowRouter.get('/', (req, res) => {
    // We can return the full schema or a summary for the portal to dynamically load UI
    res.json({ workflows: (registry as any).registry });
});

// GET /workflows/:entityType
workflowRouter.get('/:entityType', (req, res) => {
    try {
        const wf = registry.getWorkflow(req.params.entityType);
        res.json(wf);
    } catch (err: any) {
        res.status(404).json({ error: err.message });
    }
});

// GET /workflows/:entityType/allowed
workflowRouter.get('/:entityType/allowed', (req, res) => {
    try {
        const currentState = req.query.state as string;
        const actorType = req.query.actorType as string;
        const permissions = (req.query.permissions as string || '').split(',').filter(Boolean);

        if (!currentState || !actorType) {
            return res.status(400).json({ error: 'Missing state or actorType in query parameters' });
        }

        const allowed = registry.getAllowedTransitions(
            req.params.entityType,
            currentState,
            actorType,
            permissions
        );

        res.json({ allowed });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});
