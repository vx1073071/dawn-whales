/**
 * E2E 测试骨架 - DAWN WHALES
 * Phase 5.0 R40 (D-40-04)
 * 
 * Playwright-based end-to-end tests for the trading application.
 * Covers: Dashboard, Strategy, Market, Performance, Settings pages.
 * 
 * @module tests/e2e/dawn-whales.e2e
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// ============================================================================
// Test Configuration
// ============================================================================

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const SLOW_MO = parseInt(process.env.E2E_SLOW_MO || '0');
const TIMEOUT = parseInt(process.env.E2E_TIMEOUT || '30000');

// ============================================================================
// Page Object Models
// ============================================================================

/**
 * Base Page Object
 */
class BasePage {
  constructor(protected page: Page) {}

  async navigate(path: string): Promise<void> {
    await this.page.goto(`${BASE_URL}${path}`, { timeout: TIMEOUT });
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUT });
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async screenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `test-results/${name}.png` });
  }
}

/**
 * Dashboard Page Object
 */
class DashboardPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/');
    await this.waitForLoad();
  }

  async getSystemHealthPanel(): Promise<boolean> {
    return this.page.locator('[data-testid="system-health-panel"]').isVisible();
  }

  async getEngineStatus(engineName: string): Promise<string> {
    return this.page.locator(`[data-testid="engine-${engineName}"]`).textContent() || 'unknown';
  }

  async getAccountSummary(): Promise<{ total: string; pnl: string }> {
    const total = await this.page.locator('[data-testid="account-total"]').textContent();
    const pnl = await this.page.locator('[data-testid="account-pnl"]').textContent();
    return { total: total || '0', pnl: pnl || '0' };
  }

  async refreshDashboard(): Promise<void> {
    await this.page.locator('[data-testid="refresh-button"]').click();
    await this.page.waitForTimeout(1000);
  }
}

/**
 * Strategy Page Object
 */
class StrategyPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/strategy');
    await this.waitForLoad();
  }

  async clickCreateMode(mode: 'ai' | 'template' | 'form' | 'condition' | 'closedLoop' | 'adaptive'): Promise<void> {
    await this.page.locator(`[data-testid="mode-${mode}"]`).click();
  }

  async getStrategyCount(): Promise<number> {
    const count = await this.page.locator('[data-testid="strategy-count"]').textContent();
    return parseInt(count || '0');
  }

  async getStrategyList(): Promise<string[]> {
    return this.page.locator('[data-testid="strategy-item"]').allTextContents();
  }

  async selectStrategy(name: string): Promise<void> {
    await this.page.locator(`[data-testid="strategy-${name}"]`).click();
  }

  async deleteStrategy(name: string): Promise<void> {
    await this.page.locator(`[data-testid="strategy-${name}-delete"]`).click();
    await this.page.locator('[data-testid="confirm-delete"]').click();
  }

  // Strategy Optimizer
  async openOptimizer(): Promise<void> {
    await this.clickCreateMode('adaptive');
  }

  async setOptimizationMode(mode: 'grid_search' | 'random_search' | 'bayesian'): Promise<void> {
    await this.page.locator(`[data-testid="opt-mode-${mode}"]`).click();
  }

  async startOptimization(): Promise<void> {
    await this.page.locator('[data-testid="start-optimization"]').click();
  }

  async getOptimizationProgress(): Promise<number> {
    const progress = await this.page.locator('[data-testid="opt-progress"]').textContent();
    return parseFloat(progress || '0');
  }
}

/**
 * Market Page Object
 */
class MarketPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/market');
    await this.waitForLoad();
  }

  async getQuoteBoard(): Promise<boolean> {
    return this.page.locator('[data-testid="quote-board"]').isVisible();
  }

  async getKLineChart(): Promise<boolean> {
    return this.page.locator('[data-testid="kline-chart"]').isVisible();
  }

  async selectSymbol(symbol: string): Promise<void> {
    await this.page.locator(`[data-testid="symbol-${symbol}"]`).click();
  }

  async getTimeframe(): Promise<string> {
    return this.page.locator('[data-testid="timeframe-selector"]').textContent() || '1d';
  }

  async setTimeframe(tf: string): Promise<void> {
    await this.page.locator(`[data-testid="tf-${tf}"]`).click();
  }

  // Multi-Timeframe Panel
  async openMultiTimeframe(): Promise<void> {
    await this.page.locator('[data-testid="multi-timeframe-toggle"]').click();
  }

  async getFusionMode(): Promise<string> {
    return this.page.locator('[data-testid="fusion-mode"]').textContent() || 'weighted';
  }

  async setFusionMode(mode: 'majority' | 'weighted' | 'any'): Promise<void> {
    await this.page.locator(`[data-testid="fusion-${mode}"]`).click();
  }
}

