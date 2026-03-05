export const effectRegistry: Record<string, Function> = {
    notifyAgent: async (entityId: string, params: any) => {
        console.log(`[Effect] Notifying agent for entity ${entityId}`);
    }
};
