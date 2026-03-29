import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import * as path from 'path';
import * as fs from 'fs/promises';
import dotenv from 'dotenv';
import { createRunRouter } from './routes/run.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static reports
const executionsPath = process.env.EXECUTIONS_BASE_PATH || 'C:/tmp/playwright-studio/executions';
app.use('/api/reports', express.static(executionsPath));

app.use(cors());
app.use(express.json());

// Basic sanity check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-studio' });
});

// Mount run router (POST /api/projects/:projectId/run)
app.use('/api/projects', createRunRouter(wss));
// Projects List API
app.get('/api/projects', async (req, res) => {
  try {
    const basePath = process.env.PROJECTS_BASE_PATH || 'C:/tmp/playwright-studio/projects';

    try {
      await fs.access(basePath);
    } catch {
      return res.json([]);
    }

    const entries = await fs.readdir(basePath, { withFileTypes: true });

    const projects = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => {
        return {
          id: entry.name,
          name: entry.name,
          grouper: "Workspace",
          createdBy: "Admin",
          status: "Active"
        };
      });

    res.json(projects);
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Failed to read projects directory' });
  }
});

// File Explorer API for Project Files
app.get('/api/projects/:projectId/files', async (req, res) => {
  try {
    const basePath = process.env.PROJECTS_BASE_PATH || 'C:/tmp/playwright-studio/projects';
    const allowedExts = (process.env.ALLOWED_FILE_EXTENSIONS || '.ts,.js').split(',');
    const projectId = req.params.projectId;
    const requestedSubPath = (req.query.path as string) || '';

    // 1. Resolve exact target path
    const projectRoot = path.resolve(basePath, projectId);
    const targetPath = path.resolve(projectRoot, requestedSubPath);

    console.log(`[API /files] Resolving Path:
        -> Base Path from ENV : ${basePath}
        -> Project ID         : ${projectId}
        -> Requested Sub Path : ${requestedSubPath}
        -> Resolved Root      : ${projectRoot}
        -> Resolved Target    : ${targetPath}`);

    // 2. Traversal Security Check: Ensure target starts with projectRoot
    if (!targetPath.startsWith(projectRoot)) {
      console.warn(`[API /files] Security blocked path traversal. Target outside root.`);
      return res.status(403).json({ error: 'Forbidden: Invalid path traversal detected' });
    }

    // 3. Prevent crashing if directory doesn't exist yet
    try {
      await fs.access(targetPath);
    } catch {
      console.log(`[API /files] Directory not found: ${targetPath}`);
      // Return empty if path does not exist to avoid crashing client initially
      return res.json([]);
    }

    // 4. Read Directory
    console.log(`[API /files] Successfully accessing: ${targetPath}`);
    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    // 5. Map attributes and filter safe files
    const files = await Promise.all(
      entries
        .filter(entry => {
          // Ignore dot files/folders immediately
          if (entry.name.startsWith('.')) return false;

          // If file, check whitelist extensions
          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            return allowedExts.includes(ext);
          }
          return true; // Keep folders that pass the dot-prefix check
        })
        .map(async entry => {
          const fullItemPath = path.join(targetPath, entry.name);
          let stat;
          try {
            stat = await fs.stat(fullItemPath);
          } catch {
            stat = { size: 0, mtime: new Date() };
          }

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

// Setup WebSockets for Agent/Worker connections
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');

  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });

  // Send initial handshake
  ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to Playwright Studio WebSocket API' }));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Studio API Server running on http://localhost:${PORT}`);
});
