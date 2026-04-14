import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireSuperAdmin } from '../middleware/auth.js';
import { listUsers, getUserRoles, upsertUserRoles } from '../lib/user-admin-service.js';
import { exportData, importData } from '../lib/csv-service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const SCOPE = { projectId: null };

router.use(authMiddleware, requireSuperAdmin);

// GET /apis/superadmin/users
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const email = req.query.email as string | undefined;
    const providerId = req.query.providerId as string | undefined;
    const result = await listUsers(SCOPE, { page, limit, email, providerId });
    res.json(result);
  } catch (err) {
    console.error('[Superadmin] listUsers error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /apis/superadmin/users/:userId/roles
router.get('/users/:userId/roles', async (req, res) => {
  try {
    const memberships = await getUserRoles(SCOPE, req.params.userId);
    const globalRole = memberships.find(m => m.projectId === null) ?? null;
    const projectRoles = memberships.filter(m => m.projectId !== null);
    res.json({ globalRole, projectRoles });
  } catch (err) {
    console.error('[Superadmin] getUserRoles error:', err);
    res.status(500).json({ error: 'Failed to get user roles' });
  }
});

// PUT /apis/superadmin/users/:userId/roles
router.put('/users/:userId/roles', async (req, res) => {
  const { globalRoleId, globalRoleName, projectRoles } = req.body;
  if (!globalRoleId && !globalRoleName && (!projectRoles || projectRoles.length === 0)) {
    return res.status(400).json({ error: 'Must provide globalRoleId, globalRoleName, or projectRoles' });
  }
  try {
    const result = await upsertUserRoles(SCOPE, req.params.userId, { globalRoleId, globalRoleName, projectRoles });
    if (result.error) return res.status(result.status ?? 500).json({ error: result.error });
    res.json({ success: true });
  } catch (err) {
    console.error('[Superadmin] upsertUserRoles error:', err);
    res.status(500).json({ error: 'Failed to update roles' });
  }
});

// GET /apis/superadmin/export
router.get('/export', async (req, res) => {
  try {
    const buffer = await exportData(SCOPE);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="studio-export-${date}.zip"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Superadmin] export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /apis/superadmin/import
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await importData(SCOPE, req.file.buffer);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'INVALID_ZIP') return res.status(400).json({ error: 'Invalid ZIP archive' });
    console.error('[Superadmin] import error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
