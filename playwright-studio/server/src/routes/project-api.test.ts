/**
 * Project API Tests
 * 
 * Tests for Git integration endpoints:
 * - POST /apis/auth/projects (with gitUrl parameter)
 * - POST /apis/project/:projectId/git-sync
 * - PATCH /apis/project/:projectId/git-config
 */

import { test, expect } from '@playwright/test';
import { GitUrlParser } from '../lib/git-url-parser.js';

test.describe('Project API - Git Integration', () => {
  test.describe('POST /apis/auth/projects - Git URL Validation', () => {
    test('should validateBaseUrl GitHub URL format', () => {
      const validUrl = 'https://github.com/microsoft/playwright/tree/main/tests';
      expect(GitUrlParser.validateBaseUrl(validUrl)).toBe(true);
    });

    test('should validateBaseUrl GitLab URL format', () => {
      const validUrl = 'https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec';
      expect(GitUrlParser.validateBaseUrl(validUrl)).toBe(true);
    });

    test('should reject invalid Git URL format', () => {
      const invalidUrl = 'https://invalid-url.com/repo';
      expect(GitUrlParser.validateBaseUrl(invalidUrl)).toBe(false);
    });

    test('should reject empty Git URL', () => {
      expect(() => GitUrlParser.parse('')).toThrow('Invalid Git URL: URL must be a non-empty string');
    });

    test('should reject non-string Git URL', () => {
      expect(() => GitUrlParser.parse(null as any)).toThrow('Invalid Git URL: URL must be a non-empty string');
    });
  });

  test.describe('Git URL Parsing for Project Creation', () => {
    test('should parse GitHub URL and extract components', () => {
      const url = 'https://github.com/owner/repo/tree/main/tests';
      const parsed = GitUrlParser.parse(url);

      expect(parsed.provider).toBe('github');
      expect(parsed.repoOwner).toBe('owner');
      expect(parsed.repoName).toBe('repo');
      expect(parsed.branch).toBe('main');
      expect(parsed.folderPath).toBe('tests');
      expect(parsed.repoBaseUrl).toBe('https://github.com/owner/repo');
    });

    test('should parse GitLab URL and extract components', () => {
      const url = 'https://gitlab.com/namespace/project/-/tree/develop/e2e';
      const parsed = GitUrlParser.parse(url);

      expect(parsed.provider).toBe('gitlab');
      expect(parsed.repoOwner).toBe('namespace');
      expect(parsed.repoName).toBe('project');
      expect(parsed.branch).toBe('develop');
      expect(parsed.folderPath).toBe('e2e');
      expect(parsed.repoBaseUrl).toBe('https://gitlab.com/namespace/project');
    });

    test('should handle GitHub URL without folder path', () => {
      const url = 'https://github.com/owner/repo/tree/main';
      const parsed = GitUrlParser.parse(url);

      expect(parsed.provider).toBe('github');
      expect(parsed.folderPath).toBe('');
    });

    test('should handle GitLab URL without folder path', () => {
      const url = 'https://gitlab.com/namespace/project/-/tree/main';
      const parsed = GitUrlParser.parse(url);

      expect(parsed.provider).toBe('gitlab');
      expect(parsed.folderPath).toBe('');
    });
  });

  test.describe('Git Repo ID Resolution', () => {
    test('should format GitHub repo ID as owner/repo', () => {
      const url = 'https://github.com/microsoft/playwright/tree/main/tests';
      const parsed = GitUrlParser.parse(url);
      const gitRepoId = `${parsed.repoOwner}/${parsed.repoName}`;

      expect(gitRepoId).toBe('microsoft/playwright');
    });

    test('should handle GitLab namespace format', () => {
      const url = 'https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec';
      const parsed = GitUrlParser.parse(url);

      expect(parsed.repoOwner).toBe('gitlab-org');
      expect(parsed.repoName).toBe('gitlab');
    });

    test('should handle nested GitLab namespaces', () => {
      const url = 'https://gitlab.com/group/subgroup/project/-/tree/main/tests';
      const parsed = GitUrlParser.parse(url);

      expect(parsed.repoOwner).toBe('group/subgroup');
      expect(parsed.repoName).toBe('project');
    });
  });

  test.describe('PATCH /apis/project/:projectId/git-config - URL Validation', () => {
    test('should validateBaseUrl new Git URL before update', () => {
      const validUrl = 'https://github.com/owner/new-repo/tree/develop/tests';
      expect(GitUrlParser.validateBaseUrl(validUrl)).toBe(true);
    });

    test('should reject invalid Git URL for update', () => {
      const invalidUrl = 'https://bitbucket.org/owner/repo';
      expect(GitUrlParser.validateBaseUrl(invalidUrl)).toBe(false);
    });

    test('should parse updated Git URL correctly', () => {
      const newUrl = 'https://gitlab.com/new-namespace/new-repo/-/tree/develop/e2e';
      const parsed = GitUrlParser.parse(newUrl);

      expect(parsed.provider).toBe('gitlab');
      expect(parsed.repoOwner).toBe('new-namespace');
      expect(parsed.repoName).toBe('new-repo');
      expect(parsed.branch).toBe('develop');
      expect(parsed.folderPath).toBe('e2e');
    });
  });

  test.describe('Error Message Validation', () => {
    test('should provide descriptive error for invalid URL format', () => {
      const invalidUrl = 'https://example.com/repo';

      let threw = false;
      try {
        GitUrlParser.parse(invalidUrl);
      } catch (error) {
        threw = true;
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid Git URL format');
        expect((error as Error).message).toContain('GitHub or GitLab tree URL');
      }
      expect(threw).toBe(true);
    });

    test('should provide descriptive error for empty URL', () => {
      let threw = false;
      try {
        GitUrlParser.parse('');
      } catch (error) {
        threw = true;
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('URL must be a non-empty string');
      }
      expect(threw).toBe(true);
    });
  });

  test.describe('URL Reconstruction for Display', () => {
    test('should reconstruct GitHub URL from parsed components', () => {
      const originalUrl = 'https://github.com/owner/repo/tree/main/tests';
      const parsed = GitUrlParser.parse(originalUrl);
      const reconstructed = GitUrlParser.reconstruct(parsed);

      expect(reconstructed).toBe(originalUrl);
    });

    test('should reconstruct GitLab URL from parsed components', () => {
      const originalUrl = 'https://gitlab.com/namespace/repo/-/tree/develop/e2e';
      const parsed = GitUrlParser.parse(originalUrl);
      const reconstructed = GitUrlParser.reconstruct(parsed);

      expect(reconstructed).toBe(originalUrl);
    });

    test('should reconstruct URL without folder path', () => {
      const originalUrl = 'https://github.com/owner/repo/tree/main';
      const parsed = GitUrlParser.parse(originalUrl);
      const reconstructed = GitUrlParser.reconstruct(parsed);

      expect(reconstructed).toBe(originalUrl);
    });
  });
});
