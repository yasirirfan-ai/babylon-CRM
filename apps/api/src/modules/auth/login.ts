import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../db/index.js';
import { users, memberships, membershipRoles, rolePermissions, permissions } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { config } from '../../config/index.js';

export const loginRouter = Router();

// Simplified email-only login for demo
loginRouter.post('/login', async (req, res) => {
    const { email, customerId } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    let userMemberships = await db.select().from(memberships).where(eq(memberships.user_id, user.id));
    if (userMemberships.length === 0) return res.status(403).json({ error: 'No memberships' });

    if (customerId) {
        userMemberships = userMemberships.filter((membership) => membership.customer_id === customerId);
        if (userMemberships.length === 0) {
            return res.status(403).json({ error: 'No membership for requested customer' });
        }
    }

    // pick first membership for token; client can switch by re-login
    const m = userMemberships[0];

    const permsRows = await db
        .select({ key: permissions.name })
        .from(membershipRoles)
        .innerJoin(rolePermissions, eq(membershipRoles.role_id, rolePermissions.role_id))
        .innerJoin(permissions, eq(rolePermissions.permission_id, permissions.id))
        .where(and(eq(membershipRoles.membership_id, m.id), eq(membershipRoles.customer_id, m.customer_id)));

    const permKeys = [...new Set(permsRows.map(p => p.key))];

    const token = jwt.sign({
        userId: user.id,
        customerId: m.customer_id,
        membershipId: m.id,
        actorType: m.actor_type,
        permissions: permKeys,
    }, config.jwtSecret, { expiresIn: '12h' });

    res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
        membership: { id: m.id, actor_type: m.actor_type, customer_id: m.customer_id },
        permissions: permKeys,
    });
});
