import { test } from '@playwright/test';

test('Check if GALLERIES script is in HTML', async ({ page }) => {
  // Sign in
  await page.goto('http://172.28.0.10:9999/sign-in');
  await page.fill('input[type="email"]', 'djmyle@gmail.com');
  await page.fill('input[type="password"]', 'asdqwE123~~');
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);

  // Navigate to galleries
  await page.goto('http://172.28.0.10:9999/galleries');
  await page.waitForLoadState('networkidle');

  // Get HTML content
  const html = await page.content();

  // Check for script tags
  console.log('\n=== CHECKING FOR SCRIPT TAGS ===');
  const scriptMatches = html.match(/<script[^>]*src="[^"]*"[^>]*>/g);
  if (scriptMatches) {
    console.log('Found scripts:');
    scriptMatches.forEach(script => console.log(`  ${script}`));
  } else {
    console.log('NO SCRIPT TAGS FOUND!');
  }

  // Specifically check for GALLERIES script
  const hasGalleriesScript = html.includes('GALLERIES/app.js');
  console.log(`\nHas GALLERIES/app.js: ${hasGalleriesScript}`);

  // Check what scripts are actually loaded
  const loadedScripts = await page.$$eval('script[src]', scripts =>
    scripts.map(s => s.getAttribute('src'))
  );

  console.log('\nLoaded script elements:');
  loadedScripts.forEach(src => console.log(`  ${src}`));
});
