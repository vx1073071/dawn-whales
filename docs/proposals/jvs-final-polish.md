# JVS 最终打磨方案 — 券商+行情全链路完善

**提交人**: JVS (引擎虾)  
**审查范围**: electron/broker(27) + src/lib/chart(35) + components(27) + IPC(4) = **93 files / 32,316 lines**  
**审查日期**: 2026-06-12  
**方法论**: 按人类使用习惯7维度审计 + 代码证据验证

---

## 总览

| 优先级 | 数量 | 预估工时 | 性质 |
|--------|------|----------|------|
| **P0 致命的** | 8 | 28h | 数据流断裂 / 功能不可用 |
| **P1 痛的** | 12 | 32h | 体验差 / 明显缺功能 |
| **P2 锦上添花** | 8 | 16h | 视觉统一 / 效率提升 |
| **合计** | **28** | **76h** | 建议分 2 轮执行 |

---

## P0 — 致命的（用户打开 App 功能不可用）

### P0-1. 5 条数据链路全部断裂
**现状**: 券商→IPC→bridge→引擎→UI 的5条链路中，引擎+桥+UI 都存在但从未接通数据。用户看到的永远是空状态。

| 链路 | 券商→IPC | Bridge | 引擎 | UI组件 | 当前状态 |
|------|----------|--------|------|--------|----------|
| 实时行情→K线 | ✅ broker:subscribe | ❌ 未接 | ✅ | ✅ KLineChartPro | 刷不出实时K线 |
| 多券商→CBBO | ❌ 无聚合订阅 | ❌ 未接 | ✅ CBBOEngine | ✅ CBBOPanel | 永远空白 |
| OrderBook→瀑布图 | ❌ 无orderbook订阅 | ✅ bridge | ✅ OrderBookEngine | ✅ Waterfall | "等待深度数据..." |
| Tick→足迹图 | ❌ 无tick订阅 | ❌ | ✅ TickCache | ✅ FootprintChart | 永远空白 |
| Alert→通知 | ❌ | ❌ | ✅ AlertService | ✅ AlertAndFundFlow | 告警永不触发 |

**证据**: 19 个图表组件中仅 3 个有 `useEffect`/`subscribe` 数据订阅；`broker:subscribe` IPC handler 存在但无组件调用。  
**修复**: 在 `BrokerChartBridge` 中创建统一的 `connectDataSources()` 启动函数，在 `ipc-setup.ts` 中注册，让 preload 暴露 `onQuote/onOrderBook/onTick` 回调给 renderer。  
**工时**: 8h

### P0-2. 4 个关键 IPC 未注册（写了代码但没接线）
**现状**: R119-R121 创建的 notification-ipc / differential-push-ipc / indicator-worker-ipc 全部未在 `ipc-setup.ts` 中 `register`，preload 也不暴露。

**证据**: `ipc-setup.ts` 中 `registerNotificationIPC` / `registerDifferentialPushIPC` / `registerIndicatorWorkerIPC` 均搜索不到。  
**修复**: 在 `ipc-setup.ts` 的 `setupIPC()` 中添加3行注册调用；在 preload 中添加 `onNotify/onDiff/computeIndicators` 的 contextBridge 暴露。  
**工时**: 2h

### P0-3. Indicator Web Worker 从未被使用
**现状**: `indicator-engine-worker.ts` 已实现19个指标的 `computeIndicators()`，`indicator-worker-ipc.ts` 已写好 IPC handler，但 KLineChartPro 仍然在主线程同步计算指标。

**证据**: `KLineChartPro.tsx` 直接 import `calcSMA/calcEMA/...` 而非通过 `window.electronAPI.computeIndicators()`。  
**影响**: 60+指标在主线程阻塞 UI，帧率<15fps（预期<30fps）。  
**修复**: 将 KLineChartPro 的指标计算改为 `await window.electronAPI.computeIndicators({...})` 异步调用。  
**工时**: 3h

### P0-4. 0 个 React ErrorBoundary — 一个引擎崩溃白屏全局
**现状**: 26 个 broker/chart 组件中 0 个有 ErrorBoundary 包裹。任意引擎（如 ArbitrageEngine、DepthAnalyzer）内部 throw 会导致整个面板白屏。

**证据**: 搜索 `ErrorBoundary` 在 `src/components/chart/` 和 `src/components/broker/` 中返回 0 结果。  
**修复**: 创建 `<ChartErrorBoundary>` 组件，包裹所有 broker/chart 页面，捕获引擎异常并显示友好错误+重试按钮。  
**工时**: 2h

### P0-5. ChartContext (Zustand) 定义了但 0 个组件使用
**现状**: `src/lib/chart/chart-context.ts` 应存在（在 PM 规格中定义了 `ChartContext` 含 `symbol/timeframe/theme`），但 26 个组件中 0 个 import。

