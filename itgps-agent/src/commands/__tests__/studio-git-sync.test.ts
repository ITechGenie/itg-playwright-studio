import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(),
}));

vi.mock('../../lib/config-store', () => ({
  readGlobalConfig: vi.fn(),
}));

vi.mock('../../lib/env-store', () => ({
  readLocalEnv: vi.fn(),
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
  NetworkError: class NetworkError extends Error {
    cause: Error;
    constructor(cause: Error) {
      super(cause.message);
      this.name = 'NetworkError';
      this.cause = cause;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
  TimeoutError: class TimeoutError extends Error {
    endpoint: string;
    constructor(endpoint: string) {
      super(`Timeout: ${endpoint}`);
      this.name = 'TimeoutError';
      this.endpoint = endpoint;
      Object.setPrototypeOf(this, new.target.prototype);
    }
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import * as clack from '@clack/prompts';
import { readGlobalConfig } from '../../lib/config-store';
import { readLocalEnv } from '../../lib/env-store';
import { createStudioClient, AuthError, NetworkError } from '../../lib/studio-client';
import { runStudioGitSync } from '../studio-git-sync';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSpinnerMock() {
  return { start: vi.fn(), stop: vi.fn() };
}

function makeStudioClientMock(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return {
    getMe: vi.fn(),
    getProjects: vi.fn(),
    getEnvironments: vi.fn(),
    getDatasets: vi.fn(),
    triggerRun: vi.fn(),
    getRunStatus: vi.fn(),
    reportLocalRun: vi.fn(),
    triggerGitSync: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runStudioGitSync', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let studioClientMock: ReturnType<typeof makeStudioClientMock>;
  let spinnerMock: ReturnType<typeof makeSpinnerMock>;

  beforeEach(() => {
    vi.clearAllMocks();

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined) => {
      throw new Error(`process.exit(${_code})`);
    });

    vi.mocked(readGlobalConfig).mockResolvedValue({
      studioUrl: 'http://studio.example.com',
      token: 'pat_test',
    });

    vi.mocked(readLocalEnv).mockReturnValue({ ITGPS_PROJECT_ID: 'proj-1' });

    studioClientMock = makeStudioClientMock();
    vi.mocked(createStudioClient).mockReturnValue(studioClientMock as any);

    spinnerMock = makeSpinnerMock();
    vi.mocked(clack.spinner).mockReturnValue(spinnerMock as any);
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  // ── Test 1: triggerGitSync called with correct projectId ──────────────────
  it('calls triggerGitSync with the correct projectId', async () => {
    await runStudioGitSync({ yes: false });

    expect(studioClientMock.triggerGitSync).toHaveBeenCalledOnce();
    expect(studioClientMock.triggerGitSync).toHaveBeenCalledWith('proj-1');
  });

  // ── Test 2: Success path shows confirmation message ───────────────────────
  it('shows a success message when triggerGitSync succeeds', async () => {
    await runStudioGitSync({ yes: false });

    expect(spinnerMock.start).toHaveBeenCalledWith('Syncing with Git...');
    expect(spinnerMock.stop).toHaveBeenCalledOnce();
    const stopMessage = spinnerMock.stop.mock.calls[0][0] as string;
    expect(stopMessage).toMatch(/success/i);
  });

  // ── Test 3: API error path exits with non-zero code ───────────────────────
  it('exits with non-zero code when triggerGitSync throws AuthError', async () => {
    studioClientMock.triggerGitSync.mockRejectedValue(new AuthError(401, 'Unauthorized'));

    await expect(runStudioGitSync({ yes: false })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with non-zero code when triggerGitSync throws NetworkError', async () => {
    studioClientMock.triggerGitSync.mockRejectedValue(
      new NetworkError(new Error('ECONNREFUSED'))
    );

    await expect(runStudioGitSync({ yes: false })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  // ── Additional: exits with 1 when credentials missing ────────────────────
  it('exits with 1 when Studio URL/token are missing', async () => {
    vi.mocked(readGlobalConfig).mockResolvedValue(null);
    vi.mocked(readLocalEnv).mockReturnValue({ ITGPS_PROJECT_ID: 'proj-1' });

    await expect(runStudioGitSync({ yes: false })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with 1 when ITGPS_PROJECT_ID is missing', async () => {
    vi.mocked(readLocalEnv).mockReturnValue({});

    await expect(runStudioGitSync({ yes: false })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
