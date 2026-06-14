# R134-Q01-1: E*TRADE API 接入文档

> **Author**: QClaw · **Task**: R134-Q01 (1/5) · **Hours**: 0.8h
> **Based on**: electron/broker/adapters/ETRADEAdapter.ts (781 lines)

---

## 一、E*TRADE 接入概览

| 项目 | 值 |
|------|-----|
| 母公司 | Morgan Stanley |
| API Base | https://api.etrade.com (Sandbox: https://apisb.etrade.com) |
| 认证 | **OAuth 1.0a** (唯一使用此协议的适配器) |
| 签名 | HMAC-SHA1 每请求签名 |
| 数据格式 | **XML** (非 JSON!) |
| 市场 | US equities, ETFs, options, futures |
| 客户规模 | 860万 |

### TradingEasy 适配器

```
ETRADEAdapter extends OAuthBrokerBase
  → OAuth 1.0a 三步认证: Request Token → Authorize → Access Token
  → 每请求 HMAC-SHA1 签名
  → XML 解析 (etrade-parser.ts)
```

---

## 二、OAuth 1.0a 认证流程

### 三步认证

```
Step 1: POST /oauth/request_token
  → returns oauth_token + oauth_token_secret

Step 2: 浏览器跳转 → 用户授权
  https://us.etrade.com/e/t/etws/authorize?key={consumerKey}&token={oauth_token}

Step 3: POST /oauth/access_token
  → returns persistent access_token + access_token_secret
```

### 每请求签名

```typescript
// HMAC-SHA1 per-request signature
signature = HMAC_SHA1(
  signingKey = {consumerSecret}&{tokenSecret},
  baseString = {method}&{encodedUrl}&{encodedParams}
)
→ oauth_signature={base64(signature)}
```

### Authorization Header

```
Authorization: OAuth
  oauth_consumer_key="xxx",
  oauth_nonce="random",
  oauth_signature_method="HMAC-SHA1",
  oauth_timestamp="1685059200",
  oauth_token="xxx",
  oauth_signature="base64sig"
```

---

## 三、核心 REST 端点

### 3.1 行情 (XML Response)

```
GET /market/quote/{symbol}[,{symbol}]?detailFlag=ALL
Auth: OAuth 1.0a

XML Response: <QuoteResponse>
  <QuoteData>
    <Product><symbol>AAPL</symbol></Product>
    <All><bid>180.50</bid><ask>180.55</ask><lastTrade>180.52</lastTrade>
      <change>+1.20</change><volume>12345678</volume></All>
  </QuoteData>
</QuoteResponse>
```

### 3.2 账户

```
GET /accounts/rest/accountlist
Auth: OAuth 1.0a
XML Response: <AccountListResponse><Accounts><Account><accountId>...</accountId>

GET /accounts/rest/accountbalance/{accountIdKey}
Auth: OAuth 1.0a
XML: netAccountValue, availableForInvestment, marginBalance

GET /accounts/rest/portfoliolist/{accountIdKey}
Auth: OAuth 1.0a
XML: positions (symbol, quantity, pricePaid, currentValue)
```

### 3.3 下单

```
POST /order/rest/placeequityorder
Auth: OAuth 1.0a
Content-Type: application/xml

<PlaceEquityOrder>
  <EquityOrderRequest>
    <accountIdKey>xxx</accountIdKey>
    <clientOrderId>uuid</clientOrderId>
    <symbol>AAPL</symbol>
    <orderAction>BUY</orderAction>
    <orderType>MARKET</orderType>
    <quantity>10</quantity>
    <priceType>MARKET</priceType>
    <marketSession>REGULAR</marketSession>
    <orderTerm>GOOD_FOR_DAY</orderTerm>
  </EquityOrderRequest>
</PlaceEquityOrder>
```

### 3.4 订单查询与撤单

```
GET /order/rest/orderlist/{accountIdKey}
POST /order/rest/cancelorder
Body: <CancelOrderRequest><accountIdKey>xxx</accountIdKey><orderNum>123</orderNum>
```

---

## 四、接入检查清单

- [ ] E*TRADE 开发者账号已注册
- [ ] Consumer Key + Secret 已获取
- [ ] OAuth 1.0a 三步认证流程已测试
- [ ] Token 持久化存储 (access_token_secret 需保存)
- [ ] XML 解析器已验证
- [ ] 行情测试: getQuote('AAPL') → bid/ask
- [ ] 下单测试: placeOrder → Sandbox 确认

---

> **Signed**: QClaw — R134-Q01-1, E*TRADE API 接入文档
