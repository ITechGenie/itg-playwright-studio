import { db } from '../db/index.js';
import { users, roles, memberships, projects } from '../db/schema.js';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { generateId } from './uuid.js';

export type Scope = { projectId: string | null };

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  provider: string | null;
  providerId: string | null;
  createdAt: Date | null;
}

export interface MembershipWithRole {
  membershipId: string;
  roleId: string;
  roleName: string;
  projectId: string | null;
  projectName: string | null;
}

export interface PaginatedUsers {
  users: UserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  email?: string;
  providerId?: string;
}

export interface UpsertGlobalRolesPayload {
  globalRoleId?: string;
  globalRoleName?: string;
  projectRoles?: { projectId: string; roleId?: string; roleName?: string }[];
}

export interface UpsertProjectRolePayload {
  roleId?: string;
  roleName?: string;
}

async function resolveRoleId(nameOrId: string): Promise<string | null> {
  // Try by name first, then by id
  const [byName] = await db.select().from(roles).where(eq(roles.name, nameOrId));
  if (byName) return byName.id;
  const [byId] = await db.select().from(roles).where(eq(roles.id, nameOrId));
  return byId?.id ?? null;
}

export async function listUsers(scope: Scope, options: ListUsersOptions = {}): Promise<PaginatedUsers> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const offset = (page - 1) * limit;

  // Fetch all users (or project-scoped users) then apply exact-match filter + pagination in JS
  // This avoids complex dynamic query building while keeping exact-match semantics
  let allUsers: UserRow[];

  if (scope.projectId === null) {
    // Global: all users
    const rows = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      provider: users.provider,
      providerId: users.providerId,
      createdAt: users.createdAt,
    }).from(users);
    allUsers = rows as UserRow[];
  } else {
    // Project-scoped: only users with a membership for this project
    const rows = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      provider: users.provider,
      providerId: users.providerId,
      createdAt: users.createdAt,
    })
      .from(users)
      .innerJoin(memberships, and(
        eq(memberships.userId, users.id),
        eq(memberships.projectId, scope.projectId),
      ));
    allUsers = rows as UserRow[];
  }

  // Exact-match filter (no LIKE/partial)
  let filtered = allUsers;
  if (options.email) {
    filtered = filtered.filter(u => u.email === options.email);
  } else if (options.providerId) {
    filtered = filtered.filter(u => u.providerId === options.providerId);
  }

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

  return { users: paged, total, page, limit };
}

export async function getUserRoles(scope: Scope, userId: string): Promise<MembershipWithRole[]> {
  if (scope.projectId === null) {
    // Global: return all memberships for this user
    const rows = await db.select({
      membershipId: memberships.id,
      roleId: memberships.roleId,
      roleName: roles.name,
      projectId: memberships.projectId,
      projectName: projects.name,
    })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .leftJoin(projects, eq(memberships.projectId, projects.id))
      .where(eq(memberships.userId, userId));

    return rows.map(r => ({
      membershipId: r.membershipId,
      roleId: r.roleId,
      roleName: r.roleName,
      projectId: r.projectId ?? null,
      projectName: r.projectName ?? null,
    }));
  } else {
    // Project-scoped: only the membership for this project
    const rows = await db.select({
      membershipId: memberships.id,
      roleId: memberships.roleId,
      roleName: roles.name,
      projectId: memberships.projectId,
      projectName: projects.name,
    })
      .from(memberships)
      .innerJoin(roles, eq(memberships.roleId, roles.id))
      .leftJoin(projects, eq(memberships.projectId, projects.id))
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.projectId, scope.projectId),
      ));

    return rows.map(r => ({
      membershipId: r.membershipId,
      roleId: r.roleId,
      roleName: r.roleName,
      projectId: r.projectId ?? null,
      projectName: r.projectName ?? null,
    }));
  }
}

export async function upsertUserRoles(
  scope: Scope,
  userId: string,
  payload: UpsertGlobalRolesPayload | UpsertProjectRolePayload,
): Promise<{ error?: string; status?: number }> {
  // Verify user exists
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { error: 'User not found', status: 404 };

  if (scope.projectId === null) {
    // Global scope: handle globalRoleId/globalRoleName and/or projectRoles
    const p = payload as UpsertGlobalRolesPayload;
    const globalRoleRef = p.globalRoleName || p.globalRoleId;

    if (globalRoleRef) {
      const resolvedId = await resolveRoleId(globalRoleRef);
      if (!resolvedId) return { error: `Role not found: ${globalRoleRef}`, status: 404 };
      const [existingGlobal] = await db.select().from(memberships).where(
        and(eq(memberships.userId, userId), isNull(memberships.projectId)),
      );
      if (existingGlobal) {
        await db.update(memberships).set({ roleId: resolvedId }).where(eq(memberships.id, existingGlobal.id));
      } else {
        await db.insert(memberships).values({
          id: generateId(), userId, roleId: resolvedId, projectId: null, createdAt: new Date(),
        });
      }
    }

    if (p.projectRoles && p.projectRoles.length > 0) {
      for (const pr of p.projectRoles) {
        const roleRef = pr.roleName || pr.roleId;
        if (!roleRef) continue;
        const resolvedId = await resolveRoleId(roleRef);
        if (!resolvedId) continue;
        const [existing] = await db.select().from(memberships).where(
          and(eq(memberships.userId, userId), eq(memberships.projectId, pr.projectId)),
        );
        if (existing) {
          await db.update(memberships).set({ roleId: resolvedId }).where(eq(memberships.id, existing.id));
        } else {
          await db.insert(memberships).values({
            id: generateId(), userId, roleId: resolvedId, projectId: pr.projectId, createdAt: new Date(),
          });
        }
      }
    }
  } else {
    // Project scope: upsert single project membership
    const p = payload as UpsertProjectRolePayload;
    const roleRef = p.roleName || p.roleId;
    if (!roleRef) return { error: 'roleId or roleName is required', status: 400 };
    const resolvedId = await resolveRoleId(roleRef);
    if (!resolvedId) return { error: `Role not found: ${roleRef}`, status: 404 };
    const [existing] = await db.select().from(memberships).where(
      and(eq(memberships.userId, userId), eq(memberships.projectId, scope.projectId)),
    );
    if (existing) {
      await db.update(memberships).set({ roleId: resolvedId }).where(eq(memberships.id, existing.id));
    } else {
      await db.insert(memberships).values({
        id: generateId(), userId, roleId: resolvedId, projectId: scope.projectId, createdAt: new Date(),
      });
    }
  }

  return {};
}
