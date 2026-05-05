import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it } from 'vitest';
import { readCache, writeCache } from '../cache-store';

/**
 * Property 9: Cache Round-Trip
 * For any valid cache payload, writeCache then readCache SHALL return a deeply equal object.
 * Validates: Requirement 4.6
 */
describe('cache-store', () => {
  const cacheKeys = ['project', 'environments', 'datasets'] as const;

  for (const key of cacheKeys) {
    it(`Property 9: Cache Round-Trip — key="${key}"`, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.object(),
          async (data) => {
            const tmpDir = await fs.promises.mkdtemp(
              path.join(os.tmpdir(), 'itgps-cache-test-')
            );
            try {
              await writeCache(key, data, tmpDir);
              const result = await readCache(key, tmpDir);

              if (result === null) return false;

              // Deep equality check on the data field
              return JSON.stringify(result.data) === JSON.stringify(data);
            } finally {
              await fs.promises.rm(tmpDir, { recursive: true, force: true });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  }

  it('readCache returns null when file does not exist', async () => {
    const tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'itgps-cache-test-')
    );
    try {
      const result = await readCache('project', tmpDir);
      // No file written — should return null
      return result === null;
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
