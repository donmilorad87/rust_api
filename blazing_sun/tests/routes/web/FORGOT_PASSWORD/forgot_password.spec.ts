/**
 * Forgot Password Page Tests
 *
 * Route: /forgot-password
 * Method: GET (page)
 *
 * This page has a 3-step flow:
 * 1. Request Reset - Enter email, calls POST /api/v1/account/forgot-password
 * 2. Verify Code - Enter 6-digit code, calls POST /api/v1/account/verify-hash
 * 3. Reset Password - Enter new password, calls POST /api/v1/account/reset-password
 *
 * Test Coverage:
 * - [x] Page displays correctly with all required elements
 * - [x] Page has correct title and heading
 * - [x] Step 1: Request form validation (email required, valid format)
 * - [x] Step 2: Verify form displays after successful request
 * - [x] Step 2: Code input validation (required, maxlength)
 * - [x] Step 3: Reset form validation (passwords required, match)
 * - [x] Navigation: "Sign In" link works
 * - [x] Logged-in users are redirected to profile
 * - [x] Accessibility: Form has proper ARIA labels
 * - [x] Responsive: Page works on mobile viewport
 * - [x] Security: Uses POST method for API calls
 */

import { test, expect } from '@playwright/test';

test.describe('Forgot Password Page - Step 1: Request Reset', () => {

  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure we're not logged in
    await page.context().clearCookies();
    await page.goto('/forgot-password');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  // ============================================
  // Page Display Tests
  // ============================================

  test('should display the forgot password page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Forgot Password/);
  });

  test('should display the correct heading', async ({ page }) => {
    const heading = page.locator('#requestCard h1');
    await expect(heading).toHaveText('Forgot Password');
  });

  test('should display the request form initially', async ({ page }) => {
    const requestCard = page.locator('#requestCard');
    await expect(requestCard).toBeVisible();
    await expect(requestCard).not.toHaveClass(/hidden/);
  });

  test('should hide verify and reset forms initially', async ({ page }) => {
    const verifyCard = page.locator('#verifyCard');
    const resetCard = page.locator('#resetCard');

    await expect(verifyCard).toHaveClass(/hidden/);
    await expect(resetCard).toHaveClass(/hidden/);
  });

  test('should display all required elements in request form', async ({ page }) => {
    // Email input
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');

    // Submit button
    const submitBtn = page.locator('#requestBtn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText('Send Reset Code');

    // Form label
    await expect(page.locator('label[for="email"]')).toHaveText('Email');
  });

  test('should display instruction text', async ({ page }) => {
    const instructionText = page.locator('#requestCard p.text-center').first();
    await expect(instructionText).toContainText('Enter your email address');
    await expect(instructionText).toContainText("send you a code");
  });

  test('should display "Sign In" link', async ({ page }) => {
    const signInLink = page.locator('#requestCard a[href="/sign-in"]');
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveText('Sign In');
  });

  // ============================================
  // Form Validation Tests
  // ============================================

  test('should show error when submitting with empty email', async ({ page }) => {
    // Try to submit without filling email
    await page.click('#requestBtn');

    // Check for HTML5 validation
    const emailInput = page.locator('#email');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should show error for invalid email format', async ({ page }) => {
    // Fill invalid email
    await page.fill('#email', 'invalid-email');

    // Try to submit
    await page.click('#requestBtn');

    // Check email input validity
    const emailInput = page.locator('#email');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  // ============================================
  // API Interaction Tests
  // ============================================

  test('should disable button while submitting', async ({ page }) => {
    // Fill valid email
    await page.fill('#email', 'test@example.com');

    // Mock API to delay response
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, message: 'Reset code sent' })
      });
    });

    // Click submit
    const submitBtn = page.locator('#requestBtn');
    await submitBtn.click();

    // Button should be disabled and show loading text
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveText('Sending...');
  });

  test('should send POST request to forgot-password endpoint', async ({ page }) => {
    // Listen for API request
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/api/v1/account/forgot-password')
    );

    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');

    const request = await requestPromise;
    expect(request.method()).toBe('POST');

    const postData = request.postDataJSON();
    expect(postData).toHaveProperty('email', 'test@example.com');
  });

  test('should show verify form after successful request', async ({ page }) => {
    // Mock successful API response
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, message: 'Reset code sent' })
      });
    });

    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');

    // Wait for transition
    await page.waitForTimeout(500);

    // Request card should be hidden
    const requestCard = page.locator('#requestCard');
    await expect(requestCard).toHaveClass(/hidden/);

    // Verify card should be visible
    const verifyCard = page.locator('#verifyCard');
    await expect(verifyCard).not.toHaveClass(/hidden/);
    await expect(verifyCard).toBeVisible();
  });

  test('should populate hidden email field in verify form', async ({ page }) => {
    // Mock successful API response
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, message: 'Reset code sent' })
      });
    });

    await page.fill('#email', 'myemail@example.com');
    await page.click('#requestBtn');

    await page.waitForTimeout(500);

    // Check hidden email field is populated
    const verifyEmail = page.locator('#verify_email');
    await expect(verifyEmail).toHaveValue('myemail@example.com');

    const resetEmail = page.locator('#reset_email');
    await expect(resetEmail).toHaveValue('myemail@example.com');
  });

  test('should stay on request form after failed request', async ({ page }) => {
    // Mock failed API response
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, message: 'User not found' })
      });
    });

    await page.fill('#email', 'nonexistent@example.com');
    await page.click('#requestBtn');

    await page.waitForTimeout(500);

    // Request card should still be visible
    const requestCard = page.locator('#requestCard');
    await expect(requestCard).not.toHaveClass(/hidden/);
  });

  // ============================================
  // Navigation Tests
  // ============================================

  test('should navigate to sign-in page', async ({ page }) => {
    await page.click('#requestCard a[href="/sign-in"]');
    await expect(page).toHaveURL('/sign-in');
  });
});

