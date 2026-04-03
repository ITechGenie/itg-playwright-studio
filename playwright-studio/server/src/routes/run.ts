import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { WebSocketServer } from 'ws';
import { PLAYWRIGHT_DEFAULTS, PlaywrightRunOptions } from '../playwright-defaults.js';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { runStore } from '../run-store.js';
import { triggerRun } from '../lib/trigger-run.js';

// ── Whitelist of allowed Playwright CLI flags ──────────────────────────────────
export const ALLOWED_PLAYWRIGHT_FLAGS = new Set([
  '--block-service-workers', '--channel', '--color-scheme', '--device',
  '--geolocation', '--ignore-https-errors', '--lang', '--proxy-server',
  '--proxy-bypass', '--timezone', '--timeout', '--user-agent', '--user-data-dir',
  '--viewport-size', '--save-har', '--save-har-glob', '--save-storage',
  '--load-storage', '--is-mobile', '--has-touch',
]);

export function createRunRouter(_wss: WebSocketServer) {
  const router = Router();

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

    const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
    const projectRoot = path.resolve(basePath, project.name);

    // 2. Validate paths (path traversal check)
    const relPaths: string[] = [];
    if (requestedPaths.length > 0) {
      for (const p of requestedPaths) {
        const full = path.resolve(projectRoot, p);
        if (!full.startsWith(projectRoot))
          return res.status(403).json({ error: `Forbidden: path traversal: ${p}` });
        relPaths.push(p);
      }
    } else if (requestedSubPath) {
      const full = path.resolve(projectRoot, requestedSubPath);
      if (!full.startsWith(projectRoot))
        return res.status(403).json({ error: 'Forbidden: path traversal detected' });
      relPaths.push(requestedSubPath);
    }
    // empty relPaths = run all tests

    // 3. Validate extra args
    const extraArgs: { flag: string; value: string }[] = req.body.extraArgs || [];
    const extraEnvVars: Record<string, string> = {};
    for (const arg of extraArgs) {
      if (!ALLOWED_PLAYWRIGHT_FLAGS.has(arg.flag))
        return res.status(400).json({ error: `Disallowed CLI flag: ${arg.flag}` });
      const envKey = `PW_STUDIO_ARG_${arg.flag.toUpperCase().replace(/^-+/, '').replace(/-/g, '_')}`;
      extraEnvVars[envKey] = arg.value || 'true';
    }

    // 4. Build RunConfig from request body
    const opts: PlaywrightRunOptions = { ...PLAYWRIGHT_DEFAULTS, ...req.body };
    const browsers: string[] = req.body.browsers || (req.body.browser ? [req.body.browser] : ['chromium']);

    const config = {
      browsers,
      headless: opts.headless !== false,
      workers: opts.workers ?? 1,
      timeout: opts.timeout ?? 30000,
      width: req.body.width ?? 1280,
      height: req.body.height ?? 720,
      baseURL: req.body.baseURL || 'http://localhost:5173',
      video: req.body.video || 'retain-on-failure',
      screenshot: req.body.screenshot || 'only-on-failure',
      envId: req.body.envId,
      dataSetIds: req.body.dataSetIds,
      extraEnvVars,  // passed through to triggerRun
      grep: opts.grep,
      retries: opts.retries,
    };

    // 5. Delegate to shared triggerRun — supports multi-dataset spawning
    const dataSetIds: string[] = req.body.dataSetIds || [];
    const runsToSpawn = dataSetIds.length > 0 ? dataSetIds : [null];
    const spawnedRuns = [];

    for (const dId of runsToSpawn) {
      try {
        const result = await triggerRun({
          projectId,
          targetPaths: relPaths,
          config: {
            ...config,
            dataSetIds: dId ? [dId] : undefined,
          },
          triggeredBy: user,
        });
        spawnedRuns.push({ runId: result.runId, status: 'running', command: result.command, datasetName: result.datasetName ?? '' });
      } catch (err: any) {
        console.error('[Run] triggerRun failed:', err);
        return res.status(500).json({ error: err.message || 'Failed to start run' });
      }
    }

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

    if (startDate && endDate) {
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      if (endDate.getTime() - startDate.getTime() > twoWeeksMs)
        return res.status(400).json({ error: 'Date range cannot exceed 2 weeks' });
    }

    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const executionsPath = process.env.EXECUTIONS_BASE_PATH || path.join(process.cwd(), 'executions');
      const runs = await runStore.getRecentRuns(projectId, { limit, offset, status, startDate, endDate });

      const runsWithReports = await Promise.all(runs.map(async (run) => {
        const executionRoot = path.join(executionsPath, projectId, 'runs', run.runId);
        const check = async (p: string) => { try { await fs.access(p); return true; } catch { return false; } };
        return {
          ...run,
          hasHtmlReport: await check(path.join(executionRoot, 'report', 'html', 'index.html')),
          hasMonocartReport: await check(path.join(executionRoot, 'report', 'monocart', 'index.html')),
          hasHar: await check(path.join(executionRoot, 'test-results', 'network.har')),
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
