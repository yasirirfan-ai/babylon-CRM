import { TransitionRequest } from '../transitionService.js';

export type GuardFunction = (req: TransitionRequest, params: any) => Promise<boolean> | boolean;

export const guardRegistry: Record<string, GuardFunction> = {
    hasAssignedAgent: async (req, params) => {
        console.log(`[Guard] hasAssignedAgent checked for entity ${req.entityId}`);
        // Stub implementation: returns true for now
        return true;
    }
};
