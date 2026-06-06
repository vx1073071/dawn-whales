import re

# Fix position-monitor.test.ts - ALL tests that call updatePrice need stopLoss disabled
# or positions will be auto-closed before assertions
with open('tests/position-monitor.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Strategy: The default executor has stopLoss enabled.
# ANY test that calls updatePrice and then checks positions[0]
# needs to ensure stopLoss/takeProfit won't auto-close the position first.
# Simplest fix: create per-test executors with stopLoss/takeProfit DISABLED.

# Fix "should update position PnL on price update" - check BEFORE updatePrice removes position
old1 = '''    it('should update position PnL on price update', () => {
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

      executor.updatePrice('US.AAPL', 160);

      const updatedPositions = executor.getPositions();
      expect(updatedPositions.length).toBe(1);
      expect(updatedPositions[0].pnl).toBeGreaterThan(0);
      expect(updatedPositions[0].pnlPct).toBeGreaterThan(0);
    });'''

new1 = '''    it('should update position PnL on price update', () => {
      // Use dedicated executor with stop loss disabled to prevent auto-close on price update
      const pnlExecutor = new ClosedLoopExecutor({
        enabled: true, autoExecute: true, requireConfirmation: false,
        riskCheckEnabled: false, maxPositionSize: 10000, maxDailyOrders: 10, cooldownMinutes: 0,
        stopLoss: { enabled: false }, takeProfit: { enabled: false },
      });

      const signal: Signal = {
        id: 'sig-1', strategyId: 'strat-1', code: 'US.AAPL',
        type: 'BUY', price: 150, timestamp: Date.now(), confidence: 0.8,
      };

      pnlExecutor.addSignal(signal);
      const positions = pnlExecutor.getPositions();
      expect(positions.length).toBe(1);

      pnlExecutor.updatePrice('US.AAPL', 160);

      const updatedPositions = pnlExecutor.getPositions();
      expect(updatedPositions.length).toBe(1);
      expect(updatedPositions[0].pnl).toBeGreaterThan(0);
      expect(updatedPositions[0].pnlPct).toBeGreaterThan(0);
      pnlExecutor.destroy();
    });'''
content = content.replace(old1, new1)

# Fix "should track holding time" - check entryTime BEFORE updatePrice; also disable stopLoss
old2 = '''  describe('Time-Based Exit', () => {
    it('should track holding time', () => {
      // Disable stop loss so position isn't auto-closed before exit check
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
      const positions = noSlExecutor.getPositions();
      expect(positions.length).toBe(1);
      // entryTime is set on position when BUY is filled - check before updatePrice
      expect(positions[0].entryTime).toBeDefined();
      // Update price (no time exit since maxHoldingMinutes=0 from default)
      noSlExecutor.updatePrice('US.AAPL', 148);

      const remainingPositions = noSlExecutor.getPositions();
      expect(remainingPositions.length).toBe(1);
      noSlExecutor.destroy();
    });
  });'''

new2 = '''  describe('Time-Based Exit', () => {
    it('should track holding time', () => {
      const holdingExecutor = new ClosedLoopExecutor({
        enabled: true, autoExecute: true, requireConfirmation: false,
        riskCheckEnabled: false, maxPositionSize: 10000, maxDailyOrders: 10, cooldownMinutes: 0,
        stopLoss: { enabled: false }, takeProfit: { enabled: false },
      });

      const signal: Signal = {
        id: 'sig-1', strategyId: 'strat-1', code: 'US.AAPL',
        type: 'BUY', price: 150, timestamp: Date.now(), confidence: 0.8,
      };

      holdingExecutor.addSignal(signal);
      const positions = holdingExecutor.getPositions();
      expect(positions.length).toBe(1);
      // entryTime is set on position when BUY is filled
      expect(positions[0].entryTime).toBeDefined();
      // Update price - position stays open (no time exit: maxHoldingMinutes=0, stopLoss disabled)
      holdingExecutor.updatePrice('US.AAPL', 148);
      const remainingPositions = holdingExecutor.getPositions();
      expect(remainingPositions.length).toBe(1);
      holdingExecutor.destroy();
    });
  });'''
content = content.replace(old2, new2)

with open('tests/position-monitor.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("position-monitor fully fixed")