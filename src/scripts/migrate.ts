import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "@/lib/db";

async function main() {
  const schemaPath = join(process.cwd(), "src", "lib", "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
  await pool.end();
  console.log("Database schema is up to date.");
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
