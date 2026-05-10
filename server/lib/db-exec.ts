// Helper for raw SQL queries via drizzle's node-postgres adapter.
// drizzle's `db.execute(sql\`...\`)` returns the pg QueryResult ({rows, rowCount}),
// NOT an array — so `const [x] = await db.execute(...)` silently breaks at runtime
// with "intermediate value is not iterable". This wrapper normalises to rows[].
import { db } from '../db';
import type { SQL } from 'drizzle-orm';

export async function execRows<T = any>(query: SQL): Promise<T[]> {
  const r: any = await db.execute(query);
  if (Array.isArray(r)) return r as T[];
  return (r?.rows ?? []) as T[];
}
