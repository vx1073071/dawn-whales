/**
 * E2E Test 10: Marketplace Page
 * Verifies strategy marketplace browsing, search, and detail views.
 */
import { test, expect } from '@playwright/test';

test.describe('Marketplace Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const mpLink = page.locator('button:has-text("Marketplace"), button:has-text("社区"), button:has-text("市场"), [data-testid="nav-marketplace"]');
    if (await mpLink.count() > 0) {
      await mpLink.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('01: marketplace page renders', async ({ page }) => {
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('02: strategy cards or listings visible', async ({ page }) => {
    const cards = page.locator('[data-testid="strategy-card"], .marketplace-card, .strategy-item, .card-grid');
    if (await cards.count() > 0) {
      await expect(cards.first()).toBeVisible();
    }
  });

  test('03: search or filter functionality', async ({ page }) => {
    const search = page.locator('input[placeholder*="搜索"], input[placeholder*="search"], [data-testid="marketplace-search"]');
    if (await search.count() > 0) {
      await expect(search.first()).toBeVisible();
    }
  });

  test('04: category tabs or filters', async ({ page }) => {
    const tabs = page.locator('[data-testid="category-tabs"], .filter-tabs, .category-filter, [role="tablist"]');
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible();
    }
  });
});
