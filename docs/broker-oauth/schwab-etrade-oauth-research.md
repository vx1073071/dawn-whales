# Schwab & E*TRADE OAuth 预研报告

> **R1 Task | QClaw (quality-shrimp) | 2026-06-12**
> 
> 目标: 深入研究 Charles Schwab (OAuth2) 和 E*TRADE (OAuth1.0a) 的 API 认证流程、端点清单、接入复杂度，为 TradingEasy 适配器开发提供完整技术依据。

---

## 一、Schwab API (Charles Schwab) — OAuth 2.0

### 1.1 基本信息

| 项目 | 值 |
|------|-----|
| 开发者门户 | https://developer.schwab.com/ |
| API Base URL | `https://api.schwabapi.com` |
| 市场数据 Base | `https://api.schwabapi.com/marketdata/v1` |
| 交易 Base | `https://api.schwabapi.com/trader/v1` |
| OAuth 版本 | **OAuth 2.0 Authorization Code Grant + PKCE** |
| 认证方式 | Bearer Token in Authorization header |
| Token 有效期 | Access: 30分钟, Refresh: 7天 |
| 沙盒 | ✅ 有 (Sandbox environment) |
| WebSocket | ✅ Streamer API (实时行情推送) |
| 覆盖市场 | 美股/ETF/期权/期货/共同基金/债券 |
| 社区库 | Python: schwabdev, Schwab-API-Python |
| 速率限制 | 120 req/min (Account), 不限 (Market Data) |

### 1.2 OAuth 2.0 完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    Schwab OAuth2 Flow (PKCE)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: 构造 Authorization URL                              │
│         GET https://api.schwabapi.com/v1/oauth/authorize     │
│         ?response_type=code                                   │
│         &client_id={YOUR_CLIENT_ID}                          │
│         &redirect_uri=https://127.0.0.1:{PORT}               │
│         &code_challenge={BASE64URL(SHA256(verifier))}        │
│         &code_challenge_method=S256                          │
│         &scope=readonly%20trader                              │
│                     │                                        │
│                     ▼  (浏览器打开授权页)                      │
│  Step 2: 用户在 Schwab 登录 & 授权                             │
│          → 浏览器重定向到 redirect_uri?code={AUTH_CODE}      │
│                     │                                        │
│                     ▼  (本地 HTTP Server 拦截回调)            │
│  Step 3: 用 code 换取 token                                  │
│         POST https://api.schwabapi.com/v1/oauth/token        │
│         Content-Type: application/x-www-form-urlencoded      │
│         grant_type=authorization_code                        │
│         &code={AUTH_CODE}                                    │
│         &client_id={YOUR_CLIENT_ID}                          │
│         &redirect_uri=https://127.0.0.1:{PORT}               │
│         &code_verifier={ORIGINAL_VERIFIER}                    │
│                     │                                        │
│                     ▼  (返回 JSON)                            │
│  Step 4: 获得 token                                          │
│         { "access_token":"...", "refresh_token":"...",       │
│           "expires_in":1800, "token_type":"Bearer" }         │
│                                                             │
│  Step 5: 调用 API                                            │
│         GET https://api.schwabapi.com/trader/v1/accounts     │
│         Authorization: Bearer {access_token}                 │
│                                                             │
│  Step 6: Token 过期后刷新 (refresh_token grant)              │
│         POST https://api.schwabapi.com/v1/oauth/token        │
│         grant_type=refresh_token                             │
│         &refresh_token={REFRESH_TOKEN}                       │
│         &client_id={YOUR_CLIENT_ID}                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Electron 环境下的 OAuth 实现策略

**核心问题**: Electron 不是标准 Web 应用，无法简单用 redirect_uri。

**推荐方案**: **本地 HTTPS 服务器 + PKCE**

