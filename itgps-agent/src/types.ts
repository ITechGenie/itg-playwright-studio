/**
 * Shared TypeScript interfaces for itgps-agent.
 */

/** Global config stored in ~/.itgps/config.json */
export interface GlobalConfig {
  studioUrl: string;
  token: string;
}

/** Wrapper for cached Studio data with a timestamp */
export interface CacheEntry<T> {
  data: T;
  cachedAt: string; // ISO 8601
}

/** A Studio project */
export interface Project {
  id: string;
  name: string;
  config: ProjectConfig;
}

/** Playwright run configuration associated with a Studio project */
export interface ProjectConfig {
  browser: string;
  headless: number; // 0 | 1
  workers: number;
  timeout: number;
  baseUrl: string;
  video: string;
  screenshot: string;
  browsers: string; // JSON array of browser names
  extraArgs: string; // JSON array of { flag, value }
  viewportWidth?: number;
  viewportHeight?: number;
}

/** A named set of environment variables scoped to a project */
export interface Environment {
  id: string;
  name: string;
  variables: string; // JSON string of key-value pairs
}

/** A named set of data variables scoped to a project */
export interface Dataset {
  id: string;
  name: string;
  variables: string; // JSON string of key-value pairs
}

/** Authenticated user information returned by GET /apis/auth/me */
export interface UserInfo {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  globalRole: string;
}

/** Result returned when a Studio run is triggered */
export interface RunResult {
  runId: string;
  status: string;
  command: string;
}

/** Current status of a Studio run */
export interface RunStatus {
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  exitCode?: number;
  duration?: number;
}

/** Metadata posted to Studio after a local agent run completes */
export interface LocalRunMeta {
  triggeredBy: 'local-agent';
  status: 'completed' | 'failed';
  exitCode: number;
  duration: number;
  envId?: string;
  datasetId?: string;
  passed: number;
  failed: number;
  skipped: number;
}

/** A WebSocket event emitted by the Studio during a remote run */
export interface RunEvent {
  type: 'run:start' | 'run:stdout' | 'run:stderr' | 'run:done' | 'run:error';
  runId: string;
  data?: string;
  exitCode?: number;
}

/** Input to the variable merge function */
export interface MergeInput {
  projectDefaults: Record<string, string>;
  envVars: Record<string, string>;
  datasetVars: Record<string, string>;
  localEnvVars: Record<string, string>;
}

/** Result returned by the bootstrap orchestrator */
export interface BootstrapResult {
  mergedVars: Record<string, string>;
  projectConfig: ProjectConfig;
  fromCache: boolean;
  cacheTimestamp?: string;
}

/** A single field in the config diff shown before writing */
export interface ConfigField {
  name: string;
  studioDefault: string | number | boolean;
  localValue: string | undefined;
  effectiveValue: string | number | boolean;
  overridden: boolean;
}

/** Payload sent to POST /apis/project/:projectId/run */
export interface RunPayload {
  envId: string;
  dataSetIds: string[];
}

/** Interface for the Studio HTTP client */
export interface StudioClient {
  getMe(): Promise<UserInfo>;
  getProjects(): Promise<Project[]>;
  getEnvironments(projectId: string): Promise<Environment[]>;
  getEnvironmentDetail(projectId: string, environmentId: string): Promise<Environment>;
  getDatasets(projectId: string): Promise<Dataset[]>;
  getDatasetDetail(projectId: string, datasetId: string): Promise<Dataset>;
  triggerRun(projectId: string, payload: RunPayload): Promise<RunResult>;
  getRunStatus(projectId: string, runId: string): Promise<RunStatus>;
  reportLocalRun(projectId: string, meta: LocalRunMeta): Promise<void>;
  triggerGitSync(projectId: string): Promise<void>;
}
