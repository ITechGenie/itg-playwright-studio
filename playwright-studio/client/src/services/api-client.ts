import { ENDPOINTS } from './api-endpoints';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url: string | URL, options: RequestInit = {}) {
  const res = await fetch(url.toString(), options);
  if (res.status === 401) {
    localStorage.removeItem('authToken');
    // Save current path to redirect back after login if needed? 
    // For now, just redirect to login as requested.
    window.location.href = '/app/login';
    throw new Error('Unauthorized');
  }
  return res;
}

export const apiClient = {
  async getProjects() {
    const res = await apiFetch(ENDPOINTS.PROJECTS, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async getMe() {
    const res = await apiFetch(ENDPOINTS.AUTH_ME, { headers: authHeaders() });
    if (!res.ok) {
      throw new Error('Failed to fetch user info');
    }
    return res.json();
  },

  async getAuthConfig() {
    const res = await apiFetch(ENDPOINTS.AUTH_CONFIG);
    if (!res.ok) throw new Error('Failed to fetch auth config');
    return res.json();
  },

  async logout() {
    try {
      await apiFetch(ENDPOINTS.AUTH_LOGOUT, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch (err) {
      console.warn('Logout endpoint failed, still clearing local token', err);
    }
    localStorage.removeItem('authToken');
    window.location.href = '/';
  },

  async createProject(name: string, gitUrl?: string) {
    const res = await apiFetch(ENDPOINTS.PROJECTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name, gitUrl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create project');
    }
    return res.json();
  },

  async syncProjects() {
    const res = await apiFetch(ENDPOINTS.SYNC, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to sync projects');
    return res.json();
  },

  async updateProjectConfig(projectId: string, config: any) {
    const res = await apiFetch(ENDPOINTS.PROJECT_CONFIG(projectId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update project config');
    return res.json();
  },

  async updateProjectGitConfig(projectId: string, repoUrl: string) {
    const res = await apiFetch(ENDPOINTS.PROJECTS + '/' + projectId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ repoUrl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update Git config');
    }
    return res.json();
  },

  async syncProjectFromGit(projectId: string) {
    const res = await apiFetch(ENDPOINTS.PROJECT_GIT_SYNC(projectId), {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to sync from Git');
    }
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
    
    const res = await apiFetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch runs');
    return res.json();
  },

  async getRunDetails(projectId: string, runId: string) {
    const res = await apiFetch(ENDPOINTS.RUN_DETAILS(projectId, runId), { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch run details');
    return res.json();
  },

  async runTests(projectId: string, options: { 
    path?: string; 
    paths?: string[]; 
    [key: string]: any 
  }) {
    const res = await apiFetch(ENDPOINTS.PROJECT_RUN(projectId), {
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
    const res = await apiFetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch project files');
    return res.json();
  },

  async getFileContent(projectId: string, path: string) {
    const url = new URL(window.location.origin + ENDPOINTS.PROJECT_FILES(projectId) + '/content');
    url.searchParams.set('path', path);
    const res = await apiFetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch file content');
    return res.json();
  },

  async updateFileContent(projectId: string, path: string, content: string, commitMessage?: string) {
    const url = new URL(window.location.origin + ENDPOINTS.PROJECT_FILES(projectId) + '/content');
    url.searchParams.set('path', path);
    const res = await apiFetch(url, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content, ...(commitMessage ? { commitMessage } : {}) })
    });
    if (!res.ok) throw new Error('Failed to save file content');
    return res.json();
  },

  getReportUrl(projectId: string, runId: string, type: 'html' | 'monocart' | 'json') {
     if (type === 'json') return `${ENDPOINTS.REPORTS}/${projectId}/runs/${runId}/results.json`;
     return `${ENDPOINTS.REPORTS}/${projectId}/runs/${runId}/report/${type}/index.html`;
  },

  // --- Data Manager ---
  async getDataTemplates(projectId: string) {
    const res = await apiFetch(ENDPOINTS.DATA_TEMPLATES(projectId), { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch data templates');
    return res.json();
  },

  async getDataTemplate(projectId: string, templateId: string) {
    const res = await apiFetch(ENDPOINTS.DATA_TEMPLATES(projectId) + '/' + templateId, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch data template details');
    return res.json();
  },

  async createDataTemplate(projectId: string, payload: any) {
    const res = await apiFetch(ENDPOINTS.DATA_TEMPLATES(projectId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create data template');
    return res.json();
  },

  async getDataEnvironments(projectId: string) {
    const res = await apiFetch(ENDPOINTS.DATA_ENVIRONMENTS(projectId), { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch data environments');
    return res.json();
  },

  async getDataEnvironment(projectId: string, envId: string) {
    const res = await apiFetch(ENDPOINTS.DATA_ENVIRONMENTS(projectId) + '/' + envId, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch data environment details');
    return res.json();
  },

  async createDataEnvironment(projectId: string, payload: any) {
    const res = await apiFetch(ENDPOINTS.DATA_ENVIRONMENTS(projectId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create data environment');
    return res.json();
  },

  async createDataSet(projectId: string, envId: string, payload: any) {
    const res = await apiFetch(ENDPOINTS.DATA_DATASETS(projectId, envId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create data set');
    return res.json();
  },

  async getDataSet(projectId: string, envId: string, datasetId: string) {
    const res = await apiFetch(ENDPOINTS.DATA_DATASETS(projectId, envId) + '/' + datasetId, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch data set details');
    return res.json();
  },

  // --- Schedules ---
  async getSchedules(projectId: string) {
    const res = await apiFetch(ENDPOINTS.PROJECT_SCHEDULES(projectId), { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch schedules');
    return res.json();
  },

  async createSchedule(projectId: string, payload: any) {
    const res = await apiFetch(ENDPOINTS.PROJECT_SCHEDULES(projectId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Failed to create schedule');
    }
    return res.json();
  },

  async updateSchedule(projectId: string, scheduleId: string, patch: any) {
    const res = await apiFetch(ENDPOINTS.PROJECT_SCHEDULE(projectId, scheduleId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Failed to update schedule');
    }
    return res.json();
  },

  async deleteSchedule(projectId: string, scheduleId: string) {
    const res = await apiFetch(ENDPOINTS.PROJECT_SCHEDULE(projectId, scheduleId), {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete schedule');
  },

  async runScheduleNow(projectId: string, scheduleId: string) {
    const res = await apiFetch(ENDPOINTS.PROJECT_SCHEDULE_RUN(projectId, scheduleId), {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Failed to trigger run');
    }
    return res.json();
  },
};
