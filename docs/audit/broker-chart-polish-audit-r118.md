# DAWN WHALES 券商&行情打磨审计报告
> 独立审查日期: 2026-06-12 13:00
> 审查范围: 28个组件 (17 chart + 4 broker + 7 lib engines)
> 审查人: ML
> 受众: PM

---

## 一、总览

### 已完成
| 模块 | 组件数 | 总KB | 状态 |
|------|--------|------|------|
| 券商UI | 4 | ~35 | ✅ 功能完整 |
| K线/指标 | 4 | ~53 | ✅ 核心就绪 |
| 深度行情 | 3 | ~25 | ✅ 核心就绪 |
| 市场扫描/热力 | 4 | ~44 | ✅ 核心就绪 |
| 高级可视化 | 4 | ~20 | ✅ 核心就绪 |
| CBBO/套利 | 2 | ~19 | ✅ 核心就绪 |
| 回放/微观 | 2 | ~19 | ✅ 核心就绪 |
| **合计** | **23** | **~215** | |

---

## 二、P0 严重问题 (必须修，用户无法使用)

### 2.1 KLineChartPro 不支持缩小/横向滚动 ❌
**现象**: KLineChartPro 组件创建后只画可见数据，没有横向滚动/缩放交互。用户无法查看历史K线。
**影响**: K线图核心功能缺失，用户无法回看历史走势。
**建议**:
- 使用 lightweight-charts 内置的 `timeScale().setVisibleRange()` API
- 添加鼠标滚轮缩放 (已有 WheelEvent 但未绑定到 chart)
- 添加左右拖动平移
- 或使用 lightweight-charts 的 `handleScroll` + `handleScale` 事件
**工时**: 3h

### 2.2 券商组件使用 Mock 数据，未对接真实 IPC ❌
**现象**: WatchlistV2/AggregatedPortfolio/ArbitragePanel 全部包含 `generateMockData()` 或 `MOCK_BALANCES`，从未调用真实的 BrokerManagerV2 IPC。
**影响**: 用户在UI上看不到真实券商数据，整个券商UI是"美丽的假数据"。
**建议**:
- 创建 useBrokerData hook, 调用 `window.electronAPI.invoke('broker:getAggregatedPositions')` 等
- WatchlistV2 应订阅 `broker:subscribe` IPC 事件
- 每个组件添加数据源切换: `useMockData ? mock : fetchReal()`
**工时**: 8h

### 2.3 KLineChartPro 只有 5 个可叠加指标，IndicatorEngine 有 28 个 ❌
**现象**: KLineChartPro.tsx 的 `indicators` 只接收 `['ma','ema','boll','sar','vwap']` 五种。但 indicator-engine.ts 实现了 28 个指标。用户选了 RSI/MACD/KDJ 不会在图上显示。
**影响**: 用户无法使用已实现的 23 个指标做技术分析。
**建议**:
- KLineChartPro 扩展 `indicators` 处理逻辑，对 MACD/RSI/KDJ 生成子图 (sub-pane)
- lightweight-charts 支持 `paneSize` + `addPane` 实现多子图
- 每个多线指标 (MACD/BOLL/KDJ/Ichimoku) 独立子图
**工时**: 6h

### 2.4 图表组件间无联动 ❌
**现象**: KLineChartPro, OrderBookWaterfall, TickTimeline 是独立渲染的，不同symbol切换不同步。用户在K线上换了BTC, OrderBook还在显示ETH。
**影响**: 交易员看盘核心需求——所有面板同步切换标的。
**建议**:
- 创建 React Context: `ChartSymbolContext` — 所有图表组件从context读取当前symbol
- 用 useReducer 或 Zustand 管理 chart state: `{ symbol, timeframe, exchange }`
- KLineChartPro 作为"主面板", 切换symbol时触发所有面板同步更新
**工时**: 4h

---

## 三、P1 重要问题 (影响体验, 建议尽快修)

### 3.1 缺少"一键全屏"和"多图布局"切换
**现象**: KLineChartPro 只能单图显示, 用户无法同时看日K + 4hK, 或BTC/USDT + ETH/USDT 并排。
**场景**: 用户想看 "BTC 日K + 4hMACD" 两个图并排。
**建议**:
- 添加 `layout: 'single' | '2up' | '4up' | '1+3'` prop
- 单图模式: 当前行为
- 两图模式: 日+4h并排
- 四图模式: 4个时间周期
- 同步: 所有图共享 symbol/indicators
**工时**: 8h

