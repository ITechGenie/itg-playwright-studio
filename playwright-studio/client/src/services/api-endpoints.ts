export const APIS_BASE = '/apis';

export const ENDPOINTS = {
  // Auth/Public Project Routes
  PROJECTS: `${APIS_BASE}/auth/projects`,
  
  // Admin Routes
  SYNC: `${APIS_BASE}/admin/projects/sync`,

  // Project Specific Routes (Standard Pattern)
  PROJECT_FILES: (projectId: string) => `${APIS_BASE}/project/${projectId}/files`,
  PROJECT_RUN: (projectId: string) => `${APIS_BASE}/project/${projectId}/run`,
  PROJECT_RUNS: (projectId: string) => `${APIS_BASE}/project/${projectId}/runs`,
  RUN_DETAILS: (projectId: string, runId: string) => `${APIS_BASE}/project/${projectId}/run/${runId}`,
  PROJECT_CONFIG: (projectId: string) => `${APIS_BASE}/project/${projectId}/config`,
  
  // Data Manager Routes
  DATA_TEMPLATES: (projectId: string) => `${APIS_BASE}/project/${projectId}/data/templates`,
  DATA_ENVIRONMENTS: (projectId: string) => `${APIS_BASE}/project/${projectId}/data/environments`,
  DATA_DATASETS: (projectId: string, envId: string) => `${APIS_BASE}/project/${projectId}/data/environments/${envId}/datasets`,

  // Scheduler Routes
  PROJECT_SCHEDULES: (projectId: string) => `${APIS_BASE}/project/${projectId}/schedules`,
  PROJECT_SCHEDULE: (projectId: string, scheduleId: string) => `${APIS_BASE}/project/${projectId}/schedules/${scheduleId}`,
  PROJECT_SCHEDULE_RUN: (projectId: string, scheduleId: string) => `${APIS_BASE}/project/${projectId}/schedules/${scheduleId}/run`,
  
  // Auth Routes
  AUTH_ME: `${APIS_BASE}/auth/me`,
  AUTH_LOGOUT: `${APIS_BASE}/auth/logout`,
  AUTH_CONFIG: `${APIS_BASE}/auth/config`,
  AUTH_LOGIN: (provider: string) => `${APIS_BASE}/auth/login/${provider}`,
  AUTH_PATS: `${APIS_BASE}/auth/pats`,

  // Static Reports
  REPORTS: `${APIS_BASE}/reports`,
};

export const WS_ENDPOINT = '/ws';
