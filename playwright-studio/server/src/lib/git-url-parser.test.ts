import { test, expect } from '@playwright/test';
import { GitUrlParser, ParsedGitUrl } from './git-url-parser.js';

test.describe('GitUrlParser', () => {
  test.describe('parse - GitHub URLs', () => {
    test('should parse GitHub URL with path', () => {
      const url = 'https://github.com/microsoft/playwright/tree/main/tests';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'github',
        repoOwner: 'microsoft',
        repoName: 'playwright',
        branch: 'main',
        folderPath: 'tests',
        repoUrl: 'https://github.com/microsoft/playwright',
      });
    });

    test('should parse GitHub URL without path (root)', () => {
      const url = 'https://github.com/microsoft/playwright/tree/main';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'github',
        repoOwner: 'microsoft',
        repoName: 'playwright',
        branch: 'main',
        folderPath: '',
        repoUrl: 'https://github.com/microsoft/playwright',
      });
    });

    test('should parse GitHub URL with nested path', () => {
      const url = 'https://github.com/owner/repo/tree/develop/path/to/tests';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'github',
        repoOwner: 'owner',
        repoName: 'repo',
        branch: 'develop',
        folderPath: 'path/to/tests',
        repoUrl: 'https://github.com/owner/repo',
      });
    });

    test('should parse GitHub URL with branch containing slashes', () => {
      const url = 'https://github.com/owner/repo/tree/feature/branch-name/tests';
      const result = GitUrlParser.parse(url);

      // Note: GitHub URLs use /tree/{branch}/{path} format
      // So "feature/branch-name/tests" is ambiguous - it could be:
      // - branch: "feature", path: "branch-name/tests" (what we parse)
      // - branch: "feature/branch-name", path: "tests" (what user might intend)
      // Without additional context, we parse the first segment as branch
      expect(result).toEqual({
        provider: 'github',
        repoOwner: 'owner',
        repoName: 'repo',
        branch: 'feature',
        folderPath: 'branch-name/tests',
        repoUrl: 'https://github.com/owner/repo',
      });
    });

    test('should parse GitHub URL with URL-encoded characters', () => {
      const url = 'https://github.com/owner/repo/tree/main/path%20with%20spaces';
      const result = GitUrlParser.parse(url);

      expect(result.folderPath).toBe('path with spaces');
    });

    test('should parse GitHub URL with version tag as branch', () => {
      const url = 'https://github.com/microsoft/playwright/tree/v1.40.0/examples';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'github',
        repoOwner: 'microsoft',
        repoName: 'playwright',
        branch: 'v1.40.0',
        folderPath: 'examples',
        repoUrl: 'https://github.com/microsoft/playwright',
      });
    });
  });

  test.describe('parse - GitLab URLs', () => {
    test('should parse GitLab URL with path', () => {
      const url = 'https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'gitlab',
        repoOwner: 'gitlab-org',
        repoName: 'gitlab',
        branch: 'master',
        folderPath: 'spec',
        repoUrl: 'https://gitlab.com/gitlab-org/gitlab',
      });
    });

    test('should parse GitLab URL without path (root)', () => {
      const url = 'https://gitlab.com/namespace/project/-/tree/develop';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'gitlab',
        repoOwner: 'namespace',
        repoName: 'project',
        branch: 'develop',
        folderPath: '',
        repoUrl: 'https://gitlab.com/namespace/project',
      });
    });

    test('should parse GitLab URL with nested namespace', () => {
      const url = 'https://gitlab.com/group/subgroup/repo/-/tree/main/playwright';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'gitlab',
        repoOwner: 'group/subgroup',
        repoName: 'repo',
        branch: 'main',
        folderPath: 'playwright',
        repoUrl: 'https://gitlab.com/group/subgroup/repo',
      });
    });

    test('should parse GitLab URL with nested path', () => {
      const url = 'https://gitlab.com/namespace/project/-/tree/develop/tests/e2e';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'gitlab',
        repoOwner: 'namespace',
        repoName: 'project',
        branch: 'develop',
        folderPath: 'tests/e2e',
        repoUrl: 'https://gitlab.com/namespace/project',
      });
    });

    test('should parse GitLab URL with URL-encoded characters', () => {
      const url = 'https://gitlab.com/namespace/project/-/tree/main/path%20with%20spaces';
      const result = GitUrlParser.parse(url);

      expect(result.folderPath).toBe('path with spaces');
    });

    test('should parse GitLab URL with deeply nested namespace', () => {
      const url = 'https://gitlab.com/org/team/subteam/project/-/tree/main/tests';
      const result = GitUrlParser.parse(url);

      expect(result).toEqual({
        provider: 'gitlab',
        repoOwner: 'org/team/subteam',
        repoName: 'project',
        branch: 'main',
        folderPath: 'tests',
        repoUrl: 'https://gitlab.com/org/team/subteam/project',
      });
    });
  });

  test.describe('parse - Invalid URLs', () => {
    test('should throw error for empty string', () => {
      expect(() => GitUrlParser.parse('')).toThrow('Invalid Git URL: URL must be a non-empty string');
    });

    test('should throw error for non-string input', () => {
      expect(() => GitUrlParser.parse(null as any)).toThrow('Invalid Git URL: URL must be a non-empty string');
      expect(() => GitUrlParser.parse(undefined as any)).toThrow('Invalid Git URL: URL must be a non-empty string');
    });

    test('should throw error for GitHub URL without tree segment', () => {
      const url = 'https://github.com/owner/repo';
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });

    test('should throw error for GitLab URL without tree segment', () => {
      const url = 'https://gitlab.com/namespace/project';
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });

    test('should throw error for unsupported provider', () => {
      const url = 'https://bitbucket.org/owner/repo/src/main/tests';
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });

    test('should throw error for GitHub URL with wrong format', () => {
      const url = 'https://github.com/owner/repo/blob/main/file.ts';
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });

    test('should throw error for GitLab URL with wrong format', () => {
      const url = 'https://gitlab.com/namespace/project/blob/main/file.ts';
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });

    test('should throw error for malformed URL', () => {
      const url = 'not-a-url';
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });

    test('should throw error for HTTP (non-HTTPS) URL', () => {
      const url = 'http://github.com/owner/repo/tree/main/tests';
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });
  });

  test.describe('validate', () => {
    test('should return true for valid GitHub URL', () => {
      const url = 'https://github.com/microsoft/playwright/tree/main/tests';
      expect(GitUrlParser.validate(url)).toBe(true);
    });

    test('should return true for valid GitLab URL', () => {
      const url = 'https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec';
      expect(GitUrlParser.validate(url)).toBe(true);
    });

    test('should return false for invalid URL', () => {
      const url = 'https://github.com/owner/repo';
      expect(GitUrlParser.validate(url)).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(GitUrlParser.validate('')).toBe(false);
    });

    test('should return false for unsupported provider', () => {
      const url = 'https://bitbucket.org/owner/repo/src/main/tests';
      expect(GitUrlParser.validate(url)).toBe(false);
    });
  });

  test.describe('reconstruct', () => {
    test('should reconstruct GitHub URL with path', () => {
      const parts: ParsedGitUrl = {
        provider: 'github',
        repoOwner: 'microsoft',
        repoName: 'playwright',
        branch: 'main',
        folderPath: 'tests',
        repoUrl: 'https://github.com/microsoft/playwright',
      };

      const url = GitUrlParser.reconstruct(parts);
      expect(url).toBe('https://github.com/microsoft/playwright/tree/main/tests');
    });

    test('should reconstruct GitHub URL without path', () => {
      const parts: ParsedGitUrl = {
        provider: 'github',
        repoOwner: 'owner',
        repoName: 'repo',
        branch: 'main',
        folderPath: '',
        repoUrl: 'https://github.com/owner/repo',
      };

      const url = GitUrlParser.reconstruct(parts);
      expect(url).toBe('https://github.com/owner/repo/tree/main');
    });

    test('should reconstruct GitLab URL with path', () => {
      const parts: ParsedGitUrl = {
        provider: 'gitlab',
        repoOwner: 'gitlab-org',
        repoName: 'gitlab',
        branch: 'master',
        folderPath: 'spec',
        repoUrl: 'https://gitlab.com/gitlab-org/gitlab',
      };

      const url = GitUrlParser.reconstruct(parts);
      expect(url).toBe('https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec');
    });

    test('should reconstruct GitLab URL without path', () => {
      const parts: ParsedGitUrl = {
        provider: 'gitlab',
        repoOwner: 'namespace',
        repoName: 'project',
        branch: 'develop',
        folderPath: '',
        repoUrl: 'https://gitlab.com/namespace/project',
      };

      const url = GitUrlParser.reconstruct(parts);
      expect(url).toBe('https://gitlab.com/namespace/project/-/tree/develop');
    });

    test('should reconstruct GitLab URL with nested namespace', () => {
      const parts: ParsedGitUrl = {
        provider: 'gitlab',
        repoOwner: 'group/subgroup',
        repoName: 'repo',
        branch: 'main',
        folderPath: 'tests',
        repoUrl: 'https://gitlab.com/group/subgroup/repo',
      };

      const url = GitUrlParser.reconstruct(parts);
      expect(url).toBe('https://gitlab.com/group/subgroup/repo/-/tree/main/tests');
    });

    test('should handle URL encoding in reconstruction', () => {
      const parts: ParsedGitUrl = {
        provider: 'github',
        repoOwner: 'owner',
        repoName: 'repo',
        branch: 'feature/branch',
        folderPath: 'path with spaces',
        repoUrl: 'https://github.com/owner/repo',
      };

      const url = GitUrlParser.reconstruct(parts);
      // Slashes in branch/path are preserved, spaces are encoded
      expect(url).toBe('https://github.com/owner/repo/tree/feature/branch/path%20with%20spaces');
    });

    test('should throw error for unsupported provider', () => {
      const parts: ParsedGitUrl = {
        provider: 'bitbucket' as any,
        repoOwner: 'owner',
        repoName: 'repo',
        branch: 'main',
        folderPath: 'tests',
        repoUrl: 'https://bitbucket.org/owner/repo',
      };

      expect(() => GitUrlParser.reconstruct(parts)).toThrow('Unsupported provider: bitbucket');
    });
  });

  test.describe('round-trip parsing and reconstruction', () => {
    test('should maintain GitHub URL through parse and reconstruct', () => {
      const originalUrl = 'https://github.com/microsoft/playwright/tree/main/tests';
      const parsed = GitUrlParser.parse(originalUrl);
      const reconstructed = GitUrlParser.reconstruct(parsed);

      expect(reconstructed).toBe(originalUrl);
    });

    test('should maintain GitLab URL through parse and reconstruct', () => {
      const originalUrl = 'https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec';
      const parsed = GitUrlParser.parse(originalUrl);
      const reconstructed = GitUrlParser.reconstruct(parsed);

      expect(reconstructed).toBe(originalUrl);
    });

    test('should maintain GitHub URL without path through round-trip', () => {
      const originalUrl = 'https://github.com/owner/repo/tree/main';
      const parsed = GitUrlParser.parse(originalUrl);
      const reconstructed = GitUrlParser.reconstruct(parsed);

      expect(reconstructed).toBe(originalUrl);
    });

    test('should maintain GitLab URL with nested namespace through round-trip', () => {
      const originalUrl = 'https://gitlab.com/group/subgroup/repo/-/tree/main/tests';
      const parsed = GitUrlParser.parse(originalUrl);
      const reconstructed = GitUrlParser.reconstruct(parsed);

      expect(reconstructed).toBe(originalUrl);
    });
  });

  test.describe('edge cases', () => {
    test('should handle whitespace in URL', () => {
      const url = '  https://github.com/owner/repo/tree/main/tests  ';
      const result = GitUrlParser.parse(url);

      expect(result.provider).toBe('github');
      expect(result.repoOwner).toBe('owner');
    });

    test('should handle special characters in branch name', () => {
      const url = 'https://github.com/owner/repo/tree/release-v1.0.0/tests';
      const result = GitUrlParser.parse(url);

      expect(result.branch).toBe('release-v1.0.0');
    });

    test('should handle numeric branch names', () => {
      const url = 'https://github.com/owner/repo/tree/123/tests';
      const result = GitUrlParser.parse(url);

      expect(result.branch).toBe('123');
    });

    test('should handle path with dots', () => {
      const url = 'https://github.com/owner/repo/tree/main/tests/e2e.spec.ts';
      const result = GitUrlParser.parse(url);

      expect(result.folderPath).toBe('tests/e2e.spec.ts');
    });

    test('should handle path with hyphens and underscores', () => {
      const url = 'https://github.com/owner/repo/tree/main/test-folder/sub_folder';
      const result = GitUrlParser.parse(url);

      expect(result.folderPath).toBe('test-folder/sub_folder');
    });
  });
});
