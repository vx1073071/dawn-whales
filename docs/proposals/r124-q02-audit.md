# R124-Q02: 交互逻辑代码审查

> **Author**: QClaw · **Task**: R124-Q02 · **Hours**: 3h
> **Date**: 2026-06-13 02:05 HKT
> **Coverage**: R123 ML + JVS 交付, R124 JVS 交付, R124 ML 待交付

---

## 1. TSC 基线

| 指标 | 值 |
|------|-----|
| TSC errors | **0** ✅ |
| @ts-nocheck 残留 | 5核心已清1, ~150全局待清 |
| 新增组件 (R123→R124) | 10 (+DataFreshnessIndicator / SignalShareComponents) |

---

## 2. JVS R123 交付审计 (4/4 全部交付)

### BrokerStatusBar.tsx (142L) ✅
**验收项**: P1-4 券商状态栏常驻
- **三态渲染**: 🟢connected / 🟡connecting / 🔴disconnected + ⚠️reconnecting
- **轮询**: 5s级 `setInterval(fetchStatus)` → `api.broker.getStatus()`
- **桌面通知**: disconnect时调用 `new Notification()` ✅
- **⚠️ 发现**: 轮询在浏览器后台tab时仍运行，可能浪费资源
- **⚠️ 发现**: `api.broker.getStatus()` 返回 `result.statuses` (复数)，但PM spec是单数 `getStatus`

### SignalDashboard.tsx (172L) ✅
**验收项**: P1-11 信号提供者+持仓总览
- **ProviderCard**: 信号提供者概览 (return30d/winRate/sharpe/followerCount)
- **HoldingsPanel**: 当前持仓列表 (symbol/side/quantity/pnl)
- **⚠️ 发现**: 数据源=`(window as any).api.signalDashboard?.getData()` — 新IPC通道未在ipc-setup注册

### OrderConfirmModal.tsx (178L) ✅
**验收项**: P1-5 下单确认弹窗
- **展示**: 券商名 + symbol/方向/数量/价格 + 预估手续费 + 确认/取消按钮
- **确认图标**: ✅确认 ↑ / ❌取消, 符合PM spec
- **⚠️ 发现**: 预估手续费 `estimatedFee` 为固定展示，非实时计算

### NotificationHistoryPanel.tsx (282L) ✅
**验收项**: P1-12 通知历史存储+静音模式
- **通知列表**: 时间排序，按级别分组 (info/warning/critical)
- **静音模式**: 切换开关 `setMuted(true/false)`
- **⚠️ 发现**: 通知存储在组件状态中，刷新页面后丢失

---

## 3. JVS R124 交付审计 (2/2 全部交付)

### DataFreshnessIndicator.tsx (161L) ✅⭐
**验收项**: P1-8 数据陈旧指示器
- **4态**: live(<2s)/recent(2s-5min)/stale(>5min)/offline(无数据) ✅ 完全符合spec
- **IPC监听**: `broker:quote-push` / `ws:data-push` / `cache:data-load`
- **每秒更新**: `setInterval(compute, 1000)` — refresh rate合理
- **compact/full模式**: `compact` prop切换紧凑/详细视图
- **⚠️ 发现**: `onCache` 闭包捕获 `lastUpdateAt`，但 `lastUpdateAt` 在 `useEffect` deps中，可能导致重复subscribe/ unsubscribe

### SignalShareComponents.tsx (519L) ✅⭐
**验收项**: P1-13 信号分享功能
- **5组件**: SignalShareButton / SignalShareModal / SignalPreviewCard / CopyTradeConfirmModal / CopyTradeHistory
- **分享链接**: `quant-moo://signal/{token}` deep link ✅
- **社交分享**: Telegram / Twitter / 复制链接
- **QR占位**: 有QR区域但无实际QR渲染 (skeleton UI)
- **⚠️ 发现**: `window.open()` 在Electron中会打开外部浏览器，但deep link `quant-moo://` 无法在Twitter/Telegram直接打开
- **⚠️ 发现**: `liveUpdate` toggle存在但未实现实时push更新

---

## 4. ML R123 交付回顾 (已在R123-Q02审计)

| 组件 | 状态 | R123发现 |
|------|------|---------|
| OnboardingWizard | ✅ | credentials明文 / 无防抖 |
| ChartContextMenu | ✅ | K线下单未检broker态 |
| GlobalSearch | ✅ | 硬编码搜索数据 |
| SymbolLink | ✅ | — |

---

## 5. ML R124 待交付 (4/5 tasks pending)

| Task | 预计 | 依赖 |
|------|------|------|
| M01: 自选拖拽排序 | 3h | ChartStore持久化 |
| M02: 键盘快捷键 | 2h | 无 |
| M03: 交易流程重构 | 3h | OrderConfirmModal + BrokerStatusBar |
| M04: K线下单面板 | 2h | ChartContextMenu + OrderConfirmModal |
| M05: 自动刷新开关 | 2h | DataFreshnessIndicator |

**建议**: M03交易流程直接串联 BrokerStatusBar → OrderConfirmModal → PositionMonitor，形成完整链路。

---

## 6. 发现总结

### ✅ 已交付 (R123+R124 JVS: 6/6)
全部JVS任务按时交付，组件质量高，结构清晰。

### ⚠️ P1 (本轮关注)
1. **SignalDashboard IPC通道未注册** — `signalDashboard`.`getData()` 在ipc-setup中无对应handler
2. **NotificationHistory 无持久化** — 通知存在React state中，刷新丢失
3. **SignalShare QR未实现** — QRUI占位但无实际生成

### 🔧 P2 (后续改进)
4. BrokerStatusBar 后台轮询资源浪费
5. OrderConfirmModal 手续费非实时计算
6. DataFreshnessIndicator useEffect deps可能导致重复订阅
7. SignalShare `liveUpdate`切换无实际实现

---

## 7. R124 验收矩阵

| 验收项 | 负责人 | 状态 |
|--------|--------|------|
| Q01 @ts-nocheck Batch1 | QClaw | ✅ 完成 |
| Q02 审计 | QClaw | ✅ 本交付 |
| J01 数据陈旧指示器 | JVS | ✅ 已提交 |
| J02 信号分享 | JVS | ✅ 已提交 |
| M01-M05 交互核心 | ML | ⏳ 待交付 |
| Y01-Y03 E2E | youdao | ⏳ 待交付 |

---

> **QClaw Sign-off**: R124-Q02 complete — TSC 0, 10 new components audited, JVS 6/6 delivered, 3 P1 + 4 P2 findings
