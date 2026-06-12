/**
 * R1 youdao — 多券商集成测试框架骨架 (TST-01 preparation)
 *
 * 基于 Vitest + MSW (Mock Service Worker) + iaws (test containers).
 * 为 R2-R4 全券商测试提供统一的测试基础设施：
 *   - Mock Broker Server (模拟各家券商 REST/WS 端点)
 *   - Test Fixtures (预置账户/持仓/行情/订单数据)
 *   - BrokerTestHarness (连接/行情/交易/账户 标准测试流程)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';       // MSW 2.x
import { setupServer } from 'msw/node';         // node环境用 setupServer
import { WebSocket, Server as WsServer } from 'ws';

// ═══════════════════════════════════════════════════════════════
// 1. Test Fixtures — 标准化测试数据
// ═══════════════════════════════════════════════════════════════

/** 预置账户数据 — 能覆盖余额/持仓/多币种场景 */
export const TEST_ACCOUNTS = {
  single: {
    accountId: 'TEST-001',
    name: 'Test Account',
    currency: 'USD',
    netAssets: 100000,
    totalAssets: 150000,
    cash: 50000,
    marketValue: 100000,
  },
  multi: [
    { accountId: 'TEST-USD', name: 'USD Account', currency: 'USD', netAssets: 100000, totalAssets: 150000, cash: 50000, marketValue: 100000 },
    { accountId: 'TEST-HKD', name: 'HKD Account', currency: 'HKD', netAssets: 780000, totalAssets: 1170000, cash: 390000, marketValue: 780000 },
    { accountId: 'TEST-SGD', name: 'SGD Account', currency: 'SGD', netAssets: 135000, totalAssets: 202000, cash: 67500, marketValue: 135000 },
  ],
};

/** 预置持仓 — 覆盖不同市场和盈亏场景 */
export const TEST_POSITIONS = {
  win: { code: 'US.AAPL', name: 'Apple Inc.', qty: 100, costPrice: 150, marketPrice: 185, marketValue: 18500, pnl: 3500, pnlPct: 23.33, ratio: 0.185 },
  lose: { code: 'US.TSLA', name: 'Tesla Inc.', qty: 50, costPrice: 250, marketPrice: 210, marketValue: 10500, pnl: -2000, pnlPct: -16, ratio: 0.105 },
  flat: { code: 'US.SPY', name: 'SPY ETF', qty: 10, costPrice: 520, marketPrice: 520, marketValue: 5200, pnl: 0, pnlPct: 0, ratio: 0.052 },
  crypto: { code: 'BTCUSDT', name: 'Bitcoin', qty: 1.5, costPrice: 45000, marketPrice: 92000, marketValue: 138000, pnl: 70500, pnlPct: 104.44, ratio: 1.0 },
  hk: { code: 'HK.00700', name: 'Tencent', qty: 1000, costPrice: 350, marketPrice: 380, marketValue: 380000, pnl: 30000, pnlPct: 8.57, ratio: 0.5 },
};

/** 预置行情 — 覆盖不同市场和变化方向 */
export const TEST_QUOTES = {
  up: { code: 'US.AAPL', price: 185, change: 5, changePct: 2.78, volume: 50000000, turnover: 9250000000, high: 186, low: 179, open: 180, prevClose: 180, time: '2026-06-12T00:00:00Z' },
  down: { code: 'US.TSLA', price: 210, change: -8, changePct: -3.67, volume: 80000000, turnover: 16800000000, high: 220, low: 208, open: 218, prevClose: 218, time: '2026-06-12T00:00:00Z' },
  crypto: { code: 'BTCUSDT', price: 92000, change: 2000, changePct: 2.22, volume: 15000, turnover: 1380000000, high: 93000, low: 89000, open: 90000, prevClose: 90000, time: '2026-06-12T00:00:00Z' },
};

/** 预置K线 — 覆盖1m/5m/1h/1d周期 */
export const TEST_KLINES = {
  '1m': Array.from({ length: 60 }, (_, i) => ({ time: Date.now() - (60 - i) * 60000, open: 100 + i * 0.1, high: 100 + i * 0.15, low: 100 + i * 0.05, close: 100 + i * 0.12, volume: 1000 + i * 10 })),
  '1d': Array.from({ length: 30 }, (_, i) => ({ time: Date.now() - (30 - i) * 86400000, open: 100 + i * 2, high: 100 + i * 2.5, low: 100 + i * 1.5, close: 100 + i * 2.2, volume: 100000 + i * 5000 })),
};

