import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration
 *
 * Test Structure:
 * - tests/routes/web/{PAGE_NAME}/{page_name}.spec.ts
 *
 * Run tests:
 * - npx playwright test                    # Run all tests
 * - npx playwright test sign_in.spec.ts    # Run specific test
 * - npx playwright test --headed           # Run with visible browser
 * - npx playwright test --debug            # Run in debug mode
 */

export default defineConfig({
  testDir: './routes/web',

  /* Global setup - waits for server to be ready */
  globalSetup: './global-setup.ts',

  /* Run tests sequentially to avoid overwhelming the server */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests to handle intermittent 502 errors */
  retries: 2,

  /* Limit workers to prevent overwhelming the server */
  workers: 1,

  /* Global timeout per test */
  timeout: 30000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: '../storage/app/public/test-reports/playwright' }],
    ['list']
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL for tests - uses local.rust.com (add to /etc/hosts: 127.0.0.1 local.rust.com) */
    baseURL: 'https://local.rust.com',

    /* Ignore HTTPS errors (self-signed cert) */
    ignoreHTTPSErrors: true,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'on-first-retry',

    /* Navigation timeout */
    navigationTimeout: 15000,

    /* Action timeout */
    actionTimeout: 10000,
  },

  /* Configure projects for major browsers - start with just Chromium for faster testing */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test in other browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Server is checked by globalSetup before tests run */
});
