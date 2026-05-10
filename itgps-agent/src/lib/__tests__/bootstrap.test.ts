import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Project, Environment, Dataset, StudioClient } from '../../types';
import { NetworkError, TimeoutError } from '../studio-client';

// ── Module mocks ──────────────────────────────────────────────────────────────
// We mock cache-store and env-store so bootstrap.ts can be tested in isolation.

vi.mock('../cache-store', () => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
}));

vi.mock('../env-store', () => ({
  readLocalEnv: vi.fn(() => ({})),
  writeLocalEnv: vi.fn(),
}));

// Import after mocks are registered
import { readCache, writeCache } from '../cache-store';
import { readLocalEnv, writeLocalEnv } from '../env-store';
import { bootstrap } from '../bootstrap';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: 'proj-1',
  name: 'Test Project',
  config: {
    browser: 'chromium',
    headless: 1,
    workers: 2,
    timeout: 30000,
    baseUrl: 'http://localhost:3000',
    video: 'off',
    screenshot: 'off',
    browsers: '["chromium"]',
    extraArgs: '[]',
  },
};

const mockEnvironment: Environment = {
  id: 'env-1',
  name: 'Staging',
  variables: JSON.stringify({ BASE_URL: 'http://staging.example.com' }),
};

const mockDataset: Dataset = {
  id: 'ds-1',
  name: 'Dataset A',
  variables: JSON.stringify({ MY_VAR: 'dataset-value' }),
};

/** Creates a fully-working mock StudioClient */
function makeSuccessClient(): StudioClient {
  return {
    getMe: vi.fn(),
    getProjects: vi.fn().mockResolvedValue([mockProject]),
    getEnvironments: vi.fn().mockResolvedValue([mockEnvironment]),
    getDatasets: vi.fn().mockResolvedValue([mockDataset]),
    triggerRun: vi.fn(),
    getRunStatus: vi.fn(),
    reportLocalRun: vi.fn(),
    triggerGitSync: vi.fn(),
  } as unknown as StudioClient;
}

