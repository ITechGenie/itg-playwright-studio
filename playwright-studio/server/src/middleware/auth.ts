import crypto from 'crypto';
import { db } from '../db/index.js';
import { users, accessTokens, memberships, roles } from '../db/schema.js';
import { eq, isNull, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      authType?: 'jwt' | 'pat';
      tokenId?: string;
      role?: string;
    }
  }
}

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this-secret-1234';
const AES_KEY = crypto.scryptSync(process.env.AES_SECRET || 'aes-secret-32-char-minim', 'salt', 32);

export const ROLE_HIERARCHY = ['user', 'admin', 'super_admin'];

export function encryptAes(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptAes(value: string) {
  const [ivHex, encrypted] = value.split(':');
  if (!ivHex || !encrypted) return null;
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function extractToken(req: any) {
  const header = req.headers['authorization'];
  if (!header) return null;
  if (header.startsWith('Bearer ')) return header.slice(7);
  return header;
}

export function signJwt(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyJwt(token: string) {
  return jwt.verify(token, JWT_SECRET) as { sub: string; iat: number; exp: number };
}

export async function authMiddleware(req: any, res: any, next: any) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    let user = null;

    if (token.startsWith('pat_')) {
      const hash = sha256(token);
      const [pat] = await db.select().from(accessTokens).where(eq(accessTokens.tokenHash, hash));
      if (!pat || Number(pat.revoked) === 1) {
        return res.status(401).json({ error: 'Invalid PAT' });
      }

      if (pat.expiresAt && new Date(pat.expiresAt).getTime() < Date.now()) {
        return res.status(401).json({ error: 'Expired PAT' });
      }

      const [patUser] = await db.select().from(users).where(eq(users.id, pat.userId));
      if (!patUser) return res.status(401).json({ error: 'User not found for PAT' });

      await db.update(accessTokens).set({ lastUsedAt: new Date() as any }).where(eq(accessTokens.id, pat.id));

      user = patUser;
      req.authType = 'pat';
      req.tokenId = pat.id;
    } else {
      let decoded;
      try {
        decoded = verifyJwt(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid auth token' });
      }

      const [jwtUser] = await db.select().from(users).where(eq(users.id, decoded.sub));
      if (!jwtUser) return res.status(401).json({ error: 'User not found' });

      user = jwtUser;
      req.authType = 'jwt';
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

async function resolveRoleName(roleId: string): Promise<string> {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
  return role?.name || 'user';
}

export function requireProjectRole(minRole: 'user' | 'admin' | 'super_admin') {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id;
      const projectId = req.params.projectId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const [globalMembership] = await db.select().from(memberships).where(
        and(eq(memberships.userId, userId), isNull(memberships.projectId)),
      );

      if (globalMembership) {
        const name = await resolveRoleName(globalMembership.roleId);
        if (name === 'super_admin') {
          req.role = 'super_admin';
          return next();
        }
        if (ROLE_HIERARCHY.indexOf(name) >= ROLE_HIERARCHY.indexOf(minRole)) {
          req.role = name;
          return next();
        }
      }

      const [projectMembership] = await db.select().from(memberships).where(
        and(eq(memberships.userId, userId), eq(memberships.projectId, projectId)),
      );

      let role = 'user';
      if (projectMembership) {
        role = await resolveRoleName(projectMembership.roleId);
      }

      if (ROLE_HIERARCHY.indexOf(role) < ROLE_HIERARCHY.indexOf(minRole)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.role = role;
      next();
    } catch (err) {
      console.error('RBAC error:', err);
      return res.status(500).json({ error: 'RBAC error' });
    }
  };
}

export async function requireAdmin(req: any, res: any, next: any) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [globalMembership] = await db.select().from(memberships).where(
      and(eq(memberships.userId, userId), isNull(memberships.projectId)),
    );

    if (!globalMembership) return res.status(403).json({ error: 'Forbidden' });

    const roleName = await resolveRoleName(globalMembership.roleId);
    if (roleName !== 'admin' && roleName !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.role = roleName;
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    return res.status(500).json({ error: 'RBAC error' });
  }
}
