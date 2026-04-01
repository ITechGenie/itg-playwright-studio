CREATE TABLE `access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT 2026-04-01T02:06:25.392Z NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `data_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`environment_id` text NOT NULL,
	`name` text NOT NULL,
	`variables` text,
	`created_at` integer DEFAULT 2026-04-01T02:06:25.392Z NOT NULL,
	FOREIGN KEY (`environment_id`) REFERENCES `environments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `data_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT 2026-04-01T02:06:25.392Z NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `environments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`variables` text,
	`created_at` integer DEFAULT 2026-04-01T02:06:25.392Z NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `data_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `executions` (
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
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`project_id` text,
	`created_at` integer DEFAULT 2026-04-01T02:06:25.391Z NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`browser` text DEFAULT 'chromium' NOT NULL,
	`viewport_width` integer DEFAULT 1280 NOT NULL,
	`viewport_height` integer DEFAULT 720 NOT NULL,
	`base_url` text DEFAULT 'http://localhost:5173' NOT NULL,
	`video` text DEFAULT 'retain-on-failure' NOT NULL,
	`screenshot` text DEFAULT 'only-on-failure' NOT NULL,
	`timeout` integer DEFAULT 30000 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repo_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `template_attributes` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`scope` text NOT NULL,
	`description` text,
	FOREIGN KEY (`template_id`) REFERENCES `data_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`provider` text,
	`provider_id` text,
	`provider_username` text,
	`provider_token` text,
	`provider_token_expires_at` integer,
	`created_at` integer DEFAULT 2026-04-01T02:06:25.391Z NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_name_unique` ON `projects` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);