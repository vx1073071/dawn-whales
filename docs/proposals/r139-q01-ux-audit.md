# R139-Q01 — 跟单UX审计: 模拟/死信/分润/日志

> **Author**: QClaw · **Round**: R139 · **Date**: 2026-06-13 09:45 HKT
> **Task**: R139 UX审计(模拟/死信/分润/日志) — 3h
> **Scope**: 4个R139交付领域 + 试算/撤单Wireframe + 暂停规则UI

---

## 审计总览

| 领域 | 引擎层 | IPC层 | Store层 | UI层 | 整体 |
|------|--------|-------|---------|------|------|
| 模拟跟单 | ✅ PaperTrader (532L) | ❌ 未注册 | ❌ 未接入 | ❌ 无独立UI | 🔴 30% |
| 死信队列 | ✅ 4文件完整 | ✅ dead-letter-ipc | ❌ 未接入Store | ✅ DeadLetterPanel | 🟡 65% |
| 分润结构 | ✅ revenue-engine-v15 | ❌ 未注册 | ❌ 硬编码 | ✅ ProfitSplitVisualizer(573L) | 🟡 60% |
| 跟单日志 | ❌ 无引擎 | ❌ 未注册 | ❌ 未接入 | ⚠️ 100% Mock数据 | 🔴 20% |
| 暂停规则 | ❌ 引擎侧无 | ❌ 未注册 | ⚠️ localStorage独立 | ✅ PauseRulesPanel(411L) | 🟡 55% |
| 试算+撤单 | ❌ 未实现 | ❌ 未实现 | ❌ 未实现 | ❌ 仅有Wireframe | 🔴 5% |

---

## 一、模拟跟单 (Paper CopyTrade)

### 现状

| 层 | 文件 | 状态 |
|----|------|------|
| 引擎 | `electron/engine/backtest/paper-trader.ts` (532L) | ✅ 完整: PaperTrader类+PaperAccount/Fill/Trade/Performance/Report |
| IPC | `electron/ipc/broker-ipc-v2.ts` | ❌ 0提及paper — 无通道注册 |
| Store | `src/stores/copyTradeStore.ts` | ❌ 0提及paper — mode仅'fixed'/'ratio' |
| UI | — | ❌ 无PaperTradingPanel独立组件 |
| 测试 | `tests/chart/r139-paper-dl-pause.test.ts` | ⚠️ 4个占位测试(expect(true).toBe(true)) |

### 发现 (按严重度)

🔴 **P0-1: PaperTrader引擎与跟单链路完全割裂**
- `PaperTrader` 初始化 `initPaperTrader()` → 仅存在于 backtest 模块，不在 broker 适配器注册表
- 无 IPC 通道能从 UI 启动/停止/查询模拟跟单
- `copyTradeStore` 的 `mode` 字段语义为成交量模式(`fixed`/`ratio`)，不是实盘/模拟模式

🔴 **P0-2: 模拟→实盘切换无流程**
- Y01.4 测试仅检查 `mode = 'live'` 布尔切换
- 无: 确认弹窗 / 收益对比 / 风控差异 / 历史清理 / 券商重连

🟡 **P1: Paper覆盖范围极窄**
- 仅支持 crypto 回测，不涉及港股/美股模拟
- `PaperFill` 无 fee/slippage 模拟
- `PaperPerformance` 无 sharpe/maxDrawdown

**建议修复 (5h)**:
1. `copyTradeStore` 新增 `mode: 'live'|'paper'` ✅(CopyTradeStore.types.ts 已定义，但未实现)
2. 注册 IPC: `copytrade:paper:start/stop/status/report`
3. PaperTradingPanel UI: 模拟账户总览+切换确认弹窗
4. 接入 youdao E2E (4 tests) — 需从占位测试升级为真实流程

---

## 二、死信队列 (Dead Letter)

### 现状

| 文件 | 行数 | 功能 |
|------|------|------|
| `electron/engine/data/dead-letter-store.ts` | 289L | SQLite 持久化 + TTL清理 |
| `electron/ipc/dead-letter-ipc.ts` | 109L | 6个IPC通道注册 |
| `electron/workers/dead-letter-queue.ts` | 83L | Worker线程重试队列 |
| `server/middleware/dead-letter.ts` | 156L | Express中间件捕获+写入 |
| `src/pages/Admin/DeadLetterPanel.tsx` | 443L | Admin面板(分类/重试/删除) |
| `src/stories/DeadLetterPanel.stories.tsx` | — | Storybook |
| 测试 | e2e 占位 | Y02.1-3 3个简单断言 |

### 发现

🟡 **P1-1: CopyTradeHub 无死信角标**
- DeadLetterPanel 在 `src/pages/Admin/` — 用户路径不经过 Admin
- CopyTradeHub 7个Tab 中无"死信"Tab
- `useCopyTradeStore` 无 `deadLetterCount` 字段
- JVS R139-J01 需: WS推送 → Store更新 → CopyTradeHub badge

