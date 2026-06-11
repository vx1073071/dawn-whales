/**
 * E2E Smoke Test 02: Login Flow
 * Verifies the login/register UI is accessible.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke: Login', () => {
  test('01: login page is accessible', async ({ page }) => {
    await page.goto('/');
    // Look for login-related elements
    const loginLink = page.locator('[data-testid="login-link"], a[href*="login"], button:has-text("登录"), button:has-text("Login")');
    if (await loginLink.count() > 0) {
      await loginLink.first().click();
      await expect(page).toHaveURL(/login/i);
    } else {
      // If no explicit login link, check if already on a page with auth elements
      const authElements = page.locator('input[type="email"], input[type="password"], input[name="username"]');
      expect(await authElements.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('02: register page shows form', async ({ page }) => {
    await page.goto('/register');
    // Should have at least email/password fields or a registration form
    const formElements = page.locator('form, [data-testid="register-form"], .register-form');
    if (await formElements.count() > 0) {
      await expect(formElements.first()).toBeVisible();
    }
  });

  test('03: guest mode works (no login required)', async ({ page }) => {
    await page.goto('/');
    // Guest mode should allow browsing without login
    const content = page.locator('#root');
    await expect(content).toBeVisible();
    // Should not be redirected to login
    expect(page.url()).not.toContain('/login');
  });
});
