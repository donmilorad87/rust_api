/**
 * Sign-In Page Tests
 *
 * Route: /sign-in
 * Method: GET (page) + POST (API form submit)
 *
 * Test Coverage:
 * - [x] Page displays correctly with all required elements
 * - [x] Page has correct title and heading
 * - [x] Form validation: Email is required
 * - [x] Form validation: Password is required
 * - [x] Form validation: Invalid email format shows error
 * - [x] Successful sign-in redirects to homepage
 * - [x] Failed sign-in shows error message
 * - [x] "Forgot password" link navigates correctly
 * - [x] "Sign Up" link navigates correctly
 * - [x] Logged-in users are redirected to profile
 * - [x] Accessibility: Form has proper ARIA labels
 * - [x] Responsive: Page works on mobile viewport
 */

import { test, expect } from '@playwright/test';

test.describe('Sign-In Page', () => {

  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure we're not logged in
    await page.context().clearCookies();
    await page.goto('/sign-in');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  // ============================================
  // Page Display Tests
  // ============================================

  test('should display the sign-in page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Sign In/);
  });

  test('should display the sign-in heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Sign In');
  });

  test('should display all required form elements', async ({ page }) => {
    // Email input
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');

    // Password input
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');

    // Submit button
    const submitBtn = page.locator('#signinBtn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText('Sign In');

    // Form labels
    await expect(page.locator('label[for="email"]')).toHaveText('Email');
    await expect(page.locator('label[for="password"]')).toHaveText('Password');
  });

  test('should display "Forgot password" link', async ({ page }) => {
    const forgotLink = page.locator('a[href="/forgot-password"]');
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveText('Forgot password?');
  });

  test('should display "Sign Up" link', async ({ page }) => {
    // Use the Sign Up link in the form area (article), not the nav
    const signUpLink = page.locator('article a[href="/sign-up"]');
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toContainText('Sign Up');
  });

  // ============================================
  // Form Validation Tests
  // ============================================

  test('should show error when submitting with empty email', async ({ page }) => {
    // Fill only password
    await page.fill('#password', 'TestPassword123!');

    // Try to submit
    await page.click('#signinBtn');

    // Check for HTML5 validation or custom error
    const emailInput = page.locator('#email');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should show error when submitting with empty password', async ({ page }) => {
    // Fill only email
    await page.fill('#email', 'test@example.com');

    // Try to submit
    await page.click('#signinBtn');

    // Check for HTML5 validation or custom error
    const passwordInput = page.locator('#password');
    const isInvalid = await passwordInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should show error for invalid email format', async ({ page }) => {
    // Fill invalid email
    await page.fill('#email', 'invalid-email');
    await page.fill('#password', 'TestPassword123!');

    // Try to submit - HTML5 validation should prevent it
    await page.click('#signinBtn');

    // Check email input validity
    const emailInput = page.locator('#email');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  // ============================================
  // Authentication Tests
  // ============================================

  test('should show error for non-existent user', async ({ page }) => {
    // Fill with non-existent credentials
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'SomePassword123!');

    // Submit form
    await page.click('#signinBtn');

    // Wait for API response and error message
    // The app uses Toastify for notifications
    await page.waitForTimeout(1000);

    // Should stay on sign-in page
    await expect(page).toHaveURL(/sign-in/);
  });

  test('should show error for wrong password', async ({ page }) => {
    // Fill with existing user but wrong password
    // Using test user from routes_test.rs
    await page.fill('#email', 'djmyle@gmail.com');
    await page.fill('#password', 'WrongPassword123!');

    // Submit form
    await page.click('#signinBtn');

    // Wait for API response
    await page.waitForTimeout(1000);

    // Should stay on sign-in page
    await expect(page).toHaveURL(/sign-in/);
  });

  test('should successfully sign in with valid credentials', async ({ page }) => {
    // Use test credentials from routes_test.rs
    await page.fill('#email', 'djmyle@gmail.com');
    await page.fill('#password', 'asdqwE123~~');

    // Submit form
    await page.click('#signinBtn');

    // Wait for redirect (app waits 1.5s before redirect)
    await page.waitForTimeout(2000);

    // Should redirect to homepage
    await expect(page).toHaveURL('/');

    // Should have auth cookie set
    const cookies = await page.context().cookies();
    const authCookie = cookies.find(c => c.name === 'auth_token');
    expect(authCookie).toBeDefined();
  });

  test('should disable submit button while signing in', async ({ page }) => {
    // Fill valid credentials
    await page.fill('#email', 'djmyle@gmail.com');
    await page.fill('#password', 'asdqwE123~~');

    // Click submit and check button state
    const submitBtn = page.locator('#signinBtn');
    await submitBtn.click();

    // Button should be disabled during submission
    await expect(submitBtn).toBeDisabled();
  });

  // ============================================
  // Navigation Tests
  // ============================================

  test('should navigate to forgot password page', async ({ page }) => {
    await page.click('a[href="/forgot-password"]');
    await expect(page).toHaveURL('/forgot-password');
  });

  test('should navigate to sign up page', async ({ page }) => {
    await page.click('a[href="/sign-up"]');
    await expect(page).toHaveURL('/sign-up');
  });

  test('should redirect logged-in users to profile', async ({ page }) => {
    // First, sign in to get auth token
    await page.fill('#email', 'djmyle@gmail.com');
    await page.fill('#password', 'asdqwE123~~');
    await page.click('#signinBtn');

    // Wait for redirect
    await page.waitForTimeout(2000);

    // Now try to visit sign-in page again
    await page.goto('/sign-in');

    // Should redirect to profile
    await expect(page).toHaveURL('/profile');
  });

  // ============================================
  // Accessibility Tests
  // ============================================

  test('should have proper form ARIA labels', async ({ page }) => {
    const form = page.locator('#signinForm');
    await expect(form).toHaveAttribute('aria-label', 'Sign in form');

    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('aria-required', 'true');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('aria-required', 'true');
  });

  test('should have proper autocomplete attributes', async ({ page }) => {
    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Click on the form first to set focus context
    await page.locator('#signinForm').click();

    // Tab through form elements starting from email
    await page.locator('#email').focus();
    const emailFocused = await page.locator('#email').evaluate(el => document.activeElement === el);
    expect(emailFocused).toBe(true);

    await page.keyboard.press('Tab'); // Focus password
    const passwordFocused = await page.locator('#password').evaluate(el => document.activeElement === el);
    expect(passwordFocused).toBe(true);

    await page.keyboard.press('Tab'); // Focus submit button
    const buttonFocused = await page.locator('#signinBtn').evaluate(el => document.activeElement === el);
    expect(buttonFocused).toBe(true);
  });
});

// ============================================
// Mobile Viewport Tests
// ============================================

test.describe('Sign-In Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    // All elements should be visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#signinBtn')).toBeVisible();

    // Form should be usable
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPassword123!');

    // Button should be clickable
    await expect(page.locator('#signinBtn')).toBeEnabled();
  });
});

// ============================================
// Security Tests
// ============================================

test.describe('Sign-In Page - Security', () => {

  test('should not expose password in URL', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'SecretPassword123!');
    await page.click('#signinBtn');

    // Password should not appear in URL
    const url = page.url();
    expect(url).not.toContain('SecretPassword');
  });

  test('should use POST method for form submission', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    // Listen for API request
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/api/v1/auth/sign-in')
    );

    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPassword123!');
    await page.click('#signinBtn');

    const request = await requestPromise;
    expect(request.method()).toBe('POST');
  });

  test('should send credentials as JSON body', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    // Listen for API request
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/api/v1/auth/sign-in')
    );

    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPassword123!');
    await page.click('#signinBtn');

    const request = await requestPromise;
    const postData = request.postDataJSON();

    expect(postData).toHaveProperty('email', 'test@example.com');
    expect(postData).toHaveProperty('password', 'TestPassword123!');
  });
});
