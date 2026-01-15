import { test, expect } from '@playwright/test';

test.describe('Profile Page - No Redirect Loop', () => {
  test('should load profile page without redirect loop', async ({ page }) => {
    // Go to sign in page
    await page.goto('https://local.rust.com/sign-in');

    // Fill in credentials
    await page.fill('input[name="email"]', 'djmyle@gmail.com');
    await page.fill('input[name="password"]', 'asdqwE123~~');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to complete (should go to homepage)
    await page.waitForURL('https://local.rust.com/', { timeout: 10000 });

    // Navigate to profile page
    await page.goto('https://local.rust.com/profile');

    // Wait for profile page to load
    await page.waitForSelector('#profileForm', { timeout: 5000 });

    // Verify we're still on the profile page (no redirect)
    await page.waitForTimeout(2000); // Wait to ensure no redirect happens
    expect(page.url()).toBe('https://local.rust.com/profile');

    // Verify profile content is visible
    const profileTitle = page.locator('h1.profile__title');
    await expect(profileTitle).toBeVisible();
    await expect(profileTitle).toHaveText('My Profile');

    // Verify user data is loaded
    const firstNameInput = page.locator('#first_name');
    await expect(firstNameInput).toBeVisible();
    const firstName = await firstNameInput.inputValue();
    expect(firstName.length).toBeGreaterThan(0);

    console.log('✓ Profile page loaded successfully without redirect loop');
  });
});
