CREATE SCHEMA "playwright";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp,
	"revoked" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."data_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"template_id" text NOT NULL,
	"name" text NOT NULL,
	"variables" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."data_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."environment_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"environment_id" text NOT NULL,
	"dataset_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."environments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"template_id" text NOT NULL,
	"name" text NOT NULL,
	"variables" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."executions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"status" text NOT NULL,
	"target_path" text NOT NULL,
	"command" text NOT NULL,
	"triggered_by" text DEFAULT 'anonymous' NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"exit_code" integer,
	"target_paths" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"project_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."project_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"browser" text DEFAULT 'chromium' NOT NULL,
	"viewport_width" integer DEFAULT 1280 NOT NULL,
	"viewport_height" integer DEFAULT 720 NOT NULL,
	"base_url" text DEFAULT 'http://localhost:5173' NOT NULL,
	"video" text DEFAULT 'retain-on-failure' NOT NULL,
	"screenshot" text DEFAULT 'only-on-failure' NOT NULL,
	"timeout" integer DEFAULT 30000 NOT NULL,
	"headless" integer DEFAULT 1 NOT NULL,
	"workers" integer DEFAULT 1 NOT NULL,
	"browsers" text DEFAULT '["chromium"]' NOT NULL,
	"extra_args" text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"repo_base_url" text,
	"repo_branch" text,
	"repo_folder" text DEFAULT '/',
	"git_repo_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."scheduler_lock" (
	"lock_key" text PRIMARY KEY NOT NULL,
	"holder_id" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"target_paths" text DEFAULT '[]' NOT NULL,
	"config" text NOT NULL,
	"pattern" text NOT NULL,
	"cron_expression" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_run_at" timestamp,
	"last_run_id" text,
	"next_run_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."template_attributes" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"scope" text NOT NULL,
	"description" text,
	"default_value" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playwright"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"provider" text,
	"provider_id" text,
	"provider_username" text,
	"provider_token" text,
	"provider_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."access_tokens" ADD CONSTRAINT "access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "playwright"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."data_sets" ADD CONSTRAINT "data_sets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "playwright"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."data_sets" ADD CONSTRAINT "data_sets_template_id_data_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "playwright"."data_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."data_templates" ADD CONSTRAINT "data_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "playwright"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."environment_datasets" ADD CONSTRAINT "environment_datasets_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "playwright"."environments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."environment_datasets" ADD CONSTRAINT "environment_datasets_dataset_id_data_sets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "playwright"."data_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."environments" ADD CONSTRAINT "environments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "playwright"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."environments" ADD CONSTRAINT "environments_template_id_data_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "playwright"."data_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."executions" ADD CONSTRAINT "executions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "playwright"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "playwright"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "playwright"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."memberships" ADD CONSTRAINT "memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "playwright"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."project_configs" ADD CONSTRAINT "project_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "playwright"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."schedules" ADD CONSTRAINT "schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "playwright"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playwright"."template_attributes" ADD CONSTRAINT "template_attributes_template_id_data_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "playwright"."data_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
