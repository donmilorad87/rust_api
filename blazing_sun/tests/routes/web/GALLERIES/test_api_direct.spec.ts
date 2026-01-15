import { test, expect } from '@playwright/test';

test('Test galleries API directly', async ({ page }) => {
  // Collect all console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Collect network errors
  page.on('pageerror', error => {
    consoleMessages.push(`[PAGE ERROR] ${error.message}`);
  });

  // Step 1: Navigate and sign in
  await page.goto('http://172.28.0.10:9999/sign-in');
  await page.fill('input[type="email"]', 'djmyle@gmail.com');
  await page.fill('input[type="password"]', 'asdqwE123~~');

  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);

  console.log('Logged in, now at:', page.url());

  // Step 2: Make API request using page.evaluate to see the actual error
  const apiResult = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/v1/galleries', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      const status = response.status;
      const statusText = response.statusText;
      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = await response.text();
      }

      return {
        status,
        statusText,
        data,
        ok: response.ok
      };
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack
      };
    }
  });

  console.log('API Response:', JSON.stringify(apiResult, null, 2));

  // Navigate to galleries page
  await page.goto('http://172.28.0.10:9999/galleries');
  await page.waitForTimeout(3000);

  // Print all console messages
  console.log('\n=== CONSOLE MESSAGES FROM GALLERIES PAGE ===');
  consoleMessages.forEach(msg => console.log(msg));
  console.log('===========================================\n');

  // Check if JavaScript loaded
  const jsLoaded = await page.evaluate(() => {
    return {
      galleriesController: typeof window.galleriesController !== 'undefined',
      BASE_URL: window.BASE_URL,
      hasLoadingState: !!document.getElementById('loadingState'),
      hasGalleriesGrid: !!document.getElementById('galleriesGrid')
    };
  });

  console.log('JavaScript check:', JSON.stringify(jsLoaded, null, 2));

  // Take screenshot
  await page.screenshot({
    path: '/tmp/claude/galleries-page-debug.png',
    fullPage: true
  });
});
