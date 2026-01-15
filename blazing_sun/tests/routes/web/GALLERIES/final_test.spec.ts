import { test, expect } from '@playwright/test';

test('Final galleries page test with detailed debugging', async ({ page }) => {
  // Collect console and errors
  const logs: string[] = [];

  page.on('console', msg => logs.push(`[console.${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}\n${err.stack}`));
  page.on('requestfailed', req => logs.push(`[REQUEST FAILED] ${req.url()} - ${req.failure()?.errorText}`));

  // Sign in
  await page.goto('http://172.28.0.10:9999/sign-in');
  await page.fill('input[type="email"]', 'djmyle@gmail.com');
  await page.fill('input[type="password"]', 'asdqwE123~~');
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);

  console.log('✅ Signed in');

  // Navigate to galleries
  await page.goto('http://172.28.0.10:9999/galleries');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Wait 5 seconds

  console.log('\n=== LOGS ===');
  logs.forEach(log => console.log(log));
  console.log('============\n');

  // Check what happened
  const state = await page.evaluate(() => {
    return {
      hasGalleriesController: typeof window.galleriesController !== 'undefined',
      BASE_URL: window.BASE_URL,
      loadingVisible: document.getElementById('loadingState')?.style.display,
      errorVisible: document.getElementById('errorState')?.style.display,
      emptyVisible: document.getElementById('emptyState')?.style.display,
      gridVisible: document.getElementById('galleriesGrid')?.style.display,
      hasToastify: typeof window.Toastify !== 'undefined',
      documentReady: document.readyState
    };
  });

  console.log('Page State:', JSON.stringify(state, null, 2));

  // Take screenshot
  await page.screenshot({
    path: '/tmp/claude/final-galleries-test.png',
    fullPage: true
  });

  // Check if it worked
  const spinnerVisible = state.loadingVisible !== 'none';
  const contentShowing = state.emptyVisible !== 'none' || state.gridVisible !== 'none';

  console.log(`\nSpinner visible: ${spinnerVisible}`);
  console.log(`Content showing: ${contentShowing}`);
  console.log(`Controller loaded: ${state.hasGalleriesController}`);

  expect(state.hasGalleriesController).toBe(true);
  expect(spinnerVisible).toBe(false);
  expect(contentShowing).toBe(true);
});
