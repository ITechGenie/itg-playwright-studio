import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mergeVariables } from '../merge-vars';

/**
 * Property 4: Variable Merge Precedence
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4
 *
 * For any combination of four input maps:
 * - dataset keys always win over env/project (and over localEnvVars)
 * - local .env keys win over env/project but NOT over dataset
 */
describe('mergeVariables', () => {
  it('Property 4: dataset keys always win; local keys win only when not in dataset', () => {
    // Exclude '__proto__' as it is not a valid variable name and causes issues with Object.assign
    const safeKey = fc.string().filter((k) => k !== '__proto__');
    const safeDict = fc.dictionary(safeKey, fc.string());

    fc.assert(
      fc.property(
        safeDict,
        safeDict,
        safeDict,
        safeDict,
        (projectDefaults, envVars, datasetVars, localEnvVars) => {
          const merged = mergeVariables({ projectDefaults, envVars, datasetVars, localEnvVars });

          // datasetVars keys always win (over everything including localEnvVars)
          const datasetKeysWin = Object.entries(datasetVars).every(
            ([k, v]) => merged[k] === v
          );

          // localEnvVars keys win over envVars and projectDefaults,
          // but NOT over datasetVars
          const localKeysWin = Object.entries(localEnvVars)
            .filter(([k]) => !(k in datasetVars))
            .every(([k, v]) => merged[k] === v);

          return datasetKeysWin && localKeysWin;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty object when all inputs are empty', () => {
    const result = mergeVariables({
      projectDefaults: {},
      envVars: {},
      datasetVars: {},
      localEnvVars: {},
    });
    expect(result).toEqual({});
  });

  it('projectDefaults are overridden by envVars', () => {
    const result = mergeVariables({
      projectDefaults: { KEY: 'project' },
      envVars: { KEY: 'env' },
      datasetVars: {},
      localEnvVars: {},
    });
    expect(result.KEY).toBe('env');
  });

  it('envVars are overridden by datasetVars', () => {
    const result = mergeVariables({
      projectDefaults: {},
      envVars: { KEY: 'env' },
      datasetVars: { KEY: 'dataset' },
      localEnvVars: {},
    });
    expect(result.KEY).toBe('dataset');
  });

  it('datasetVars win over localEnvVars', () => {
    const result = mergeVariables({
      projectDefaults: {},
      envVars: {},
      datasetVars: { KEY: 'dataset' },
      localEnvVars: { KEY: 'local' },
    });
    expect(result.KEY).toBe('dataset');
  });

  it('localEnvVars win over envVars when key not in datasetVars', () => {
    const result = mergeVariables({
      projectDefaults: {},
      envVars: { KEY: 'env' },
      datasetVars: {},
      localEnvVars: { KEY: 'local' },
    });
    expect(result.KEY).toBe('local');
  });

  it('all four layers contribute unique keys', () => {
    const result = mergeVariables({
      projectDefaults: { A: 'project' },
      envVars: { B: 'env' },
      datasetVars: { C: 'dataset' },
      localEnvVars: { D: 'local' },
    });
    expect(result).toEqual({ A: 'project', B: 'env', C: 'dataset', D: 'local' });
  });
});
