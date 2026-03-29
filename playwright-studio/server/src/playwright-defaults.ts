/**
 * Default Playwright CLI execution options.
 * These are merged with any request-level overrides before spawning the CLI.
 * Edit this file to change the studio-wide defaults.
 */
export interface PlaywrightRunOptions {
  /** Path to file or folder to test (relative to project root). Empty = run all. */
  path?: string;
  /** Run browser in headless mode */
  headless: boolean;
  /** Number of parallel workers */
  workers: number;
  /** Output reporter: list | line | dot | html | json */
  reporter: string;
  /** Per-test timeout in milliseconds */
  timeout: number;
  /** Retry count on failure */
  retries: number;
  /**
   * Browser project to run (must match a project name in playwright.config.ts).
   * Empty string means run all configured projects.
   */
  project: string;
  /** Regex to filter test titles via --grep */
  grep?: string;
  /** Regex to invert-filter test titles via --grep-invert */
  grepInvert?: string;
}

export const PLAYWRIGHT_DEFAULTS: PlaywrightRunOptions = {
  path: '',
  headless: true,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  retries: 0,
  project: '',
  grep: '',
  grepInvert: '',
};
