# R122-Q02: 数据链路代码审计 — TSC + 类型 + 接线状态

> **Author**: QClaw · **Task**: R122-Q02 · **Hours**: 3h
> **Date**: 2026-06-13 01:00 HKT
> **Coverage**: 数据链路5环节: 券商适配器 → BrokerManager → IPC Bridge → 渲染引擎 → UI组件

---

## 1. TSC 基线

| 指标 | 值 |
|------|-----|
| TSC errors | **0** ✅ |
| TS/TSX 文件 | 1124 |
| @ts-nocheck 文件 | 3 (types-data.ts, OrderBookWaterfall.tsx, WatchlistV2.tsx) |
| ESLint ignore 残留 | 1 (strategy-ipc.ts) |

**TSC 结论**: 编译通过，无阻塞错误。3个@ts-nocheck文件需在R123清除（已在P0-1提案中）。

---

## 2. 数据链路5环节接线审计

### Link 1: 券商适配器 → BrokerManagerV2

**文件**: `electron/broker/BrokerManagerV2.ts` (20583B)

**已注册工厂** (registerAllFactories):
- ✅ BinanceAdapter (via CryptoAdapterBase)
- ✅ OKXAdapter (via CryptoAdapterBase)
- ✅ BybitAdapter (via CryptoAdapterBase)
- ✅ BitgetAdapter (via CryptoAdapterBase)

**未注册工厂** (缺寄存器):
- ❌ FutuAdapter (futu-opend.ts)
- ❌ MoomooAdapter (moomoo-adapter.ts)
- ❌ IBKRAdapter (ib-adapter.ts)
- ❌ TigerAdapter
- ❌ LongbridgeAdapter (longbridge-adapter.ts)
- ❌ SchwabAdapter (OAuth)
- ❌ E*TRADEAdapter (OAuth)
- ❌ eToroAdapter (OAuth)
- ❌ WebullAdapter (OAuth)

**发现**: registerAllFactories() 被JVS R122-J02标记为待修复。函数存在但仅含4个加密适配器，11个券商适配器未注册。

**类型安全**: 工厂模式使用 `any` 类型的 `require()` 动态导入，无TypeScript编译时类型检查。

### Link 2: BrokerManager → IPC Bridge

**文件**: `electron/ipc/broker-ipc-v2.ts` (9416B)

**已注册IPC处理** (28 channels):
- ✅ broker:connect/disconnect/connectMany/disconnectAll
- ✅ broker:getAccounts/getFunds/getPositions/getOrders
- ✅ broker:getAggregatedFunds/getAggregatedPositions/getAggregatedOrders
- ✅ broker:placeOrder/cancelOrder/placeOrders/copyTrade
- ✅ broker:getQuotes/getKlines/getStatus/getAllStatuses
- ✅ broker:subscribe/subscribeAll/unsubscribe/getSubscriptions
- ✅ broker:scanArbitrage/killSwitchAll/getPortfolioSummary/getSignalProviders

**IPC通道类型**: 全部handler接收 `_event: IpcMainInvokeEvent, args: any` — 参数类型为 `any`。

**发现**: 28个IPC handler全部使用 `any` 参数类型，无运行时校验。若渲染进程传递错误的参数格式（如`string`而不是`{symbol: string}`），主进程静默失败。

### Link 3: IPC Bridge → 渲染引擎

**文件**: `src/lib/chart/broker-chart-bridge.ts` (5799B)

**类型映射** (Chart-internal types):
- ✅ ChartBrokerStatus — 券商连接状态
- ✅ ChartOrderBookRaw → OrderBookSnapshot (转换函数)  
- ✅ ChartTickRaw → TickRecord (转换函数)
- ✅ ChartQuoteRaw — 报价原始数据
- ✅ BrokerChartBridge — 桥接主类

**类型安全**: 因tsconfig隔离，bridge使用chart内部类型定义，不与electron/broker类型耦合。这是正确的架构选择。

**发现**: bridge中使用了 `any` 类型的 `window.api` 访问（`(window as any).api`），无类型安全的API surface暴露。

### Link 4: 渲染引擎 → UI组件

**文件**: `src/hooks/useDataPipeline.ts` (7165B, NEW by JVS)

**数据通道连接** (5 pipes):
- ✅ `quotes:push` → onQuoteBatch → KLineChartPro
- ✅ `ws:depth` → onOrderBook → OrderBookWaterfall  
- ✅ `ws:tick` → onTick → FootprintChart
- ✅ `broker:status-change` → onCBBO → CBBOPanel
- ✅ `alert:push` → onAlert → AlertNotifications

**转换函数**:
- ✅ `quotesToKlineBars()` — QuotePushData[] → KlineBar[]
- ✅ `depthToOrderBookSnapshot()` — DepthPushData → OrderBookSnapshot
- ✅ `tickToTickRecord()` — TickPushData → TickRecord

