import { MergeInput } from '../types';

/**
 * Merges four layers of variables with the following precedence (lowest → highest):
 *   projectDefaults < envVars < datasetVars < localEnvVars
 *
 * Note: datasetVars takes precedence over localEnvVars — dataset keys always win.
 * Precedence order passed to Object.assign:
 *   projectDefaults ← envVars ← datasetVars ← localEnvVars
 * But since datasetVars must beat localEnvVars, the actual order is:
 *   projectDefaults ← envVars ← localEnvVars ← datasetVars
 */
export function mergeVariables(input: MergeInput): Record<string, string> {
  const { projectDefaults, envVars, datasetVars, localEnvVars } = input;
  // Precedence (lowest to highest): projectDefaults < envVars < localEnvVars < datasetVars
  // datasetVars wins over everything including localEnvVars
  return Object.assign({}, projectDefaults, envVars, localEnvVars, datasetVars);
}
