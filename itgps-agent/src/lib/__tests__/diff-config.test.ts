import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { computeConfigDiff } from '../diff-config';
import type { ProjectConfig } from '../../types';

/**
 * Arbitrary for a valid ProjectConfig (only the fields tracked by computeConfigDiff).
 */
const projectConfigArb = fc.record<ProjectConfig>({
  browser: fc.string({ minLength: 1, maxLength: 20 }),
  headless: fc.integer({ min: 0, max: 1 }) as fc.Arbitrary<0 | 1>,
  workers: fc.integer({ min: 1, max: 16 }),
  timeout: fc.integer({ min: 1000, max: 60000 }),
  baseUrl: fc.webUrl(),
  video: fc.constantFrom('on', 'off', 'retain-on-failure'),
  screenshot: fc.constantFrom('on', 'off', 'only-on-failure'),
  // Non-tracked fields — included to satisfy the full ProjectConfig shape
  browsers: fc.constant('["chromium"]'),
  extraArgs: fc.constant('[]'),
});

/**
 * Arbitrary for a local env map (string keys and values).
 * Keys are restricted to valid env var names to keep the test realistic.
 */
const localEnvArb = fc.dictionary(
  fc.constantFrom('BROWSER', 'HEADED', 'WORKERS', 'TIMEOUT', 'BASE_URL', 'VIDEO', 'SCREENSHOT', 'OTHER_KEY'),
  fc.string({ maxLength: 30 })
);

describe('computeConfigDiff', () => {
  /**
   * Property 5: Config Diff Is Deterministic
   * For any pair of (ProjectConfig, localEnv), calling computeConfigDiff twice
   * with the same inputs SHALL return identical output.
   * Validates: Requirements 5.9, 5.11
   */
  it('Property 5: Config Diff Is Deterministic', () => {
    fc.assert(
      fc.property(projectConfigArb, localEnvArb, (studioConfig, localEnv) => {
        const result1 = computeConfigDiff(studioConfig, localEnv);
        const result2 = computeConfigDiff(studioConfig, localEnv);
        return JSON.stringify(result1) === JSON.stringify(result2);
      }),
      { numRuns: 100 }
    );
  });
});
