# Fix closed-loop-integration.test.ts: "max positions" test
with open('tests/closed-loop-integration.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''    it('should reject when max positions reached', () => {
      // Increase daily order limit so max-position check fires first
      executor.updateConfig({ maxDailyOrders: 50 });
      // Create 20 positions (max in engine is 20)
      for (let i = 0; i < 20; i++) {
        const signal: Signal = {
          id: `sig-${i}`,
          strategyId: 'strat-1',
          code: `US.STOCK${i}`,
          type: 'BUY',
          price: 100,
          timestamp: Date.now() + i,
          confidence: 0.8,
        };
        executor.addSignal(signal);
      }

      // Try to add one more
      const signal: Signal = {
        id: 'sig-overflow',
        strategyId: 'strat-1',
        code: 'US.OVERFLOW',
        type: 'BUY',
        price: 100,
        timestamp: Date.now(),
        confidence: 0.8,
      };
      const result = executor.addSignal(signal);
      expect(result.success).toBe(false);
      expect(result.riskReason).toContain('Max positions');
    });'''

new = '''    it('should reject when max positions reached', () => {
      // Use high maxDailyOrders to avoid daily order limit; resetDailyCount to avoid carryover
      executor.updateConfig({ maxDailyOrders: 999 });
      executor.resetDailyCount();

      // Create 21 signals to GUARANTEE at least 20 positions (some orders may fail ~5%)
      for (let i = 0; i < 21; i++) {
        const signal: Signal = {
          id: `sig-${i}`,
          strategyId: 'strat-1',
          code: `US.STOCK${i}`,
          type: 'BUY',
          price: 100,
          timestamp: Date.now() + i,
          confidence: 0.8,
        };
        executor.addSignal(signal);
      }

      // Verify we have 20+ positions (some signals may have failed, keep adding until we do)
      let positions = executor.getPositions();
      let attempts = 0;
      while (positions.length < 20 && attempts < 10) {
        const signal: Signal = {
          id: `sig-extra-${attempts}`,
          strategyId: 'strat-1',
          code: `US.EXTRA${attempts}`,
          type: 'BUY',
          price: 100,
          timestamp: Date.now() + 1000 + attempts,
          confidence: 0.8,
        };
        executor.addSignal(signal);
        positions = executor.getPositions();
        attempts++;
      }

      // 21st signal MUST be rejected once we have 20 positions
      const signal: Signal = {
        id: 'sig-overflow',
        strategyId: 'strat-1',
        code: 'US.OVERFLOW',
        type: 'BUY',
        price: 100,
        timestamp: Date.now(),
        confidence: 0.8,
      };
      const result = executor.addSignal(signal);
      expect(result.success).toBe(false);
      expect(result.riskReason).toContain('Max positions');
    });'''

content = content.replace(old, new)

with open('tests/closed-loop-integration.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("closed-loop-integration fixed")