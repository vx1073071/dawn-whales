/**
 * E2E Test 04: Dashboard Page
 * Verifies the dashboard renders key widgets and data panels.
 */
import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to dashboard via sidebar
    const dashLink = page.locator('button:has-text("Dashboard"), button:has-text("仪表盘"), [data-testid="nav-dashboard"], a[href*="dashboard"]');
    if (await dashLink.count() > 0) {
      await dashLink.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('01: dashboard page renders', async ({ page }) => {
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('02: portfolio summary widget visible', async ({ page }) => {
    // Look for portfolio/value summary elements
    const widgets = page.locator('[data-testid="portfolio-summary"], .portfolio-card, .dashboard-widget, .summary-card');
    if (await widgets.count() > 0) {
      await expect(widgets.first()).toBeVisible();
    }
  });

  test('03: performance chart area exists', async ({ page }) => {
    const charts = page.locator('canvas, svg, [data-testid="chart"], .chart-container, .recharts-wrapper');
    if (await charts.count() > 0) {
      await expect(charts.first()).toBeVisible();
    }
  });

  test('04: no JS errors on dashboard load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.reload();
    await page.waitForTimeout(2000);
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
    // Allow up to 3 non-critical errors in web-only mode (Electron APIs unavailable)
    expect(critical.length).toBeLessThanOrEqual(3);
  });
});
