import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireProjectRole } from '../middleware/auth.js';
import { listUsers, getUserRoles, upsertUserRoles } from '../lib/user-admin-service.js';
import { exportData, importData } from '../lib/csv-service.js';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware, requireProjectRole('admin'));

// GET /apis/admin/:projectId/users
router.get('/users', async (req, res) => {
  try {
    const scope = { projectId: (req.params as any).projectId };
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const email = req.query.email as string | undefined;
    const providerId = req.query.providerId as string | undefined;
    const result = await listUsers(scope, { page, limit, email, providerId });
    res.json(result);
  } catch (err) {
    console.error('[ProjectAdmin] listUsers error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /apis/admin/:projectId/users/:userId/roles
router.get('/users/:userId/roles', async (req, res) => {
  try {
    const scope = { projectId: (req.params as any).projectId };
    const memberships = await getUserRoles(scope, (req.params as any).userId);
    res.json({ projectRoles: memberships });
  } catch (err) {
    console.error('[ProjectAdmin] getUserRoles error:', err);
    res.status(500).json({ error: 'Failed to get user roles' });
  }
});

// POST /apis/admin/:projectId/users/:userId/roles
router.post('/users/:userId/roles', async (req, res) => {
  const { roleId, roleName } = req.body;
  if (!roleId && !roleName) return res.status(400).json({ error: 'roleId or roleName is required' });
  try {
    const scope = { projectId: (req.params as any).projectId };
    const result = await upsertUserRoles(scope, (req.params as any).userId, { roleId, roleName });
    if (result.error) return res.status(result.status ?? 500).json({ error: result.error });
    res.json({ success: true });
  } catch (err) {
    console.error('[ProjectAdmin] upsertUserRoles error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// GET /apis/admin/:projectId/export
router.get('/export', async (req, res) => {
  try {
    const scope = { projectId: (req.params as any).projectId };
    const buffer = await exportData(scope);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${scope.projectId}-export-${date}.zip"`);
    res.send(buffer);
  } catch (err) {
    console.error('[ProjectAdmin] export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /apis/admin/:projectId/import
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const scope = { projectId: (req.params as any).projectId };
    const result = await importData(scope, req.file.buffer);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'INVALID_ZIP') return res.status(400).json({ error: 'Invalid ZIP archive' });
    console.error('[ProjectAdmin] import error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
