import {
  UserInfo,
  Project,
  Environment,
  Dataset,
  RunResult,
  RunStatus,
  LocalRunMeta,
  RunPayload,
  StudioClient,
} from '../types';

/**
 * Thrown when the Studio API returns HTTP 401 or 403.
 * The token value is never included in the message.
 */
export class AuthError extends Error {
  statusCode: 401 | 403;

  constructor(statusCode: 401 | 403, message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Thrown when a Studio API request exceeds the 10-second timeout.
 */
export class TimeoutError extends Error {
  endpoint: string;

  constructor(endpoint: string) {
    super(`Request to ${endpoint} timed out after 10 seconds`);
    this.name = 'TimeoutError';
    this.endpoint = endpoint;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Thrown when fetch() itself rejects (DNS failure, connection refused, etc.).
 */
export class NetworkError extends Error {
  cause: Error;

  constructor(cause: Error) {
    super(`Network error: ${cause.message}`);
    this.name = 'NetworkError';
    this.cause = cause;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Performs a single HTTP request with a 10-second AbortController timeout.
 * Throws AuthError, TimeoutError, or NetworkError as appropriate.
 * Never includes the token value in any error message.
 */
async function request<T>(
  fetchImpl: typeof fetch,
  url: string,
  options: RequestInit,
  endpoint: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    clearTimeout(timer);
    // AbortController fires a DOMException with name 'AbortError'
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError(endpoint);
    }
    throw new NetworkError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    const statusCode = response.status as 401 | 403;
    const message =
      statusCode === 401
        ? `Authentication failed: token is invalid or expired (${endpoint})`
        : `Authorization failed: insufficient permissions (${endpoint})`;
    throw new AuthError(statusCode, message);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${endpoint}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Creates a Studio HTTP client that communicates with the given Studio URL
 * using the provided PAT token.
 *
 * @param studioUrl - Base URL of the Studio server (e.g. "https://studio.example.com")
 * @param token     - Personal Access Token (PAT) — never logged or included in errors
 * @param fetchImpl - Optional fetch implementation for testability; defaults to global fetch
 */
export function createStudioClient(
  studioUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): StudioClient {
  const base = studioUrl.replace(/\/$/, '');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  function get<T>(path: string): Promise<T> {
    return request<T>(fetchImpl, `${base}${path}`, { method: 'GET', headers }, path);
  }

  function post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(
      fetchImpl,
      `${base}${path}`,
      {
        method: 'POST',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      path
    );
  }

  return {
    getMe(): Promise<UserInfo> {
      return get<UserInfo>('/apis/auth/me');
    },

    getProjects(): Promise<Project[]> {
      return get<Project[]>('/apis/auth/projects');
    },

    getEnvironments(projectId: string): Promise<Environment[]> {
      return get<Environment[]>(`/apis/project/${projectId}/data/environments`);
    },

    getEnvironmentDetail(projectId: string, environmentId: string): Promise<Environment> {
      return get<Environment>(`/apis/project/${projectId}/data/environments/${environmentId}`);
    },

    getDatasets(projectId: string): Promise<Dataset[]> {
      return get<Dataset[]>(`/apis/project/${projectId}/data/datasets`);
    },

    getDatasetDetail(projectId: string, datasetId: string): Promise<Dataset> {
      return get<Dataset>(`/apis/project/${projectId}/data/datasets/${datasetId}`);
    },

    triggerRun(projectId: string, payload: RunPayload): Promise<RunResult> {
      return post<RunResult>(`/apis/project/${projectId}/run`, payload);
    },

    getRunStatus(projectId: string, runId: string): Promise<RunStatus> {
      return get<RunStatus>(`/apis/project/${projectId}/run/${runId}`);
    },

    async reportLocalRun(projectId: string, meta: LocalRunMeta): Promise<void> {
      await post<unknown>(`/apis/project/${projectId}/local-run`, meta);
    },

    async triggerGitSync(projectId: string): Promise<void> {
      await post<unknown>(`/apis/project/${projectId}/git-sync`);
    },
  };
}
