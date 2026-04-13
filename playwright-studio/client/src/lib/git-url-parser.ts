/**
 * Client-side Git URL Parser
 * 
 * Parses GitHub and GitLab repository URLs to extract provider,
 * repository owner/namespace, repository name.
 */

export interface ParsedGitUrl {
  provider: 'github' | 'gitlab';
  repoOwner: string;
  repoName: string;
  branch: string;
  folderPath: string;
  repoBaseUrl: string; // Base repo URL without tree/branch
}

export class GitUrlParser {
  /**
   * Parse a Git repository base URL into its components.
   * Supports custom GitLab domains (e.g., gitlab.prakash.com)
   * 
   * @param url - The Git repository base URL to parse
   * @returns Parsed Git URL components
   * @throws Error if the URL format is invalid
   */
  static parseBaseUrl(url: string): { provider: 'github' | 'gitlab', repoOwner: string, repoName: string, repoBaseUrl: string } {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid Git URL: URL must be a non-empty string');
    }

    const trimmedUrl = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
    const urlObj = new URL(trimmedUrl);
    const host = urlObj.hostname;
    
    let provider: 'github' | 'gitlab' = 'gitlab'; // Default to gitlab for custom domains
    if (host === 'github.com') {
      provider = 'github';
    }

    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new Error('Invalid repository URL format. Must include owner/namespace and repository name');
    }

    // For GitLab, namespace can contain slashes, so the repository name is always the last part.
    // For GitHub, it's strictly /owner/repo.
    const repoName = this.decodeUrlComponent(parts.pop()!);
    const repoOwner = this.decodeUrlComponent(parts.join('/'));

    return {
      provider,
      repoOwner,
      repoName,
      repoBaseUrl: trimmedUrl,
    };
  }

  /**
   * Validate if a URL is a supported Git repository base URL.
   */
  static validateBaseUrl(url: string): boolean {
    try {
      this.parseBaseUrl(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reconstruct a Git tree URL from parsed components.
   */
  static reconstruct(parts: ParsedGitUrl): string {
    const { repoBaseUrl, branch, folderPath, provider } = parts;

    const encodedBranch = this.encodePathComponent(branch);
    const encodedPath = folderPath && folderPath !== '/' ? this.encodePathComponent(folderPath) : '';
    const pathSegment = encodedPath ? `/${encodedPath}` : '';
    
    // Trim trailing slashes from baseUrl
    const base = repoBaseUrl.replace(/\/$/, '');

    if (provider === 'github') {
      return `${base}/tree/${encodedBranch}${pathSegment}`;
    } else if (provider === 'gitlab') {
      return `${base}/-/tree/${encodedBranch}${pathSegment}`;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Legacy method: Parse a full Git tree URL (for backwards compatibility or pasted URLs)
   */
  static parse(url: string): ParsedGitUrl {
    const trimmedUrl = url.trim();
    const urlObj = new URL(trimmedUrl);
    const host = urlObj.hostname;
    
    let provider: 'github' | 'gitlab' = 'gitlab';
    if (host === 'github.com') {
      provider = 'github';
    }

    const parts = urlObj.pathname.split('/').filter(Boolean);
    
    // Find tree indicator
    const treeIndex = provider === 'github' ? parts.indexOf('tree') : parts.indexOf('-');
    
    if (treeIndex === -1) {
      // Not a tree URL, treat as base URL with default branch
      const base = this.parseBaseUrl(trimmedUrl);
      return {
        ...base,
        branch: 'main',
        folderPath: '',
      };
    }

    // Parse the base part
    const baseParts = parts.slice(0, treeIndex);
    const repoName = this.decodeUrlComponent(baseParts.pop()!);
    const repoOwner = this.decodeUrlComponent(baseParts.join('/'));
    const repoBaseUrl = `${urlObj.protocol}//${urlObj.host}/${baseParts.join('/')}/${repoName}`;

    // Parse the branch and path
    // IMPORTANT: For GitLab, '-' is followed by 'tree'
    let startIndex = treeIndex + 1;
    if (provider === 'gitlab' && parts[startIndex] === 'tree') {
      startIndex++;
    }

    // Due to branch names with slashes, this legacy parse cannot perfectly distinguish branch from folder
    // But we'll do our best: assume the first part is branch, rest is path
    const branch = parts[startIndex] ? this.decodeUrlComponent(parts[startIndex]) : 'main';
    const folderParts = parts.slice(startIndex + 1);
    const folderPath = folderParts.length > 0 ? this.decodeUrlComponent(folderParts.join('/')) : '';

    return {
      provider,
      repoOwner,
      repoName,
      branch,
      folderPath,
      repoBaseUrl
    };
  }

  private static decodeUrlComponent(component: string): string {
    try {
      return decodeURIComponent(component);
    } catch {
      return component;
    }
  }

  private static encodePathComponent(component: string): string {
    return component.split('/').map(part => encodeURIComponent(part)).join('/');
  }
}
