# QClaw — 券商+行情 全代码独立审查 & 精修提案

> 📄 `docs/proposals/qclaw-final-polish.md`
>
> **Author**: QClaw (document-shrimp) · **Date**: 2026-06-12 22:30 HKT
> **Scope**: `src/lib/chart/` + `src/components/chart/` + `src/components/broker/` + `src/hooks/` + `electron/broker/`
> **Focus**: 类型完整性 + 人类使用习惯
> **Method**: 逐文件通读核心类型→组件→数据流, 从真实交易员"打开软件→看盘→下单"全流程审查

---

## 审查方法

通读了以下关键链路:
1. 类型层: `types.ts`(574L) `types-data.ts`(440L) `depth-types.ts`(660L) `scanner-types.ts`(610L) `oauth-broker-types.ts`(550L) `broker-ui-types.ts`(520L)
2. 核心组件: `KLineChartPro.tsx` `IndicatorPanel.tsx` `OrderBookWaterfall.tsx` `BrokerManagerAndPortfolio.tsx` `SignalProviderDashboard.tsx` `WatchlistV2.tsx` `TradeEssentials.tsx` `ChartStates.tsx`
3. Hooks: `ChartContext.tsx` `useBrokerData.ts` `useKeyboardShortcuts.ts` `DrawStorage.ts` `ChartPreferences.ts`
4. Electron: `BrokerManagerV2.ts` `IBrokerAdapterV2.ts` `QuoteAggregator.ts` `BrokerEventBus.ts`

---

## P0 (紧急 — 影响可用性, 合计 22h)

### P0-1: @ts-nocheck 清除 — 3个关键文件 (4h)

**现状**: 3个核心文件顶部加了 `@ts-nocheck`, 屏蔽了真实类型错误:
- `src/lib/chart/types-data.ts` — 文件开头 `// @ts-nocheck — R120: split from types.ts, imports pending`
- `src/components/chart/OrderBookWaterfall.tsx` — `// @ts-nocheck — R119: cross-module type mismatch pending lib/component alignment`
- `src/components/broker/WatchlistV2.tsx` — `// @ts-nocheck — R119: ML code, cross-module type mismatch`

**人类影响**: 这些文件定义了深度行情和自选列表, 是交易员最常用的两个功能。类型屏蔽意味着深层bug不会被TSC发现, 某天价格显示错误或成交数据错位会造成实际亏损。

**修复方案**:
1. `types-data.ts`: 补全 `KlineBar`/`Timeframe`/`AdjustType` 的 import (from `./types`), 交叉验证 `IndicatorLine` 在两个文件中的定义是否一致
2. `OrderBookWaterfall.tsx`: 统一 `OrderBookSnapshot → OrderBookData` 转换函数中缺失字段的类型, 补全 `DepthLevel` 映射
3. `WatchlistV2.tsx`: 将内联 `TaggedQuote`/`WatchlistRow` 类型替换为 `broker-ui-types.ts` 中的正式定义

**验收**: TSC 0, 无新增 error

### P0-2: 券商连接向导 — 从Mock到真实流程 (6h, 含类型补全)

**现状**: `BrokerManagerAndPortfolio.tsx` 全部使用 `MOCK_BROKERS` (10个mock对象), 没有实际调用 `broker:connect` IPC。用户连接券商的完整流程不存在:
- 输入API Key/Secret → 0实现
- OAuth 跳转授权 → 0实现 (虽然 `OAuthTokenStore.ts` 和 `oauth-ipc-registration.ts` 后端已完成)
- 连接状态验证 → 0实现 (mock `status: 'connected'` 假数据)
- 断线重连 → 0实现

**人类影响**: 这是打开软件后的第一道门槛。交易员无法连接真实券商, 整个软件不可用。

**类型需求**: 需要补全 `BrokerConnectionWizard` 的步骤类型:
```typescript
type ConnectionStep = 'select_broker' | 'input_apikey' | 'oauth_redirect' | 'verify' | 'done';
interface ConnectionState {
  step: ConnectionStep;
  brokerId: string;
  mode: 'apikey' | 'oauth2' | 'oauth1a';
  apiKey?: string;
  apiSecret?: string;
  oauthCode?: string;
  error?: string;
  verifying: boolean;
}
```