**证据**: `grep ChartContext src/components/` 返回 0。切换 symbol 时 KLine/Waterfall/Scanner 各管各，无法联动。  
**影响**: 用户在 MarketScanner 点击 BTC → K 线图不切换，必须手动在两个地方各选一次 symbol。  
**修复**: 所有 chart 组件从 ChartContext 的 Zustand store 读取 `symbol/timeframe`，统一联动。  
**工时**: 4h

### P0-6. BrokerManagerV2 连接无反馈 — 用户不知道连接状态
**现状**: `BrokerManagerV2.connect()` 是异步的，但没有返回可视状态给 UI。`broker:getStatus` IPC 存在但无组件轮询/订阅。

**证据**: BrokerManagerV2 有 `getConnectionStatus()` (R119新增) 和 `onStatusChange()` 但无组件调用。  
**影响**: 用户点击"连接币安"→等待→没反应→以为 App 坏了。  
**修复**: `useBrokerData` hook 中添加 `useEffect` 轮询 `broker:getStatus`，UI 显示连接态 绿/黄/红灯。  
**工时**: 2h

### P0-7. 下单无券商确认（虽已写 notification-ipc 但未注册）
**现状**: 通知 IPC 写了 `notify:order-confirm` 但未注册。用户下单直接发送，没有任何 "确认发送到 [富途]？" 的弹窗。

**证据**: broker-ipc.ts 中 `broker:placeOrder` handler 直接执行，无确认流程。  
**影响**: 用户可能在错误的券商下错误的单，无撤销机会（不符合 v3.0 安全要求）。  
**修复**: `broker:placeOrder` 返回 `{ pending: true }`，由 renderer 调用 `notify:order-confirm` 弹窗，确认后调用 `broker:placeOrderConfirm`。  
**工时**: 2h

### P0-8. 用户不知道如何开始 — 无首次使用引导
**现状**: 打开 App → 空白 K 线图 → 空白 OrderBook → 空白自选。没有引导用户"请先连接券商"或"请先添加自选"。

**证据**: 所有 Empty 状态文字是"等待深度数据..."、"暂无数据"，不包含任何操作引导。  
**修复**: 创建 `<OnboardingWizard>` — 首次使用 step-by-step: 连接券商(1/3) → 添加自选(2/3) → 开始交易(3/3)。  
**工时**: 5h

---

## P1 — 痛的（体验明显差）

### P1-1. K线图缺右键菜单
**现状**: 右键 K 线图无任何行为。人类习惯：右键 → 添加提醒/查看深度/加入自选/复制价格。

**修复**: 在 KLineChartPro 添加 `onContextMenu` → 弹出 `ChartContextMenu`: [添加价格提醒] [查看深度] [加入自选] [复制价格] [分享截图]。  
**工时**: 3h

### P1-2. 键盘快捷键全部缺失
**现状**: trading 类应用的核心操作全部依赖鼠标点击：
- 空格 = 播放/暂停实时数据 ❌
- ← → = 移动 K 线 ❌
- +/- = 缩放 ❌
- Tab = 切换周期 ❌
- Esc = 关闭面板 ❌
- Ctrl+F = 搜索 symbol ❌

**修复**: 创建 `useChartHotkeys` hook，注册全局快捷键，在 KLineChartPro/MarketScanner 中启用。  
**工时**: 2h

### P1-3. 自选列表无拖拽排序/分组
**现状**: WatchlistV2 显示 symbol 列表但不支持拖拽排序、右键菜单、分组(加密/港股/美股)。

**修复**: 集成 `@dnd-kit` 拖拽排序 + 右键菜单 [删除/移动/添加提醒/置顶] + localStorage 持久化分组。  
**工时**: 3h

### P1-4. 指标面板不能拖拽排序/保存模板
**现状**: IndicatorPanel 指标列表固定顺序，不能拖拽调整优先级；选择5个指标后刷新页面全部丢失。

**修复**: 指标拖拽排序 + "保存为模板"按钮 → localStorage 持久化模板列表 → "加载模板"下拉菜单。  
**工时**: 2h

### P1-5. 深度图不能点击下单
**现状**: OrderBookWaterfall/DOMLadder 只能看不能操作。人类习惯：点击买单档位 → 弹出限价单（价格=点击档位的价格）。

**修复**: 在 OrderBookWaterfall 价格列添加 `onClick` → 弹出 mini 下单面板，预填价格+数量。  
**工时**: 2h

### P1-6. 券商状态指示灯缺失
**现状**: AggregatedPortfolio 显示余额但不显示券商连接状态。用户得去"券商管理"页才能看连接状态。应该在每个页面顶部显示绿/黄/红灯。

**修复**: 创建 `<BrokerStatusBar>` 组件，放在 App 顶部栏，显示每个已配券商的状态指示灯。hover 显示详情（延迟/Ping/最后连接时间）。  
**工时**: 2h

### P1-7. 无通知历史记录
**现状**: 价格预警触发后只有一次性桌面通知，无历史记录可回溯。用户切出去回来看不到的预警就永远丢失。

