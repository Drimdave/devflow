// Applies db/schema.sql to the database in DATABASE_URL. Safe to run repeatedly.
//   npm run db:migrate
// DB_SCHEMA=name applies it inside that Postgres schema instead of "public" (used to test from scratch).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL is not set. Run with:  node --env-file=.env.local scripts/migrate.mjs");
    process.exit(1);
}

const sqlText = readFileSync(fileURLToPath(new URL("../db/schema.sql", import.meta.url)), "utf8");
const schema = process.env.DB_SCHEMA;
if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema)) {
    console.error("DB_SCHEMA must be a simple lowercase name");
    process.exit(1);
}

const client = new pg.Client({ connectionString: url.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full") });
try {
    await client.connect();
    if (schema) {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
        await client.query(`SET search_path TO ${schema}`);
    }
    await client.query(sqlText); // one multi-statement script: all or nothing is not needed, every statement is idempotent
    const { rows } = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = coalesce($1, 'public') AND table_type = 'BASE TABLE' ORDER BY 1", [schema ?? null]);
    console.log(`Schema is up to date (${rows.length} tables${schema ? ` in "${schema}"` : ""}): ${rows.map((r) => r.table_name).join(", ")}`);
} catch (e) {
    console.error("Migration failed:", e.message);
    process.exitCode = 1;
} finally {
    await client.end().catch(() => {});
}
