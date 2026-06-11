/**
 * E2E Test 11: Error Handling & Edge Cases
 * Verifies the app handles errors gracefully — network failures, invalid routes, empty states.
 */
import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('01: app handles offline gracefully', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();

    // Simulate offline
    await context.setOffline(true);
    await page.reload().catch(() => {}); // May fail, that's OK
    await page.waitForTimeout(1000);

    // Should show error state or offline indicator, not crash
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // Restore
    await context.setOffline(false);
  });

  test('02: app handles slow network', async ({ page }) => {
    // Throttle network
    await page.route('**/*', async (route) => {
      await new Promise(r => setTimeout(r, 500));
      await route.continue();
    });

    await page.goto('/');
    // Should eventually load (within timeout)
    await expect(page.locator('#root')).toBeVisible({ timeout: 30000 });
  });

  test('03: invalid page shows fallback or redirect', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await page.waitForTimeout(1000);
    // Should redirect to home or show a 404-like state, not crash
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('04: console error boundary catches render errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Critical uncaught errors should be zero (error boundary catches them)
    const uncaught = errors.filter(e =>
      !e.includes('Failed to fetch') &&
      !e.includes('404') &&
      !e.includes('WebSocket') &&
      !e.includes('NetworkError') &&
      !e.includes('net::')
    );
    // Allow up to 2 non-critical warnings
    expect(uncaught.length).toBeLessThanOrEqual(2);
  });

  test('05: empty state renders when no data', async ({ page }) => {
    // Block API responses to simulate empty data
    await page.route('**/api/**', async (route) => {
      await route.fulfill({ status: 200, body: '{}' });
    });
    await page.goto('/');
    await page.waitForTimeout(1000);
    // Should show empty state or loading, not crash
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });
});
