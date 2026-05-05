import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../lib/bootstrap', () => ({
  bootstrap: vi.fn(),
}));

vi.mock('../../lib/config-store', () => ({
  readGlobalConfig: vi.fn(),
}));

vi.mock('../../lib/env-store', () => ({
  readLocalEnv: vi.fn(),
}));

vi.mock('../../lib/studio-client', () => ({
  createStudioClient: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Import after mocks are registered
import { bootstrap } from '../../lib/bootstrap';
import { readGlobalConfig } from '../../lib/config-store';
import { readLocalEnv } from '../../lib/env-store';
import { createStudioClient } from '../../lib/studio-client';
import { spawn } from 'child_process';
import { runPlaywrightProxy } from '../playwright-proxy';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates an EventEmitter-like subprocess mock.
 * Exposes `triggerClose(code)` to manually fire the 'close' event.
 */
function makeSubprocessMock() {
  const emitter = new EventEmitter();
  const mock = {
    on: emitter.on.bind(emitter),
    kill: vi.fn(),
    triggerClose: (code: number | null) => emitter.emit('close', code),
  };
  return mock;
}

/**
 * Creates a mock StudioClient with a controllable reportLocalRun.
 */
function makeStudioClientMock(reportLocalRunImpl?: () => Promise<void>) {
  return {
    getMe: vi.fn(),
    getProjects: vi.fn(),
    getEnvironments: vi.fn(),
    getDatasets: vi.fn(),
    triggerRun: vi.fn(),
    getRunStatus: vi.fn(),
    reportLocalRun: vi.fn().mockImplementation(reportLocalRunImpl ?? (() => Promise.resolve())),
    triggerGitSync: vi.fn(),
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────

describe('runPlaywrightProxy', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let subprocessMock: ReturnType<typeof makeSubprocessMock>;
  let studioClientMock: ReturnType<typeof makeStudioClientMock>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Prevent process.exit from actually exiting
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined) => {
      throw new Error(`process.exit(${_code})`);
    });

    // Default: global config has Studio URL and token
    vi.mocked(readGlobalConfig).mockResolvedValue({
      studioUrl: 'http://studio.example.com',
      token: 'pat_test_token',
    });

    // Default: local .env has project ID
    vi.mocked(readLocalEnv).mockReturnValue({
      ITGPS_PROJECT_ID: 'proj-1',
      ITGPS_ENV_ID: 'env-1',
      ITGPS_DATASET_ID: 'ds-1',
    });

    // Default: bootstrap returns a non-cache result
    vi.mocked(bootstrap).mockResolvedValue({
      mergedVars: {},
      projectConfig: {
        browser: 'chromium',
        headless: 1,
        workers: 1,
        timeout: 30000,
        baseUrl: 'http://localhost:3000',
        video: 'off',
        screenshot: 'off',
        browsers: '["chromium"]',
        extraArgs: '[]',
      },
      fromCache: false,
      cacheTimestamp: undefined,
    });

    // Default: createStudioClient returns a mock client
    studioClientMock = makeStudioClientMock();
    vi.mocked(createStudioClient).mockReturnValue(studioClientMock as any);

    // Default: spawn returns a subprocess mock that auto-closes with 0
    subprocessMock = makeSubprocessMock();
    vi.mocked(spawn).mockImplementation((..._args: any[]) => {
      Promise.resolve().then(() => subprocessMock.triggerClose(0));
      return subprocessMock as any;
    });
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  /**
   * Sets up spawn to auto-close with the given exit code.
   * Returns the subprocess mock for inspection.
   */
  function setupAutoClose(exitCode: number | null = 0) {
    const sub = makeSubprocessMock();
    vi.mocked(spawn).mockImplementation((..._args: any[]) => {
      Promise.resolve().then(() => sub.triggerClose(exitCode));
      return sub as any;
    });
    return sub;
  }

  // ── Test 1: bootstrap is called before spawn ──────────────────────────────
  it('calls bootstrap before spawn', async () => {
    const callOrder: string[] = [];

    vi.mocked(bootstrap).mockImplementation(async () => {
      callOrder.push('bootstrap');
      return {
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
      };
    });

    vi.mocked(spawn).mockImplementation((..._args: any[]) => {
      callOrder.push('spawn');
      Promise.resolve().then(() => subprocessMock.triggerClose(0));
      return subprocessMock as any;
    });

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(0)');

    expect(callOrder.indexOf('bootstrap')).toBeLessThan(callOrder.indexOf('spawn'));
  });

  // ── Test 2: `test` command injects --config <bundled-path> ───────────────
  it('for `test` command, injects --config <bundled-path> into spawn args', async () => {
    setupAutoClose(0);

    await expect(runPlaywrightProxy('test', ['--headed'], { yes: false })).rejects.toThrow('process.exit(0)');

    expect(spawn).toHaveBeenCalledOnce();
    const [cmd, spawnArgs] = vi.mocked(spawn).mock.calls[0];

    expect(cmd).toBe('npx');
    expect(spawnArgs).toContain('playwright');
    expect(spawnArgs).toContain('test');
    expect(spawnArgs).toContain('--config');

    // --config should be followed by a path ending in playwright.config.cjs
    const configIdx = (spawnArgs as string[]).indexOf('--config');
    expect(configIdx).toBeGreaterThan(-1);
    const configPath = (spawnArgs as string[])[configIdx + 1];
    expect(configPath).toMatch(/playwright\.config\.cjs$/);
  });

  // ── Test 3: non-`test` commands do NOT inject --config ───────────────────
  it('for non-`test` commands (e.g. show-report), does NOT inject --config', async () => {
    setupAutoClose(0);

    await expect(runPlaywrightProxy('show-report', [], { yes: false })).rejects.toThrow('process.exit(0)');

    expect(spawn).toHaveBeenCalledOnce();
    const [, spawnArgs] = vi.mocked(spawn).mock.calls[0];

    expect(spawnArgs).not.toContain('--config');
    expect(spawnArgs).toContain('show-report');
  });

  // ── Test 4: all user-provided args are forwarded verbatim ────────────────
  it('forwards all user-provided args verbatim to spawn', async () => {
    const userArgs = ['--grep', 'my-test', '--workers', '4', '--reporter', 'list'];
    setupAutoClose(0);

    await expect(runPlaywrightProxy('test', userArgs, { yes: false })).rejects.toThrow('process.exit(0)');

    const [, spawnArgs] = vi.mocked(spawn).mock.calls[0];

    for (const arg of userArgs) {
      expect(spawnArgs).toContain(arg);
    }
  });

  // ── Test 5: process exits with subprocess exit code ───────────────────────
  it('exits with the subprocess exit code', async () => {
    setupAutoClose(42);

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(42)');
    expect(processExitSpy).toHaveBeenCalledWith(42);
  });

  it('exits with code 1 when subprocess exits with null', async () => {
    setupAutoClose(null);

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  // ── Test 6: reportLocalRun is called after `test` exits ──────────────────
  it('calls reportLocalRun after `test` subprocess exits', async () => {
    setupAutoClose(0);

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(0)');

    // Allow the fire-and-forget promise to settle
    await Promise.resolve();

    expect(studioClientMock.reportLocalRun).toHaveBeenCalledOnce();
    const [calledProjectId, meta] = studioClientMock.reportLocalRun.mock.calls[0];
    expect(calledProjectId).toBe('proj-1');
    expect(meta.triggeredBy).toBe('local-agent');
    expect(meta.status).toBe('completed');
    expect(meta.exitCode).toBe(0);
    expect(typeof meta.duration).toBe('number');
  });

  it('calls reportLocalRun with status "failed" when test exits with non-zero code', async () => {
    setupAutoClose(1);

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(1)');

    await Promise.resolve();

    expect(studioClientMock.reportLocalRun).toHaveBeenCalledOnce();
    const [, meta] = studioClientMock.reportLocalRun.mock.calls[0];
    expect(meta.status).toBe('failed');
    expect(meta.exitCode).toBe(1);
  });

  it('does NOT call reportLocalRun for non-`test` commands', async () => {
    setupAutoClose(0);

    await expect(runPlaywrightProxy('show-report', [], { yes: false })).rejects.toThrow('process.exit(0)');

    await Promise.resolve();

    expect(studioClientMock.reportLocalRun).not.toHaveBeenCalled();
  });

  // ── Additional: exits with error when Studio URL/token missing ────────────
  it('exits with error when Studio URL and token are missing', async () => {
    vi.mocked(readGlobalConfig).mockResolvedValue(null);
    vi.mocked(readLocalEnv).mockReturnValue({
      ITGPS_PROJECT_ID: 'proj-1',
    });

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  // ── Additional: exits with error when project ID is missing ──────────────
  it('exits with error when ITGPS_PROJECT_ID is missing', async () => {
    vi.mocked(readLocalEnv).mockReturnValue({});

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(1)');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  // ── Additional: spawn is called with stdio: 'inherit' ────────────────────
  it('spawns subprocess with stdio: inherit', async () => {
    setupAutoClose(0);

    await expect(runPlaywrightProxy('test', [], { yes: false })).rejects.toThrow('process.exit(0)');

    const [, , spawnOpts] = vi.mocked(spawn).mock.calls[0];
    expect((spawnOpts as any).stdio).toBe('inherit');
  });
});
