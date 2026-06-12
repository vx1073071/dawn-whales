<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R4
owner: QClaw
purpose: 多券商接入开发者完整参考 — 架构/继承/新建/注册/示例
-->

# Dawn Whales 多券商接入开发者文档

> **版本**: v1.12.0 | **轮次**: R4 Final | **维护**: QClaw (文档虾)
> **用途**: 凭本文档可从头创建任何新的券商适配器并注册到 BrokerManagerV2

---

## 目录

1. [架构概览](#一架构概览)
2. [继承体系](#二继承体系)
3. [接口规范 (IBrokerAdapterV2)](#三接口规范)
4. [四步新建 Adapter](#四四步新建-adapter)
5. [BrokerManagerV2 注册](#五brokermanagerv2-注册)
6. [IPC 集成](#六ipc-集成)
7. [完整示例代码](#七完整示例代码)
8. [测试规范](#八测试规范)
9. [常见问题](#九常见问题)
10. [16 家适配器登记表](#十16-家适配器登记表)

---

## 一、架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│                        Renderer (React)                          │
│  WatchlistV2 │ PortfolioAggregate │ ArbitragePanel │ OrdersPanel  │
└──────────────────────┬───────────────────────────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────▼───────────────────────────────────────────┐
│                    BrokerManagerV2                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ broker:  │  │ broker:  │  │ broker:  │  │ broker:  │  ...16 │
│  │ futu     │  │ schwab   │  │ binance  │  │ ibkr     │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │              │             │              │               │
│  ┌────▼────────┐ ┌───▼──────────┐ ┌▼──────────┐ ┌▼────────────┐ │
│  │FutuAdapter   │ │SchwabAdapter │ │Binance    │ │IBKRAdapter  │ │
│  │(OpenDBase)   │ │(OAuthBase)   │ │(DirectBase)│ │(DirectBase) │ │
│  └────┬────────┘ └───┬──────────┘ └┬──────────┘ └┬────────────┘ │
│       │               │             │              │              │
│  ┌────▼───────────────▼─────────────▼──────────────▼──────────┐  │
│  │              CodeNormalizer + Aggregators                    │  │
│  │  QuoteAggregator │ SmartOrderRouter │ CrossBrokerRiskEngine │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 分层说明

| 层 | 职责 | 实现 |
|----|------|------|
| **Renderer** | UI 交互，调用 IPC | React 组件 |
| **IPC Bridge** | Renderer ↔ Main 通信 | `contextBridge` + `ipcMain.handle` |
| **BrokerManagerV2** | 多券商生命周期 + 聚合 | `electron/broker/BrokerManagerV2.ts` |
| **Adapter** | 单券商协议适配 | `electron/broker/adapters/*.ts` |
| **Aggregator** | 多券商数据聚合 | `QuoteAggregator/SmartOrderRouter/CrossBrokerRiskEngine` |

---

## 二、继承体系

### 2.1 四种基类

```
                      IBrokerAdapter (Interface)
                              │
              ┌───────────────┼───────────────┬──────────────┐
              │               │               │              │
     DirectAdapterBase   BridgeAdapterBase   OAuthBrokerBase   CryptoAdapterBase
     (REST API直连)      (云端JobQueue)     (OAuth认证)      (加密交易所)
              │               │               │              │
     ┌────────┴──┐     ┌──────┴──────┐    ┌───┴────────┐   ┌──┴──────────┐
     │IBKR       │     │Tiger        │    │Schwab      │   │Binance      │
     │MT5        │     │VBKR(华盛)   │    │E*TRADE     │   │OKX          │
     │Robinhood  │     │uSMART(盈立) │    │eToro       │   │Bybit        │
     └───────────┘     └─────────────┘    │Webull      │   │Bitget       │
                                          └────────────┘   └─────────────┘
```

### 2.2 基类选择决策树

```
新券商有API吗？
├── 否 → 不可接入 (不支持 Selenium/OCR 维护)
└── 是
    ├── 需要 OAuth 认证？
    │   ├── OAuth2 → OAuthBrokerBase
    │   └── OAuth1.0a → OAuthBrokerBase (override _oauthVersion + _makeAuthRequest)
    ├── 加密交易所？
    │   └── CryptoAdapterBase (HMAC/ED25519签名 + WebSocket订阅)
    ├── 云端桥接(Bridge模式)？
    │   └── BridgeAdapterBase (Job Queue + 自建协议栈)
    └── REST API 直连？
        └── DirectAdapterBase
```

### 2.3 16 家适配器继承清单

| 券商 | Adapter 文件 | 继承基类 | 认证 | 市场 |
|------|-------------|---------|------|------|
| **富途 Futu** | `futu-adapter.ts` | OpenDBaseAdapter | OpenD二进制协议 | 港股 |
| **moomoo** | `moomoo-adapter.ts` | OpenDBaseAdapter | OpenD二进制协议 | 美股/港股 |
| **盈透 IBKR** | `ibkr-adapter.ts` | DirectAdapterBase | API Key | 全球 |
| **老虎 Tiger** | `tiger-adapter.ts` | BridgeAdapterBase | Protobuf+JWT | 美股/港股 |
| **长桥 Longbridge** | `longbridge-adapter.ts` | BridgeAdapterBase | OAuth2+JWT | 美股/港股/SG |
| **华盛 VBKR** | `vbkr-adapter.ts` | BridgeAdapterBase | Protobuf网关 | 美股/港股 |
| **盈立 uSMART** | `usmart-adapter.ts` | BridgeAdapterBase | API Key+Secret | 美股/港股 |
| **Schwab** | `SchwabAdapter.ts` | OAuthBrokerBase | OAuth2 PKCE | 美股 |
| **E\*TRADE** | `ETRADEAdapter.ts` | OAuthBrokerBase | OAuth1.0a | 美股 |
| **eToro** | `eToroAdapter.ts` | OAuthBrokerBase | OAuth2 | 美股/加密 |
| **Webull** | `WebullAdapter.ts` | OAuthBrokerBase | OAuth2 | 美股 |
| **Binance** | `binance-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | 加密 |
| **OKX** | `okx-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | 加密 |
| **Bybit** | `bybit-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | 加密 |
| **Bitget** | `bitget-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | 加密 |
| **MT5** | `mt5-adapter.ts` | DirectAdapterBase | auth-token | 外汇/CFD |

---

## 三、接口规范

### 3.1 IBrokerAdapter 核心方法 (必实现)

```typescript
interface IBrokerAdapter {
  id: string;
  name: string;

  // ── 连接生命周期 ──
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get connected(): boolean;

  // ── 行情 ──
  getQuotes(codes: string[]): Promise<QuoteInfo[]>;
  getKlines(code: string, period: string, count: number): Promise<KlineInfo[]>;

  // ── 账户 ──
  getAccounts(): Promise<AccountInfo[]>;
  getFunds(accountId: string): Promise<FundsInfo>;
  getPositions(accountId: string): Promise<PositionInfo[]>;

  // ── 交易 ──
  getOrders(accountId: string): Promise<OrderInfo[]>;
  placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }>;
  cancelOrder(orderId: string, accountId: string): Promise<void>;

  // ── 推送 ──
  subscribe?(codes: string[]): Promise<void>;
  unsubscribe?(codes: string[]): Promise<void>;
  onQuotePush?(callback: (quotes: QuoteInfo[]) => void): void;
  onDisconnect?(callback: () => void): void;

  // ── 杂项 ──
  requiresLocalGateway(): boolean;
  ping?(): Promise<{ latency: number; timestamp: number }>;
}
```

### 3.2 IBrokerAdapterV2 扩展方法

```typescript
interface IBrokerAdapterV2 extends IBrokerAdapter {
  getBrokerType(): BrokerType;
  getMarkets(): MarketType[];
  getSupportedOrderTypes(): Array<'MARKET'|'LIMIT'|'STOP'|'STOP_LIMIT'|'TRAILING_STOP'|'OCO'>;
  getConnectionStatus?(): BrokerConnectionStatus;
  getTradingPairs?(): Promise<TradingPairInfo[]>;
  subscribeAndPush?(codes: string[], callback: (quote: TaggedQuoteInfo) => void): Promise<void>;
}
```

### 3.3 基类提供的公共方法

所有基类(OAuthBrokerBase/DirectAdapterBase/BridgeAdapterBase/CryptoAdapterBase)都实现：

| 方法 | 实现方式 | 子类是否需要 override |
|------|---------|---------------------|
| `connect()` | 基类标准流程 | 通常需要 (认证+连接验证) |
| `disconnect()` | 清理连接状态 | 按需 (清理 WS/定时器) |
| `getQuotes(codes)` | 调用 `_makeApiRequest` + `_parseQuotes` | 否 |
| `getKlines(code, period, count)` | 调用 `_makeApiRequest` + `_parseKlines` | 否 |
| `getAccounts()` | 覆盖默认路径 | **是** (每个券商路径不同) |
| `requiresLocalGateway()` | 返回 `false` | 按需 |

---

## 四、四步新建 Adapter

### Step 1: 创建 Adapter 文件

文件路径: `electron/broker/adapters/{BrokerName}Adapter.ts`

```typescript
// ── DAWN WHALES — {BrokerName}Adapter ─────────────────────────
// Round: R{X} | Task: {task-id}
// Inherits: {BaseClass}
// API Base: {api-url}
// Markets: {markets}

import { OAuthBrokerBase, type OAuthBrokerConfig } from './OAuthBrokerBase';
// (或 DirectAdapterBase / BridgeAdapterBase / CryptoAdapterBase)

export interface {Broker}Config extends OAuthBrokerConfig {
  type: '{broker-type}';
  // 券商特定配置...
}

export class {Broker}Adapter extends OAuthBrokerBase {
  declare protected config: {Broker}Config;

  constructor(config: Partial<{Broker}Config> & { id: string; name: string }) {
    const merged = { ...DEFAULT_CONFIG, ...config } as {Broker}Config;
    super(merged as OAuthBrokerConfig);
    this.config = merged;
  }
}
```

### Step 2: 实现抽象方法

所有从基类继承的**抽象方法必须实现**：

| 方法 | 用途 | 示例 |
|------|------|------|
| `_oauthVersion()` | 返回 OAuth 版本 | `return '2.0'` |
| `_buildAuthHeaders(h)` | 添加券商标识头 | `h['x-api-key'] = config.key` |
| `_quotePath(codes)` | 构建行情 URL | `'/market/quotes?symbols=' + codes.join(',')` |
| `_klinePath(code, period, count)` | 构建 K 线 URL | `'/market/kline/' + symbol` |
| `_buildOrderBody(order)` | 构建下单 body | 返回 JSON/XML |
| `_parseQuotes(data)` | 解析行情 → `QuoteInfo[]` | 映射字段 |
| `_parseKlines(data)` | 解析 K 线 → `KlineInfo[]` | 映射 OHLCV |
| `_parseAccounts(data)` | 解析账户 → `AccountInfo[]` | 映射字段 |
| `_parseFunds(data)` | 解析资金 → `FundsInfo` | 映射余额 |
| `_parsePositions(data)` | 解析持仓 → `PositionInfo[]` | 映射数量/盈亏 |
| `_parseOrders(data)` | 解析订单 → `OrderInfo[]` | 映射状态 |
| `_parseOrderResult(data)` | 解析下单结果 → `{ orderId }` | 提取 ID |

### Step 3: 覆盖券商专属方法

```typescript
// 覆盖 getAccounts 使用正确路径
async getAccounts(): Promise<AccountInfo[]> {
  const data = await this._makeApiRequest('GET', '/accounts/v1/list');
  return this._parseAccounts(data);
}

// 覆盖 getFunds
async getFunds(accountId: string): Promise<FundsInfo> {
  const data = await this._makeApiRequest('GET', `/accounts/${accountId}`);
  return this._parseFunds(data);
}
```

### Step 4: 实现 IBrokerAdapterV2 扩展

```typescript
getBrokerType() { return '{broker}' as const; }
getMarkets(): MarketType[] { return ['US']; }
getSupportedOrderTypes() { return ['MARKET', 'LIMIT', 'STOP'] as const; }

async ping(): Promise<{ latency: number; timestamp: number }> {
  const t0 = Date.now();
  try { await this._makeApiRequest('GET', '/ping'); return { latency: Date.now() - t0, timestamp: Date.now() }; }
  catch { return { latency: -1, timestamp: Date.now() }; }
}

getConnectionStatus(): BrokerConnectionStatus {
  return {
    brokerId: this.id, brokerName: this.name, brokerType: this.getBrokerType(),
    connected: this.connected, connectedAt: this.connected ? Date.now() : undefined,
    subscriptionsCount: 0,
  };
}
```

---

## 五、BrokerManagerV2 注册

### 5.1 工厂注册

创建 `electron/broker/{prefix}-ipc-registration.ts`：

```typescript
import { BrokerManagerV2 } from './BrokerManagerV2';
import { {Broker}Adapter } from './adapters/{Broker}Adapter';

export function register{Broker}Factory(manager: BrokerManagerV2): void {
  manager.registerAdapterFactory('{broker-type}', (config: BrokerConfig) => {
    return new {Broker}Adapter({
      id: config.id,
      name: config.name,
      type: '{broker-type}',
      clientId: config.apiKey || '',
      clientSecret: config.secretKey || '',
      // ... 其他配置
    });
  });
}
```

### 5.2 在 main.ts 中初始化

```typescript
import { BrokerManagerV2 } from './broker/BrokerManagerV2';
import { registerOAuthBrokerFactories } from './broker/oauth-ipc-registration';
import { registerCryptoBrokerFactories } from './broker/crypto-ipc-registration';

const brokerManager = new BrokerManagerV2({ autoReconnect: true });

// 注册所有工厂
registerOAuthBrokerFactories(brokerManager);   // Schwab, E*TRADE, eToro, Webull
registerCryptoBrokerFactories(brokerManager);  // Binance, OKX, Bybit, Bitget
// ...

// 注册 IPC handlers
registerBrokerIPCV2(brokerManager, mainWindow);
```

### 5.3 AdapterFactory 契约

```typescript
type AdapterFactory = (config: BrokerConfig) => IBrokerAdapter;

// BrokerConfig 结构
interface BrokerConfig {
  id: string;           // 唯一标识, 如 'schwab-default'
  name: string;         // 显示名称, 如 'Charles Schwab'
  type: BrokerType;     // 类型, 用于 factory 查找
  host: string;         // API 主机
  port: number;         // 端口
  enabled: boolean;     // 是否启用
  apiKey?: string;      // OAuth clientId / API Key
  secretKey?: string;   // OAuth clientSecret / API Secret
  options?: Record<string, unknown>;  // 扩展配置
}
```

---

## 六、IPC 集成

### 6.1 IPC Channel 定义

所有券商共用以下 channel:

| Channel | 方向 | 说明 |
|---------|------|------|
| `broker:connect` | Renderer→Main | 连接单个券商 |
| `broker:connectMany` | Renderer→Main | 批量并发连接 |
| `broker:disconnect` | Renderer→Main | 断开连接 |
| `broker:getQuotes` | Renderer→Main | 获取行情(支持 brokerId) |
| `broker:getAggregatedQuotes` | Renderer→Main | 聚合行情(多券商合并) |
| `broker:subscribe` | Renderer→Main | 订阅推送(含 brokerId) |
| `broker:subscribeAll` | Renderer→Main | 所有已连接券商订阅 |
| `broker:placeOrder` | Renderer→Main | 下单(必须 TaggedPlaceOrderRequest) |
| `broker:cancelOrder` | Renderer→Main | 撤单 |
| `broker:scanArbitrage` | Renderer→Main | 扫描套利机会 |
| `broker:copyTrade` | Renderer→Main | 跨券商跟单 |
| `broker:killSwitchAll` | Renderer→Main | 一键全停全部券商 |
| `broker:getAllStatuses` | Renderer→Main | 获取所有连接状态 |

### 6.2 Preload Bridge

```typescript
// src/lib/bridge-api.ts
export const brokerAPI = {
  connect: (config: BrokerConfig) => ipcRenderer.invoke('broker:connect', config),
  connectMany: (configs: BrokerConfig[]) => ipcRenderer.invoke('broker:connectMany', configs),
  getAggregatedQuotes: (codes: string[]) => ipcRenderer.invoke('broker:getAggregatedQuotes', codes),
  placeOrder: (req: TaggedPlaceOrderRequest) => ipcRenderer.invoke('broker:placeOrder', req),
  killSwitchAll: () => ipcRenderer.invoke('broker:killSwitchAll'),
  // ...
};
```

---

## 七、完整示例代码

### 7.1 最简 OAuth2 Adapter

```typescript
// electron/broker/adapters/ExampleOAuthAdapter.ts
import { OAuthBrokerBase, type OAuthBrokerConfig, type OAuthVersion } from './OAuthBrokerBase';
import type { QuoteInfo, KlineInfo, AccountInfo, FundsInfo, PositionInfo, OrderInfo, PlaceOrderRequest } from '../IBrokerAdapter';
import type { MarketType } from '../IBrokerAdapterV2';

export class ExampleOAuthAdapter extends OAuthBrokerBase {
  protected _oauthVersion(): OAuthVersion { return '2.0'; }
  protected _buildAuthHeaders(h: Record<string, string>): Record<string, string> { return h; }

  protected _quotePath(codes: string[]): string {
    return `/v1/quotes?symbols=${codes.map(c => c.replace(/^US\./, '')).join(',')}`;
  }

  protected _klinePath(code: string, period: string, count: number): string {
    return `/v1/kline/${code.replace(/^US\./, '')}?period=${period}&count=${count}`;
  }

  protected _buildOrderBody(order: PlaceOrderRequest): any {
    return { symbol: order.code, side: order.side, qty: order.qty, type: order.orderType, price: order.price };
  }

  protected _parseQuotes(data: any): QuoteInfo[] {
    return (Array.isArray(data) ? data : [data]).map((q: any) => ({
      code: `US.${q.symbol}`, price: q.price || 0, change: q.change || 0,
      changePct: q.changePct || 0, volume: q.volume || 0, turnover: 0,
      high: q.high || 0, low: q.low || 0, open: q.open || 0,
      prevClose: q.prevClose || 0, time: q.time || new Date().toISOString(),
    }));
  }

  protected _parseKlines(data: any): KlineInfo[] {
    return (data?.candles || []).map((c: any) => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
    }));
  }

  protected _parseAccounts(data: any): AccountInfo[] {
    return (Array.isArray(data) ? data : [data]).map((a: any) => ({
      accountId: a.id, name: a.name, currency: a.currency || 'USD',
      netAssets: a.equity || 0, totalAssets: 0, cash: a.cash || 0, marketValue: 0,
    }));
  }

  protected _parseFunds(data: any): FundsInfo {
    return { totalAssets: data.equity || 0, cash: data.cash || 0, marketValue: 0,
      frozenCash: 0, availableCash: data.available || 0, currency: 'USD' };
  }

  protected _parsePositions(data: any): PositionInfo[] {
    return (Array.isArray(data) ? data : []).map((p: any) => ({
      code: `US.${p.symbol}`, name: p.name, qty: p.qty || 0, costPrice: p.cost || 0,
      marketPrice: p.price || 0, marketValue: p.value || 0, pnl: p.pnl || 0, pnlPct: p.pnlPct || 0, ratio: 0,
    }));
  }

  protected _parseOrders(data: any): OrderInfo[] {
    return (Array.isArray(data) ? data : []).map((o: any) => ({
      orderId: String(o.id), code: `US.${o.symbol}`, side: o.side, orderType: o.type || 'MARKET',
      qty: o.qty || 0, price: o.price || 0, filledQty: o.filled || 0, filledPrice: 0,
      status: o.status === 'filled' ? 'FILLED' : o.status === 'cancelled' ? 'CANCELLED' : 'PENDING',
      createdAt: o.time || new Date().toISOString(),
    }));
  }

  protected _parseOrderResult(data: any): { orderId: string } {
    return { orderId: String(data.orderId || '') };
  }

  // Override: use correct API paths
  async getAccounts() { return this._parseAccounts(await this._makeApiRequest('GET', '/accounts')); }
  async getFunds(id: string) { return this._parseFunds(await this._makeApiRequest('GET', `/accounts/${id}`)); }
  async getPositions(id: string) { return this._parsePositions(await this._makeApiRequest('GET', `/accounts/${id}/positions`)); }
  async getOrders(id: string) { return this._parseOrders(await this._makeApiRequest('GET', `/accounts/${id}/orders`)); }
  async placeOrder(o: PlaceOrderRequest) {
    return this._parseOrderResult(await this._makeApiRequest('POST', `/accounts/${o.accountId}/orders`, this._buildOrderBody(o)));
  }
  async cancelOrder(oid: string, aid: string) { await this._makeApiRequest('DELETE', `/accounts/${aid}/orders/${oid}`); }

  getBrokerType() { return 'example' as const; }
  getMarkets(): MarketType[] { return ['US']; }
  getSupportedOrderTypes() { return ['MARKET', 'LIMIT'] as const; }
}
```

### 7.2 工厂注册与连接

```typescript
// 注册
manager.registerAdapterFactory('example', (config) => new ExampleOAuthAdapter({
  id: config.id, name: config.name, type: 'example',
  clientId: config.apiKey || '', clientSecret: config.secretKey || '',
}));

// 连接
await manager.connect({
  id: 'example-main', name: 'Example Broker', type: 'example',
  host: 'api.example.com', port: 443, enabled: true,
  apiKey: 'your-client-id', secretKey: 'your-client-secret',
});

// 使用
const quotes = await manager.getAggregatedQuotes(['US.AAPL', 'US.MSFT']);
const order = await manager.placeOrder({
  brokerId: 'example-main', accountId: 'abc123',
  code: 'US.AAPL', side: 'BUY', orderType: 'LIMIT', qty: 10, price: 185.50,
});
```

---

## 八、测试规范

### 8.1 单 Adapter 测试模板

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('electron-log', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('{Broker}Adapter', () => {
  let adapter: {Broker}Adapter;

  beforeEach(() => {
    adapter = new {Broker}Adapter({ id: 'test', name: 'Test', type: '{broker}', clientId: 'key', clientSecret: 'secret' });
  });

  it('should create with correct type', () => {
    expect(adapter.id).toBe('test');
    expect(adapter.getBrokerType()).toBe('{broker}');
  });

  it('should have all required methods', () => {
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.getQuotes).toBe('function');
    expect(typeof adapter.placeOrder).toBe('function');
  });
});
```

### 8.2 集成测试位置

```
tests/electron/broker/
├── r2-full-broker-integration.test.ts    # 富途+moomoo+长桥+IBKR
├── r3-oauth-integration.test.ts          # Schwab+E*TRADE+eToro+Webull (18 tests)
├── r3-concurrent-integration.test.ts     # 5+券商并发连接
└── r4-full-integration.test.ts           # 16券商全量测试
```

---

## 九、常见问题

### Q: OAuth 认证 vs API Key 认证？
- **OAuth**: Schwab, E\*TRADE, eToro, Webull — 需要浏览器授权 + token 刷新
- **API Key**: Binance, OKX, IBKR — 直接使用 HMAC 签名

### Q: E\*TRADE 的 OAuth1.0a 有多复杂？
E\*TRADE 的每个 API 请求都需要独立的 HMAC-SHA1 签名 (nonce + timestamp + consumer_key + token)。已在 `ETRADEAdapter.ts` 中完整实现，可直接参考。

### Q: 如何添加新券商？
1. 创建 `electron/broker/adapters/{Name}Adapter.ts`
2. 继承正确基类，实现全部抽象方法
3. 在 `{prefix}-ipc-registration.ts` 注册工厂
4. 在测试中验证 18 项接口合规
5. 更新 `MASTER-INDEX.md` 文档索引

### Q: 为什么 Webull 用 Paper Trading？
Webull 的生产环境需要真实账户审批。Paper Sandbox 无需审批即可测试，是开发首选。

### Q: Token 存储安全吗？
所有 OAuth token 通过 `SEC-02 OAuthTokenStore` 存储：
- 生产环境: `keytar` (Windows Credential Manager / macOS Keychain)
- 开发环境: XOR 加密文件 + chmod 600

---

## 十、16 家适配器登记表

| # | 券商 | Adapter 文件 | 基类 | 认证 | Token存储 | 市场 | 状态 |
|---|------|------------|------|------|----------|------|------|
| 1 | 富途 Futu | `futu-adapter.ts` | OpenDBaseAdapter | OpenD | localhost | HK | ✅ 生产 |
| 2 | moomoo | `moomoo-adapter.ts` | OpenDBaseAdapter | OpenD | localhost | US/HK | ✅ 生产 |
| 3 | 盈透 IBKR | `ibkr-adapter.ts` | DirectAdapterBase | API Key | keytar | Global | ✅ 生产 |
| 4 | 长桥 Longbridge | `longbridge-adapter.ts` | BridgeAdapterBase | OAuth2+JWT | keytar | US/HK/SG | ✅ 测试 |
| 5 | 老虎 Tiger | `tiger-adapter.ts` | BridgeAdapterBase | Protobuf+JWT | keytar | US/HK | ✅ 测试 |
| 6 | 华盛 VBKR | `vbkr-adapter.ts` | BridgeAdapterBase | Protobuf | keytar | US/HK | ✅ 测试 |
| 7 | 盈立 uSMART | `usmart-adapter.ts` | BridgeAdapterBase | API Key+Secret | keytar | US/HK | ✅ 测试 |
| 8 | Schwab | `SchwabAdapter.ts` | OAuthBrokerBase | OAuth2 PKCE | keytar | US | ✅ 开发 |
| 9 | E\*TRADE | `ETRADEAdapter.ts` | OAuthBrokerBase | OAuth1.0a | keytar | US | ✅ 开发 |
| 10 | eToro | `eToroAdapter.ts` | OAuthBrokerBase | OAuth2 | keytar | US/Crypto | ✅ 开发 |
| 11 | Webull | `WebullAdapter.ts` | OAuthBrokerBase | OAuth2 | keytar | US | ✅ 开发 |
| 12 | Binance | `binance-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | keytar | Crypto | ✅ 开发 |
| 13 | OKX | `okx-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | keytar | Crypto | ✅ 开发 |
| 14 | Bybit | `bybit-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | keytar | Crypto | ✅ 开发 |
| 15 | Bitget | `bitget-adapter.ts` | CryptoAdapterBase | HMAC-SHA256 | keytar | Crypto | ✅ 开发 |
| 16 | MT5 | `mt5-adapter.ts` | DirectAdapterBase | auth-token | keytar | Forex/CFD | ✅ 开发 |

---

> **凭本文档可独立完成任意券商的适配器开发 → BrokerManagerV2 注册 → IPC 集成 → 测试验证全过程。**
