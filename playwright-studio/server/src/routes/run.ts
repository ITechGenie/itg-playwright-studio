import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { PLAYWRIGHT_DEFAULTS, PlaywrightRunOptions } from '../playwright-defaults.js';
import { runStore } from '../run-store.js';
import { runQueue } from '../run-queue.js';

export function createRunRouter(wss: WebSocketServer) {
  const router = Router();

  /**
   * Broadcast a structured message to all connected WebSocket clients.
   */
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
   */
  router.post('/:projectId/run', async (req, res) => {
    const basePath = process.env.PROJECTS_BASE_PATH || 'C:/tmp/playwright-studio/projects';
    const executionsPath = process.env.EXECUTIONS_BASE_PATH || 'C:/tmp/playwright-studio/executions';
    const projectId = req.params.projectId;
    const requestedSubPath = (req.body.path as string) || '';

    console.log('\n=== NEW TEST RUN REQUEST ===');
    console.log('Project ID:', projectId);
    console.log('Requested Sub Path:', requestedSubPath);
    console.log('Base Path:', basePath);

    // ── Security: resolve & validate ──────────────────────────────────────────
    const projectRoot = path.resolve(basePath, projectId);
    const targetPath = requestedSubPath
      ? path.resolve(projectRoot, requestedSubPath)
      : projectRoot;

    console.log('Resolved Project Root:', projectRoot);
    console.log('Resolved Target Path:', targetPath);

    if (!targetPath.startsWith(projectRoot)) {
      console.error('❌ Security: Path traversal detected');
      return res.status(403).json({ error: 'Forbidden: path traversal detected' });
    }

    // ── Ensure project root exists ──────────────────────────────────────────────────
    try {
      await fs.access(projectRoot);
      console.log('✅ Project root exists');
    } catch {
      console.error('❌ Project root not found:', projectRoot);
      return res.status(404).json({ error: `Project not found: ${projectId}` });
    }

    const opts: PlaywrightRunOptions = {
      ...PLAYWRIGHT_DEFAULTS,
      ...req.body,
    };

    console.log('Run Options:', opts);

    // ── Determine test target path ──────────────────────────────────────────────
    // The working project root where Playwright will point its workspace
    const testProjectRoot = projectRoot;
    
    // The relative path from the project root to the test file/folder
    const testSpecPath = requestedSubPath || (process.env.DEFAULT_TEST_DIR || 'tests');
    
    console.log('Test Project Root:', testProjectRoot);
    console.log('Test Spec Path:', testSpecPath);

    // ── Build Playwright CLI args ──────────────────────────────────────────────
    // Use 'test' command and pass the spec path as a positional argument
    const args: string[] = ['test', testSpecPath];
    
    // Use centralized config from server directory
    const serverConfigPath = path.join(process.cwd(), 'playwright.config.js');
    args.push('--config', serverConfigPath);
    console.log('Config path:', serverConfigPath);
    
    // Add CLI options
    if (!opts.headless)   args.push('--headed');
    if (opts.workers)     args.push('--workers', String(opts.workers));
    if (opts.timeout)     args.push('--timeout', String(opts.timeout));
    if (opts.retries)     args.push('--retries', String(opts.retries));
    if (opts.project)     args.push('--project', opts.project);
    if (opts.grep)        args.push('--grep', opts.grep);
    if (opts.grepInvert)  args.push('--grep-invert', opts.grepInvert);

    const runId = randomUUID();
    const command = `npx playwright ${args.join(' ')}`;
    
    console.log('Generated Run ID:', runId);
    console.log('Command to execute:', command);
    console.log('Args array:', args);
    
    // Initialize run in store with queued status
    runStore.createRun(projectId, runId, requestedSubPath, command);

    // Return immediately with runId
    res.json({ 
      runId, 
      status: 'queued', 
      command,
      queueStatus: runQueue.getStatus()
    });

    // ── Prepare environment variables ──────────────────────────────────────────
    // Use EXECUTIONS_BASE_PATH for results
    const executionRoot = path.join(executionsPath, projectId, 'runs', runId);
    const reportDir = path.join(executionRoot, 'report');
    const resultsDir = path.join(executionRoot, 'test-results');
    
    console.log('Execution Root:', executionRoot);
    console.log('Report Directory:', reportDir);
    console.log('Results Directory:', resultsDir);
    
    // Ensure directories exist
    await fs.mkdir(reportDir, { recursive: true });
    await fs.mkdir(resultsDir, { recursive: true });
    console.log('✅ Created report and results directories');

    // Get workspace root (two levels up from server directory)
    const serverRoot = process.cwd();
    const workspaceRoot = path.resolve(serverRoot, '..', '..');
    
    console.log('Server Root (Working Directory):', serverRoot);
    console.log('Workspace Root:', workspaceRoot);
    
    // Use centralized config from server directory
    const configPath = path.join(serverRoot, 'playwright.config.js');
    console.log('Config Path:', configPath);

    const runEnv = {
      ...process.env,
      TEST_PROJECT_DIR: testProjectRoot, // Set to project root
      REPORT_DIR: reportDir,
      RESULTS_DIR: resultsDir,
      HEADED: opts.headless ? 'false' : 'true',
      TEST_ENV: process.env.TEST_ENV || 'development',
      TIMEOUT: String(opts.timeout),
      // Critical for workspace setup: point to root node_modules
      NODE_PATH: path.join(workspaceRoot, 'node_modules'),
      // Enable color output in terminal
      FORCE_COLOR: '1',
      // Dynamic browser and viewport (from request body or defaults)
      BROWSER: req.body.browser || 'chromium',
      WIDTH: String(req.body.width || 1280),
      HEIGHT: String(req.body.height || 720),
      BASE_URL: req.body.baseURL || process.env.BASE_URL || 'http://localhost:5173',
      // Video and screenshot settings
      VIDEO: req.body.video || 'retain-on-failure',
      SCREENSHOT: req.body.screenshot || 'only-on-failure',
    };

    console.log('Environment Variables:', {
      TEST_PROJECT_DIR: runEnv.TEST_PROJECT_DIR,
      REPORT_DIR: runEnv.REPORT_DIR,
      RESULTS_DIR: runEnv.RESULTS_DIR,
      HEADED: runEnv.HEADED,
      TEST_ENV: runEnv.TEST_ENV,
      TIMEOUT: runEnv.TIMEOUT,
      NODE_PATH: runEnv.NODE_PATH,
      BROWSER: runEnv.BROWSER,
      WIDTH: runEnv.WIDTH,
      HEIGHT: runEnv.HEIGHT,
      BASE_URL: runEnv.BASE_URL,
      VIDEO: runEnv.VIDEO,
      SCREENSHOT: runEnv.SCREENSHOT,
    });

    // ── Queue the run ──────────────────────────────────────────────────────────
    console.log('Enqueueing run...');
    runQueue.enqueue({
      runId,
      projectId,
      targetPath: requestedSubPath,
      execute: async () => {
        return new Promise<void>((resolve, reject) => {
          console.log(`\n🚀 EXECUTING RUN ${runId}`);
          console.log('Working Directory (CWD):', serverRoot);
          console.log('Project Root:', testProjectRoot);
          console.log('Test Spec Path:', testSpecPath);
          console.log('Full Command:', `npx playwright ${args.join(' ')}`);
          
          // Broadcast start with command display
          broadcast({ type: 'run:start', runId, command });
          runStore.addLog(runId, 'info', `$ ${command}`);
          broadcast({ type: 'run:stdout', runId, data: `$ ${command}\n` });

          // Spawn Playwright process using npx (simpler and handles module resolution)
          // CWD is server directory, test path is absolute
          const child: ChildProcess = spawn('npx', ['playwright', ...args], {
            cwd: serverRoot,
            shell: true,
            env: runEnv,
          });

          console.log('✅ Process spawned, PID:', child.pid);

          child.stdout?.on('data', (chunk: Buffer) => {
            const data = chunk.toString();
            console.log('[STDOUT]', data);
            runStore.addLog(runId, 'stdout', data);
            broadcast({ type: 'run:stdout', runId, data });
          });

          child.stderr?.on('data', (chunk: Buffer) => {
            const data = chunk.toString();
            console.log('[STDERR]', data);
            runStore.addLog(runId, 'stderr', data);
            broadcast({ type: 'run:stderr', runId, data });
          });

          child.on('close', (exitCode) => {
            console.log(`\n✅ Process closed with exit code: ${exitCode}`);
            runStore.addLog(runId, 'done', 'Execution finished.', exitCode ?? 0);
            broadcast({ type: 'run:done', runId, exitCode });
            resolve();
          });

          child.on('error', (err) => {
            console.error(`\n❌ Process error:`, err);
            runStore.addLog(runId, 'error', err.message);
            broadcast({ type: 'run:error', runId, error: err.message });
            reject(err);
          });
        });
      }
    });
    console.log('✅ Run enqueued successfully\n');
  });

  /**
   * GET /api/projects/:projectId/run/:runId
   * Returns the stored log history for a specific run.
   */
  router.get('/:projectId/run/:runId', (req, res) => {
    const { runId } = req.params;
    const run = runStore.getRun(runId);
    
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    res.json(run);
  });

  /**
   * GET /api/projects/:projectId/runs
   * Returns metadata for all runs of this project by scanning the executions directory.
   */
  router.get('/:projectId/runs', async (req, res) => {
    const { projectId } = req.params;
    const executionsPath = process.env.EXECUTIONS_BASE_PATH || 'C:/tmp/playwright-studio/executions';
    const projectRunsDir = path.join(executionsPath, projectId, 'runs');

    try {
      // Ensure the directory exists
      await fs.mkdir(projectRunsDir, { recursive: true });
      const runFolders = await fs.readdir(projectRunsDir);
      
      const runs = await Promise.all(
        runFolders.map(async (runId) => {
          const runPath = path.join(projectRunsDir, runId);
          const stats = await fs.stat(runPath);
          
          // Try to see if it's currently in memory
          const inMemoryRun = runStore.getRun(runId);

          return {
            runId,
            projectId,
            timestamp: stats.birthtime.toISOString(),
            status: inMemoryRun?.status || 'completed', // Default to completed if on disk
            hasHtmlReport: await fs.access(path.join(runPath, 'report', 'html', 'index.html')).then(() => true).catch(() => false),
            hasMonocartReport: await fs.access(path.join(runPath, 'report', 'monocart', 'index.html')).then(() => true).catch(() => false),
          };
        })
      );

      // Sort by newest first
      runs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      res.json(runs);
    } catch (err) {
      console.error('Failed to list runs:', err);
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  return router;
}

