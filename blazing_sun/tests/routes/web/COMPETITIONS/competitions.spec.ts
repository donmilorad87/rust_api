import { test, expect } from '@playwright/test';

test('Competitions page loads', async ({ page }) => {
  await page.goto('http://172.28.0.10:9999/sign-in');
  await page.fill('input[type="email"]', 'djmyle@gmail.com');
  await page.fill('input[type="password"]', 'asdqwE123~~');
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);

  await page.goto('http://172.28.0.10:9999/competitions');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toContainText(/Competitions/i);
  await expect(page.locator('#competitionsList')).toBeVisible();
  await expect(page.locator('#competitionsEmptyState')).toHaveCount(1);
});

test('Competition create dates enforce minimums', async ({ page }) => {
  await page.goto('http://172.28.0.10:9999/sign-in');
  await page.fill('input[type="email"]', 'djmyle@gmail.com');
  await page.fill('input[type="password"]', 'asdqwE123~~');
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ]);

  await page.goto('http://172.28.0.10:9999/competitions');
  await page.waitForLoadState('networkidle');

  const form = page.locator('#competitionCreateForm');
  await expect(form).toBeVisible();

  const startInput = form.locator('input[name="start_date"]');
  const endInput = form.locator('input[name="end_date"]');

  await expect(startInput).toBeVisible();
  await expect(endInput).toBeVisible();

  const initial = await page.evaluate(() => {
    const startEl = document.querySelector('input[name="start_date"]');
    const endEl = document.querySelector('input[name="end_date"]');

    if (!startEl || !endEl) {
      return null;
    }

    const now = new Date();
    now.setSeconds(0, 0);

    const startMin = startEl.min;
    const endMin = endEl.min;
    const startDate = new Date(startMin);
    const endDate = new Date(endMin);

    return {
      startMin,
      endMin,
      startDiffMinutes: (startDate.getTime() - now.getTime()) / 60000,
      endDiffMinutes: (endDate.getTime() - now.getTime()) / 60000
    };
  });

  expect(initial).not.toBeNull();
  expect(initial?.startMin).not.toBe('');
  expect(initial?.endMin).not.toBe('');
  expect(initial?.startDiffMinutes).toBeGreaterThanOrEqual(59);
  expect(initial?.startDiffMinutes).toBeLessThanOrEqual(61);
  expect(initial?.endDiffMinutes).toBeGreaterThanOrEqual(1439);
  expect(initial?.endDiffMinutes).toBeLessThanOrEqual(1441);

  const adjusted = await page.evaluate(() => {
    const startEl = document.querySelector('input[name="start_date"]');
    const endEl = document.querySelector('input[name="end_date"]');

    if (!startEl || !endEl) {
      return null;
    }

    const now = new Date();
    now.setHours(now.getHours() + 2);
    now.setSeconds(0, 0);

    const pad = (value) => String(value).padStart(2, '0');
    const startValue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    startEl.value = startValue;
    startEl.dispatchEvent(new Event('input', { bubbles: true }));
    startEl.dispatchEvent(new Event('change', { bubbles: true }));

    const expected = new Date(startValue);
    expected.setHours(expected.getHours() + 1);
    expected.setSeconds(0, 0);

    const expectedValue = `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}T${pad(expected.getHours())}:${pad(expected.getMinutes())}`;

    return {
      expectedValue,
      endMin: endEl.min
    };
  });

  expect(adjusted).not.toBeNull();
  expect(adjusted?.endMin).toBe(adjusted?.expectedValue);
});
