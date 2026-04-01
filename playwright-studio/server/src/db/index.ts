import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import path from 'path';
import { pathToFileURL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Handle database connection string/path gracefully.
 * Supports:
 * 1. Full URLs (libsql://, https://, file://)
 * 2. Local paths (sqlite.db)
 */
function getDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL || process.env.DATABASE_PATH;
  
  // 1. If nothing is specified, default to a local sqlite file in the current directory
  if (!envUrl) {
    return pathToFileURL(path.join(process.cwd(), 'sqlite.db')).toString();
  }

  // 2. If it's already a full protocol URL, use it as-is (Turso / Remote)
  if (envUrl.includes('://') || envUrl.startsWith('file:')) {
    return envUrl;
  }

  // 3. If it's a bare path, convert to a cross-platform file URL
  return pathToFileURL(path.resolve(envUrl)).toString();
}

const url = getDatabaseUrl();
const authToken = process.env.DATABASE_AUTH_TOKEN;

console.log(`[Database] Connecting to: ${url.startsWith('file:') ? 'local' : 'remote'} database`);

const sqlite = createClient({ 
  url,
  authToken
});

export const db = drizzle(sqlite, { schema });
export const sqliteDb = sqlite;
export type Database = typeof db;
