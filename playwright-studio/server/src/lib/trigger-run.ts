/**
 * Shared run trigger — used by both the HTTP route and the scheduler.
 * No HTTP, no auth. Pure in-process spawn logic.
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db/index.js';
import { projects, environments, dataSets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { runStore } from '../run-store.js';
import { decrypt } from '../routes/data.js';
import type { RunConfig } from './pattern-to-cron.js';

export interface TriggerRunOptions {
  projectId: string;
  /** Relative paths within project root. Empty = run all tests. */
  targetPaths: string[];
  config: RunConfig & {
    extraEnvVars?: Record<string, string>;
    grep?: string;
    retries?: number;
  };
  triggeredBy?: string;
}

export interface TriggerRunResult {
  runId: string;
  command: string;
  datasetName: string;
}

// ── WebSocket broadcast ───────────────────────────────────────────────────────
let _wss: WebSocketServer | null = null;
export function setWss(wss: WebSocketServer) { _wss = wss; }

function broadcast(msg: object) {
  if (!_wss) return;
  const payload = JSON.stringify(msg);
  _wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

// ── Core trigger ──────────────────────────────────────────────────────────────
export async function triggerRun(opts: TriggerRunOptions): Promise<TriggerRunResult> {
  const { projectId, targetPaths, config, triggeredBy = 'anonymous' } = opts;

  // 1. Resolve project
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
  const executionsPath = process.env.EXECUTIONS_BASE_PATH || path.join(process.cwd(), 'executions');
  const projectRoot = path.resolve(basePath, project.name);

  // 2. Resolve absolute paths
  const finalAbsPaths: string[] = targetPaths.length > 0
    ? targetPaths.map(p => path.resolve(projectRoot, p))
    : [projectRoot];

  // 3. Build CLI args
  const args: string[] = ['test'];
  for (const abs of finalAbsPaths) args.push(`"${abs}"`);

  const serverConfigPath = path.join(process.cwd(), 'playwright.config.cjs');
  args.push('--config', `"${serverConfigPath}"`);

  if (!config.headless)  args.push('--headed');
  if (config.workers)    args.push('--workers', String(config.workers));
  if (config.timeout)    args.push('--timeout', String(config.timeout));
  if (config.retries)    args.push('--retries', String(config.retries));
  if (config.grep)       args.push('--grep', config.grep);

  const browsers = config.browsers?.length ? config.browsers : ['chromium'];
  for (const b of browsers) args.push('--project', b);

  // 4. Resolve env variables (shared env + dataset)
  const customVars: Record<string, string> = {};

  if (config.envId) {
    const [envData] = await db.select().from(environments).where(eq(environments.id, config.envId));
    if (envData?.variables) Object.assign(customVars, JSON.parse(envData.variables));
  }

  let datasetName = '';
  const dId = config.dataSetIds?.[0] ?? null;
  if (dId) {
    const [dsData] = await db.select().from(dataSets).where(eq(dataSets.id, dId));
    if (dsData) {
      datasetName = ` [${dsData.name}]`;
      if (dsData.variables) Object.assign(customVars, JSON.parse(dsData.variables));
    }
  }

  // Decrypt secrets
  for (const [k, v] of Object.entries(customVars)) {
    if (typeof v === 'string' && v.includes(':')) customVars[k] = decrypt(v);
  }

  // 5. Create run record
  const runId = randomUUID();
  const command = `npx playwright ${args.join(' ')}`;
  const pathLabel = targetPaths.length > 0 ? `${targetPaths.length} files selected` : 'All tests';

  await runStore.createRun(
    projectId, runId, pathLabel + datasetName, command, triggeredBy,
    targetPaths.length > 0 ? targetPaths : undefined
  );

  // 6. Prepare output dirs
  const executionRoot = path.join(executionsPath, projectId, 'runs', runId);
  const reportDir = path.join(executionRoot, 'report');
  const resultsDir = path.join(executionRoot, 'test-results');
  await fs.mkdir(reportDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });

  const serverRoot = process.cwd();
  const workspaceRoot = path.resolve(serverRoot, '..', '..');

  const runEnv: Record<string, string> = {
    ...process.env as any,
    TEST_PROJECT_DIR: projectRoot,
    REPORT_DIR: reportDir,
    RESULTS_DIR: resultsDir,
    HEADED: config.headless ? 'false' : 'true',
    TIMEOUT: String(config.timeout ?? 30000),
    NODE_PATH: path.join(workspaceRoot, 'node_modules'),
    FORCE_COLOR: '1',
    BROWSER: browsers[0],                          // primary browser for config defaults
    WIDTH: String(config.width ?? 1280),
    HEIGHT: String(config.height ?? 720),
    BASE_URL: config.baseURL ?? 'http://localhost:5173',
    VIDEO: config.video ?? 'retain-on-failure',
    SCREENSHOT: config.screenshot ?? 'only-on-failure',
    ...customVars,
    ...(config.extraEnvVars ?? {}),
  };

  // 7. Log + spawn
  const isCustomBaseURL = !!customVars.BASE_URL;
  broadcast({ type: 'run:start', runId, command });
  await runStore.addLog(runId, 'info', `$ ${command}`);
  await runStore.addLog(runId, 'info', [
    '--- Studio Environment Details ---',
    `BASE_URL: ${runEnv.BASE_URL}${isCustomBaseURL ? ' [From Environment]' : ' [System Default]'}`,
    `VIEWPORT: ${runEnv.WIDTH}x${runEnv.HEIGHT}`,
    `Triggered by: ${triggeredBy}`,
    ...Object.keys(config.extraEnvVars ?? {}).map(k => `${k.replace('PW_STUDIO_ARG_', '')}: ${config.extraEnvVars![k]}`),
    ...Object.keys(customVars).filter(k => k !== 'BASE_URL').map(k => `${k}: ${customVars[k]}`),
    '----------------------------------',
  ].join('\n'));

  const child: ChildProcess = spawn('npx', ['playwright', ...args], {
    cwd: serverRoot,
    shell: true,
    env: runEnv,
  });

  // Process-level timeout — kill the child if it runs longer than config.timeout * 3
  // (gives enough headroom for retries) with a hard cap of 30 minutes
  const maxRunMs = Math.min((config.timeout ?? 30000) * 3, 30 * 60 * 1000);
  const killTimer = setTimeout(() => {
    if (!child.killed) {
      console.warn(`[Run] ${runId} exceeded max runtime (${maxRunMs / 1000}s), killing process`);
      child.kill('SIGTERM');
      runStore.addLog(runId, 'error', `⏱ Run timed out after ${maxRunMs / 1000}s and was killed`);
    }
  }, maxRunMs);

  child.stdout?.on('data', (chunk: Buffer) => {
    const data = chunk.toString();
    runStore.addLog(runId, 'stdout', data);
    broadcast({ type: 'run:stdout', runId, data });
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const data = chunk.toString();
    runStore.addLog(runId, 'stderr', data);
    broadcast({ type: 'run:stderr', runId, data });
  });

  child.on('close', exitCode => {
    clearTimeout(killTimer);
    runStore.addLog(runId, 'done', 'Execution finished.', exitCode ?? 0);
    broadcast({ type: 'run:done', runId, exitCode });
  });

  child.on('error', err => {
    clearTimeout(killTimer);
    runStore.addLog(runId, 'error', err.message);
    broadcast({ type: 'run:error', runId, error: err.message });
  });

  return { runId, command, datasetName };
}
