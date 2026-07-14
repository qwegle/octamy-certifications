import type { Pool, PoolClient } from "pg";

/**
 * Holds a PostgreSQL session advisory lock on one dedicated pool connection.
 * The callback must use the supplied client for database work so a burst of
 * distinct locks cannot exhaust the pool while waiting for another connection.
 */
export async function withSessionAdvisoryLock<T>(
  pool: Pick<Pool, "connect">,
  namespace: number,
  resourceId: number,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!Number.isInteger(namespace) || !Number.isInteger(resourceId)) {
    throw new Error("Advisory lock keys must be integers");
  }
  const client = await pool.connect();
  let locked = false;
  let releaseWithError: Error | undefined;
  try {
    await client.query("SELECT pg_advisory_lock($1, $2)", [namespace, resourceId]);
    locked = true;
    return await work(client);
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1, $2)", [namespace, resourceId]);
      } catch (error) {
        releaseWithError = error instanceof Error ? error : new Error("Failed to release advisory lock");
      }
    }
    client.release(releaseWithError);
  }
}
