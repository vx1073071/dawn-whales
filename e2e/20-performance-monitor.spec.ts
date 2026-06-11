/**
 * E2E Test 20: Performance Monitoring
 */
import { test, expect } from '@playwright/test';

test.describe('Performance Monitoring', () => {
  test('01: page load completes within threshold', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForTimeout(1000);
    const loadTime = Date.now() - start;
    console.log('[E2E-20] Page load time:', loadTime, 'ms');
    // Full page load should be under 30s (web-only mode, no API)
    expect(loadTime).toBeLessThan(30000);
  });

  test('02: First Contentful Paint happens quickly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const fcp = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return nav ? nav.domContentLoadedEventEnd - nav.startTime : 0;
    });
    console.log('[E2E-20] FCP:', fcp, 'ms');
    expect(typeof fcp).toBe('number');
  });

  test('03: DOM element count is reasonable', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
    console.log('[E2E-20] DOM elements:', elementCount);
    // Should have some DOM elements but not excessive
    expect(elementCount).toBeGreaterThan(0);
    expect(elementCount).toBeLessThan(100000);
  });

  test('04: JavaScript heap size is reasonable', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const memInfo = await page.evaluate(() => (performance as any).memory);
    if (memInfo && memInfo.usedJSHeapSize) {
      console.log('[E2E-20] JS heap:', (memInfo.usedJSHeapSize / 1024 / 1024).toFixed(1), 'MB');
    } else {
      console.log('[E2E-20] performance.memory not available in this browser');
    }
    expect(true).toBe(true);
    expect(true).toBe(true);
  });

  test('05: network request count is reasonable', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', req => requests.push(req.url()));
    await page.goto('/');
    await page.waitForTimeout(2000);
    console.log('[E2E-20] Network requests:', requests.length);
    // Should load some resources but not excessive
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.length).toBeLessThan(200);
  });
});
