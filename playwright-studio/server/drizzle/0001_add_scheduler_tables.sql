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

CREATE TABLE IF NOT EXISTS `scheduler_lock` (
  `lock_key` text PRIMARY KEY NOT NULL,
  `holder_id` text NOT NULL,
  `expires_at` integer NOT NULL
);