**修复方案**:
1. 创建 `src/components/broker/BrokerConnectWizard.tsx` — 4步向导
2. 桥接 `electron/broker/CredentialManager.ts` → 渲染进程
3. 为每家券商预填连接说明 (Schwab OAuth2 PKCE / E\*TRADE OAuth1.0a / Binance API Key)
4. 连接成功后自动保存凭证到 keytar

### P0-3: 图表右键菜单 — 交易核心交互缺失 (4h)

**现状**: K线图完全没有右键菜单。人类交易员的标准操作流程:
1. 右键某根K线 → "在此价格设置止损"
2. 右键某根K线 → "在此价格设置限价单"
3. 右键鼠标画区域 → "添加到自选"
4. 右键某根K线 → "设置价格提醒"
5. 右键指标线 → "修改指标参数"

**6个组件都没有右键菜单**: `KLineChartPro` `OrderBookWaterfall` `TickTimeline` `HeatmapTreemap` `MarketScanner` `WatchlistV2`

**类型需求**:
```typescript
interface ChartContextMenu {
  x: number; y: number;
  bar: KlineBar | null;
  price: number;
  symbol: string;
  visible: boolean;
}
type ChartContextAction =
  | 'place_limit_order'
  | 'set_stop_loss'
  | 'set_take_profit'
  | 'set_alert'
  | 'add_to_watchlist'
  | 'copy_symbol'
  | 'indicator_settings'
  | 'draw_horizontal_line';
```

### P0-4: K线字体一致性 + 暗色主题全局应用 (3h)

**现状**: KLineChartPro 使用 `fontFamily: 'monospace'` (inline style), 但 lightweight-charts 默认使用系统sans-serif。BrokerManagerAndPortfolio 又用 `fontFamily: 'monospace'` 但其他组件混用 — 看到不一致:
- KLineChartPro: `fontFamily: 'monospace'` (inline)
- BrokerManagerAndPortfolio: `fontFamily: 'monospace'` (inline)
- ChartError/ChartSkeleton: `fontFamily: 'monospace'` (inline)
- ThemeToggle: 无 fontFamily 设置
- IndicatorPanel: 无 fontFamily 设置

**人类影响**: 交易终端字体不统一是业余标签。专业交易员对字体/颜色极度敏感, 不统一降低信任感。

**修复**: 统一在 CSS 变量或 tailwind.config 中定义 `--dw-font-mono`, 全局应用到所有 chart/broker 组件。

### P0-5: 自选列表拖拽排序 + 多列表管理 (3h)

**现状**: WatchlistV2 是静态mock数据, 无拖拽, 只硬编码了5个币种:
```typescript
const MOCK_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'ADA-USDT'];
```

`ChartPreferences.ts` 的 `useWatchlistStorage` 用 localStorage 存 `string[]`, 做了基础CRUD, 但没有对接 WatchlistV2 的渲染。

**人类影响**: 交易员通常有多组自选 (日内/中长线/观察列表), 需要分组管理、拖拽排序、右键移除。

**类型需求**:
```typescript
interface WatchlistGroup {
  id: string;
  name: string;
  symbols: string[];
  sortOrder: number;
  isDefault: boolean;
}
interface WatchlistDragState {
  draggingIndex: number | null;
  overIndex: number | null;
}
```

### P0-6: 图表快捷键补齐 (2h)

**现状**: `useKeyboardShortcuts.ts` 只有 1-9 视图切换 + Ctrl+B/N/K。交易终端需要:
- `Space` → 切换全屏K线 (隐藏侧栏+顶部栏)
- `+` / `-` → 放大缩小K线
- `←` / `→` → 左移右移K线
- `Tab` → 切换到下一个自选标的
- `Shift+Tab` → 上一个
- `Enter` → 快速下单弹窗 (打开当前价)
- `T` → 切换十字光标模式
- `D` → 切换复权
- `F` → 聚焦搜索框
- `Esc` → 关闭弹窗/退出全屏

