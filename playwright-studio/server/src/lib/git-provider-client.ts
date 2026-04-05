/**
 * Git Provider Client
 * 
 * Abstracts GitLab and GitHub REST API operations for fetching repository
 * trees, file contents, and pushing file changes.
 */

export interface GitFile {
  path: string;
  type: 'file' | 'dir';
  content?: string; // For files
}

export interface GitProviderClient {
  /**
   * Fetch repository tree (list of files/folders)
   */
  fetchTree(
    repoId: string,
    branch: string,
    path: string,
    token: string
  ): Promise<GitFile[]>;

  /**
   * Fetch raw file content
   */
  fetchFileContent(
    repoId: string,
    filePath: string,
    branch: string,
    token: string
  ): Promise<string>;

  /**
   * Push file change
   */
  pushFile(
    repoId: string,
    filePath: string,
    content: string,
    branch: string,
    commitMessage: string,
    token: string
  ): Promise<void>;
}

/**
 * GitLab-specific provider client implementation
 */
export class GitLabProviderClient implements GitProviderClient {
  private readonly baseUrl = 'https://gitlab.com/api/v4';

  /**
   * Resolve GitLab numeric project ID from namespace/path
   */
  async resolveGitLabProjectId(
    namespace: string,
    repoName: string,
    token: string
  ): Promise<string> {
    const projectPath = `${namespace}/${repoName}`;
    const encodedPath = encodeURIComponent(projectPath);
    const url = `${this.baseUrl}/projects/${encodedPath}`;

    console.log(`[GitLab] resolveGitLabProjectId: projectPath="${projectPath}"`);
    console.log(`[GitLab] resolveGitLabProjectId: url="${url}"`);
    console.log(`[GitLab] resolveGitLabProjectId: token present=${!!token}, token length=${token?.length ?? 0}, token prefix="${token?.substring(0, 8)}..."`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log(`[GitLab] resolveGitLabProjectId: HTTP ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      console.error(`[GitLab] resolveGitLabProjectId: error body="${body}"`);
      // Check for insufficient scope specifically
      try {
        const parsed = JSON.parse(body);
        if (parsed.error === 'insufficient_scope') {
          throw new Error(
            `Insufficient OAuth scopes. Your token has: [${parsed.scope}]. ` +
            `Required: read_repository, write_repository. Please re-authenticate via GitLab to grant the new scopes.`
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('Insufficient OAuth')) throw e;
      }
      throw this.handleError(response.status, `Failed to resolve GitLab project ID for ${projectPath}`);
    }

    const project = await response.json();
    console.log(`[GitLab] resolveGitLabProjectId: resolved id=${project.id} for "${projectPath}"`);
    return project.id.toString();
  }

  async fetchTree(
    repoId: string,
    branch: string,
    path: string,
    token: string
  ): Promise<GitFile[]> {
    const url = new URL(`${this.baseUrl}/projects/${encodeURIComponent(repoId)}/repository/tree`);
    url.searchParams.set('ref', branch);
    url.searchParams.set('recursive', 'true');
    if (path) {
      url.searchParams.set('path', path);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw this.handleError(response.status, 'Failed to fetch GitLab repository tree');
    }

    const tree = await response.json();
    return tree
      .filter((item: any) => item.type === 'blob' || item.type === 'tree')
      .map((item: any) => ({
        path: item.path,
        type: item.type === 'blob' ? 'file' : 'dir',
      }));
  }

  async fetchFileContent(
    repoId: string,
    filePath: string,
    branch: string,
    token: string
  ): Promise<string> {
    const encodedPath = encodeURIComponent(filePath);
    const url = new URL(`${this.baseUrl}/projects/${encodeURIComponent(repoId)}/repository/files/${encodedPath}/raw`);
    url.searchParams.set('ref', branch);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw this.handleError(response.status, `Failed to fetch file content: ${filePath}`);
    }

    return await response.text();
  }

  async pushFile(
    repoId: string,
    filePath: string,
    content: string,
    branch: string,
    commitMessage: string,
    token: string
  ): Promise<void> {
    const encodedPath = encodeURIComponent(filePath);
    const url = `${this.baseUrl}/projects/${encodeURIComponent(repoId)}/repository/files/${encodedPath}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch,
        content,
        commit_message: commitMessage,
      }),
    });

    if (!response.ok) {
      throw this.handleError(response.status, `Failed to push file: ${filePath}`);
    }
  }

  private handleError(status: number, message: string): Error {
    switch (status) {
      case 401:
        return new Error(`Authentication failed: ${message}. Your OAuth token may be invalid or expired.`);
      case 403:
        return new Error(`Permission denied: ${message}. Your OAuth token lacks the required permissions.`);
      case 404:
        return new Error(`Not found: ${message}. The repository, branch, or path does not exist.`);
      case 429:
        return new Error(`Rate limit exceeded: ${message}. Please try again later.`);
      case 500:
      case 502:
      case 503:
      case 504:
        return new Error(`GitLab service error: ${message}. The provider may be experiencing issues.`);
      default:
        return new Error(`${message} (HTTP ${status})`);
    }
  }
}

