/**
 * Git Push Service
 * 
 * Orchestrates pushing single file changes from local project to Git repository.
 * Handles provider-specific push logic and error handling.
 */

import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { GitUrlParser } from './git-url-parser.js';
import { createGitProviderClient } from './git-provider-client.js';

export interface PushResult {
  success: boolean;
  commitSha?: string;
  error?: string;
}

export interface GitPushService {
  pushFile(
    projectId: string,
    filePath: string,
    content: string,
    commitMessage: string,
    userToken: string
  ): Promise<PushResult>;
}

export class GitPushServiceImpl implements GitPushService {
  /**
   * Push a single file change to the remote Git repository
   * 
   * @param projectId - The project ID
   * @param filePath - The file path relative to project root
   * @param content - The file content to push
   * @param commitMessage - The commit message
   * @param userToken - The user's OAuth token
   * @returns Push result with success status and optional commit SHA or error
   */
  async pushFile(
    projectId: string,
    filePath: string,
    content: string,
    commitMessage: string,
    userToken: string
  ): Promise<PushResult> {
    const startTime = Date.now();
    console.log(`[GitPushService] Starting push for project "${projectId}", file "${filePath}"`);

    try {
      // Load project Git config from database
      const project = await this.loadProjectGitConfig(projectId);
      
      if (!project.repoUrl || !project.gitRepoId) {
        console.warn(`[GitPushService] Project "${projectId}" has no Git configuration`);
        return {
          success: false,
          error: 'Project does not have Git configuration',
        };
      }

      // Parse Git URL to extract repository details
      const parsedUrl = GitUrlParser.parse(project.repoUrl);
      
      // Construct full file path (folder path + file path)
      const fullFilePath = parsedUrl.folderPath 
        ? `${parsedUrl.folderPath}/${filePath}`
        : filePath;

      // Create provider-specific client
      const client = createGitProviderClient(parsedUrl.provider);

      // Push file to Git
      await client.pushFile(
        project.gitRepoId,
        fullFilePath,
        content,
        parsedUrl.branch,
        commitMessage,
        userToken
      );

      const elapsed = Date.now() - startTime;
      console.log(`[GitPushService] Push succeeded for project "${projectId}", file "${filePath}" in ${elapsed}ms`);

      return {
        success: true,
        commitSha: undefined, // Could be extracted from API response if needed
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[GitPushService] Push failed for project "${projectId}", file "${filePath}" after ${elapsed}ms: ${errorMessage}`);
      return this.handlePushError(error);
    }
  }

  /**
   * Load project Git configuration from database
   */
  private async loadProjectGitConfig(projectId: string): Promise<{
    repoUrl: string | null;
    gitRepoId: string | null;
  }> {
    const result = await db
      .select({
        repoUrl: projects.repoUrl,
        gitRepoId: projects.gitRepoId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (result.length === 0) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return result[0];
  }

  /**
   * Handle push errors and provide clear error messages
   */
  private handlePushError(error: unknown): PushResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Authentication/permission errors
    if (errorMessage.includes('Authentication failed') || 
        errorMessage.includes('401')) {
      return {
        success: false,
        error: 'Authentication failed. Your OAuth token may be invalid or expired. Please re-authenticate.',
      };
    }

    if (errorMessage.includes('Permission denied') || 
        errorMessage.includes('403')) {
      return {
        success: false,
        error: 'Permission denied. Your OAuth token lacks the required repository write permissions.',
      };
    }

    // Not found errors
    if (errorMessage.includes('Not found') || 
        errorMessage.includes('404')) {
      return {
        success: false,
        error: 'Repository, branch, or path not found. Please check your Git configuration.',
      };
    }

    // Rate limit errors
    if (errorMessage.includes('Rate limit') || 
        errorMessage.includes('429')) {
      return {
        success: false,
        error: 'Git provider rate limit exceeded. Please try again later.',
      };
    }

    // Conflict/merge errors
    if (errorMessage.includes('conflict') || 
        errorMessage.includes('merge')) {
      return {
        success: false,
        error: 'Push failed due to conflicts. Sync from Git and try again.',
      };
    }

    // Generic error
    return {
      success: false,
      error: `Failed to push file to Git: ${errorMessage}`,
    };
  }
}

/**
 * Factory function to create Git Push Service instance
 */
export function createGitPushService(): GitPushService {
  return new GitPushServiceImpl();
}
