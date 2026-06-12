# 券商接入研究报告 — dawn-whales 多券商整合方案

> 研究时间: 2026-06-12 | 涵盖 25 家券商/交易所

---

## 一、券商分类矩阵

| 类别 | 券商 | 市场 | API 可用性 | 认证方式 | 协议 |
|------|------|------|-----------|---------|------|
| **香港券商** | 富途 Futu | HK/US/CN A股 | ✅ 官方 OpenAPI | Futu ID + RSA | Protobuf over TCP |
| | 耀才 Bright Smart | HK | ❌ 无公开 API | — | — |
| | 华盛 VBrokers | HK/US | ⚠️ 有限 API | 内部 | REST/WebSocket |
| | 老虎 Tiger | HK/US/SG | ✅ Tiger Open API | API Key + Secret | REST/WebSocket |
| | 长桥 Longbridge | HK/US/SG | ✅ Longbridge OpenAPI | OAuth 2.0 + JWT | REST/WebSocket |
| | 盈立 uSMART | HK/US | ⚠️ 有限 | 内部 | REST |
| | 富昌 (Fubon Bank Securities) | HK | ❌ 无公开 API | — | — |
| **全球综合** | 盈透 IB | 150+ 市场 | ✅ TWS API / IB Gateway | 用户名/密码 | TCP ( proprietary ) |
| | moomoo | SG/US/AU | ✅ 同富途 OpenAPI | Futu ID | Protobuf over TCP |
| **美国券商** | 微牛 Webull | US | ✅ Webull OpenAPI | OAuth 2.0 | REST/WebSocket |
| | Robinhood | US | ⚠️ 非官方 / 受限 | OAuth 2.0 | REST (unofficial) |
| | Fidelity | US | ❌ 无公开交易 API | — | — |
| | Charles Schwab | US | ✅ Schwab API | OAuth 2.0 PKCE | REST |
| | E*TRADE (Morgan Stanley) | US | ✅ E*TRADE API | OAuth 1.0a | REST |
| **加密货币** | 币安 Binance | Global | ✅ Spot/Futures/Option | HMAC SHA256 | REST/WebSocket/FIX |
| | OKX | Global | ✅ V5 Unified | HMAC SHA256 + Ed25519 | REST/WebSocket |
| | Bybit | Global | ✅ V5 Unified | HMAC SHA256 | REST/WebSocket |
| | Bitget | Global | ✅ V2 API | HMAC SHA256 | REST/WebSocket |
| **日本券商** | Rakuten Securities | JP | ✅ Rakuten API | OAuth 2.0 | REST |
| | SBI Securities | JP | ⚠️ 机构级 API | 申请制 | FIX / REST |
| | Monex | JP | ✅ Monex API | OAuth 2.0 | REST |
| **欧洲券商** | Trade Republic | DE/EU | ❌ 无公开 API | — | — |
| | Revolut Trading | UK/EU | ❌ 无公开 API | — | — |
| | DEGIRO | NL/EU | ⚠️ 非官方 API | 用户名/密码 | REST (unofficial) |
| **社交交易** | eToro | Global | ❌ 无公开 API | — | — |

**API 可用统计**: 有官方 API = 13 家, 有限/内部 API = 5 家, 无 API = 7 家

---

## 二、各券商 API 详情

### 2.1 富途 Futu / moomoo (同一套 API)

**架构**: OpenD 网关 + SDK
- OpenD: 本地/云端运行的网关程序, TCP 协议转发到富途服务器
- SDK: Python/Java/C#/C++/JavaScript 封装
- **协议**: Protobuf over TCP (自定义协议)

**接入流程**:
1. 下载安装 OpenD 网关
2. 用 Futu ID 登录 OpenD
3. 本地程序通过 TCP 连接到 OpenD (默认端口 11111)
4. 使用 Protobuf 协议发送请求

**支持功能**:
- 行情: 实时报价、K线、摆盘、经纪商队列、资金流向
- 交易: 港股/美股/A股下单、改单、撤单
- 账户: 持仓、订单、资产、历史成交
- 订阅: 最多 1000 只股票实时推送

**限制**:
- 需要富途牛牛账户, 有资产门槛
- OpenD 必须保持运行
- 港股LV2行情需付费订阅
- 并发连接限制

**参考**: https://openapi.futunn.com/futu-api-doc/en/intro/intro.html