🟡 **P1-2: 死信分类未体现在跟单UI**
- DeadLetterPanel 按 `reason` 分类 (network_timeout/insufficient_balance/api_key_expired)
- 但 CopyTradeNotifications **不显示死信原因** — 它的 `NotificationType` 为 `order_failed/error`
- 用户看到"订单失败"但不知道是因为网络、余额还是密钥

🟢 **P2: 死信重试无手动触发**
- Worker自动重试但无用户手动重试按钮

**审计结论**: 死信基础设施完整(✅)，但未与跟单主UI链路打通(❌)。JVS R139-J01 修复后应达到 P0 级。

---

## 三、分润结构 (Profit Split)

### 现状

`ProfitSplitVisualizer.tsx` (573L) — 视觉优秀但数据完全硬编码:
- Donut Ring + SplitBar 图表 ✅
- 3档TierCard (平台/信号源/跟单者) ✅
- ScenarioSimulator (滑块模拟收益) ✅
- ProviderFeeTable ✅
- 计算公式展示 ✅

### 发现

🟡 **P1-3: 10/15/75 硬编码，不可配置**
```typescript
const TIERS = [plat:10, provider:15, copier:75];  // hardcoded
```
- `revenue-engine-v15.ts` 有完整的分润引擎（L1-L3创作者分级），但 UI 不使用它
- USDT 积分系统有真实费率，但 Visualizer 不读取
- 切换信号源的 L1/L2/L3 等级后，分润比例不变

🟡 **P1-4: ScenarioSimulator 无下限约束**
- `profit=100` → `platform=$10, provider=$15, copier=$75` → 低于最小提现金额也正常显示
- 无"盈利为负不分润"逻辑 — 亏损时仍计算分润

🟢 **P2: ProviderFeeTable 数据硬编码**
```typescript
SIGNAL_PROVIDERS = [AlphaQuant, TrendMaster, DeepSignal, QuantumEdge]  // 4个写死
```

**建议**: ML R139-M03 接入真实 revenue-engine + 实时信号源数据。

---

## 四、跟单日志 (CopyTradeLog)

### 现状

| 文件 | 行数 | 替换度 |
|------|------|--------|
| `TradeHistoryPanel.tsx` | 272L | 100% MOCK (8条硬编码) |
| `TradeHistoryPage.tsx` | 253L | 100% MOCK |
| `CopyTradeStatusBar.tsx` | 341L | 100% MOCK |

### 发现

🔴 **P0-3: 无CSV导出**
- PM Spec: "CopyTradeLog跟单日志页面(时间线/筛选/CSV)"
- 当前: 0行CSV导出代码
- TradeHistoryPanel 有完整的筛选+排序+详情弹窗，但缺最关键的一步

🔴 **P0-4: 数据源100% Mock**
- `MOCK_TRADES: TradeRecord[]` 8条写死
- 无 IPC 通道读取真实历史: `copytrade:executions:list` 定义在 `CopyTradeStore.types.ts` 但未注册
- `Server` 端的 `copy_trades` 表有数据但 UI 不读取

🟡 **P1-5: 两个TradeHistory组件并存**
- `TradeHistoryPanel.tsx` (broker/) — 跟单专用
- `TradeHistoryPage.tsx` (trading/) — 通用交易
- 字段重叠 80% 但各自独立维护
- 前者在 CopyTradeHub Tab#4，后者未接入 Hub

🟡 **P1-6: 时间线视图无信号关联**
- 每条交易记录有 `signalId` 但时间线上不显示原始信号价格/置信度
- 用户无法回看"信号说买$92K，实际成交$92.1K"

**建议**: ML R139-M02 必须打通真实数据+CSV导出。

---

## 五、暂停规则 (Pause Rules)

### 现状

`PauseRulesPanel.tsx` (411L) — UI 设计优秀但数据层孤岛:
- 3条规则(日亏损/连亏/回撤) + 冷却 + 自动恢复 ✅
- 断路器状态展示 ✅
- 实时统计数据仪表板 ✅
- 滑块/开关交互 ✅
- ⚠️ 100% localStorage 独立存储 (`dw:ct:pauseRules`)
- ⚠️ 断路器状态 mock (`breaker.dailyLoss = 234.5`)
- ⚠️ 不在 `copyTradeStore` 中

### 发现

🟡 **P1-7: PauseRules 未接入 Zustand Store**
- `copyTradeStore` 已有 `killSwitch/config/soundEnabled/offlineConfig`
- 但 PauseRulesPanel 仍用独立 `useState` + `localStorage.setItem('dw:ct:pauseRules')`
- Store 的 `partialize` 也不持久化暂停规则 — 用户重开App丢失配置

🟡 **P1-8: 无引擎层暂停逻辑**
- CopyTradeExecutor 有 CircuitBreaker 但仅检查 `this.breakers` Map
- 不读取 UI 设置的暂停规则
- 无 IPC 双向同步: UI改了 → 引擎不知道 / 引擎触发 → UI不更新

