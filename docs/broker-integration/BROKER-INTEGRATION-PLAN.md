# quant-moo 券商接入方案
> 生成时间: 2026-06-12 07:30
> 目标: 24家券商接入规划 (港股5+美股7+加密货币3+其他9)
> 架构: v1.5.0 规格已锁定 (Electron桌面端 / USDT-only / Futu OpenD模式)

---

## 一、当前现状

### 已有接入
| 券商 | Adapter | 状态 |
|------|---------|------|
| **Futu (富途)** | `opend-live-broker.ts` (12KB) | ✅ 主用,生产级 |
| **Moomoo (富途旗下)** | `opend-base-adapter.ts` | ✅ 共享 OpenD 协议 |
| **Interactive Brokers (盈透 IBKR)** | `ibkr-broker-adapter.ts` (13.8KB) | ✅ Client Portal API |
| **Long Bridge (长桥)** | `multi-market-broker.ts` | ⚠️ 简化版 |

### 已有架构
```
electron/broker/
  IBrokerAdapter.ts         # 统一接口
  BrokerManager.ts          # 多券商聚合
electron/engine/data/
  multi-market-broker.ts    # 跨市场路由
electron/engine/brokers/
  futu/opend-live-broker.ts
  ibkr-broker-adapter.ts
  opend-base-adapter.ts
```

---

## 二、24家券商分类

### A. 富途系 (Futu OpenD 协议可直接复用)
| # | 券商 | OpenD兼容 | 备注 |
|---|------|----------|------|
| 1 | **Futu (富途)** | ✅ 主用 | 协议源头 |
| 2 | **Moomoo (木汝/猛兽)** | ✅ 直接兼容 | Futu旗下,同一SDK |
| 3 | **Tiger Trade (老虎)** | ✅ 协议兼容 | 同Futu生态,使用相同协议 |

**接入方式**: 已有 `opend-base-adapter.ts`,只需添加新 `id` 注册到 BrokerManager。**0代码量**。

### B. OpenAPI类 (有官方REST/SDK)
| # | 券商 | API类型 | 语言 | 难度 |
|---|------|---------|------|------|
| 4 | **IBKR (盈透)** | Client Portal REST + TWS Socket | Python/JS | 中 |
| 5 | **Charles Schwab** | OAuth2 + Trader API | REST | 中 |
| 6 | **Robinhood** | 非官方API(私有),需自研爬虫 | - | 🔴 高/不推荐 |
| 7 | **E*TRADE (MS)** | OAuth2 + E*TRADE API | REST | 中 |
| 8 | **Fidelity** | 仅基础行情(无交易API) | - | 🔴 不支持交易 |
| 9 | **eToro** | 仅OpenBook(社交),无交易API | - | 🔴 不支持 |
| 10 | **Revolut Trading** | 无公开API | - | 🔴 不支持 |
| 11 | **Trade Republic** | 仅OAuth 2FA登录,无交易API | - | 🔴 不支持 |
| 12 | **DEGIRO** | 非官方API,已关闭 | - | 🔴 不支持 |

### C. 港股券商
| # | 券商 | API类型 | 难度 |
|---|------|---------|------|
| 13 | **华盛 (Huasheng)** | 私有SDK,需协议逆向 | 🔴 高 |
| 14 | **耀才 (Yao Tsai)** | 私有SDK,需协议逆向 | 🔴 高 |
| 15 | **盈立 (Hithink)** | 私有SDK,需协议逆向 | 🔴 高 |
| 16 | **富昌 (Futong)** | 未知 | 🔴 待研究 |
| 17 | **长桥 (Longbridge)** | ✅ OpenAPI(已有) | 中 |

### D. 日股券商
| # | 券商 | API类型 | 难度 |
|---|------|---------|------|
| 18 | **Monex (日本)** | 私有 | 🔴 高 |
| 19 | **Rakuten Securities (乐天)** | 私有 | 🔴 高 |
| 20 | **SBI Securities** | 私有 | 🔴 高 |

