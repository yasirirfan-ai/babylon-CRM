import { Request, Response, NextFunction } from 'express';

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
    const headerCustomerId = req.headers['x-customer-id'] as string | undefined;
    const tokenCustomerId = req.tenant?.customerId;
    const customerId = headerCustomerId || tokenCustomerId;

    if (headerCustomerId && tokenCustomerId && headerCustomerId !== tokenCustomerId) {
        return res.status(403).json({ error: 'Tenant header does not match authenticated tenant' });
    }

    if (!customerId) {
        return res.status(400).json({ error: 'Missing x-customer-id header' });
    }

    req.tenant = {
        customerId,
    };

    next();
}