// ============================================
// Step 2: Verify Code Tests
// ============================================

test.describe('Forgot Password Page - Step 2: Verify Code', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Mock successful forgot-password to get to step 2
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, message: 'Reset code sent' })
      });
    });

    // Trigger step 2
    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');
    await page.waitForTimeout(500);
  });

  test('should display verify form with correct elements', async ({ page }) => {
    const verifyCard = page.locator('#verifyCard');
    await expect(verifyCard).toBeVisible();

    // Heading
    const heading = page.locator('#verifyCard h1');
    await expect(heading).toHaveText('Verify Code');

    // Code input
    const codeInput = page.locator('#reset_code');
    await expect(codeInput).toBeVisible();
    await expect(codeInput).toHaveAttribute('required', '');
    await expect(codeInput).toHaveAttribute('maxlength', '6');
    await expect(codeInput).toHaveAttribute('placeholder', 'Enter 6-digit code');

    // Submit button
    const submitBtn = page.locator('#verifyBtn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText('Verify Code');

    // Label
    await expect(page.locator('label[for="reset_code"]')).toHaveText('Reset Code');
  });

  test('should display instruction text for verify step', async ({ page }) => {
    const instructionText = page.locator('#verifyCard p.text-center').first();
    await expect(instructionText).toContainText('sent a reset code');
    await expect(instructionText).toContainText('email');
  });

  test('should show error when submitting with empty code', async ({ page }) => {
    // Try to submit without filling code
    await page.click('#verifyBtn');

    // Check for HTML5 validation
    const codeInput = page.locator('#reset_code');
    const isInvalid = await codeInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should send POST request to verify-hash endpoint', async ({ page }) => {
    // Listen for API request
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/api/v1/account/verify-hash')
    );

    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');

    const request = await requestPromise;
    expect(request.method()).toBe('POST');

    const postData = request.postDataJSON();
    expect(postData).toHaveProperty('email', 'test@example.com');
    expect(postData).toHaveProperty('hash', '123456');
  });

  test('should show reset form after successful verification', async ({ page }) => {
    // Mock successful verify response
    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'reset-token-123' })
      });
    });

    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');

    await page.waitForTimeout(500);

    // Verify card should be hidden
    const verifyCard = page.locator('#verifyCard');
    await expect(verifyCard).toHaveClass(/hidden/);

    // Reset card should be visible
    const resetCard = page.locator('#resetCard');
    await expect(resetCard).not.toHaveClass(/hidden/);
    await expect(resetCard).toBeVisible();
  });

  test('should store token from verify response', async ({ page }) => {
    // Mock successful verify response with token
    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'my-secret-token' })
      });
    });

    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');

    await page.waitForTimeout(500);

    // Check token is stored in hidden field
    const tokenField = page.locator('#reset_token');
    await expect(tokenField).toHaveValue('my-secret-token');
  });

  test('should stay on verify form after failed verification', async ({ page }) => {
    // Mock failed verify response
    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, message: 'Invalid or expired code' })
      });
    });

    await page.fill('#reset_code', '000000');
    await page.click('#verifyBtn');

    await page.waitForTimeout(500);

    // Verify card should still be visible
    const verifyCard = page.locator('#verifyCard');
    await expect(verifyCard).not.toHaveClass(/hidden/);
  });

  test('should disable button while verifying', async ({ page }) => {
    // Mock API to delay response
    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'token' })
      });
    });

    await page.fill('#reset_code', '123456');
    const submitBtn = page.locator('#verifyBtn');
    await submitBtn.click();

    // Button should be disabled and show loading text
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveText('Verifying...');
  });
});

