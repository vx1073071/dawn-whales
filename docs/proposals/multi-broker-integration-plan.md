# TradingEasy — 多券商接入方案 (26 Brokers Integration Plan)

> **R108 S-extension | 2026-06-12 | QClaw**
> 
> 目标: 在现有 Futu OpenD + IBKR 基础上，接入全部 26 家券商/交易所

---

## 一、总览分类

| 层级 | 数量 | 券商 | 策略 |
|------|------|------|------|
| 🟢 **Tier 0** (已接入) | 2 | Futu, IBKR | 完善维护 |
| 🟢 **Tier 1** (官方API, 优先) | 10 | Tiger, Longbridge, Schwab, E*TRADE, Binance, OKX, Bybit, Bitget, Webull, moomoo | 6-8周 |
| 🟡 **Tier 2** (有API但受限) | 4 | Robinhood, eToro, Rakuten, SBI | 需额外调研 |
| 🔴 **Tier 3** (无公开API) | 10 | 耀才, 华盛, 盈立, 富昌, Fidelity, Revolut, Degiro, Trade Republic, Monex, 微牛(部分) | Selenium/OCR fallback |

---

## 二、逐券商详细分析

### 🟢 Tier 0 — 已接入 (维护完善)

| # | 券商 | 市场 | 协议 | SDK语言 | 状态 |
|---|------|------|------|---------|------|
| 1 | **富途 Futu** | HK/US/CN | OpenD (TCP, port 11111) | Python/C++/JS | ✅ 已集成 |
| 2 | **盈透 IBKR** | Global | TWS/Gateway API | Python/Java/C++/C# | ✅ 已集成 |

---

### 🟢 Tier 1 — 官方API, 优先接入

