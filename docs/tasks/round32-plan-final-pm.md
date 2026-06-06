# 【PM 定案】Round 32 最终方案 — 清场 77 个失败 + Phase 4.3 PositionMonitor 骨架启动

**定案时间**: 2026-06-06 11:10 GMT+8  
**项目状态**: 1357 passed / 77 failed / 8 skipped (1442 total) | tsc 有错误  
**主题**: 先清场，再推进 — 从"条件自动"到"持仓管理"

---

## 项目现状 (11:07 实测)

### 严重 Blocker
```
❌ npx tsc --noEmit: stockStream 属性不存在 (useOpenDStream.ts)
⚠️ npm test: 1357 passed / 77 failed / 8 skipped (1442 total)
❌ 8 个测试文件失败
```

### 失败分析 (QClaw 根因分析)

| 类型 | 文件数 | 失败数 | 根因 | 修复难度 |
|------|--------|--------|------|---------|
| **A** | 4 | ~4 | 自定义 `test()` 函数覆盖 vitest 全局，无 `describe()` 包裹 | 低 |
| **B** | 1 | ~8 | `better-sqlite3` native module 未 mock，`ERR_DLOPEN_FAILED` | 中 |
| **C** | 3 | ~65 | `ipcMain.handlers` 在 jsdom 中为 undefined，IPC mock 缺失 | 中高 |

**具体文件**:
- `jvs-37-ipc-validation.test.ts` — 64 failed (类型 C)
- `jvs-49-data-versioning.test.ts` — 8 failed (类型 B)
- `integration-full-pipeline.test.ts` — ~10 failed (类型 C)
- `jvs-100-e2e.test.ts` — ~2 failed (类型 C)
- `jvs-integration.test.ts` — 1 failed (类型 A)
- `jvs-e2e-validation.test.ts` — 1 failed (类型 A)
- `ws-backfill.test.ts` — 1 failed (类型 A)
- `jvs-50-realtime-quality-monitor.test.ts` — 1 failed (类型 A)

### R31 完成情况

| 虾 | 状态 | 关键交付 |
|----|:--:|------|
| ML | ✅ | ConditionRulePanel 集成 + TradingCalendarView (368L) + Mixed E2E (10 tests) |
| JVS | ✅ | Condition→Trade 闭环桥接 + TradingCalendar 引擎 (500L) + NL TimeCondition |
| QClaw | ✅ | 测试扩量至 1442 (新增 ~955 tests) + 触发历史 IPC + 代码审计 |
| PM | ✅ | Sprint 3 启动 + Phase 4.3 路线图 |

**关键发现**: QClaw 在 R31 测试冲刺中大幅扩量（487→1442），同时发现了 Sprint 1 遗留的 8 个失败文件。这些失败是结构性问题（mock/test 结构），非业务逻辑 bug。

---

## PM 定案原则

1. **清场优先于新功能**: 77 个失败 + TypeScript 错误是最高优先级 blocker。新功能在失败基础上叠加是危险的。
2. **PositionMonitor 骨架同步启动**: 清场和骨架开发可并行，但骨架测试必须等清场完成后才能全绿。
3. **修复分工按根因类型**: QClaw 负责测试结构修复（类型 A），JVS 负责 native module（类型 B），ML 负责 IPC mock（类型 C）。
4. **务实目标**: 修复 77 个失败，新增 PositionMonitor 测试，全量 0 fail。

---

## Round 32 核心主题

**先清场，再推进: 修复 77 个失败 + PositionMonitor 骨架 + TypeScript 编译修复**

---

## 四虾任务分配

### 🦐 QClaw (3 个任务)

#### 1. [P0] Q-32-01: 修复类型 A — 自定义 test() 覆盖 (4 个文件)
**文件**:
- `tests/jvs-integration.test.ts`
- `tests/jvs-e2e-validation.test.ts`
- `tests/ws-backfill.test.ts`
- `tests/jvs-50-realtime-quality-monitor.test.ts`

**修复方案**:
- 将所有 `test(...)` 调用包裹在顶层 `describe('...', () => { ... })` 块中
- 或将局部 `test` 函数重命名为 `runTest` / `customTest` 并显式调用
- 验证 vitest 能正确发现测试套件

