/**
 * UnifiedBrokerAPI.test.ts — R228 JVS-2.5c: 统一接口层测试
 *
 * ≥10 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedBrokerAPI } from '../../../electron/broker/UnifiedBrokerAPI';
import type { IBrokerProvider } from '../../../electron/broker/UnifiedBrokerAPI';
import type {
  BrokerConnectionStatus,
  BrokerType,
  TaggedQuoteInfo,
  TaggedPositionInfo,
  TaggedOrderInfo,
  TaggedPlaceOrderRequest,
} from '../../../electron/broker/IBrokerAdapterV2';

class MockProvider implements IBrokerProvider {
  connect = vi.fn().mockResolvedValue(undefined);
  disconnect = vi.fn().mockResolvedValue(undefined);
  getQuotes = vi.fn().mockResolvedValue([]);
  getFunds = vi.fn().mockResolvedValue([]);
  getPositions = vi.fn().mockResolvedValue([]);
  getOrders = vi.fn().mockResolvedValue([]);
  placeOrder = vi.fn().mockResolvedValue({ orderId: 'ord-001' });
  cancelOrder = vi.fn().mockResolvedValue(undefined);
  getConnectionStatus = vi.fn().mockReturnValue(null);
  getAllConnectionStatuses = vi.fn().mockReturnValue([]);
  getAllBrokerConfigs = vi.fn().mockReturnValue([
    { id: 'binance-spot', name: 'Binance Spot', type: 'binance' as BrokerType },
    { id: 'futu-default', name: 'Futu Default', type: 'futu' as BrokerType },
  ]);
  subscribe = vi.fn();

  constructor() {
    this.connect = vi.fn().mockResolvedValue(undefined);
    this.disconnect = vi.fn().mockResolvedValue(undefined);
    this.getQuotes = vi.fn().mockResolvedValue([]);
    this.getFunds = vi.fn().mockResolvedValue([]);
    this.getPositions = vi.fn().mockResolvedValue([]);
    this.getOrders = vi.fn().mockResolvedValue([]);
    this.placeOrder = vi.fn().mockResolvedValue({ orderId: 'ord-001' });
    this.cancelOrder = vi.fn().mockResolvedValue(undefined);
    this.getConnectionStatus = vi.fn().mockReturnValue(null);
    this.getAllConnectionStatuses = vi.fn().mockReturnValue([]);
    this.getAllBrokerConfigs = vi.fn().mockReturnValue([
      { id: 'binance-spot', name: 'Binance Spot', type: 'binance' as BrokerType },
      { id: 'futu-default', name: 'Futu Default', type: 'futu' as BrokerType },
    ]);
    this.subscribe = vi.fn();
  }
}

describe('UnifiedBrokerAPI', () => {
  let api: UnifiedBrokerAPI;
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
    api = new UnifiedBrokerAPI(provider);
  });

  describe('connect()', () => {
    it('should connect successfully', async () => {
      const result = await api.connect('binance-spot');
      expect(result.success).toBe(true);
      expect(provider.connect).toHaveBeenCalledWith('binance-spot');
    });

    it('should handle connection failure', async () => {
      provider.connect = vi.fn().mockRejectedValue(new Error('timeout'));
      const result = await api.connect('binance-spot');
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('getQuotes()', () => {
    it('should fetch quotes from multiple brokers', async () => {
      const mockQuote: TaggedQuoteInfo = {
        brokerId: 'futu-default',
        brokerName: 'Futu Default',
        brokerType: 'futu',
        market: 'US',
        code: 'AAPL',
        standardCode: 'AAPL_US',
        originalCode: 'AAPL',
        price: 175.5,
        change: 2.3,
        changePct: 1.33,
        volume: 10000000,
        high: 176,
        low: 174,
        open: 174.5,
        prevClose: 173.2,
        timestamp: Date.now(),
      };

      provider.getQuotes = vi.fn().mockResolvedValue([mockQuote]);

      const result = await api.getQuotes(['futu-default'], ['AAPL']);
      expect(result['futu-default']).toHaveLength(1);
      expect(result['futu-default'][0].price).toBe(175.5);
    });

    it('should use * to query all brokers', async () => {
      provider.getQuotes = vi.fn().mockResolvedValue([]);
      await api.getQuotes('*', ['AAPL']);
      expect(provider.getQuotes).toHaveBeenCalledTimes(2);
    });
  });

  describe('placeOrder()', () => {
    it('should place an order successfully', async () => {
      const result = await api.placeOrder({
        brokerId: 'futu-default',
        code: 'AAPL',
        side: 'BUY',
        orderType: 'LIMIT',
        qty: 100,
        price: 175.0,
      });

      expect(result.success).toBe(true);
      expect(result.data!.orderId).toBe('ord-001');
    });

    it('should handle order failure', async () => {
      provider.placeOrder = vi.fn().mockRejectedValue(new Error('insufficient margin'));
      const result = await api.placeOrder({
        brokerId: 'futu-default',
        code: 'AAPL',
        side: 'BUY',
        orderType: 'MARKET',
        qty: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient margin');
    });
  });

  describe('getHealth()', () => {
    it('should return unified health for all brokers', () => {
      const status: BrokerConnectionStatus = {
        brokerId: 'binance-spot',
        brokerName: 'Binance Spot',
        brokerType: 'binance',
        connected: true,
        connectedAt: Date.now(),
        latencyP50: 50,
        latencyP99: 150,
        errorRate: 0.01,
        subscriptionsCount: 5,
      };
      provider.getAllConnectionStatuses = vi.fn().mockReturnValue([status]);

      const health = api.getHealth();
      expect(health).toHaveLength(1);
      expect(health[0].brokerId).toBe('binance-spot');
      expect(health[0].connected).toBe(true);
      expect(health[0].status).toBe('healthy');
    });
  });

  describe('subscribe()', () => {
    it('should subscribe all brokers when * is used', () => {
      api.subscribe('*', ['AAPL', 'TSLA']);
      expect(provider.subscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe('isConnected()', () => {
    it('should return true for connected broker', () => {
      provider.getConnectionStatus = vi.fn().mockReturnValue({
        brokerId: 'futu-default',
        brokerName: 'Futu',
        brokerType: 'futu',
        connected: true,
        subscriptionsCount: 3,
      });
      expect(api.isConnected('futu-default')).toBe(true);
    });

    it('should return false for disconnected broker', () => {
      provider.getConnectionStatus = vi.fn().mockReturnValue(null);
      expect(api.isConnected('unknown')).toBe(false);
    });
  });

  describe('getRegisteredBrokers()', () => {
    it('should return all registered configs', () => {
      const brokers = api.getRegisteredBrokers();
      expect(brokers).toHaveLength(2);
    });
  });
});
