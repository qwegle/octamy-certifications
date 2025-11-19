import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Ensure the database is provisioned.');
}

export const client = neon(process.env.DATABASE_URL);
export const db = drizzle(client, { schema });