**验收**: 4 个文件全部通过，无 "No test suite found" 错误

#### 2. [P0] Q-32-02: 修复类型 B — better-sqlite3 mock
**文件**:
- `tests/jvs-49-data-versioning.test.ts`

**修复方案**:
- 文件顶部添加 `vi.mock('better-sqlite3', () => ({ default: vi.fn() }))`
- 返回空壳 mock，满足 import 即可

**验收**: 8 tests 全部通过，无 `ERR_DLOPEN_FAILED`

#### 3. [P1] Q-32-03: PositionMonitor + PerformanceTracker 测试骨架
- `tests/position-monitor.test.ts` (>=15 tests)
  - 止损触发 / 止盈触发 / 追踪止损 / 时间退出 / 多持仓并发
- `tests/performance-tracker.test.ts` (>=10 tests)
  - Sharpe / Sortino / Calmar / ProfitFactor / WinRate

**验收**: 25+ tests, 0 fail（在清场后验证）

---

### 🦐 JVS (3 个任务)

#### 1. [P0] J-32-01: 修复 jvs-100-e2e.test.ts
**根因**: JVS EMI handler 未注册（ipcMain.handle 缺失）

**修复方案**:
- 检查并注册缺失的 IPC handler
- 或在测试中补充 mock

**验收**: 2 tests 通过

#### 2. [P0] J-32-02: PositionMonitor 引擎骨架
**文件**: `electron/engine/position-monitor.ts` (>=500 行)

**内容**:
- `trackPosition()`: 添加持仓到监控列表
- `updatePrice()`: 接收 WS 行情更新价格
- `checkStopLoss()`: 检查止损条件
- `checkTakeProfit()`: 检查止盈条件
- `checkTrailingStop()`: 检查追踪止损
- `checkTimeExit()`: 检查持仓时间限制
- 事件发射: `stopLossHit` / `takeProfitHit` / `trailingStopHit` / `timeExitHit`

**数据结构**:
```typescript
interface MonitoredPosition {
  positionId: string;
  symbol: string;
  broker: BrokerType;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  stopLoss?: { type: 'price' | 'percent'; value: number };
  takeProfit?: { type: 'price' | 'percent'; value: number };
  trailingStop?: { distance: number; highestPrice: number };
  maxHoldTime?: number;
  entryTime: number;
  status: 'ACTIVE' | 'STOP_LOSS_TRIGGERED' | 'TAKE_PROFIT_TRIGGERED' | ...;
}
```

**验收**: 
- tsc 0 errors
- 引擎可实例化，方法可调用
- 与 TradeExecutor 事件联动

#### 3. [P1] J-32-03: PerformanceTracker 骨架
**文件**: `electron/engine/performance-tracker.ts` (>=400 行)

**内容**:
- `recordEntry()`: 记录入场订单
- `recordExit()`: 记录出场订单 + 原因
- `calculateMetrics()`: 计算绩效指标
- `getSharpe()`: Sharpe Ratio
- `getSortino()`: Sortino Ratio
- `getCalmar()`: Calmar Ratio
- `getProfitFactor()`: Profit Factor
- 按策略/券商/时间段聚合

**验收**: Sharpe/Sortino/Calmar 计算正确，10+ 测试通过

---

### 🦞 ML (3 个任务)

#### 1. [P0] ML-32-01: 修复 TypeScript 错误 + jvs-37-ipc-validation.test.ts
**TypeScript 错误**:
- `src/hooks/useOpenDStream.ts(188,33)`: `stockStream` 属性不存在
- 修复: 在 bridge-api 类型定义中添加 `stockStream` 属性，或修正 hook 中的访问方式

**jvs-37-ipc-validation.test.ts 修复**:
- 根因: `ipcMain.handlers` 在 jsdom 中为 undefined
- 方案 1（推荐）: 将 ipcMain mock 替换为带 `.handlers` 属性的完整 mock（size + Map）
- 方案 2: 跳过集成测试部分，仅保留单元测试

**验收**: tsc 0 errors，jvs-37 全部通过

#### 2. [P0] ML-32-02: 修复 integration-full-pipeline.test.ts
**根因**: Electron IPC mock 在 jsdom 中未正确 mock

