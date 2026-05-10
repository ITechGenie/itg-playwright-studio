import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
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

vi.mock('../../lib/ws-client', () => ({
  streamRunEvents: vi.fn(),
}));

vi.mock('../../lib/cache-store', () => ({
  readCache: vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import * as clack from '@clack/prompts';
import { readGlobalConfig } from '../../lib/config-store';
import { readLocalEnv } from '../../lib/env-store';
import { createStudioClient } from '../../lib/studio-client';
import { streamRunEvents } from '../../lib/ws-client';
import { runRemoteRun } from '../remote-run';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSpinnerMock() {
  return { start: vi.fn(), stop: vi.fn() };
}

function makeStudioClientMock(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return {
    getMe: vi.fn(),
    getProjects: vi.fn(),
    getEnvironments: vi.fn().mockResolvedValue([
      { id: 'env-1', name: 'Staging', variables: '{}' },
    ]),
    getDatasets: vi.fn().mockResolvedValue([
      { id: 'ds-1', name: 'Default Dataset', variables: '{}' },
    ]),
    triggerRun: vi.fn().mockResolvedValue({ runId: 'run-abc', status: 'running', command: 'test' }),
    getRunStatus: vi.fn().mockResolvedValue({ runId: 'run-abc', status: 'completed', exitCode: 0 }),
    reportLocalRun: vi.fn().mockResolvedValue(undefined),
    triggerGitSync: vi.fn(),
    ...overrides,
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────

describe('runRemoteRun', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;
  let studioClientMock: ReturnType<typeof makeStudioClientMock>;

  beforeEach(() => {
    vi.clearAllMocks();

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined) => {
      throw new Error(`process.exit(${_code})`);
    });

    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.mocked(readGlobalConfig).mockResolvedValue({
      studioUrl: 'http://studio.example.com',
      token: 'pat_test',
    });

    vi.mocked(readLocalEnv).mockReturnValue({ ITGPS_PROJECT_ID: 'proj-1' });

    studioClientMock = makeStudioClientMock();
    vi.mocked(createStudioClient).mockReturnValue(studioClientMock as any);

    const spinnerMock = makeSpinnerMock();
    vi.mocked(clack.spinner).mockReturnValue(spinnerMock as any);

    vi.mocked(clack.intro).mockReturnValue(undefined);
    vi.mocked(clack.outro).mockReturnValue(undefined);
    vi.mocked(clack.cancel).mockReturnValue(undefined);
    vi.mocked(clack.isCancel).mockReturnValue(false);

    // Default: select returns env-1 then ds-1
    let selectCount = 0;
    vi.mocked(clack.select).mockImplementation(async () => {
      selectCount++;
      return selectCount === 1 ? 'env-1' : 'ds-1';
    });

    // Default: confirm returns true
    vi.mocked(clack.confirm).mockResolvedValue(true);

    // Default: streamRunEvents immediately calls onClose (simulates instant completion via run:done)
    vi.mocked(streamRunEvents).mockImplementation(async (_url, _token, _runId, onEvent, _onClose) => {
      onEvent({ type: 'run:done', runId: 'run-abc', exitCode: 0 });
    });
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
  });

  // ── Test 1: triggerRun called with correct envId and dataSetIds ───────────
  it('calls triggerRun with correct envId and dataSetIds', async () => {
    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(0)');

    expect(studioClientMock.triggerRun).toHaveBeenCalledOnce();
    expect(studioClientMock.triggerRun).toHaveBeenCalledWith('proj-1', {
      envId: 'env-1',
      dataSetIds: ['ds-1'],
    });
  });

  // ── Test 2: WebSocket run:stdout and run:stderr events written to streams ──
  it('writes run:stdout events to process.stdout', async () => {
    vi.mocked(streamRunEvents).mockImplementation(async (_url, _token, _runId, onEvent, _onClose) => {
      onEvent({ type: 'run:stdout', runId: 'run-abc', data: 'test output line\n' });
      onEvent({ type: 'run:done', runId: 'run-abc', exitCode: 0 });
    });

    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(0)');

    expect(stdoutWriteSpy).toHaveBeenCalledWith('test output line\n');
  });

  it('writes run:stderr events to process.stderr', async () => {
    vi.mocked(streamRunEvents).mockImplementation(async (_url, _token, _runId, onEvent, _onClose) => {
      onEvent({ type: 'run:stderr', runId: 'run-abc', data: 'error output\n' });
      onEvent({ type: 'run:done', runId: 'run-abc', exitCode: 0 });
    });

    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(0)');

    expect(stderrWriteSpy).toHaveBeenCalledWith('error output\n');
  });

  // ── Test 3: WebSocket drop triggers polling fallback ──────────────────────
  it('falls back to polling when WebSocket drops before run:done', async () => {
    vi.mocked(streamRunEvents).mockImplementation(async (_url, _token, _runId, _onEvent, onClose) => {
      // Simulate WebSocket drop without run:done
      onClose();
    });

    // Polling returns completed after one call
    studioClientMock.getRunStatus.mockResolvedValue({
      runId: 'run-abc',
      status: 'completed',
      exitCode: 0,
    });

    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(0)');

    expect(studioClientMock.getRunStatus).toHaveBeenCalledWith('proj-1', 'run-abc');
  });

  // ── Test 4: Exit code reflects run result ─────────────────────────────────
  it('exits with 0 when run:done has exitCode 0', async () => {
    vi.mocked(streamRunEvents).mockImplementation(async (_url, _token, _runId, onEvent, _onClose) => {
      onEvent({ type: 'run:done', runId: 'run-abc', exitCode: 0 });
    });

    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(0)');
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with non-zero when run:done has non-zero exitCode', async () => {
    vi.mocked(streamRunEvents).mockImplementation(async (_url, _token, _runId, onEvent, _onClose) => {
      onEvent({ type: 'run:done', runId: 'run-abc', exitCode: 1 });
    });

    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with non-zero when polling returns failed status', async () => {
    vi.mocked(streamRunEvents).mockImplementation(async (_url, _token, _runId, _onEvent, onClose) => {
      onClose();
    });

    studioClientMock.getRunStatus.mockResolvedValue({
      runId: 'run-abc',
      status: 'failed',
      exitCode: 2,
    });

    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(2)');
    expect(processExitSpy).toHaveBeenCalledWith(2);
  });

  // ── Additional: exits with 1 when credentials missing ────────────────────
  it('exits with 1 when Studio URL/token are missing', async () => {
    vi.mocked(readGlobalConfig).mockResolvedValue(null);
    vi.mocked(readLocalEnv).mockReturnValue({ ITGPS_PROJECT_ID: 'proj-1' });

    await expect(runRemoteRun({ yes: true })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
