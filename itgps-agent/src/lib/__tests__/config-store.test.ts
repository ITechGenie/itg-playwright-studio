import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it } from 'vitest';
import { readGlobalConfig, writeGlobalConfig } from '../config-store';

/**
 * Property 1: Global Config Round-Trip
 * For any valid GlobalConfig, writeGlobalConfig then readGlobalConfig SHALL return a deeply equal object.
 * Validates: Requirements 2.4, 12.1
 */
describe('config-store', () => {
  it('Property 1: Global Config Round-Trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          studioUrl: fc.webUrl(),
          token: fc.string({ minLength: 10 }),
        }),
        async (config) => {
          const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'itgps-test-'));
          try {
            await writeGlobalConfig(config, tmpDir);
            const result = await readGlobalConfig(tmpDir);
            return (
              result !== null &&
              result.studioUrl === config.studioUrl &&
              result.token === config.token
            );
          } finally {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Global Config Write Idempotence
   * Writing the same GlobalConfig twice SHALL produce a file identical to writing it once.
   * Validates: Requirement 12.4
   */
  it('Property 7: Global Config Write Idempotence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          studioUrl: fc.webUrl(),
          token: fc.string({ minLength: 10 }),
        }),
        async (config) => {
          const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'itgps-test-'));
          try {
            // Write once and capture file content
            await writeGlobalConfig(config, tmpDir);
            const contentAfterFirstWrite = await fs.promises.readFile(
              path.join(tmpDir, 'config.json'),
              'utf8'
            );

            // Write again with the same input and capture file content
            await writeGlobalConfig(config, tmpDir);
            const contentAfterSecondWrite = await fs.promises.readFile(
              path.join(tmpDir, 'config.json'),
              'utf8'
            );

            return contentAfterFirstWrite === contentAfterSecondWrite;
          } finally {
            await fs.promises.rm(tmpDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
