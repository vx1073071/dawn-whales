# TradingEasy 多券商接入开发者文档

> R3 DOC-01 | 版本 1.0 | 2026-06-12 | 作者: youdao

---

## 1. 架构概览

### 1.1 三层架构

```
┌──────────────────────────────────────────────┐
│                 UI Layer                     │
│  WatchlistV2 / 聚合面板 / 套利监控 / 跟单配置   │
│                 (React)                       │
└────────────────────┬─────────────────────────┘
                     │ IPC (broker-ipc V2)
┌────────────────────┴─────────────────────────┐
│           BrokerManagerV2                     │
│  ┌─────────────────────────────────────────┐ │
│  │  并发连接池 (全券商同时活跃, 无active)     │ │
│  │  registerAdapterFactory → connectMany    │ │
│  │  getAggregatedPositions/Funds/Orders     │ │
│  └─────────────────────────────────────────┘ │
│  ┌────────────────┐ ┌──────────────────────┐ │
│  │ QuoteAggregator│ │ SmartOrderRouter     │ │
│  │ (跨券商行情聚合)│ │ (路由/并行/跟单)     │ │
│  └────────────────┘ └──────────────────────┘ │
│  ┌────────────────┐ ┌──────────────────────┐ │
│  │ CodeNormalizer │ │ CrossBrokerRiskEngine│ │
│  │ (代码标准化)    │ │ (跨券商风控)          │ │
│  └────────────────┘ └──────────────────────┘ │
│  ┌────────────────┐                          │
│  │ BrokerEventBus │                          │
│  │ (跨券商事件总线)│                          │
│  └────────────────┘                          │
└────────────────────┬─────────────────────────┘
                     │ IBrokerAdapterV2
┌────────────────────┴─────────────────────────┐
│              Adapter Layer                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Bridge   │ │ Direct   │ │ OAuth        │ │
│  │ Tiger    │ │ Binance  │ │ Schwab       │ │
│  │ VBKR     │ │ OKX      │ │ E*TRADE      │ │
│  │ uSMART   │ │ Bybit    │ │ eToro        │ │
│  │          │ │ Bitget   │ │ Webull       │ │
│  │          │ │ RH Crypto│ │              │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │ OpenDBaseAdapter (仅富途/moomoo)       │    │
│  │ Futu Broker / Moomoo Broker           │    │
│  └──────────────────────────────────────┘    │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │ Direct IBrokerAdapter 实现             │    │
│  │ Longbridge / IB / MT5                  │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 1.2 继承关系

```
                    IBrokerAdapter (V1)
                           │
                    IBrokerAdapterV2 (Tagged)
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                   │
   OpenDBaseAdapter   BridgeAdapter       DirectAdapter
   (仅富途/moomoo)    (老虎/华盛/盈立)    (加密5家)
        │                  │                   │
   ┌────┴────┐      ┌──────┼──────┐     ┌─────┼─────┐
  Futu     Moomoo   Tiger  VBKR  uSMART │            │
                                        │     OAuthBrokerBase
                                   ┌────┼────┐    (Schwab/E*TRADE/eToro/Webull)
                              Binance OKX Bybit  │
                              Bitget RH_Crypto   │
                                          ┌──────┼──────┐
                                         Schwab E*TRADE eToro Webull

   直接实现 IBrokerAdapter:
   Longbridge / IB / MT5(MetaApi)
```

### 1.3 基类选用指南

| 券商类型 | 继承基类 | 适用场景 | 关键差异 |
|----------|---------|---------|---------|
| **OpenDBaseAdapter** | 仅富途、moomoo | Futu/Moomoo OpenD 协议 (Protobuf/TCP) | 44字节header+FT magic, CMD映射, Mock降级 |
| **BridgeAdapter** | 老虎、华盛、盈立 | 本地网关型券商, 自有协议 | Job Queue模式, poll/complete复用 |
| **DirectAdapter** | 币安/OKX/Bybit/Bitget/Robinhood Crypto | 直连REST API, 无本地网关 | HMAC签名, WS订阅, 统一解析 |
| **OAuthBrokerBase** | Schwab/E*TRADE/eToro/Webull | OAuth认证券商 | OAuth1/OAuth2, local server回调, 令牌管理 |
| **直接实现** | 长桥、IB、MT5 | 特殊协议或无合适基类 | 完全自行实现所有接口 |

---

## 2. 快速开始: 新建 Adapter

### 2.1 接口要求

所有适配器必须实现 `IBrokerAdapter` (V1) 的 14 个方法:

```typescript
interface IBrokerAdapter {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  connected: boolean;

  connect(): Promise<void>;
  disconnect(): void;

  onQuotePush(callback: (quotes: QuoteInfo[]) => void): void;
  removeQuotePush(callback: (quotes: QuoteInfo[]) => void): void;
  onDisconnect(callback: () => void): void;

