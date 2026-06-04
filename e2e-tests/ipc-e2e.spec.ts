import { test, expect } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';

test.describe('Dawn Whales IPC E2E Tests', () => {
  let electronApp: ElectronApplication;
  let mainPage: Page;

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await ElectronApplication.launch({
      executablePath: require('electron'),
      args: ['.']
    });
    
    // Get main window
    mainPage = await electronApp.firstWindow();
    await mainPage.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('TC1: App Launch and Initial State', async () => {
    // Verify app launches successfully
    await expect(mainPage).toHaveTitle(/道鲸|Quant/);
    
    // Check initial UI elements
    await expect(mainPage.locator('[data-testid="app-container"]')).toBeVisible();
    await expect(mainPage.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // Take screenshot for report
    await mainPage.screenshot({ path: 'test-results/01-app-launch.png' });
  });

  test('TC2: OpenD Connection', async () => {
    // Navigate to connection settings
    await mainPage.click('[data-testid="settings-button"]');
    await mainPage.click('[data-testid="connection-tab"]');
    
    // Configure OpenD connection (mock for testing)
    await mainPage.fill('[data-testid="opend-host"]', '127.0.0.1');
    await mainPage.fill('[data-testid="opend-port"]', '11111');
    await mainPage.click('[data-testid="connect-button"]');
    
    // Wait for connection status
    await mainPage.waitForSelector('[data-testid="connection-status"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Verify connection successful
    const status = await mainPage.textContent('[data-testid="connection-status"]');
    expect(status).toContain('Connected');
    
    await mainPage.screenshot({ path: 'test-results/02-opend-connection.png' });
  });

  test('TC3: Market Data Subscription', async () => {
    // Subscribe to market data
    await mainPage.fill('[data-testid="stock-code-input"]', 'HK.00700'); // Tencent
    await mainPage.click('[data-testid="subscribe-button"]');
    
    // Wait for market data to appear
    await mainPage.waitForSelector('[data-testid="market-data-panel"]', { 
      timeout: 15000 
    });
    
    // Verify market data fields
    await expect(mainPage.locator('[data-testid="last-price"]')).toBeVisible();
    await expect(mainPage.locator('[data-testid="volume"]')).toBeVisible();
    await expect(mainPage.locator('[data-testid="turnover"]')).toBeVisible();
    
    // Verify real-time update (wait for price change)
    const initialPrice = await mainPage.textContent('[data-testid="last-price"]');
    await mainPage.waitForFunction(
      (price) => {
        const currentPrice = document.querySelector('[data-testid="last-price"]')?.textContent;
        return currentPrice !== price;
      },
      initialPrice,
      { timeout: 30000 }
    );
    
    await mainPage.screenshot({ path: 'test-results/03-market-data.png' });
  });

  test('TC4: Stock Selection Workflow', async () => {
    // Navigate to stock selection page
    await mainPage.click('[data-testid="stock-selection-nav"]');
    
    // Apply selection criteria
    await mainPage.selectOption('[data-testid="market-select"]', 'HK');
    await mainPage.fill('[data-testid="min-volume"]', '1000000');
    await mainPage.fill('[data-testid="min-market-cap"]', '5000000000');
    await mainPage.click('[data-testid="apply-filter"]');
    
    // Wait for results
    await mainPage.waitForSelector('[data-testid="stock-list"]', { timeout: 10000 });
    
    // Verify stocks are listed
    const stockCount = await mainPage.locator('[data-testid="stock-item"]').count();
    expect(stockCount).toBeGreaterThan(0);
    
    // Select a stock for backtest
    await mainPage.click('[data-testid="stock-item"] >> nth=0');
    await mainPage.click('[data-testid="add-to-backtest"]');
    
    await mainPage.screenshot({ path: 'test-results/04-stock-selection.png' });
  });

  test('TC5: Strategy Backtest', async () => {
    // Navigate to backtest page
    await mainPage.click('[data-testid="backtest-nav"]');
    
    // Configure backtest parameters
    await mainPage.fill('[data-testid="start-date"]', '2025-01-01');
    await mainPage.fill('[data-testid="end-date"]', '2025-12-31');
    await mainPage.selectOption('[data-testid="strategy-select"]', 'MA_Cross');
    await mainPage.fill('[data-testid="initial-capital"]', '1000000');
    
    // Run backtest
    await mainPage.click('[data-testid="run-backtest"]');
    
    // Wait for backtest completion
    await mainPage.waitForSelector('[data-testid="backtest-results"]', { 
      timeout: 60000 
    });
    
    // Verify backtest results
    await expect(mainPage.locator('[data-testid="total-return"]')).toBeVisible();
    await expect(mainPage.locator('[data-testid="sharpe-ratio"]')).toBeVisible();
    await expect(mainPage.locator('[data-testid="max-drawdown"]')).toBeVisible();
    
    // Check chart rendered
    await expect(mainPage.locator('[data-testid="equity-curve-chart"]')).toBeVisible();
    
    await mainPage.screenshot({ path: 'test-results/05-backtest-results.png' });
  });

  test('TC6: Order Placement', async () => {
    // Navigate to trading page
    await mainPage.click('[data-testid="trading-nav"]');
    
    // Place a test order
    await mainPage.selectOption('[data-testid="order-type"]', 'LMT');
    await mainPage.fill('[data-testid="order-price"]', '380.00');
    await mainPage.fill('[data-testid="order-quantity"]', '100');
    await mainPage.click('[data-testid="buy-button"]');
    
    // Confirm order
    await mainPage.waitForSelector('[data-testid="order-confirmation"]', { timeout: 5000 });
    await mainPage.click('[data-testid="confirm-order"]');
    
    // Verify order placed
    await mainPage.waitForSelector('[data-testid="order-status"]', { timeout: 10000 });
    const orderStatus = await mainPage.textContent('[data-testid="order-status"]');
    expect(orderStatus).toMatch(/Placed|Submitted|Filled/);
    
    await mainPage.screenshot({ path: 'test-results/06-order-placement.png' });
  });

  test('TC7: Risk Alert Monitoring', async () => {
    // Navigate to risk dashboard
    await mainPage.click('[data-testid="risk-nav"]');
    
    // Check risk metrics
    await expect(mainPage.locator('[data-testid="portfolio-var"]')).toBeVisible();
    await expect(mainPage.locator('[data-testid="position-limit-usage"]')).toBeVisible();
    await expect(mainPage.locator('[data-testid="risk-alerts"]')).toBeVisible();
    
    // Simulate risk alert (if possible in test environment)
    // This might require mock IPC call
    await mainPage.evaluate(() => {
      window.electron.ipcRenderer.invoke('risk:simulate-alert', {
        type: 'POSITION_LIMIT_BREACH',
        message: 'Position limit exceeded for HK.00700'
      });
    });
    
    // Wait for alert to appear
    await mainPage.waitForSelector('[data-testid="risk-alert-item"]', { timeout: 5000 });
    
    // Verify alert displayed
    const alertText = await mainPage.textContent('[data-testid="risk-alert-item"] >> nth=0');
    expect(alertText).toContain('Position limit exceeded');
    
    await mainPage.screenshot({ path: 'test-results/07-risk-alerts.png' });
  });

  test('TC8: IPC Communication Validation', async () => {
    // Test all critical IPC channels
    const ipcTests = [
      { channel: 'db:query', payload: { sql: 'SELECT 1' } },
      { channel: 'market:subscribe', payload: { code: 'HK.00700' } },
      { channel: 'trade:placeOrder', payload: { price: 380, qty: 100 } },
      { channel: 'risk:getMetrics', payload: {} }
    ];
    
    for (const test of ipcTests) {
      const result = await mainPage.evaluate(
        ({ channel, payload }) => {
          return window.electron.ipcRenderer.invoke(channel, payload);
        },
        test
      );
      
      // Verify IPC call succeeded
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
    }
    
    await mainPage.screenshot({ path: 'test-results/08-ipc-validation.png' });
  });

  test('TC9: Error Handling and Recovery', async () => {
    // Test disconnect/reconnect scenario
    await mainPage.evaluate(() => {
      window.electron.ipcRenderer.invoke('opend:disconnect');
    });
    
    // Wait for disconnection status
    await mainPage.waitForSelector('[data-testid="connection-status"]', { 
      state: 'visible',
      timeout: 5000 
    });
    const disconnectedStatus = await mainPage.textContent('[data-testid="connection-status"]');
    expect(disconnectedStatus).toContain('Disconnected');
    
    // Reconnect
    await mainPage.click('[data-testid="reconnect-button"]');
    
    // Wait for reconnection
    await mainPage.waitForSelector('[data-testid="connection-status"]', { 
      state: 'visible',
      timeout: 10000 
    });
    const reconnectedStatus = await mainPage.textContent('[data-testid="connection-status"]');
    expect(reconnectedStatus).toContain('Connected');
    
    await mainPage.screenshot({ path: 'test-results/09-error-recovery.png' });
  });
});
