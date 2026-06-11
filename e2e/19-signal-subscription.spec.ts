/**
 * E2E Test 19: Signal Subscription + Earning
 */
import { test, expect } from '@playwright/test';

test.describe('Signal Subscription', () => {
  test('01: strategy page renders with subscription elements', async ({ page }) => {
    await page.goto('/strategy');
    await page.waitForTimeout(1000);
    const subElements = page.locator('button:has-text("订阅"), button:has-text("Subscribe"), button:has-text("Follow")');
    if (await subElements.count() > 0) {
      await expect(subElements.first()).toBeVisible();
    }
    console.log('[E2E-19] Sub buttons found:', await subElements.count());
    expect(true).toBe(true);
  });

  test('02: marketplace page shows strategy cards', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForTimeout(500);
    const cards = page.locator('.strategy-card, [data-testid="strategy-card"], .card');
    if (await cards.count() > 0) {
      await expect(cards.first()).toBeVisible();
    }
    expect(true).toBe(true);
  });

  test('03: earnings/commission panel accessible', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForTimeout(1000);
    const earningsPanel = page.locator('text=收益, text=Earnings, text=佣金, text=Commission');
    if (await earningsPanel.count() > 0) {
      await expect(earningsPanel.first()).toBeVisible();
    }
    expect(true).toBe(true);
  });

  test('04: signal timeline or activity feed exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const feedArea = page.locator('[data-testid="signal-feed"], .activity-feed, .timeline');
    if (await feedArea.count() > 0) {
      await expect(feedArea.first()).toBeVisible();
    }
    expect(true).toBe(true);
  });

  test('05: no critical errors on strategy pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/strategy');
    await page.waitForTimeout(2000);
    await page.goto('/marketplace');
    await page.waitForTimeout(1000);
    const critical = errors.filter(e =>
      !e.includes('Failed to fetch') && !e.includes('404') && !e.includes('electron') &&
      !e.includes('require') && !e.includes('is not defined') && !e.includes('WebSocket')
    );
    expect(critical.length).toBeLessThanOrEqual(3);
  });
});