---

### 2.2 老虎 Tiger Brokers

**架构**: Tiger Open API
- REST API + WebSocket 推送
- SDK: Python/Java/Node.js/C++

**认证**: API Key + Secret Key, HMAC-SHA256 签名

**接入流程**:
1. 在老虎证券 App 申请 API 权限
2. 获取 API Key 和 Secret
3. 所有请求需签名: `sign = HMAC-SHA256(timestamp + method + url + body, secret)`

**支持功能**:
- 行情: 实时报价、K线、深度
- 交易: 港股/美股/A股/新加坡股
- 账户: 资产、持仓、订单、历史
- 财务数据: 财报、估值指标

**限制**:
- 申请 API 需满足资产门槛 (通常 >$10,000)
- 行情数据有延迟 (免费版) / 实时 (付费版)
- 限速: 约 10 req/s

**参考**: https://www.itiger.com/openapi

---

### 2.3 长桥 Longbridge

**架构**: Longbridge OpenAPI
- REST API + WebSocket
- OAuth 2.0 认证 + JWT Token

**接入流程**:
1. 在长桥 App 创建 API Key
2. OAuth 授权获取 access_token
3. JWT 签名请求

**支持功能**:
- 行情: 实时报价、K线、摆盘、资金流
- 交易: 港股/美股/A股/新加坡股
- 订阅: WebSocket 实时推送

**特点**:
- 文档完善, 社区活跃
- 有免费的港股LV1行情
- 新加坡券商, 合规性较好

**参考**: https://open.longbridgeapp.com/en/docs

---

### 2.4 盈透 Interactive Brokers (IB)

**架构**: TWS API / IB Gateway
- **TWS API**:  Trader Workstation 内置 API (端口 7496)
- **IB Gateway**: 轻量级网关 (端口 4001)
- 协议:  proprietary TCP 协议

**认证**: IB 账户用户名/密码登录 TWS/Gateway

**支持功能 (最全)**:
- 市场: 150+ 市场, 股票/期权/期货/外汇/债券/CFD
- 行情: 实时/延迟/历史
- 交易: 全品类下单
- 账户: 完整 portfolio 信息
- 历史数据: 可请求多年 tick/K线数据

**限制**:
- API 非线程安全, 需单线程处理
- 历史数据有 pacing 限制 (每请求间隔 ~1-10s)
- 实时行情需订阅市场数据 (付费)

**参考**: https://www.interactivebrokers.com/en/trading/ib-api.php

---

### 2.5 币安 Binance

**架构**: 多层级 API
- **REST API**: 现货/合约/期权
- **WebSocket API**: 实时市场数据 / 用户数据流
- **FIX API**: 机构级 (需申请)

**认证**:
- HMAC SHA256: API Key + Secret
- RSA: 公钥/私钥对 (推荐, 更安全)
- Ed25519: 最新签名方案

**支持功能**:
- 现货: 交易对 >2000, 下单/撤单/查询
- 合约: U本位/币本位永续 + 交割
- 期权: 欧式期权
- 理财: 质押/借贷/赚币
- WebSocket: 实时深度/成交/K线/账户更新

**限速**:
- IP 限流: 1200 req/min (现货)
- 订单限流: 按交易对计算
- WebSocket: 每个连接最多 1024 订阅

**参考**: https://developers.binance.com/docs/binance-spot-api-docs

---

### 2.6 OKX

**架构**: V5 Unified API
- 一套 API 覆盖现货/合约/期权
- REST + WebSocket

**认证**:
- HMAC SHA256: API Key + Secret + Passphrase
- Ed25519: 公钥签名

**特点**:
- V5 统一了所有产品线接口
- 支持 Web3 钱包 API
- 有模拟盘环境 (Demo trading)

**参考**: https://www.okx.com/docs-v5/en/

---

### 2.7 Bybit

**架构**: V5 Unified API
- 统一 Spot/Derivatives/Options
- REST + WebSocket

**认证**: HMAC SHA256

**特点**:
- V5 统一了所有产品线的 API
- 支持 Unified Trading Account (UTA)
- 有 Testnet 环境

**参考**: https://bybit-exchange.github.io/docs/v5/intro

---

### 2.8 微牛 Webull

**架构**: Webull OpenAPI
- REST + WebSocket
- OAuth 2.0 认证