/** Creates a StudioClient that always throws NetworkError */
function makeNetworkErrorClient(): StudioClient {
  const err = new NetworkError(new Error('ECONNREFUSED'));
  return {
    getMe: vi.fn(),
    getProjects: vi.fn().mockRejectedValue(err),
    getEnvironments: vi.fn().mockRejectedValue(err),
    getDatasets: vi.fn().mockRejectedValue(err),
    triggerRun: vi.fn(),
    getRunStatus: vi.fn(),
    reportLocalRun: vi.fn(),
    triggerGitSync: vi.fn(),
  } as unknown as StudioClient;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a CacheEntry-shaped object for the given data */
function makeCacheEntry<T>(data: T) {
  return { data, cachedAt: '2024-01-01T00:00:00.000Z' };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('bootstrap', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'itgps-bootstrap-test-'));
    vi.clearAllMocks();
    // Default: readLocalEnv returns empty map
    vi.mocked(readLocalEnv).mockReturnValue({});
    // Default: writeCache resolves immediately
    vi.mocked(writeCache).mockResolvedValue(undefined);
    // Default: writeLocalEnv is a no-op
    vi.mocked(writeLocalEnv).mockReturnValue(undefined);
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  // ── Test 1: NetworkError → reads from cache, fromCache: true ─────────────────
  it('when studioClient throws NetworkError, reads from cache and sets fromCache: true', async () => {
    const client = makeNetworkErrorClient();

    // Provide cached data for all three keys
    vi.mocked(readCache).mockImplementation(async (key) => {
      if (key === 'project') return makeCacheEntry([mockProject]);
      if (key === 'environments') return makeCacheEntry([mockEnvironment]);
      if (key === 'datasets') return makeCacheEntry([mockDataset]);
      return null;
    });

    const result = await bootstrap({
      studioClient: client,
      projectId: 'proj-1',
      envId: 'env-1',
      datasetId: 'ds-1',
      cwd: tmpDir,
    });

    expect(result.fromCache).toBe(true);
    expect(result.cacheTimestamp).toBe('2024-01-01T00:00:00.000Z');
    // writeCache should NOT have been called (fetch failed)
    expect(writeCache).not.toHaveBeenCalled();
    // writeLocalEnv should have been called with merged vars
    expect(writeLocalEnv).toHaveBeenCalledOnce();
  });

  // ── Test 2: NetworkError + cache is null → throws with "itgps-agent config" ──
  it('when studioClient throws NetworkError AND cache is null, throws with message containing "itgps-agent config"', async () => {
    const client = makeNetworkErrorClient();

    // All cache reads return null
    vi.mocked(readCache).mockResolvedValue(null);

    await expect(
      bootstrap({
        studioClient: client,
        projectId: 'proj-1',
        cwd: tmpDir,
      })
    ).rejects.toThrow(/itgps-agent config/);
  });

  // ── Test 3: Fetch succeeds → writeCache called, fromCache: false ─────────────
  it('when fetch succeeds, writeCache is called and fromCache is false', async () => {
    const client = makeSuccessClient();

    const result = await bootstrap({
      studioClient: client,
      projectId: 'proj-1',
      envId: 'env-1',
      datasetId: 'ds-1',
      cwd: tmpDir,
    });

    expect(result.fromCache).toBe(false);
    expect(result.cacheTimestamp).toBeUndefined();

    // writeCache should have been called for all three keys
    expect(writeCache).toHaveBeenCalledWith('project', [mockProject], tmpDir);
    expect(writeCache).toHaveBeenCalledWith('environments', [mockEnvironment], tmpDir);
    expect(writeCache).toHaveBeenCalledWith('datasets', [mockDataset], tmpDir);
    expect(writeCache).toHaveBeenCalledTimes(3);
  });

  // ── Additional: TimeoutError also falls back to cache ────────────────────────
  it('when studioClient throws TimeoutError, reads from cache and sets fromCache: true', async () => {
    const timeoutErr = new TimeoutError('/apis/auth/projects');
    const client: StudioClient = {
      getMe: vi.fn(),
      getProjects: vi.fn().mockRejectedValue(timeoutErr),
      getEnvironments: vi.fn().mockRejectedValue(timeoutErr),
      getDatasets: vi.fn().mockRejectedValue(timeoutErr),
      triggerRun: vi.fn(),
      getRunStatus: vi.fn(),
      reportLocalRun: vi.fn(),
      triggerGitSync: vi.fn(),
    } as unknown as StudioClient;

    vi.mocked(readCache).mockImplementation(async (key) => {
      if (key === 'project') return makeCacheEntry([mockProject]);
      if (key === 'environments') return makeCacheEntry([mockEnvironment]);
      if (key === 'datasets') return makeCacheEntry([mockDataset]);
      return null;
    });

    const result = await bootstrap({
      studioClient: client,
      projectId: 'proj-1',
      envId: 'env-1',
      datasetId: 'ds-1',
      cwd: tmpDir,
    });

    expect(result.fromCache).toBe(true);
  });

  // ── Additional: mergedVars includes TEST_PROJECT_DIR ─────────────────────────
  it('mergedVars always includes TEST_PROJECT_DIR set to cwd', async () => {
    const client = makeSuccessClient();

    const result = await bootstrap({
      studioClient: client,
      projectId: 'proj-1',
      envId: 'env-1',
      datasetId: 'ds-1',
      cwd: tmpDir,
    });

    expect(result.mergedVars['TEST_PROJECT_DIR']).toBe(tmpDir);
  });

  // ── Additional: envId/datasetId resolved from local .env when not in opts ────
  it('resolves envId and datasetId from local .env when not provided in opts', async () => {
    const client = makeSuccessClient();

    // Simulate local .env having ITGPS_ENV_ID and ITGPS_DATASET_ID
    vi.mocked(readLocalEnv).mockReturnValue({
      ITGPS_ENV_ID: 'env-1',
      ITGPS_DATASET_ID: 'ds-1',
    });

    const result = await bootstrap({
      studioClient: client,
      projectId: 'proj-1',
      // envId and datasetId intentionally omitted
      cwd: tmpDir,
    });

    // Dataset variable should be present in merged vars (proves dataset was found)
    expect(result.mergedVars['MY_VAR']).toBe('dataset-value');
  });

  // ── Additional: projectConfig is returned in result ───────────────────────────
  it('returns the projectConfig from the fetched project', async () => {
    const client = makeSuccessClient();

    const result = await bootstrap({
      studioClient: client,
      projectId: 'proj-1',
      envId: 'env-1',
      datasetId: 'ds-1',
      cwd: tmpDir,
    });

    expect(result.projectConfig).toEqual(mockProject.config);
  });

  // ── Additional: process.env is updated with merged vars ──────────────────────
  it('assigns all merged vars onto process.env', async () => {
    const client = makeSuccessClient();

    const result = await bootstrap({
      studioClient: client,
      projectId: 'proj-1',
      envId: 'env-1',
      datasetId: 'ds-1',
      cwd: tmpDir,
    });

    for (const [key, value] of Object.entries(result.mergedVars)) {
      expect(process.env[key]).toBe(value);
    }
  });
});
