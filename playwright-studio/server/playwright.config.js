// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

/**
 * Centralized Playwright configuration for all test projects.
 * 
 * This config runs from the server directory.
 * Test directory is set via TEST_PROJECT_DIR environment variable.
 * 
 * Environment variables injected per run:
 * - TEST_PROJECT_DIR: Absolute path to the test directory
 * - REPORT_DIR: Where to store HTML reports
 * - RESULTS_DIR: Where to store test-results (screenshots, videos, traces)
 * - HEADED: Whether to run in headed mode
 * - TEST_ENV: Environment identifier
 * - BROWSER: Browser to use (chromium, firefox, webkit, edge, chrome)
 * - WIDTH: Viewport width
 * - HEIGHT: Viewport height
 * - BASE_URL: Base URL for tests
 * - VIDEO: Video recording mode (off, on, retain-on-failure, on-first-retry)
 * - SCREENSHOT: Screenshot mode (off, on, only-on-failure)
 */

// Parse browser from environment (default: chromium)
const browser = process.env.BROWSER || 'chromium';
const width = parseInt(process.env.WIDTH || '1280');
const height = parseInt(process.env.HEIGHT || '720');
const video = process.env.VIDEO || 'retain-on-failure';
const screenshot = process.env.SCREENSHOT || 'only-on-failure';

/**
 * Per-run output dirs injected by dashboard server; fall back to defaults locally
 */
const reportDir = process.env.REPORT_DIR || path.join(__dirname, 'playwright-report');
const resultsDir = process.env.RESULTS_DIR || path.join(__dirname, 'test-results');

const htmlReportDir = process.env.REPORT_DIR 
  ? path.join(process.env.REPORT_DIR, 'html') 
  : path.join(__dirname, 'html-report');

const monocartReportDir = process.env.REPORT_DIR 
  ? path.join(process.env.REPORT_DIR, 'monocart') 
  : path.join(__dirname, 'monocart-report');

// Map browser names to device configs
const browserConfigs = {
  'chromium': devices['Desktop Chrome'],
  'chrome': devices['Desktop Chrome'],
  'firefox': devices['Desktop Firefox'],
  'webkit': devices['Desktop Safari'],
  'edge': devices['Desktop Edge'],
};

// Get browser config with fallback
/**
 * @param {string} browserName
 */
const getBrowserConfig = (browserName) => {
  const validBrowsers = ['chromium', 'chrome', 'firefox', 'webkit', 'edge'];
  /** @type {keyof typeof browserConfigs} */
  const safeBrowser = /** @type {any} */ (validBrowsers.includes(browserName) ? browserName : 'chromium');
  return browserConfigs[safeBrowser];
};

module.exports = defineConfig({
  // Test directory set via environment variable (absolute path)
  testDir: process.env.TEST_PROJECT_DIR || './',
  
  // Test file patterns
  testMatch: [
    '**/*.spec.ts',
    '**/*.spec.js', 
    '**/*.test.ts',
    '**/*.test.js',
  ],
  
  // Timeout per test
  timeout: parseInt(process.env.TIMEOUT || '30000'),
  
  // Expect timeout
  expect: {
    timeout: 5000,
  },
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Workers controlled via CLI args
  workers: undefined,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { 
      outputFolder: htmlReportDir,
      open: 'never' 
    }],
    ['monocart-reporter', {
      name: 'Playwright Studio Report',
      outputFile: path.join(monocartReportDir, 'index.html'),
      tags: {
        smoke: { style: { background: '#6366f1' } },
        regression: { style: { background: '#059669' } },
      },
      /** @param {any[]} defaultColumns */
      columns: (defaultColumns) => {
        const durationColumn = defaultColumns.find((c) => c.id === 'duration');
        if (durationColumn) {
          durationColumn.formatter = 'duration';
        }
      },
      groupBy: ['project'],
    }],
    ['json', { 
      outputFile: path.join(reportDir, 'results.json')
    }],
  ],
  
  // Shared settings for all projects
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: /** @type {any} */ (screenshot),
    video: /** @type {any} */ (video),
    // Dynamic viewport from environment
    viewport: { width, height },
  },
  
  // Output directory for test artifacts
  outputDir: resultsDir,
  
  // Dynamic browser configuration based on environment variable
  projects: [
    {
      name: browser,
      use: { 
        ...getBrowserConfig(browser),
        // Override viewport with custom dimensions
        viewport: { width, height },
      },
    },
  ],
});
