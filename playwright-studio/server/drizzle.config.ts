import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_PATH || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

export default defineConfig(isPostgres ? {
  schema: './src/db/schema.pg.ts',
  out: './drizzle-pg',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
  },
} : {
  schema: './src/db/schema.sqlite.ts',
  out: './drizzle',
  driver: 'libsql' as any,
  dbCredentials: {
    url: './sqlite.db',
  },
});