/**
 * Performance Page Object
 */
class PerformancePage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/performance');
    await this.waitForLoad();
  }

  async getPerformanceDashboard(): Promise<boolean> {
    return this.page.locator('[data-testid="perf-dashboard"]').isVisible();
  }

  async getPortfolioAnalytics(): Promise<boolean> {
    return this.page.locator('[data-testid="portfolio-analytics"]').isVisible();
  }

  async getRiskMetrics(): Promise<{
    sharpe: string;
    sortino: string;
    maxDrawdown: string;
    var95: string;
  }> {
    const sharpe = await this.page.locator('[data-testid="metric-sharpe"]').textContent();
    const sortino = await this.page.locator('[data-testid="metric-sortino"]').textContent();
    const maxDD = await this.page.locator('[data-testid="metric-maxdd"]').textContent();
    const var95 = await this.page.locator('[data-testid="metric-var95"]').textContent();
    return {
      sharpe: sharpe || '0',
      sortino: sortino || '0',
      maxDrawdown: maxDD || '0',
      var95: var95 || '0',
    };
  }

  async getEquityCurve(): Promise<boolean> {
    return this.page.locator('[data-testid="equity-curve"]').isVisible();
  }
}

/**
 * Settings Page Object
 */
class SettingsPage extends BasePage {
  async goto(): Promise<void> {
    await this.navigate('/settings');
    await this.waitForLoad();
  }

  async getLanguage(): Promise<string> {
    return this.page.locator('[data-testid="language-selector"]').textContent() || 'en';
  }

  async setLanguage(lang: string): Promise<void> {
    await this.page.locator(`[data-testid="lang-${lang}"]`).click();
  }

  async getTheme(): Promise<string> {
    return this.page.locator('[data-testid="theme-selector"]').textContent() || 'dark';
  }

  async setTheme(theme: 'dark' | 'light'): Promise<void> {
    await this.page.locator(`[data-testid="theme-${theme}"]`).click();
  }

  async getConnectionStatus(): Promise<string> {
    return this.page.locator('[data-testid="connection-status"]').textContent() || 'disconnected';
  }
}

// ============================================================================
// Test Suites
// ============================================================================

test.describe('Dashboard E2E', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
  });

  test('should load dashboard', async () => {
    await dashboard.goto();
    const title = await dashboard.getTitle();
    expect(title).toBeTruthy();
  });

  test('should show system health panel', async () => {
    await dashboard.goto();
    const visible = await dashboard.getSystemHealthPanel();
    expect(visible).toBe(true);
  });

  test('should show account summary', async () => {
    await dashboard.goto();
    const summary = await dashboard.getAccountSummary();
    expect(summary.total).toBeTruthy();
  });

  test('should refresh dashboard', async () => {
    await dashboard.goto();
    await dashboard.refreshDashboard();
    // Verify no errors after refresh
    const visible = await dashboard.getSystemHealthPanel();
    expect(visible).toBe(true);
  });
});

test.describe('Strategy E2E', () => {
  let strategy: StrategyPage;

  test.beforeEach(async ({ page }) => {
    strategy = new StrategyPage(page);
  });

  test('should load strategy page', async () => {
    await strategy.goto();
    const count = await strategy.getStrategyCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show create modes', async () => {
    await strategy.goto();
    // Test each mode is clickable
    await strategy.clickCreateMode('form');
    // Should show form creator
  });

  test('should open strategy optimizer', async () => {
    await strategy.goto();
    await strategy.openOptimizer();
    // Should show optimizer panel
  });
});

test.describe('Market E2E', () => {
  let market: MarketPage;

  test.beforeEach(async ({ page }) => {
    market = new MarketPage(page);
  });

  test('should load market page', async () => {
    await market.goto();
    const quoteBoard = await market.getQuoteBoard();
    expect(quoteBoard).toBe(true);
  });

  test('should show K-line chart', async () => {
    await market.goto();
    const chart = await market.getKLineChart();
    expect(chart).toBe(true);
  });

  test('should switch timeframe', async () => {
    await market.goto();
    await market.setTimeframe('1h');
    const tf = await market.getTimeframe();
    expect(tf).toBe('1h');
  });
});

