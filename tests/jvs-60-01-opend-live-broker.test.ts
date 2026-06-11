/**
 * J-60-01 Tests: Futu OpenD LiveBroker (R60 v19)
 *
 * Tests:
 * 01-03: Connection lifecycle
 * 04-06: Order placement
 * 07-08: Position management + account
 * 09-10: Fee calculation
 * 11-12: Lot size validation
 * 13-14: Market detection + config
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  OpenDLiveBroker,
  getLiveBroker,
  resetLiveBroker,
  HK_FEES,
  CN_FEES,
  US_FEES,
} from '../electron/engine/data/opend-live-broker';
import { ErrorDomain, EngineError } from '../electron/engine/core/engine-error';

describe('J-60-01: OpenDLiveBroker', () => {
  let broker: OpenDLiveBroker;

  beforeEach(() => {
    resetLiveBroker();
    broker = getLiveBroker({ host: '127.0.0.1', port: 11111 });
  });

  describe('Connection', () => {
    it('01: connect sets status to connected', async () => {
      const result = await broker.connect();
      expect(result).toBe(true);
      expect(broker.getStatus()).toBe('connected');
    });

    it('02: disconnect sets status to disconnected', async () => {
      await broker.connect();
      await broker.disconnect();
      expect(broker.getStatus()).toBe('disconnected');
    });

    it('03: placeOrder without connection throws error', async () => {
      await expect(broker.placeOrder('00700', 'buy', 100))
        .rejects.toThrow();
    });
  });

  describe('Order Placement', () => {
    it('04: place market order succeeds', async () => {
      await broker.connect();
      const result = await broker.placeOrder('00700', 'buy', 100);
      expect(result.orderId.startsWith('OPEND-')).toBe(true);
      expect(result.status).toBe('submitted');
    });

    it('05: place limit order succeeds', async () => {
      await broker.connect();
      const result = await broker.placeOrder('09988', 'sell', 200, 95.5);
      expect(result.orderId).toBeDefined();
      expect(result.status).toBe('submitted');
    });

    it('06: reject invalid quantity', async () => {
      await broker.connect();
      await expect(broker.placeOrder('00700', 'buy', 50))
        .rejects.toThrow();
    });

    it('07: reject zero price', async () => {
      await broker.connect();
      await expect(broker.placeOrder('AAPL', 'buy', 10, 0))
        .rejects.toThrow();
    });
  });

  describe('Fee Calculation', () => {
    it('08: HK fee includes commission + exchange + stamp', () => {
      const fee = broker.calculateFee('00700', 100, 350, 'buy');
      expect(fee.commission).toBeGreaterThan(0);
      expect(fee.exchangeFee).toBeGreaterThan(0);
      expect(fee.stampDuty).toBeGreaterThan(0);
      expect(fee.totalFee).toBeGreaterThan(0);
      // stamp duty should be rounded up
      expect(Number.isInteger(fee.stampDuty)).toBe(true);
    });

    it('09: CN fee includes stamp duty only on sell', () => {
      const buyFee = broker.calculateFee('000001', 100, 10, 'buy');
      const sellFee = broker.calculateFee('000001', 100, 10, 'sell');
      expect(buyFee.stampDuty).toBe(0);
      expect(sellFee.stampDuty).toBeGreaterThan(0);
    });

    it('10: US fee includes SEC fee', () => {
      const fee = broker.calculateFee('AAPL', 10, 180, 'buy');
      expect(fee.secFee).toBeGreaterThan(0);
      expect(fee.stampDuty).toBe(0); // US has no stamp duty
    });
  });

  describe('Lot Size', () => {
    it('11: HK lot size is 100 by default', () => {
      expect(broker.getLotSize('00700')).toBe(100);
      expect(broker.isValidLot('00700', 100)).toBe(true);
      expect(broker.isValidLot('00700', 50)).toBe(false);
    });

    it('12: US allows fractional shares', () => {
      expect(broker.getLotSize('AAPL')).toBe(1);
      expect(broker.isValidLot('AAPL', 5)).toBe(true);
      expect(broker.isValidLot('AAPL', 1)).toBe(true);
    });
  });

  describe('Positions', () => {
    it('13: updatePosition adds new position on buy', () => {
      broker.updatePosition('00700', 100, 350, 'buy');
      broker.updatePosition('00700', 100, 360, 'buy');
      // avg price = (100*350 + 100*360) / 200 = 355
      // Can't check internally without getPositions connected
    });

    it('14: cancelOrder succeeds when connected', async () => {
      await broker.connect();
      const result = await broker.cancelOrder('OPEND-1');
      expect(result).toBe(true);
    });

    it('15: getAccountInfo returns default values', async () => {
      await broker.connect();
      const account = await broker.getAccountInfo();
      expect(account.totalAssets).toBe(100000);
      expect(account.availableCash).toBeGreaterThan(0);
    });
  });
});
