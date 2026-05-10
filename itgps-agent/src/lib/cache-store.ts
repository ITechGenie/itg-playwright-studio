import * as fs from 'fs';
import * as path from 'path';
import { CacheEntry } from '../types';

const CACHE_DIR = '.itgps/cache';

/**
 * Returns the path to the cache file for the given key.
 * Cache location: <cwd>/.itgps/cache/<key>.json
 */
function getCachePath(key: 'project' | 'environments' | 'datasets', cwd?: string): string {
  const base = cwd ?? process.cwd();
  return path.join(base, CACHE_DIR, `${key}.json`);
}

/**
 * Reads the cache entry for the given key from <cwd>/.itgps/cache/<key>.json.
 * Returns null if the file does not exist.
 */
export async function readCache<T>(
  key: 'project' | 'environments' | 'datasets',
  cwd?: string
): Promise<CacheEntry<T> | null> {
  const filePath = getCachePath(key, cwd);

  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw) as CacheEntry<T>;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Writes a cache entry for the given key to <cwd>/.itgps/cache/<key>.json.
 * Creates the .itgps/cache/ directory if it does not exist.
 * Writes { data, cachedAt: new Date().toISOString() } as pretty-printed JSON.
 */
export async function writeCache<T>(
  key: 'project' | 'environments' | 'datasets',
  data: T,
  cwd?: string
): Promise<void> {
  const filePath = getCachePath(key, cwd);
  const dir = path.dirname(filePath);

  const entry: CacheEntry<T> = {
    data,
    cachedAt: new Date().toISOString(),
  };

  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