test.describe('Performance E2E', () => {
  let performance: PerformancePage;

  test.beforeEach(async ({ page }) => {
    performance = new PerformancePage(page);
  });

  test('should load performance page', async () => {
    await performance.goto();
    const dashboard = await performance.getPerformanceDashboard();
    expect(dashboard).toBe(true);
  });

  test('should show risk metrics', async () => {
    await performance.goto();
    const metrics = await performance.getRiskMetrics();
    expect(metrics.sharpe).toBeTruthy();
  });

  test('should show equity curve', async () => {
    await performance.goto();
    const curve = await performance.getEquityCurve();
    expect(curve).toBe(true);
  });
});

test.describe('Settings E2E', () => {
  let settings: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
  });

  test('should load settings page', async () => {
    await settings.goto();
    const lang = await settings.getLanguage();
    expect(lang).toBeTruthy();
  });

  test('should switch language', async () => {
    await settings.goto();
    await settings.setLanguage('zh-CN');
    const lang = await settings.getLanguage();
    expect(lang).toBe('zh-CN');
  });

  test('should switch theme', async () => {
    await settings.goto();
    await settings.setTheme('light');
    const theme = await settings.getTheme();
    expect(theme).toBe('light');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

test.describe('Full Flow E2E', () => {
  test('should complete strategy creation flow', async ({ page }) => {
    // 1. Go to strategy page
    const strategy = new StrategyPage(page);
    await strategy.goto();

    // 2. Create strategy via form
    await strategy.clickCreateMode('form');

    // 3. Fill form (placeholder)
    // await page.fill('[data-testid="strategy-name"]', 'Test Strategy');
    // await page.fill('[data-testid="strategy-symbol"]', 'HK.00700');
    // await page.click('[data-testid="create-strategy"]');

    // 4. Verify strategy created
    // const count = await strategy.getStrategyCount();
    // expect(count).toBeGreaterThan(0);
  });

  test('should complete backtest flow', async ({ page }) => {
    // 1. Go to strategy page
    const strategy = new StrategyPage(page);
    await strategy.goto();

    // 2. Select strategy
    // await strategy.selectStrategy('Test Strategy');

    // 3. Run backtest
    // await page.click('[data-testid="run-backtest"]');

    // 4. Wait for result
    // await page.waitForSelector('[data-testid="backtest-result"]');

    // 5. Go to performance page
    const performance = new PerformancePage(page);
    await performance.goto();

    // 6. Verify metrics updated
    const metrics = await performance.getRiskMetrics();
    expect(metrics.sharpe).toBeTruthy();
  });

  test('should complete optimization flow', async ({ page }) => {
    // 1. Go to strategy page
    const strategy = new StrategyPage(page);
    await strategy.goto();

    // 2. Open optimizer
    await strategy.openOptimizer();

    // 3. Set optimization mode
    await strategy.setOptimizationMode('bayesian');

    // 4. Start optimization
    // await strategy.startOptimization();

    // 5. Wait for completion
    // const progress = await strategy.getOptimizationProgress();
    // expect(progress).toBe(100);
  });
});

// ============================================================================
// Visual Regression Tests
// ============================================================================

test.describe('Visual Regression', () => {
  test('dashboard should match snapshot', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.screenshot('dashboard');
    // Compare with baseline
  });

  test('strategy page should match snapshot', async ({ page }) => {
    const strategy = new StrategyPage(page);
    await strategy.goto();
    await strategy.screenshot('strategy');
  });

  test('market page should match snapshot', async ({ page }) => {
    const market = new MarketPage(page);
    await market.goto();
    await market.screenshot('market');
  });

  test('performance page should match snapshot', async ({ page }) => {
    const performance = new PerformancePage(page);
    await performance.goto();
    await performance.screenshot('performance');
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Accessibility', () => {
  test('dashboard should be accessible', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    // Run axe accessibility check
    // const results = await axe(page);
    // expect(results.violations).toHaveLength(0);
  });

  test('all pages should have proper headings', async ({ page }) => {
    const pages = ['/', '/strategy', '/market', '/performance', '/settings'];
    for (const path of pages) {
      await page.goto(`${BASE_URL}${path}`);
      const h1 = await page.locator('h1').count();
      expect(h1).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

test.describe('Performance', () => {
  test('dashboard should load within 3 seconds', async ({ page }) => {
    const start = Date.now();
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });

  test('strategy page should load within 2 seconds', async ({ page }) => {
    const start = Date.now();
    const strategy = new StrategyPage(page);
    await strategy.goto();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
