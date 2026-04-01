import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'libsql',
  dbCredentials: {
    url: './sqlite.db',
  },
});
