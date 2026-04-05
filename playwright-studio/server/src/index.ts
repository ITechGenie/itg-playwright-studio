import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRunRouter } from './routes/run.js';
import { createDataRouter } from './routes/data.js';
import { createSchedulesRouter } from './routes/schedules.js';
import authRouter from './routes/auth.js';
import { db, sqliteDb } from './db/index.js';
import { projects, projectConfigs, roles, users, memberships } from './db/schema.js';
import { authMiddleware, requireAdmin, requireProjectRole, decryptAes } from './middleware/auth.js';
import { eq } from 'drizzle-orm';
import { generateId } from './lib/uuid.js';
import { leaderElection } from './lib/leader-election.js';
import { schedulerService } from './lib/scheduler-service.js';
import { setWss } from './lib/trigger-run.js';
import { runStore } from './run-store.js';

const SUPERADMIN_EMAIL = 'superadmin@localhost';
const SUPERADMIN_ROLE_ID = 'role_super_admin';
const SUPERADMIN_USER_ID = 'user_superadmin_local';

async function seedSuperAdmin() {
  try {
    // Ensure super_admin role exists
    const [existingRole] = await db.select().from(roles).where(eq(roles.id, SUPERADMIN_ROLE_ID));
    if (!existingRole) {
      await db.insert(roles).values({ id: SUPERADMIN_ROLE_ID, name: 'super_admin', scope: 'global' });
    }

    // Ensure superadmin user exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, SUPERADMIN_EMAIL));
    if (!existingUser) {
      await db.insert(users).values({
        id: SUPERADMIN_USER_ID,
        email: SUPERADMIN_EMAIL,
        name: 'Super Admin',
        createdAt: new Date(),
      });
      await db.insert(memberships).values({
        id: generateId(),
        userId: SUPERADMIN_USER_ID,
        roleId: SUPERADMIN_ROLE_ID,
        projectId: null,
        createdAt: new Date(),
      });
      console.log('[Seed] Superadmin user created');
    }
  } catch (err) {
    console.warn('[Seed] Superadmin seed failed (non-fatal):', err);
  }
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static reports
const executionsPath = process.env.EXECUTIONS_BASE_PATH || path.join(process.cwd(), 'executions');
app.use('/apis/reports', express.static(executionsPath));

app.use(cors());
app.use(express.json());

// ── Startup Sync: Disk Folders to Database ── 
async function syncProjects() {
  const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
  try {
    await fs.mkdir(basePath, { recursive: true });
    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);

    for (const folderName of folders) {
      const existing = await db.select().from(projects).where(eq(projects.name, folderName));
      if (existing.length === 0) {
        console.log(`[Sync] Registering new project folder: ${folderName}`);
        const projectId = generateId();
        await db.insert(projects).values({
          id: projectId,
          name: folderName,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        // Create default config
        await db.insert(projectConfigs).values({
          id: generateId(),
          projectId: projectId,
        });
      }
    }
    return { success: true, count: folders.length };
  } catch (err) {
    console.error('[Sync] Failed to sync projects:', err);
    throw err;
  }
}

async function ensureColumn(table: string, column: string, definition: string) {
  const result = await sqliteDb.execute(`PRAGMA table_info(${table});`);
  const hasColumn = result.rows.some((row: any) => row.name === column);
  if (!hasColumn) {
    console.log(`[Migration] adding missing column ${table}.${column}`);
    await sqliteDb.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

async function applyMigrations() {
  if (process.env.SKIP_MIGRATIONS === '1') {
    console.log('[Migration] SKIP_MIGRATIONS=1 set, skipping SQL migration file execution');
    return;
  }

  const migrationsDir = path.join(__dirname, '..', 'drizzle');
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');

      // Handle both standard semicolon and Drizzle's custom breakpoint
      const statements = sql
        .split(/-->\s*statement-breakpoint|;\s*\n/)
        .map(s => s.trim())
        .filter(Boolean);

      for (const statement of statements) {
        try {
          await sqliteDb.execute(statement);
        } catch (err: any) {
          // Ignore if statement already exists or minor failures
          if (!err.message?.includes('already exists')) {
            console.warn(`[Migration] statement error in ${file} (continuing):`, err?.message || err);
          }
        }
      }
      console.log(`[Migration] applied schema migrations from ${file}`);
    }
  } catch (err) {
    if ((err as any)?.code === 'ENOENT') {
      console.warn('[Migration] drizzle directory not found');
    } else {
      console.error('[Migration] failed', err);
      throw err;
    }
  }

  // Ensure provider fields are synced as patch migration for existing databases
  try {
    await ensureColumn('users', 'provider', 'TEXT');
    await ensureColumn('users', 'provider_id', 'TEXT');
    await ensureColumn('users', 'provider_username', 'TEXT');
    await ensureColumn('users', 'provider_token', 'TEXT');
    await ensureColumn('users', 'provider_token_expires_at', 'INTEGER');

    // Run configuration columns
    await ensureColumn('project_configs', 'headless', 'INTEGER DEFAULT 1 NOT NULL');
    await ensureColumn('project_configs', 'workers', 'INTEGER DEFAULT 1 NOT NULL');
    await ensureColumn('project_configs', 'browsers', 'TEXT DEFAULT \'["chromium"]\' NOT NULL');
    await ensureColumn('project_configs', 'extra_args', 'TEXT DEFAULT \'[]\' NOT NULL');

    // Scheduler tables (safe create for existing DBs handled by SQL migration)
    // Ensure scheduler_lock table exists for older DBs that may have skipped the migration
    await sqliteDb.execute(`CREATE TABLE IF NOT EXISTS scheduler_lock (
      lock_key TEXT PRIMARY KEY NOT NULL,
      holder_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
    await sqliteDb.execute(`CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_paths TEXT NOT NULL DEFAULT '[]',
      config TEXT NOT NULL,
      pattern TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      last_run_at INTEGER,
      last_run_id TEXT,
      next_run_at INTEGER
    )`);

    // Backfill existing mandatory role with safe fallback
    const result = await sqliteDb.execute("SELECT COUNT(*) as cnt FROM roles WHERE name='user' AND scope='global'");
    const count = Number(result.rows[0]?.cnt ?? 0);
    if (count === 0) {
      const roleId = generateId();
      await db.insert(roles).values({ id: roleId, name: 'user', scope: 'global' });
      console.log('[Migration] seeded default global user role');
    }
  } catch (err: any) {
    console.warn('[Migration] post-migration check failed', err?.message || err);
  }
}

// Basic health check
app.get('/apis/public/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-studio' });
});

// Admin Sync Endpoint
app.post('/apis/admin/projects/sync', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await syncProjects();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Projects Auth Group (List and Create)
app.get('/apis/auth/projects', authMiddleware, requireProjectRole('user'), async (req, res) => {
  try {
    const allProjects = await db.select({
      id: projects.id,
      name: projects.name,
      repoUrl: projects.repoUrl,
      gitRepoId: projects.gitRepoId,
      createdAt: projects.createdAt,
      config: {
        browser: projectConfigs.browser,
        viewportWidth: projectConfigs.viewportWidth,
        viewportHeight: projectConfigs.viewportHeight,
        baseUrl: projectConfigs.baseUrl,
        video: projectConfigs.video,
        screenshot: projectConfigs.screenshot,
        headless: projectConfigs.headless,
        workers: projectConfigs.workers,
        browsers: projectConfigs.browsers,
        extraArgs: projectConfigs.extraArgs,
      }
    })
      .from(projects)
      .leftJoin(projectConfigs, eq(projects.id, projectConfigs.projectId));

    const formatted = allProjects.map(p => ({
      id: p.id,
      name: p.name,
      repoUrl: p.repoUrl,
      gitRepoId: p.gitRepoId,
      grouper: "Workspace",
      status: "Active",
      config: p.config,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/apis/auth/projects', authMiddleware, requireProjectRole('user'), async (req, res) => {
  const { name, gitUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  try {
    const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
    const projectPath = path.join(basePath, name);

    // 1. Validate Git URL if provided
    let parsedGitUrl = null;
    let gitRepoId = null;
    if (gitUrl) {
      const { GitUrlParser } = await import('./lib/git-url-parser.js');
      try {
        parsedGitUrl = GitUrlParser.parse(gitUrl);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid Git URL format';
        return res.status(400).json({ error: errorMessage });
      }
    }

    // 2. Create directory if not exists
    await fs.mkdir(projectPath, { recursive: true });

    // 3. Check if already in DB
    const existing = await db.select().from(projects).where(eq(projects.name, name));
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Project already exists in database' });
    }

    // 4. If Git URL provided, sync files from repository
    if (gitUrl && parsedGitUrl) {
      const { createGitSyncService } = await import('./lib/git-sync-service.js');
      const { createGitProviderClient } = await import('./lib/git-provider-client.js');

      // Get user's OAuth token
      const user = (req as any).user;
      if (!user || !user.providerToken) {
        return res.status(401).json({ error: 'Authentication required for Git operations' });
      }

      console.log(`[GitImport] user.id=${user.id}, user.provider=${user.provider}`);
      console.log(`[GitImport] providerToken present=${!!user.providerToken}, length=${user.providerToken?.length ?? 0}`);

      const rawToken = user.providerToken ? decryptAes(user.providerToken) : null;
      console.log(`[GitImport] decrypted token present=${!!rawToken}, length=${rawToken?.length ?? 0}`);

      if (!rawToken) {
        return res.status(401).json({ error: 'Failed to decrypt OAuth token. Please re-authenticate.' });
      }

      try {
        // Resolve git_repo_id
        if (parsedGitUrl.provider === 'gitlab') {
          const client = createGitProviderClient('gitlab') as any;
          gitRepoId = await client.resolveGitLabProjectId(
            parsedGitUrl.repoOwner,
            parsedGitUrl.repoName,
            rawToken
          );
        } else {
          gitRepoId = `${parsedGitUrl.repoOwner}/${parsedGitUrl.repoName}`;
        }

        // Sync files from Git
        const syncService = createGitSyncService(basePath);
        const syncResult = await syncService.syncProject(name, gitUrl, rawToken);

        if (!syncResult.success) {
          // Clean up created directory on sync failure
          await fs.rm(projectPath, { recursive: true, force: true });
          return res.status(500).json({
            error: 'Failed to sync files from Git repository',
            details: syncResult.errors
          });
        }
      } catch (error) {
        // Clean up created directory on error
        await fs.rm(projectPath, { recursive: true, force: true });
        const errorMessage = error instanceof Error ? error.message : 'Git sync failed';
        return res.status(500).json({ error: errorMessage });
      }
    }

    // 5. Insert into DB
    const projectId = generateId();
    await db.insert(projects).values({
      id: projectId,
      name,
      repoUrl: gitUrl || null,
      gitRepoId: gitRepoId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 6. Create default config
    await db.insert(projectConfigs).values({
      id: generateId(),
      projectId: projectId,
    });

    res.status(201).json({ id: projectId, name, repoUrl: gitUrl || null, gitRepoId: gitRepoId || null });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Auth routes: login/callback/me/pats
app.use('/apis/auth', authRouter);

// Mount run router and data router under /apis/project with authentication and project role checks
app.use('/apis/project', authMiddleware, requireProjectRole('user'), createRunRouter(wss));
app.use('/apis/project', authMiddleware, requireProjectRole('user'), createDataRouter());
app.use('/apis/project', authMiddleware, requireProjectRole('user'), createSchedulesRouter());

// Project Specific Operations
app.put('/apis/project/:projectId/config', authMiddleware, requireProjectRole('admin'), async (req, res) => {
  const { projectId } = req.params;
  const configUpdate = req.body;

  try {
    const [config] = await db.select().from(projectConfigs).where(eq(projectConfigs.projectId, projectId));
    if (!config) return res.status(404).json({ error: 'Project configuration not found' });

    const safeUpdate: Record<string, any> = {};
    if (configUpdate.browser !== undefined) safeUpdate.browser = configUpdate.browser;
    if (configUpdate.viewportWidth !== undefined) safeUpdate.viewportWidth = parseInt(configUpdate.viewportWidth);
    if (configUpdate.viewportHeight !== undefined) safeUpdate.viewportHeight = parseInt(configUpdate.viewportHeight);
    if (configUpdate.baseUrl !== undefined) safeUpdate.baseUrl = configUpdate.baseUrl;
    if (configUpdate.video !== undefined) safeUpdate.video = configUpdate.video;
    if (configUpdate.screenshot !== undefined) safeUpdate.screenshot = configUpdate.screenshot;
    if (configUpdate.timeout !== undefined) safeUpdate.timeout = parseInt(configUpdate.timeout);
    if (configUpdate.headless !== undefined) safeUpdate.headless = configUpdate.headless ? 1 : 0;
    if (configUpdate.workers !== undefined) safeUpdate.workers = parseInt(configUpdate.workers);
    if (configUpdate.browsers !== undefined) safeUpdate.browsers = JSON.stringify(configUpdate.browsers);
    if (configUpdate.extraArgs !== undefined) safeUpdate.extraArgs = JSON.stringify(configUpdate.extraArgs);

    await db.update(projectConfigs)
      .set(safeUpdate)
      .where(eq(projectConfigs.projectId, projectId));

    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
    res.json({ success: true });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

app.get('/apis/project/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const requestedSubPath = (req.query.path as string) || '';

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const folderName = project.name;
    const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
    const projectRoot = path.resolve(basePath, folderName);
    const targetPath = path.resolve(projectRoot, requestedSubPath);

    if (!targetPath.startsWith(projectRoot)) return res.status(403).json({ error: 'Forbidden' });

    try { await fs.access(targetPath); } catch { return res.json([]); }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const allowedExts = (process.env.ALLOWED_FILE_EXTENSIONS || '.ts,.js').split(',');

    const files = await Promise.all(
      entries
        .filter(entry => {
          if (entry.name.startsWith('.')) return false;
          if (entry.isFile()) return allowedExts.includes(path.extname(entry.name).toLowerCase());
          return true;
        })
        .map(async entry => {
          const fullItemPath = path.join(targetPath, entry.name);
          let stat;
          try { stat = await fs.stat(fullItemPath); } catch { stat = { size: 0, mtime: new Date() }; }

          return {
            id: path.join(requestedSubPath, entry.name).replace(/\\/g, '/'),
            name: entry.name,
            type: entry.isDirectory() ? 'folder' : 'file',
            size: entry.isDirectory() ? '--' : `${(stat.size / 1024).toFixed(1)} KB`,
            date: stat.mtime.toLocaleDateString(),
            icon: entry.isDirectory() ? 'folder' : 'file',
            owner: { name: 'Admin', avatar: '' }
          };
        })
    );
    res.json(files);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to read directory' });
  }
});

app.get('/apis/project/:projectId/files/content', authMiddleware, requireProjectRole('user'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const requestedSubPath = (req.query.path as string);
    if (!requestedSubPath) return res.status(400).json({ error: 'Path required' });

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const folderName = project.name;
    const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
    const projectRoot = path.resolve(basePath, folderName);
    const targetPath = path.resolve(projectRoot, requestedSubPath);

    if (!targetPath.startsWith(projectRoot)) return res.status(403).json({ error: 'Forbidden' });

    const content = await fs.readFile(targetPath, 'utf8');
    res.json({ content });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to read file content' });
  }
});

app.put('/apis/project/:projectId/files/content', authMiddleware, requireProjectRole('user'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const requestedSubPath = (req.query.path as string);
    const { content, commitMessage } = req.body;

    if (!requestedSubPath) return res.status(400).json({ error: 'Path required' });

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const folderName = project.name;
    const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
    const projectRoot = path.resolve(basePath, folderName);
    const targetPath = path.resolve(projectRoot, requestedSubPath);

    if (!targetPath.startsWith(projectRoot)) return res.status(403).json({ error: 'Forbidden' });

    // ensure parent dir exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf8');

    // Check if we should push to Git
    let gitPushed = false;
    let gitError: string | undefined;

    if (commitMessage && project.repoUrl && project.gitRepoId) {
      // Get user's OAuth token
      const user = (req as any).user;
      if (user && user.providerToken) {
        const rawToken = decryptAes(user.providerToken);
        if (rawToken) {
          try {
            const { createGitPushService } = await import('./lib/git-push-service.js');
            const pushService = createGitPushService();
            const pushResult = await pushService.pushFile(
              projectId,
              requestedSubPath,
              content,
              commitMessage,
              rawToken
            );
            gitPushed = pushResult.success;
            gitError = pushResult.error;
            if (!pushResult.success) {
              console.error('[Git Push] Failed:', pushResult.error);
            }
          } catch (err) {
            console.error('[Git Push] Error:', err);
            gitError = err instanceof Error ? err.message : 'Unknown error during Git push';
          }
        } else {
          gitError = 'Failed to decrypt OAuth token';
        }
      } else {
        gitError = 'Authentication required for Git operations';
      }
    }

    res.json({
      success: true,
      gitPushed,
      gitError
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to write file content' });
  }
});

// Git Sync Endpoint
app.post('/apis/project/:projectId/git-sync', authMiddleware, requireProjectRole('user'), async (req, res) => {
  try {
    const { projectId } = req.params;

    // Load project from database
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Check if project has Git config
    if (!project.repoUrl) {
      return res.status(400).json({ error: 'Project does not have Git configuration' });
    }

    // Get user's OAuth token
    const user = (req as any).user;
    if (!user || !user.providerToken) {
      return res.status(401).json({ error: 'Authentication required for Git operations' });
    }

    const rawToken = decryptAes(user.providerToken);
    if (!rawToken) {
      return res.status(401).json({ error: 'Failed to decrypt OAuth token. Please re-authenticate.' });
    }

    // Sync files from Git
    const { createGitSyncService } = await import('./lib/git-sync-service.js');
    const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
    const syncService = createGitSyncService(basePath);
    const syncResult = await syncService.syncProject(project.name, project.repoUrl, rawToken);

    if (!syncResult.success) {
      return res.status(500).json({
        success: false,
        filesDownloaded: syncResult.filesDownloaded,
        errors: syncResult.errors
      });
    }

    res.json({
      success: true,
      filesDownloaded: syncResult.filesDownloaded,
      errors: []
    });
  } catch (err) {
    console.error('API Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to sync from Git';
    res.status(500).json({ error: errorMessage });
  }
});

// Git Config Update Endpoint
app.patch('/apis/project/:projectId/git-config', authMiddleware, requireProjectRole('admin'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { repoUrl } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' });
    }

    // Validate Git URL
    const { GitUrlParser } = await import('./lib/git-url-parser.js');
    let parsedGitUrl;
    try {
      parsedGitUrl = GitUrlParser.parse(repoUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid Git URL format';
      return res.status(400).json({ error: errorMessage });
    }

    // Load project from database
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Get user's OAuth token
    const user = (req as any).user;
    if (!user || !user.providerToken) {
      return res.status(401).json({ error: 'Authentication required for Git operations' });
    }

    const rawToken = decryptAes(user.providerToken);
    if (!rawToken) {
      return res.status(401).json({ error: 'Failed to decrypt OAuth token. Please re-authenticate.' });
    }

    // Resolve git_repo_id for the new URL
    let gitRepoId;
    const { createGitProviderClient } = await import('./lib/git-provider-client.js');

    if (parsedGitUrl.provider === 'gitlab') {
      const client = createGitProviderClient('gitlab') as any;
      gitRepoId = await client.resolveGitLabProjectId(
        parsedGitUrl.repoOwner,
        parsedGitUrl.repoName,
        rawToken
      );
    } else {
      gitRepoId = `${parsedGitUrl.repoOwner}/${parsedGitUrl.repoName}`;
    }

    // Update project record
    await db.update(projects)
      .set({
        repoUrl: repoUrl,
        gitRepoId: gitRepoId,
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId));

    res.json({ success: true });
  } catch (err) {
    console.error('API Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to update Git configuration';
    res.status(500).json({ error: errorMessage });
  }
});

// ── Static Assets & SPA Fallback ──
const staticPath = path.join(process.cwd(), 'static');

// Serve static assets from /app prefix
// If a file is at static/index.html, it will be at /app/index.html
app.use('/app', express.static(staticPath));

// Web App SPA Fallback: Any other /app/* route should serve index.html
app.get('/app/*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Redirect root '/' to '/app/projects'
app.get('/', (req, res) => {
  res.redirect('/app/projects');
});

// Redirect '/app' specifically to '/app/projects'
app.get('/app', (req, res) => {
  res.redirect('/app/projects');
});

// WebSocket setup
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to Playwright Studio' }));
});

// Share WSS with the internal trigger-run module
setWss(wss);

const PORT = parseInt(process.env.PORT || '3000');
server.listen(PORT, async () => {
  try {
    await applyMigrations();
    await syncProjects();
    await runStore.cleanupOrphanedRuns();
    await seedSuperAdmin();

    // Start leader election — only the winning pod initializes the scheduler
    leaderElection.start(
      () => schedulerService.initialize(),
      () => schedulerService.cancelAllJobs()
    );

    console.log(`🚀 Studio API Server running on http://localhost:${PORT}`);
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
});
