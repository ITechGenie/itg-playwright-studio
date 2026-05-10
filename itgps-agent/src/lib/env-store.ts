import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_ENV_PATH = path.join(process.cwd(), '.env');

/**
 * Reads the .env file at envPath (or cwd/.env).
 * Parses with dotenv.parse and returns the key-value map.
 * Returns an empty map if the file does not exist.
 */
export function readLocalEnv(envPath?: string): Record<string, string> {
  const filePath = envPath ?? DEFAULT_ENV_PATH;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return dotenv.parse(raw);
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

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
export function writeLocalEnv(managed: Record<string, string>, envPath?: string): void {
  const filePath = envPath ?? DEFAULT_ENV_PATH;

  // Step 1: Parse existing .env
  const existing = readLocalEnv(filePath);

  // Step 2: Separate user-owned keys (not in managed key set)
  const managedKeys = new Set(Object.keys(managed));
  const userOwned: Record<string, string> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!managedKeys.has(key)) {
      userOwned[key] = value;
    }
  }

  // Step 3: Merge — user-owned first, then managed
  const merged: Record<string, string> = { ...userOwned, ...managed };

  // Step 4: Serialize to KEY=VALUE\n format
  const content = serializeEnv(merged);

  // Step 5: Write atomically via temp file + rename
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.env.tmp.${process.pid}.${Date.now()}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file if rename failed
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Serializes a key-value map to .env format.
 *
 * Serialization strategy (based on dotenv v16 parsing behaviour):
 *
 * - Single-quote wrapping is used for values that do NOT contain a single-quote
 *   character. dotenv treats single-quoted values as completely literal — no escape
 *   processing whatsoever — so backslashes, double-quotes, $, #, spaces, and
 *   newlines all round-trip perfectly.
 *
 * - Double-quote wrapping is used for values that DO contain a single-quote.
 *   Inside double-quoted values dotenv only expands \n → newline and \r → CR;
 *   everything else (including backslashes and double-quotes) is passed through
 *   literally. Therefore we only need to escape literal newlines (\n → \\n) and
 *   carriage returns (\r → \\r). Double-quote characters in the value are left
 *   unescaped because dotenv's regex `"(?:\\"|[^"])*"` consumes `\"` as an
 *   escape sequence but does NOT unescape it — meaning `\"` in the file becomes
 *   `\"` (backslash + double-quote) in the parsed value, not just `"`. To avoid
 *   this ambiguity we only use double-quote wrapping when the value contains a
 *   single-quote but no double-quote. Values containing BOTH single-quotes and
 *   double-quotes are serialised with single-quote wrapping after replacing each
 *   embedded single-quote with a placeholder that survives the round-trip — but
 *   since dotenv has no escape mechanism for single-quotes inside single-quoted
 *   values, such values are stored unquoted (which works as long as they contain
 *   no whitespace or special shell characters that would confuse dotenv's LINE
 *   regex). In practice, env var values with both quote types are rare.
 *
 * Note: values containing carriage-return (\r) characters cannot round-trip
 * through dotenv because dotenv normalises \r\n and bare \r to \n before
 * parsing. Callers should avoid storing raw \r in managed env vars.
 */
function serializeEnv(vars: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    lines.push(`${key}=${serializeValue(value)}`);
  }
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

/**
 * Serializes a single value for .env format.
 *
 * Rules (see serializeEnv comment for full rationale):
 * 1. No single-quote and no backslash in value → single-quote wrap (fully literal).
 * 2. Single-quote present, or backslash present, but no double-quote → double-quote wrap,
 *    escaping \n and \r only (backslashes pass through literally in double-quoted values).
 * 3. Both quote types present (or backslash + double-quote) → unquoted best-effort.
 *
 * Note: values with a backslash cannot use single-quote wrapping because dotenv's
 * single-quoted regex treats \' as an escape sequence, which breaks parsing when
 * a backslash appears at the end of the value (before the closing quote).
 */
function serializeValue(value: string): string {
  const hasSingleQuote = value.includes("'");
  const hasDoubleQuote = value.includes('"');
  const hasBackslash = value.includes('\\');

  // Case 1: no single-quote and no backslash → single-quote wrap (truly literal).
  if (!hasSingleQuote && !hasBackslash) {
    return `'${value}'`;
  }

  // Case 2: has single-quote or backslash, but no double-quote → double-quote wrap.
  // In double-quoted values dotenv only expands \n → newline and \r → CR;
  // backslashes and single-quotes pass through literally.
  if (!hasDoubleQuote) {
    const escaped = value
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
    return `"${escaped}"`;
  }

  // Case 3: value contains both ' (or \) and " — store unquoted (best-effort).
  return value
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
