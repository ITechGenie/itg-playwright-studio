import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
  spinner: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(),
}));

vi.mock('../../lib/config-store', () => ({
  writeGlobalConfig: vi.fn(),
}));

vi.mock('../../lib/env-store', () => ({
  readLocalEnv: vi.fn(),
  writeLocalEnv: vi.fn(),
}));

vi.mock('../../lib/studio-client', () => ({
  createStudioClient: vi.fn(),
  AuthError: class AuthError extends Error {
    statusCode: 401 | 403;
    constructor(statusCode: 401 | 403, message: string) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
}));

vi.mock('../../lib/bootstrap', () => ({
  bootstrap: vi.fn(),
}));

vi.mock('../../lib/cache-store', () => ({
  writeCache: vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import * as clack from '@clack/prompts';
import { writeGlobalConfig } from '../../lib/config-store';
import { writeLocalEnv } from '../../lib/env-store';
import { createStudioClient, AuthError } from '../../lib/studio-client';
import { bootstrap } from '../../lib/bootstrap';
import { writeCache } from '../../lib/cache-store';
import { runConfig } from '../config';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a mock StudioClient with controllable method implementations.
 */
function makeStudioClientMock(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    getMe: vi.fn().mockResolvedValue({
      user: { id: 'u1', email: 'dev@example.com', name: 'Dev User', avatarUrl: null },
      globalRole: 'admin',
    }),
    getProjects: vi.fn().mockResolvedValue([
      { id: 'proj-1', name: 'My Project', config: {} },
    ]),
    getEnvironments: vi.fn().mockResolvedValue([
      { id: 'env-1', name: 'Staging', variables: '{}' },
    ]),
    getDatasets: vi.fn().mockResolvedValue([
      { id: 'ds-1', name: 'Default Dataset', variables: '{}' },
    ]),
    triggerRun: vi.fn(),
    getRunStatus: vi.fn(),
    reportLocalRun: vi.fn().mockResolvedValue(undefined),
    triggerGitSync: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock spinner object (start/stop).
 */
function makeSpinnerMock() {
  return { start: vi.fn(), stop: vi.fn() };
}

/**
 * Sets up the default happy-path prompt sequence:
 *   text → Studio URL
 *   password → PAT token
 *   select → storage choice
 *   select → project
 *   select → environment
 *   select → dataset
 */
function setupHappyPathPrompts(storageChoice: 'global' | 'local' = 'global') {
  const selectMock = vi.mocked(clack.select);
  let selectCallCount = 0;
  selectMock.mockImplementation(async () => {
    selectCallCount++;
    if (selectCallCount === 1) return storageChoice;   // storage choice
    if (selectCallCount === 2) return 'proj-1';         // project
    if (selectCallCount === 3) return 'env-1';          // environment
    if (selectCallCount === 4) return 'ds-1';           // dataset
    return null;
  });

  vi.mocked(clack.text).mockResolvedValue('http://studio.example.com');
  vi.mocked(clack.password).mockResolvedValue('pat_valid_token');
  vi.mocked(clack.isCancel).mockReturnValue(false);
}

// ── Test setup ────────────────────────────────────────────────────────────────

describe('runConfig', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let studioClientMock: ReturnType<typeof makeStudioClientMock>;
  let spinnerMock: ReturnType<typeof makeSpinnerMock>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Prevent process.exit from actually exiting
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined) => {
      throw new Error(`process.exit(${_code})`);
    });

    // Default studio client mock
    studioClientMock = makeStudioClientMock();
    vi.mocked(createStudioClient).mockReturnValue(studioClientMock as any);

    // Default spinner mock
    spinnerMock = makeSpinnerMock();
    vi.mocked(clack.spinner).mockReturnValue(spinnerMock as any);

    // Default bootstrap mock
    vi.mocked(bootstrap).mockResolvedValue({
      mergedVars: {},
      projectConfig: {
        browser: 'chromium',
        headless: 1,
        workers: 1,
        timeout: 30000,
        baseUrl: '',
        video: 'off',
        screenshot: 'off',
        browsers: '[]',
        extraArgs: '[]',
      },
      fromCache: false,
    });

    // Default writeCache mock
    vi.mocked(writeCache).mockResolvedValue(undefined);

    // Default clack mocks
    vi.mocked(clack.intro).mockReturnValue(undefined);
    vi.mocked(clack.outro).mockReturnValue(undefined);
    vi.mocked(clack.note).mockReturnValue(undefined);
    vi.mocked(clack.cancel).mockReturnValue(undefined);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  // ── Test 1: Invalid token (401 AuthError) causes re-prompt without saving ──
  it('re-prompts for token on 401 AuthError without saving credentials', async () => {
    // First password call returns an invalid token, second returns a valid one
    vi.mocked(clack.password)
      .mockResolvedValueOnce('pat_invalid_token')
      .mockResolvedValueOnce('pat_valid_token');

    vi.mocked(clack.text).mockResolvedValue('http://studio.example.com');
    vi.mocked(clack.isCancel).mockReturnValue(false);

    // First getMe call throws AuthError, second succeeds
    studioClientMock.getMe
      .mockRejectedValueOnce(new AuthError(401, 'Unauthorized'))
      .mockResolvedValueOnce({
        user: { id: 'u1', email: 'dev@example.com', name: 'Dev User', avatarUrl: null },
        globalRole: 'admin',
      });

    // createStudioClient is called once per token attempt — return same mock
    vi.mocked(createStudioClient).mockReturnValue(studioClientMock as any);

    // Set up remaining prompts for the happy path after re-prompt
    const selectMock = vi.mocked(clack.select);
    let selectCallCount = 0;
    selectMock.mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) return 'global';
      if (selectCallCount === 2) return 'proj-1';
      if (selectCallCount === 3) return 'env-1';
      if (selectCallCount === 4) return 'ds-1';
      return null;
    });

    await runConfig({ yes: false });

    // password should have been called twice (once for invalid, once for valid)
    expect(clack.password).toHaveBeenCalledTimes(2);

    // Credentials should NOT have been saved after the first (invalid) attempt
    // writeGlobalConfig should only be called once (after the valid token)
    expect(writeGlobalConfig).toHaveBeenCalledTimes(1);

    // The note about authentication error should have been shown
    expect(clack.note).toHaveBeenCalledWith(
      expect.stringContaining('invalid or expired'),
      expect.any(String)
    );
  });

  // ── Test 2: Global config storage path writes to writeGlobalConfig ─────────
  it('writes to writeGlobalConfig when global storage is selected', async () => {
    setupHappyPathPrompts('global');

    await runConfig({ yes: false });

    expect(writeGlobalConfig).toHaveBeenCalledOnce();
    expect(writeGlobalConfig).toHaveBeenCalledWith({
      studioUrl: 'http://studio.example.com',
      token: 'pat_valid_token',
    });

    // writeLocalEnv should NOT have been called with credentials
    const writeLocalEnvCalls = vi.mocked(writeLocalEnv).mock.calls;
    const credentialCall = writeLocalEnvCalls.find(
      ([managed]) => 'ITGPS_STUDIO_URL' in managed || 'ITGPS_TOKEN' in managed
    );
    expect(credentialCall).toBeUndefined();
  });

  // ── Test 3: Local .env storage path writes ITGPS_STUDIO_URL and ITGPS_TOKEN
  it('writes ITGPS_STUDIO_URL and ITGPS_TOKEN via writeLocalEnv when local storage is selected', async () => {
    setupHappyPathPrompts('local');

    await runConfig({ yes: false });

    expect(writeGlobalConfig).not.toHaveBeenCalled();

    // Find the call that writes credentials
    const writeLocalEnvCalls = vi.mocked(writeLocalEnv).mock.calls;
    const credentialCall = writeLocalEnvCalls.find(
      ([managed]) => 'ITGPS_STUDIO_URL' in managed || 'ITGPS_TOKEN' in managed
    );
    expect(credentialCall).toBeDefined();
    expect(credentialCall![0]).toMatchObject({
      ITGPS_STUDIO_URL: 'http://studio.example.com',
      ITGPS_TOKEN: 'pat_valid_token',
    });
  });

  // ── Test 4: ITGPS_PROJECT_ID, ITGPS_ENV_ID, ITGPS_DATASET_ID written to .env
  it('writes ITGPS_PROJECT_ID, ITGPS_ENV_ID, ITGPS_DATASET_ID to .env after selection', async () => {
    setupHappyPathPrompts('global');

    await runConfig({ yes: false });

    const writeLocalEnvCalls = vi.mocked(writeLocalEnv).mock.calls;

    // Find the call that writes project ID
    const projectCall = writeLocalEnvCalls.find(([managed]) => 'ITGPS_PROJECT_ID' in managed);
    expect(projectCall).toBeDefined();
    expect(projectCall![0]).toMatchObject({ ITGPS_PROJECT_ID: 'proj-1' });

    // Find the call that writes env ID and dataset ID
    const envDatasetCall = writeLocalEnvCalls.find(
      ([managed]) => 'ITGPS_ENV_ID' in managed || 'ITGPS_DATASET_ID' in managed
    );
    expect(envDatasetCall).toBeDefined();
    expect(envDatasetCall![0]).toMatchObject({
      ITGPS_ENV_ID: 'env-1',
      ITGPS_DATASET_ID: 'ds-1',
    });
  });

  // ── Test 5: Cache is updated after successful config ──────────────────────
  it('writes project, environments, and datasets to cache after successful config', async () => {
    setupHappyPathPrompts('global');

    await runConfig({ yes: false });

    expect(writeCache).toHaveBeenCalledWith('project', expect.any(Array));
    expect(writeCache).toHaveBeenCalledWith('environments', expect.any(Array));
    expect(writeCache).toHaveBeenCalledWith('datasets', expect.any(Array));
  });

  // ── Additional: bootstrap is called with correct IDs ─────────────────────
  it('calls bootstrap with the selected projectId, envId, and datasetId', async () => {
    setupHappyPathPrompts('global');

    await runConfig({ yes: false });

    expect(bootstrap).toHaveBeenCalledOnce();
    expect(bootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        envId: 'env-1',
        datasetId: 'ds-1',
      })
    );
  });

  // ── Additional: outro is called on success ────────────────────────────────
  it('calls outro with "Configuration complete!" on success', async () => {
    setupHappyPathPrompts('global');

    await runConfig({ yes: false });

    expect(clack.outro).toHaveBeenCalledWith('Configuration complete!');
  });
});