0个Chart特定快捷键 → 交易员必须用鼠标完成所有操作, 效率极低。

---

## P1 (重要 — 提升体验, 合计 16h)

### P1-1: IPC通道 Zod Schema 运行时验证 (5h)

**现状**: 50个IPC通道全部依赖TypeScript编译时类型, 无运行时校验。`electron/broker/` 的 handler 都接受 `any` 或内联类型。

**风险**: 渲染进程传错字段 → 静默吞掉错误 → 数据异常但无提示。例如 `KlineRequest.symbol` 传了 `00700.HK` 而不是标准化格式 `HK.00700`, 后端无法处理但也不报错。

**修复**:
1. 为20个核心IPC通道添加Zod schema (quote/depth/tick/kline/indicator/scanner/alert)
2. 在 `ipcMain.handle` 的 handler 入口 validate
3. 在 `ipcRenderer.invoke` 调用前 validate

### P1-2: 数据陈旧指示器 (3h)

**现状**: 所有组件无"数据最后更新时间"显示。离线/断线时用户看到的是过时数据但毫不知情。

**人类影响**: 致命。看到3分钟前的价格下单是交易员的噩梦。

**修复**:
1. 在每个数据组件右上角显示 `● 实时 ● 2秒前 ● 5分钟前(陈旧) ● 离线` 
2. 陈旧数据自动灰色蒙版 + 警告图标
3. 通过 `useBrokerData` hook 的 `lastUpdate` 字段统一管理

**类型需求**:
```typescript
type DataFreshness = 'live' | 'recent' | 'stale' | 'offline';
interface DataFreshnessIndicator {
  freshness: DataFreshness;
  lastUpdate: number;
  autoHideAfter: number; // ms, default 5000 for 'recent'
}
```

### P1-3: OrderBook 委托分布/大单墙/成交热力缺失 (4h)

**现状**: `OrderBookWaterfall.tsx` 有 `WallAlert` 类型定义但组件未实现大单墙检测渲染。无成交热力图(FootprintChart.tsx 存在但只有骨架)。

交易员在 OrderBook 上最需要看到的3个信息:
1. **大单墙** (某个价格档位挂单量 > 均价3倍) → 高亮🔴
2. **委托分布** (买卖比偏离) → 顶部显示净买卖比
3. **最近成交** (价格旁边显示最近一笔成交方向) → ↑↓箭头

**修复**: 
1. 在 `OrderBookWaterfall` 中添加 WallAlert 渲染
2. 添加买卖比指示器 `bidRatio: number` (bids总/asks总)
3. 在价格旁叠加最近成交标记

### P1-4: 横屏移动端适配 + 多屏分离 (2h)

**现状**: 所有组件 width/height 硬编码, 无响应式设计。交易员常见场景:
- 笔记本外接2个显示器 → 想把K线拖到外屏, 订单簿保持在内屏
- 竖屏监控 → 要求组件自动调整布局

**修复**:
1. `KLineChartPro` 添加 `detachable` prop → 弹出独立窗口
2. 添加 CSS container queries 适配宽度 < 600px 场景
3. `ChartContext` 添加 `isDetached` / `parentWindowId` 状态

### P1-5: 从K线图快速下单 (2h)

**现状**: `TradeEssentials.tsx` 有条件单面板 (止损/止盈/追踪止损/OCO), 但**没有从图表直接下单的入口**。

交易员需要:
1. 在K线图上看到当前价
2. 点一下 → 弹出快速下单面板 (市价/限价)
3. 输入数量 → 确认 → 下单

这个流程在富途/TradingView/Binance都支持, 是高频操作。

**修复**: 创建 `QuickOrderPanel.tsx`, 从 `KLineChartPro` 的回调中弹出:
```typescript
interface QuickOrder {
  symbol: string;
  brokerId: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  quantity: number;
  price: number; // current price, user can edit for limit
  stopLoss?: number;
  takeProfit?: number;
}
```

---