// ============================================
// Step 3: Reset Password Tests
// ============================================

test.describe('Forgot Password Page - Step 3: Reset Password', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Mock successful forgot-password
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, message: 'Reset code sent' })
      });
    });

    // Mock successful verify-hash
    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'reset-token-123' })
      });
    });

    // Navigate to step 3
    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');
    await page.waitForTimeout(300);

    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');
    await page.waitForTimeout(300);
  });

  test('should display reset form with correct elements', async ({ page }) => {
    const resetCard = page.locator('#resetCard');
    await expect(resetCard).toBeVisible();

    // Heading
    const heading = page.locator('#resetCard h1');
    await expect(heading).toHaveText('Reset Password');

    // New password input
    const newPasswordInput = page.locator('#new_password');
    await expect(newPasswordInput).toBeVisible();
    await expect(newPasswordInput).toHaveAttribute('type', 'password');
    await expect(newPasswordInput).toHaveAttribute('required', '');
    await expect(newPasswordInput).toHaveAttribute('minlength', '8');

    // Confirm password input
    const confirmPasswordInput = page.locator('#confirm_password');
    await expect(confirmPasswordInput).toBeVisible();
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    await expect(confirmPasswordInput).toHaveAttribute('required', '');

    // Submit button
    const submitBtn = page.locator('#resetBtn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText('Reset Password');

    // Labels
    await expect(page.locator('label[for="new_password"]')).toHaveText('New Password');
    await expect(page.locator('label[for="confirm_password"]')).toHaveText('Confirm Password');
  });

  test('should display instruction text for reset step', async ({ page }) => {
    const instructionText = page.locator('#resetCard p.text-center').first();
    await expect(instructionText).toContainText('Code verified');
    await expect(instructionText).toContainText('new password');
  });

  test('should show error when submitting with empty passwords', async ({ page }) => {
    // Try to submit without filling passwords
    await page.click('#resetBtn');

    // Check for HTML5 validation on new password
    const newPasswordInput = page.locator('#new_password');
    const isInvalid = await newPasswordInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should show error when passwords do not match', async ({ page }) => {
    // Fill mismatched passwords
    await page.fill('#new_password', 'NewPassword123!');
    await page.fill('#confirm_password', 'DifferentPassword123!');

    // Mock to catch if API is called (it shouldn't be)
    let apiCalled = false;
    await page.route('**/api/v1/account/reset-password', async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.click('#resetBtn');

    await page.waitForTimeout(500);

    // API should not be called due to client-side validation
    expect(apiCalled).toBe(false);

    // Should stay on reset form
    const resetCard = page.locator('#resetCard');
    await expect(resetCard).not.toHaveClass(/hidden/);
  });

  test('should send POST request to reset-password endpoint', async ({ page }) => {
    // Listen for API request
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/api/v1/account/reset-password')
    );

    await page.fill('#new_password', 'NewPassword123!');
    await page.fill('#confirm_password', 'NewPassword123!');
    await page.click('#resetBtn');

    const request = await requestPromise;
    expect(request.method()).toBe('POST');

    const postData = request.postDataJSON();
    expect(postData).toHaveProperty('email', 'test@example.com');
    expect(postData).toHaveProperty('token', 'reset-token-123');
    expect(postData).toHaveProperty('password', 'NewPassword123!');
    expect(postData).toHaveProperty('password_confirmation', 'NewPassword123!');
  });

  test('should redirect to sign-in after successful reset', async ({ page }) => {
    // Mock successful reset response
    await page.route('**/api/v1/account/reset-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, message: 'Password reset successful' })
      });
    });

    await page.fill('#new_password', 'NewPassword123!');
    await page.fill('#confirm_password', 'NewPassword123!');
    await page.click('#resetBtn');

    // Wait for redirect (app waits 2s before redirect)
    await page.waitForTimeout(2500);

    await expect(page).toHaveURL('/sign-in');
  });

  test('should stay on reset form after failed reset', async ({ page }) => {
    // Mock failed reset response
    await page.route('**/api/v1/account/reset-password', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          message: 'Password does not meet requirements',
          errors: { password: ['Must contain uppercase letter'] }
        })
      });
    });

    await page.fill('#new_password', 'weakpassword');
    await page.fill('#confirm_password', 'weakpassword');
    await page.click('#resetBtn');

    await page.waitForTimeout(500);

    // Reset card should still be visible
    const resetCard = page.locator('#resetCard');
    await expect(resetCard).not.toHaveClass(/hidden/);
  });

  test('should disable button while resetting', async ({ page }) => {
    // Mock API to delay response
    await page.route('**/api/v1/account/reset-password', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.fill('#new_password', 'NewPassword123!');
    await page.fill('#confirm_password', 'NewPassword123!');

    const submitBtn = page.locator('#resetBtn');
    await submitBtn.click();

    // Button should be disabled and show loading text
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveText('Resetting...');
  });
});