### 3.2 无键盘快捷键
**现象**: 交易员用键盘切换周期/指标/TAB的效率远高于鼠标点击。
**建议**:
- `1-9` 切换周期 (1m→M)
- `Space` 播放/暂停 (回放/Tick)
- `← →` K线平移
- `+/-` 缩放
- `Ctrl+F` 搜索symbol
- `Esc` 取消画线/退出全屏
**工时**: 2h

### 3.3 价格精度/单位格式不统一
**现象**: 加密货币显示 2 位小数 (BTC应该是1位), 港股显示 2 位 (应该是3位), 美股显示 4 位 (应该是2位)。格式化函数 `formatPrice()` 没有根据市场和 tickSize 动态调整。
**影响**: 价格显示不符合各个市场的惯例, 用户不习惯。
**建议**:
- `formatPrice(n, market)` 根据 market 自动选择小数位
- 集成 CodeNormalizer 的 `getTickSize(symbol, market)` 
- 市场格式化规则: Crypto(BTC=1位/ETH=2位/小币=4-6位), 美股(2位), 港股(3位), 外汇(4-5位)
**工时**: 1h

### 3.4 颜色/对比度未做无障碍检查
**现象**: 多个组件使用 `#22c55e` 绿色 (OK), 但 `#ef4444` 红色对红绿色盲用户与 `#484f58` 灰色无差别。
**建议**:
- 添加色盲模式 (protanopia/deuteranopia) 颜色方案
- 涨跌用符号辅助 (▲▼, +/-) 而不只依赖颜色
- Spread 价差等级不只是绿黄红, 加图标 ⬜🟨🟥
- 在 Settings 添加 "色盲模式" 开关
**工时**: 3h

### 3.5 无加载骨架屏/空状态不够友好
**现象**: 大部分组件空状态只显示 "等待 XXX 数据..." 灰色文字。用户不知道是"没连接"还是"在加载"还是"没数据"。
**建议**:
- 三态区分: `loading` (Skeleton) / `empty` (引导连接券商) / `error` (重试按钮)
- OrderBookWaterfall 空态建议: "请先在经纪商页面连接至少1家交易所"
- TickTimeline 空态: "暂无逐笔数据, 请订阅实时行情推送"
**工时**: 2h

### 3.6 券商连接状态在图表中不可见
**现象**: WatchlistV2 有 broker 选择器(但用的是静态列表), 其他所有图表组件都没有显示"当前哪些券商在线"。
**场景**: 用户看到K线图没有数据, 不知道是"没连接券商"还是"没数据"。
**建议**:
- 所有图表组件底部/顶部加 BrokerStatusBar: 显示已连接券商数量+状态灯
- 红灯(断线)/黄灯(延迟)/绿灯(正常)/灰灯(未连接)
- 单击状态栏弹窗显示各券商详情 (延迟/推送频率/最后更新时间)
**工时**: 3h

---

## 四、P2 优化建议 (长期完善)

### 4.1 指标面板缺少"我的常用"和"指标模板"
- 当前 IndicatorPanel 只有 5 分类 + 4 Preset, 用户每次都要重新选
- 建议: localStorage 保存 "My Indicators" 配置, "指标模板" (如 "MACD+RSI+BOLL 组合")

### 4.2 画线工具缺少"撤销/重做"
- DrawingToolbar 只有"取消", 没有 Undo/Redo
- 建议: DrawingHistory 栈 (最多20步), Ctrl+Z/Ctrl+Y

### 4.3 热力图缺少"时间段对比"
- HeatmapTreemap 有 4 周期 (today/5d/20d/ytd), 但没有"对比上一周期"的色阶
- 建议: 添加"与昨日对比"模式, 颜色表示 "今日 vs 昨日" 的变化

### 4.4 市场扫描器缺少"条件保存/分享"
- MarketScanner 自定义条件面板可用, 但没法保存条件为模板
- 建议: localStorage 保存扫描模板, 导出为 JSON

### 4.5 回放面板缺少"事件标注"
- ReplayPanel 只能回放, 不能标注关键事件
- 建议: 回放时可以点击时间线添加标注 (如 "BTC ETF获批" / "CPI公布")

