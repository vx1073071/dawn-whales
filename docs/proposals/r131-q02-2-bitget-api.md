# R131-Q02-2: Bitget API 接入文档

> **Author**: QClaw · **Task**: R131-Q02 (part 2/3) · **Hours**: 1h
> **Version**: v2.0.0 | **API**: Bitget V2

---

## 一、Bitget 接入概览

| 项目 | 值 |
|------|-----|
| REST Base | https://api.bitget.com |
| WS Public | wss://ws.bitget.com/v2/ws/public |
| WS Private | wss://ws.bitget.com/v2/ws/private |
| 签名算法 | HMAC-SHA256 base64 (prehash=timestamp+method+path+query+body) |
| 符号格式 | BTCUSDT (无分隔) |
| Passphrase | 必需 (类似OKX 3-key auth) |

---

## 二、认证

### HMAC 签名

```
prehash = timestamp + method + path + queryString + body
signature = HMAC-SHA256(prehash, secret).base64()
```

### 请求头

| Header | 值 |
|--------|-----|
| ACCESS-KEY | API Key |
| ACCESS-TIMESTAMP | Unix ms |
| ACCESS-SIGN | base64 签名 |
| ACCESS-PASSPHRASE | API 创建时的 Passphrase |
| Content-Type | application/json |

### 签名示例

```
timestamp = "1685059200000"
method = "GET"
path = "/api/v2/spot/account/assets"
query = ""
body = ""

prehash = "1685059200000GET/api/v2/spot/account/assets"
signature = base64(HMAC-SHA256(prehash, secret))
```

---

## 三、REST API 端点

### 3.1 服务器时间

```
GET /api/v2/public/time
无需签名
返回: { code: "00000", data: { serverTime: "1685059200000" } }
```

### 3.2 行情

```
GET /api/v2/spot/market/tickers?symbol=BTCUSDT
返回: {
  data: [{
    symbol, buyOne, sellOne,
    last, usdtVolume, change, changeUtc8,
    high24h, low24h, ts
  }]
}

GET /api/v2/spot/market/candles?symbol=BTCUSDT&granularity=5min&limit=200
返回: { data: [[ts, open, high, low, close, vol, volCcy]] }
```

### 3.3 账户

```
GET /api/v2/spot/account/assets (SIGNED)
返回: { data: [{ coin, available, frozen, locked }] }
```

### 3.4 下单

```
POST /api/v2/spot/trade/place-order (SIGNED)
Body: {
  symbol: "BTCUSDT",
  side: "buy" | "sell",
  orderType: "market" | "limit",
  force: "gtc" | "fok" | "ioc",
  size: "0.001",
  price: "60000"
}
```

### 3.5 撤单

```
POST /api/v2/spot/trade/cancel-order (SIGNED)
Body: { symbol: "BTCUSDT", orderId: "..." }
```

---

## 四、限速

| 接口类 | 限制 |
|--------|------|
| 公共 | 20次/秒/IP |
| 签名 | 20次/秒/Key |
| 下单 | 10次/秒/Key |

---

## 五、接入检查清单

- [ ] Bitget 账号 + V2 API Key (读+交易)
- [ ] Passphrase 已记录
- [ ] IP 白名单绑定
- [ ] 连接测试: GET /api/v2/public/time → code:00000
- [ ] 行情正常返回
- [ ] 订单测试 (测试网: api.bitget.com → 切换测试网)

---

> **Signed**: QClaw — R131-Q02-2, Bitget API 接入文档
