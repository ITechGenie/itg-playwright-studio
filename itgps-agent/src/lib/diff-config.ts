import { ProjectConfig, ConfigField } from '../types';

/**
 * Maps each ProjectConfig field to its corresponding env var name.
 * Note: headless maps to HEADED (inverted: headless=0 means headed=true).
 */
const FIELD_TO_ENV_VAR: Record<keyof Pick<ProjectConfig, 'browser' | 'headless' | 'workers' | 'timeout' | 'baseUrl' | 'video' | 'screenshot'>, string> = {
  browser: 'BROWSER',
  headless: 'HEADED',
  workers: 'WORKERS',
  timeout: 'TIMEOUT',
  baseUrl: 'BASE_URL',
  video: 'VIDEO',
  screenshot: 'SCREENSHOT',
};

/**
 * Computes the diff between Studio project config defaults and local env overrides.
 *
 * For each tracked ProjectConfig field, produces a ConfigField describing:
 * - The env var name
 * - The studio default value
 * - The local override value (undefined if not set)
 * - The effective value (local if overridden, else studio default)
 * - Whether the field is overridden
 *
 * Pure function — no side effects.
 */
export function computeConfigDiff(
  studioConfig: ProjectConfig,
  localEnv: Record<string, string>
): ConfigField[] {
  return (Object.entries(FIELD_TO_ENV_VAR) as [keyof typeof FIELD_TO_ENV_VAR, string][]).map(
    ([field, envVarName]) => {
      const studioDefault = studioConfig[field];
      const localValue = localEnv[envVarName];
      const overridden =
        localValue !== undefined && String(localValue) !== String(studioDefault);
      const effectiveValue = overridden ? localValue : studioDefault;

      return {
        name: envVarName,
        studioDefault,
        localValue,
        effectiveValue,
        overridden,
      };
    }
  );
}