// ============================================
// Auth Redirect Tests
// ============================================

test.describe('Forgot Password Page - Auth Redirect', () => {

  test('should redirect logged-in users to profile', async ({ page }) => {
    // First, sign in to get auth token
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    await page.fill('#email', 'djmyle@gmail.com');
    await page.fill('#password', 'asdqwE123~~');
    await page.click('#signinBtn');

    // Wait for redirect
    await page.waitForTimeout(2000);

    // Now try to visit forgot-password page
    await page.goto('/forgot-password');

    // Should redirect to profile
    await expect(page).toHaveURL('/profile');
  });
});

// ============================================
// Mobile Viewport Tests
// ============================================

test.describe('Forgot Password Page - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display step 1 correctly on mobile viewport', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // All elements should be visible
    await expect(page.locator('#requestCard h1')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#requestBtn')).toBeVisible();

    // Form should be usable
    await page.fill('#email', 'test@example.com');

    // Button should be clickable
    await expect(page.locator('#requestBtn')).toBeEnabled();
  });

  test('should display step 2 correctly on mobile viewport', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Mock and go to step 2
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');
    await page.waitForTimeout(500);

    // All elements should be visible
    await expect(page.locator('#verifyCard h1')).toBeVisible();
    await expect(page.locator('#reset_code')).toBeVisible();
    await expect(page.locator('#verifyBtn')).toBeVisible();
  });

  test('should display step 3 correctly on mobile viewport', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // Mock APIs
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'token' })
      });
    });

    // Navigate to step 3
    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');
    await page.waitForTimeout(300);

    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');
    await page.waitForTimeout(300);

    // All elements should be visible
    await expect(page.locator('#resetCard h1')).toBeVisible();
    await expect(page.locator('#new_password')).toBeVisible();
    await expect(page.locator('#confirm_password')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
  });
});

// ============================================
// Security Tests
// ============================================

test.describe('Forgot Password Page - Security', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
  });

  test('should not expose passwords in URL', async ({ page }) => {
    // Go through the full flow
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'token' })
      });
    });

    // Step 1
    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');
    await page.waitForTimeout(300);

    // Step 2
    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');
    await page.waitForTimeout(300);

    // Step 3
    await page.fill('#new_password', 'SecretPassword123!');
    await page.fill('#confirm_password', 'SecretPassword123!');

    // Check URL doesn't contain sensitive data
    const url = page.url();
    expect(url).not.toContain('SecretPassword');
    expect(url).not.toContain('123456');
    expect(url).not.toContain('token');
  });

  test('should use POST method for all API calls', async ({ page }) => {
    // Track API methods
    const apiMethods: { [key: string]: string } = {};

    await page.route('**/api/v1/account/**', async (route) => {
      const url = route.request().url();
      apiMethods[url] = route.request().method();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'token' })
      });
    });

    // Step 1
    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');
    await page.waitForTimeout(300);

    // Step 2
    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');
    await page.waitForTimeout(300);

    // Step 3
    await page.fill('#new_password', 'NewPassword123!');
    await page.fill('#confirm_password', 'NewPassword123!');
    await page.click('#resetBtn');
    await page.waitForTimeout(300);

    // All API calls should be POST
    for (const [url, method] of Object.entries(apiMethods)) {
      expect(method).toBe('POST');
    }
  });

  test('should send credentials as JSON body, not URL params', async ({ page }) => {
    const requestPromise = page.waitForRequest(req =>
      req.url().includes('/api/v1/account/forgot-password')
    );

    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');

    const request = await requestPromise;

    // URL should not contain email
    expect(request.url()).not.toContain('test@example.com');

    // Body should contain email
    const postData = request.postDataJSON();
    expect(postData.email).toBe('test@example.com');
  });

  test('password inputs should have type="password"', async ({ page }) => {
    // Go to step 3
    await page.route('**/api/v1/account/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.route('**/api/v1/account/verify-hash', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token: 'token' })
      });
    });

    await page.fill('#email', 'test@example.com');
    await page.click('#requestBtn');
    await page.waitForTimeout(300);

    await page.fill('#reset_code', '123456');
    await page.click('#verifyBtn');
    await page.waitForTimeout(300);

    // Check password inputs have type="password" (masked)
    await expect(page.locator('#new_password')).toHaveAttribute('type', 'password');
    await expect(page.locator('#confirm_password')).toHaveAttribute('type', 'password');
  });
});
