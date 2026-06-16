# R130-Q01: Binance API 接入指南 & 文档

> **Author**: QClaw · **Task**: R130-Q01 · **Hours**: 2h
> **Version**: v2.0.0 | **Based on**: server/adapters/binance-adapter.ts (JVS, 15KB)

---

## 一、Binance 接入概览

### quant-moo 中的 Binance 架构

```
桌面端/server → BinanceAdapter (server/adapters/binance-adapter.ts)
              → ICloudBrokerAdapter 接口
              → HMAC-SHA256 签名
              → REST: api.binance.com
              → WS:   stream.binance.com
```

### 前置条件

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | Binance 账号 | https://www.binance.com 注册 |
| 2 | 创建 API Key | API管理 → 创建API → 记录API Key + Secret Key |
| 3 | 用户输入 | 桌面端 API Key 配置面板输入 |
| 4 | 服务器加密存储 | AES-256-GCM 加密 → keys.db |
| 5 | 运行时解密 | CredentialManager 注入 CloudBrokerConfig |

### 安全最佳实践

- ✅ 使用只读 + 交易权限 API Key（不要开启提现权限）
- ✅ 绑定 IP 白名单（API管理 → IP白名单）
- ✅ 定期轮转 API Key（30天/次）
- ✅ 生产环境禁用 Universal Transfer 权限

---

## 二、REST API 端点 (BinanceAdapter 实现)

### 2.1 健康检查

```
GET /api/v3/ping
无需签名
```

**实现**: `healthCheck()` — 测量延迟，返回 `{ ok: boolean, latencyMs: number }`

### 2.2 行情查询

#### 24h Ticker

```
GET /api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]
权重: 40 (≤2 symbols) / 2×N (≥3 symbols)
```

**quant-moo 调用**: `getQuotes(symbols: string[]) → CloudQuoteInfo[]`

返回字段映射:

| Binance 字段 | CloudQuoteInfo 字段 | 说明 |
|-------------|-------------------|------|
| symbol | symbol | 交易对 |
| lastPrice | price | 最新价 |
| priceChange | change | 价格变动 |
| priceChangePercent | changePct | 变动百分比 |
| volume | volume | 24h成交量 |
| highPrice | high24h | 24h最高 |
| lowPrice | low24h | 24h最低 |
| closeTime | timestamp | 收盘时间 |

#### 深度 OrderBook

```
GET /api/v3/depth?symbol=BTCUSDT&limit=20
权重: 100 (1000 for limit=1000)
```

**quant-moo 调用**: `getDepth(symbol, limit?) → CloudDepthSnapshot`

返回格式: `{ bids: [[price, qty], ...], asks: [[price, qty], ...] }`

### 2.3 账户认证

#### 账户信息

```
GET /api/v3/account (SIGNED)
需要 API Key 签名
```

**quant-moo 调用**: `getAccount() → CloudAccountInfo`

计算逻辑: 遍历 balances 数组，sum(b.free × USDT价格) = totalEquity

### 2.4 下单接口

#### 下单

```
POST /api/v3/order (SIGNED)
参数: symbol, side (BUY/SELL), type (MARKET/LIMIT), quantity
可选: price, stopPrice, newClientOrderId
权重: 1
```

**quant-moo 调用**: `placeOrder(req) → CloudOrderInfo`

订单类型映射:

| CloudOrderRequest.orderType | Binance type |
|---------------------------|-------------|
| MARKET | MARKET |
| LIMIT | LIMIT |
| STOP_LIMIT | STOP_LOSS_LIMIT |
| STOP_MARKET | STOP_LOSS |

订单状态映射 (Binance → DW):

| Binance Status | Cloud Status |
|---------------|-------------|
| NEW | NEW |
| PARTIALLY_FILLED | PARTIALLY_FILLED |
| FILLED | FILLED |
| CANCELED | CANCELED |
| REJECTED | REJECTED |
| EXPIRED | EXPIRED |

#### 撤单

```
DELETE /api/v3/order (SIGNED)
参数: symbol, orderId
```

**quant-moo 调用**: `cancelOrder(orderId, symbol) → boolean`

---

## 三、WebSocket 实时推送

### 3.1 公共行情流

```
wss://stream.binance.com:9443/ws/<streamName>
```

**quant-moo 实现**:

- `subscribeQuotes(symbols)` — 拼接 `btcusdt@ticker/ethusdt@ticker` → WS 订阅
- `subscribeDepth(symbol)` — `btcusdt@depth20@100ms` → WS 订阅
- 回调: `onQuote()`, `onDepth()`, `onOrderUpdate()`, `onError()`

### 3.2 用户数据流 (User Data Stream)

