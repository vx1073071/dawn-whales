# R133-Q01-2: Tiger Trade 接入文档

> **Author**: QClaw · **Task**: R133-Q01 (2/3) · **Hours**: 1h
> **Based on**: Tiger Trade SDK v5 + bridge-adapter pattern

---

## 一、Tiger 接入概览

| 项目 | 值 |
|------|-----|
| SDK | Tiger Trade Open API SDK (Node.js) |
| 市场 | 港股 (HKEX) + 美股 (NYSE/NASDAQ) |
| 行情 | REST + WebSocket |
| 认证 | API Key + Secret (HMAC-SHA256) |
| 签名 | tiger-id + timestamp + signature + tiger-sdk-version |

### quant-moo 适配器模式

```
TigerAdapter (BridgeAdapterBase 子类)
  → 港股/美股双市场
  → REST: openapi.tigersecurities.com / openapi.itiger.com
  → WS:  行情推送 + 订单状态
```

---

## 二、核心 REST 端点

### 2.1 行情

```
GET /quote/stock/brief?symbols=AAPL,TSLA
返回: [{ symbol, latestPrice, change, changeRatio, volume, high, low, open, preClose }]

GET /quote/stock/trade?symbol=AAPL&begin_time=...
返回: [{ tradeTime, price, volume, direction }]

GET /quote/stock/kline?symbol=AAPL&period=day&begin_time=...&end_time=...
返回: [{ index, open, high, low, close, volume }]
```

### 2.2 下单

```
POST /trade/order/place
Headers: Tiger-HD (HMAC signed)
Body: {
  account: "U1234567",
  symbol: "AAPL",
  orderType: "MKT" | "LMT",
  market: "US" | "HK",
  side: "BUY" | "SELL",
  quantity: 100,
  price: 180.00,          // limit only
  outsideRth: false,      // 盘后交易
  timeInForce: "DAY" | "GTC"
}
```

### 2.3 账户

```
GET /trade/account/assets?account=U1234567
返回: { summary: { totalCash, marketValue, totalAssets, unrealizedPL, realizedPL } }

GET /trade/order/active?account=U1234567
返回: [{ orderId, symbol, side, quantity, price, status, filledQuantity }]

POST /trade/order/cancel
Body: { account: "U1234567", id: "order-id" }
```

---

## 三、认证签名

```
headers = {
  "tiger-id": apiKey,
  "timestamp": "1685059200000",
  "sign": HMAC-SHA256(timestamp + apiKey + apiSecret).hex(),
  "tiger-sdk-version": "5.0.0"
}
```

---

## 四、实时行情 (WS)

```
连接: wss://openapi.tigersecurities.com/ws

订阅: { "topic": "QUOTE", "symbols": ["AAPL", "TSLA"] }
返回: { "type": "QUOTE", "data": [{ symbol, price, volume, time }] }

退订: { "topic": "UNSUBSCRIBE", "symbols": ["AAPL"] }
```

---

## 五、限速

| 接口 | 限制 |
|------|------|
| 行情 REST | 100次/分钟 |
| 交易 REST | 50次/分钟 |
| WS 连接 | 5次/分钟 |

---

## 六、接入检查清单

- [ ] Tiger Trade 账号已开户 (港股+美股权限)
- [ ] API Key 在 Tiger Open Platform 已生成
- [ ] IP 白名单已配置
- [ ] 连接测试: 行情 REST → 200
- [ ] 下单测试: 模拟盘 → 成交

---

> **Signed**: QClaw — R133-Q01-2, Tiger Trade 接入文档
