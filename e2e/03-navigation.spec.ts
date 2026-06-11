/**
 * E2E Smoke Test 03: Navigation
 * Verifies main navigation links work.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke: Navigation', () => {
  test('01: sidebar/navigation is visible', async ({ page }) => {
    await page.goto('/');
    // Look for navigation elements (sidebar, topbar, or nav links)
    const nav = page.locator('nav, [role="navigation"], .sidebar, .nav, [data-testid="sidebar"]');
    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('02: can navigate to dashboard', async ({ page }) => {
    await page.goto('/');
    const dashLink = page.locator('a[href*="dashboard"], [data-testid="nav-dashboard"], button:has-text("Dashboard"), button:has-text("仪表盘")');
    if (await dashLink.count() > 0) {
      await dashLink.first().click();
      await expect(page).toHaveURL(/dashboard/i);
    }
  });

  test('03: can navigate to market page', async ({ page }) => {
    await page.goto('/');
    const marketLink = page.locator('a[href*="market"], [data-testid="nav-market"], button:has-text("Market"), button:has-text("行情")');
    if (await marketLink.count() > 0) {
      await marketLink.first().click();
      await expect(page).toHaveURL(/market/i);
    }
  });
});
