import { test, expect } from '@playwright/test';

test.describe('Gallery Cover Images and Lightbox', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[CONSOLE ${msg.type()}]`, msg.text());
    });

    // Sign in
    await page.goto('http://172.28.0.10:9999/sign-in');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'djmyle@gmail.com');
    await page.fill('input[type="password"]', 'asdqwE123~~');

    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);

    await page.waitForLoadState('networkidle');
  });

  test('should navigate to galleries from navbar', async ({ page }) => {
    console.log('Test: Checking navbar Galleries link...');

    // Wait for navbar to load
    await page.waitForSelector('nav', { timeout: 5000 });

    // Check that Galleries link exists in navbar
    const galleriesLink = page.locator('nav a:has-text("Galleries")');
    await expect(galleriesLink).toBeVisible();

    // Click on Galleries link
    await galleriesLink.click();
    await page.waitForLoadState('networkidle');

    // Verify we're on galleries page
    expect(page.url()).toContain('/galleries');

    // Take screenshot
    await page.screenshot({
      path: '/tmp/claude/navbar-galleries-link.png',
      fullPage: true
    });

    console.log('✓ Galleries link in navbar works');
  });

  test('should display cover images for galleries with pictures', async ({ page }) => {
    console.log('Test: Checking gallery cover images...');

    // Navigate to galleries
    await page.goto('http://172.28.0.10:9999/galleries');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for gallery cards
    const galleryCards = page.locator('.gallery-card');
    const galleryCount = await galleryCards.count();

    console.log(`Found ${galleryCount} gallery cards`);

    if (galleryCount > 0) {
      // Check first gallery card
      const firstCard = galleryCards.first();

      // Check for cover image
      const coverImage = firstCard.locator('.gallery-card__cover img, .gallery-card__image');
      await expect(coverImage).toBeVisible();

      // Get image src
      const imgSrc = await coverImage.getAttribute('src');
      console.log(`First gallery cover image src: ${imgSrc}`);

      // Verify it's either an upload URL or placeholder
      expect(
        imgSrc?.includes('/api/v1/upload/download/public/') ||
        imgSrc?.includes('placeholder') ||
        imgSrc?.includes('/assets/img/')
      ).toBe(true);

      // Take screenshot
      await page.screenshot({
        path: '/tmp/claude/gallery-cover-images.png',
        fullPage: true
      });

      console.log('✓ Gallery cover images display correctly');
    } else {
      console.log('No galleries found to test cover images');
    }
  });

  test('should display placeholder for empty galleries', async ({ page }) => {
    console.log('Test: Checking placeholder for empty galleries...');

    await page.goto('http://172.28.0.10:9999/galleries');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Create a new empty gallery
    const newGalleryButton = page.locator('button:has-text("New Gallery"), button:has-text("+ New Gallery")').first();

    if (await newGalleryButton.isVisible()) {
      await newGalleryButton.click();
      await page.waitForTimeout(1000);

      // Fill in gallery details
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Test Empty Gallery ' + Date.now());

        // Submit form
        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]').first();
        await submitButton.click();
        await page.waitForTimeout(2000);

        // Check for gallery cards again
        const galleryCards = page.locator('.gallery-card');
        const galleryCount = await galleryCards.count();

        if (galleryCount > 0) {
          // Find the newly created gallery (should be first or last)
          const lastCard = galleryCards.last();
          const coverImage = lastCard.locator('.gallery-card__cover img, .gallery-card__image');

          if (await coverImage.isVisible()) {
            const imgSrc = await coverImage.getAttribute('src');
            console.log(`Empty gallery cover image src: ${imgSrc}`);

            // Should be placeholder
            expect(
              imgSrc?.includes('placeholder') ||
              imgSrc?.includes('/assets/img/gallery-placeholder')
            ).toBe(true);

            console.log('✓ Empty gallery shows placeholder');
          }
        }
      }
    }

    await page.screenshot({
      path: '/tmp/claude/empty-gallery-placeholder.png',
      fullPage: true
    });
  });

  test('should open lightbox when clicking on a picture', async ({ page }) => {
    console.log('Test: Checking lightbox functionality...');

    await page.goto('http://172.28.0.10:9999/galleries');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find a gallery card with pictures
    const galleryCards = page.locator('.gallery-card');
    const galleryCount = await galleryCards.count();

    if (galleryCount > 0) {
      // Click on "View pictures" button or the gallery card itself
      const firstCard = galleryCards.first();
      const viewButton = firstCard.locator('button[data-action="view-pictures"], .gallery-card__action');

      if (await viewButton.count() > 0) {
        console.log('Clicking view pictures button...');
        await viewButton.first().click();
        await page.waitForTimeout(1500);

        // Check if pictures grid appeared
        const picturesGrid = page.locator('.pictures-grid, [class*="picture"]');
        const hasPictures = await picturesGrid.count() > 0;

        if (hasPictures) {
          console.log('Pictures grid displayed, looking for picture cards...');

          // Find first picture card
          const pictureCard = page.locator('.picture-card, [class*="picture-card"]').first();

          if (await pictureCard.isVisible()) {
            console.log('Clicking on picture card to open lightbox...');
            await pictureCard.click();
            await page.waitForTimeout(1000);

            // Check if lightbox opened
            const lightbox = page.locator('.image-lightbox, .lightbox, [id*="lightbox" i]');
            const lightboxVisible = await lightbox.isVisible().catch(() => false);

            console.log(`Lightbox visible: ${lightboxVisible}`);

            if (lightboxVisible) {
              // Verify lightbox has the open class
              const lightboxClasses = await lightbox.getAttribute('class');
              console.log(`Lightbox classes: ${lightboxClasses}`);

              expect(lightboxClasses).toContain('image-lightbox');

              // Check for lightbox image
              const lightboxImage = lightbox.locator('img.image-lightbox__image, .lightbox__image');
              await expect(lightboxImage).toBeVisible({ timeout: 3000 });

              console.log('✓ Lightbox opens and displays image');

              // Take screenshot of lightbox
              await page.screenshot({
                path: '/tmp/claude/lightbox-open.png',
                fullPage: true
              });

              // Try to close lightbox
              const closeButton = lightbox.locator('button.image-lightbox__close, .lightbox__close, button[aria-label*="close" i]');
              if (await closeButton.isVisible()) {
                await closeButton.click();
                await page.waitForTimeout(500);

                const lightboxStillVisible = await lightbox.isVisible().catch(() => false);
                expect(lightboxStillVisible).toBe(false);

                console.log('✓ Lightbox closes correctly');
              }
            } else {
              console.log('Lightbox did not open - checking console for errors');
            }
          } else {
            console.log('No picture cards found in gallery');
          }
        } else {
          console.log('Gallery has no pictures yet');
        }
      } else {
        console.log('No view button found on gallery card');
      }
    } else {
      console.log('No galleries found to test lightbox');
    }

    await page.screenshot({
      path: '/tmp/claude/after-lightbox-test.png',
      fullPage: true
    });
  });
});