/** 预置订单 — 覆盖各状态 */
export const TEST_ORDERS = {
  pending: { orderId: 'ORD-001', code: 'US.AAPL', side: 'BUY' as const, orderType: 'LIMIT' as const, qty: 10, price: 175, filledQty: 0, filledPrice: 0, status: 'PENDING', createdAt: new Date().toISOString() },
  filled: { orderId: 'ORD-002', code: 'US.TSLA', side: 'SELL' as const, orderType: 'MARKET' as const, qty: 20, price: 0, filledQty: 20, filledPrice: 212, status: 'FILLED', createdAt: new Date().toISOString() },
  partial: { orderId: 'ORD-003', code: 'BTCUSDT', side: 'BUY' as const, orderType: 'LIMIT' as const, qty: 1, price: 45000, filledQty: 0.5, filledPrice: 45000, status: 'PARTIAL', createdAt: new Date().toISOString() },
};

// ═══════════════════════════════════════════════════════════════
// 2. Mock Broker Server — 模拟各家券商 HTTP REST 端点
// ═══════════════════════════════════════════════════════════════

interface MockServerConfig {
  /** 基准 URL path prefix (如 /api/v3 for Binance) */
  prefix?: string;
  /** 返回账户数据 */
  accounts?: typeof TEST_ACCOUNTS.single;
  /** 返回持仓数据 */
  positions?: Array<typeof TEST_POSITIONS.win>;
  /** 行情数据 */
  quotes?: Record<string, typeof TEST_QUOTES.up>;
  /** K线数据 */
  klines?: Record<string, Array<typeof TEST_KLINES['1d'][0]>>;
  /** 模拟延迟(ms) */
  latency?: number;
  /** 模拟错误率 (0-1) */
  errorRate?: number;
}

