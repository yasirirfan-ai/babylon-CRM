import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthTokenPayload {
    userId: string;
    customerId: string;
    membershipId: string;
    actorType: 'customer' | 'internal';
    permissions: string[];
}

export function authJwt(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return next(); // allow public routes; downstream can enforce
    }
    const token = header.slice(7);
    try {
        const decoded = jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
        req.auth = {
            userId: decoded.userId,
            membershipId: decoded.membershipId,
            actorType: decoded.actorType,
            permissions: decoded.permissions,
        };
        req.tenant = req.tenant || { customerId: decoded.customerId };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
