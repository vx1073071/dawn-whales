# TradingEasy 全项目独立审查 v2.0 — 人类使用视角

> 审查人: youdao | 2026-06-12 22:23 HKT | 面向 PM

---

## 审查范围
- `electron/broker/` (19 files) — 券商适配器+管理
- `src/lib/chart/` (35 files) — 行情引擎
- `src/components/broker/` (7 files) — 券商UI
- `src/components/chart/` (27 files) — 图表UI
- `tests/` (152 files) — 测试覆盖
- `docs/` (426 files) — 文档

---

## 一、🔴 致命问题 (阻塞人类使用)

### 1. 55 个文件使用 `@ts-nocheck` — 类型安全完全失效

**发现**: 全项目 55 个 `.tsx` 文件首行为 `@ts-nocheck`，包括核心组件:
- KLineChart.tsx (主图表)
- 15 个 chart 组件全部 skip TSC
- 7 个 broker UI 组件全部 skip TSC
- SettingsPage、TradingDesk、StrategyPage 等核心页面

**人类影响**: 类型错误在生产环境静默崩溃，用户看到的不是错误提示而是白屏。

**建议**: 逐文件清零，最严重的 KLineChart/OrderBookWaterfall/TickTimeline 优先。

### 2. 两套 KLineChart 并存 — 用户困惑

**发现**: 
- `src/components/market/KLineChart.tsx` — 旧版 (MA5/20/60 only)
- `src/components/chart/KLineChartPro.tsx` — 新版 (多周期/指标/画线)
- `src/components/billing/market/AdvancedKLineChart.tsx` — 第三版

**人类影响**: 用户不知道用哪张图表，切换页面时图表功能不一致。

**建议**: 删除旧版 KLineChart，统一到 KLineChartPro。

### 3. BrokerManagerV2 有 `registerAllFactories()` 但无人调用

**发现**: BrokerManagerV2.ts L494 定义了 `registerAllFactories()`，但全项目无调用点。17 家券商工厂注册不完整。

**人类影响**: BrokerManagerV2 无法创建券商实例，券商列表为空，用户看不到任何券商。

**建议**: 在应用初始化时调用 `manager.registerAllFactories()`。

---

## 二、🟡 功能缺失 (降低人类效率)

### 2.1 全局搜索仅限 Marketplace — 跨模块搜索不存在

**发现**: `MarketplaceSearch.tsx` 仅搜索策略市场。R120 的 #26 全局搜索任务未完成。输入 "00700" 不会自动切换 K线+深度面板。

**人类影响**: 用户从一个标的切换到另一个需要手动操作 3+ 个面板。

**建议**: 创建 `GlobalSearch` 组件 → 输入代码 → 自动更新 ChartContext → 所有面板同步。

### 2.2 图表联动缺失 — ChartContext 未接入所有组件

**发现**: `src/components/chart/ChartStates.tsx` 定义了 ChartContext 但 15 个 chart 组件未消费同一 context。K线切 BTC → 深度/扫描/订单簿仍显示旧标的。

**人类影响**: 切换符号需要逐面板操作，非专业交易者会忘记同步。

### 2.3 自选股功能未实现

**发现**: R120 #27 任务未提交。无收藏/自选股列表。用户只能手动输入代码。

**人类影响**: 每次打开应用都要重新找代码，无法记住常用标的。

### 2.4 券商连接无状态反馈

**发现**: 7 个 broker UI 组件全部 `@ts-nocheck`，引擎未连接到真实数据。券商断开时无任何用户提示。

**人类影响**: 用户点击下单后静默失败，不知道是因为网络断开还是券商不支持。

### 2.5 信号 Dashboard + 持仓总览 仅后端就绪

**发现**: R120 #22/#23 UI 组件存在，但 `BrokerManagerV2` 的数据管道未接通。

**人类影响**: 用户看到空白的仪表盘，不知道自己的资金分布。

---

## 三、🟡 代码质量问题

### 3.1 ChartState.tsx 和 indicator-engine.ts 内容异常

**发现**: 
- `src/components/chart/ChartStates.tsx` — 文件名暗示是 state 管理但实际包含 UI 组件
- 全项目组件中大量硬编码中文字符未走 i18n

**人类影响**: 国际化不可用，外国用户看到乱码。

### 3.2 100+ Storybook 文件使用 `@ts-nocheck`

**发现**: 所有 `.stories.tsx` 文件均跳过类型检查。Storybook 构建可能失败。

### 3.3 broker-ipc 控制字符问题

