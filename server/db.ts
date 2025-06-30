import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const databaseUrl = "postgresql://neondb_owner:npg_UCwd5j1JDyol@ep-square-sunset-adeiym1l.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool, schema });