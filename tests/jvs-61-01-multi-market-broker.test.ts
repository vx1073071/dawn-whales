/**
 * J-61-01 Tests: A/美股 MultiMarketBroker (R61 v19 — v1.4.0-beta)
 *
 * Tests:
 * 01-02: Market configs (HK, A-SH, A-SZ, US-NYSE, US-NASDAQ)
 * 03-04: Order placement across markets
 * 05-06: Fee calculation per market
 * 07: Daily limit check (A-share涨停/跌停)
 * 08: Market session (US pre/post, A-share lunch break)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiMarketBroker,
  getMultiMarketBroker,
  resetMultiMarketBroker,
  calculateMarketFee,
  checkDailyLimit,
  MarketConfig,
} from '../electron/engine/data/multi-market-broker';

describe('J-61-01: MultiMarketBroker', () => {
  let broker: MultiMarketBroker;

  beforeEach(() => {
    resetMultiMarketBroker();
    broker = getMultiMarketBroker();
  });

  describe('Market Configs', () => {
    it('01: all 5 markets available with defaults', () => {
      const configs = broker.getAllMarketConfigs();
      expect(configs.length).toBe(5);
      const regions = configs.map(c => c.region).sort();
      expect(regions).toEqual(['A-SH', 'A-SZ', 'HK', 'US-NASDAQ', 'US-NYSE']);
    });

    it('02: A-share min 100 shares, US min 1 share', () => {
      const aSH = broker.getMarketConfig('A-SH');
      const usNYSE = broker.getMarketConfig('US-NYSE');
      expect(aSH?.minShares).toBe(100);
      expect(usNYSE?.minShares).toBe(1);
    });

    it('03: A-share has daily limits, US does not', () => {
      const aSH = broker.getMarketConfig('A-SH');
      const us = broker.getMarketConfig('US-NASDAQ');
      expect(aSH?.dailyUpLimit).toBe(0.10);
      expect(aSH?.dailyDownLimit).toBe(0.10);
      expect(us?.dailyUpLimit).toBe(0);
      expect(us?.dailyDownLimit).toBe(0);
    });
  });

  describe('Order Placement', () => {
    it('04: place A-share order', async () => {
      const result = await broker.placeOrder({
        id: 'a1', symbol: '000001', side: 'buy', quantity: 100,
        price: 12.50, orderType: 'limit', market: 'A-SZ',
      });
      expect(result.orderId).toContain('MLT-A-SZ-');
      expect(result.status).toBe('submitted');
      expect(result.market).toBe('A-SZ');
    });

    it('05: place US order with 1 share', async () => {
      const result = await broker.placeOrder({
        id: 'us1', symbol: 'AAPL', side: 'buy', quantity: 1,
        price: 180, orderType: 'limit', market: 'US-NASDAQ',
      });
      expect(result.status).toBe('submitted');
      expect(result.market).toBe('US-NASDAQ');
    });

    it('06: reject A-share order below min shares', async () => {
      await expect(broker.placeOrder({
        id: 'a2', symbol: '000002', side: 'buy', quantity: 50,
        price: 10, orderType: 'limit', market: 'A-SZ',
      })).rejects.toThrow();
    });
  });

  describe('Fee Calculation', () => {
    it('07: HK stock fee includes stamp duty', () => {
      const fee = calculateMarketFee(35000, 100, broker.getMarketConfig('HK')!);
      expect(fee.stampDuty).toBeGreaterThan(0); // 0.13% stamp duty
    });

    it('08: US stock fee has no stamp duty', () => {
      const fee = calculateMarketFee(10000, 100, broker.getMarketConfig('US-NYSE')!);
      expect(fee.stampDuty).toBe(0);
      expect(fee.secFee).toBeGreaterThan(0);
    });

    it('09: A-share fee includes 0.05% stamp duty', () => {
      const fee = calculateMarketFee(12500, 100, broker.getMarketConfig('A-SH')!);
      expect(fee.stampDuty).toBeCloseTo(6.25, 2); // 12500 * 0.0005
    });

    it('10: getFeeForTrade helper works', () => {
      const fee = broker.getFeeForTrade(10000, 100, 'A-SH');
      expect(fee.total).toBeGreaterThan(0);
    });
  });

  describe('Daily Limit Check', () => {
    it('11: 涨停 blocks buy above limit', () => {
      const result = checkDailyLimit('000001', 'buy', 12, 10,
        broker.getMarketConfig('A-SH')!, false);
      expect(result.passed).toBe(false); // 12 > 10 * 1.10 = 11
      expect(result.reason).toContain('涨停');
    });

    it('12: 跌停 blocks sell below limit', () => {
      const result = checkDailyLimit('000001', 'sell', 8, 10,
        broker.getMarketConfig('A-SZ')!, false);
      expect(result.passed).toBe(false); // 8 < 10 * 0.90 = 9
      expect(result.reason).toContain('跌停');
    });

    it('13: within limit passes', () => {
      const result = checkDailyLimit('000001', 'buy', 10.5, 10,
        broker.getMarketConfig('A-SH')!, false);
      expect(result.passed).toBe(true);
    });

    it('14: US stocks always pass limit check', () => {
      const result = checkDailyLimit('AAPL', 'buy', 500, 100,
        broker.getMarketConfig('US-NASDAQ')!, false);
      expect(result.passed).toBe(true);
    });
  });

  describe('Custom Config', () => {
    it('15: custom market config overrides defaults', () => {
      const customBroker = new MultiMarketBroker({
        'HK': { brokerageRate: 0.0001 },
      });
      const config = customBroker.getMarketConfig('HK');
      expect(config?.brokerageRate).toBe(0.0001);
      expect(config?.stampDutyRate).toBe(0.0013); // default preserved
    });
  });
});
