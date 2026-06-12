# R131-Q02-1: Bybit API 接入文档

> **Author**: QClaw · **Task**: R131-Q02 (part 1/3) · **Hours**: 1h
> **Version**: v2.0.0 | **API**: Bybit V5

---

## 一、Bybit 接入概览

| 项目 | 值 |
|------|-----|
| REST Base | https://api.bybit.com |
| WS Public | wss://stream.bybit.com/v5/public/spot |
| WS Private | wss://stream.bybit.com/v5/private |
| 签名算法 | HMAC-SHA256 (hex) |
| 符号格式 | BTCUSDT (无分隔) |
| Testnet | https://api-testnet.bybit.com |

---

## 二、认证

### HMAC 签名

```
signature = HMAC-SHA256(timestamp + api_key + recv_window + queryString, secret)
```

### 请求参数 (必须)

| 参数 | 说明 |
|------|------|
| api_key | API Key |
| timestamp | Unix ms |
| sign | HMAC-SHA256 hex |
| recv_window | 默认 5000ms |

---

## 三、REST API 端点

### 3.1 服务器时间

```
GET /v5/market/time
无需签名
返回: { retCode: 0, result: { timeSecond: "...", timeNano: "..." } }
```

### 3.2 行情

```
GET /v5/market/tickers?category=spot&symbol=BTCUSDT
返回: { result: { list: [{ symbol, lastPrice, bid1Price, ask1Price, volume24h, price24hPcnt, highPrice24h, lowPrice24h }] } }

GET /v5/market/kline?category=spot&symbol=BTCUSDT&interval=5&limit=200
返回: { result: { list: [[timestamp, open, high, low, close, volume, turnover]] } }
```

### 3.3 账户

```
GET /v5/account/wallet-balance?accountType=UNIFIED (SIGNED)
返回: { result: { list: [{ totalEquity, totalAvailableBalance, coin: [{ coin, equity, availableToWithdraw }] }] } }
```

### 3.4 下单

```
POST /v5/order/create (SIGNED)
Body: {
  category: "spot",
  symbol: "BTCUSDT",
  side: "Buy" | "Sell",
  orderType: "Market" | "Limit",
  qty: "0.001",
  price: "60000"           // Limit only
}

返回: { result: { orderId, orderLinkId } }
```

### 3.5 撤单

```
POST /v5/order/cancel (SIGNED)
Body: { category: "spot", symbol: "BTCUSDT", orderId: "..." }
```

---

## 四、限速

| 接口 | 限制 |
|------|------|
| 公共 GET | 50次/5秒/IP |
| 签名接口 | 50次/5秒/Key |
| 下单 | 100次/5秒/Key |
| WS连接 | 20次/分钟 |

HTTP 429 → Retry-After 头 → 退避重试

---

## 五、接入检查清单

- [ ] Bybit 账号 + V5 API Key (读+交易)
- [ ] IP 白名单绑定
- [ ] 环境变量或加密存储 API Key
- [ ] 时间同步测试 (服务器时间差 <1s)
- [ ] 连接测试: GET /v5/market/time → 200
- [ ] 行情测试: getQuotes(['BTC/USDT'])
- [ ] 订单测试 (测试网)

---

> **Signed**: QClaw — R131-Q02-1, Bybit API 接入文档
