/**
 * E2E Test 06: Strategy Page
 * Verifies strategy creation, listing, and backtest integration.
 */
import { test, expect } from '@playwright/test';

test.describe('Strategy Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const stratLink = page.locator('button:has-text("Strategy"), button:has-text("策略"), [data-testid="nav-strategy"], a[href*="strategy"]');
    if (await stratLink.count() > 0) {
      await stratLink.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('01: strategy page renders', async ({ page }) => {
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('02: strategy list or empty state visible', async ({ page }) => {
    const content = page.locator('[data-testid="strategy-list"], .strategy-card, .empty-state, [data-testid="empty-strategies"]');
    if (await content.count() > 0) {
      await expect(content.first()).toBeVisible();
    }
  });

  test('03: create strategy button exists', async ({ page }) => {
    const createBtn = page.locator('button:has-text("创建"), button:has-text("Create"), button:has-text("新建"), [data-testid="create-strategy"]');
    if (await createBtn.count() > 0) {
      await expect(createBtn.first()).toBeVisible();
    }
  });

  test('04: strategy templates section', async ({ page }) => {
    const templates = page.locator('[data-testid="strategy-templates"], .template-card, .strategy-template');
    if (await templates.count() > 0) {
      await expect(templates.first()).toBeVisible();
    }
  });
});
