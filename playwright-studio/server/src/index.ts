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
import authRouter from './routes/auth.js';
import { db, sqliteDb } from './db/index.js';
import { projects, projectConfigs, roles } from './db/schema.js';
import { authMiddleware, requireAdmin, requireProjectRole } from './middleware/auth.js';
import { eq } from 'drizzle-orm';
import { generateId } from './lib/uuid.js';

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
      createdAt: projects.createdAt,
      config: {
        browser: projectConfigs.browser,
        viewportWidth: projectConfigs.viewportWidth,
        viewportHeight: projectConfigs.viewportHeight,
        baseUrl: projectConfigs.baseUrl,
        video: projectConfigs.video,
        screenshot: projectConfigs.screenshot,
      }
    })
      .from(projects)
      .leftJoin(projectConfigs, eq(projects.id, projectConfigs.projectId));

    const formatted = allProjects.map(p => ({
      id: p.id,
      name: p.name,
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
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  try {
    const basePath = process.env.PROJECTS_BASE_PATH || path.join(process.cwd(), 'projects');
    const projectPath = path.join(basePath, name);

    // 1. Create directory if not exists
    await fs.mkdir(projectPath, { recursive: true });

    // 2. Check if already in DB
    const existing = await db.select().from(projects).where(eq(projects.name, name));
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Project already exists in database' });
    }

    // 3. Insert into DB
    const projectId = generateId();
    await db.insert(projects).values({
      id: projectId,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Create default config
    await db.insert(projectConfigs).values({
      id: generateId(),
      projectId: projectId,
    });

    res.status(201).json({ id: projectId, name });
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

// Project Specific Operations
app.put('/apis/project/:projectId/config', authMiddleware, requireProjectRole('admin'), async (req, res) => {
  const { projectId } = req.params;
  const configUpdate = req.body;

  try {
    const [config] = await db.select().from(projectConfigs).where(eq(projectConfigs.projectId, projectId));
    if (!config) return res.status(404).json({ error: 'Project configuration not found' });

    await db.update(projectConfigs)
      .set({
        ...configUpdate,
        viewportWidth: configUpdate.viewportWidth ? parseInt(configUpdate.viewportWidth) : undefined,
        viewportHeight: configUpdate.viewportHeight ? parseInt(configUpdate.viewportHeight) : undefined,
      })
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
    const { content } = req.body;
    
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
    
    res.json({ success: true });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to write file content' });
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

const PORT = parseInt(process.env.PORT || '3000');
server.listen(PORT, async () => {
  try {
    await applyMigrations();
    await syncProjects();
    console.log(`🚀 Studio API Server running on http://localhost:${PORT}`);
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
});
