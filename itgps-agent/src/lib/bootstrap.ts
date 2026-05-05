import * as path from 'path';
import { BootstrapResult, StudioClient, Project, Environment, Dataset } from '../types';
import { readCache, writeCache } from './cache-store';
import { readLocalEnv, writeLocalEnv } from './env-store';
import { mergeVariables } from './merge-vars';
import { NetworkError, TimeoutError } from './studio-client';

interface BootstrapOpts {
  studioClient: StudioClient;
  projectId: string;
  envId?: string;
  datasetId?: string;
  cwd?: string; // for testability
}

/**
 * Maps a ProjectConfig to a flat Record<string, string> of env var names.
 * Keys match the env vars consumed by the bundled playwright.config.cjs.
 */
function projectConfigToEnvVars(config: Project['config']): Record<string, string> {
  return {
    BROWSER: String(config.browser),
    HEADED: String(config.headless === 0 ? 'true' : 'false'),
    WORKERS: String(config.workers),
    TIMEOUT: String(config.timeout),
    BASE_URL: String(config.baseUrl),
    VIDEO: String(config.video),
    SCREENSHOT: String(config.screenshot),
  };
}

/**
 * Safely parses a JSON string of key-value pairs.
 * Returns an empty object on any parse error or if the value is falsy.
 */
function parseVariables(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Coerce all values to strings
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = String(v);
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Central bootstrap orchestrator.
 *
 * 7-step sequence:
 * 1. Fetch projects (or fall back to cache on NetworkError/TimeoutError)
 * 2. Fetch environments (or fall back to cache)
 * 3. Fetch datasets (or fall back to cache)
 * 4. Resolve envId / datasetId from local .env if not provided in opts
 * 5. Merge variables from all four layers
 * 6. Write merged vars to .env
 * 7. Assign merged vars onto process.env
 */
export async function bootstrap(opts: BootstrapOpts): Promise<BootstrapResult> {
  const { studioClient, projectId, cwd } = opts;
  const envPath = cwd ? path.join(cwd, '.env') : undefined;

  let fromCache = false;
  let cacheTimestamp: string | undefined;

  // ── Step 1: Fetch projects ──────────────────────────────────────────────────
  let projects: Project[];
  try {
    projects = await studioClient.getProjects();
    await writeCache<Project[]>('project', projects, cwd);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof TimeoutError) {
      const cached = await readCache<Project[]>('project', cwd);
      if (cached === null) {
        throw new Error(
          "No cached Studio data. Run 'itgps-agent config' while connected."
        );
      }
      console.warn(
        `[offline] Using cached project data from ${cached.cachedAt}`
      );
      projects = cached.data;
      fromCache = true;
      cacheTimestamp = cached.cachedAt;
    } else {
      throw err;
    }
  }

  // ── Step 2: Fetch environments ──────────────────────────────────────────────
  let environments: Environment[];
  try {
    environments = await studioClient.getEnvironments(projectId);
    await writeCache<Environment[]>('environments', environments, cwd);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof TimeoutError) {
      const cached = await readCache<Environment[]>('environments', cwd);
      if (cached === null) {
        throw new Error(
          "No cached Studio data. Run 'itgps-agent config' while connected."
        );
      }
      console.warn(
        `[offline] Using cached environment data from ${cached.cachedAt}`
      );
      environments = cached.data;
      fromCache = true;
      if (!cacheTimestamp) cacheTimestamp = cached.cachedAt;
    } else {
      throw err;
    }
  }

  // ── Step 3: Fetch datasets ──────────────────────────────────────────────────
  let datasets: Dataset[];
  try {
    datasets = await studioClient.getDatasets(projectId);
    await writeCache<Dataset[]>('datasets', datasets, cwd);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof TimeoutError) {
      const cached = await readCache<Dataset[]>('datasets', cwd);
      if (cached === null) {
        throw new Error(
          "No cached Studio data. Run 'itgps-agent config' while connected."
        );
      }
      console.warn(
        `[offline] Using cached dataset data from ${cached.cachedAt}`
      );
      datasets = cached.data;
      fromCache = true;
      if (!cacheTimestamp) cacheTimestamp = cached.cachedAt;
    } else {
      throw err;
    }
  }

  // ── Step 4: Resolve envId / datasetId ──────────────────────────────────────
  let resolvedEnvId = opts.envId;
  let resolvedDatasetId = opts.datasetId;

  if (!resolvedEnvId || !resolvedDatasetId) {
    const localEnv = readLocalEnv(envPath);
    if (!resolvedEnvId) resolvedEnvId = localEnv['ITGPS_ENV_ID'];
    if (!resolvedDatasetId) resolvedDatasetId = localEnv['ITGPS_DATASET_ID'];
  }

  // ── Step 5: Merge variables ─────────────────────────────────────────────────
  // Find the selected project
  const selectedProject = projects.find((p) => p.id === projectId);
  const projectConfig = selectedProject?.config ?? {
    browser: 'chromium',
    headless: 1,
    workers: 1,
    timeout: 30000,
    baseUrl: '',
    video: 'off',
    screenshot: 'off',
    browsers: '[]',
    extraArgs: '[]',
  };

  const projectDefaults = projectConfigToEnvVars(projectConfig);

  // Find selected environment and dataset
  const selectedEnv = environments.find((e) => e.id === resolvedEnvId);
  const selectedDataset = datasets.find((d) => d.id === resolvedDatasetId);

  const envVars = parseVariables(selectedEnv?.variables);
  const datasetVars = parseVariables(selectedDataset?.variables);
  const localEnvVars = readLocalEnv(envPath);

  const mergedVars = mergeVariables({
    projectDefaults,
    envVars,
    datasetVars,
    localEnvVars,
  });

  // Always set TEST_PROJECT_DIR
  mergedVars['TEST_PROJECT_DIR'] = cwd ?? process.cwd();

  // ── Step 6: Write merged vars to .env ───────────────────────────────────────
  writeLocalEnv(mergedVars, envPath);

  // ── Step 7: Assign merged vars onto process.env ─────────────────────────────
  for (const [key, value] of Object.entries(mergedVars)) {
    process.env[key] = value;
  }

  return {
    mergedVars,
    projectConfig,
    fromCache,
    cacheTimestamp,
  };
}
