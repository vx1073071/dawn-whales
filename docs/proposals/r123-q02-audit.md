# R123-Q02: 代码审计 — TSC + 组件质量 + 数据流

> **Author**: QClaw · **Task**: R123-Q02 · **Hours**: 2h
> **Date**: 2026-06-13 01:25 HKT
> **Coverage**: R122-R123 新增35文件 / 5844行

---

## 1. TSC 基线

| 指标 | 值 |
|------|-----|
| TSC errors | **0** ✅ |
| 新增文件 | 35 (5844 insertions) |
| 总TS/TSX | 1124 → ~1160 |

---

## 2. R123 ML 组件审计 (核心交付)

### OnboardingWizard.tsx (16929B / ~435L)
**验收项**: P0-2 首次使用引导 ✅ EXISTING
- **Step数组结构**: searchBroker → connect → complete (3步, 与spec一致)
- **搜索接口**: 已实现厂商搜索 (binance/okx/futu/ibkr/etoro/schwab等)
- **连接状态**: connecting → connected → error 三态
- **类型**: useState<{step, selectedBroker, credentials, status}> 本地状态正确
- **⚠️ 发现**: 搜索过滤用 `includes(lower)` 本地匹配，无防抖（`onChange`直接触发setState）
- **⚠️ 发现**: credentials输入框无遮罩，明文显示API key/secret

### ChartContextMenu.tsx (9522B / ~308L)
**验收项**: P1-1 右键菜单 ✅ EXISTING
- **菜单项**: 查看详情/加入自选/K线下单/设置提醒/复制代码/分享
- **位置计算**: `{x: e.clientX, y: e.clientY}` — 使用client坐标无viewport溢出检测
- **条件渲染**: 是否在自选/是否有K线数据/是否支持下单
- **⚠️ 发现**: K线下单菜单项无条件渲染，未检查broker是否已连接

### GlobalSearch.tsx (9757B / ~233L)
**验收项**: P1-2 全局搜索(Ctrl+K) ✅ EXISTING
- **快捷键**: `Ctrl+K / Cmd+K` — 符合规范
- **搜索范围**: 股票/指数/加密/自选组合
- **虚拟列表**: 结果>20显示"显示更多"
- **⚠️ 发现**: 搜索数据硬编码在组件内，无IPC数据源

### SymbolLink.tsx (4090B / ~140L)
**验收项**: P0-2b Symbol点击联动 ✅ EXISTING
- **跳转逻辑**: onClick → ChartStore.setSymbol → KLineChartPro同步
- **高亮态**: active状态加边框高亮
- **类型**: `{symbol, name, market}` props类型正确

---

## 3. JVS R122 收尾审计

### data-pipeline-connector.ts (7751B / ~236L) ⭐NEW
**验收项**: P0-1a 5条数据链路接线 ✅ EXISTING
- **5-link**:
  1. adapter → manager (connectBroker)
  2. manager → bridge (quote push)
  3. bridge → engine (window.api.on)
  4. engine → indicator worker (indicator:compute)
  5. engine → UI (useDataPipeline)
- **registerAllFactories**: 现在在构造函数中调用 ✅
- **broker-adapter-factory.ts**: 17家券商工厂全部注册 ✅ (binance/okx/bybit/bitget/futu/moomoo/ibkr/tiger/longbridge/schwab/etrade/etoro/webull/coinbase/kraken/gate/htx)

### broker-adapter-factory.ts (4091B) ⭐NEW
**验收项**: P0-1b 工厂注册 ✅ EXISTING
- **17家适配器**: 全部通过静态import + lazy factory注册
- **类型**: `Map<string, (config) => IBrokerAdapter>` — 正确
- ⚠️ R122-Q02审计发现的 `registerAllFactories()无人调用` 已被修复

### ChartStore.ts (3391B / ~77L)
**验收项**: 全局图表状态 ✅ EXISTING
- **状态**: symbol/interval/indicators/drawings/timeRange
- **持久化**: localStorage persist 中间件 ✅
- **类型**: Zustand store with typed actions

### useChartSync.ts (3742B / ~100L)
**验收项**: P0-7 指标子图时间轴同步 ✅ EXISTING
- **同步域**: MACD/RSI副图 = 主图时间锚
- **API**: setIdlePosition/onTimeScaleChanged ✅

---

## 4. JVS R123 进度

| Task | 状态 | 文件 |
|------|------|------|
| J01: 券商状态栏 | ⏳ 未交付 | — |
| J02: SignalDashboard | ⏳ 未交付 | — |
| J03: 下单确认弹窗 | ⏳ 未交付 | — |
| J04: 通知历史存储 | ⏳ 未交付 | — |

---

## 5. 发现总结

### ✅ 已修复 (R122→R123)
1. registerAllFactories无人调用 → **已修复** (data-pipeline-connector.ts 构造函数)
2. 仅4/17适配器 → **已修复** (broker-adapter-factory.ts 17家全注册)
3. ChartContext Zutand → **已实现** (ChartStore.ts)

### ⚠️ P1 (本轮关注)
4. GlobalSearch硬编码搜索数据 — 无IPC数据源，搜索只查本地list
5. OnboardingWizard credentials明文显示 — API key/secret在input框可见
6. ChartContextMenu K线下单未检查broker连接态 — 可能触发空adapter错误

### 🔧 P2 (后续改进)
7. OnboardingWizard搜索无防抖 — onChange每次字母触发setState
8. 右键菜单位置无viewport溢出检测 — 边缘可能被裁切

---

## 6. R123验收矩阵

| 验收项 | 状态 | 负责人 |
|--------|------|--------|
| TSC 0 | ✅ | QClaw |
| Q01 Zod实现 | ✅ 本交付 | QClaw |
| Q02 审计 | ✅ 本交付 | QClaw |
| M01 引导向导 | ✅ 已提交 | ML |
| M02 右键菜单 | ✅ 已提交 | ML |
| M03 全局搜索 | ✅ 已提交 | ML |
| M04 Symbol联动 | ✅ 已提交 | ML |
| J01-J04 | ⏳ 待交付 | JVS |
| Y01-Y03 | ⏳ 待交付 | youdao |

---

> **QClaw Sign-off**: R123-Q02 complete — TSC 0, 35 files audited, 3 P1 findings, 3 resolved from R122