## P2 (锦上添花 — 完善体验, 合计 10h)

### P2-1: 指标参数实时预览 + 保存模板 (2h)

**现状**: `IndicatorPanel.tsx` 的 INDICATOR_DEFS 定义了参数, 但改了参数后必须关闭面板才能看到效果。TradingView的做法是: 拖动滑块 → K线实时更新 → 满意后保存。

**修复**:
1. IndicatorPanel 添加 `onParamChange` throttle 回调
2. 保存指标模板到 localStorage: `indicator_templates: Record<string, IndicatorDef[]>`
3. 一键加载预设模板 ("日内短线", "趋势跟踪", "波动套利")

### P2-2: TypeScript Discriminated Union 优化 — 全链路类型安全 (3h)

**现状**: 多处使用 `string` 而非 discriminated union, 导致:
- `ScanField` 是 string union 但 `MarketScanner.tsx` 中用的是 `any` 
- `CandleType` 是 union 但 KLineChartPro 用 `string` 接受

**修复**:
1. `ScanField` → 将类型定义从 `scanner-types.ts` 导入到 `MarketScanner.tsx`
2. `CandleType` → 淘汰 KLineChartPro 中的 `string` 参数
3. 添加 `assertNever()` 函数确保所有 switch-case 覆盖完整

### P2-3: ChartStates 增强 — 5秒超时 + 重试计数 + 离线提示 (2h)

**现状**: `ChartSkeleton`/`ChartError`/`ChartEmpty` 三态完整, 但缺少:
- 加载超过5秒 → "数据源响应慢, 正在重试..." (有的券商API慢)
- 重试3次后 → "请检查券商连接状态"
- 网络离线 → 自动检测 `navigator.onLine` → "当前无网络, 显示缓存数据"

### P2-4: 画线工具吸附 + 磁吸到K线价格 (1h)

**现状**: `DrawingStorage.ts` 的画线数据存了 `price` 字段, 但 `DrawingToolbar.tsx` 没有价格吸附功能。

交易员画线时需要: 鼠标拖到某根K线附近 → 自动吸附到该K线的开/高/低/收价格。

### P2-5: 交易时段指示器 (1h)

**现状**: 无任何交易时段指示。港股9:30-16:00/美股9:30-16:00 EST/加密24h → 用户不知道当前市场是否开盘。

**修复**: K线图标题栏显示:
- 🟢 交易中 (港股 10:23)
- 🟡 盘前/盘后
- 🔴 休市 (下次开盘: 明天 09:30)
- 🟣 24h (加密)

### P2-6: 价格单位本地化 (1h)

**现状**: 所有价格显示为原始数字, 无千分位分隔符。美股用 `$` 但香港用 `HK$`。
- `98234.5` → 应显示为 `98,234.50` 
- 港股价格 `182.30` → 应显示为 `HK$182.30`
- A股价格 `2988.50` → 应显示为 `¥2,988.50`

---

## 汇总

| 优先级 | 项目 | 工时 | 状态 |
|--------|------|------|------|
| **P0-1** | @ts-nocheck 清除 (3文件) | 4h | 类型安全瘫痪 |
| **P0-2** | 券商连接向导 (Mock→真实) | 6h | 软件不可用 |
| **P0-3** | 图表右键菜单 (6组件) | 4h | 核心交互缺失 |
| **P0-4** | 字体/颜色一致性 | 3h | 专业性损伤 |
| **P0-5** | 自选列表拖拽+分组 | 3h | 基础功能缺失 |
| **P0-6** | 图表快捷键 | 2h | 效率极低 |
| **P0小计** | | **22h** | |
| **P1-1** | IPC Zod运行时验证 | 5h | 数据安全风险 |
| **P1-2** | 数据陈旧指示器 | 3h | 致命体验 |
| **P1-3** | OrderBook大单墙/成交热力 | 4h | 核心功能残废 |
| **P1-4** | 多屏分离/响应式 | 2h | 重度场景不支持 |
| **P1-5** | K线快速下单面板 | 2h | 高频操作缺失 |
| **P1小计** | | **16h** | |
| **P2-1** | 指标参数实时预览+模板 | 2h | |
| **P2-2** | Discriminated Union全链路类型安全 | 3h | |
| **P2-3** | ChartStates 超时/重试/离线 | 2h | |
| **P2-4** | 画线工具价格吸附 | 1h | |
| **P2-5** | 交易时段指示器 | 1h | |
| **P2-6** | 价格单位本地化 | 1h | |
| **P2小计** | | **10h** | |
| **总计** | | **48h** | P0 22h + P1 16h + P2 10h |