/**
 * GitHub-specific provider client implementation
 */
export class GitHubProviderClient implements GitProviderClient {
  private readonly baseUrl = 'https://api.github.com';

  async fetchTree(
    repoId: string,
    branch: string,
    path: string,
    token: string
  ): Promise<GitFile[]> {
    // repoId format: "owner/repo"
    const url = `${this.baseUrl}/repos/${repoId}/git/trees/${branch}?recursive=1`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw this.handleError(response.status, 'Failed to fetch GitHub repository tree');
    }

    const data = await response.json();
    const tree = data.tree || [];

    // Filter by path prefix if specified
    let filteredTree = tree;
    if (path) {
      const pathPrefix = path.endsWith('/') ? path : `${path}/`;
      filteredTree = tree.filter((item: any) => 
        item.path.startsWith(pathPrefix) || item.path === path
      );
    }

    return filteredTree
      .filter((item: any) => item.type === 'blob' || item.type === 'tree')
      .map((item: any) => ({
        path: item.path,
        type: item.type === 'blob' ? 'file' : 'dir',
      }));
  }

  async fetchFileContent(
    repoId: string,
    filePath: string,
    branch: string,
    token: string
  ): Promise<string> {
    // repoId format: "owner/repo"
    const url = `${this.baseUrl}/repos/${repoId}/contents/${filePath}?ref=${branch}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3.raw',
      },
    });

    if (!response.ok) {
      throw this.handleError(response.status, `Failed to fetch file content: ${filePath}`);
    }

    return await response.text();
  }

  async pushFile(
    repoId: string,
    filePath: string,
    content: string,
    branch: string,
    commitMessage: string,
    token: string
  ): Promise<void> {
    // repoId format: "owner/repo"
    // GitHub requires the file SHA for updates, so we need to fetch it first
    const sha = await this.getFileSha(repoId, filePath, branch, token);

    const url = `${this.baseUrl}/repos/${repoId}/contents/${filePath}`;

    const body: any = {
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch,
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw this.handleError(response.status, `Failed to push file: ${filePath}`);
    }
  }

  /**
   * Get the SHA of an existing file (required for updates)
   * Returns null if the file doesn't exist (new file)
   */
  private async getFileSha(
    repoId: string,
    filePath: string,
    branch: string,
    token: string
  ): Promise<string | null> {
    const url = `${this.baseUrl}/repos/${repoId}/contents/${filePath}?ref=${branch}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 404) {
      // File doesn't exist, this is a new file
      return null;
    }

    if (!response.ok) {
      throw this.handleError(response.status, `Failed to get file SHA: ${filePath}`);
    }

    const data = await response.json();
    return data.sha;
  }

  private handleError(status: number, message: string): Error {
    switch (status) {
      case 401:
        return new Error(`Authentication failed: ${message}. Your OAuth token may be invalid or expired.`);
      case 403:
        return new Error(`Permission denied: ${message}. Your OAuth token lacks the required permissions.`);
      case 404:
        return new Error(`Not found: ${message}. The repository, branch, or path does not exist.`);
      case 429:
        return new Error(`Rate limit exceeded: ${message}. Please try again later.`);
      case 500:
      case 502:
      case 503:
      case 504:
        return new Error(`GitHub service error: ${message}. The provider may be experiencing issues.`);
      default:
        return new Error(`${message} (HTTP ${status})`);
    }
  }
}

/**
 * Factory function to create the appropriate provider client
 */
export function createGitProviderClient(provider: 'github' | 'gitlab'): GitProviderClient {
  switch (provider) {
    case 'gitlab':
      return new GitLabProviderClient();
    case 'github':
      return new GitHubProviderClient();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
