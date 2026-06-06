with open('tests/position-monitor.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: trailing stop test - need trailing: true in config
old1 = '''  describe('Trailing Stop', () => {
    it('should update trailing stop when price rises', () => {
      const signal: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      executor.addSignal(signal);
      const positions = executor.getPositions();
      expect(positions.length).toBe(1);

      // Price rises
      executor.updatePrice('US.AAPL', 160);

      const updatedPositions = executor.getPositions();
      expect(updatedPositions[0].highestPrice).toBe(160);
      expect(updatedPositions[0].trailingStop).toBeDefined();
    });
  });'''

new1 = '''  describe('Trailing Stop', () => {
    it('should update trailing stop when price rises', () => {
      // Configure with trailing stop enabled
      const trailingExecutor = new ClosedLoopExecutor({
        enabled: true,
        autoExecute: true,
        requireConfirmation: false,
        riskCheckEnabled: false,
        maxPositionSize: 10000,
        maxDailyOrders: 10,
        cooldownMinutes: 0,
        stopLoss: { enabled: true, pct: 5, trailing: true, trailingPct: 3 },
        takeProfit: { enabled: false },
      });

      const signal: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      trailingExecutor.addSignal(signal);
      const positions = trailingExecutor.getPositions();
      expect(positions.length).toBe(1);

      // Price rises
      trailingExecutor.updatePrice('US.AAPL', 160);

      const updatedPositions = trailingExecutor.getPositions();
      expect(updatedPositions[0].highestPrice).toBe(160);
      expect(updatedPositions[0].trailingStop).toBeDefined();
      trailingExecutor.destroy();
    });
  });'''
content = content.replace(old1, new1)

# Fix 2: negative PnL test - disable stop loss so position isn't closed before check
old2 = '''    it('should calculate negative PnL correctly', () => {
      const signal: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      executor.addSignal(signal);
      executor.updatePrice('US.AAPL', 140);

      const positions = executor.getPositions();
      expect(positions[0].pnl).toBeLessThan(0);
      expect(positions[0].pnlPct).toBeLessThan(0);
    });'''

new2 = '''    it('should calculate negative PnL correctly', () => {
      // Disable stop loss so position isn't auto-closed before PnL check
      const noSlExecutor = new ClosedLoopExecutor({
        enabled: true,
        autoExecute: true,
        requireConfirmation: false,
        riskCheckEnabled: false,
        maxPositionSize: 10000,
        maxDailyOrders: 10,
        cooldownMinutes: 0,
        stopLoss: { enabled: false },
        takeProfit: { enabled: false },
      });

      const signal: Signal = {
        id: 'sig-1',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'BUY',
        price: 150,
        timestamp: Date.now(),
        confidence: 0.8,
      };

      noSlExecutor.addSignal(signal);
      noSlExecutor.updatePrice('US.AAPL', 140);

      const positions = noSlExecutor.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0].pnl).toBeLessThan(0);
      expect(positions[0].pnlPct).toBeLessThan(0);
      noSlExecutor.destroy();
    });'''
content = content.replace(old2, new2)

with open('tests/position-monitor.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")