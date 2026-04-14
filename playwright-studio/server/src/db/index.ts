import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as sqliteSchema from './schema.sqlite.js';
import * as pgSchema from './schema.pg.js';
import * as genericSchema from './schema.js';
import { isPostgres } from './schema.js';

import path from 'path';
import { pathToFileURL } from 'url';
import dotenv from 'dotenv';
dotenv.config();

function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL || process.env.DATABASE_PATH;
  
  if (!envUrl) {
    return pathToFileURL(path.join(process.cwd(), 'sqlite.db')).toString();
  }

  if (envUrl.includes('://') || envUrl.startsWith('file:')) {
    return envUrl;
  }

  return pathToFileURL(path.resolve(envUrl)).toString();
}

const url = getDatabaseUrl();
const authToken = process.env.DATABASE_AUTH_TOKEN;

console.log(`[Database] Connecting to: ${isPostgres ? 'postgres' : url.startsWith('file:') ? 'local sqlite' : 'remote sqlite'}`);

let dbInstance: any;

if (isPostgres) {
  const pool = new Pool({ connectionString: url });
  dbInstance = drizzlePg(pool, { schema: pgSchema });
} else {
  const sqlite = createClient({ url, authToken });
  dbInstance = drizzleSqlite(sqlite, { schema: sqliteSchema });
}

export const db = dbInstance as ReturnType<typeof drizzleSqlite<typeof genericSchema>>;
export const sqliteDb = isPostgres ? (null as any as ReturnType<typeof createClient>) : createClient({ url, authToken }); // Only used in certain raw paths, keeping interface
export type Database = typeof db;


