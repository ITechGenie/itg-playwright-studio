import * as path from 'path';
import * as childProcess from 'child_process';
import { log } from '@clack/prompts';
import { readGlobalConfig } from '../lib/config-store';
import { readLocalEnv } from '../lib/env-store';
import { createStudioClient } from '../lib/studio-client';
import { bootstrap } from '../lib/bootstrap';

/**
 * Playwright proxy command handler.
 *
 * 1. Reads Studio URL + token from global config, falling back to local .env.
 * 2. Reads ITGPS_PROJECT_ID from local .env.
 * 3. Bootstraps Studio data (fetch or cache).
 * 4. Spawns `npx playwright <command> [...args]` with merged env vars.
 * 5. After `test` exits, fires best-effort meta sync to Studio.
 * 6. Exits with the subprocess exit code.
 */
export async function runPlaywrightProxy(
  command: string,
  args: string[],
  opts: { yes: boolean }
): Promise<void> {
  // ── Step 1: Read Studio URL and token ──────────────────────────────────────
  let studioUrl: string | undefined;
  let token: string | undefined;

  const globalConfig = await readGlobalConfig();
  if (globalConfig?.studioUrl && globalConfig?.token) {
    studioUrl = globalConfig.studioUrl;
    token = globalConfig.token;
  } else {
    const localEnv = readLocalEnv();
    studioUrl = localEnv['ITGPS_STUDIO_URL'];
    token = localEnv['ITGPS_TOKEN'];
  }

  if (!studioUrl || !token) {
    console.error("Run 'itgps-agent config' to set up your Studio connection.");
    process.exit(1);
  }

  // ── Step 2: Read ITGPS_PROJECT_ID ─────────────────────────────────────────
  const localEnv = readLocalEnv();
  const projectId = localEnv['ITGPS_PROJECT_ID'];

  if (!projectId) {
    console.error("Run 'itgps-agent config' to select a project.");
    process.exit(1);
  }

  // ── Step 3: Create Studio client ──────────────────────────────────────────
  const studioClient = createStudioClient(studioUrl, token);

  // ── Step 4: Bootstrap Studio data ─────────────────────────────────────────
  const result = await bootstrap({ studioClient, projectId, cwd: process.cwd() });

  if (result.fromCache) {
    log.warn(`[offline] Using cached Studio data from ${result.cacheTimestamp}`);
  }

  // ── Step 5: Build spawn args ───────────────────────────────────────────────
  const bundledConfigPath = path.resolve(__dirname, '../../playwright.config.cjs');

  let spawnArgs: string[];
  if (command === 'test') {
    spawnArgs = ['playwright', 'test', '--config', bundledConfigPath, ...args];
  } else {
    spawnArgs = ['playwright', command, ...args];
  }

  // ── Step 6: Spawn subprocess ───────────────────────────────────────────────
  const startTime = Date.now();

  const subprocess = childProcess.spawn('npx', spawnArgs, {
    stdio: 'inherit',
    env: { ...process.env },
    shell: true,  // Required on Windows to find npx.cmd
  });

  // ── Step 7: Register SIGINT handler ───────────────────────────────────────
  process.on('SIGINT', () => {
    subprocess.kill('SIGTERM');
    process.exit(130);
  });

  // ── Step 8: Wait for subprocess exit ──────────────────────────────────────
  const exitCode = await new Promise<number>((resolve) => {
    subprocess.on('close', (code) => {
      resolve(code ?? 1);
    });
  });

  const duration = Date.now() - startTime;

  // ── Step 9: Post-run meta sync (test command only) ─────────────────────────
  if (command === 'test') {
    studioClient
      .reportLocalRun(projectId, {
        triggeredBy: 'local-agent',
        status: exitCode === 0 ? 'completed' : 'failed',
        exitCode,
        duration,
        envId: process.env['ITGPS_ENV_ID'],
        datasetId: process.env['ITGPS_DATASET_ID'],
        passed: 0,
        failed: 0,
        skipped: 0,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[warn] Failed to report local run to Studio: ${message}`);
      });
  }

  process.exit(exitCode);
}
