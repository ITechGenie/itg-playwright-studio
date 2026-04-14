import { pgTable, text, integer, timestamp, pgSchema } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

const schemaName = process.env.DATABASE_SCHEMA;
// pgSchema('public') throws — use pgTable directly for public schema
const tableFactory = (schemaName && schemaName !== 'public')
  ? pgSchema(schemaName).table.bind(pgSchema(schemaName))
  : pgTable;

export const users = tableFactory('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),

  provider: text('provider'),
  providerId: text('provider_id'),
  providerUsername: text('provider_username'),
  providerToken: text('provider_token'),
  providerTokenExpiresAt: timestamp('provider_token_expires_at'),

  createdAt: timestamp('created_at').notNull().default(sql`now()`),
});

export const roles = tableFactory('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
});

export const memberships = tableFactory('memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  projectId: text('project_id').references(() => projects.id),
  createdAt: timestamp('created_at').notNull().default(sql`now()`),
});

export const accessTokens = tableFactory('access_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at'),
  revoked: integer('revoked').notNull().default(0),
  createdAt: timestamp('created_at').notNull().default(sql`now()`),
  lastUsedAt: timestamp('last_used_at'),
});

export const projects = tableFactory('projects', {
  id: text('id').primaryKey(), // short-uuid
  name: text('name').notNull().unique(), // folder name
  repoBaseUrl: text('repo_base_url'),
  repoBranch: text('repo_branch'),
  repoFolder: text('repo_folder').default('/'),
  gitRepoId: text('git_repo_id'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const projectConfigs = tableFactory('project_configs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  browser: text('browser').default('chromium').notNull(),
  viewportWidth: integer('viewport_width').default(1280).notNull(),
  viewportHeight: integer('viewport_height').default(720).notNull(),
  baseUrl: text('base_url').default('http://localhost:5173').notNull(),
  video: text('video').default('retain-on-failure').notNull(),
  screenshot: text('screenshot').default('only-on-failure').notNull(),
  timeout: integer('timeout').default(30000).notNull(),
  headless: integer('headless').default(1).notNull(),
  workers: integer('workers').default(1).notNull(),
  browsers: text('browsers').default('["chromium"]').notNull(),            // JSON array of browser names
  extraArgs: text('extra_args').default('[]').notNull(),                   // JSON array of {flag, value}
});

export const executions = tableFactory('executions', {
  id: text('id').primaryKey(), // runId
  projectId: text('project_id').notNull().references(() => projects.id),
  status: text('status').notNull(), // running, completed, failed, stopped
  targetPath: text('target_path').notNull(),
  command: text('command').notNull(),
  triggeredBy: text('triggered_by').notNull().default('anonymous'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // ms
  exitCode: integer('exit_code'),
  targetPaths: text('target_paths'), // JSON array of paths for multi-select
});

export const dataTemplates = tableFactory('data_templates', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const templateAttributes = tableFactory('template_attributes', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  key: text('key').notNull(),
  type: text('type').notNull(), // 'text', 'number', 'boolean', 'secret'
  scope: text('scope').notNull(), // 'environment', 'dataset'
  description: text('description'),
  defaultValue: text('default_value'), // optional fallback when env/dataset doesn't set this key
});

export const environments = tableFactory('environments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  name: text('name').notNull(),
  variables: text('variables'), // JSON string of environment-scoped values
  createdAt: timestamp('created_at').notNull(),
});

export const dataSets = tableFactory('data_sets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  name: text('name').notNull(),
  variables: text('variables'), // JSON string of dataset-scoped values
  createdAt: timestamp('created_at').notNull(),
});

// Many-to-many: a dataset can be linked to multiple environments
export const environmentDatasets = tableFactory('environment_datasets', {
  id: text('id').primaryKey(),
  environmentId: text('environment_id').notNull().references(() => environments.id),
  datasetId: text('dataset_id').notNull().references(() => dataSets.id),
});

export const schedules = tableFactory('schedules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  targetPaths: text('target_paths').notNull().default('[]'),   // JSON string[]
  config: text('config').notNull(),                            // JSON RunConfig
  pattern: text('pattern').notNull(),                          // JSON SchedulePattern
  cronExpression: text('cron_expression').notNull(),
  enabled: integer('enabled').notNull().default(1),            // 0 | 1
  createdAt: timestamp('created_at').notNull().default(sql`now()`),
  lastRunAt: timestamp('last_run_at'),
  lastRunId: text('last_run_id'),
  nextRunAt: timestamp('next_run_at'),
});

export const schedulerLock = tableFactory('scheduler_lock', {
  lockKey: text('lock_key').primaryKey(),                              // always 'leader'
  holderId: text('holder_id').notNull(),                               // pod UUID
  expiresAt: timestamp('expires_at').notNull(),  // TTL 30s
});