### E. 加密货币交易所 (官方REST/WebSocket)
| # | 交易所 | 难度 | 已有? |
|---|--------|------|-------|
| 21 | **Binance (币安)** | 低 | ⚠️ 需添加 |
| 22 | **OKX** | 低 | ⚠️ 需添加 |
| 23 | **Bybit** | 低 | ⚠️ 需添加 |
| 24 | **Bitget** | 低 | ⚠️ 需添加 |

---

## 三、可行性矩阵 (24家)

| 等级 | 数量 | 券商列表 |
|------|------|----------|
| 🟢 **L1 - 立即可做** (1-2天) | 7 | Futu, Moomoo, Tiger, Binance, OKX, Bybit, Bitget |
| 🟡 **L2 - 1-2周可做** | 4 | IBKR, Charles Schwab, E*TRADE, Longbridge(补全) |
| 🔴 **L3 - 不可做/需长期逆向** | 13 | 港股私有SDK(华盛/耀才/盈立/富昌), 日股私有(Monex/Rakuten/SBI), 美股无API(Robinhood/Fidelity/eToro/Revolut/Trade Republic/DEGIRO) |

---

## 四、推荐路线图

### **R109 (本周) — L1 立即接入**
- A.1-A.3 Futu/Moomoo/Tiger: 共享OpenD,**1小时** (仅注册)
- E.21-E.24 4家加密交易所: 官方SDK复用,**3-5天**
- 总计: ~5天

### **R110 (下周) — L2 接入**
- IBKR Client Portal(已有骨架,完善)
- Charles Schwab OAuth2
- E*TRADE OAuth2
- Longbridge(补全)
- 总计: ~10天

### **R111+ (长期) — L3 评估**
- 港股私有SDK逆向: 与券商BD谈合作,**不推荐自研**
- 日股券商: 优先Monex(开放度较高)
- 不支持API的: 等待官方公布,或转人工下单

---

## 五、技术架构

### 5.1 Adapter 注册模式
```typescript
// electron/broker/BrokerManager.ts
const brokerRegistry: Map<string, () => IBrokerAdapter> = {
  'futu': () => new OpenDLiveBroker('futu'),
  'moomoo': () => new OpenDAdapter('moomoo'),
  'tiger': () => new OpenDAdapter('tiger'),  // 新增
  'ibkr': () => new IBKRBrokerAdapter(),
  'longbridge': () => new LongbridgeAdapter(),
  'binance': () => new BinanceAdapter(),      // 新增
  'okx': () => new OkxAdapter(),
  'bybit': () => new BybitAdapter(),
  'bitget': () => new BitgetAdapter(),
};
```

### 5.2 IBrokerAdapter 增强 (R110)
增加加密货币交易所需:
```typescript
interface IBrokerAdapter {
  // ... 现有
  getMarketType(): 'spot' | 'futures' | 'options' | 'stocks';
  getSupportedSymbols(): Promise<string[]>;
  get24hTicker(symbol: string): Promise<Ticker24h>;
  placeMarketOrder(req: MarketOrderRequest): Promise<OrderResult>;
}
```

### 5.3 加密交易所通用 SDK
**关键洞察**: 4家加密交易所(币安/OKX/Bybit/Bitget)的 REST API 高度相似:
- `GET /api/v3/ticker/24hr` (Binance) / `/api/v5/market/tickers` (OKX) - 24h行情
- `POST /api/v3/order` (Binance) - 下单
- WebSocket 推送价格

可抽象为 `CryptoExchangeAdapter` 基类:
```typescript
abstract class CryptoExchangeAdapter implements IBrokerAdapter {
  abstract signRequest(method: string, path: string, params: any): string;
  abstract wsUrl: string;
  // ... 公共实现
}
```

---

## 六、风险与依赖