🔴 **P0-5: 冷却倒计时纯前端**
- `breaker.cooldownUntil` 是 mock 时间戳
- 无 `setInterval` 倒计时刷新
- 用户看到"冷却至 08:30"但页面静止不动，不倒数

**建议**: pauseRules 迁移入 Zustand Store + IPC双向同步 + 实时倒计时。

---

## 六、试算弹窗+撤单 (R139-M04 Spec)

### Wireframe Spec 分析

`docs/design/order-preview-cancel-wireframe.md` (5060B) — 设计清晰:

**OrderPreviewModal** 规范:
- 费用明细: 预估总价/佣金/SEC费/平台费/分润
- 5秒倒计时 → [确认下单]可点击
- 分润仅在盈利时显示
- 市场价波动警告

**撤单交互**:
- 待处理信号列表 → [撤单]按钮 → 确认弹窗 → PATCH /api/signal/:id/cancel
- 自动/手动两种模式切换

### 发现

🔴 **P0-6: 全部代码未实现**
- `src/components/signal/OrderPreviewModal.tsx` — 不存在
- `executeWithPreview()` hook — 不存在
- `cancelOrderConfirm()` hook — 不存在
- `PATCH /api/signal/:id/cancel` — server端未确认是否有路由
- 5秒倒计时 UI — 未实现
- 自动/手动模式切换 — 未实现

🟡 **P1-9: 分润计算逻辑需动态化**
```
Wireframe中的 calculatePreview() 是硬编码
实际应调用 server 的分润引擎: 平台费率随券商/市场/信号源等级不同
```

---

## 七、修复优先级汇总

### 🔴 P0 (阻塞跟单完整流程)

| ID | 问题 | 修复方向 | 负责 | 工时 |
|----|------|---------|------|------|
| P0-1 | PaperTrader与跟单链路割裂 | IPC+Store+UI | JVS/ML | 5h |
| P0-2 | 模拟→实盘切换无流程 | 确认弹窗+对比 | ML | 2h |
| P0-3 | 0行CSV导出 | TradeHistory增加CSV | ML R139-M02 | 1h |
| P0-4 | 日志100% Mock | 接入copytrade:executions IPC | ML R139-M02 | 2h |
| P0-5 | 冷却倒计时不倒数 | setInterval实时刷新 | ML | 0.5h |
| P0-6 | 试算+撤单0代码 | 按Wireframe实现 | ML R139-M04 | 3h |

### 🟡 P1 (用户体验缺陷)

| ID | 问题 | 修复方向 | 工时 |
|----|------|---------|------|
| P1-1 | CopyTradeHub无死信角标 | WS→Store→Badge | 1h |
| P1-2 | 死信原因不显示 | NotificationType增加分类 | 0.5h |
| P1-3 | 分润比例硬编码 | 接入revenue-engine | 2h |
| P1-4 | ScenarioSimulator无下限约束 | 亏损过滤+最小值 | 0.5h |
| P1-5 | 两个TradeHistory并存 | 合并为TradeHistoryPanel统一 | 1h |
| P1-6 | 时间线无信号关联 | 每条记录显示原始信号 | 0.5h |
| P1-7 | PauseRules未入Store | 迁移入Zustand | 1h |
| P1-8 | 引擎层无暂停逻辑 | IPC双向同步 | 2h |
| P1-9 | 分润计算不动态 | 服务端API | 1h |

### 🟢 P2 (视觉/体验打磨)

| ID | 问题 | 工时 |
|----|------|------|
| P2-1 | Paper覆盖范围窄(仅crypto) | 3h |
| P2-2 | 死信无手动重试按钮 | 0.5h |
| P2-3 | ProviderFeeTable硬编码 | 0.5h |

---

## 八、总评

| 评估维度 | 分数 | 评语 |
|---------|------|------|
| 视觉设计 | 85% | ProfitSplit/PauseRules/TradeHistory UI设计优秀 |
| 数据真实性 | 25% | 4/5面板100% Mock，只有DeadLetterPanel有真数据 |
| 链路完整性 | 30% | 引擎存在但IPC/Store/UI三层断裂 |
| 用户完整流程 | 20% | 模拟→死信→分润→日志→暂停→试算: 6步中0步完整 |
| R139交付信心 | 60% | ML 13h+JVS 7h 可通过但需严格按优先级执行 |

**结论**: R139 的6个核心功能，基础设施(引擎/类型/设计)已就绪70%，但数据链路(IPC+Store+API)和真实数据接入仅30%。PM的13h给ML + 7h给JVS 是有余量的，但ML必须优先完成 P0-3/P0-4/P0-6（日志CSV+试算撤单），JVS必须优先 P0-1（PaperTrader链路打通）。

---

> **Signed**: QClaw — R139-Q01 UX审计
