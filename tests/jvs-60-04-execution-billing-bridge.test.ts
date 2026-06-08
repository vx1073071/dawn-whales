/**
 * J-60-04 Tests: Execution → Billing Closed Loop (R60 v19)
 *
 * Tests:
 * 01-02: Order fill billing entry
 * 03-04: Maker/taker fee calculation
 * 05-06: Creator billing summary
 * 07-08: Platform stats + config
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExecutionBillingBridge,
  getExecutionBillingBridge,
  resetExecutionBillingBridge,
} from '../electron/engine/execution-billing-bridge';
import { resetBillingContract } from '../electron/engine/ai-usage-billing-contract';
import { resetCommissionEngine } from '../electron/engine/platform-commission-engine';

describe('J-60-04: ExecutionBillingBridge', () => {
  let bridge: ExecutionBillingBridge;

  beforeEach(() => {
    resetExecutionBillingBridge();
    resetBillingContract();
    resetCommissionEngine();
    bridge = getExecutionBillingBridge();
  });

  describe('Order Fill Billing', () => {
    it('01: onOrderFill creates billing entry', () => {
      const entry = bridge.onOrderFill({
        orderId: 'LIVE-1',
        creator: 'trader1',
        symbol: '00700',
        side: 'buy',
        quantity: 100,
        fillPrice: 350,
        brokerCommission: 3.5,
        exchangeFee: 0.18,
        stampDuty: 46,
        secFee: 0,
        makerTakerFeeRole: 'maker',
        signalSource: 'fundamentals-agent',
      });

      expect(entry.id.startsWith('EXEC-BILL-')).toBe(true);
      expect(entry.tradeValue).toBe(35000);
      expect(entry.totalExecutionFee).toBe(49.68); // 3.5+0.18+46
      expect(entry.creator).toBe('trader1');
    });

    it('02: onOrderFill creates split', () => {
      const entry = bridge.onOrderFill({
        orderId: 'LIVE-2',
        creator: 'trader2',
        symbol: '09988',
        side: 'sell',
        quantity: 200,
        fillPrice: 95,
        brokerCommission: 1.9,
        exchangeFee: 0.1,
        stampDuty: 0,
        secFee: 0,
        makerTakerFeeRole: 'taker',
        signalSource: 'sentiment-agent',
      });

      expect(entry.creatorIncome).toBeGreaterThan(0);
      expect(entry.platformRevenue).toBeGreaterThan(0);
      // creatorIncome + platformRevenue ≈ totalAIFee
      const sum = entry.creatorIncome + entry.platformRevenue;
      expect(Math.abs(sum - entry.totalAIFee)).toBeLessThan(0.01);
    });
  });

  describe('Maker/Taker Fee', () => {
    it('03: maker rate is 0.02%', () => {
      const entry = bridge.onOrderFill({
        orderId: 'LIVE-3',
        creator: 'trader3',
        symbol: '00700',
        side: 'buy',
        quantity: 100,
        fillPrice: 350,
        brokerCommission: 3.5,
        exchangeFee: 0.18,
        stampDuty: 46,
        secFee: 0,
        makerTakerFeeRole: 'maker',
        signalSource: 'orchestrator',
      });

      // maker fee = 35000 * 0.0002 = 7.0
      expect(entry.makerTakerFee).toBeCloseTo(7.0, 4);
    });

    it('04: taker rate is 0.1%', () => {
      const entry = bridge.onOrderFill({
        orderId: 'LIVE-4',
        creator: 'trader4',
        symbol: '00700',
        side: 'sell',
        quantity: 100,
        fillPrice: 350,
        brokerCommission: 3.5,
        exchangeFee: 0.18,
        stampDuty: 46,
        secFee: 0,
        makerTakerFeeRole: 'taker',
        signalSource: 'orchestrator',
      });

      // taker fee = 35000 * 0.001 = 35.0
      expect(entry.makerTakerFee).toBeCloseTo(35.0, 4);
    });
  });

  describe('Creator Billing Summary', () => {
    it('05: summary aggregates correctly', () => {
      bridge.onOrderFill({
        orderId: 'LIVE-A',
        creator: 'alice',
        symbol: 'A', side: 'buy', quantity: 100, fillPrice: 100,
        brokerCommission: 1, exchangeFee: 0.05, stampDuty: 13, secFee: 0,
        makerTakerFeeRole: 'maker', signalSource: 'test',
      });
      bridge.onOrderFill({
        orderId: 'LIVE-B',
        creator: 'alice',
        symbol: 'B', side: 'sell', quantity: 200, fillPrice: 50,
        brokerCommission: 1, exchangeFee: 0.05, stampDuty: 0, secFee: 0,
        makerTakerFeeRole: 'taker', signalSource: 'test',
      });

      const summary = bridge.getCreatorBillingSummary('alice');
      expect(summary.totalTrades).toBe(2);
      expect(summary.totalTradeValue).toBe(20000); // 10000 + 10000
      expect(summary.entries.length).toBe(2);
    });

    it('06: empty creator returns zeros', () => {
      const summary = bridge.getCreatorBillingSummary('nobody');
      expect(summary.totalTrades).toBe(0);
      expect(summary.totalTradeValue).toBe(0);
    });
  });

  describe('Platform Stats', () => {
    it('07: platform stats aggregate all entries', () => {
      bridge.onOrderFill({
        orderId: 'LIVE-P1', creator: 'a', symbol: 'X', side: 'buy',
        quantity: 100, fillPrice: 10, brokerCommission: 0.1, exchangeFee: 0,
        stampDuty: 0, secFee: 0, makerTakerFeeRole: 'maker', signalSource: 'test',
      });
      bridge.onOrderFill({
        orderId: 'LIVE-P2', creator: 'b', symbol: 'Y', side: 'sell',
        quantity: 100, fillPrice: 10, brokerCommission: 0.1, exchangeFee: 0,
        stampDuty: 0, secFee: 0, makerTakerFeeRole: 'taker', signalSource: 'test',
      });

      const stats = bridge.getPlatformStats();
      expect(stats.totalTrades).toBe(2);
      expect(stats.totalTradeValue).toBe(2000);
    });

    it('08: getEntryByOrder retrieves by orderId', () => {
      const entry = bridge.onOrderFill({
        orderId: 'LIVE-FIND', creator: 'x', symbol: 'Z', side: 'buy',
        quantity: 10, fillPrice: 5, brokerCommission: 0.01, exchangeFee: 0,
        stampDuty: 0, secFee: 0, makerTakerFeeRole: 'maker', signalSource: 'test',
      });
      const found = bridge.getEntryByOrder('LIVE-FIND');
      expect(found?.id).toBe(entry.id);
    });

    it('09: missing order returns undefined', () => {
      expect(bridge.getEntryByOrder('NONEXISTENT')).toBeUndefined();
    });
  });
});
