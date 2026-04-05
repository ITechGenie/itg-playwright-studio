/**
 * Git Sync Service Tests
 * 
 * These tests verify the Git Sync Service orchestration logic.
 * Note: These are integration-style tests that verify the service behavior
 * with real Git URL parsing but mocked provider clients.
 */

import { test, expect } from '@playwright/test';
import { DefaultGitSyncService } from './git-sync-service.js';
import { GitUrlParser } from './git-url-parser.js';

test.describe('GitSyncService', () => {
  test.describe('URL Parsing Integration', () => {
    test('should parse GitHub URL correctly', () => {
      const url = 'https://github.com/owner/repo/tree/main/tests';
      const parsed = GitUrlParser.parse(url);
      
      expect(parsed.provider).toBe('github');
      expect(parsed.repoOwner).toBe('owner');
      expect(parsed.repoName).toBe('repo');
      expect(parsed.branch).toBe('main');
      expect(parsed.folderPath).toBe('tests');
    });

    test('should parse GitLab URL correctly', () => {
      const url = 'https://gitlab.com/namespace/repo/-/tree/develop/e2e';
      const parsed = GitUrlParser.parse(url);
      
      expect(parsed.provider).toBe('gitlab');
      expect(parsed.repoOwner).toBe('namespace');
      expect(parsed.repoName).toBe('repo');
      expect(parsed.branch).toBe('develop');
      expect(parsed.folderPath).toBe('e2e');
    });

    test('should handle invalid Git URL', () => {
      const url = 'https://invalid-url.com/repo';
      
      expect(() => GitUrlParser.parse(url)).toThrow('Invalid Git URL format');
    });
  });

  test.describe('Service Instantiation', () => {
    test('should create service with default base path', () => {
      const service = new DefaultGitSyncService();
      expect(service).toBeDefined();
    });

    test('should create service with custom base path', () => {
      const service = new DefaultGitSyncService('/custom/path');
      expect(service).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid Git URL in syncProject', async () => {
      const service = new DefaultGitSyncService('/test/projects');
      const result = await service.syncProject(
        'test-project',
        'https://invalid-url.com/repo',
        'test-token'
      );
      
      expect(result.success).toBe(false);
      expect(result.filesDownloaded).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid Git URL');
    });
  });
});
