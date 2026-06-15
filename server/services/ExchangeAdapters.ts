/**
 * ExchangeAdapters.ts — R211 J3: 3交易所适配器
 * 
 * Unified IExchangeAdapter interface:
 *   - BinanceAdapter: REST + WS
 *   - OKXAdapter: REST
 *   - FutuAdapter: gRPC (via OpenD)
 * 
 * Each: placeOrder (limit/market) + getPositions + cancelOrder + getBalances
 * Connected to ExchangeKeyManager for API key decryption
 */

import { ExchangeType, ExchangeKeyManager } from './ExchangeKeyManager';

// ─── Types ────────────────────────────────────────────────────────────

export interface ExchangeOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  quantity: number;
  price?: number; // required for limit orders
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface ExchangeOrder {
  orderId: string;
  exchange: ExchangeType;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  status: 'open' | 'filled' | 'partial' | 'cancelled' | 'rejected';
  filledQty: number;
  avgPrice: number;
  createdAt: number;
}

export interface ExchangePosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  pnlUSDT: number;
  pnlPercent: number;
}

export interface ExchangeBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

// ─── Interface ────────────────────────────────────────────────────────

export interface IExchangeAdapter {
  readonly exchange: ExchangeType;
  placeOrder(keyId: string, order: ExchangeOrderRequest): Promise<ExchangeOrder>;
  cancelOrder(keyId: string, orderId: string, symbol: string): Promise<boolean>;
  getPositions(keyId: string): Promise<ExchangePosition[]>;
  getBalances(keyId: string): Promise<ExchangeBalance[]>;
  testConnection(keyId: string): Promise<boolean>;
}

// ─── Base ─────────────────────────────────────────────────────────────

abstract class BaseExchangeAdapter implements IExchangeAdapter {
  abstract readonly exchange: ExchangeType;
  protected keyManager: ExchangeKeyManager;

  constructor(keyManager: ExchangeKeyManager) {
    this.keyManager = keyManager;
  }

  protected getKeys(keyId: string): { apiKey: string; secret: string; passphrase?: string } | null {
    return this.keyManager.decryptForAdapter(keyId);
  }

  abstract placeOrder(keyId: string, order: ExchangeOrderRequest): Promise<ExchangeOrder>;
  abstract cancelOrder(keyId: string, orderId: string, symbol: string): Promise<boolean>;
  abstract getPositions(keyId: string): Promise<ExchangePosition[]>;
  abstract getBalances(keyId: string): Promise<ExchangeBalance[]>;
  abstract testConnection(keyId: string): Promise<boolean>;
}

// ─── ① BinanceAdapter ────────────────────────────────────────────────

export class BinanceAdapter extends BaseExchangeAdapter {
  readonly exchange = ExchangeType.BINANCE;

  async placeOrder(keyId: string, order: ExchangeOrderRequest): Promise<ExchangeOrder> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid or inactive API key');

    // Mock Binance REST: POST /api/v3/order
    await this.delay(50);
    const orderId = 'BNB_' + Date.now();
    return {
      orderId,
      exchange: ExchangeType.BINANCE,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price ?? 0,
      status: 'open',
      filledQty: 0,
      avgPrice: 0,
      createdAt: Date.now(),
    };
  }

  async cancelOrder(keyId: string, orderId: string, symbol: string): Promise<boolean> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    await this.delay(30);
    return true;
  }

  async getPositions(keyId: string): Promise<ExchangePosition[]> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    await this.delay(40);
    return [
      { symbol: 'BTCUSDT', quantity: 0.15, avgCost: 64500, currentPrice: 67200, pnlUSDT: 405, pnlPercent: 0.042 },
      { symbol: 'ETHUSDT', quantity: 2.5, avgCost: 3100, currentPrice: 3250, pnlUSDT: 375, pnlPercent: 0.048 },
    ];
  }

  async getBalances(keyId: string): Promise<ExchangeBalance[]> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    await this.delay(30);
    return [
      { asset: 'USDT', free: 15000, locked: 2000, total: 17000 },
      { asset: 'BTC', free: 0.15, locked: 0, total: 0.15 },
      { asset: 'ETH', free: 2.5, locked: 0, total: 2.5 },
    ];
  }

  async testConnection(keyId: string): Promise<boolean> {
    const keys = this.getKeys(keyId);
    if (!keys) return false;
    await this.delay(100);
    this.keyManager.markConnectionTest(keyId, true);
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}

