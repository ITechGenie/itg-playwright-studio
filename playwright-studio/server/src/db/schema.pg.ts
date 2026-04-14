import { pgTable, text, integer, timestamp, pgSchema } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

export const playwrightSchema = pgSchema(process.env.DATABASE_SCHEMA || 'public');

export const users = playwrightSchema.table('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),

  provider: text('provider'),
  providerId: text('provider_id'),
  providerUsername: text('provider_username'),
  providerToken: text('provider_token'),
  providerTokenExpiresAt: timestamp('provider_token_expires_at', { mode: 'date' }),

  createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`now()`),
});

export const roles = playwrightSchema.table('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
});

export const memberships = playwrightSchema.table('memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  projectId: text('project_id').references(() => projects.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`now()`),
});

export const accessTokens = playwrightSchema.table('access_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  revoked: integer('revoked').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`now()`),
  lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
});

export const projects = playwrightSchema.table('projects', {
  id: text('id').primaryKey(), // short-uuid
  name: text('name').notNull().unique(), // folder name
  repoBaseUrl: text('repo_base_url'),
  repoBranch: text('repo_branch'),
  repoFolder: text('repo_folder').default('/'),
  gitRepoId: text('git_repo_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
});

export const projectConfigs = playwrightSchema.table('project_configs', {
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

export const executions = playwrightSchema.table('executions', {
  id: text('id').primaryKey(), // runId
  projectId: text('project_id').notNull().references(() => projects.id),
  status: text('status').notNull(), // running, completed, failed, stopped
  targetPath: text('target_path').notNull(),
  command: text('command').notNull(),
  triggeredBy: text('triggered_by').notNull().default('anonymous'),
  startTime: timestamp('start_time', { mode: 'date' }).notNull(),
  endTime: timestamp('end_time', { mode: 'date' }),
  duration: integer('duration'), // ms
  exitCode: integer('exit_code'),
  targetPaths: text('target_paths'), // JSON array of paths for multi-select
});

export const dataTemplates = playwrightSchema.table('data_templates', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const templateAttributes = playwrightSchema.table('template_attributes', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  key: text('key').notNull(),
  type: text('type').notNull(), // 'text', 'number', 'boolean', 'secret'
  scope: text('scope').notNull(), // 'environment', 'dataset'
  description: text('description'),
  defaultValue: text('default_value'), // optional fallback when env/dataset doesn't set this key
});

export const environments = playwrightSchema.table('environments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  name: text('name').notNull(),
  variables: text('variables'), // JSON string of environment-scoped values
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

export const dataSets = playwrightSchema.table('data_sets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  name: text('name').notNull(),
  variables: text('variables'), // JSON string of dataset-scoped values
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
});

// Many-to-many: a dataset can be linked to multiple environments
export const environmentDatasets = playwrightSchema.table('environment_datasets', {
  id: text('id').primaryKey(),
  environmentId: text('environment_id').notNull().references(() => environments.id),
  datasetId: text('dataset_id').notNull().references(() => dataSets.id),
});

export const schedules = playwrightSchema.table('schedules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  targetPaths: text('target_paths').notNull().default('[]'),   // JSON string[]
  config: text('config').notNull(),                            // JSON RunConfig
  pattern: text('pattern').notNull(),                          // JSON SchedulePattern
  cronExpression: text('cron_expression').notNull(),
  enabled: integer('enabled').notNull().default(1),            // 0 | 1
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().default(sql`now()`),
  lastRunAt: timestamp('last_run_at', { mode: 'date' }),
  lastRunId: text('last_run_id'),
  nextRunAt: timestamp('next_run_at', { mode: 'date' }),
});

export const schedulerLock = playwrightSchema.table('scheduler_lock', {
  lockKey: text('lock_key').primaryKey(),                              // always 'leader'
  holderId: text('holder_id').notNull(),                               // pod UUID
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),  // TTL 30s
});
