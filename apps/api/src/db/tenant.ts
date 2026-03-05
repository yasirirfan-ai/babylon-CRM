import { eq, and, SQL } from 'drizzle-orm';

/**
 * Shared helper to enforce tenant isolation.
 * Automatically appends a `WHERE customer_id = ...` clause to a Drizzle query.
 * 
 * Usage:
 * const query = db.select().from(workflows);
 * const data = await withTenant(query, workflows, req.tenant.customerId, eq(workflows.name, 'A'));
 */
export function withTenant<T extends { where: (condition: any) => any }, TTable extends { customer_id: any }>(
    qb: T,
    table: TTable,
    customerId: string,
    extraCondition?: SQL<unknown> | undefined
): ReturnType<T['where']> {
    if (extraCondition) {
        return qb.where(and(eq((table as any).customer_id, customerId), extraCondition));
    }
    return qb.where(eq((table as any).customer_id, customerId));
}

// Utility to assert tenant scoped updates inside transactions
export function withTenantUpdate<TTable extends { customer_id: any }>(
    table: TTable,
    customerId: string,
    extraCondition?: SQL<unknown>
) {
    if (extraCondition) {
        return and(eq((table as any).customer_id, customerId), extraCondition);
    }
    return eq((table as any).customer_id, customerId);
}
