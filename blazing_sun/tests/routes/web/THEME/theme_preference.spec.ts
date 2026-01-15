import { test, expect } from '@playwright/test';

test.describe('Theme Preference - System Default', () => {
  test('sets dark theme when no cookie and system prefers dark', async ({ page }) => {
    await page.context().clearCookies();
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/sign-in');
    await page.waitForFunction(() =>
      document.cookie.includes('blazing_sun_theme=')
    );

    const cookies = await page.context().cookies();
    const themeCookie = cookies.find(cookie => cookie.name === 'blazing_sun_theme');
    expect(themeCookie?.value).toBe('dark');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('sets light theme when no cookie and system prefers light', async ({ page }) => {
    await page.context().clearCookies();
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto('/sign-in');
    await page.waitForFunction(() =>
      document.cookie.includes('blazing_sun_theme=')
    );

    const cookies = await page.context().cookies();
    const themeCookie = cookies.find(cookie => cookie.name === 'blazing_sun_theme');
    expect(themeCookie?.value).toBe('light');

    const dataTheme = await page.locator('html').getAttribute('data-theme');
    expect(dataTheme).toBeNull();
  });
});
