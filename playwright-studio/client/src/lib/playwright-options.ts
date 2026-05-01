export interface PlaywrightCLIOption {
  flag: string;
  description: string;
  hasValue: boolean;
}

export const PLAYWRIGHT_CLI_OPTIONS: PlaywrightCLIOption[] = [
  { flag: "--trace", description: "Record trace for each test (on, off, retain-on-failure, on-first-retry)", hasValue: true },
  { flag: "--block-service-workers", description: "Block service workers", hasValue: false },
  { flag: "--channel", description: "Browser channel (chrome, chrome-beta, msedge-dev, etc.)", hasValue: true },
  { flag: "--color-scheme", description: "Emulate color scheme (light or dark)", hasValue: true },
  { flag: "--device", description: "Emulate device (e.g. iPhone 11)", hasValue: true },
  { flag: "--geolocation", description: "Geolocation coordinates (e.g. 37.8,-122.4)", hasValue: true },
  { flag: "--ignore-https-errors", description: "Ignore HTTPS errors", hasValue: false },
  { flag: "--lang", description: "Language/locale (e.g. en-GB)", hasValue: true },
  { flag: "--proxy-server", description: "Proxy server URL", hasValue: true },
  { flag: "--proxy-bypass", description: "Comma-separated domains to bypass proxy", hasValue: true },
  { flag: "--timezone", description: "Timezone to emulate (e.g. Europe/London)", hasValue: true },
  { flag: "--timeout", description: "Timeout for Playwright actions (ms)", hasValue: true },
  { flag: "--user-agent", description: "Custom user agent string", hasValue: true },
  { flag: "--user-data-dir", description: "Custom user data directory", hasValue: true },
  { flag: "--viewport-size", description: "Viewport size (e.g. 1280,720)", hasValue: true },
  { flag: "--save-har", description: "Save HAR file path", hasValue: true },
  { flag: "--save-har-glob", description: "Filter HAR entries by URL glob", hasValue: true },
  { flag: "--save-storage", description: "Save context storage state path", hasValue: true },
  { flag: "--load-storage", description: "Load context storage state from file", hasValue: true },
  { flag: "--is-mobile", description: "Emulate mobile browser (true/false)", hasValue: true },
  { flag: "--has-touch", description: "Emulate touch screen (true/false)", hasValue: true },
];

export const BROWSER_OPTIONS = [
  { value: "chromium", label: "Chromium" },
  { value: "chrome", label: "Chrome" },
  { value: "firefox", label: "Firefox" },
  { value: "webkit", label: "WebKit" },
  { value: "edge", label: "Edge" },
];