**发现**: QClaw 审计发现 `report-ipc` / `strategy-ipc` 中有不可打印字符导致 TSC 报错。

---

## 四、🟢 人类UX打磨建议 (最影响日常使用)

### 4.1 🔥 交易流程不符合人类心智模型

**当前**: 用户打开 → 选择券商(如果有) → 找代码 → 看K线 → 下决策 → 找下单入口 → 输入参数 → 确认

**人类期望流程**: 打开 → 看持仓/自选股 → 点一个股票 → 看K线/深度/指标 → 直接点击"交易"按钮 → 填数量 → 确认(看到券商名)

**差距**: 缺失步骤 2(持仓/自选)、步骤 5(一键交易)、步骤 6(券商确认)

**建议**:
1. 默认落地页改为 `持仓总览` (PortfolioSummary)
2. 任何图表右上角固定 `交易` 按钮
3. 下单确认弹窗包含: 券商名 · 市场 · 预估手续费

### 4.2 🔥 图表工具栏不可见

**当前**: KLineChartPro 有 IndicatorPanel/DrawingToolbar，但默认隐藏

**人类期望**: 类似 TradingView — 顶部工具栏始终可见(周期/指标/画线/模板)

**建议**: IndicatorPanel 改为水平工具栏嵌入 K线顶部，默认展开

### 4.3 🔥 券商选择对人类不友好

**当前**: BrokerManagerV2 要求用户配置 host/port/apiKey。人类不知道这些。

**人类期望**: 
1. "搜一下我的券商" → 自动发现(局域网OpenD/TWS)
2. "扫码连接" → QR code (富途/moomoo)
3. "手动配置" → 最后手段

**建议**: 在连接向导中集成 3 种连接方式

### 4.4 暗色主题 — 但部分组件不支持

**发现**: CHART_THEME_DARK 定义了暗色主题，但 SettingsPage/StrategyPage 等使用独立样式。

**人类影响**: 从暗色图表切到白色设置页 = 眼睛不适。

**建议**: 统一使用 CSS 变量主题色，所有组件消费同一主题 context。

### 4.5 移动端适配未完成

**发现**: R121 #46 任务未完成。small-screen 下 KLineChart 等组件不可用。

**人类影响**: iPad/折叠屏用户无法使用。

---

## 五、优先级排序

| 优先级 | 项目 | 严重程度 | 预估工时 | 人类影响 |
|--------|------|---------|---------|---------|
| 🔴 P0 | BrokerManagerV2 registerAllFactories 调用 | 致命 | 1h | 无券商可用 |
| 🔴 P0 | KLineChart 统一(删旧版) | 致命 | 2h | 图表混乱 |
| 🔴 P0 | ChartContext 接入所有15个chart组件 | 阻塞 | 4h | 面板不同步 |
| 🟡 P1 | 全局搜索(自动切换所有面板) | 功能缺失 | 4h | 切换效率 |
| 🟡 P1 | 持仓总览设为首页 | 功能缺失 | 3h | 无初始导航 |
| 🟡 P1 | 券商状态栏常驻(连接/断开/延迟) | 功能缺失 | 4h | 静默失败 |
| 🟡 P1 | 下单确认含券商名+手续费 | UX缺失 | 2h | 交易错误 |
| 🟡 P1 | 自选股 localStorage 持久化 | 功能缺失 | 2h | 重复查找 |
| 🟢 P2 | 统一暗色主题(CSS变量) | 打磨 | 4h | 视觉不连贯 |
| 🟢 P2 | 移动端适配 | 打磨 | 4h | 移动端不可用 |
| 🟢 P2 | @ts-nocheck 清零(优先核心组件) | 质量 | 80h | 类型崩溃 |
| 🟢 P2 | 指标模板保存/加载 | 打磨 | 3h | 指标重配 |
| **总计** | | | **113h** | |

---

## 六、给 PM 的行动建议

1. **P0 立即修复**(7h): BrokerManagerV2 调用 + KLineChart 统一 + ChartContext 全接入
2. **P1 短期改进**(15h): 全局搜索 + 持仓首页 + 券商状态栏 + 下单确认
3. **P2 长期打磨**(91h): 暗色主题 + 移动端 + @ts-nocheck 清零 + 指标模板

**核心原则**: 让用户打开应用就能看到自己的持仓，点一下股票就看到行情，再点一下就能交易。不要工程设计过度而人类使用体验不足。

---

*审查完成: 2026-06-12 22:23 HKT | 审查人: youdao*