```typescript
// 伪代码: Schwab OAuth 在 Electron 中的实现
import { createServer } from 'https';
import { shell } from 'electron';

class SchwabOAuthFlow {
  private clientId: string;
  private redirectUri: string;
  private codeVerifier: string;
  private serverPort: number;

  async authenticate(): Promise<TokenSet> {
    // 1. 生成 PKCE verifier & challenge
    this.codeVerifier = this.generateCodeVerifier();
    const challenge = this.computeCodeChallenge(this.codeVerifier);
    this.serverPort = await this.findFreePort();

    // 2. 启动本地 HTTPS 服务器监听回调
    const codePromise = this.startCallbackServer();

    // 3. 构造授权 URL 并在系统浏览器打开
    const authUrl = this.buildAuthUrl(challenge);
    shell.openExternal(authUrl);

    // 4. 等待回调获取 code
    const authCode = await codePromise;

    // 5. 用 code 换 token
    const tokens = await this.exchangeCode(authCode);

    // 6. 安全存储 tokens
    await this.secureStore(tokens);
    return tokens;
  }
}
```

**关键要点**:
1. 用 Electron 的 `shell.openExternal()` 打开系统浏览器
2. 本地 HTTPS server (self-signed cert) 监听 `https://127.0.0.1:{port}/callback`
3. PKCE 必选 — Schwab 强制要求
4. Token 用 Electron `safeStorage` 加密存储
5. 自动刷新: 每次 API 调用前检查 access_token 是否快过期

### 1.4 核心 API 端点清单

#### 账户
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/trader/v1/accounts` | 获取所有账户列表 |
| GET | `/trader/v1/accounts/{accountNumber}` | 获取单个账户详情 |
| GET | `/trader/v1/accounts/accountNumbers` | 获取账户号哈希列表 |

#### 持仓 & 余额
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/trader/v1/accounts/{acct}/positions` | 获取持仓 (可选 ?positions,?includePositions=true) |
| GET | `/trader/v1/accounts/{acct}/balances` | 获取账户余额 |

#### 下单 & 交易
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/trader/v1/accounts/{acct}/orders` | 下单 (MARKET/LIMIT/STOP/STOP_LIMIT/TRAILING_STOP) |
| GET | `/trader/v1/accounts/{acct}/orders` | 查询订单 (可按状态/日期筛选) |
| GET | `/trader/v1/accounts/{acct}/orders/{orderId}` | 查询单个订单 |
| PUT | `/trader/v1/accounts/{acct}/orders/{orderId}` | 替换订单 |
| DELETE | `/trader/v1/accounts/{acct}/orders/{orderId}` | 撤单 |
| GET | `/trader/v1/accounts/{acct}/previewOrder` | 预览订单 |

#### 行情
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/marketdata/v1/quotes` | 实时报价 (单只/批量, ?symbols=AAPL,MSFT) |
| GET | `/marketdata/v1/{symbol}/quotes` | 单只股票报价 |
| GET | `/marketdata/v1/pricehistory` | 历史价格 (?symbol=AAPL&periodType=day&frequencyType=minute) |
| GET | `/marketdata/v1/chains` | 期权链 (?symbol=AAPL&strike=200&fromDate/toDate) |
| GET | `/marketdata/v1/movers/{index}` | 市场异动股 ($SPX/$DJI/$COMPX) |
| GET | `/marketdata/v1/markets` | 市场状态 (是否开盘) |

