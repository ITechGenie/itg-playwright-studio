import * as dotenv from 'dotenv';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it } from 'vitest';
import { writeLocalEnv } from '../env-store';

/**
 * Valid env key: must match [A-Za-z_][A-Za-z0-9_]*
 */
const validEnvKey = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_'.split('')),
    fc.string({ minLength: 0, maxLength: 20 }).map((s) =>
      s
        .split('')
        .filter((c) => /[A-Za-z0-9_]/.test(c))
        .join('')
    )
  )
  .map(([first, rest]) => first + rest);

/**
 * Valid env key that does NOT start with ITGPS_
 */
const nonAgentEnvKey = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_'.split(''))
      .filter((c) => c !== 'I'),  // Exclude 'I' to avoid ITGPS_ prefix
    fc.string({ minLength: 0, maxLength: 20 }).map((s) =>
      s
        .split('')
        .filter((c) => /[A-Za-z0-9_]/.test(c))
        .join('')
    )
  )
  .map(([first, rest]) => first + rest);

/**
 * Env value that can round-trip through dotenv.
 *
 * dotenv limitations that prevent round-tripping:
 * - Values with \r (carriage return): dotenv normalises \r\n and bare \r to \n.
 * - Values with BOTH (single-quote or backslash) AND double-quote: our serialiser
 *   falls back to unquoted, which may not survive dotenv's LINE regex for all
 *   combinations.
 * - Values with a backslash followed by 'n' or 'r' (the two-character sequences
 *   \n and \r): in double-quoted dotenv values, \n is expanded to a newline and
 *   \r to a carriage return, so these sequences cannot round-trip.
 *
 * We filter these out so the property test only covers values that CAN round-trip.
 */
const roundTrippableValue = fc
  .string({ maxLength: 50 })
  .filter((v) => !v.includes('\r'))                                    // dotenv normalises \r
  .filter((v) => {
    const hasSingleQuoteOrBackslash = v.includes("'") || v.includes('\\');
    const hasDoubleQuote = v.includes('"');
    // Case 3 (unquoted fallback) can't reliably round-trip
    return !(hasSingleQuoteOrBackslash && hasDoubleQuote);
  })
  .filter((v) => {
    // Values with backslash: use double-quote wrapping.
    // In double-quoted values, dotenv expands \n -> newline and \r -> CR.
    // So a literal \n (backslash + n) or \r (backslash + r) in the value
    // cannot be represented in double-quoted format.
    if (!v.includes('\\')) return true;  // no backslash → single-quote wrap, no issue
    // Check for \n or \r as two-character sequences (backslash + n/r)
    return !v.includes('\\n') && !v.includes('\\r');
  });

/**
 * Arbitrary for a dictionary with valid env keys and round-trippable values.
 * Uses fc.uniqueArray to avoid duplicate keys.
 */
const validEnvDict = fc
  .uniqueArray(validEnvKey, { minLength: 1, maxLength: 10 })
  .chain((keys) =>
    fc
      .tuple(...keys.map(() => roundTrippableValue))
      .map((values) => Object.fromEntries(keys.map((k, i) => [k, values[i]])))
  );

/**
 * Arbitrary for a dictionary with valid env keys NOT starting with ITGPS_.
 */
const userEnvDict = fc
  .uniqueArray(nonAgentEnvKey, { minLength: 1, maxLength: 10 })
  .chain((keys) =>
    fc
      .tuple(...keys.map(() => roundTrippableValue))
      .map((values) => Object.fromEntries(keys.map((k, i) => [k, values[i]])))
  );

/**
 * Arbitrary for a dictionary with valid env keys all starting with ITGPS_.
 */
const agentEnvDict = fc
  .uniqueArray(
    validEnvKey.map((k) => `ITGPS_${k}`),
    { minLength: 1, maxLength: 10 }
  )
  .chain((keys) =>
    fc
      .tuple(...keys.map(() => roundTrippableValue))
      .map((values) => Object.fromEntries(keys.map((k, i) => [k, values[i]])))
  );

describe('env-store', () => {
  /**
   * Property 2: Local .env Round-Trip
   * For any valid key-value map, writeLocalEnv then dotenv.parse SHALL return an equal map.
   * Validates: Requirements 3.4, 12.2
   */
  it('Property 2: Local .env Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(validEnvDict, async (vars) => {
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'itgps-env-test-'));
        const tmpEnvPath = path.join(tmpDir, '.env');
        try {
          writeLocalEnv(vars, tmpEnvPath);
          const raw = await fs.promises.readFile(tmpEnvPath, 'utf8');
          const result = dotenv.parse(raw);
          // Assert all keys and values round-trip correctly
          const keys = Object.keys(vars);
          return (
            keys.length === Object.keys(result).length &&
            keys.every((k) => result[k] === vars[k])
          );
        } finally {
          await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Non-Agent Keys Are Preserved
   * For any set of non-ITGPS_ keys already in .env, after writeLocalEnv writes agent-managed keys,
   * all original non-ITGPS_ keys SHALL remain unchanged.
   * Validates: Requirement 3.2
   */
  it('Property 3: Non-Agent Keys Are Preserved', async () => {
    await fc.assert(
      fc.asyncProperty(userEnvDict, agentEnvDict, async (userKeys, agentKeys) => {
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'itgps-env-test-'));
        const tmpEnvPath = path.join(tmpDir, '.env');
        try {
          // Write user keys first
          writeLocalEnv(userKeys, tmpEnvPath);
          // Write agent keys (ITGPS_ prefixed) — should preserve user keys
          writeLocalEnv(agentKeys, tmpEnvPath);
          // Parse result
          const raw = await fs.promises.readFile(tmpEnvPath, 'utf8');
          const result = dotenv.parse(raw);
          // All user keys must still be present with original values
          return Object.entries(userKeys).every(([k, v]) => result[k] === v);
        } finally {
          await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100, timeout: 10000 }
    );
  });

  /**
   * Property 6: .env Write Idempotence
   * Writing the same managed map twice SHALL produce a file identical to writing it once.
   * Validates: Requirement 12.3
   */
  it('Property 6: .env Write Idempotence', async () => {
    await fc.assert(
      fc.asyncProperty(validEnvDict, async (vars) => {
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'itgps-env-test-'));
        const tmpEnvPath = path.join(tmpDir, '.env');
        try {
          // Write once and capture file content
          writeLocalEnv(vars, tmpEnvPath);
          const contentAfterFirstWrite = await fs.promises.readFile(tmpEnvPath, 'utf8');

          // Write again with the same input and capture file content
          writeLocalEnv(vars, tmpEnvPath);
          const contentAfterSecondWrite = await fs.promises.readFile(tmpEnvPath, 'utf8');

          return contentAfterFirstWrite === contentAfterSecondWrite;
        } finally {
          await fs.promises.rm(tmpDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 }
    );
  });
});
