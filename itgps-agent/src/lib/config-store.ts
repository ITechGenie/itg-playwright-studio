import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GlobalConfig } from '../types';

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.itgps');

/**
 * Reads the global config from <configDir>/config.json.
 * Returns null if the file does not exist.
 */
export async function readGlobalConfig(configDir?: string): Promise<GlobalConfig | null> {
  const dir = configDir ?? DEFAULT_CONFIG_DIR;
  const filePath = path.join(dir, 'config.json');

  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw) as GlobalConfig;
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Writes the global config to <configDir>/config.json.
 * Creates the directory if it does not exist.
 * Sets file permissions to 0600 (owner read/write only).
 */
export async function writeGlobalConfig(config: GlobalConfig, configDir?: string): Promise<void> {
  const dir = configDir ?? DEFAULT_CONFIG_DIR;
  const filePath = path.join(dir, 'config.json');

  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
  await fs.promises.chmod(filePath, 0o600);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