#### 交易历史
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/trader/v1/accounts/{acct}/transactions` | 交易历史 (按日期/类型筛选) |

### 1.5 技术复杂度评估

| 维度 | 复杂度 | 说明 |
|------|--------|------|
| OAuth 流程 | ⭐⭐⭐ 中 | PKCE + 本地 HTTPS server + 自动刷新 |
| API 响应格式 | ⭐ 低 | JSON，结构清晰 |
| 错误处理 | ⭐⭐ 低-中 | 标准 HTTP 错误码 + JSON error body |
| 速率限制 | ⭐⭐ 低-中 | 120/min account, unlimited market data |
| 订单类型 | ⭐⭐ 低-中 | MARKET/LIMIT/STOP/STOP_LIMIT/TRAILING_STOP/OCO |
| 期权支持 | ⭐⭐⭐ 中 | 期权链、希腊字母、到期日 |
| WebSocket | ⭐⭐⭐ 中 | Streamer API，需额外认证流程 |
| Token 安全存储 | ⭐⭐ 低-中 | Electron safeStorage |

---

## 二、E*TRADE API (Morgan Stanley) — OAuth 1.0a

### 2.1 基本信息

| 项目 | 值 |
|------|-----|
| 开发者门户 | https://developer.etrade.com/ |
| API Base URL | `https://api.etrade.com` |
| 交易 Base | `https://api.etrade.com/order/v1` (sandbox: `https://apisb.etrade.com`) |
| 行情 Base | `https://api.etrade.com/market/v1` |
| 账户 Base | `https://api.etrade.com/accounts/v1` |
| OAuth 版本 | **OAuth 1.0a** (非OAuth2!) |
| 签名方式 | **HMAC-SHA1** |
| Token 持久性 | 长期有效 (无自动过期) |
| 沙盒 | ✅ 有 (Sandbox: `apisb.etrade.com`) |
| 覆盖市场 | 美股/ETF/期权/期货 |
| 社区库 | Python: etrade-mcp-server; Go: 社区实现 |
| Node.js 库 | **无官方 TS/JS SDK** |

### 2.2 OAuth 1.0a 三步骤完整流程

```
┌──────────────────────────────────────────────────────────────┐
│               E*TRADE OAuth 1.0a 3-Step Flow                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PREREQUISITE:                                               │
│    在 https://developer.etrade.com 注册应用 →                │
│    获得 consumer_key (oauth_consumer_key)                     │
│    获得 consumer_secret (仅在签名时使用，不发送)               │
│                                                              │
│ ═══ Step 1: 获取未授权的 Request Token ═══                   │
│                                                              │
│    POST https://api.etrade.com/oauth/request_token            │
│    (Sandbox: https://apisb.etrade.com/oauth/request_token)    │
│    Headers:                                                   │
│      Authorization: OAuth                                     │
│        oauth_consumer_key="xxx",                              │
│        oauth_signature_method="HMAC-SHA1",                    │
│        oauth_signature="{COMPUTED_SIG}",  ← 用consumer_       │
│        oauth_timestamp="1234567890",        secret&""签名     │
│        oauth_nonce="aBcDeFgHiJ",                              │
│        oauth_callback="oob",  ← 桌面应用填 "oob" (OutOfBand) │
│        oauth_version="1.0"                                    │
│                                                              │
│    Response:                                                  │
│      oauth_token=xxx&oauth_token_secret=xxx&oauth_callback_   │
│      confirmed=true                                           │
│                     │                                        │
│                     ▼                                        │
│ ═══ Step 2: 用户授权 ═══                                     │
│                                                              │
│    构造 URL:                                                  │
│    https://us.etrade.com/e/t/etws/authorize                   │
│      ?key={oauth_consumer_key}                                │
│      &token={oauth_token_from_step1}                          │
│                                                              │
│    在浏览器中打开此 URL →                                     │
│    用户登录 E*TRADE 并点击 "Accept" →                        │
│    页面显示 Verifier Code (例如: "ABC123")                    │
│                     │                                        │
│                     ▼                                        │
│ ═══ Step 3: 用授权后的 Request Token 换取 Access Token ═══   │
│                                                              │
│    POST https://api.etrade.com/oauth/access_token             │
│    (Sandbox: https://apisb.etrade.com/oauth/access_token)     │
│    Headers:                                                   │
│      Authorization: OAuth                                     │
│        oauth_consumer_key="xxx",                              │
│        oauth_signature_method="HMAC-SHA1",                    │
│        oauth_token="{oauth_token_from_step1}",                │
│        oauth_signature="{COMPUTED_SIG}", ← 用consumer_secret  │
│        oauth_timestamp="1234567890",        &token_secret签名 │
│        oauth_nonce="jKkLmMnOpQ",                             │
│        oauth_verifier="{VERIFIER_CODE}", ← 用户从页面复制     │
│        oauth_version="1.0"                                    │
│                                                              │
│    Response:                                                  │
│      oauth_token=yyy&oauth_token_secret=yyy                   │
│                                                              │
│    得到永久的 access_token + access_token_secret !            │
│                     │                                        │
│                     ▼                                        │
│ ═══ Step 4: 调用 API (每次都要 OAuth 签名!) ═══             │
│                                                              │
│    GET https://api.etrade.com/accounts/v1/accounts/list       │
│    Headers:                                                   │
│      Authorization: OAuth                                     │
│        oauth_consumer_key="xxx",                              │
│        oauth_token="{access_token}",                          │
│        oauth_signature_method="HMAC-SHA1",                    │
│        oauth_signature="{COMPUTED_SIG}", ← 用consumer_secret  │
│        oauth_timestamp="NOW()",        &access_token_secret  │
│        oauth_nonce="RANDOM()",         签名!                  │
│        oauth_version="1.0"                                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 OAuth 1.0a 签名算法 (TypeScript 实现关键)

```typescript
// E*TRADE OAuth 1.0a 签名核心
import crypto from 'crypto';