---

## 与现有代码的直接关联

| 提案 | 涉及文件 | QClaw负责的类型文件 |
|------|---------|-------------------|
| P0-1 | types-data.ts, OrderBookWaterfall.tsx, WatchlistV2.tsx | types-data.ts ✓ |
| P0-2 | BrokerManagerAndPortfolio.tsx, CredentialManager.ts | broker-ui-types.ts 需扩展 |
| P0-3 | KLineChartPro, OrderBookWaterfall, TickTimeline, HeatmapTreemap, MarketScanner, WatchlistV2 | types.ts 需新增 ChartContextMenu |
| P0-4 | KLineChartPro, BrokerManagerAndPortfolio, ThemeToggle, IndicatorPanel | - |
| P0-5 | WatchlistV2, ChartPreferences.ts | 需新增 WatchlistGroup |
| P0-6 | useKeyboardShortcuts.ts | - |
| P1-1 | 50 IPC channels | 所有 *_types.ts |
| P1-2 | 所有 data-displaying 组件 | 需新增 DataFreshnessIndicator |
| P1-3 | OrderBookWaterfall, depth-types.ts | depth-types.ts 已有 WallAlert |
| P1-4 | KLineChartPro, ChartContext | - |
| P1-5 | TradeEssentials, KLineChartPro | 需新增 QuickOrder |
| P2-1 | IndicatorPanel, indicator-engine.ts | types.ts 已有 IndicatorDef |
| P2-2 | MarketScanner, KLineChartPro, 所有类型文件 | scanner-types.ts, types.ts |
| P2-3 | ChartStates.tsx | - |
| P2-4 | DrawingToolbar, DrawingStorage | drawing-types.ts |
| P2-5 | KLineChartPro, ChartContext | - |
| P2-6 | BrokerManagerAndPortfolio, WatchlistV2, SignalProviderDashboard | - |

---

## 核心发现

1. **类型系统有骨架但缺血肉**: 6个类型文件(~120KB)定义了完整的类型, 但3个组件用@ts-nocheck绕过了检查, 多个组件内联了重复类型定义, 与类型文件不一致。

2. **后端完成度远超前端的断层**: electron/broker/ 有17家券商适配器 + CredentialManager + OAuthTokenStore + BrokerEventBus + QuoteAggregator, 但前端100% Mock。这是**最大的浪费** — 后端投入了310h但用户看的是假数据。

3. **"先发后端, 后补前端"策略的反噬**: R109-R121的13轮中, 后端引擎+适配器获得了压倒性投入, 但用户交互层完全没有跟上。人类使用习惯审查揭示: 右键菜单0、快捷键仅9个、券商连接0、自选列表静态5条Mock。

4. **类型文件的价值**: 6个类型文件是**架构正确的**, 提供了完整的类型基础。修复方向不应是新建更多类型文件, 而应是将现有类型**真正应用到组件中**(替换内联类型, 清除@ts-nocheck, 添加Zod校验)。

---

> **审查结论**: 类型系统健全(80分), 但前端用户交互严重滞后(30分)。P0的22h应最高优先级, 解决"不可用"问题。P1的16h解决"难用"问题。P2的10h解决"不专业"问题。
>
> **QClaw建议顺序**: P0-1(类型) → P0-2(连接) → P0-3(右键) → P0-6(快捷键) → P1-1(Zod) → P1-2(刷新指示器) → 其余P0→P1→P2
>
> **Commit**: 待提交 → `docs/proposals/qclaw-final-polish.md`
