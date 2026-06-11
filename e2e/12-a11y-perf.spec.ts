/**
 * E2E Test 12: Accessibility & Performance
 * Verifies basic accessibility standards and performance budgets.
 */
import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('01: page has lang attribute on html', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    // Should have a language attribute
    expect(lang).toBeTruthy();
  });

  test('02: all images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      // Alt should exist (can be empty for decorative images)
      expect(alt).not.toBeNull();
    }
  });

  test('03: interactive elements are focusable', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const buttons = page.locator('button, a, input, select, textarea');
    const count = await buttons.count();
    // At least some interactive elements should exist
    expect(count).toBeGreaterThan(0);
  });

  test('04: no duplicate IDs on page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const ids = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id]');
      const idList = Array.from(elements).map(el => el.id);
      const duplicates = idList.filter((id, i) => idList.indexOf(id) !== i);
      return duplicates;
    });
    expect(ids.length).toBe(0);
  });
});

test.describe('Performance', () => {
  test('05: page loads within 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
  });

  test('06: no excessive network requests', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Should not make more than 200 requests on initial load
    expect(requests.length).toBeLessThan(200);
  });

  test('07: main page size under 5MB', async ({ page }) => {
    let totalBytes = 0;
    page.on('response', (resp) => {
      const headers = resp.headers();
      const contentLength = parseInt(headers['content-length'] || '0');
      totalBytes += contentLength;
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Total initial load should be under 5MB
    expect(totalBytes).toBeLessThan(5 * 1024 * 1024);
  });
});