**支持功能**:
- 美股/期权交易
- 实时行情 (需订阅)
- 历史 K线

**限制**:
- 仅限美股市场
- API 权限需申请
- 文档相对有限

---

### 2.9 Charles Schwab

**架构**: Schwab API (原 TD Ameritrade API 迁移)
- REST API
- OAuth 2.0 PKCE 认证

**支持功能**:
- 美股/期权/ETF 交易
- 实时行情 (需订阅)
- 账户信息

**注意**: TD Ameritrade API 已关闭, 需迁移到 Schwab API

---

### 2.10 E*TRADE (Morgan Stanley)

**架构**: E*TRADE API
- REST API
- OAuth 1.0a 认证 (较旧)

**支持功能**:
- 美股交易
- 行情数据
- 账户信息

**限制**:
- OAuth 1.0a 较复杂
- 文档较旧

---

### 2.11 Rakuten Securities (日本)

**架构**: Rakuten API
- REST API
- OAuth 2.0

**支持功能**:
- 日股/美股交易
- 市场行情
- 自动下单系统 (iSPEED API)

---

### 2.12 无 API 的券商 (需替代方案)

| 券商 | 替代方案 |
|------|---------|
| 耀才 | 无 — 考虑手动导入 / RPA |
| 富昌 | 无 — 考虑手动导入 / RPA |
| Fidelity | 无 — 考虑手动导入 / 第三方 (Plaid/Yodlee) |
| Trade Republic | 无 — 考虑手动 CSV 导出 |
| Revolut Trading | 无 — 考虑手动 CSV 导出 |
| eToro | 无 — 考虑手动 CSV 导出 |

---

## 三、推荐接入架构

### 3.1 分层架构

```
┌─────────────────────────────────────────┐
│           dawn-whales App               │
│  (React + Electron + 策略引擎)           │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│        Broker Adapter Layer             │
│  统一接口抽象 (TypeScript)               │
│  IBrokerAdapter {                       │
│    connect(), disconnect()              │
│    getQuote(), placeOrder()             │
│    getPositions(), getOrders()          │
│    subscribeMarketData()                │
│  }                                      │
└─────────────────────────────────────────┘
         │         │         │         │
    ┌────┘    ┌────┘    ┌────┘    ┌────┘
┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐
│ Futu  │ │ Tiger │ │ IB    │ │ Binance│
│Adapter│ │Adapter│ │Adapter│ │Adapter │
│(TCP)  │ │(REST) │ │(TCP)  │ │(REST) │
└───────┘ └───────┘ └───────┘ └───────┘
```

### 3.2 优先级分级

**P0 (立即接入)** — 有完善 API, 高价值:
1. **富途 / moomoo** — 香港用户最多, API 成熟
2. **币安 / OKX / Bybit** — 加密货币主力
3. **盈透 IB** — 全球市场最全

**P1 (短期接入)** — API 可用, 需申请:
4. **老虎** — 港股/美股
5. **长桥** — 新加坡/港股
6. **微牛** — 美股
7. **Bitget** — 加密货币

**P2 (中期接入)** — API 有限或需审批:
8. **Charles Schwab** — 美股 (OAuth 2.0 PKCE)
9. **E*TRADE** — 美股 (OAuth 1.0a)
10. **Rakuten / Monex** — 日股

**P3 (长期/替代方案)** — 无 API:
11. **耀才 / 富昌 / 华盛 / 盈立** — 考虑 RPA 或手动 CSV
12. **Fidelity / Trade Republic / Revolut / eToro / DEGIRO** — 手动导入 / 第三方聚合

---

## 四、技术实现建议

### 4.1 统一接口定义

```typescript
// electron/engine/broker/broker-adapter.ts
export interface IBrokerAdapter {
  readonly name: string;
  readonly markets: Market[];
  readonly supportsRealTime: boolean;
  
  connect(credentials: BrokerCredentials): Promise<void>;
  disconnect(): Promise<void>;
  
  // Market Data
  getQuote(symbol: string): Promise<Quote>;
  getKlines(symbol: string, interval: string, limit?: number): Promise<Kline[]>;
  subscribeMarketData(symbols: string[], callback: DataCallback): Promise<void>;
  unsubscribeMarketData(symbols: string[]): Promise<void>;
  
  // Trading
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  modifyOrder(orderId: string, updates: Partial<OrderRequest>): Promise<OrderResult>;
  
  // Account
  getAccount(): Promise<Account>;
  getPositions(): Promise<Position[]>;
  getOrders(status?: OrderStatus): Promise<Order[]>;
  getTrades(startTime?: Date, endTime?: Date): Promise<Trade[]>;
}
```