### 6.1 法律合规
| 风险 | 券商 | 影响 |
|------|------|------|
| **API ToS禁止第三方** | Robinhood, eToro, Fidelity | 账号封禁 |
| **区域限制** | 富途/老虎(部分国家禁用) | 用户无法注册 |
| **数据驻留** | 美国交易所(Schwab等) | US数据隐私合规 |

### 6.2 技术依赖
- **WebSocket 长连接**: 4家加密交易所必须WS,OpenD是TCP
- **OAuth2 流程**: Schwab/E*TRADE 必须实现浏览器跳转
- **HMAC 签名**: 所有加密交易所
- **沙盒环境**: 大部分券商提供demo,IBKR有纸面交易

### 6.3 v1.5.0 规格约束
- ✅ 桌面端Electron 唯一入口(便于多账号并发)
- ✅ USDT-only 收费(对所有券商一致)
- ⚠️ **限制**: 项目不持"券商返佣"模式,只赚USDT

---

## 七、具体执行清单 (R109)

### Day 1: Futu/Moomoo/Tiger 注册
- [x] 检查 `opend-base-adapter.ts` (已存在)
- [ ] 添加 3 家券商的 `id` 到 `BrokerManager`
- [ ] 在 `SettingsPage` UI 中添加这 3 个 BrokerType 选项
- [ ] 测试 OpenD 启动时切换 brokerId

### Day 2-3: 加密交易所通用 SDK
- [ ] 创建 `electron/broker/crypto/CryptoExchangeAdapter.ts` 基类
- [ ] 实现 BinanceAdapter (最成熟,优先)
- [ ] OKXAdapter (类似Binance)
- [ ] BybitAdapter (v5 API)
- [ ] BitgetAdapter (v2 API)
- [ ] 4个适配器共用 24h ticker + 下单 + K线

### Day 4-5: 集成测试
- [ ] IPC endpoint: `broker:binance:ticker`, `broker:binance:order`
- [ ] 现货下单 + USDT计价
- [ ] SettingsPage 加密交易所配置面板

---

## 八、不建议做的券商 (技术/法律原因)

| 券商 | 不做原因 |
|------|----------|
| Robinhood | 无公开API,违反ToS;账号封禁风险高 |
| Fidelity | 无交易API,仅基础行情 |
| eToro | 社交平台,无交易API |
| Revolut Trading | 无公开API |
| Trade Republic | 仅基础账户API,无交易 |
| DEGIRO | 官方API已关闭(2020) |
| 华盛/耀才/盈立/富昌 | 私有SDK,逆向违反ToS,需多年法律谈判 |
| Monex/Rakuten/SBI | 私有API,日本市场需本地法人 |

---

## 九、立即建议

PM/用户应:
1. **确认范围**: 是否接受"4家加密交易所 + 3家富途系"作为 MVP?
2. **合规审查**: US券商(IBKR/Schwab/E*TRADE)需要 KYC/AML 检查
3. **市场优先级**: 用户主要在哪些市场? (港美股 / 加密 / 日股)
4. **团队分配**:
   - ML: UI/前端 (SettingsPage扩展,IPC schema)
   - JVS: Adapter 主体 (broker core)
   - QClaw: 文档/法律审查/安全审计
   - youdao: 测试

---

## 十、参考资料

- Futu OpenD: https://openapi.futunn.com/
- Moomoo OpenAPI: https://openapi.moomoo.com/
- Tiger OpenAPI: https://www.tigerfintech.com/openapi
- IBKR Client Portal: https://www.interactivebrokers.com/api/doc.html
- Binance API: https://binance-docs.github.io/apidocs/spot/en/
- OKX API: https://www.okx.com/docs-v5/en/
- Bybit API: https://bybit-exchange.github.io/docs/v5/intro
- Bitget API: https://bitgetlimited.github.io/apidoc/en/mix/

---

**总结**: 24家券商中,**7家可立即接入 (L1)**,**4家可做 (L2)**,**13家技术/法律不可行 (L3)**。建议 R109 重点做7家L1(5天),R110做4家L2(2周)。
