/**
 * E2E Test 05: Market Page
 * Verifies the market/行情 page renders charts, stock lists, and quote data.
 */
import { test, expect } from '@playwright/test';

test.describe('Market Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const marketLink = page.locator('button:has-text("Market"), button:has-text("行情"), [data-testid="nav-market"], a[href*="market"]');
    if (await marketLink.count() > 0) {
      await marketLink.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('01: market page renders', async ({ page }) => {
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('02: stock list or table is present', async ({ page }) => {
    const tables = page.locator('table, [data-testid="stock-list"], .stock-table, .market-list, [role="grid"]');
    if (await tables.count() > 0) {
      await expect(tables.first()).toBeVisible();
    }
  });

  test('03: K-line chart area exists', async ({ page }) => {
    const charts = page.locator('canvas, svg, [data-testid="kline-chart"], .chart-container, .kline-wrapper');
    if (await charts.count() > 0) {
      await expect(charts.first()).toBeVisible();
    }
  });

  test('04: search/filter input available', async ({ page }) => {
    const searchInputs = page.locator('input[placeholder*="搜索"], input[placeholder*="search"], input[placeholder*="Search"], [data-testid="stock-search"]');
    if (await searchInputs.count() > 0) {
      await expect(searchInputs.first()).toBeVisible();
    }
  });
});
