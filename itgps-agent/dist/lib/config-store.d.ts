import { GlobalConfig } from '../types';
/**
 * Reads the global config from <configDir>/config.json.
 * Returns null if the file does not exist.
 */
export declare function readGlobalConfig(configDir?: string): Promise<GlobalConfig | null>;
/**
 * Writes the global config to <configDir>/config.json.
 * Creates the directory if it does not exist.
 * Sets file permissions to 0600 (owner read/write only).
 */
export declare function writeGlobalConfig(config: GlobalConfig, configDir?: string): Promise<void>;
//# sourceMappingURL=config-store.d.ts.map