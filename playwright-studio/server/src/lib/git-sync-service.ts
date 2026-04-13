/**
 * Git Sync Service
 * 
 * Orchestrates pulling files from a remote Git repository into a local project folder.
 * Handles parsing Git URLs, resolving repository IDs, fetching file trees, and writing
 * files to the local file system.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { GitUrlParser, ParsedGitUrl } from './git-url-parser.js';
import { createGitProviderClient, GitProviderClient, GitFile } from './git-provider-client.js';

export interface SyncResult {
  success: boolean;
  filesDownloaded: number;
  errors: string[];
}

export interface GitSyncService {
  syncProject(
    projectName: string,
    gitUrl: any,
    userToken: string
  ): Promise<SyncResult>;
}

export class DefaultGitSyncService implements GitSyncService {
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
  }

  /**
   * Sync a project from a Git repository URL
   * 
   * @param projectName - The name of the project (used for local folder)
   * @param gitUrl - The Git repository tree URL
   * @param userToken - The user's OAuth token for authentication
   * @returns Sync result with files downloaded count and any errors
   */
  async syncProject(
    projectName: string,
    gitUrl: any,
    userToken: string
  ): Promise<SyncResult> {
    const errors: string[] = [];
    let filesDownloaded = 0;
    const startTime = Date.now();

    console.log(`[GitSyncService] Starting sync for project "${projectName}"`);

    try {
      // It's actually pre-parsed now, handle if it's already an object
      let parsed: ParsedGitUrl;
      if (typeof gitUrl === 'string') {
         parsed = GitUrlParser.parse(gitUrl);
      } else {
         parsed = gitUrl as ParsedGitUrl;
      }
      
      // Create provider client
      const client = createGitProviderClient(parsed.provider);
      
      // Resolve repository ID
      const repoId = await this.resolveRepositoryId(parsed, client, userToken);
      
      // Fetch the file tree
      const tree = await client.fetchTree(repoId, parsed.branch, parsed.folderPath, userToken);
      
      // Filter to only files (not directories)
      const files = tree.filter(item => item.type === 'file');
      
      console.log(`[GitSyncService] Found ${files.length} files to sync for project "${projectName}"`);

      // Download and write each file
      for (const file of files) {
        try {
          await this.downloadAndWriteFile(
            projectName,
            file,
            repoId,
            parsed,
            client,
            userToken
          );
          filesDownloaded++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to download ${file.path}: ${errorMessage}`);
        }
      }

      const elapsed = Date.now() - startTime;
      const result: SyncResult = {
        success: errors.length === 0,
        filesDownloaded,
        errors,
      };

      console.log(`[GitSyncService] Sync completed for project "${projectName}" in ${elapsed}ms: ${filesDownloaded} files downloaded, ${errors.length} errors`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const elapsed = Date.now() - startTime;
      console.error(`[GitSyncService] Sync failed for project "${projectName}" after ${elapsed}ms: ${errorMessage}`);
      return {
        success: false,
        filesDownloaded,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Resolve the repository ID based on the provider
   * 
   * For GitLab: Resolve numeric project ID from namespace/path
   * For GitHub: Use owner/repo format
   */
  private async resolveRepositoryId(
    parsed: ParsedGitUrl,
    client: GitProviderClient,
    userToken: string
  ): Promise<string> {
    if (parsed.provider === 'gitlab') {
      // GitLab requires numeric project ID
      const gitlabClient = client as any; // Cast to access GitLab-specific method
      if (typeof gitlabClient.resolveGitLabProjectId === 'function') {
        return await gitlabClient.resolveGitLabProjectId(
          parsed.repoOwner,
          parsed.repoName,
          userToken
        );
      }
      throw new Error('GitLab client does not support project ID resolution');
    } else {
      // GitHub uses owner/repo format
      return `${parsed.repoOwner}/${parsed.repoName}`;
    }
  }

  /**
   * Download a file from the Git provider and write it to the local project folder
   */
  private async downloadAndWriteFile(
    projectName: string,
    file: GitFile,
    repoId: string,
    parsed: ParsedGitUrl,
    client: GitProviderClient,
    userToken: string
  ): Promise<void> {
    // Fetch file content
    const content = await client.fetchFileContent(repoId, file.path, parsed.branch, userToken);
    
    // Determine local file path
    // Remove the folder path prefix from the file path to get relative path
    let relativePath = file.path;
    if (parsed.folderPath) {
      const folderPrefix = parsed.folderPath.endsWith('/') 
        ? parsed.folderPath 
        : `${parsed.folderPath}/`;
      if (relativePath.startsWith(folderPrefix)) {
        relativePath = relativePath.substring(folderPrefix.length);
      }
    }
    
    const projectRoot = path.resolve(this.basePath, projectName);
    const targetPath = path.resolve(projectRoot, relativePath);
    
    // Security check: ensure target path is within project root
    if (!targetPath.startsWith(projectRoot)) {
      throw new Error(`Invalid file path: ${relativePath}`);
    }
    
    // Create parent directory if needed
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    
    // Write file content
    await fs.writeFile(targetPath, content, 'utf8');
  }
}

/**
 * Factory function to create a Git Sync Service instance
 */
export function createGitSyncService(basePath?: string): GitSyncService {
  return new DefaultGitSyncService(basePath);
}
