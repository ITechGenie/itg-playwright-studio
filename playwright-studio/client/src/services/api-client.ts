import { ENDPOINTS } from './api-endpoints';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const apiClient = {
  async getProjects() {
    const res = await fetch(ENDPOINTS.PROJECTS, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async getMe() {
    const res = await fetch(ENDPOINTS.AUTH_ME, { headers: authHeaders() });
    if (!res.ok) {
      throw new Error('Failed to fetch user info');
    }
    return res.json();
  },

  async getAuthConfig() {
    const res = await fetch(ENDPOINTS.AUTH_CONFIG);
    if (!res.ok) throw new Error('Failed to fetch auth config');
    return res.json();
  },

  async logout() {
    try {
      await fetch(ENDPOINTS.AUTH_LOGOUT, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch (err) {
      console.warn('Logout endpoint failed, still clearing local token', err);
    }
    localStorage.removeItem('authToken');
    window.location.href = '/';
  },

  async createProject(name: string) {
    const res = await fetch(ENDPOINTS.PROJECTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create project');
    }
    return res.json();
  },

  async syncProjects() {
    const res = await fetch(ENDPOINTS.SYNC, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to sync projects');
    return res.json();
  },

  async updateProjectConfig(projectId: string, config: any) {
    const res = await fetch(ENDPOINTS.PROJECT_CONFIG(projectId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update project config');
    return res.json();
  },

  async getRuns(projectId: string, options: { 
    limit?: number; 
    page?: number; 
    status?: string; 
    startDate?: string; 
    endDate?: string;
  } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));
    if (options.page) params.append('page', String(options.page));
    if (options.status) params.append('status', options.status);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const url = `${ENDPOINTS.PROJECT_RUNS(projectId)}${queryString ? `?${queryString}` : ''}`;
    
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch runs');
    return res.json();
  },

  async getRunDetails(projectId: string, runId: string) {
    const res = await fetch(ENDPOINTS.RUN_DETAILS(projectId, runId), { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch run details');
    return res.json();
  },

  async runTests(projectId: string, options: { 
    path?: string; 
    paths?: string[]; 
    [key: string]: any 
  }) {
    const res = await fetch(ENDPOINTS.PROJECT_RUN(projectId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error('Failed to start run');
    return res.json();
  },

  async getProjectFiles(projectId: string, path: string = '') {
    const url = new URL(window.location.origin + ENDPOINTS.PROJECT_FILES(projectId));
    if (path) url.searchParams.set('path', path);
    const res = await fetch(url.toString(), { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch project files');
    return res.json();
  },

  getReportUrl(projectId: string, runId: string, type: 'html' | 'monocart' | 'json') {
     if (type === 'json') return `${ENDPOINTS.REPORTS}/${projectId}/runs/${runId}/results.json`;
     return `${ENDPOINTS.REPORTS}/${projectId}/runs/${runId}/report/${type}/index.html`;
  },
};
