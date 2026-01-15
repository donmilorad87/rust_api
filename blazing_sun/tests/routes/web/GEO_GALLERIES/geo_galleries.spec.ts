import { test, expect } from '@playwright/test';

test('Geo Galleries map page loads', async ({ page }) => {
  await page.goto('http://172.28.0.10:9999/sign-in');
  await page.fill('input[type=\"email\"]', 'djmyle@gmail.com');
  await page.fill('input[type=\"password\"]', 'asdqwE123~~');
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type=\"submit\"]')
  ]);

  await page.goto('http://172.28.0.10:9999/geo_galleries');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toContainText(/Geo Galleries/i);
  await expect(page.locator('#geoGalleriesMap')).toBeVisible();
  await expect(page.locator('[data-filter="galleries"]')).toBeVisible();
  await expect(page.locator('[data-filter="restaurants"]')).toBeVisible();
  await expect(page.locator('[data-filter="cafes"]')).toBeVisible();
  await expect(page.locator('[data-filter="lodgings"]')).toBeVisible();
});
