// Shared API client for user management and data transfer.
// All functions are parameterised by basePath — no hardcoded path logic inside.

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/app/login';
    throw new Error('Unauthorized');
  }
  return res;
}

export interface PaginatedUsersResponse {
  users: {
    id: string;
    email: string;
    name: string | null;
    provider: string | null;
    providerId: string | null;
    createdAt: string;
  }[];
  total: number;
  page: number;
  limit: number;
}

export interface MembershipWithRole {
  membershipId: string;
  roleId: string;
  roleName: string;
  projectId: string | null;
  projectName: string | null;
}

export interface UserRolesResponse {
  globalRole: MembershipWithRole | null;
  projectRoles: MembershipWithRole[];
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

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: { table: string; row: number; message: string }[];
}

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  email?: string;
  providerId?: string;
}

export async function listUsers(basePath: string, options: ListUsersOptions = {}): Promise<PaginatedUsersResponse> {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.email) params.set('email', options.email);
  if (options.providerId) params.set('providerId', options.providerId);
  const qs = params.toString();
  const res = await apiFetch(`${basePath}/users${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to list users');
  return res.json();
}

export async function getUserRoles(basePath: string, userId: string): Promise<UserRolesResponse> {
  const res = await apiFetch(`${basePath}/users/${userId}/roles`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to get user roles');
  return res.json();
}

export async function upsertUserRoles(
  basePath: string,
  userId: string,
  payload: UpsertGlobalRolesPayload | UpsertProjectRolePayload,
): Promise<void> {
  const res = await apiFetch(`${basePath}/users/${userId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to update roles');
  }
}

export async function exportData(basePath: string): Promise<void> {
  const res = await apiFetch(`${basePath}/export`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Export failed');

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'export.zip';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importData(basePath: string, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch(`${basePath}/import`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Import failed');
  }
  return res.json();
}
