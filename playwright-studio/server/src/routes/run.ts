import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { PLAYWRIGHT_DEFAULTS, PlaywrightRunOptions } from '../playwright-defaults.js';
import { runStore } from '../run-store.js';
import { db } from '../db/index.js';
import { projects, environments, dataSets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { decrypt } from './data.js';

// ── Whitelist of allowed Playwright CLI flags ──────────────────────────────────
// Only these flags can be passed via extraArgs. Anything else is rejected.
export const ALLOWED_PLAYWRIGHT_FLAGS = new Set([
  '--block-service-workers',
  '--channel',
  '--color-scheme',
  '--device',
  '--geolocation',
  '--ignore-https-errors',
  '--lang',
  '--proxy-server',
  '--proxy-bypass',
  '--timezone',
  '--timeout',
  '--user-agent',
  '--user-data-dir',
  '--viewport-size',
  '--save-har',
  '--save-har-glob',
  '--save-storage',
  '--load-storage',
]);

export function createRunRouter(wss: WebSocketServer) {
  const router = Router();

  function broadcast(msg: object) {
    const payload = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * POST /api/projects/:projectId/run
   * Triggers a new Test Run. Supports single path or multiple paths.
   */
  router.post('/:projectId/run', async (req, res) => {
    const { projectId } = req.params;
    const requestedSubPath = (req.body.path as string) || '';
    const requestedPaths = (req.body.paths as string[]) || [];
    const user = req.user?.email || req.user?.id || 'anonymous';

    // 1. Resolve project directory
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    const folderName = project.name;
    const basePath = process.env.PROJECTS_BASE_PATH || 'C:/tmp/playwright-studio/projects';
    const executionsPath = process.env.EXECUTIONS_BASE_PATH || 'C:/tmp/playwright-studio/executions';
    const projectRoot = path.resolve(basePath, folderName);

    // Validate paths
    const finalAbsPaths: string[] = [];
    if (requestedPaths.length > 0) {
      for (const p of requestedPaths) {
        const fullPath = path.resolve(projectRoot, p);
        if (!fullPath.startsWith(projectRoot)) return res.status(403).json({ error: `Forbidden: path traversal: ${p}` });
        finalAbsPaths.push(fullPath);
      }
    } else {
      const relPath = requestedSubPath || '';
      const fullPath = path.resolve(projectRoot, relPath);
      if (!fullPath.startsWith(projectRoot)) return res.status(403).json({ error: 'Forbidden: path traversal detected' });
      finalAbsPaths.push(fullPath);
    }

    // 2. Prepare OPTIONS
    const opts: PlaywrightRunOptions = {
      ...PLAYWRIGHT_DEFAULTS,
      ...req.body,
    };

    const args: string[] = ['test'];
    for (const abs of finalAbsPaths) {
       args.push(`"${abs}"`);
    }

    const serverConfigPath = path.join(process.cwd(), 'playwright.config.cjs');
    args.push('--config', `"${serverConfigPath}"`);
    
    if (!opts.headless)   args.push('--headed');
    if (opts.workers)     args.push('--workers', String(opts.workers));
    if (opts.timeout)     args.push('--timeout', String(opts.timeout));
    if (opts.retries)     args.push('--retries', String(opts.retries));
    if (opts.grep)        args.push('--grep', opts.grep);

    // Multi-browser support: native Playwright --project flags
    const browsers: string[] = req.body.browsers || (req.body.browser ? [req.body.browser] : ['chromium']);
    for (const b of browsers) {
      args.push('--project', b);
    }

    // Extra CLI args (validated against whitelist)
    const extraArgs: { flag: string; value: string }[] = req.body.extraArgs || [];
    for (const arg of extraArgs) {
      if (!ALLOWED_PLAYWRIGHT_FLAGS.has(arg.flag)) {
        return res.status(400).json({ error: `Disallowed CLI flag: ${arg.flag}` });
      }
      args.push(arg.flag);
      if (arg.value) args.push(`"${arg.value.replace(/"/g, '')}"`);
    }

    // 3. Fetch Variables
    const envId = req.body.envId as string | undefined;
    const dataSetIds = (req.body.dataSetIds as string[]) || [];

    const customSharedVars: Record<string, string> = {};
    if (envId) {
      const [envData] = await db.select().from(environments).where(eq(environments.id, envId));
      if (envData && envData.variables) {
        Object.assign(customSharedVars, JSON.parse(envData.variables));
      }
    }

    const runsToSpawn = dataSetIds.length > 0 ? dataSetIds : [null];
    const spawnedRuns = [];

    // Loop through datasets (or just 1 isolated run if no datasets selected)
    for (const dId of runsToSpawn) {
      const runCustomVars = { ...customSharedVars };
      let datasetName = '';
      
      if (dId) {
        const [dsData] = await db.select().from(dataSets).where(eq(dataSets.id, dId));
        if (dsData) {
          datasetName = ` [${dsData.name}]`;
          if (dsData.variables) {
            Object.assign(runCustomVars, JSON.parse(dsData.variables));
          }
        }
      }

      // Decrypt any stored secrets safely
      for (const [k, v] of Object.entries(runCustomVars)) {
        if (typeof v === 'string' && v.includes(':')) {
           runCustomVars[k] = decrypt(v);
        }
      }

      const runId = randomUUID();
      const command = `npx playwright ${args.join(' ')}`;
      
      await runStore.createRun(
        projectId, 
        runId, 
        (requestedPaths.length > 0 ? `${requestedPaths.length} files selected` : requestedSubPath) + datasetName, 
        command, 
        user,
        requestedPaths.length > 0 ? requestedPaths : undefined
      );

      spawnedRuns.push({ runId, status: 'running', command, datasetName });

      // 4. Prepare Workspace
      const executionRoot = path.join(executionsPath, projectId, 'runs', runId);
      const reportDir = path.join(executionRoot, 'report');
      const resultsDir = path.join(executionRoot, 'test-results');
      
      await fs.mkdir(reportDir, { recursive: true });
      await fs.mkdir(resultsDir, { recursive: true });

      const serverRoot = process.cwd();
      const workspaceRoot = path.resolve(serverRoot, '..', '..');

      const runEnv = {
        ...process.env,
        TEST_PROJECT_DIR: projectRoot,
        REPORT_DIR: reportDir,
        RESULTS_DIR: resultsDir,
        HEADED: opts.headless ? 'false' : 'true',
        TIMEOUT: String(opts.timeout),
        NODE_PATH: path.join(workspaceRoot, 'node_modules'),
        FORCE_COLOR: '1',
        BROWSER: req.body.browser || 'chromium',
        WIDTH: String(req.body.width || 1280),
        HEIGHT: String(req.body.height || 720),
        BASE_URL: req.body.baseURL || 'http://localhost:5173',
        VIDEO: req.body.video || 'retain-on-failure',
        SCREENSHOT: req.body.screenshot || 'only-on-failure',
        ...runCustomVars, // Dynamically injected variables (Overrides defaults above if matched)
      };

      // 5. Execute
      broadcast({ type: 'run:start', runId, command });
      await runStore.addLog(runId, 'info', `$ ${command}`);

      const child: ChildProcess = spawn('npx', ['playwright', ...args], {
        cwd: serverRoot,
        shell: true,
        env: runEnv,
      });

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

      child.on('close', (exitCode) => {
        runStore.addLog(runId, 'done', 'Execution finished.', exitCode ?? 0);
        broadcast({ type: 'run:done', runId, exitCode });
      });

      child.on('error', (err) => {
        runStore.addLog(runId, 'error', err.message);
        broadcast({ type: 'run:error', runId, error: err.message });
      });
    }

    // Return backwards compatible shape for single run, or array for multi-run
    if (spawnedRuns.length === 1) {
      res.json(spawnedRuns[0]);
    } else {
      res.json({ runs: spawnedRuns });
    }
  });

  /**
   * GET /api/projects/:projectId/run/:runId
   */
  router.get('/:projectId/run/:runId', async (req, res) => {
    const { runId } = req.params;
    const run = await runStore.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  });

  /**
   * GET /api/projects/:projectId/runs
   * Returns a paginated list of runs with dynamic report existence checking.
   */
  router.get('/:projectId/runs', async (req, res) => {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // Validate 2-week limit if both dates are provided
    if (startDate && endDate) {
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      if (endDate.getTime() - startDate.getTime() > twoWeeksMs) {
        return res.status(400).json({ error: 'Date range cannot exceed 2 weeks' });
      }
    }

    try {
      // 1. Get project info for path resolution
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!project) return res.status(404).json({ error: 'Project not found' });
      
      const folderName = project.name;
      const executionsPath = process.env.EXECUTIONS_BASE_PATH || 'C:/tmp/playwright-studio/executions';

      // 2. Fetch runs from store
      const runs = await runStore.getRecentRuns(projectId, {
        limit,
        offset,
        status,
        startDate,
        endDate
      });

      // 3. Dynamic filesystem check for reports
      const runsWithReports = await Promise.all(runs.map(async (run) => {
        const executionRoot = path.join(executionsPath, projectId, 'runs', run.runId);
        const htmlReport = path.join(executionRoot, 'report', 'html', 'index.html');
        const monocartReport = path.join(executionRoot, 'report', 'monocart', 'index.html');
        
        // Simple file existence check
        let hasHtmlReport = false;
        let hasMonocartReport = false;
        
        try {
          await fs.access(htmlReport);
          hasHtmlReport = true;
        } catch {}
        
        try {
          await fs.access(monocartReport);
          hasMonocartReport = true;
        } catch {}
        
        return {
          ...run,
          hasHtmlReport,
          hasMonocartReport
        };
      }));

      res.json(runsWithReports);
    } catch (err) {
      console.error('Failed to list runs:', err);
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  return router;
}
