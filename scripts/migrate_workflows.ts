import { sql } from '../lib/db';

async function migrate() {
    console.log("Adding user_id column to workflows table...");
    try {
        await sql`ALTER TABLE workflows ADD COLUMN user_id text REFERENCES "user"(id);`;
        console.log("Success! user_id column added.");
    } catch (e: any) {
        if (e.message.includes('already exists')) {
            console.log("Column user_id already exists.");
        } else {
            console.error(e);
        }
    }
    process.exit(0);
}
migrate();
