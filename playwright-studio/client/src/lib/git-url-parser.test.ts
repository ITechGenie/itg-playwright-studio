import { test as it, expect } from '@playwright/test'
import { GitUrlParser } from './git-url-parser'

const describe = it.describe

describe('GitUrlParser', () => {
  describe('parse', () => {
    it('should parse GitHub URL with path', () => {
      const url = 'https://github.com/microsoft/playwright/tree/main/tests'
      const result = GitUrlParser.parse(url)
      
      expect(result.provider).toBe('github')
      expect(result.repoOwner).toBe('microsoft')
      expect(result.repoName).toBe('playwright')
      expect(result.branch).toBe('main')
      expect(result.folderPath).toBe('tests')
      expect(result.repoUrl).toBe('https://github.com/microsoft/playwright')
    })

    it('should parse GitHub URL without path', () => {
      const url = 'https://github.com/owner/repo/tree/main'
      const result = GitUrlParser.parse(url)
      
      expect(result.provider).toBe('github')
      expect(result.repoOwner).toBe('owner')
      expect(result.repoName).toBe('repo')
      expect(result.branch).toBe('main')
      expect(result.folderPath).toBe('')
      expect(result.repoUrl).toBe('https://github.com/owner/repo')
    })

    it('should parse GitLab URL with path', () => {
      const url = 'https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec'
      const result = GitUrlParser.parse(url)
      
      expect(result.provider).toBe('gitlab')
      expect(result.repoOwner).toBe('gitlab-org')
      expect(result.repoName).toBe('gitlab')
      expect(result.branch).toBe('master')
      expect(result.folderPath).toBe('spec')
      expect(result.repoUrl).toBe('https://gitlab.com/gitlab-org/gitlab')
    })

    it('should parse GitLab URL without path', () => {
      const url = 'https://gitlab.com/namespace/repo/-/tree/develop'
      const result = GitUrlParser.parse(url)
      
      expect(result.provider).toBe('gitlab')
      expect(result.repoOwner).toBe('namespace')
      expect(result.repoName).toBe('repo')
      expect(result.branch).toBe('develop')
      expect(result.folderPath).toBe('')
      expect(result.repoUrl).toBe('https://gitlab.com/namespace/repo')
    })

    it('should throw error for invalid URL', () => {
      expect(() => GitUrlParser.parse('https://example.com/repo')).toThrow()
      expect(() => GitUrlParser.parse('')).toThrow()
    })
  })

  describe('validate', () => {
    it('should return true for valid URLs', () => {
      expect(GitUrlParser.validate('https://github.com/owner/repo/tree/main')).toBe(true)
      expect(GitUrlParser.validate('https://gitlab.com/namespace/repo/-/tree/main')).toBe(true)
    })

    it('should return false for invalid URLs', () => {
      expect(GitUrlParser.validate('https://example.com/repo')).toBe(false)
      expect(GitUrlParser.validate('')).toBe(false)
    })
  })

  describe('reconstruct', () => {
    it('should reconstruct GitHub URL', () => {
      const parts = {
        provider: 'github' as const,
        repoOwner: 'microsoft',
        repoName: 'playwright',
        branch: 'main',
        folderPath: 'tests',
        repoUrl: 'https://github.com/microsoft/playwright',
      }
      
      const url = GitUrlParser.reconstruct(parts)
      expect(url).toBe('https://github.com/microsoft/playwright/tree/main/tests')
    })

    it('should reconstruct GitLab URL', () => {
      const parts = {
        provider: 'gitlab' as const,
        repoOwner: 'gitlab-org',
        repoName: 'gitlab',
        branch: 'master',
        folderPath: 'spec',
        repoUrl: 'https://gitlab.com/gitlab-org/gitlab',
      }
      
      const url = GitUrlParser.reconstruct(parts)
      expect(url).toBe('https://gitlab.com/gitlab-org/gitlab/-/tree/master/spec')
    })

    it('should reconstruct URL without path', () => {
      const parts = {
        provider: 'github' as const,
        repoOwner: 'owner',
        repoName: 'repo',
        branch: 'main',
        folderPath: '',
        repoUrl: 'https://github.com/owner/repo',
      }
      
      const url = GitUrlParser.reconstruct(parts)
      expect(url).toBe('https://github.com/owner/repo/tree/main')
    })
  })
})
