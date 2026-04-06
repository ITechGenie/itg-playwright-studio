/**
 * Git URL Parser
 * 
 * Parses GitHub and GitLab repository tree URLs to extract provider,
 * repository owner/namespace, repository name, branch, and folder path.
 * 
 * Supported URL formats:
 * - GitHub: https://github.com/{owner}/{repo}/tree/{branch}/{path}
 * - GitLab: https://gitlab.com/{namespace}/{repo}/-/tree/{branch}/{path}
 */

import { getGithubBaseUrl, getGitlabBaseUrl, getGithubDomain, getGitlabDomain } from './git-config.js';

export interface ParsedGitUrl {
  provider: 'github' | 'gitlab';
  repoOwner: string;
  repoName: string;
  branch: string;
  folderPath: string;
  repoUrl: string; // Base repo URL without tree/branch
}

// Utility to escape domain for regex
const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class GitUrlParser {
  /**
   * Get regex for GitHub URL
   * https://{domain}/{owner}/{repo}/tree/{branch}/{path}
   */
  private static getGithubPattern() {
    return new RegExp(
      `^https:\\/\\/${escapeRegExp(getGithubDomain())}\\/([^\\/]+)\\/([^\\/]+)\\/tree\\/([^\\/]+)(?:\\/(.*))?$`
    );
  }
  
  /**
   * Get regex for GitLab URL
   * https://{domain}/{namespace}/{repo}/-/tree/{branch}/{path}
   */
  private static getGitlabPattern() {
    return new RegExp(
      `^https:\\/\\/${escapeRegExp(getGitlabDomain())}\\/((?:[^\\/]+\\/)+)([^\\/]+)\\/-\\/tree\\/([^\\/]+)(?:\\/(.*))?$`
    );
  }

  /**
   * Parse a Git repository tree URL into its components.
   * 
   * @param url - The Git repository tree URL to parse
   * @returns Parsed Git URL components
   * @throws Error if the URL format is invalid or unsupported
   */
  static parse(url: string): ParsedGitUrl {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid Git URL: URL must be a non-empty string');
    }

    const trimmedUrl = url.trim();

    // Try GitHub pattern
    const githubMatch = trimmedUrl.match(this.getGithubPattern());
    if (githubMatch) {
      const [, owner, repo, branch, path] = githubMatch;
      return {
        provider: 'github',
        repoOwner: this.decodeUrlComponent(owner),
        repoName: this.decodeUrlComponent(repo),
        branch: this.decodeUrlComponent(branch),
        folderPath: path ? this.decodeUrlComponent(path) : '',
        repoUrl: `${getGithubBaseUrl()}/${owner}/${repo}`,
      };
    }

    // Try GitLab pattern
    const gitlabMatch = trimmedUrl.match(this.getGitlabPattern());
    if (gitlabMatch) {
      const [, namespace, repo, branch, path] = gitlabMatch;
      // Remove trailing slash from namespace
      const cleanNamespace = namespace.replace(/\/$/, '');
      return {
        provider: 'gitlab',
        repoOwner: this.decodeUrlComponent(cleanNamespace),
        repoName: this.decodeUrlComponent(repo),
        branch: this.decodeUrlComponent(branch),
        folderPath: path ? this.decodeUrlComponent(path) : '',
        repoUrl: `${getGitlabBaseUrl()}/${cleanNamespace}/${repo}`,
      };
    }

    // No pattern matched
    throw new Error(
      'Invalid Git URL format. Expected GitHub or GitLab tree URL. ' +
      'Examples: ' +
      `${getGithubBaseUrl()}/owner/repo/tree/branch/path or ` +
      `${getGitlabBaseUrl()}/namespace/repo/-/tree/branch/path`
    );
  }

  /**
   * Validate if a URL is a supported Git repository tree URL.
   * 
   * @param url - The URL to validate
   * @returns true if the URL is valid, false otherwise
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
   * 
   * @param parts - The parsed Git URL components
   * @returns The reconstructed Git tree URL
   */
  static reconstruct(parts: ParsedGitUrl): string {
    const { provider, repoOwner, repoName, branch, folderPath } = parts;

    // Encode components for URL safety, but preserve path separators
    const encodedBranch = this.encodePathComponent(branch);
    const encodedPath = folderPath ? this.encodePathComponent(folderPath) : '';

    if (provider === 'github') {
      const encodedOwner = this.encodePathComponent(repoOwner);
      const encodedRepo = this.encodePathComponent(repoName);
      const pathSegment = encodedPath ? `/${encodedPath}` : '';
      return `${getGithubBaseUrl()}/${encodedOwner}/${encodedRepo}/tree/${encodedBranch}${pathSegment}`;
    } else if (provider === 'gitlab') {
      // For GitLab, namespace can contain slashes, so don't encode them
      const encodedNamespace = this.encodePathComponent(repoOwner);
      const encodedRepo = this.encodePathComponent(repoName);
      const pathSegment = encodedPath ? `/${encodedPath}` : '';
      return `${getGitlabBaseUrl()}/${encodedNamespace}/${encodedRepo}/-/tree/${encodedBranch}${pathSegment}`;
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Decode URL-encoded component, handling special characters.
   */
  private static decodeUrlComponent(component: string): string {
    try {
      return decodeURIComponent(component);
    } catch {
      // If decoding fails, return as-is
      return component;
    }
  }

  /**
   * Encode component for URL, handling special characters.
   * This is used for simple components that shouldn't contain slashes.
   */
  private static encodeUrlComponent(component: string): string {
    return encodeURIComponent(component);
  }

  /**
   * Encode path component for URL, preserving forward slashes.
   * This is used for paths, branches, and namespaces that may contain slashes.
   */
  private static encodePathComponent(component: string): string {
    // Split by slash, encode each part, then rejoin
    return component.split('/').map(part => encodeURIComponent(part)).join('/');
  }
}
