-- Add git_repo_id column to projects table for Git integration
ALTER TABLE projects ADD COLUMN git_repo_id TEXT;
