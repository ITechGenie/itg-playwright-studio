"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const dotenv_1 = __importDefault(require("dotenv"));
const run_js_1 = require("./routes/run.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
// Serve static reports
const executionsPath = process.env.EXECUTIONS_BASE_PATH || 'C:/tmp/playwright-studio/executions';
app.use('/api/reports', express_1.default.static(executionsPath));
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Basic sanity check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'playwright-studio' });
});
// Mount run router (POST /api/projects/:projectId/run)
app.use('/api/projects', (0, run_js_1.createRunRouter)(wss));
// Projects List API
app.get('/api/projects', async (req, res) => {
    try {
        const basePath = process.env.PROJECTS_BASE_PATH || 'C:/tmp/playwright-studio/projects';
        try {
            await fs.access(basePath);
        }
        catch {
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
    }
    catch (err) {
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
        const requestedSubPath = req.query.path || '';
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
        }
        catch {
            console.log(`[API /files] Directory not found: ${targetPath}`);
            // Return empty if path does not exist to avoid crashing client initially
            return res.json([]);
        }
        // 4. Read Directory
        console.log(`[API /files] Successfully accessing: ${targetPath}`);
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        // 5. Map attributes and filter safe files
        const files = await Promise.all(entries
            .filter(entry => {
            // Ignore dot files/folders immediately
            if (entry.name.startsWith('.'))
                return false;
            // If file, check whitelist extensions
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                return allowedExts.includes(ext);
            }
            return true; // Keep folders that pass the dot-prefix check
        })
            .map(async (entry) => {
            const fullItemPath = path.join(targetPath, entry.name);
            let stat;
            try {
                stat = await fs.stat(fullItemPath);
            }
            catch {
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
        }));
        res.json(files);
    }
    catch (err) {
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