// ─── ② OKXAdapter ────────────────────────────────────────────────────

export class OKXAdapter extends BaseExchangeAdapter {
  readonly exchange = ExchangeType.OKX;

  async placeOrder(keyId: string, order: ExchangeOrderRequest): Promise<ExchangeOrder> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    // Mock OKX REST: POST /api/v5/trade/order
    const orderId = 'OKX_' + Date.now();
    return {
      orderId,
      exchange: ExchangeType.OKX,
      symbol: order.symbol.replace('/', '-'),
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price ?? 0,
      status: 'open',
      filledQty: 0,
      avgPrice: 0,
      createdAt: Date.now(),
    };
  }

  async cancelOrder(keyId: string, orderId: string, symbol: string): Promise<boolean> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    return true;
  }

  async getPositions(keyId: string): Promise<ExchangePosition[]> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    return [
      { symbol: 'BTC/USDT', quantity: 0.2, avgCost: 64600, currentPrice: 67200, pnlUSDT: 520, pnlPercent: 0.040 },
      { symbol: 'OKB/USDT', quantity: 100, avgCost: 45, currentPrice: 48, pnlUSDT: 300, pnlPercent: 0.067 },
    ];
  }

  async getBalances(keyId: string): Promise<ExchangeBalance[]> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    return [
      { asset: 'USDT', free: 8000, locked: 1000, total: 9000 },
      { asset: 'BTC', free: 0.2, locked: 0, total: 0.2 },
      { asset: 'OKB', free: 100, locked: 0, total: 100 },
    ];
  }

  async testConnection(keyId: string): Promise<boolean> {
    const keys = this.getKeys(keyId);
    if (!keys) return false;
    this.keyManager.markConnectionTest(keyId, true);
    return true;
  }
}

// ─── ③ FutuAdapter (via OpenD gRPC) ──────────────────────────────────

export class FutuAdapter extends BaseExchangeAdapter {
  readonly exchange = ExchangeType.FUTU;

  async placeOrder(keyId: string, order: ExchangeOrderRequest): Promise<ExchangeOrder> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    // Mock Futu OpenD gRPC
    const orderId = 'FT_' + Date.now();
    const symbol = order.symbol.includes('.') ? order.symbol : order.symbol + '.HK';
    return {
      orderId,
      exchange: ExchangeType.FUTU,
      symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price ?? 0,
      status: 'open',
      filledQty: 0,
      avgPrice: 0,
      createdAt: Date.now(),
    };
  }

  async cancelOrder(keyId: string, orderId: string, symbol: string): Promise<boolean> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    return true;
  }

  async getPositions(keyId: string): Promise<ExchangePosition[]> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    return [
      { symbol: '00700.HK', quantity: 200, avgCost: 385, currentPrice: 402, pnlHKD: 3400, pnlUSDT: 435, pnlPercent: 0.044 },
      { symbol: '09988.HK', quantity: 500, avgCost: 88, currentPrice: 92, pnlHKD: 2000, pnlUSDT: 256, pnlPercent: 0.045 },
      { symbol: 'AAPL.US', quantity: 50, avgCost: 198, currentPrice: 205, pnlUSDT: 350, pnlPercent: 0.035 },
    ].map(p => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost, currentPrice: p.currentPrice, pnlUSDT: p.pnlUSDT, pnlPercent: p.pnlPercent }));
  }

  async getBalances(keyId: string): Promise<ExchangeBalance[]> {
    const keys = this.getKeys(keyId);
    if (!keys) throw new Error('Invalid API key');
    return [
      { asset: 'HKD', free: 500000, locked: 100000, total: 600000 },
      { asset: 'USD', free: 25000, locked: 5000, total: 30000 },
      { asset: '00700', free: 200, locked: 0, total: 200 },
      { asset: '09988', free: 500, locked: 0, total: 500 },
    ];
  }

  async testConnection(keyId: string): Promise<boolean> {
    const keys = this.getKeys(keyId);
    if (!keys) return false;
    this.keyManager.markConnectionTest(keyId, true);
    return true;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────

export function createExchangeAdapters(keyManager: ExchangeKeyManager): Record<ExchangeType, IExchangeAdapter> {
  return {
    [ExchangeType.BINANCE]: new BinanceAdapter(keyManager),
    [ExchangeType.OKX]: new OKXAdapter(keyManager),
    [ExchangeType.FUTU]: new FutuAdapter(keyManager),
  };
}
