import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "@/lib/db";

const MIGRATION_ADVISORY_LOCK_ID = 817263540;

async function main() {
  const schemaPath = join(process.cwd(), "src", "lib", "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_ADVISORY_LOCK_ID]);
    await client.query(schema);
  } finally {
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_ADVISORY_LOCK_ID]);
    client.release();
  }

  await pool.end();
  console.log("Database schema is up to date.");
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
