import { db } from '../../db/index.js';
import { outboxEvents } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export async function runOutboxOnce(limit = 20) {
    const pending = await db.select().from(outboxEvents)
        .where(eq(outboxEvents.status as any, 'pending'))
        .limit(limit);

    for (const evt of pending) {
        try {
            // Placeholder: just mark processed
            await db.update(outboxEvents)
                .set({ status: 'processed', processed_at: new Date() })
                .where(eq(outboxEvents.id, evt.id));
        } catch (err) {
            await db.update(outboxEvents)
                .set({ status: 'failed' as any })
                .where(eq(outboxEvents.id, evt.id));
        }
    }
}
