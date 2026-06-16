# R130-Q02: OKX API 接入指南 & 文档

> **Author**: QClaw · **Task**: R130-Q02 · **Hours**: 2h
> **Version**: v2.0.0 | **Based on**: server/adapters/okx-adapter.ts (JVS, 14.8KB)

---

## 一、OKX 接入概览

### quant-moo 中的 OKX 架构

```
桌面端/server → OkxAdapter (server/adapters/okx-adapter.ts)
              → ICloudBrokerAdapter 接口
              → OK-ACCESS-SIGN (timestamp + method + path + body → base64)
              → REST: www.okx.com
              → WS:   ws.okx.com
```

### OKX vs Binance 关键差异

| 特性 | Binance | OKX |
|------|---------|-----|
| 签名字段 | X-MBX-APIKEY | OK-ACCESS-KEY |
| 时间戳头 | timestamp | OK-ACCESS-TIMESTAMP |
| 签名头 | signature | OK-ACCESS-SIGN |
| Passphrase | 不需要 | OK-ACCESS-PASSPHRASE (必需) |
| 签名输入 | queryString | timestamp+method+path+body |
| 签名编码 | hex | base64 |
| 产品类型 | endpoint区分 | instType参数 (SPOT/SWAP/FUTURES) |
| 符号分隔 | 无分隔 (BTCUSDT) | 横线 (BTC-USDT) |

### 前置条件

| 步骤 | 操作 |
|------|------|
| 1 | OKX 账号: https://www.okx.com |
| 2 | 创建 API Key: 用户中心 → API → 创建V5 API Key |
| 3 | 记录三个凭证: API Key + Secret Key + Passphrase |
| 4 | quant-moo 输入: API Key 配置面板 → 服务器 AES-256-GCM 加密 |

---

## 二、OK-ACCESS-SIGN 认证机制

### 签名算法

```
prehash = timestamp + method + path + requestBody
signature = HMAC-SHA256(prehash, secretKey).base64()
```

### 签名示例

```
timestamp = "2026-06-13T05:00:00.000Z"
method = "GET"
path = "/api/v5/account/balance"
body = ""  (GET 为空)
prehash = "2026-06-13T05:00:00.000ZGET/api/v5/account/balance"
signature = base64(HMAC-SHA256(prehash, secret))
```

### quant-moo 实现

```typescript
// server/adapters/okx-adapter.ts
function okxSign(
  timestamp: string,
  method: string,
  path: string,
  body: string,
  secret: string,
): string {
  const prehash = timestamp + method + path + (body || '');
  return crypto.createHmac('sha256', secret)
    .update(prehash)
    .digest('base64');
}
```

### 请求头完整格式

| Header | 值 | 说明 |
|--------|-----|------|
| OK-ACCESS-KEY | API Key | 明文 |
| OK-ACCESS-TIMESTAMP | ISO 8601 | 如 "2026-06-13T05:00:00.000Z" |
| OK-ACCESS-SIGN | base64 签名 | 如上算法 |
| OK-ACCESS-PASSPHRASE | Passphrase | 创建API Key时设置 |
| OK-ACCESS-PROJECT | (可选) | 子账户项目名 |
| Content-Type | application/json | POST 请求 |

---

## 三、REST API 端点

### 3.1 健康检查

```
GET /api/v5/public/time
无需签名
返回: { data: [{ ts: "1685059200000" }] }
```

**quant-moo**: `healthCheck() → { ok, latencyMs }`

```typescript
async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  const res = await fetch(`${this.config.restBaseUrl}/api/v5/public/time`);
  return { ok: res.ok, latencyMs: Date.now() - start };
}
```

### 3.2 行情查询

#### 实时行情

```
GET /api/v5/market/ticker?instId=BTC-USDT
```

**quant-moo**: `getQuotes(symbols) → CloudQuoteInfo[]`
- 逐币种调用 (OKX 无批量 ticker 接口)
- 注意: OKX 价格波动使用 `sodUtc8` (UTC+8 0点) 而非24h前

| OKX 字段 | DW 字段 | 说明 |
|---------|---------|------|
| instId | symbol | BTC-USDT → BTC/USDT |
| last | price | 最新价 |
| last - sodUtc8 | change | 变动额 |
| changePct from sodUtc8 | changePct | 变动% |
| vol24h | volume | 24h成交量 |
| high24h | high24h | 24h最高 |
| low24h | low24h | 24h最低 |
| ts | timestamp | 时间戳 |

#### 深度 OrderBook

```
GET /api/v5/market/books?instId=BTC-USDT&sz=20
sz 范围: 1-400
```

**quant-moo**: `getDepth(symbol, limit?) → CloudDepthSnapshot`

返回: `{ bids: [[price, qty, ...], ...], asks: [[price, qty, ...], ...] }`

### 3.3 账户认证

```
GET /api/v5/account/balance (SIGNED)
```

**quant-moo**: `getAccount() → CloudAccountInfo`