### 4.6 微观结构面板缺少"历史趋势"
- MicrostructurePanel 只显示当前快照, 看不到 VPIN/Kyle Lambda 的变化趋势
- 建议: 添加小 sparkline 显示最近 20 个数据点的趋势

### 4.7 券商间价差/套利缺少声音提醒
- ArbitrageMonitor 有 >0.5% 闪烁告警, 但用户不盯盘时收不到
- 建议: 有套利机会时播放简短提示音 + 系统通知 (对接 AlertPanel)

### 4.8 DOM/Footprint 数据没有成交量加权展示
- DOMLadder 只显示 size, 没有 VWAP 参考线
- FootprintChart 有 buy/sell 拆分但无时间加权
- 建议: DOM 叠加 VWAP 线, Footprint 添加时间分桶 (1m/5m/15m)

---

## 五、券商集成度检查

| 券商 | K线 | 深度 | Tick | 账户 | 持仓 | 下单 | WS推送 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 富途 | UI✅ | UI✅ | UI✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ |
| moomoo | UI✅ | UI✅ | UI✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ |
| IBKR | UI✅ | UI✅ | UI✅ | 引擎✅ | 引擎✅ | — | 引擎✅ |
| 币安 | UI✅ | UI✅ | UI✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ |
| OKX | UI✅ | UI✅ | UI✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ |
| Bybit | UI✅ | UI✅ | UI✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ |
| Bitget | UI✅ | UI✅ | UI✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ |
| Tiger | UI✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ | 引擎✅ |
| 华盛 | UI⚠️ | 引擎✅ | — | 引擎✅ | 引擎✅ | 引擎✅ | — |
| 盈立 | UI⚠️ | 引擎✅ | — | 引擎✅ | 引擎✅ | 引擎✅ | — |
| Schwab | UI❌ | — | — | — | — | — | — |
| E*TRADE | UI❌ | — | — | — | — | — | — |
| eToro | UI❌ | — | — | — | — | — | — |
| Webull | UI❌ | — | — | — | — | — | — |

**结论**: 核心 10 家图表组件有UI支持, OAuth 4家 (Schwab/E*TRADE/eToro/Webull) 未集成UI

---

## 六、建议优先级排序

### 第一优先级 (P0, ~21h, 一周内)
1. **K线横向滚动/缩放** — 3h, 用户最直接的痛点
2. **券商组件对接真实IPC** — 8h, 假数据→真数据
3. **K线指标子图支持(MACD/RSI/KDJ)** — 6h, 28指标只能显示5个
4. **图表间Symbol同步联动** — 4h, 核心交易体验

### 第二优先级 (P1, ~19h, 两周内)
5. **加载/空/错误三态完善** — 2h
6. **一键全屏+多图布局** — 8h
7. **键盘快捷键** — 2h
8. **价格精度格式化** — 1h
9. **券商连接状态栏** — 3h
10. **无障碍/色盲模式** — 3h

### 第三优先级 (P2, ~20h, 随版本迭代)
11. 指标模板/常用保存 — 3h
12. 画线undo/redo — 3h
13. 热力图对比模式 — 3h
14. 扫描条件保存分享 — 2h
15. 回放事件标注 — 3h
16. 微观结构趋势sparkline — 2h
17. 套利声音提醒 — 2h
18. DOM VWAP叠加 — 2h

---

## 七、给PM的行动建议

1. **P0四件事必须立即开始**, 否则用户使用体验严重不足。建议Round编号 R119 (打磨轮)。
2. **K线子图是最值钱的功能** — MACD/RSI/KDJ 是所有交易员必看指标, 现在只显示MA/EMA等于白做了23个指标引擎, 这是最低垂的果实。
3. **券商 mock→real 对接** 是信任问题 — 用户打开软件看到随机假数据, 等于"这软件不可靠"的第一印象。
4. **OAuth 4 家** (Schwab/E*TRADE/eToro/Webull) 图表组件完全没有对应UI, 建议在R119同步补充 (每个 2h, 共8h)。
5. **建议创建统一的 `ChartContext` (Zustand store)** 管理所有 chart 共享状态 ({symbol, timeframe, market, connectedBrokers, indicatorConfigs}), 这是解决多个P0/P1问题的基础架构。

**总计打磨工时**: P0 21h + P1 19h + P2 20h = **60h**, 建议分 2-3 轮完成。
