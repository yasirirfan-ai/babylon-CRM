import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index.js';

async function main() {
    console.log('Running migrations...');
    try {
        await migrate(db, { migrationsFolder: './drizzle' });
        console.log('Migrations completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main();