#### 3. Tiger Trade (老虎证券) ⭐⭐⭐
- **API**: [Tiger Open Platform](https://developer.tigerbrokers.com.sg)
- **协议**: REST + WebSocket
- **SDK**: Python, Java, Go
- **市场**: 港股/美股/A股(沪深港通)/新加坡/期权/期货
- **特色**: 自清算券商，直连交易所；支持OAuth2
- **难度**: ⭐⭐ (API成熟，文档完善)
- **接入工时**: ~2周
- **代码量**: ~800L (broker-adapter)
- **关键**: 需开通Tiger账户并申请API Key/Secret

#### 4. Longbridge (长桥证券) ⭐⭐⭐
- **API**: [LongPort OpenAPI](https://open.longbridge.com)
- **协议**: HTTP + WebSocket
- **SDK**: Python, C++, Java, Go, Rust (核心引擎Rust实现)
- **市场**: 港股/美股/A股/新加坡/期权/债券/基金
- **特色**: 云原生架构，10ms交易延迟，微秒级行情
- **难度**: ⭐⭐ (API设计现代，文档清晰)
- **接入工时**: ~2周
- **代码量**: ~750L

#### 5. Charles Schwab (嘉信理财) ⭐⭐⭐
- **API**: [Schwab Developer](https://developer.schwab.com)
- **协议**: REST (OAuth2) + WebSocket Streaming
- **SDK**: Python (schwabdev 社区), 官方REST
- **市场**: 美股/ETF/期权/期货/债券/共同基金
- **特色**: 零佣金美股, TD Ameritrade迁移整合
- **难度**: ⭐⭐⭐ (OAuth2流程复杂，需美国SSN/ITIN开户)
- **接入工时**: ~3周
- **代码量**: ~1200L
- **关键**: OAuth2 token管理，订单状态与IBKR/Futu映射

#### 6. E*TRADE (Morgan Stanley) ⭐⭐
- **API**: [ETRADE Developer](https://developer.etrade.com)
- **协议**: REST (OAuth 1.0a)
- **SDK**: Python (社区)
- **市场**: 美股/ETF/期权/期货/共同基金
- **特色**: Morgan Stanley旗下，860万客户，加密交易上线
- **难度**: ⭐⭐⭐ (OAuth 1.0a较旧，API可能迁移中)
- **接入工时**: ~2.5周
- **代码量**: ~1000L
- **风险**: MS可能重构API体系

#### 7-10. 加密货币交易所 ⭐⭐ (统一架构)
| # | 交易所 | API文档 | 特色 |
|---|--------|---------|------|
| 7 | **Binance** | [binance-docs](https://binance-docs.github.io) | 最大CEX，现货+合约+期权 |
| 8 | **OKX** | [okx-docs](https://www.okx.com/docs-v5) | 统一账户，强大WebSocket |
| 9 | **Bybit** | [bybit-exchange](https://bybit-exchange.github.io) | 衍生品强，USDT本位 |
| 10 | **Bitget** | [bitget-api](https://bitgetlimited.github.io) | 跟单交易，创新区 |

- **协议**: REST + WebSocket (全部通过HMAC SHA256签名)
- **SDK**: Python/JS/Java/Go/C++ (全部有官方或社区SDK)
- **难度**: ⭐ (API高度标准化，生态成熟)
- **接入工时**: ~3周 (4家统一抽象层)
- **代码量**: ~2000L (CryptoBroker基类 + 4个adapter)
- **架构**: CryptoExchangeBase → BinanceAdapter/OKXAdapter/BybitAdapter/BitgetAdapter
- **关键**: 签名安全(IP白名单)，速率限制管理，永续合约vs现货映射

#### 11. Webull (微牛) ⭐
- **API**: 社区逆向API (无官方公开)
- **协议**: REST (非官方)
- **SDK**: Python (webull社区库)
- **市场**: 美股/港股/A股
- **难度**: ⭐⭐⭐⭐ (非官方，API随时变)
- **接入工时**: ~2周
- **代码量**: ~600L
- **风险**: 无官方支持，随时可能被封

#### 12. moomoo ⭐⭐
- **API**: 与Futu OpenD同源（母公司相同）
- **协议**: OpenD TCP (与Futu共用协议)
- **SDK**: 复用Futu SDK
- **市场**: 美股/港股/A股/日本
- **难度**: ⭐ (已有Futu基础，改配连接参数即可)
- **接入工时**: ~3天
- **代码量**: ~200L

---

### 🟡 Tier 2 — 有API但受限

#### 13. Robinhood ⭐
- **API**: 曾有官方API(2021关闭)，社区逆向API仍可用
- **SDK**: Python (robin_stocks 社区)
- **市场**: 美股/ETF/期权/加密货币
- **难度**: ⭐⭐⭐⭐ (非官方，频繁变更，可能需要Plaid 2FA绕过)
- **接入工时**: ~2周
- **状态**: ⚠️ 非官方API，法律灰色地带，建议观望

#### 14. eToro ⭐
- **API**: eToro 2025年推出公共API (AI投资工具)
- **协议**: REST
- **市场**: 美股/ETF/加密货币/CFD/外汇
- **特色**: 2000万用户，社交跟单，CopyTrader
- **难度**: ⭐⭐⭐ (新API，社区生态不成熟)
- **接入工时**: ~2周
- **状态**: 🔍 API文档待详细验证

#### 15. Rakuten Securities (乐天证券) ⭐
- **API**: 日本乐天证券提供有限的API (主机构)
- **市场**: 日本股票
- **难度**: ⭐⭐⭐⭐ (日语文档，机构门槛)
- **状态**: 🔍 待确认零售客户可用性

#### 16. SBI Securities ⭐
- **API**: 无公开零售API，有机构用FIX协议
- **市场**: 日本股票
- **难度**: ⭐⭐⭐⭐⭐ (无零售API)
- **状态**: ❌ 大概率不可行

---

### 🔴 Tier 3 — 无公开API (需要 Selenium/OCR fallback)

| # | 券商 | 市场 | Fallback方案 | 可行性 |
|---|------|------|-------------|--------|
| 17 | **耀才 Bright Smart** | HK | Selenium + 港股网页版交易 | ⚠️ 低 |
| 18 | **华盛 Valuable Capital** | HK/US | Selenium + 客户端自动化 | ⚠️ 低 |
| 19 | **盈立 uSmart** | HK/US | Selenium + API抓包 | ⚠️ 低 |
| 20 | **富昌 Fulbright** | HK | 传统券商，无在线API | ❌ 不可行 |
| 21 | **Fidelity** | US | 无公开API，仅财富管理整合 | ❌ 不可行 |
| 22 | **Trade Republic** | EU | 无API，德国新兴券商 | ❌ 不可行 |
| 23 | **Revolut Trading** | EU/US | 无API，银行内嵌交易功能 | ❌ 不可行 |
| 24 | **Degiro** | EU | 无API (曾被Flatex收购) | ❌ 不可行 |
| 25 | **Monex** | JP | 无零售API | ❌ 不可行 |
| 26 | 微牛Webull国际版 | Global | (如已有Webull API则覆盖) | 见Tier1 |

---

## 三、架构设计

### 3.1 Broker Adapter 统一接口

```typescript
// electron/engine/broker/broker-adapter.interface.ts

interface IBrokerAdapter {
  // 连接管理
  connect(config: BrokerConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // 行情
  subscribeQuotes(symbols: string[]): Promise<void>;
  unsubscribeQuotes(symbols: string[]): Promise<void>;
  getQuote(symbol: string): Promise<Quote>;
  getKlines(params: KlineRequest): Promise<Kline[]>;
  
  // 交易
  getAccounts(): Promise<Account[]>;
  getPositions(): Promise<Position[]>;
  getOrders(params?: OrderQuery): Promise<Order[]>;
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  
  // 账户
  getBalance(): Promise<Balance>;
  getTradeHistory(params?: HistoryQuery): Promise<TradeRecord[]>;
}

type BrokerType = 'futu' | 'ibkr' | 'tiger' | 'longbridge' | 'schwab' 
  | 'etrade' | 'binance' | 'okx' | 'bybit' | 'bitget' 
  | 'moomoo' | 'webull' | 'robinhood' | 'etoro';
```

### 3.2 目录结构

```
electron/engine/broker/
├── broker-adapter.interface.ts    # 统一接口
├── broker-registry.ts             # 券商注册表
├── broker-factory.ts              # 工厂函数
├── adapters/
│   ├── futu/                      # ✅ 已有
│   ├── ibkr/                      # ✅ 已有
│   ├── tiger/                     # 🆕
│   │   ├── tiger-adapter.ts
│   │   ├── tiger-auth.ts
│   │   └── tiger-types.ts
│   ├── longbridge/                # 🆕
│   ├── schwab/                    # 🆕
│   ├── etrade/                    # 🆕
│   ├── crypto/                    # 🆕 统一加密层
│   │   ├── crypto-base.ts
│   │   ├── binance-adapter.ts
│   │   ├── okx-adapter.ts
│   │   ├── bybit-adapter.ts
│   │   └── bitget-adapter.ts
│   ├── moomoo/                    # 🆕 (复用Futu)
│   ├── webull/                    # 🆕
│   ├── robinhood/                 # 🆕
│   └── etoro/                     # 🆕
└── IPCBridge/
    └── broker-ipc-handler.ts      # 更新多券商路由
```

### 3.3 授权管理

TradingEasy 已有 `BrokerSelector` UI。新增券商后:

1. **Config存储**: 加密存储各券商API Key/Secret
2. **OAuth流程**: Schwab/E*TRADE 需要本地OAuth回调服务器
3. **签名管理**: 加密交易所HMAC签名统一模块
4. **连接池**: 同一用户可同时连接多个券商

---

## 四、分阶段实施路线图

### Phase 1: 核心券商 (4周)

| 周 | 券商 | 交付物 |
|----|------|--------|
| W1 | Tiger + Longbridge | adapter + tests + IPC handler |
| W2 | Tiger + Longbridge 联调 | E2E: 下单/行情/持仓 |
| W3 | Schwab + moomoo | adapter + OAuth flow + tests |
| W4 | 4券商全链路回归 | 4券商 + 已有Futu/IBKR → 6券商可用 |

### Phase 2: 加密交易所 (3周)

| 周 | 交付物 |
|----|--------|
| W5 | CryptoBase + Binance + OKX |
| W6 | Bybit + Bitget + signature engine |
| W7 | 4所全链路 + 费率对比 + 跨所套利检测 |

### Phase 3: 次级券商 (2周)

| 周 | 券商 |
|----|------|
| W8 | E*TRADE + eToro + Webull |
| W9 | Robinhood (调研决定是否做) |

### Phase 4: 不可接入券商 (1周)

| 券商 | 策略 |
|------|------|
| 耀才/华盛/盈立/富昌 | 建议用户迁移至已支持券商 |
| Fidelity/Degiro/Revolut/Trade Republic/Monex | 标记为不支持，推荐替代方案 |
| Rakuten/SBI | 确认日本市场是否有替代路径 |

---

## 五、关键技术风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| OAuth 2.0 redirect URI (Schwab/E*TRADE) | Electron环境下OAuth回调困难 | 本地HTTP server接收回调 |
| Binance/OKX 国内IP限制 | 大陆用户无法直连 | VPN/代理层 |
| Webull/Robinhood 非官方API | 随时不可用 | 独立crash边界，不影响其他券商 |
| 港股券商(耀才等)无API | 10家券商不可接入 | 迁移引导页+数据导入工具 |
| 日本券商语言障碍 | 接口理解出错 | 机翻+专业人士审核 |
| 多券商同时连接 | 内存/连接数爆炸 | 懒加载+按需断开+连接池上限 |

---

## 六、优先度矩阵

| 优先级 | 券商 | 理由 |
|--------|------|------|
| **P0 立即** | Tiger, Longbridge | 港股客户量大，API成熟，竞争优势 |
| **P0 立即** | Binance, OKX | 加密市场覆盖，高交易量 |
| **P1 次月** | moomoo, Schwab | moomoo=极低成本，Schwab=美股市场 |
| **P1 次月** | Bybit, Bitget | 完成加密四件套 |
| **P2 三月** | E*TRADE, eToro, Webull | 增量市场 |
| **P3 调研** | Robinhood | 法律风险评估后决定 |
| **— 放弃** | 耀才/华盛/富昌/Fidelity/Degiro等10家 | 无API |

---

## 七、预期成果

接入完成后 TradingEasy 将支持:

| 维度 | 当前 | 目标 |
|------|------|------|
| 支持券商 | 2 (Futu + IBKR) | **12-14家** |
| 覆盖市场 | HK/US | **HK/US/CN/JP/SG + Crypto** |
| 覆盖品种 | 股票/期权 | **股票/期权/期货/永续合约/ETF/基金** |
| API协议 | TCP + Socket | **TCP + REST + WebSocket + OAuth** |
| 测试覆盖 | ~20 broker tests | **~80 broker tests** |

---

*Generated: R108 2026-06-12 | Owner: QClaw (quality-shrimp)*
