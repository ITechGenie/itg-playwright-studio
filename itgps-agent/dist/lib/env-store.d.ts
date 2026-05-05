/**
 * Reads the .env file at envPath (or cwd/.env).
 * Parses with dotenv.parse and returns the key-value map.
 * Returns an empty map if the file does not exist.
 */
export declare function readLocalEnv(envPath?: string): Record<string, string>;
/**
 * Writes managed key-value pairs to the .env file at envPath (or cwd/.env).
 *
 * Write algorithm:
 * 1. Parse existing .env with dotenv.parse (empty map if absent).
 * 2. Separate into user-owned (not in managed key set) and agent-owned.
 * 3. Merge: user-owned first, then managed.
 * 4. Serialize to KEY=VALUE\n format (quoting values that need it).
 * 5. Write atomically via temp file + fs.renameSync.
 */
export declare function writeLocalEnv(managed: Record<string, string>, envPath?: string): void;
//# sourceMappingURL=env-store.d.ts.map