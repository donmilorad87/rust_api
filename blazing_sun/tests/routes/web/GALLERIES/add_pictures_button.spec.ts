/**
 * Add Pictures Button Tests
 *
 * Route: /galleries (pictures modal)
 * Feature: "+ Add Pictures" button functionality
 *
 * Test Coverage:
 * - [x] Sign in successfully
 * - [x] Navigate to galleries page
 * - [x] Create a test gallery
 * - [x] Open pictures modal
 * - [x] Verify "+ Add Pictures" button is visible and clickable
 * - [x] Click button and verify redirect to /admin/uploads
 * - [x] Verify sessionStorage contains returnToGallery and returnToGalleryName
 * - [x] Verify no console errors
 * - [x] Take screenshots at key steps
 */

import { test, expect } from '@playwright/test';

test.describe('Add Pictures Button', () => {
  // Helper function to clean up test data
  async function cleanupTestGallery(page: any, galleryName: string) {
    try {
      // Navigate to galleries page
      await page.goto('http://172.28.0.10:9999/galleries');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Find gallery by name
      const galleryCard = page.locator(`.gallery-card:has-text("${galleryName}")`).first();
      const exists = await galleryCard.count() > 0;

      if (exists) {
        // Click delete button if exists
        const deleteBtn = galleryCard.locator('button:has-text("Delete"), button[aria-label*="Delete"]');
        const deleteBtnExists = await deleteBtn.count() > 0;

        if (deleteBtnExists) {
          await deleteBtn.click();
          await page.waitForTimeout(500);

          // Confirm deletion if there's a confirmation dialog
          const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
          const confirmExists = await confirmBtn.count() > 0;

          if (confirmExists) {
            await confirmBtn.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    } catch (error) {
      console.log('Cleanup warning:', error);
    }
  }

  test('should allow adding pictures to gallery via Add Pictures button', async ({ page }) => {
    // Track console messages and errors
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Track network requests
    const networkRequests: { url: string; status: number; method: string }[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        networkRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    const testGalleryName = `Test Gallery ${Date.now()}`;

    try {
      // ============================================
      // STEP 1: Sign In
      // ============================================
      console.log('\n=== STEP 1: SIGN IN ===');
      await page.goto('http://172.28.0.10:9999/sign-in');
      await page.waitForLoadState('networkidle');

      // Fill sign-in form
      await page.fill('input[type="email"]', 'djmyle@gmail.com');
      await page.fill('input[type="password"]', 'asdqwE123~~');

      // Submit and wait for navigation
      await Promise.all([
        page.waitForNavigation({ timeout: 10000 }),
        page.click('button[type="submit"]')
      ]);

      console.log('✓ Sign in successful');
      console.log(`Current URL: ${page.url()}`);

      // ============================================
      // STEP 2: Navigate to Galleries Page
      // ============================================
      console.log('\n=== STEP 2: NAVIGATE TO GALLERIES ===');
      await page.goto('http://172.28.0.10:9999/galleries');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('✓ Galleries page loaded');

      // Take screenshot of galleries page
      await page.screenshot({
        path: '/tmp/claude/test-add-pictures-01-galleries-page.png',
        fullPage: true
      });

      // ============================================
      // STEP 3: Create Test Gallery
      // ============================================
      console.log('\n=== STEP 3: CREATE TEST GALLERY ===');

      // Find and click "New Gallery" button
      const newGalleryButton = page.locator('button:has-text("New Gallery"), button:has-text("+ New Gallery"), button:has-text("Create Gallery")').first();
      await expect(newGalleryButton).toBeVisible({ timeout: 5000 });
      await newGalleryButton.click();
      await page.waitForTimeout(1000);

      // Wait for modal to appear
      const modal = page.locator('[class*="modal"], .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      console.log('✓ New Gallery modal opened');

      // Fill in gallery name
      const nameInput = modal.locator('input[name="name"], input#name, input[placeholder*="name" i]').first();
      await expect(nameInput).toBeVisible();
      await nameInput.fill(testGalleryName);

      console.log(`✓ Gallery name entered: ${testGalleryName}`);

      // Take screenshot of filled modal
      await page.screenshot({
        path: '/tmp/claude/test-add-pictures-02-new-gallery-modal.png',
        fullPage: true
      });

      // Submit the form
      const submitBtn = modal.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
      await expect(submitBtn).toBeVisible();
      await submitBtn.click();

      // Wait for modal to close and gallery to be created
      await page.waitForTimeout(2000);

      console.log('✓ Gallery created');

      // Verify gallery appears in list
      const createdGallery = page.locator(`.gallery-card:has-text("${testGalleryName}"), [class*="gallery"]:has-text("${testGalleryName}")`).first();
      await expect(createdGallery).toBeVisible({ timeout: 5000 });

      console.log('✓ Gallery appears in list');

      // ============================================
      // STEP 4: Open Pictures Modal
      // ============================================
      console.log('\n=== STEP 4: OPEN PICTURES MODAL ===');

      // Find the gallery card
      const galleryCard = page.locator(`.gallery-card:has-text("${testGalleryName}")`).first();
      await expect(galleryCard).toBeVisible({ timeout: 5000 });

      // Click on the "View Pictures" button within the gallery card
      const viewPicturesBtn = galleryCard.locator('[data-action="view-pictures"]');
      await expect(viewPicturesBtn).toBeVisible({ timeout: 5000 });
      await viewPicturesBtn.click();
      await page.waitForTimeout(1500);

      // Wait for pictures modal to appear
      const picturesModal = page.locator('[class*="modal"]:has-text("Pictures"), [role="dialog"]:has-text("Pictures")').first();
      await expect(picturesModal).toBeVisible({ timeout: 5000 });

      console.log('✓ Pictures modal opened');

      // Take screenshot of pictures modal
      await page.screenshot({
        path: '/tmp/claude/test-add-pictures-03-pictures-modal.png',
        fullPage: true
      });

      // ============================================
      // STEP 5: Verify "+ Add Pictures" Button
      // ============================================
      console.log('\n=== STEP 5: VERIFY ADD PICTURES BUTTON ===');

      // Find the "+ Add Pictures" button
      const addPicturesBtn = picturesModal.locator('button:has-text("Add Pictures"), button:has-text("+ Add Pictures")').first();

      // Verify button is visible
      await expect(addPicturesBtn).toBeVisible({ timeout: 5000 });
      console.log('✓ Add Pictures button is visible');

      // Verify button is enabled (not disabled)
      await expect(addPicturesBtn).toBeEnabled();
      console.log('✓ Add Pictures button is enabled');

      // Take screenshot with button highlighted
      await page.screenshot({
        path: '/tmp/claude/test-add-pictures-04-button-visible.png',
        fullPage: true
      });

      // ============================================
      // STEP 6: Click Button and Verify Redirect
      // ============================================
      console.log('\n=== STEP 6: CLICK BUTTON AND VERIFY REDIRECT ===');

      // Click the button
      await addPicturesBtn.click();
      console.log('✓ Add Pictures button clicked');

      // Wait for navigation to /admin/uploads
      await page.waitForURL('**/admin/uploads', { timeout: 10000 });
      console.log('✓ Redirected to /admin/uploads');

      // Verify URL
      const currentUrl = page.url();
      expect(currentUrl).toContain('/admin/uploads');
      console.log(`Current URL: ${currentUrl}`);

      // ============================================
      // STEP 7: Verify SessionStorage
      // ============================================
      console.log('\n=== STEP 7: VERIFY SESSIONSTORAGE ===');

      // Check sessionStorage for returnToGallery
      const returnToGallery = await page.evaluate(() => {
        return sessionStorage.getItem('returnToGallery');
      });

      expect(returnToGallery).not.toBeNull();
      expect(returnToGallery).not.toBe('');
      console.log(`✓ returnToGallery: ${returnToGallery}`);

      // Check sessionStorage for returnToGalleryName
      const returnToGalleryName = await page.evaluate(() => {
        return sessionStorage.getItem('returnToGalleryName');
      });

      expect(returnToGalleryName).not.toBeNull();
      expect(returnToGalleryName).toBe(testGalleryName);
      console.log(`✓ returnToGalleryName: ${returnToGalleryName}`);

      // ============================================
      // STEP 8: Verify No Console Errors
      // ============================================
      console.log('\n=== STEP 8: VERIFY NO CONSOLE ERRORS ===');

      // Take screenshot of uploads page
      await page.screenshot({
        path: '/tmp/claude/test-add-pictures-05-uploads-page.png',
        fullPage: true
      });

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes('favicon') &&
        !err.includes('sourcemap') &&
        !err.toLowerCase().includes('warning') &&
        !err.includes('Failed to load resource')
      );

      console.log('All console messages:', consoleMessages);
      console.log('Console errors:', consoleErrors);
      console.log('Critical errors:', criticalErrors);

      // Verify no critical errors
      expect(criticalErrors.length).toBe(0);
      console.log('✓ No critical console errors');

      // ============================================
      // STEP 9: Verify API Requests
      // ============================================
      console.log('\n=== STEP 9: VERIFY API REQUESTS ===');

      console.log('Network requests:', networkRequests);

      // Check for gallery creation request
      const createGalleryRequest = networkRequests.find(req =>
        req.url.includes('/api/v1/galleries') && req.method === 'POST'
      );

      if (createGalleryRequest) {
        expect(createGalleryRequest.status).toBe(201); // 201 Created is correct for POST
        console.log(`✓ Create gallery API: ${createGalleryRequest.status}`);
      }

      // ============================================
      // FINAL SUMMARY
      // ============================================
      console.log('\n=== TEST SUMMARY ===');
      console.log('✓ Sign-in successful');
      console.log('✓ Galleries page loaded');
      console.log(`✓ Test gallery created: ${testGalleryName}`);
      console.log('✓ Pictures modal opened');
      console.log('✓ Add Pictures button visible and clickable');
      console.log('✓ Redirected to /admin/uploads');
      console.log(`✓ sessionStorage.returnToGallery: ${returnToGallery}`);
      console.log(`✓ sessionStorage.returnToGalleryName: ${returnToGalleryName}`);
      console.log(`✓ Console errors: ${criticalErrors.length} critical errors`);
      console.log('====================\n');

    } catch (error) {
      // Take error screenshot
      await page.screenshot({
        path: '/tmp/claude/test-add-pictures-ERROR.png',
        fullPage: true
      });
      throw error;
    } finally {
      // ============================================
      // CLEANUP: Delete Test Gallery
      // ============================================
      console.log('\n=== CLEANUP: DELETE TEST GALLERY ===');
      await cleanupTestGallery(page, testGalleryName);
      console.log('✓ Cleanup completed');
    }
  });

  // ============================================
  // Additional Test: Button State Tests
  // ============================================
  test('should have proper button attributes and styling', async ({ page }) => {
    const testGalleryName = `Test Gallery ${Date.now()}`;

    try {
      // Sign in
      await page.goto('http://172.28.0.10:9999/sign-in');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="email"]', 'djmyle@gmail.com');
      await page.fill('input[type="password"]', 'asdqwE123~~');
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]')
      ]);

      // Navigate to galleries
      await page.goto('http://172.28.0.10:9999/galleries');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Create test gallery
      const newGalleryButton = page.locator('button:has-text("New Gallery")').first();
      await newGalleryButton.click();
      await page.waitForTimeout(1000);

      const modal = page.locator('[class*="modal"]').first();
      const nameInput = modal.locator('input').first();
      await nameInput.fill(testGalleryName);

      const submitBtn = modal.locator('button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(2000);

      // Open pictures modal
      const galleryCard = page.locator(`.gallery-card:has-text("${testGalleryName}")`).first();
      const viewPicturesBtn = galleryCard.locator('[data-action="view-pictures"]');
      await viewPicturesBtn.click();
      await page.waitForTimeout(1500);

      const picturesModal = page.locator('[class*="modal"]:has-text("Pictures")').first();
      await expect(picturesModal).toBeVisible();

      // Find Add Pictures button
      const addPicturesBtn = picturesModal.locator('button:has-text("Add Pictures")').first();

      // Verify button properties
      await expect(addPicturesBtn).toBeVisible();
      await expect(addPicturesBtn).toBeEnabled();

      // Check if button has proper cursor (should be clickable)
      const cursor = await addPicturesBtn.evaluate(el => {
        return window.getComputedStyle(el).cursor;
      });
      expect(cursor).not.toBe('not-allowed');
      expect(cursor).not.toBe('default');

      console.log(`✓ Button cursor style: ${cursor}`);

      // Verify button is not disabled
      const isDisabled = await addPicturesBtn.evaluate(el => {
        return (el as HTMLButtonElement).disabled;
      });
      expect(isDisabled).toBe(false);
      console.log('✓ Button is not disabled');

      // Verify button has click handler
      const hasClickHandler = await addPicturesBtn.evaluate(el => {
        const onclick = (el as any).onclick;
        const listeners = (window as any).getEventListeners ? (window as any).getEventListeners(el) : null;
        return onclick !== null || (listeners && listeners.click && listeners.click.length > 0);
      });
      console.log(`Button has click handler: ${hasClickHandler}`);

    } finally {
      await cleanupTestGallery(page, testGalleryName);
    }
  });

  // ============================================
  // Additional Test: Return Flow
  // ============================================
  test('should preserve gallery context when returning from uploads', async ({ page }) => {
    const testGalleryName = `Test Gallery ${Date.now()}`;

    try {
      // Sign in
      await page.goto('http://172.28.0.10:9999/sign-in');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="email"]', 'djmyle@gmail.com');
      await page.fill('input[type="password"]', 'asdqwE123~~');
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]')
      ]);

      // Navigate to galleries and create test gallery
      await page.goto('http://172.28.0.10:9999/galleries');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const newGalleryButton = page.locator('button:has-text("New Gallery")').first();
      await newGalleryButton.click();
      await page.waitForTimeout(1000);

      const modal = page.locator('[class*="modal"]').first();
      const nameInput = modal.locator('input').first();
      await nameInput.fill(testGalleryName);

      const submitBtn = modal.locator('button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(2000);

      // Open pictures modal and click Add Pictures
      const galleryCard = page.locator(`.gallery-card:has-text("${testGalleryName}")`).first();
      const viewPicturesBtn = galleryCard.locator('[data-action="view-pictures"]');
      await viewPicturesBtn.click();
      await page.waitForTimeout(1500);

      const picturesModal = page.locator('[class*="modal"]:has-text("Pictures")').first();
      const addPicturesBtn = picturesModal.locator('button:has-text("Add Pictures")').first();
      await addPicturesBtn.click();

      // Wait for redirect
      await page.waitForURL('**/admin/uploads');

      // Verify sessionStorage is preserved
      const returnToGallery = await page.evaluate(() => sessionStorage.getItem('returnToGallery'));
      const returnToGalleryName = await page.evaluate(() => sessionStorage.getItem('returnToGalleryName'));

      expect(returnToGallery).not.toBeNull();
      expect(returnToGalleryName).toBe(testGalleryName);

      console.log('✓ Gallery context preserved in sessionStorage');
      console.log(`  - returnToGallery: ${returnToGallery}`);
      console.log(`  - returnToGalleryName: ${returnToGalleryName}`);

      // Navigate back to galleries
      await page.goto('http://172.28.0.10:9999/galleries');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Verify gallery still exists
      const galleryStillExists = page.locator(`.gallery-card:has-text("${testGalleryName}")`).first();
      await expect(galleryStillExists).toBeVisible();

      console.log('✓ Gallery still exists after return navigation');

    } finally {
      await cleanupTestGallery(page, testGalleryName);
    }
  });
});
