declare global {
    namespace Express {
        interface Request {
            tenant?: {
                customerId: string;
            };
            auth?: {
                userId: string;
                membershipId: string;
                actorType: 'customer' | 'internal' | 'system';
                permissions: string[];
            };
        }
    }
}

export { };
