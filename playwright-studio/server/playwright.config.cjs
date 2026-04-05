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

/**
 * Extracts PW_STUDIO_ARG_* environment variables and maps them to Playwright use options.
 */
/**
 * Extracts PW_STUDIO_ARG_* environment variables and maps them to Playwright use options.
 */
const getExtraUseOptions = () => {
  /** @type {any} */
  const options = {};

  if (process.env.PW_STUDIO_ARG_SAVE_HAR) {
    const val = process.env.PW_STUDIO_ARG_SAVE_HAR || 'true';
    options.har = {
      path: val === 'true' ? path.join(resultsDir, 'network.har') : val,
      urlFilter: process.env.PW_STUDIO_ARG_SAVE_HAR_GLOB || undefined,
      content: 'attach', // Attach actual content to HAR for better inspection
    };
  }

  if (process.env.PW_STUDIO_ARG_DEVICE) {
    const devName = process.env.PW_STUDIO_ARG_DEVICE;
    // Fuzzy matching for device names (e.g. "iphone" -> "iPhone 12")
    const match = Object.keys(devices).find(k => k.toLowerCase().includes(devName.toLowerCase()));
    if (match) {
      Object.assign(options, devices[match]);
    }
  }

  if (process.env.PW_STUDIO_ARG_VIEWPORT_SIZE) {
    const v = process.env.PW_STUDIO_ARG_VIEWPORT_SIZE;
    const [w, h] = v.split(/[,x]/).map(x => parseInt(x.trim()));
    if (!isNaN(w) && !isNaN(h)) options.viewport = { width: w, height: h };
  }

  if (process.env.PW_STUDIO_ARG_IS_MOBILE) {
    options.isMobile = process.env.PW_STUDIO_ARG_IS_MOBILE === 'true';
  }

  if (process.env.PW_STUDIO_ARG_HAS_TOUCH) {
    options.hasTouch = process.env.PW_STUDIO_ARG_HAS_TOUCH === 'true';
  }

  if (process.env.PW_STUDIO_ARG_IGNORE_HTTPS_ERRORS) {
    options.ignoreHTTPSErrors = process.env.PW_STUDIO_ARG_IGNORE_HTTPS_ERRORS === 'true';
  }

  if (process.env.PW_STUDIO_ARG_BLOCK_SERVICE_WORKERS) {
    options.serviceWorkers = process.env.PW_STUDIO_ARG_BLOCK_SERVICE_WORKERS === 'true' ? 'block' : 'allow';
  }

  if (process.env.PW_STUDIO_ARG_LOAD_STORAGE) {
    options.storageState = process.env.PW_STUDIO_ARG_LOAD_STORAGE;
  }

  if (process.env.PW_STUDIO_ARG_COLOR_SCHEME) {
    options.colorScheme = process.env.PW_STUDIO_ARG_COLOR_SCHEME;
  }

  if (process.env.PW_STUDIO_ARG_CHANNEL) {
    options.channel = process.env.PW_STUDIO_ARG_CHANNEL;
  }

  if (process.env.PW_STUDIO_ARG_USER_AGENT) {
    options.userAgent = process.env.PW_STUDIO_ARG_USER_AGENT;
  }

  if (process.env.PW_STUDIO_ARG_LANG) {
    options.locale = process.env.PW_STUDIO_ARG_LANG;
  }

  if (process.env.PW_STUDIO_ARG_TIMEZONE) {
    options.timezoneId = process.env.PW_STUDIO_ARG_TIMEZONE;
  }

  if (process.env.PW_STUDIO_ARG_GEOLOCATION) {
    try {
      options.geolocation = JSON.parse(process.env.PW_STUDIO_ARG_GEOLOCATION);
      options.permissions = [...(options.permissions || []), 'geolocation'];
    } catch {
      // ignore invalid json
    }
  }

  if (process.env.PW_STUDIO_ARG_PROXY_SERVER) {
    options.proxy = {
      server: process.env.PW_STUDIO_ARG_PROXY_SERVER,
      bypass: process.env.PW_STUDIO_ARG_PROXY_BYPASS || undefined
    };
  }

  return options;
};

// Log the extra options derived from Environment for debugging
const extraOptions = getExtraUseOptions();
if (Object.keys(extraOptions).length > 0) {
  console.log(`[Config] Running with extra options: ${JSON.stringify(Object.keys(extraOptions))}`);
}

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
      name: 'ITG Playwright Studio Report',
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
    ...getExtraUseOptions(),
  },

  // Output directory for test artifacts
  outputDir: resultsDir,

  // Define projects for all supported browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width, height },
        ...getExtraUseOptions(),
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width, height },
        // Only apply compatible extra options (omit chrome-only things like channel/har)
        ...(() => {
          const { channel, har, ...rest } = getExtraUseOptions();
          return rest;
        })()
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width, height },
        ...(() => {
          const { channel, har, ...rest } = getExtraUseOptions();
          return rest;
        })()
      },
    },
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width, height },
        ...getExtraUseOptions(),
      },
    },
    {
      name: 'msedge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width, height },
        ...getExtraUseOptions(),
      },
    },
  ],
});