**修复方案**:
- 检查并修复 IPC mock 配置
- 确保 `ipcMain.handle` 和 `ipcRenderer.invoke` 在测试环境正确 mock

**验收**: 全部通过

#### 3. [P0] ML-32-03: PositionMonitorPanel UI 组件
**文件**: `src/components/trading/PositionMonitorPanel.tsx` (>=350 行)

**内容**:
- 持仓列表: symbol / quantity / entryPrice / currentPrice / unrealizedPnl
- 颜色指示: 绿色(盈利) / 红色(亏损) / 黄色(接近止损)
- 止损止盈配置: 可编辑输入框
- 追踪止损开关 + 距离设置
- 最大持仓时间设置
- 一键平仓按钮
- 10秒自动刷新

**验收**: 组件可渲染，数据实时刷新

---

### 🦐 PM/WB (3 个任务)

#### 1. [P0] WB-32-01: R32 方案广播（本任务）
- 广播到 chat-bridge
- 写入 `docs/tasks/round32-plan-final-pm.md`

#### 2. [P0] WB-32-02: Build/Test 守护循环（0 fail 目标）
- 每 30 分钟检测
- 重点跟踪 8 个失败文件的修复进展
- 修复后验证全量 0 fail

#### 3. [P1] WB-32-03: ClosedLoopExecutor 详细设计
- 为 R33 准备详细设计文档
- `docs/roadmap/sprint2-phase4.3-closed-loop-design.md` (>=300 行)

---

## 修复优先级矩阵

| 优先级 | 任务 | 虾 | 影响 | 预计耗时 |
|--------|------|-----|------|---------|
| **P0-1** | 类型 A 修复 (4 文件) | QClaw | 4 个失败 | 20 分钟 |
| **P0-1** | 类型 B 修复 (1 文件) | QClaw | 8 个失败 | 15 分钟 |
| **P0-1** | TypeScript stockStream | ML | 编译阻断 | 20 分钟 |
| **P0-1** | jvs-37 IPC mock | ML | 64 个失败 | 30 分钟 |
| **P0-1** | integration pipeline | ML | 10 个失败 | 20 分钟 |
| **P0-1** | jvs-100 e2e | JVS | 2 个失败 | 15 分钟 |
| **P0-2** | PositionMonitor 引擎 | JVS | Phase 4.3 启动 | 60 分钟 |
| **P0-2** | PositionMonitorPanel | ML | UI 配套 | 60 分钟 |
| **P1** | PerformanceTracker | JVS | 绩效追踪 | 60 分钟 |
| **P1** | 新增测试 | QClaw | 25+ tests | 40 分钟 |

---

## 里程碑时间线

| 时间 | 目标 |
|------|------|
| 11:30 | 清场完成: 8 个失败文件全部修复 |
| 11:45 | TypeScript 0 errors |
| 12:00 | PositionMonitor 引擎 + UI 骨架完成 |
| 12:15 | 全量测试: 1440+ passed, 0 failed |
| 12:30 | R32 验收 |

---

## 验收标准

| 检查项 | 标准 |
|--------|------|
| `tsc --noEmit` | **0 errors** |
| `npm test` | **>= 1440 tests, 0 fail** |
| 8 个失败文件 | 全部修复 |
| PositionMonitor 引擎 | >=500 行，方法可调用 |
| PositionMonitorPanel | 组件可渲染，数据刷新 |
| PerformanceTracker | Sharpe/Sortino/Calmar 计算正确 |

---

## 关键决策

1. **清场优先**: R32 的首要任务是修复 77 个失败 + TypeScript 错误。任何新功能开发必须在清场之后。
2. **PositionMonitor 骨架并行**: 清场任务（mock/test 结构修复）和骨架开发（业务逻辑）互不干扰，可并行。
3. **按根因类型分工**: QClaw 负责测试结构（类型 A/B），ML 负责 IPC/TypeScript（类型 C），JVS 负责业务骨架。
4. **全量 0 fail 是硬指标**: 不接受 "只修复关键失败" 的妥协。所有失败都必须修复。
5. **QClaw 测试扩量是 R31 最大贡献**: 从 487 → 1442 的扩量发现了大量隐藏问题，这是正面收益。

---

*PM 定案完毕。各虾立即开始执行。先清场，再推进！*
