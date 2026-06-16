# R134-Q01-2: eToro API 接入文档

> **Author**: QClaw · **Task**: R134-Q01 (2/5) · **Hours**: 0.8h
> **Based on**: electron/broker/adapters/eToroAdapter.ts (382 lines)

---

## 一、eToro 接入概览

| 项目 | 值 |
|------|-----|
| 认证 | OAuth2 Authorization Code + API Key |
| API Type | REST + WebSocket |
| 市场 | US stocks, ETFs, crypto, commodities, forex |
| 特色 | CopyTrader (跟单), Agent Portfolio (智能组合), 社交交易 |

### quant-moo 适配器

```
eToroAdapter extends OAuthBrokerBase
  → OAuth2 clientId + clientSecret + apiKey
  → CopyTrader API: 订阅信号源 → 自动跟单
  → Agent Portfolio: 一键复制策略组合
```

---

## 二、OAuth2 认证

```
① 浏览器跳转: https://etoro.com/api/authorize?client_id=xxx&redirect_uri=http://localhost:8085
② 用户授权 → redirect with code
③ POST /api/token { code, client_id, client_secret } → access_token + refresh_token
④ 后续请求: Authorization: Bearer {access_token}
```

### Token 配置

```typescript
interface EToroConfig {
  type: 'etoro';
  clientId: string;
  clientSecret: string;
  apiKey: string;
  useRealAccount?: boolean; // false = demo account
}
```

---

## 三、核心 REST 端点

### 3.1 行情

```
GET /api/market/quotes?symbols=AAPL,TSLA
Auth: Bearer {token}
→ [{ symbol, bid, ask, last, change, changePercent, volume, high, low, open }]
```

### 3.2 账户

```
GET /api/account
→ { balance, equity, pnl, positions: [...], copyPortfolio: {...} }

GET /api/account/positions
→ [{ instrumentId, symbol, amount, openRate, currentRate, pnl, pnlPercent }]
```

### 3.3 下单

```
POST /api/order
{
  instrumentId: "1",
  symbol: "AAPL",
  side: "BUY",
  quantity: 10,
  type: "MARKET",
  leverage: 1,
  stopLoss: 175.00,
  takeProfit: 190.00,
  useRealAccount: true
}
```

---

## 四、CopyTrader 跟单 (eToro 独有)

### 信号源发现

```
GET /api/copytrader/top?category=tech&count=20
→ [{ traderId, name, winRate, totalReturn, riskScore, followers, minCopyAmount }]
```

### 订阅跟单

```
POST /api/copytrader/copy
{
  traderId: "trader123",
  copyAmount: 500,      // 跟单金额
  stopLossPercent: 20,   // 超过-20%停止跟单
  copyOpenTrades: false  // 不复制已有持仓
}
```

### Agent Portfolio (智能组合)

```
GET /api/agent/portfolios?riskLevel=medium
→ [{ portfolioId, name, composition, historicalReturn, volatility, minInvestment }]

POST /api/agent/invest { portfolioId, amount }
```

---

## 五、限速

| 接口 | 限制 |
|------|------|
| 行情 | 120次/分钟 |
| 下单 | 30次/分钟 |
| CopyTrader | 10次/分钟 |

---

## 六、接入检查清单

- [ ] eToro 开发者 App 已注册
- [ ] clientId + clientSecret + apiKey 已获取
- [ ] Sandbox 环境已配置
- [ ] OAuth2 授权流程已测试
- [ ] 行情测试: getQuote('AAPL')
- [ ] 下单测试: Demo Account 确认
- [ ] CopyTrader 测试: 订阅信号源 → 跟单执行

---

> **Signed**: QClaw — R134-Q01-2, eToro API 接入文档
