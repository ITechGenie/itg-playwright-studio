/**
 * One-time Postgres setup script.
 * Creates the schema (if needed) and all tables via drizzle-orm.
 * Run with: npx tsx scripts/pg-setup.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import pkg from 'pg';
const { Pool } = pkg;

const url = process.env.DATABASE_URL!;
const schema = process.env.DATABASE_SCHEMA || 'public';

if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

const tables = [
  `CREATE TABLE IF NOT EXISTS ${schema}.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar_url TEXT,
    provider TEXT,
    provider_id TEXT,
    provider_username TEXT,
    provider_token TEXT,
    provider_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES ${schema}.users(id),
    role_id TEXT NOT NULL REFERENCES ${schema}.roles(id),
    project_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.access_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES ${schema}.users(id),
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    repo_base_url TEXT,
    repo_branch TEXT,
    repo_folder TEXT DEFAULT '/',
    git_repo_id TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `ALTER TABLE ${schema}.memberships ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES ${schema}.projects(id)`,
  `CREATE TABLE IF NOT EXISTS ${schema}.project_configs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ${schema}.projects(id),
    browser TEXT NOT NULL DEFAULT 'chromium',
    viewport_width INTEGER NOT NULL DEFAULT 1280,
    viewport_height INTEGER NOT NULL DEFAULT 720,
    base_url TEXT NOT NULL DEFAULT 'http://localhost:5173',
    video TEXT NOT NULL DEFAULT 'retain-on-failure',
    screenshot TEXT NOT NULL DEFAULT 'only-on-failure',
    timeout INTEGER NOT NULL DEFAULT 30000,
    headless INTEGER NOT NULL DEFAULT 1,
    workers INTEGER NOT NULL DEFAULT 1,
    browsers TEXT NOT NULL DEFAULT '["chromium"]',
    extra_args TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.executions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ${schema}.projects(id),
    status TEXT NOT NULL,
    target_path TEXT NOT NULL,
    command TEXT NOT NULL,
    triggered_by TEXT NOT NULL DEFAULT 'anonymous',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration INTEGER,
    exit_code INTEGER,
    target_paths TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.data_templates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ${schema}.projects(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.template_attributes (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES ${schema}.data_templates(id),
    key TEXT NOT NULL,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    description TEXT,
    default_value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.environments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ${schema}.projects(id),
    template_id TEXT NOT NULL REFERENCES ${schema}.data_templates(id),
    name TEXT NOT NULL,
    variables TEXT,
    created_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.data_sets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ${schema}.projects(id),
    template_id TEXT NOT NULL REFERENCES ${schema}.data_templates(id),
    name TEXT NOT NULL,
    variables TEXT,
    created_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.environment_datasets (
    id TEXT PRIMARY KEY,
    environment_id TEXT NOT NULL REFERENCES ${schema}.environments(id),
    dataset_id TEXT NOT NULL REFERENCES ${schema}.data_sets(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.schedules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES ${schema}.projects(id),
    name TEXT NOT NULL,
    target_paths TEXT NOT NULL DEFAULT '[]',
    config TEXT NOT NULL,
    pattern TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_run_at TIMESTAMPTZ,
    last_run_id TEXT,
    next_run_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS ${schema}.scheduler_lock (
    lock_key TEXT PRIMARY KEY,
    holder_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
];

async function run() {
  const client = await pool.connect();
  try {
    // Create schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    console.log(`[Setup] Schema "${schema}" ensured`);

    for (const ddl of tables) {
      try {
        await client.query(ddl);
        const match = ddl.match(/TABLE\s+(?:IF NOT EXISTS\s+)?(\S+)/i);
        if (match) console.log(`[Setup] Table ensured: ${match[1]}`);
      } catch (e: any) {
        console.warn(`[Setup] Warning: ${e.message}`);
      }
    }

    console.log('[Setup] Done — all tables created/verified');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
