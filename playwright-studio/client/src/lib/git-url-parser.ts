/**
 * Client-side Git URL Parser
 * 
 * Mirrors server-side parsing logic for displaying and editing Git configuration.
 * Parses GitHub and GitLab repository tree URLs to extract provider,
 * repository owner/namespace, repository name, branch, and folder path.
 */

export interface ParsedGitUrl {
  provider: 'github' | 'gitlab';
  repoOwner: string;
  repoName: string;
  branch: string;
  folderPath: string;
  repoUrl: string; // Base repo URL without tree/branch
}

export class GitUrlParser {
  // GitHub URL pattern: https://github.com/{owner}/{repo}/tree/{branch}/{path}
  private static readonly GITHUB_PATTERN = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)(?:\/(.*))?$/;
  
  // GitLab URL pattern: https://gitlab.com/{namespace}/{repo}/-/tree/{branch}/{path}
  private static readonly GITLAB_PATTERN = /^https:\/\/gitlab\.com\/((?:[^\/]+\/)+)([^\/]+)\/-\/tree\/([^\/]+)(?:\/(.*))?$/;

  /**
   * Parse a Git repository tree URL into its components.
   */
  static parse(url: string): ParsedGitUrl {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid Git URL: URL must be a non-empty string');
    }

    const trimmedUrl = url.trim();

    // Try GitHub pattern
    const githubMatch = trimmedUrl.match(this.GITHUB_PATTERN);
    if (githubMatch) {
      const [, owner, repo, branch, path] = githubMatch;
      return {
        provider: 'github',
        repoOwner: this.decodeUrlComponent(owner),
        repoName: this.decodeUrlComponent(repo),
        branch: this.decodeUrlComponent(branch),
        folderPath: path ? this.decodeUrlComponent(path) : '',
        repoUrl: `https://github.com/${owner}/${repo}`,
      };
    }

    // Try GitLab pattern
    const gitlabMatch = trimmedUrl.match(this.GITLAB_PATTERN);
    if (gitlabMatch) {
      const [, namespace, repo, branch, path] = gitlabMatch;
      const cleanNamespace = namespace.replace(/\/$/, '');
      return {
        provider: 'gitlab',
        repoOwner: this.decodeUrlComponent(cleanNamespace),
        repoName: this.decodeUrlComponent(repo),
        branch: this.decodeUrlComponent(branch),
        folderPath: path ? this.decodeUrlComponent(path) : '',
        repoUrl: `https://gitlab.com/${cleanNamespace}/${repo}`,
      };
    }

    throw new Error(
      'Invalid Git URL format. Expected GitHub or GitLab tree URL.'
    );
  }

  /**
   * Validate if a URL is a supported Git repository tree URL.
   */
  static validate(url: string): boolean {
    try {
      this.parse(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reconstruct a Git tree URL from parsed components.
   */
  static reconstruct(parts: ParsedGitUrl): string {
    const { provider, repoOwner, repoName, branch, folderPath } = parts;

    const encodedBranch = this.encodePathComponent(branch);
    const encodedPath = folderPath ? this.encodePathComponent(folderPath) : '';

    if (provider === 'github') {
      const encodedOwner = this.encodePathComponent(repoOwner);
      const encodedRepo = this.encodePathComponent(repoName);
      const pathSegment = encodedPath ? `/${encodedPath}` : '';
      return `https://github.com/${encodedOwner}/${encodedRepo}/tree/${encodedBranch}${pathSegment}`;
    } else if (provider === 'gitlab') {
      const encodedNamespace = this.encodePathComponent(repoOwner);
      const encodedRepo = this.encodePathComponent(repoName);
      const pathSegment = encodedPath ? `/${encodedPath}` : '';
      return `https://gitlab.com/${encodedNamespace}/${encodedRepo}/-/tree/${encodedBranch}${pathSegment}`;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
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
