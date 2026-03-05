export interface WorkflowConfig {
    workflows: WorkflowContext[];
}

export interface WorkflowContext {
    id: string;
    name: string;
    entity_type: string;
    version: number;
    states: WorkflowState[];
    transitions: WorkflowTransition[];
}

export interface WorkflowState {
    name: string;
    description?: string;
    is_initial?: boolean;
    is_terminal?: boolean;
}

export interface WorkflowTransition {
    key: string;
    name: string;
    from_state: string;
    to_state: string;
    trigger: {
        actor_type: ('customer' | 'internal' | 'system')[];
        permissions: string[];
    };
    guards?: { name: string; params: any }[];
    effects?: { name: string; params: any }[];
    requires_approval?: boolean;
}

class WorkflowRegistry {
    private registry: Record<string, Record<number, WorkflowContext>> = {};

    public loadConfig(config: WorkflowConfig) {
        for (const wf of config.workflows) {
            if (!this.registry[wf.entity_type]) {
                this.registry[wf.entity_type] = {};
            }
            this.registry[wf.entity_type][wf.version] = wf;
        }
    }

    public getWorkflow(entityType: string, version: number = 1): WorkflowContext {
        const wf = this.registry[entityType]?.[version];
        if (!wf) {
            throw new Error(`Workflow not found for entity type '${entityType}' version ${version}`);
        }
        return wf;
    }

    public getTransitions(entityType: string, version: number = 1): WorkflowTransition[] {
        return this.getWorkflow(entityType, version).transitions;
    }

    public getAllowedTransitions(
        entityType: string,
        currentState: string,
        actorType: string,
        permissions: string[],
        version: number = 1
    ): WorkflowTransition[] {
        const allTransitions = this.getTransitions(entityType, version);

        return allTransitions.filter(t => {
            // Check state match
            if (t.from_state !== '*' && t.from_state !== currentState) return false;

            // Check actor type
            if (!t.trigger.actor_type.includes(actorType as any)) return false;

            // Check permissions (actor needs ALL required permissions for the transition)
            if (t.trigger.permissions.length > 0) {
                const hasAllPerms = t.trigger.permissions.every(p => permissions.includes(p));
                if (!hasAllPerms) return false;
            }

            return true;
        });
    }
}

export const registry = new WorkflowRegistry();
