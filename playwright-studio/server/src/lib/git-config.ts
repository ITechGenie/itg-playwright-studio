/**
 * Git Configuration
 * 
 * Centralized configuration for GitHub and GitLab base URLs and derived API URLs.
 * Uses getters to ensure environment variables are evaluated when accessed.
 */

export const getGithubBaseUrl = () => process.env.GITHUB_BASE_URL || 'https://github.com';
export const getGitlabBaseUrl = () => process.env.GITLAB_BASE_URL || 'https://gitlab.com';

export const getGithubDomain = () => new URL(getGithubBaseUrl()).hostname;
export const getGitlabDomain = () => new URL(getGitlabBaseUrl()).hostname;

/**
 * Derived GitHub API URL
 * - https://api.github.com for github.com
 * - [base]/api/v3 for others (GitHub Enterprise)
 */
export const getGithubApiUrl = () => {
  const domain = getGithubDomain();
  if (domain === 'github.com') return 'https://api.github.com';
  return `${getGithubBaseUrl()}/api/v3`;
};

/**
 * Derived GitLab API URL
 * - [base]/api/v4
 */
export const getGitlabApiUrl = () => `${getGitlabBaseUrl()}/api/v4`;

/**
 * URL to fetch GitHub user emails
 */
export const getGithubEmailsUrl = () => `${getGithubApiUrl()}/user/emails`;
