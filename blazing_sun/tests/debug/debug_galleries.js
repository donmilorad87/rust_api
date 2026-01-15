const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    console.log(`[CONSOLE ${type.toUpperCase()}] ${text}`);
  });

  // Collect network requests
  const networkRequests = [];
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const method = response.request().method();

    if (url.includes('/api/')) {
      console.log(`[NETWORK] ${method} ${url} -> ${status}`);
      networkRequests.push({ method, url, status });

      // Try to get response body for API calls
      try {
        const body = await response.text();
        if (url.includes('/galleries')) {
          console.log(`[RESPONSE BODY] ${body}`);
        }
      } catch (e) {
        console.log(`[RESPONSE BODY] Could not read body: ${e.message}`);
      }
    }
  });

  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  try {
    console.log('\n=== STEP 1: Navigate to sign-in page ===');
    await page.goto('http://172.28.0.10:9999/sign-in', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('\n=== STEP 2: Sign in ===');
    await page.fill('input[type="email"]', 'djmyle@gmail.com');
    await page.fill('input[type="password"]', 'asdqwE123~~');
    await page.click('button[type="submit"]');

    // Wait for navigation after sign-in
    await page.waitForTimeout(2000);
    console.log(`Current URL after sign-in: ${page.url()}`);

    console.log('\n=== STEP 3: Navigate to /galleries ===');
    await page.goto('http://172.28.0.10:9999/galleries', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    console.log('\n=== STEP 4: Check page state ===');

    // Check if loading spinner is visible
    const loadingSpinner = await page.locator('.loading-spinner, [class*="loading"], [class*="spinner"]').count();
    console.log(`Loading spinner elements found: ${loadingSpinner}`);

    if (loadingSpinner > 0) {
      const isVisible = await page.locator('.loading-spinner, [class*="loading"], [class*="spinner"]').first().isVisible();
      console.log(`Loading spinner visible: ${isVisible}`);
    }

    // Check for error messages on page
    const errorElements = await page.locator('[class*="error"], .error-message, .alert-danger').count();
    console.log(`Error message elements found: ${errorElements}`);

    if (errorElements > 0) {
      const errorText = await page.locator('[class*="error"], .error-message, .alert-danger').first().textContent();
      console.log(`Error message text: ${errorText}`);
    }

    // Get page title and body text (first 500 chars)
    const title = await page.title();
    const bodyText = await page.locator('body').textContent();
    console.log(`Page title: ${title}`);
    console.log(`Body text (first 500 chars): ${bodyText.substring(0, 500)}`);

    console.log('\n=== STEP 5: Take screenshot ===');
    await page.screenshot({ path: '/home/milner/Desktop/rust/galleries_debug.png', fullPage: true });
    console.log('Screenshot saved to /home/milner/Desktop/rust/galleries_debug.png');

    console.log('\n=== STEP 6: Summary ===');
    console.log('\nConsole Messages:');
    consoleMessages.forEach(msg => {
      console.log(`  [${msg.type}] ${msg.text}`);
    });

    console.log('\nNetwork Requests (API only):');
    networkRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url} -> ${req.status}`);
    });

    console.log('\nPage Errors:');
    if (pageErrors.length === 0) {
      console.log('  No page errors detected');
    } else {
      pageErrors.forEach(err => {
        console.log(`  ${err}`);
      });
    }

    // Check specifically for /api/v1/galleries request
    const galleriesRequest = networkRequests.find(req => req.url.includes('/api/v1/galleries'));
    if (galleriesRequest) {
      console.log(`\n/api/v1/galleries status code: ${galleriesRequest.status}`);
    } else {
      console.log('\n/api/v1/galleries request NOT FOUND in network requests');
    }

  } catch (error) {
    console.error('\n=== ERROR DURING DEBUGGING ===');
    console.error(error);
  } finally {
    console.log('\n=== Closing browser in 5 seconds ===');
    await page.waitForTimeout(5000);
    await browser.close();
  }
})();
