/**
 * R114 youdao QTE-22 — Tick API适配+测试 (8h)
 *
 * 加密4家(Binance/OKX/Bybit/Bitget) + 老虎 + 富途 + IB 逐笔成交验证
 * Mock tick生成 + 字段验证 + 序列号连续性 + 时间戳精度
 */
import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════
// Tick 类型定义
// ═══════════════════════════════════════════════

interface Tick {
  symbol: string;
  tradeId: number;
  price: number;
  quantity: number;
  timestamp: number; // UTC ms
  side: 'BUY' | 'SELL' | 'UNKNOWN';
  exchange: string;
  isLargeTrade?: boolean;
}

interface TickBuffer {
  symbol: string;
  buffer: Tick[];
  maxSize: number;
  lastTradeId: number;
  startTime: number;
  endTime: number;
}

// ═══════════════════════════════════════════════
// Tick 端点定义 (7 exchange)
// ═══════════════════════════════════════════════

const TICK_ENDPOINTS = {
  binance: { rest: 'GET /api/v3/trades', ws: 'wss://stream.binance.com/ws/{symbol}@trade' },
  okx: { rest: 'GET /api/v5/market/trades', ws: 'wss://ws.okx.com/v5/public' },
  bybit: { rest: 'GET /v5/market/recent-trade', ws: 'wss://stream.bybit.com/v5/public/spot' },
  bitget: { rest: 'GET /api/v2/spot/market/trades', ws: 'wss://ws.bitget.com/v2/ws/public' },
  tiger: { rest: 'Tiger PushClient WS', ws: 'Tiger PushClient WS (market_trade)' },
  futu: { rest: 'OpenD CMD 3010 Qot_GetTicker', ws: 'OpenD protoID 3011 push' },
  ib: { rest: 'reqTickByTickData(Last)', ws: 'IB TWS tickByTick' },
} as const;

// ═══════════════════════════════════════════════
// Mock Tick 生成
// ═══════════════════════════════════════════════

function generateTicks(symbol: string, exchange: string, count: number, basePrice: number): Tick[] {
  const ticks: Tick[] = [];
  const now = Date.now();
  let price = basePrice;
  let tradeId = Math.floor(Math.random() * 1e9);

  for (let i = 0; i < count; i++) {
    const delta = (Math.random() - 0.5) * basePrice * 0.0005;
    price += delta;
    const quantity = Math.random() * 10;
    const side: Tick['side'] = delta > 0 ? 'BUY' : delta < -0.0001 ? 'SELL' : 'UNKNOWN';

    ticks.push({
      symbol,
      tradeId: tradeId++,
      price: +price.toFixed(2),
      quantity: +quantity.toFixed(5),
      timestamp: now + i * (50 + Math.random() * 450), // avg 250ms between trades
      side,
      exchange,
      isLargeTrade: quantity > 5,
    });
  }
  return ticks;
}

// ═══════════════════════════════════════════════
// Tick 验证工具
// ═══════════════════════════════════════════════

function validateTick(t: Tick): string[] {
  const errors: string[] = [];
  if (!t.symbol) errors.push('Missing symbol');
  if (typeof t.tradeId !== 'number') errors.push('Invalid tradeId');
  if (typeof t.price !== 'number' || t.price <= 0) errors.push('Invalid price');
  if (typeof t.quantity !== 'number' || t.quantity < 0) errors.push('Invalid quantity');
  if (typeof t.timestamp !== 'number' || t.timestamp < 1e12) errors.push('Invalid timestamp');
  if (!['BUY', 'SELL', 'UNKNOWN'].includes(t.side)) errors.push('Invalid side');
  if (!t.exchange) errors.push('Missing exchange');
  return errors;
}

function validateTickBuffer(buf: TickBuffer): string[] {
  const errors: string[] = [];
  if (!buf.symbol) errors.push('Missing symbol');
  if (!Array.isArray(buf.buffer)) errors.push('buffer not array');
  if (buf.maxSize < 1000) errors.push('maxSize too small');
  if (buf.buffer.length > buf.maxSize) errors.push('Buffer overflow');

  // Sequence continuity
  for (let i = 1; i < buf.buffer.length; i++) {
    if (buf.buffer[i].tradeId <= buf.buffer[i - 1].tradeId) {
      errors.push(`TradeId not monotonic at index ${i}`);
      break;
    }
  }

  // Timestamp monotonic
  for (let i = 1; i < buf.buffer.length; i++) {
    if (buf.buffer[i].timestamp < buf.buffer[i - 1].timestamp) {
      errors.push(`Timestamp not monotonic at index ${i}`);
      break;
    }
  }

  // Large trade detection
  const largeTrades = buf.buffer.filter(t => t.isLargeTrade);
  if (largeTrades.length === 0 && buf.buffer.length > 50) {
    errors.push('No large trades detected (unlikely with random data)');
  }

  return errors;
}

