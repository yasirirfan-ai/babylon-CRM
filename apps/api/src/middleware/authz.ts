import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { memberships, membershipRoles, rolePermissions, permissions } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';

export async function authzMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.auth) return next(); // already set by JWT

    const customerId = req.tenant?.customerId;
    const membershipId = req.headers['x-membership-id'] as string | undefined;

    if (!customerId) return res.status(400).json({ error: 'Missing tenant context' });
    if (!membershipId) return res.status(401).json({ error: 'Missing x-membership-id' });

    const [membership] = await db.select().from(memberships)
        .where(and(eq(memberships.id, membershipId), eq(memberships.customer_id, customerId)));

    if (!membership) return res.status(401).json({ error: 'Invalid membership' });

    const permsRows = await db
        .select({ key: permissions.name })
        .from(membershipRoles)
        .innerJoin(rolePermissions, eq(membershipRoles.role_id, rolePermissions.role_id))
        .innerJoin(permissions, eq(rolePermissions.permission_id, permissions.id))
        .where(and(eq(membershipRoles.membership_id, membershipId), eq(membershipRoles.customer_id, customerId)));

    const permKeys = [...new Set(permsRows.map(p => p.key))];

    req.auth = {
        userId: membership.user_id,
        membershipId,
        actorType: membership.actor_type,
        permissions: permKeys,
    };

    next();
}