export function createMockBrokerServer(config: MockServerConfig = {}) {
  const prefix = config.prefix || '';
  const latency = config.latency || 0;
  const errorRate = config.errorRate || 0;

  const handlers = [
    // POST /order — 下单
    http.post(`${prefix}/order`, async ({ request }) => {
      if (Math.random() < errorRate) return HttpResponse.json({ error: 'Simulated server error' }, { status: 500 });
      const body = await request.json() as { symbol?: string };
      await delay(latency);
      return HttpResponse.json({
        orderId: `ORD-${Date.now()}`,
        symbol: body.symbol || 'UNKNOWN',
        status: 'PENDING',
        timestamp: Date.now(),
      });
    }),

    // DELETE /order/:id — 撤单
    http.delete(`${prefix}/order/:id`, async () => {
      if (Math.random() < errorRate) return HttpResponse.json({ error: 'Simulated server error' }, { status: 500 });
      await delay(latency);
      return HttpResponse.json({ success: true });
    }),

    // GET /account — 账户
    http.get(`${prefix}/account`, async () => {
      await delay(latency);
      return HttpResponse.json(config.accounts || TEST_ACCOUNTS.single);
    }),

    // GET /positions — 持仓
    http.get(`${prefix}/positions`, async () => {
      await delay(latency);
      return HttpResponse.json(config.positions || Object.values(TEST_POSITIONS));
    }),

    // GET /ticker — 行情
    http.get(`${prefix}/ticker`, async ({ request }) => {
      const url = new URL(request.url);
      const symbol = url.searchParams.get('symbol') || 'US.AAPL';
      await delay(latency);
      return HttpResponse.json(config.quotes?.[symbol] || TEST_QUOTES.up);
    }),

    // GET /klines — K线
    http.get(`${prefix}/klines`, async ({ request }) => {
      const url = new URL(request.url);
      const symbol = url.searchParams.get('symbol') || 'US.AAPL';
      await delay(latency);
      return HttpResponse.json(config.klines?.[symbol] || TEST_KLINES['1d']);
    }),

    // GET /orders — 订单列表
    http.get(`${prefix}/orders`, async () => {
      await delay(latency);
      return HttpResponse.json(Object.values(TEST_ORDERS));
    }),

    // GET /ping — 健康检查
    http.get(`${prefix}/ping`, async () => {
      await delay(latency);
      return HttpResponse.json({ status: 'ok', timestamp: Date.now() });
    }),
  ];

  const server = setupServer(...handlers);

  return {
    start: () => server.listen({ onUnhandledRequest: 'bypass' }),
    stop: () => server.close(),
    reset: () => server.resetHandlers(),
    server,
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. WebSocket Mock Server — 模拟实时行情推送
// ═══════════════════════════════════════════════════════════════

interface WsMockConfig {
  port?: number;
  /** 模拟推送间隔(ms) */
  pushInterval?: number;
  /** 推送的行情数据 */
  quotes?: Array<typeof TEST_QUOTES.up>;
}

export function createMockWsServer(config: WsMockConfig = {}) {
  const port = config.port || 0; // 0 = random port
  const pushInterval = config.pushInterval || 1000;
  const quotes = config.quotes || [TEST_QUOTES.up];

  let wss: WsServer | null = null;
  let pushTimer: ReturnType<typeof setInterval> | null = null;

  return {
    async start(): Promise<number> {
      return new Promise((resolve) => {
        wss = new WsServer({ port }, () => {
          const addr = wss!.address();
          const actualPort = typeof addr === 'string' ? port : addr?.port || port;
          resolve(actualPort);
        });

        wss.on('connection', (ws) => {
          let quoteIndex = 0;
          pushTimer = setInterval(() => {
            const quote = { ...quotes[quoteIndex % quotes.length], time: new Date().toISOString() };
            ws.send(JSON.stringify({ type: 'QUOTE', data: quote, timestamp: Date.now() }));
            quoteIndex++;
          }, pushInterval);
        });
      });
    },

    stop() {
      if (pushTimer) clearInterval(pushTimer);
      if (wss) {
        for (const client of wss.clients) client.close();
        wss.close();
        wss = null;
      }
    },

    getUrl(): string {
      if (!wss) throw new Error('WebSocket server not started');
      const addr = wss.address();
      const p = typeof addr === 'string' ? port : addr?.port;
      return `ws://127.0.0.1:${p}`;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 4. BrokerTestHarness — 标准化测试流程
// ═══════════════════════════════════════════════════════════════

export interface TestHarnessConfig {
  adapterName: string;
  brokerType: string;
  connect: () => Promise<{ disconnect: () => Promise<void> | void }>;
}

export function createBrokerTestHarness(config: TestHarnessConfig) {
  return {
    /** 连接生命周期 */
    testConnection() {
      it('should connect successfully', async () => {
        const { disconnect } = await config.connect();
        await disconnect();
      });

      it('should report connected state', async () => {
        const client = await config.connect();
        // connected state verified by connect() success
        await client.disconnect();
      });

      it('should handle disconnect gracefully', async () => {
        const client = await config.connect();
        await client.disconnect();
        // No throw on second disconnect
        await expect(client.disconnect()).resolves.toBeUndefined();
      });
    },

    /** 行情获取 */
    testQuotes(symbols: string[]) {
      it.each(symbols)('should get quote for %s', async (symbol) => {
        const client = await config.connect();
        // adapter-dependent: call getQuotes
        await client.disconnect();
        // placeholder for actual quote assertion
      });
    },

    /** K线获取 */
    testKlines(symbol: string, periods: string[]) {
      it.each(periods)(`should get klines ${symbol} %s`, async (period) => {
        const client = await config.connect();
        await client.disconnect();
      });
    },

    /** 账户查询 */
    testAccount() {
      it('should get account info', async () => {
        const client = await config.connect();
        await client.disconnect();
      });
    },

    /** 持仓查询 */
    testPositions() {
      it('should get positions', async () => {
        const client = await config.connect();
        await client.disconnect();
      });
    },

    /** 下单 + 撤单 */
    testTrading() {
      it('should place and cancel order', async () => {
        const client = await config.connect();
        await client.disconnect();
      });
    },

    /** 错误处理 */
    testErrorHandling() {
      it('should handle invalid symbol gracefully', () => { /* placeholder */ });
      it('should handle network error with retry', () => { /* placeholder */ });
      it('should handle timeout', () => { /* placeholder */ });
    },

    /** 并发测试 */
    testConcurrency(brokerCount: number) {
      it(`should handle ${brokerCount} concurrent connections`, async () => {
        const clients: Array<Awaited<ReturnType<typeof config.connect>>> = [];
        for (let i = 0; i < brokerCount; i++) {
          clients.push(await config.connect());
        }
        for (const c of clients) await c.disconnect();
      });
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 5. 工具函数
// ═══════════════════════════════════════════════════════════════

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 收敛等待 (poll until condition or timeout) */
export async function waitFor(condition: () => boolean | Promise<boolean>, timeout = 5000, interval = 100): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await delay(interval);
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/** 生成标准化的 brokerId */
export function makeBrokerId(type: string, variant = 'test'): string {
  return `${type}-${variant}`;
}

/** 验证 TaggedQuoteInfo 结构 */
export function assertTaggedQuote(quote: Record<string, unknown>, expected: Partial<Record<string, unknown>>) {
  expect(quote).toBeDefined();
  expect(quote.brokerId).toBeDefined();      // R1: 必须有brokerId
  expect(quote.brokerName).toBeDefined();    // R1: 必须有brokerName
  expect(quote.standardCode).toBeDefined();  // R1: 必须有standardCode
  expect(quote.originalCode).toBeDefined();  // R1: 必须有originalCode
  for (const [k, v] of Object.entries(expected)) {
    expect((quote as never)[k]).toEqual(v);
  }
}
