import re

with open('tests/position-monitor.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# The take profit test: executor adds signal → simulateOrderExecution runs → filled price
# may trigger stop loss immediately → loop closes before we can even check positions
# Solution: Create a dedicated executor with stopLoss disabled for this test so
# the position stays open long enough for updatePrice to trigger take profit.

old = '''    it('should trigger take profit when price rises above threshold', () => {
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

      // Simulate price rise to trigger take profit (assume 10% take profit)
      const position = positions[0];
      const takeProfitPrice = position.avgPrice * 1.10; // 10% rise

      executor.updatePrice('US.AAPL', takeProfitPrice);

      const remainingPositions = executor.getPositions();
      expect(remainingPositions.length).toBe(0);
    });'''

new = '''    it('should trigger take profit when price rises above threshold', () => {
      // Use dedicated executor with stopLoss disabled so position isn't auto-closed
      // by the stop-loss check during simulateOrderExecution price fluctuation
      const tpExecutor = new ClosedLoopExecutor({
        enabled: true, autoExecute: true, requireConfirmation: false,
        riskCheckEnabled: false, maxPositionSize: 10000, maxDailyOrders: 10, cooldownMinutes: 0,
        stopLoss: { enabled: false }, takeProfit: { enabled: true, pct: 10 },
      });

      const signal: Signal = {
        id: 'sig-1', strategyId: 'strat-1', code: 'US.AAPL',
        type: 'BUY', price: 150, timestamp: Date.now(), confidence: 0.8,
      };

      tpExecutor.addSignal(signal);
      const positions = tpExecutor.getPositions();
      expect(positions.length).toBe(1);

      // Simulate price rise to trigger take profit (10% above avgPrice)
      const takeProfitPrice = positions[0].avgPrice * 1.10;
      tpExecutor.updatePrice('US.AAPL', takeProfitPrice);

      const remainingPositions = tpExecutor.getPositions();
      expect(remainingPositions.length).toBe(0);
      tpExecutor.destroy();
    });'''
content = content.replace(old, new)

with open('tests/position-monitor.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("take profit test fixed")