function createTickBuffer(symbol: string, maxSize: number): TickBuffer {
  return {
    symbol,
    buffer: [],
    maxSize,
    lastTradeId: 0,
    startTime: Date.now(),
    endTime: Date.now(),
  };
}

function pushToBuffer(buf: TickBuffer, ticks: Tick[]): void {
  for (const t of ticks) {
    buf.buffer.push(t);
    if (t.tradeId > buf.lastTradeId) buf.lastTradeId = t.tradeId;
    if (t.timestamp < buf.startTime) buf.startTime = t.timestamp;
    if (t.timestamp > buf.endTime) buf.endTime = t.timestamp;
  }
  // Circular buffer eviction
  while (buf.buffer.length > buf.maxSize) buf.buffer.shift();
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('QTE-22.1: Tick Endpoint Definitions', () => {
  const exchanges = Object.keys(TICK_ENDPOINTS);

  it('all 7 exchanges have REST and WS endpoints', () => {
    expect(exchanges.length).toBe(7);
    for (const ex of exchanges) {
      const def = TICK_ENDPOINTS[ex as keyof typeof TICK_ENDPOINTS];
      expect(def.rest).toBeDefined();
      expect(def.ws).toBeDefined();
    }
  });

  it('crypto exchanges use REST/WS pattern', () => {
    for (const ex of ['binance', 'okx', 'bybit', 'bitget'] as const) {
      expect(TICK_ENDPOINTS[ex].rest.startsWith('GET')).toBe(true);
      expect(TICK_ENDPOINTS[ex].ws.includes('ws://') || TICK_ENDPOINTS[ex].ws.includes('wss://')).toBe(true);
    }
  });

  it('futu OpenD uses protoID 3010/3011', () => {
    expect(TICK_ENDPOINTS.futu.rest).toContain('3010');
    expect(TICK_ENDPOINTS.futu.ws).toContain('3011');
  });

  it('IB uses tickByTick', () => {
    expect(TICK_ENDPOINTS.ib.rest).toContain('tickByTick');
  });

  it('tiger uses PushClient', () => {
    expect(TICK_ENDPOINTS.tiger.rest).toContain('PushClient');
  });
});

describe('QTE-22.2: Mock Tick Generation', () => {
  const ticks = generateTicks('BTCUSDT', 'binance', 200, 92000);

  it('generates correct number of ticks', () => {
    expect(ticks.length).toBe(200);
  });

  it('all ticks pass validation', () => {
    for (const t of ticks) {
      const errors = validateTick(t);
      expect(errors, `Tick ${t.tradeId}: ${errors.join(', ')}`).toEqual([]);
    }
  });

  it('tradeIds are monotonically increasing', () => {
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].tradeId).toBeGreaterThan(ticks[i - 1].tradeId);
    }
  });

  it('timestamps are monotonically increasing', () => {
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].timestamp).toBeGreaterThanOrEqual(ticks[i - 1].timestamp);
    }
  });

  it('trades have correct exchange label', () => {
    expect(ticks.every(t => t.exchange === 'binance')).toBe(true);
  });

  it('side distribution is reasonable', () => {
    const buys = ticks.filter(t => t.side === 'BUY').length;
    const sells = ticks.filter(t => t.side === 'SELL').length;
    expect(buys + sells).toBeGreaterThan(ticks.length * 0.5);
  });

  it('price range is within ±2% of base', () => {
    const prices = ticks.map(t => t.price);
    expect(Math.max(...prices)).toBeLessThan(92000 * 1.02);
    expect(Math.min(...prices)).toBeGreaterThan(92000 * 0.98);
  });
});