### 4.2 推荐技术栈

| 券商 | 协议 | 推荐库 | 运行方式 |
|------|------|--------|---------|
| 富途 | Protobuf/TCP | `futu-api` (官方) | 本地 OpenD + Node.js 适配器 |
| 老虎 | REST/WS | `axios` + `ws` | 直接 HTTP |
| 长桥 | REST/WS | `axios` + `ws` | 直接 HTTP |
| 盈透 | Proprietary TCP | `ib-api` (Node.js) | IB Gateway 本地 |
| 币安 | REST/WS | `binance-api-node` | 直接 HTTP |
| OKX | REST/WS | `okx-api` | 直接 HTTP |
| Bybit | REST/WS | `bybit-api` | 直接 HTTP |
| 微牛 | REST/WS | `axios` + `ws` | 直接 HTTP |
| Schwab | REST | `axios` + OAuth2 | 直接 HTTP |
| E*TRADE | REST | `axios` + OAuth1 | 直接 HTTP |

### 4.3 连接管理

- 每个券商一个独立连接池
- 心跳检测 + 自动重连
- 限流器 (token bucket) 避免触发 API 限制
- 行情数据本地缓存 + 分发

### 4.4 安全考虑

- API Key 存储: 使用 Electron safeStorage 或系统 keychain
- 绝不将密钥提交到 git
- 请求签名在本地完成 (密钥不出境)
- WebSocket 连接使用 TLS
- 敏感操作二次确认 (下单/撤单)

---

## 五、接入路线图建议

### Phase 1 (2-3 周): 基础设施 + P0 券商
- [ ] 设计 `BrokerAdapter` 统一接口
- [ ] 实现连接管理器 + 限流器
- [ ] 接入 **币安** (REST + WS) — 测试最方便
- [ ] 接入 **富途** (OpenD + TCP) — 香港主力
- [ ] 接入 **OKX** — 加密货币补充

### Phase 2 (2-3 周): P1 券商
- [ ] 接入 **老虎** — 港股/美股
- [ ] 接入 **长桥** — 新加坡/港股
- [ ] 接入 **Bybit** — 加密货币
- [ ] 接入 **Bitget** — 加密货币
- [ ] 接入 **微牛** — 美股

### Phase 3 (2-3 周): P2 券商
- [ ] 接入 **盈透 IB** — 全球市场 (最复杂)
- [ ] 接入 **Charles Schwab**
- [ ] 接入 **E*TRADE**
- [ ] 接入 **Rakuten / Monex**

### Phase 4 (持续): P3 替代方案
- [ ] CSV/Excel 导入功能 (无 API 券商)
- [ ] 考虑 RPA 方案 (Playwright/Selenium)
- [ ] 第三方数据聚合 (如 Plaid 账户聚合)

---

## 六、风险与合规

1. **API 权限**: 多数券商 API 需满足资产门槛或申请审批
2. **数据订阅**: 实时行情通常需付费订阅 (LV2 行情)
3. **限速**: 频繁请求可能导致 IP 封禁
4. **合规**: 自动交易在某些市场受限 (如日本需注册)
5. **安全**: API Key 泄露风险, 需严格密钥管理

---

## 七、参考链接汇总

| 券商 | API 文档 |
|------|---------|
| 富途 | https://openapi.futunn.com/futu-api-doc/en/intro/intro.html |
| 老虎 | https://www.itiger.com/openapi |
| 长桥 | https://open.longbridgeapp.com/en/docs |
| 盈透 | https://www.interactivebrokers.com/en/trading/ib-api.php |
| 币安 | https://developers.binance.com/docs/binance-spot-api-docs |
| OKX | https://www.okx.com/docs-v5/en/ |
| Bybit | https://bybit-exchange.github.io/docs/v5/intro |
| 微牛 | https://developer.webull.com/ |
| Schwab | https://developer.schwab.com/ |
| E*TRADE | https://developer.etrade.com/ |
| Rakuten | https://developer.rakuten.co.jp/ |
| Monex | https://developer.monex.co.jp/ |

---

*报告生成: 2026-06-12 by youdao*