**类型安全**: useDataPipeline定义了自己的接口类型（QuotePushData/DepthPushData/TickPushData/CBBOPushData），与broker-chart-bridge的类型部分重叠但独立。

**发现**: 类型定义在两处独立维护（`broker-chart-bridge.ts` 和 `useDataPipeline.ts`），存在DRY违规。建议统一到`broker-ui-types.ts`。

### Link 5: UI组件数据消费

**组件状态**:
- ✅ KLineChartPro — 接收 `KlineBar[]`，props接口完整
- ✅ OrderBookWaterfall — 接收转换后的OrderBookData（但@ts-nocheck）
- ✅ FootprintChart — 骨架存在，Tick数据接入待验证
- ✅ CBBOPanel — 骨架存在，CBBO数据接入待验证
- ✅ WatchlistV2 — 使用Mock数据（@ts-nocheck），未接入useDataPipeline

**发现**: 3个UI组件仍使用Mock数据（BrokerManagerAndPortfolio/SignalProviderDashboard/WatchlistV2），未接入useDataPipeline。

---

## 3. 类型完整性审计

### 类型文件覆盖

| 类型文件 | 大小 | 状态 | 消费方 |
|---------|------|------|--------|
| types.ts | 574L | ✅ 导入KLineChartPro | KLineChartPro, IndicatorPanel |
| types-data.ts | 440L | ⚠️ @ts-nocheck | IndicatorPanel |
| depth-types.ts | 660L | ✅ 导入broker-chart-bridge | OrderBookWaterfall, broker-chart-bridge |
| scanner-types.ts | 610L | ✅ 定义完整 | MarketScanner (未接入实际数据) |
| oauth-broker-types.ts | 550L | ✅ 定义完整 | OAuthTokenStore |
| broker-ui-types.ts | 520L | ✅ 定义完整 | SignalProviderDashboard (未接入) |

### 类型重复问题

| 类型 | 定义位置1 | 定义位置2 | 状态 |
|------|---------|---------|------|
| OrderBookData | depth-types.ts | OrderBookWaterfall.tsx | ⚠️ 重复定义 |
| WatchlistRow + TaggedQuote | broker-ui-types.ts | WatchlistV2.tsx | ⚠️ 重复定义 |
| BrokerConfig | broker-ui-types.ts | BrokerManagerAndPortfolio.tsx | ⚠️ 重复定义 |
| QuotePushData | broker-chart-bridge.ts | useDataPipeline.ts | ⚠️ 重复定义 |

**建议**: 所有UI组件引用 `broker-ui-types.ts` 中的统一类型，删除内联重复定义。

---

## 4. registerAllFactories() 调用链审计

**调用状态**: **未在任何地方调用** ❌

搜索代码库 `registerAllFactories` 引用:
- 定义: `electron/broker/BrokerManagerV2.ts:registerAllFactories()`
- 调用: **不存在** (0处调用)

**后果**: BrokerManagerV2 启动时工厂注册表为空，17家券商全部无法连接。这是R122的核心修复目标。

**JVS R122-J02修复方案**: 在BrokerManagerV2构造函数中调用 `this.registerAllFactories()`，或在主进程初始化时主动调用。

---

## 5. 发现总结

### P0 阻塞（数据链路死亡）
1. ❌ **registerAllFactories() 无人调用** — 17家券商工厂未注册，BrokerManagerV2无法创建任何适配器
2. ❌ **仅4/17适配器注册** — 函数内只注册了binance/okx/bybit/bitget，富途/IBKR/Schwab等13家缺失
3. ❌ **3个UI组件100% Mock** — BrokerManager/SignalDashboard/WatchlistV2使用假数据

### P1 风险
4. ⚠️ **28个IPC handler使用`any`参数** — 无运行时类型校验
5. ⚠️ **4组类型重复定义** — QuotePushData/BrokerConfig/WatchlistRow/OrderBookData在2-3处独立定义
6. ⚠️ **useDataPipeline isConnected字段硬编码false** — TODO注释未实现

### P2 改进
7. 🔧 **3个@ts-nocheck文件需清除** — types-data.ts/OrderBookWaterfall.tsx/WatchlistV2.tsx
8. 🔧 **动态require()绕过TS检查** — registerAllFactories使用`require()`而非静态import

---

## 6. R122数据链路验收矩阵

| 验收项 | 当前状态 | 目标 |
|--------|---------|------|
| TSC errors = 0 | ✅ 0 | ✅达标 |
| registerAllFactories() 被调用 | ❌ 0处 | JVS-J02 |
| Binance真实K线渲染 | ❌ Mock | JVS-J01 |
| IPCC连接≥4券商 | ❌ 0 | JVS-J02 |
| ChartContext接入15组件 | ❌ 0 | ML-M01 |
| ErrorBoundary包裹26组件 | ❌ 0 | ML-M02 |
| 4个IPC通道注册 | ❌ 0 | JVS-J03 |

---

> **QClaw Sign-off**: R122-Q02 complete — TSC 0, 5-link audit done, 8 findings across P0/P1/P2
