-- Initial consolidated schema for ITG Playwright Studio
-- Combines base tables, Auth/RBAC, and custom column additions

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  provider TEXT,
  provider_id TEXT,
  provider_username TEXT,
  provider_token TEXT,
  provider_token_expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS projects (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repo_base_url` text,
	`repo_branch` text,
	`repo_folder` text DEFAULT '/',
	`git_repo_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `projects_name_unique` ON `projects` (`name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`browser` text DEFAULT 'chromium' NOT NULL,
	`viewport_width` integer DEFAULT 1280 NOT NULL,
	`viewport_height` integer DEFAULT 720 NOT NULL,
	`base_url` text DEFAULT 'http://localhost:5173' NOT NULL,
	`video` text DEFAULT 'retain-on-failure' NOT NULL,
	`screenshot` text DEFAULT 'only-on-failure' NOT NULL,
	`timeout` integer DEFAULT 30000 NOT NULL,
	`headless` integer DEFAULT 1 NOT NULL,
	`workers` integer DEFAULT 1 NOT NULL,
	`browsers` text DEFAULT '["chromium"]' NOT NULL,
	`extra_args` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `executions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`target_path` text NOT NULL,
	`command` text NOT NULL,
	`triggered_by` text DEFAULT 'anonymous' NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`duration` integer,
	`exit_code` integer,
    `target_paths` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  project_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE (user_id, role_id, project_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS access_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER,
  revoked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  last_used_at INTEGER
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `data_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `template_attributes` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`scope` text NOT NULL,
	`description` text,
	`default_value` text,
	FOREIGN KEY (`template_id`) REFERENCES `data_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `environments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`variables` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `data_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `data_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`variables` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `data_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `environment_datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`dataset_id` text NOT NULL,
	FOREIGN KEY (`environment_id`) REFERENCES `environments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dataset_id`) REFERENCES `data_sets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`),
  `name` text NOT NULL,
  `target_paths` text NOT NULL DEFAULT '[]',
  `config` text NOT NULL,
  `pattern` text NOT NULL,
  `cron_expression` text NOT NULL,
  `enabled` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL,
  `last_run_at` integer,
  `last_run_id` text,
  `next_run_at` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scheduler_lock` (
  `lock_key` text PRIMARY KEY NOT NULL,
  `holder_id` text NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_memberships_user_project ON memberships(user_id, project_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_access_tokens_hash ON access_tokens(token_hash);
--> statement-breakpoint
INSERT OR IGNORE INTO roles (id, name, scope)
VALUES
  ('role_super_admin', 'super_admin', 'global'),
  ('role_admin', 'admin', 'project'),
  ('role_user_global', 'user', 'global');