| OKX 字段 | DW 含义 |
|---------|--------|
| data[0].totalEq | totalEquity |
| details[].availEq (ccy='USDT') | availableBalance |
| data[0].upl | unrealizedPnl |

### 3.4 下单接口

#### 下单

```
POST /api/v5/trade/order (SIGNED)
Body: {
  instId: "BTC-USDT",
  tdMode: "cash",
  side: "buy" | "sell",
  ordType: "market" | "limit",
  sz: "0.001",
  px: "60000",          // limit only
  clOrdId: "client-id"  // optional
}
```

**quant-moo**: `placeOrder(req) → CloudOrderInfo`

订单类型映射:

| DW | OKX |
|----|-----|
| MARKET | market |
| LIMIT | limit |
| STOP_LIMIT | conditional + limit |
| STOP_MARKET | conditional + market |

交易模式 (tdMode):

| 模式 | 说明 |
|------|------|
| cash | 现货 (非保证金) |
| cross | 全仓 |
| isolated | 逐仓 |

#### 撤单

```
POST /api/v5/trade/cancel-order (SIGNED)
Body: { instId: "BTC-USDT", ordId: "xxx" }
```

**quant-moo**: `cancelOrder(orderId, symbol) → boolean`

---

## 四、WebSocket 推送

### 4.1 公共频道

```
wss://ws.okx.com:8443/ws/v5/public
```

**订阅消息**:

```json
{
  "op": "subscribe",
  "args": [
    { "channel": "tickers", "instId": "BTC-USDT" },
    { "channel": "books", "instId": "ETH-USDT" }
  ]
}
```

### 4.2 私有频道

```
wss://ws.okx.com:8443/ws/v5/private
```

需要 `login` 消息 (含 OK-ACCESS-SIGN 签名)

**quant-moo 实现**:

- `subscribeQuotes(symbols)` → 订阅 `tickers` 频道
- `subscribeDepth(symbol)` → 订阅 `books` 频道
- 私有频道: 订阅 `orders` + `account` 频道

### 4.3 WebSocket 解析

```typescript
// 公共频道回包格式
{
  "arg": { "channel": "tickers", "instId": "BTC-USDT" },
  "data": [{ "last": "60000", ... }]
}
```

---

## 五、限速规则

| 等级 | 频率 |
|------|------|
| 公共接口 | 20次/2秒 |
| 私有接口 | 60次/2秒 |
| WebSocket 连接 | 1次/秒 |
| 登录 (WS login) | 10次/2秒 |
| 批量下单 | 300次/2秒 |

### HTTP 429 响应

```json
{
  "code": "50011",
  "msg": "Rate limit exceeded"
}
```

### quant-moo 退避策略

- HTTP 429 → 等待 Retry-After 头 (默认 10s)
- 指数退避: 2s→4s→8s, max 30s
- 断路器: 连续5次429 → 暂停券商 5分钟

---

## 六、符号格式

### 格式转换

| 输入 | OKX 格式 | DW |
|------|---------|-----|
| BTC/USDT | BTC-USDT | BTC/USDT |
| ETH/USDT | ETH-USDT | ETH/USDT |
| SOL/BTC | SOL-BTC | SOL/BTC |

```typescript
// quant-moo 内置转换
const okxSymbol = symbol.replace('/', '-');  // BTC/USDT → BTC-USDT
```

---

## 七、模拟交易

OKX 提供 Demo Trading 环境:

```
REST: https://www.okx.com (需 Demo Trading API Key)
```

**quant-moo 配置**: `simulateTrading = true` (行情数据模式, 不下真实单)

---

## 八、错误码速查

| HTTP | OKX Code | 含义 |
|------|---------|------|
| 400 | 50000 | Body 格式错误 |
| 401 | 50100 | 签名失败 |
| 401 | 50101 | 时间戳过期 (差值>30s) |
| 401 | 50102 | API Key 无效 |
| 401 | 50103 | Passphrase 错误 |
| 429 | 50011 | 频率限制 |
| 500 | 50026 | 系统错误 |

### 签名时间同步

OKX 要求时间戳与服务器时间差 ≤30秒。quant-moo 处理:

1. 连接时调用 `/api/v5/public/time` 获取服务器时间
2. 计算 `localOffset = serverTime - Date.now()`
3. 每次签名: `timestamp = Date.now() + localOffset`

---

## 九、接入检查清单

- [ ] OKX 账号已注册
- [ ] V5 API Key 已创建 (只读+交易)
- [ ] Passphrase 已记录 (3-key auth)
- [ ] IP 白名单已配置
- [ ] Demo Trading API Key 已获取
- [ ] quant-moo 桌面端配置面板已输入 (3个字段)
- [ ] 服务器端 AES-256-GCM 加密存储验证
- [ ] 连接测试: `/api/v5/public/time` → 200
- [ ] 行情测试: `getQuotes(['BTC/USDT'])` → 返回数据
- [ ] 时间同步验证: localOffset 计算正确

---

> **Signed**: QClaw — R130-Q02, OKX API 接入文档 (300+ lines)