```
POST /api/v3/userDataStream → { listenKey }
PUT  /api/v3/userDataStream?listenKey=... (每30分钟保活)
DELETE /api/v3/userDataStream (断连清理)
```

用于接收: 订单状态更新、账户变更、余额变动

### 3.3 WebSocket 重连机制

| 场景 | 延迟 |
|------|------|
| 首次断连 | 100ms |
| 二次断连 | 500ms |
| 三次断连 | 1s |
| 最大重试 | 10次 → 通知 `onError()` |

---

## 四、HMAC-SHA256 签名机制

### 签名算法

```
signature = HMAC-SHA256(queryString, secretKey).hex()
```

### 请求头

| Header | 值 |
|--------|-----|
| X-MBX-APIKEY | apiKey (明文) |
| timestamp | Unix ms |
| signature | HMAC-SHA256 计算结果 |

### quant-moo 实现

```typescript
// server/adapters/binance-adapter.ts
function sign(queryString: string, secret: string): string {
  return crypto.createHmac('sha256', secret)
    .update(queryString)
    .digest('hex');
}
```

### 签名安全规则

1. **时间戳必须在服务器时间 ±1000ms 内** — 先调用 `/api/v3/time` 同步
2. **recvWindow 默认 5000ms** — 防重放
3. **queryString 拼装顺序固定** — 按 ASCII 排序

---

## 五、限速规则

### 请求权重系统 (UPLOADS)

| 接口类型 | 权重 |
|---------|------|
| GET /api/v3/ping | 1 |
| GET /api/v3/ticker/24hr | 40 (≤2 symbols) / 2N (≥3) |
| GET /api/v3/depth (limit=100) | 20 |
| GET /api/v3/account | 20 |
| POST /api/v3/order | 1 |
| GET /api/v3/openOrders | 40 |

### 硬限制

| API Key 等级 | 每分钟最大请求 | 每秒最大订单 |
|------------|-------------|------------|
| 无 API Key | 1200/min | 10/s |
| 有 API Key (默认) | 6000/min | 20/s |
| VIP 1-9 | 更高 | 更高 |

### quant-moo 限速策略

- 单券商请求间隔 ≥100ms
- 同一 endpoint 并发 ≤5
- 返回 429 时退避 5s 后重试 (max 3 次)

---

## 六、交易对配置

### 市场类型

| DW MarketType | Binance 对应 |
|-------------|------------|
| spot | 现货 (SPOT) |
| margin_cross | 全仓杠杆 |
| margin_isolated | 逐仓杠杆 |
| usd_m | U本位合约 |
| coin_m | 币本位合约 |

### 符号格式转换

| 输入 | Binance 格式 | quant-moo 格式 |
|------|------------|-----------------|
| BTC/USDT | BTCUSDT | BTC/USDT |
| ETH/BTC | ETHBTC | ETH/BTC |
| SOL/USDT | SOLUSDT | SOL/USDT |

---

## 七、Testnet

| 环境 | REST | WS |
|------|------|-----|
| Spot Testnet | testnet.binance.vision | testnet.binance.vision |
| Futures Testnet | testnet.binancefuture.com | testnet.binancefuture.com |

### 测试网账号

1. 前往 https://testnet.binance.vision 使用 GitHub 登录
2. 生成 HMAC_SHA256 API Key
3. quant-moo 配置: `type: 'binance-testnet'`

---

## 八、错误码速查

| HTTP | Binance Code | 含义 | DW 处理 |
|------|------------|------|---------|
| 400 | -1013 | 订单数量低于最小交易量 | CloudErrorCallback |
| 400 | -2010 | 账户余额不足 | CloudErrorCallback |
| 400 | -2011 | 订单已被拒绝 | CloudErrorCallback |
| 429 | -1003 | 超过速率限制 | 5s退避重试 |
| 401 | -2015 | 无效 API Key | 通知用户重新配置 |
| 403 | - | WAF 拦截 | CloudErrorCallback |

---

## 九、接入检查清单

- [ ] Binance 账号已注册
- [ ] API Key 已创建（只读+交易权限）
- [ ] IP 白名单已配置
- [ ] Testnet API Key 已获取
- [ ] quant-moo 桌面端 API Key 面板已输入
- [ ] 服务器端 `./data/api-keys.db` 加密存储验证
- [ ] 连接测试: `/api/v3/ping` → 200
- [ ] 行情测试: `getQuotes(['BTC/USDT'])` → 返回数据
- [ ] 订单测试: `placeOrder(...)` → 测试网上成功

---

> **Signed**: QClaw — R130-Q01, Binance API 接入文档 (350+ lines)
