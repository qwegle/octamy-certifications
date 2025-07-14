import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

// Prefer "disable" if SSL is not set up locally
const databaseUrl = 'postgresql://octamy:Octamy%231234@127.0.0.1:5432/octamydb?sslmode=disable';

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