  getQuotes(codes: string[]): Promise<QuoteInfo[]>;
  getKlines(code: string, period: string, count: number): Promise<KlineInfo[]>;
  getAccounts(): Promise<AccountInfo[]>;
  getFunds(accountId: string): Promise<FundsInfo>;
  getPositions(accountId: string): Promise<PositionInfo[]>;
  getOrders(accountId: string): Promise<OrderInfo[]>;
  placeOrder(order: PlaceOrderRequest): Promise<{ orderId: string }>;
  cancelOrder(orderId: string, accountId: string, code: string): Promise<void>;
  subscribeAndPush(codes: string[]): Promise<void>;
}
```

V2 扩展能力 (`IBrokerAdapterV2`):

```typescript
interface IBrokerAdapterV2 extends IBrokerAdapter {
  getTradingPairs?(): Promise<TradingPairInfo[]>;
  getDepth?(symbol: string, limit?: number): Promise<OrderBookInfo>;
  getOrderHistory?(accountId: string, startDate?: string, endDate?: string): Promise<TaggedOrderInfo[]>;
  getMarginRatio?(accountId: string): Promise<MarginInfo>;
  getConnectionStatus?(): BrokerConnectionStatus;
  ping?(): Promise<{ latency: number; timestamp: number }>;
  getMarkets(): MarketType[];
  getSupportedOrderTypes(): Array<'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TRAILING_STOP' | 'OCO'>;
  requiresLocalGateway(): boolean;
  getBrokerType(): BrokerType;
  getToken?(): string;
  onTaggedQuotePush?(callback: (quotes: TaggedQuoteInfo[]) => void): void;
  removeTaggedQuotePush?(callback: (quotes: TaggedQuoteInfo[]) => void): void;
}
```

### 2.2 文件命名规范

```
electron/broker/
  {券商}-adapter.ts                # 主适配器文件 (如 moomoo-adapter.ts)
  adapters/
    {券商}Adapter.ts               # 备选路径 (如 SchwabAdapter.ts)

tests/electron/broker/
  {券商}-adapter.test.ts          # 测试文件
  r2-full-broker-integration.test.ts  # 集成测试骨架
  test-framework.ts               # 测试基础框架
```

### 2.3 工厂注册

每个适配器必须提供工厂函数并注册到 `BrokerManagerV2`:

```typescript
// 在适配器文件底部
export function createXxxAdapter(config: BrokerConfig): XxxAdapter {
  return new XxxAdapter(config);
}

// 在 BrokerManagerV2 初始化时
const manager = new BrokerManagerV2();
manager.registerAdapterFactory('xxx', (config) => new XxxAdapter(config));
```

### 2.4 示例: REST 类券商 (以长桥为例)

```typescript
export class LongbridgeAdapter implements IBrokerAdapter {
  readonly type = 'longbridge';
  private accessToken: string | null = null;
  private mockMode = true;

  async connect(): Promise<void> {
    // 1. 尝试OAuth认证
    if (this.config.apiKey) {
      const token = await this.exchangeToken();
      this.accessToken = token;
      this.mockMode = false;
    }
    // 2. 否则进入Mock模式
    this.connected = true;
  }

  async getQuotes(codes: string[]): Promise<QuoteInfo[]> {
    if (!this.mockMode) {
      const res = await this.request('GET', `/quote?symbols=${codes.join(',')}`);
      return this.parseQuotes(await res.json());
    }
    return codes.map(c => this.generateMockQuote(c));
  }
  // ... 其余方法
}
```

### 2.5 示例: OpenD 协议类 (仅富途/moomoo)

```typescript
export class MoomooAdapter extends OpenDBaseAdapter {
  // 仅需实现5个抽象方法
  getAdapterName(): string { return 'MoomooAdapter'; }
  getDefaultPort(): number { return 11211; }
  getClientId(): string { return 'TradingEasy-Moomoo'; }
  getContractMapping(): Record<string, ContractInfo> { return MOOMOO_CONTRACTS; }
  generateMockQuote(code: string): QuoteInfo { /* ... */ }
}
```

---

## 3. Tagged 数据类型

所有通过 BrokerManagerV2 流转的数据自动附加 Tagged 字段:

| 类型 | 新增字段 | 说明 |
|------|---------|------|
| `TaggedQuoteInfo` | brokerId, brokerName, brokerType, market, originalCode, standardCode, bid?, ask?, spreadPct?, timestamp | 跨券商行情聚合 |
| `TaggedPositionInfo` | brokerId, brokerName, brokerType, market, standardCode, currency, exchangeRate? | 跨券商持仓聚合 |
| `TaggedOrderInfo` | brokerId, brokerName, brokerType, standardCode, commission?, commissionCurrency? | 跨券商订单管理 |
| `TaggedPlaceOrderRequest` | brokerId (或 "auto"走路由), stopPrice?, trailPercent?, timeInForce?, clientOrderId? | 指定券商 or 自动路由 |

---

## 4. BrokerType 枚举

```typescript
export type BrokerType =
  // 已有
  | 'futu' | 'moomoo' | 'ib' | 'longbridge'
  // Bridge
  | 'tiger' | 'vbkr' | 'usmart'
  // Crypto
  | 'binance' | 'okx' | 'bybit' | 'bitget' | 'robinhood'
  // OAuth
  | 'schwab' | 'etrade' | 'etoro' | 'webull'
  // Special
  | 'mt5';