class EtradeOAuth1 {
  // 生成签名基准字符串
  buildSignatureBaseString(
    method: string,    // "GET" | "POST"
    url: string,       // 不带参数的完整 URL
    params: Record<string, string>  // 所有 OAuth 参数（排序后）
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${this.percentEncode(k)}=${this.percentEncode(params[k])}`)
      .join('&');

    return [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(sortedParams)
    ].join('&');
  }

  // 计算 HMAC-SHA1 签名
  computeSignature(
    baseString: string,
    consumerSecret: string,
    tokenSecret: string
  ): string {
    // Step 1: 签名密钥 = consumer_secret + "&" + token_secret
    const key = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;

    // Step 2: HMAC-SHA1
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(baseString);

    // Step 3: Base64
    return hmac.digest('base64');
  }

  // 生成 nonce (随机字符串)
  generateNonce(): string {
    return crypto.randomBytes(16).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32);
  }

  // URL 编码 (RFC 3986)
  percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/\*/g, '%2A')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }

  // 构造 Authorization Header
  buildAuthorizationHeader(
    consumerKey: string,
    accessToken: string,
    signature: string,
    nonce: string,
    timestamp: number
  ): string {
    const params = [
      `oauth_consumer_key="${this.percentEncode(consumerKey)}"`,
      `oauth_nonce="${this.percentEncode(nonce)}"`,
      `oauth_signature="${this.percentEncode(signature)}"`,
      `oauth_signature_method="HMAC-SHA1"`,
      `oauth_timestamp="${timestamp}"`,
      `oauth_token="${this.percentEncode(accessToken)}"`,
      `oauth_version="1.0"`
    ];
    return `OAuth ${params.join(', ')}`;
  }

  // 📏 注意: 每个 API 请求都要：
  //   1. 生成新 nonce + timestamp
  //   2. 重新计算签名
  //   3. 构造 Authorization header
  // 这是 OAuth 1.0a 的最大特点 — 每个请求都要签名
}
```

### 2.4 Electron 环境下的实现策略

**核心问题**: OAuth 1.0a 桌面应用用 `oob` (Out of Band) 模式。

```
1. 应用 POST /oauth/request_token → 获得 request_token
2. 构造 authorize URL: https://us.etrade.com/e/t/etws/authorize?key=CONSUMER_KEY&token=REQUEST_TOKEN
3. shell.openExternal() 打开浏览器
4. 用户登录授权 → 页面显示 Verifier Code (6位字母数字)
5. 用户在 TradingEasy UI 中粘贴 Verifier Code ← ⚠️ 这是手动步骤!
6. 应用 POST /oauth/access_token → 获得永久 access_token
7. 安全存储 access_token + access_token_secret
```

**关键**: E*TRADE 的 access_token **不会过期** (除非用户手动 revoke)，所以只需要一次 OAuth 流程！

### 2.5 核心 API 端点清单

#### 账户
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/accounts/v1/accounts/list` | 获取所有账户列表 (含账户类型、状态) |
| GET | `/accounts/v1/accounts/balance` | 获取账户余额 (?accountId=xxx,?realTimeNAV=true) |

#### 持仓 (Portfolio)
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/accounts/v1/accounts/{acctId}/portfolio` | 获取持仓列表 (含成本价、市值、PnL) |
| GET | `/accounts/v1/accounts/{acctId}/portfolio/{symbol}` | 获取单只持仓详情 |

#### 下单 & 交易
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/order/v1/accounts/{acctId}/orders/place` | **下单** (POST body=XML!) |
| POST | `/order/v1/accounts/{acctId}/orders/preview` | 预览订单 (不实际执行) |
| POST | `/order/v1/accounts/{acctId}/orders/cancel` | 撤单 |
| GET | `/order/v1/accounts/{acctId}/orders` | 查询订单列表 (按状态/日期) |
| GET | `/order/v1/accounts/{acctId}/orders/{orderId}` | 查询单笔订单详情 |

**⚠️ E*TRADE 下单 Body 使用 XML 格式，不是 JSON!**

```xml
<!-- E*TRADE Place Order Request (XML Body) -->
<PlaceOrderRequest>
  <orderType>EQ</orderType>
  <clientOrderId>dw-20260612-001</clientOrderId>
  <Order>
    <Instrument>
      <Product>
        <securityType>EQ</securityType>
        <symbol>AAPL</symbol>
      </Product>
      <orderAction>BUY</orderAction>
      <quantityType>QUANTITY</quantityType>
      <orderedQuantity>10</orderedQuantity>
    </Instrument>
    <priceType>LIMIT</priceType>
    <limitPrice>185.50</limitPrice>
    <marketSession>REGULAR</marketSession>
    <orderTerm>GOOD_FOR_DAY</orderTerm>
  </Order>
</PlaceOrderRequest>
```

#### 行情
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/market/v1/quote/{symbols}` | 实时报价 (逗号分隔多只,如 AAPL,MSFT) |
| GET | `/market/v1/quote/{symbols}?detailFlag=ALL` | 详细报价 (含52周高低、股息等) |
| GET | `/market/v1/optionchains` | 期权链 (参数: symbol, expiryMonth, strikePriceNear等) |
| GET | `/market/v1/optionexpiredate` | 期权到期日列表 (?symbol=AAPL) |

#### 交易历史
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/accounts/v1/accounts/{acctId}/transactions` | 交易历史 (?startDate/endDate/transactionType) |

#### 市场 & 预警
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/market/v1/markethours` | 市场时间 |
| GET | `/accounts/v1/accounts/{acctId}/alerts` | 获取预警列表 |

### 2.6 技术复杂度评估

| 维度 | 复杂度 | 说明 |
|------|--------|------|
| OAuth 流程 | ⭐⭐⭐⭐ 高 | OAuth 1.0a 三步走 + 每请求签名 |
| OAuth 签名 | ⭐⭐⭐⭐⭐ 很高 | 每个 API 调用都要重新计算 HMAC-SHA1 签名 |
| 下单 XML Body | ⭐⭐⭐ 中 | 不用 JSON 用 XML，需额外的 serialize/deserialize |
| 用户交互 | ⭐⭐⭐ 中 | OOB 模式需用户手动粘贴 Verifier Code |
| Token 管理 | ⭐ 低 | Access token 永久有效，无需刷新 |
| API 响应格式 | ⭐⭐ 低-中 | XML 格式，需解析 |
| 错误处理 | ⭐⭐ 低-中 | HTTP 错误码 + 部分 XML error body |
| 期权支持 | ⭐⭐⭐ 中 | 期权链、到期日、希腊字母 |
| Node.js 生态 | ⭐⭐⭐⭐ 高 | 无官方 TS/JS SDK，需自研 OAuth 1.0a 签名库 |

---

## 三、Schwab vs E*TRADE 对比

| 维度 | Schwab (OAuth2) | E*TRADE (OAuth1.0a) |
|------|-----------------|---------------------|
| OAuth 版本 | OAuth 2.0 (现代) | OAuth 1.0a (旧) |
| 签名复杂度 | ⭐ 低 (Bearer token) | ⭐⭐⭐⭐⭐ 很高 (每请求签名) |
| Token 有效期 | 30min (需刷新) | 永久 |
| API 数据格式 | JSON | **XML** |
| 下单格式 | JSON | **XML** |
| 用户交互 | 浏览器自动重定向 | 手动粘贴 Verifier Code |
| Node.js 实现 | 标准 OAuth2 库即可 | 需自研签名库 |
| 沙盒 | ✅ | ✅ |
| 覆盖品种 | 美股+ETF+期权+期货+基金+债券 | 美股+ETF+期权+期货 |
| 本地 HTTPS Server | 需要 (回调) | 不需要 (OOB模式) |
| 开发工时估算 | 8h | 8h (OAuth1 签名复杂但无需刷新) |

---

## 四、TradingEasy 适配器开发建议

### 4.1 适配器继承关系

```
IBrokerAdapter (已有接口)
  ├── FutuBrokerAdapter (已有)
  ├── IBKRAdapter (已有)
  ├── SchwabAdapter (🆕 R1 预研 → R3 开发)
  │    └── 继承 DirectAdapter 基类
  │    └── 使用标准 OAuth2 流程
  │
  ├── ETRADEAdapter (🆕 R1 预研 → R3 开发)
  │    └── 继承 DirectAdapter 基类
  │    └── 使用自研 OAuth1.0a 签名
  │
  ├── eToroAdapter (🆕 R3)
  └── WebullAdapter (🆕 R3)
```

### 4.2 共用的 OAuth 基础设施

R1 预研阶段产出的 **共用模块**:

1. **OAuthBrokerBase** (JVS INF-07 负责):
   - 本地 HTTPS 服务器 (用于 OAuth2 回调)
   - Token 安全存储 (Electron safeStorage + keytar)
   - 自动刷新调度器 (Access Token 过期前自动 refresh)

2. **OAuth 1.0a 签名库** (QClaw OAU-02 负责):
   - HMAC-SHA1 签名计算
   - nonce + timestamp 生成
   - Authorization Header 构造
   - 百分号编码 (RFC 3986)

### 4.3 风险 & 缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Schwab OAuth 审批延迟 | 中 | 中 | 先用 Sandbox 开发 |
| E*TRADE OAuth 1.0a 签名错误 | 高 | 高 | 严格单元测试 + 参考现有 Python/Go 实现 |
| E*TRADE XML 解析兼容性 | 中 | 中 | 用 fast-xml-parser 处理 |
| E*TRADE API 被 MS 迁移 | 中 | 高 | 保留接口抽象层，便于迁移 |
| 本地 HTTPS 证书问题 | 低 | 低 | Self-signed 证书，Electron 可配置忽略 |

### 4.4 核心挑战排序

1. **🔴 最复杂**: E*TRADE OAuth 1.0a 签名 (每个请求都要签名，XML body)
2. **🟡 中等**: Schwab OAuth 2.0 PKCE + 本地 HTTPS 服务器
3. **🟡 中等**: E*TRADE XML 下单请求构造
4. **🟢 简单**: Schwab JSON REST API 调用
5. **🟢 简单**: Token 安全存储 (Electron safeStorage)

---

## 五、参考资料

### Schwab
- 官方文档: https://developer.schwab.com/
- Python 参考实现: https://github.com/itsjafer/Schwab-API-Python
- MCP Server (Python, 完整 OAuth2 实现): https://github.com/jkoelker/schwab-mcp
- API Spec (OpenAPI): 从开发者门户可下载

### E*TRADE
- 官方文档: https://developer.etrade.com/
- Python MCP 实现: https://github.com/mcpworld/etrade-mcp
- Go OAuth1 实现: https://bbs.itying.com/topic/695591a8dc652800528f391b
- OAuth 1.0a RFC: https://datatracker.ietf.org/doc/html/rfc5849

### TypeScript/Node.js 关键库
- `crypto` (Node.js built-in): HMAC-SHA1 签名
- `fast-xml-parser`: E*TRADE XML 解析
- `electron.safeStorage`: Token 加密存储
- `electron.shell.openExternal`: 打开浏览器授权

---

*Generated: R1-OAuth-Research | QClaw | 2026-06-12*
