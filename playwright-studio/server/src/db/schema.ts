import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const accessTokens = sqliteTable('access_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  revoked: integer('revoked').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), // short-uuid
  name: text('name').notNull().unique(), // folder name
  repoUrl: text('repo_url'),
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
