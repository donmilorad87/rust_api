import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Profile Avatar Upload', () => {
  test('should upload new avatar successfully', async ({ page }) => {
    // Go to sign in page
    await page.goto('https://local.rust.com/sign-in');

    // Fill in credentials
    await page.fill('input[name="email"]', 'djmyle@gmail.com');
    await page.fill('input[name="password"]', 'asdqwE123~~');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL('https://local.rust.com/', { timeout: 10000 });

    // Navigate to profile page
    await page.goto('https://local.rust.com/profile');

    // Wait for profile page to load
    await page.waitForSelector('#avatarContainer', { timeout: 5000 });

    // Get the file input element (hidden)
    const fileInput = page.locator('#avatarInput');

    // Set the file to upload
    const testImagePath = path.join(__dirname, '../../../test-avatar.jpg');
    await fileInput.setInputFiles(testImagePath);

    // Wait for preview modal to appear
    await page.waitForSelector('#avatarPreviewModal:not(.hidden)', { timeout: 5000 });

    // Verify preview image is visible
    const previewImage = page.locator('#previewImage');
    await expect(previewImage).toBeVisible();

    // Click the confirm button to upload
    const confirmBtn = page.locator('#confirmAvatarBtn');
    await confirmBtn.click();

    // Wait for upload to complete (button text changes from "Uploading..." back to normal)
    await page.waitForFunction(() => {
      const btn = document.querySelector('#confirmAvatarBtn');
      return btn && !btn.textContent?.includes('Uploading');
    }, { timeout: 10000 });

    // Wait for success toast message
    await page.waitForSelector('.toastify', { timeout: 5000 });

    // Verify modal is closed
    await expect(page.locator('#avatarPreviewModal')).toHaveClass(/hidden/);

    // Verify avatar image is updated and visible
    const avatarImage = page.locator('#avatarImage');
    await expect(avatarImage).toBeVisible({ timeout: 5000 });

    // Verify the image loads successfully
    const isLoaded = await avatarImage.evaluate((img: HTMLImageElement) => {
      return img.complete && img.naturalWidth > 0;
    });
    expect(isLoaded).toBe(true);

    console.log('✓ Avatar uploaded successfully');
  });
});
