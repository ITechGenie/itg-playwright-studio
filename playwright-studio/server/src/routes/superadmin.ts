import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireSuperAdmin } from '../middleware/auth.js';
import { listUsers, getUserRoles, upsertUserRoles } from '../lib/user-admin-service.js';
import { exportData, importData } from '../lib/csv-service.js';
import { db } from '../db/index.js';
import { accessTokens, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

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

// POST /apis/superadmin/users/:userId/roles
router.post('/users/:userId/roles', async (req, res) => {
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

// GET /apis/superadmin/pats — list ALL tokens across all users (super_admin only)
router.get('/pats', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: accessTokens.id,
        name: accessTokens.name,
        expiresAt: accessTokens.expiresAt,
        revoked: accessTokens.revoked,
        createdAt: accessTokens.createdAt,
        lastUsedAt: accessTokens.lastUsedAt,
        userId: accessTokens.userId,
        userEmail: users.email,
        userName: users.name,
      })
      .from(accessTokens)
      .leftJoin(users, eq(accessTokens.userId, users.id));
    res.json(rows);
  } catch (err) {
    console.error('[Superadmin] listPats error:', err);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

// POST /apis/superadmin/pats/:id/revoke — revoke any token (super_admin only)
router.post('/pats/:id/revoke', async (req, res) => {
  try {
    const { id } = req.params;
    const [token] = await db.select().from(accessTokens).where(eq(accessTokens.id, id));
    if (!token) return res.status(404).json({ error: 'Token not found' });
    await db.update(accessTokens).set({ revoked: 1 }).where(eq(accessTokens.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error('[Superadmin] revokePat error:', err);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

export default router;
