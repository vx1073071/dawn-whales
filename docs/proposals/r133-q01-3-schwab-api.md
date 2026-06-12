# R133-Q01-3: Charles Schwab API 接入文档

> **Author**: QClaw · **Task**: R133-Q01 (3/3) · **Hours**: 1h
> **Based on**: electron/broker/adapters/SchwabAdapter.ts (652 lines)

---

## 一、Schwab 接入概览

| 项目 | 值 |
|------|-----|
| 认证 | OAuth2 Authorization Code + PKCE |
| API Base | https://api.schwabapi.com |
| Token URL | https://api.schwabapi.com/v1/oauth/token |
| Auth URL | https://api.schwabapi.com/v1/oauth/authorize |
| Streamer | WebSocket (行情推送) |
| 市场 | US equities, ETFs, options, futures, mutual funds, bonds |

### DAWN WHALES 适配器

```
SchwabAdapter extends OAuthBrokerBase implements IBrokerAdapterV2
  → OAuth2 (PKCE + state) + local callback server
  → Token 存储: keytar (Windows/macOS) 或加密文件
  → 行情: REST `/marketdata/v1/quotes` + WS Streamer API
```

---

## 二、OAuth2 认证流程

### 2.1 开发者注册

| 步骤 | 操作 |
|------|------|
| 1 | https://developer.schwab.com → 注册 App |
| 2 | 获取 `client_id` 和 `client_secret` |
| 3 | 设置 redirect_uri: `http://localhost:8083/callback` |
| 4 | DAWN WHALES 配置面板输入 |

### 2.2 授权流程

```
DAWN WHALES → 打开浏览器 → Schwab 授权页 → 用户确认
                                    ↓
                                redirect → localhost:8083?code=xxx
                                    ↓
                            DAWN WHALES 兑换 token → 存储 token
```

### 2.3 Token 管理

| 参数 | 说明 |
|------|------|
| access_token | 30分钟有效 |
| refresh_token | 7天有效 |
| 刷新时机 | 提前60秒自动刷新 |

---

## 三、核心 REST 端点

### 3.1 行情

```
GET /marketdata/v1/quotes?symbols=AAPL,TSLA&fields=quote
Auth: Bearer {access_token}

返回: {
  AAPL: {
    quote: {
      bidPrice, askPrice, lastPrice,
      openPrice, highPrice, lowPrice, closePrice,
      totalVolume, netChange, netPercentChange,
      quoteTime
    }
  }
}

GET /marketdata/v1/pricehistory?symbol=AAPL&periodType=day&period=10
Auth: Bearer {access_token}
返回: { candles: [{ datetime, open, high, low, close, volume }] }
```

### 3.2 账户

```
GET /trader/v1/accounts/accountNumbers
返回: [{ accountNumber, hashValue }]

GET /trader/v1/accounts/{accountHash}
Auth: Bearer {access_token}
返回: {
  securitiesAccount: {
    currentBalances: { cashBalance, marginBalance, availableFunds, ... },
    positions: [{ symbol, longQuantity, marketValue, averagePrice, ... }],
    orders: [{ orderId, symbol, status, filledQuantity, ... }]
  }
}
```

### 3.3 下单

```
POST /trader/v1/accounts/{accountHash}/orders
Auth: Bearer {access_token}
Body: {
  orderType: "MARKET" | "LIMIT",
  session: "NORMAL" | "AM" | "PM",
  duration: "DAY" | "GOOD_TILL_CANCEL",
  orderStrategyType: "SINGLE",
  orderLegCollection: [{
    instruction: "BUY" | "SELL",
    quantity: 1,
    instrument: { symbol: "AAPL", assetType: "EQUITY" }
  }],
  price: 180.00  // LIMIT only
}
```

### 3.4 撤单

```
DELETE /trader/v1/accounts/{accountHash}/orders/{orderId}
Auth: Bearer {access_token}
```

---

## 四、WebSocket Streamer

```
连接: wss://streamer.schwab.com/ws
认证: LOGIN request with streamerKey (从 accounts 端点获取)

数据流:
  - LEVELONE_EQUITIES: 实时 bid/ask/last
  - LEVELONE_OPTIONS: 期权实时行情
  - CHART_EQUITY: 实时K线更新
  - ACCT_ACTIVITY: 订单状态+成交通知
```

### 订阅示例

```json
{
  "service": "LEVELONE_EQUITIES",
  "requestid": "1",
  "command": "SUBS",
  "SchwabClientCustomerId": "...",
  "SchwabClientCorrelId": "...",
  "parameters": {
    "keys": "AAPL,TSLA",
    "fields": "0,1,2,3,4,5,6,7,8,9,10"
  }
}
```

---

## 五、限速

| 接口 | 限制 |
|------|------|
| 行情 REST | 120次/分钟 |
| 交易 REST | 120次/分钟 |
| Streamer | 3000 symbol/连接 |

---

## 六、接入检查清单

- [ ] Schwab 开发者 App 已注册
- [ ] OAuth2 授权流程已测试 (localhost callback)
- [ ] Token 已成功存储 (keytar或加密文件)
- [ ] 行情测试: getQuotes(['AAPL']) → bid/ask
- [ ] 账户测试: getAccount() → accountHash/cashBalance
- [ ] 订单测试: placeOrder → 模拟盘确认

---

> **Signed**: QClaw — R133-Q01-3, Schwab API 接入文档
