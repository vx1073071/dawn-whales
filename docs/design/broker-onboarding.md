# TradingEasy 券商接入手册 — 从 API Key 到实时行情

> **版本**: v1.0 | **日期**: 2026-06-14 | **作者**: QClaw (文档虾)
> **覆盖**: 8 券商 API Key 申请 + 行情数据格式 + WebSocket 协议

---

## 目录

1. [券商 API Key 申请指南](#1-券商-api-key-申请指南)
2. [行情数据格式规范](#2-行情数据格式规范)
3. [WebSocket 推送协议](#3-websocket-推送协议)

---

## 1. 券商 API Key 申请指南

### 1.1 Futu (富途牛牛) — OpenD

**适用市场**: 港股(L2) / 美股(L1) / A股(L2)

**申请步骤**:
```
1. 下载 FutuOpenD: https://www.futunn.com/download/openAPI
2. 安装并打开 FutuOpenD 桌面端
3. 登录你的富途牛牛账号 (需要开通交易权限)
4. 进入设置 → API 管理 → 生成连接令牌
5. 记录:
   - Host: 127.0.0.1
   - Port: 11111 (默认)
   - 无需 API Key/Secret (通过令牌认证)

⚠ FutuOpenD 必须在本地运行并保持登录状态!
⚠ 模拟盘默认开启, 实盘需 GUI 手动解锁交易密码
```

**TradingEasy 配置**:
```typescript
// 环境变量 (可选, 覆盖默认值)
FUTU_OPEND_HOST=127.0.0.1
FUTU_OPEND_PORT=11111

// 代码中
const futu = new FutuAdapter({
  host: '127.0.0.1',
  port: 11111,
  tradeEnv: 'SIMULATE',  // SIMULATE | REAL
});
```

**行情能力**:
```
Quote:     ✅ (getStockQuote, getSnapshot)
Klines:    ✅ (getCurKline, getKline)
Depth:     ✅ (getOrderBook, L2 data)
Subscribe: ✅ (subscribe + push callback)
SubTypes:  QUOTE / KLINE / TICKER / ORDER_BOOK / BROKER / CAPITAL_FLOW
```

---

### 1.2 IBKR (盈透) — TWS/Gateway

**适用市场**: 所有市场 (L1), 美股(L2)

**申请步骤**:
```
1. 注册 IBKR 账户: https://www.interactivebrokers.com
2. 下载 TWS 或 IB Gateway: https://www.interactivebrokers.com/en/trading/tws.php
3. 登录 TWS: 设置 → API → Settings
   - 勾选 "Enable ActiveX and Socket Clients"
   - 记录 Socket Port: 7496 (TWS 实盘) / 7497 (IB Gateway 实盘) / 4001 (模拟)
   - 勾选 "Allow connections from localhost only" (安全)
4. 创建客户端 ID (任意正整数, 如 1-32)
5. 如果是 IB Gateway: 需要在设置中开启 "Download open orders on connection"

⚠ TWS 每天断开一次 (美国夜间重置)
⚠ 订阅行情需要单独购买 (IB 市场数据订阅)
```

**TradingEasy 配置**:
```typescript
const ib = new IBTWSAdapter({
  host: '127.0.0.1',
  port: 7497,           // TWS=7496, Gateway=7497, Paper=4001
  clientId: 1,          // 唯一整数
  paperTrading: false,  // 模拟盘
  maxReconnectAttempts: 5,
  reconnectIntervalMs: 5000,
});
```

**行情能力**:
```
Quote:     ✅ (mktData request/response)
Klines:    ✅ (historicalData)
Depth:     ✅ (marketDepth, L2)
Subscribe: ✅ (reqMktData + callback)
Note:      Market data is throttled (约 50 req/sec)
```

---

### 1.3 Tiger (老虎证券) — OpenAPI

**适用市场**: 港股(L1) / 美股(L1) / A股(L1) / 新加坡(L1) / 日本(L1)

**申请步骤**:
```
1. 注册老虎账户: https://www.itiger.com
2. 进入开放平台: https://open.itiger.com
3. 创建应用 → 获取:
   - tigerId (你的账户ID)
   - tigerAccount (账户号)
   - privateKey (RSA 私钥, 用于签名)
4. 记录:
   - 私钥文件路径 (下载 .pem 文件)
   - API 域名: https://openapi.itiger.com (正式) / https://sandbox.itiger.com (沙盒)
```

**TradingEasy 配置**:
```typescript
const tiger = new TigerAdapter({
  tigerId: 'YOUR_TIGER_ID',
  account: 'YOUR_ACCOUNT',
  privateKey: fs.readFileSync('path/to/private_key.pem', 'utf8'),
  env: 'PROD',  // PROD | SANDBOX
  marketData: true,
});
```

**行情能力**:
```
Quote:     ✅ (REST: /quote/real_time)
Klines:    ✅ (REST: /quote/kline)
Depth:     ✅ (REST: /quote/depth)
Subscribe: ⚠️ (REST 轮询, 非原生 WS)
延迟:      约 100ms
```

---

### 1.4 Binance (币安) — API Key

**适用市场**: 加密货币现货(L2) / 合约

**申请步骤**:
```
1. 注册币安账户: https://www.binance.com
2. 进入 API 管理: https://www.binance.com/en/my/settings/api-management
3. 创建 API Key:
   - 标签: "TradingEasy"
   - 权限: ☑ 读取 (Enable Reading) / ☐ 交易 / ☐ 提现
   - IP 白名单: 可选 (推荐设置你的 IP)
4. 保存 Key 和 Secret (Secret 仅显示一次!)
5. 测试端点: https://testnet.binance.vision (沙盒)

⚠ 现货和合约需要分别创建 Key
⚠ 合约测试网: https://testnet.binancefuture.com
```

**TradingEasy 配置**:
```typescript
const binance = new BinanceAdapter({
  apiKey: 'YOUR_API_KEY',
  secretKey: 'YOUR_SECRET',
  baseUrl: 'https://api.binance.com',   // 正式
  wsUrl: 'wss://stream.binance.com:9443/ws',
  testnet: false,
  recvWindow: 5000,
});
```

**行情能力**:
```
Quote:     ✅ (REST: /api/v3/ticker/price)
Klines:    ✅ (REST: /api/v3/klines)
Depth:     ✅ (REST: /api/v3/depth + WS: <symbol>@depth@100ms)
Subscribe: ✅ (原生 WebSocket, 多路复用)
延迟:      约 30ms (最快的行情源)
```

---

### 1.5 OKX (欧易) — API Key

**适用市场**: 加密货币现货 / 合约

**申请步骤**:
```
1. 注册 OKX 账户: https://www.okx.com
2. 进入 API: 账户 → API → 创建 V5 API Key
3. 权限: ☑ 读取 (Read) / ☐ 交易 / ☐ 提现
4. 记录: API Key + Secret Key + Passphrase
5. 测试: https://www.okx.com/docs-v5/en/#rest-api-market-data

⚠ Passphrase 是创建 Key 时自己设置的, 不是登录密码
```

**TradingEasy 配置**:
```typescript
const okx = new OKXAdapter({
  apiKey: 'YOUR_API_KEY',
  secretKey: 'YOUR_SECRET',
  passphrase: 'YOUR_PASSPHRASE',
  baseUrl: 'https://www.okx.com',
  wsUrl: 'wss://ws.okx.com:8443/ws/v5/public',
  simulation: false,
});
```

**行情能力**:
```
Quote:     ✅ (REST: /api/v5/market/ticker)
Klines:    ✅ (REST: /api/v5/market/candles)
Depth:     ✅ (REST + WS: books 400深度)
Subscribe: ✅ (原生 WebSocket 频道订阅)
延迟:      约 40ms
```

---

### 1.6 E\*TRADE (Morgan Stanley) — OAuth1.0a

**适用市场**: 美股(L2) / 期权 / 期货

**申请步骤**:
```
1. 注册 E*TRADE 账户: https://us.etrade.com
2. 进入 API 平台: https://developer.etrade.com
3. 创建应用 → 获取:
   - Consumer Key (OAuth consumer key)
   - Consumer Secret (OAuth consumer secret)
4. OAuth 授权流程:
   a. 获取 Request Token → authorize URL
   b. 用户浏览器授权 → 得到 verifier code
   c. 用 verifier code 换取 Access Token
5. 保存 Access Token 和 Access Token Secret (长期有效)

⚠ E*TRADE 是最复杂的认证 (唯一 OAuth1.0a)
⚠ 需要完整 OAuth 签名流程 (HMAC-SHA1)
⚠ API 限制: 2 req/sec (免费) / 4 req/sec (付费)
```

**TradingEasy 配置**:
```typescript
const etrade = new ETRADEAdapter({
  consumerKey: 'YOUR_CONSUMER_KEY',
  consumerSecret: 'YOUR_CONSUMER_SECRET',
  accessToken: 'YOUR_ACCESS_TOKEN',
  accessTokenSecret: 'YOUR_ACCESS_TOKEN_SECRET',
  baseUrl: 'https://apisb.etrade.com',  // 沙盒
  // baseUrl: 'https://api.etrade.com',  // 正式
  sandbox: true,
});
```

**行情能力**:
```
Quote:     ✅ (REST: /market/quote/{symbols})
Klines:    ⚠️ (REST, 仅日线)
Depth:     ❌
Subscribe: ❌ (无原生 WS, 需 REST 轮询)
延迟:      约 150ms
```

---

### 1.7 Webull (微牛) — OAuth2

**适用市场**: 美股(L1) / 港股(L1)

**申请步骤**:
```
1. 创建 Webull 账户: https://www.webull.com
2. 进入开发者平台: https://webullapp.com/developer
3. 创建应用 → 获取:
   - App Key (client_id)
   - App Secret (client_secret)
4. OAuth2 授权:
   - Redirect URI: http://localhost:8080/callback (本地调试)
   - Scope: market_data, account_read
5. 获取 Access Token (1小时) + Refresh Token (90天)

⚠ API 限制: 10 req/sec
⚠ Access Token 1小时过期，需 Refresh Token 自动续期
```

**TradingEasy 配置**:
```typescript
const webull = new WebullAdapter({
  clientId: 'YOUR_APP_KEY',
  clientSecret: 'YOUR_APP_SECRET',
  redirectUri: 'http://localhost:8080/callback',
  region: 'US',  // US | HK
  paperTrading: false,
});
```

---

### 1.8 eToro — OAuth2

**适用市场**: 美股(L1) / 加密货币 / 欧洲 / 英国

**申请步骤**:
```
1. 注册 eToro: https://www.etoro.com
2. 进入 API: https://www.etoro.com/api (需联系支持开通)
3. 获取: Client ID + Client Secret
4. OAuth2 授权 (Authorization Code Flow)
5. 回调 URL: 你的应用回调地址

⚠ eToro API 需联系客服开通, 不对所有用户开放
⚠ 延迟较高 (约 300ms), 较适合参考而非主力行情
```

---

## 2. 行情数据格式规范

### 2.1 Quote (实时报价)

```typescript
interface QuoteData {
  // === 基础信息 ===
  symbol: string;             // 标准化代码: "HK.00700"
  market: Market;             // HK | US | CN | CRYPTO | SG | JP | UK | EU
  timestamp: number;          // Unix ms
  
  // === 价格 ===
  lastPrice: number;          // 最新价
  openPrice: number;          // 开盘价
  highPrice: number;          // 当日最高
  lowPrice: number;           // 当日最低
  prevClosePrice: number;     // 前收盘
  
  // === 买卖盘 ===
  bidPrice: number;           // 买一价
  askPrice: number;           // 卖一价
  bidSize: number;            // 买一量 (股/张/枚)
  askSize: number;            // 卖一量
  
  // === 成交量 ===
  volume: number;             // 成交量 (股)
  turnover: number;           // 成交额 (本币)
  
  // === 元数据 ===
  currency: string;           // HKD | USD | CNY | USDT
  lotSize: number;            // 每手股数 (港股)
  pricePrecision: number;     // 价格小数位 (2/3/8)
  source: string;             // 行情源: "futu" | "ibkr" | "binance"
  sourceLatency: number;      // 源延迟 (ms)
  
  // === 状态 ===
  status: QuoteStatus;        // NORMAL | SUSPENDED | DELISTED | PRE_MARKET | AFTER_HOURS
  isStale: boolean;           // 缓存过期 (超过 30s)
}
```

### 2.2 Kline (K 线)

```typescript
interface KlineData {
  symbol: string;             // "HK.00700"
  period: KlinePeriod;        // MIN_1 | MIN_5 | MIN_15 | MIN_30 | MIN_60 | DAY | WEEK | MONTH
  market: Market;
  
  candles: KlineCandle[];
  
  // 分页
  total: number;
  from: number;               // Unix ms (起始时间)
  to: number;                 // Unix ms (结束时间)
}

interface KlineCandle {
  time: number;               // Unix ms (开盘时间)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}
```

### 2.3 OrderBook (深度)

```typescript
interface OrderBookData {
  symbol: string;
  timestamp: number;
  market: Market;
  source: string;
  
  bids: PriceLevel[];         // 买方 (从高到低)
  asks: PriceLevel[];         // 卖方 (从低到高)
  
  bidCount: number;           // 总档位数
  askCount: number;
  spread: number;             // 价差 = ask[0] - bid[0]
  spreadPercent: number;      // 价差百分比
}

interface PriceLevel {
  price: number;
  size: number;               // 数量
  orderCount: number;         // 挂单数
}
```

### 2.4 Tick (逐笔成交)

```typescript
interface TickData {
  symbol: string;
  market: Market;
  source: string;
  
  ticks: TickRecord[];
}

interface TickRecord {
  time: number;               // Unix ms
  price: number;
  volume: number;
  direction: TickDirection;   // BUY | SELL | NEUTRAL
  tradeId: string;            // 交易所成交 ID
}
```

### 2.5 各券商字段覆盖

| 字段 | 富途 | IBKR | Tiger | Binance | E\*TRADE | OKX | Webull | eToro |
|------|------|------|-------|---------|----------|-----|--------|-------|
| lastPrice | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| open/high/low | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bid/ask | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bidSize/askSize | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| volume | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| turnover | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| lotSize | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ |
| Kline | ✅ | ✅ | ✅ | ✅ | ⚠️ 日线 | ✅ | ✅ | ✅ |
| OrderBook | ✅ L2 | ✅ L2 | ✅ | ✅ L2 | ❌ | ✅ | ✅ | ❌ |
| Tick | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |

---

## 3. WebSocket 推送协议

### 3.1 TradingEasy 统一 WS 格式

所有券商适配器输出统一的 WebSocket 消息格式，由 `ws-push-service.ts` 转发。

```typescript
// 客户端订阅
{
  "action": "subscribe",
  "symbols": ["HK.00700", "US.AAPL", "CC.BTCUSD"],
  "dataTypes": ["QUOTE", "DEPTH"]  // 可选: QUOTE | DEPTH | TICK | KLINE
}

// 服务器响应 (确认)
{
  "type": "SUBSCRIBED",
  "symbols": ["HK.00700", "US.AAPL"],
  "failed": ["CC.BTCUSD"],          // 不支持或无源
  "timestamp": 1718276400000
}

// 行情推送
{
  "type": "QUOTE",
  "symbol": "HK.00700",
  "data": { /* QuoteData */ },
  "source": "futu",
  "timestamp": 1718276400123,
  "seq": 1                           // 序号 (检丢失)
}

// 深度推送
{
  "type": "DEPTH",
  "symbol": "CC.BTCUSD",
  "data": { /* OrderBookData */ },
  "source": "binance",
  "timestamp": 1718276400456,
  "seq": 42
}

// 取消订阅
{
  "action": "unsubscribe",
  "symbols": ["HK.00700"]
}

// 心跳
{
  "type": "HEARTBEAT",
  "timestamp": 1718276405000
}

// 错误
{
  "type": "ERROR",
  "symbol": "US.AAPL",
  "code": "SOURCE_DISCONNECTED",
  "message": "Binance WebSocket disconnected, switching to OKX",
  "timestamp": 1718276400000
}
```

### 3.2 各券商原生 WS 格式

#### Binance
```
URL: wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcusdt@depth@100ms

消息格式:
{
  "stream": "btcusdt@ticker",
  "data": {
    "e": "24hrTicker",
    "s": "BTCUSDT",
    "c": "50000.00",    // 最新价
    "h": "51000.00",    // 24h高
    "l": "49000.00",    // 24h低
    "v": "12345.67",    // 成交量
    ...
  }
}
```

#### OKX
```
URL: wss://ws.okx.com:8443/ws/v5/public

订阅请求:
{
  "op": "subscribe",
  "args": [
    { "channel": "tickers", "instId": "BTC-USDT" },
    { "channel": "books",   "instId": "BTC-USDT" }
  ]
}
```

#### Futu (OpenD)
```
Futu OpenD 原生协议 (Protobuf), 通过本地 TCP 连接。
TradingEasy 的 futu-adapter.ts 负责 Protobuf ↔ JSON 转换。

订阅: Qot_Sub(subType=QUOTE, codeList=["HK.00700"])
推送: Qot_UpdateTicker 回调
```

#### IBKR (TWS)
```
IB 无原生 WebSocket。通过 TWS socket 协议 (TCP 4001/7497)。
TradingEasy 的 ib-tws-adapter.ts 将 IB 私有协议转为 JSON WS。

请求: reqMktData(contractId, genericTickList)
推送: tickPrice / tickSize 回调
```

### 3.3 连接管理 & 重连

```typescript
interface WSConnectionConfig {
  url: string;                      // 券商 WS 端点
  heartbeatIntervalMs: number;      // 心跳间隔 (默认 30000)
  heartbeatTimeoutMs: number;       // 心跳超时 (默认 10000, 3次无响应断开)
  reconnectBaseMs: number;          // 重连基础间隔 (默认 1000)
  reconnectMaxMs: number;           // 重连最大间隔 (默认 30000)
  reconnectJitter: boolean;         // 是否加随机抖动 (防惊群)
  maxReconnectAttempts: number;     // 最多重连次数 (默认 10, -1=无限)
  subscribeOnReconnect: boolean;    // 重连后自动重新订阅
  dedupWindowMs: number;            // 去重窗口 (默认 0, 0=不去重)
}

// 重连策略: 指数退避 + 随机抖动
// wait = min(reconnectBase * 2^attempts + jitter, reconnectMax)
// attempt 1: ~1.2s
// attempt 2: ~2.5s
// attempt 3: ~5.1s
// attempt 4: ~10.3s
// attempt 5+: ~30s (cap)
```

### 3.4 消息丢失检测

```
方案: 序列号检查

每条推送带递增 seq:
  - seq 连续 → 无丢失
  - seq 跳跃 (如 5→8) → 丢失 6,7 → 请求 REST 补全

补全请求:
  GET /api/quote/fill?symbol=HK.00700&from=1718276400123&to=1718276400456
  或从 quote-cache.ts 取最近缓存
```

### 3.5 订阅带宽估算

| 标的数 | 数据类型 | 单次推送大小 | 频率 | 带宽 (估算) |
|--------|---------|------------|------|-----------|
| 1 | QUOTE | ~200 bytes | 1/s | ~0.2 KB/s |
| 10 | QUOTE | ~200 bytes | 1/s | ~2 KB/s |
| 100 | QUOTE | ~200 bytes | 1/s | ~20 KB/s |
| 1 | DEPTH (L2 10档) | ~1 KB | 2/s | ~2 KB/s |
| 10 | DEPTH (L2 10档) | ~1 KB | 2/s | ~20 KB/s |
| 1 | TICK | ~100 bytes | ~10/s | ~1 KB/s |

> 极端: 100 标的 QUOTE + 10 标的 DEPTH ≈ 40 KB/s ≈ 3.5 GB/天
> 普通用户 10-20 标的 ≈ 4-8 KB/s → 可忽视

---

> **维护**: 新增券商时同步更新第 1 章 (API 申请) + 第 2.5 节 (字段覆盖矩阵)
