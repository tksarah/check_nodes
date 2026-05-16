import { Pool, PoolClient, QueryResultRow } from "pg";
import { getDatabaseUrl } from "./config";

declare global {
  // eslint-disable-next-line no-var
  var __astarMonitorPool: Pool | undefined;
}

export const pool =
  globalThis.__astarMonitorPool ??
  new Pool({
    connectionString: getDatabaseUrl(),
    max: 10
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__astarMonitorPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