describe('QTE-22.3: Tick Buffer Management', () => {
  it('creates empty buffer correctly', () => {
    const buf = createTickBuffer('BTCUSDT', 5000);
    expect(buf.symbol).toBe('BTCUSDT');
    expect(buf.maxSize).toBe(5000);
    expect(buf.buffer).toEqual([]);
  });

  it('pushes ticks and respects max size', () => {
    const buf = createTickBuffer('BTCUSDT', 100);
    const ticks1 = generateTicks('BTCUSDT', 'binance', 80, 92000);
    pushToBuffer(buf, ticks1);
    expect(buf.buffer.length).toBe(80);

    const ticks2 = generateTicks('BTCUSDT', 'binance', 50, 92000);
    pushToBuffer(buf, ticks2);
    expect(buf.buffer.length).toBe(100); // capped at maxSize
  });

  it('circular buffer evicts oldest entries', () => {
    const buf = createTickBuffer('BTCUSDT', 100);
    const firstBatch = generateTicks('BTCUSDT', 'binance', 80, 92000);
    pushToBuffer(buf, firstBatch);

    const firstTradeId = firstBatch[0].tradeId;
    const secondBatch = generateTicks('BTCUSDT', 'binance', 50, 92000);
    pushToBuffer(buf, secondBatch);

    // First entry should be evicted
    expect(buf.buffer[0].tradeId).toBeGreaterThan(firstTradeId);
    expect(buf.buffer.length).toBe(100);
  });

  it('tracks start/end timestamps', () => {
    const buf = createTickBuffer('BTCUSDT', 1000);
    const ticks = generateTicks('BTCUSDT', 'binance', 100, 92000);
    pushToBuffer(buf, ticks);

    expect(buf.startTime).toBeGreaterThan(0);
    expect(buf.endTime).toBeGreaterThanOrEqual(buf.startTime);
  });

  it('tracks lastTradeId correctly', () => {
    const buf = createTickBuffer('BTCUSDT', 1000);
    const ticks = generateTicks('BTCUSDT', 'binance', 50, 92000);
    pushToBuffer(buf, ticks);

    const maxId = Math.max(...ticks.map(t => t.tradeId));
    expect(buf.lastTradeId).toBe(maxId);
  });
});

describe('QTE-22.4: Multi-Exchange Tick Comparison', () => {
  const exchanges = ['binance', 'okx', 'bybit', 'bitget'] as const;
  const allTicks: Record<string, Tick[]> = {};

  for (const ex of exchanges) {
    allTicks[ex] = generateTicks('BTCUSDT', ex, 100, 92000);
  }

  it.each(exchanges)('%s: all ticks pass validation', (ex) => {
    for (const t of allTicks[ex]) {
      const errors = validateTick(t);
      expect(errors).toEqual([]);
    }
  });

  it('all exchanges generate BTCUSDT within reasonable range', () => {
    for (const [ex, ticks] of Object.entries(allTicks)) {
      const avg = ticks.reduce((s, t) => s + t.price, 0) / ticks.length;
      expect(avg, `${ex} avg price: ${avg}`).toBeGreaterThan(90000);
      expect(avg).toBeLessThan(94000);
    }
  });

  it('cross-exchange timestamps are within same time window', () => {
    const allTimes = Object.values(allTicks).flat().map(t => t.timestamp);
    const range = Math.max(...allTimes) - Math.min(...allTimes);
    expect(range).toBeLessThan(60_000); // within 1 minute
  });
});

describe('QTE-22.5: Tick Data Quality', () => {
  const ticks = generateTicks('BTCUSDT', 'binance', 1000, 92000);

  it('no duplicate tradeIds', () => {
    const ids = ticks.map(t => t.tradeId);
    expect(new Set(ids).size).toBe(ticks.length);
  });

  it('timestamp precision is milliseconds', () => {
    for (const t of ticks) {
      expect(Number.isInteger(t.timestamp)).toBe(true);
      expect(t.timestamp).toBeGreaterThan(1.7e12); // should be in 2026
    }
  });

  it('large trades are properly flagged', () => {
    const flagged = ticks.filter(t => t.isLargeTrade);
    const actualLarge = ticks.filter(t => t.quantity > 5);
    expect(flagged.length).toBe(actualLarge.length);
  });

  it('zero quantity ticks should not exist', () => {
    for (const t of ticks) {
      expect(t.quantity).toBeGreaterThan(0);
    }
  });
});
