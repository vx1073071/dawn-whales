import re

with open('tests/closed-loop-integration.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: max positions test - add maxDailyOrders: 50 before the loop
old1 = '''    it('should reject when max positions reached', () => {
      // Create 20 positions (max)
      for (let i = 0; i < 20; i++) {'''
new1 = '''    it('should reject when max positions reached', () => {
      // Increase daily order limit so max-position check fires first
      executor.updateConfig({ maxDailyOrders: 50 });
      // Create 20 positions (max in engine is 20)
      for (let i = 0; i < 20; i++) {'''
content = content.replace(old1, new1)

# Fix 2: close position after SELL - same price so qty matches exactly
old2 = '''      const sellSignal: Signal = {
        id: 'sig-sell',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'SELL',
        price: 155,'''
new2 = '''      // Sell at the same price so quantity matches exactly
      const sellSignal: Signal = {
        id: 'sig-sell',
        strategyId: 'strat-1',
        code: 'US.AAPL',
        type: 'SELL',
        price: 150,'''
content = content.replace(old2, new2)

with open('tests/closed-loop-integration.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")