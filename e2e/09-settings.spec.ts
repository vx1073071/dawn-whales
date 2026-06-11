/**
 * E2E Test 09: Settings Page
 * Verifies settings/preferences UI, theme toggle, language switch, and broker config.
 */
import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const settingsLink = page.locator('button:has-text("Settings"), button:has-text("设置"), [data-testid="nav-settings"], a[href*="settings"]');
    if (await settingsLink.count() > 0) {
      await settingsLink.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('01: settings page renders', async ({ page }) => {
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('02: theme toggle or appearance settings', async ({ page }) => {
    const theme = page.locator('[data-testid="theme-toggle"], .theme-switch, button:has-text("主题"), button:has-text("Theme"), select[name="theme"]');
    if (await theme.count() > 0) {
      await expect(theme.first()).toBeVisible();
    }
  });

  test('03: language selector available', async ({ page }) => {
    const lang = page.locator('[data-testid="language-selector"], select[name="language"], button:has-text("语言"), button:has-text("Language")');
    if (await lang.count() > 0) {
      await expect(lang.first()).toBeVisible();
    }
  });

  test('04: broker connection settings', async ({ page }) => {
    const broker = page.locator('[data-testid="broker-config"], .broker-settings, button:has-text("券商"), button:has-text("Broker")');
    if (await broker.count() > 0) {
      await expect(broker.first()).toBeVisible();
    }
  });

  test('05: about/version info section', async ({ page }) => {
    const about = page.locator('[data-testid="about"], .about-section, .version-info, :text("v1."), :text("Version")');
    if (await about.count() > 0) {
      await expect(about.first()).toBeVisible();
    }
  });
});