```

共 17 种类型，覆盖 16 家接入券商 + 1 个综合平台。

---

## 5. 并发架构

### 5.1 BrokerManagerV2 关键 API

```typescript
// 连接管理
manager.connect(config) / connectMany(configs) / disconnect(id) / disconnectAll()

// 订阅管理
manager.subscribe(brokerId, codes) / subscribeAll(codes) / getSubscriptions(id)

// 聚合查询
manager.getAggregatedFunds() / getAggregatedPositions() / getAggregatedOrders()

// 状态管理
manager.getStatus(id) / getAllStatuses() / getConnectedBrokers() / getConnectedCount()

// 事件回调
manager.onGlobalQuote(cb) / onGlobalStatusChange(cb)
```

### 5.2 QuoteAggregator

- `onBrokerQuote(brokerId, quotes)` — 接收单家券商行情
- `getCrossBrokerQuotes(standardCode)` — 同标的跨券商对比
- `scanArbitrageOpportunities(thresholdPct)` — 自动套利扫描

### 5.3 SmartOrderRouter

- `route(order)` — 指定券商下单
- `routeParallel(orders)` — 跨券商并行下单
- `routeAuto(order)` — 同标的多券商比价，自动选最优
- `copyTrade(source, target, ratio)` — 跟单

### 5.4 CrossBrokerRiskEngine

- `checkTotalExposure(newOrder)` — 全券商总敞口检查
- `killSwitchAll()` — 一键全停全部券商
- `getAggregatedMargin()` — 聚合保证金

### 5.5 CodeNormalizer

- `normalize(code, brokerId)` — 统一代码映射 (如 "BTCUSDT"→"BTC-USDT")
- `denormalize(standardCode, brokerId)` — 反向映射

---

## 6. 测试指南

### 6.1 标准化测试流程

每个适配器至少覆盖:

```
1. Constructor     → 验证 id/type/name
2. connect()       → 验证 connected = true
3. getQuotes()     → 验证返回 QuoteInfo[]
4. getKlines()     → 验证返回 KlineInfo[]
5. getAccounts()   → 验证返回 AccountInfo[]
6. getFunds()      → 验证返回 FundsInfo
7. getPositions()  → 验证返回 PositionInfo[]
8. getOrders()     → 验证返回 OrderInfo[]
9. placeOrder()    → 验证返回 { orderId }
10. cancelOrder()  → 验证不抛异常
11. subscribeAndPush() → 验证订阅成功
12. disconnect()   → 验证 connected = false
13. onQuotePush()  → 验证回调注册/移除
```

### 6.2 测试框架使用

```typescript
import { createMockBrokerServer, BrokerTestHarness, TestFixtures } from './test-framework';

// Mock HTTP 端点
const mock = createMockBrokerServer({ prefix: '/api/v3', latency: 50 });
mock.start();

// 标准化流程
const harness = createBrokerTestHarness({ ... });
harness.testConnection();
harness.testQuotes(['BTCUSDT', 'ETHUSDT']);
```

---

## 7. 安全要求

- 所有 API Key/Secret 必须通过 `OAuthTokenStore` (keytar) 存储
- 禁止在代码中硬编码密钥
- 禁止将密钥提交到 Git
- WebSocket 连接必须使用 TLS (wss://)
- JWT Token 有到期时间，需自动刷新
- 敏感操作 (下单/撤单/一键全停) 需二次确认

---

## 8. 常见问题

**Q: 我该继承哪个基类？**
- 富途/moomoo → OpenDBaseAdapter
- 老虎/华盛/盈立 → BridgeAdapter
- 币安/OKX/Bybit/Bitget/Robinhood Crypto → CryptoAdapterBase (extends DirectAdapter)
- Schwab/E*TRADE/eToro/Webull → OAuthBrokerBase (extends DirectAdapter)
- 长桥 → 直接实现 IBrokerAdapter (REST+OAuth2, 无合适基类)

**Q: Mock模式何时使用？**
- 测试环境：强制Mock
- 生产环境：API Key未配置或无网络时自动降级

**Q: 如何支持多个相同type的券商实例？**
- 使用不同的 BrokerConfig.id (如 'binance-spot', 'binance-futures')
- BrokerManagerV2 按 id 管理，不限制同type多实例

---

*文档版本: 1.0 | 最后更新: 2026-06-12 | 作者: youdao (R3 DOC-01)*
