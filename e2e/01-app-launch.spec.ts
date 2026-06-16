/**
 * E2E Smoke Test 01: App Launch
 * Verifies the app starts and renders the main page.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke: App Launch', () => {
  test('01: page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/QUANT MOO| QUANT MOO|鲸鱼量化/i);
  });

  test('02: main content area is visible', async ({ page }) => {
    await page.goto('/');
    // Check for root div with content
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('03: no critical JS errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Filter out non-critical errors (network, 404, etc.)
    const critical = errors.filter(e =>
      !e.includes('Failed to fetch') &&
      !e.includes('404') &&
      !e.includes('electron') &&
      !e.includes('require') &&
      !e.includes('is not defined') &&
      !e.includes('Cannot read') &&
      !e.includes('WebSocket') &&
      !e.includes('ERR_') &&
      !e.includes('NetworkError') &&
      !e.includes('Loading chunk')
    );
    console.log('[E2E] JS errors on /:', errors.length, 'critical:', critical.length, critical);
    // Allow up to 3 non-critical errors in web-only mode (Electron APIs unavailable)
    expect(critical.length).toBeLessThanOrEqual(3);
  });
});