**修复**: 在 `notification-ipc.ts` 中添加 `notify:history` IPC → 返回最近 50 条通知。创建 `<NotificationHistory>` 侧边面板。  
**工时**: 2h

### P1-8. 无免打扰模式
**现状**: 通知无法暂停。用户在做策略回测时被价格预警轰炸。

**修复**: 在 BrokerStatusBar 添加 🔔 图标开关 `notify:pause` / `notify:resume` IPC。  
**工时**: 1h

### P1-9. K线图周期切换不支持滚轮
**现状**: 只能用顶部按钮切换日K/周K/月K。人类习惯 TradingView: 滚轮缩放自动切换周期。

**修复**: KLineChartPro 添加 `onWheel` listener → 缩放到边界自动切换 timeframe → `ChartContext.setTimeframe()`。  
**工时**: 1h

### P1-10. 暗色主题硬编码 — 无亮色主题
**现状**: 所有组件使用硬编码 `#0d1117` 暗色背景，不考虑亮色模式。白天户外使用几乎无法阅读。

**修复**: 创建 `chart-theme.css` CSS 变量体系 + ThemeContext → 所有组件替换硬编码颜色为 `var(--chart-bg)` 等。  
**工时**: 4h

### P1-11. 买卖颜色不统一
**现状**: 部分组件用 `#22c55e/#ef4444`，部分用 Tailwind `text-green-500/text-red-500`，部分可能是蓝/橙。用户容易混淆方向。

**修复**: 统一到 CSS 变量 `--color-buy: #22c55e` / `--color-sell: #ef4444` → 全局替换。  
**工时**: 1h

### P1-12. 缺少信号分享功能（商业化必需）
**现状**: `trader-signal-bridge` + `signal-push-engine` 均已写完，但无"分享信号到社区" UI。这是 v15 商业模型的收入来源。

**修复**: 在 SignalsPage 添加"分享"按钮 → 生成信号卡片图片 → 发送到社区/复制链接。  
**工时**: 3h

---

## P2 — 锦上添花（视觉统一+效率）

### P2-1. 加载状态统一为骨架屏
**现状**: 13/17 chart 组件使用纯文字"加载中..."，ChartSkeleton 只有 7 个组件用。

**修复**: 统一替换为 `<ChartSkeleton type="kline|orderbook|candle" />`。  
**工时**: 2h

### P2-2. Tab 切换无过渡动画
**现状**: 切换 K线/深度/扫雷 tab 是即时切换，无过渡。

**修复**: 添加 `framer-motion` 的 `AnimatePresence` + `motion.div` fade/slide 过渡。  
**工时**: 1h

### P2-3. Empty 状态无引导插图
**现状**: "暂无数据" 纯文字，枯燥。

**修复**: 为每种 Empty 状态配上 SVG 插图 + "点击这里开始" 引导按钮。  
**工时**: 2h

### P2-4. 颜色/间距 CSS 变量体系
**现状**: 组件间 px-2/px-3/p-2 不一致，无 8px 网格。

**修复**: 定义 spacing CSS 变量 + 全局替换 → 视觉统一。  
**工时**: 1h

### P2-5. K线十字光标/数值标注
**现状**: 鼠标悬停 K 线无十字光标，不知道当前价格。

**修复**: KLineChartPro 添加 `crosshair` 模式 + tooltip 显示 O/H/L/C/V。  
**工时**: 1h

### P2-6. 指标对比模式
**现状**: 不能把两个 symbol 的 RSI 放在一起对比。

**修复**: IndicatorPanel 添加"对比模式" toggle → 显示两个 symbol 的同一指标。  
**工时**: 2h

### P2-7. 性能：缓存/内存优化
**现状**: TickCache 每个组件各自 new，内存叠加。QuoteCache 无过期清理。

**修复**: TickCache/QuoteCache 改为全局 singleton + 15 分钟 TTL 过期 + LRU 淘汰。  
**工时**: 1h

### P2-8. 冷启动 Loading Sequence
**现状**: 打开 App → 等 5-10 秒无反馈。

**修复**: 创建启动加载序列: [连接券商 ⏳] → [加载自选 ⏳] → [拉 K 线 ⏳] → [计算指标 ⏳] → [完成 ✓]。  
**工时**: 2h

---

## 执行建议

| 轮次 | 范围 | 工时 | 内容 |
|------|------|------|------|
| **R122 P0** | 致命的 | 28h | 数据链路+IPC注册+Worker+ErrorBoundary+ChartContext+引导 |
| **R123 P1+P2** | 体验+视觉 | 48h | 右键菜单+快捷键+拖拽+主题+分享+加载序列 |

**总计**: 28 项 / 76h / 建议 2 轮

**JVS 负责**: P0-1(8h) + P0-2(2h) + P0-3(3h) + P0-4(2h) + P0-5(4h) + P0-6(2h) + P0-7(2h) + P1-7(2h) + P1-8(1h) + P1-11(1h) + P2-7(1h) = **28h**
