import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
 
  provider: text('provider'),
  providerId: text('provider_id'),
  providerUsername: text('provider_username'),
  providerToken: text('provider_token'),
  providerTokenExpiresAt: integer('provider_token_expires_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
});

export const memberships = sqliteTable('memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  projectId: text('project_id').references(() => projects.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const accessTokens = sqliteTable('access_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  revoked: integer('revoked').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), // short-uuid
  name: text('name').notNull().unique(), // folder name
  repoUrl: text('repo_url'),
  gitRepoId: text('git_repo_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const projectConfigs = sqliteTable('project_configs', {
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

export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(), // runId
  projectId: text('project_id').notNull().references(() => projects.id),
  status: text('status').notNull(), // running, completed, failed, stopped
  targetPath: text('target_path').notNull(),
  command: text('command').notNull(),
  triggeredBy: text('triggered_by').notNull().default('anonymous'),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }),
  duration: integer('duration'), // ms
  exitCode: integer('exit_code'),
  targetPaths: text('target_paths'), // JSON array of paths for multi-select
});

export const dataTemplates = sqliteTable('data_templates', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const templateAttributes = sqliteTable('template_attributes', {
  id: text('id').primaryKey(),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  key: text('key').notNull(),
  type: text('type').notNull(), // 'text', 'number', 'boolean', 'secret'
  scope: text('scope').notNull(), // 'environment', 'dataset'
  description: text('description'),
});

export const environments = sqliteTable('environments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  templateId: text('template_id').notNull().references(() => dataTemplates.id),
  name: text('name').notNull(),
  variables: text('variables'), // JSON string of environment-scoped values
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const dataSets = sqliteTable('data_sets', {
  id: text('id').primaryKey(),
  environmentId: text('environment_id').notNull().references(() => environments.id),
  name: text('name').notNull(),
  variables: text('variables'), // JSON string of dataset-scoped values
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  targetPaths: text('target_paths').notNull().default('[]'),   // JSON string[]
  config: text('config').notNull(),                            // JSON RunConfig
  pattern: text('pattern').notNull(),                          // JSON SchedulePattern
  cronExpression: text('cron_expression').notNull(),
  enabled: integer('enabled').notNull().default(1),            // 0 | 1
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  lastRunId: text('last_run_id'),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
});

export const schedulerLock = sqliteTable('scheduler_lock', {
  lockKey: text('lock_key').primaryKey(),                              // always 'leader'
  holderId: text('holder_id').notNull(),                               // pod UUID
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),  // TTL 30s
});
