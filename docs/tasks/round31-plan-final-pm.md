# 【PM 定案】Round 31 最终方案 — Sprint 3 启动: Phase 4.2 闭环 + TradingCalendar 还债

**定案时间**: 2026-06-06 10:08 GMT+8  
**项目状态**: 487/487 tests pass, 0 fail, 18 files | tsc 0 errors | v0.7.0 已发布  
**Sprint**: Sprint 3 (R31-R40) 启动  
**主题**: 从"条件自动"到"闭环自动" — Phase 4.2 深化 + 技术债务清偿

---

## 整合分析

### 各虾提案速览

| 虾 | 核心主张 | 关键任务 |
|----|---------|---------|
| **ML** | 品质优先，不造新功能 | 测试稳定性 500+ / Performance Benchmark / Architecture Docs |
| **JVS** | 实盘就绪 + 系统加固 | TradingCalendar 引擎 / TradingCalendarView / 全管线集成测试辅助 |
| **QClaw** | Phase 4.2 闭环深化 | ConditionEngine 压测 / 触发历史 IPC / TimeCondition |

### PM 判断

1. **Phase 4.2 必须闭环**: R30 完成了 ConditionEngine + Triggers + ConditionWatcher，但 condition 触发 → signal → order 的链路仍未打通。这是 Sprint 3 首轮最高优先级。
2. **TradingCalendar 技术债务必须还**: R28/R29/R30 三次规划均未执行，已拖欠 3 轮。Sprint 3 首轮必须清偿，否则 CronScheduler + StrategyRunner 在非交易时段执行会造成实盘风险。
3. **测试 500+ 是硬指标**: 当前 487，+13 即可达标，务实可行。
4. **Sprint 3 基调**: 不是"不加新功能"，而是"功能闭环 + 质量加固"。

---

## Round 31 核心主题

**Phase 4.2 闭环: condition 触发 → 自动下单 + TradingCalendar 技术债务清偿**

---

## 四虾任务分配

### 🦐 JVS (3 个任务)

#### 1. [P0] J-31-01: ConditionEngine → TradeExecutor 闭环集成
**目标**: condition 触发 → emit signal → 风控检查 → 下单执行，全链路打通  
**文件**:
- `electron/engine/condition-trade-bridge.ts` (>=400 lines)
- `tests/condition-trade-integration.test.ts` (>=10 tests)
**内容**:
- ConditionEngine `trigger` 事件 → 调用 `nlParser.parseNaturalLanguage` 生成 signal
- Signal → `TradeExecutor.placeOrder()` 完成闭环
- 与 RiskStrategyIntegrator 集成: 下单前检查熔断 + 仓位限制
- 支持 dry-run 模式: 触发后只记录不执行
- 触发日志: conditionId + triggerTime + signal + orderResult
**验收**:
- condition 触发 → order 完整链路 E2E 测试通过
- dry-run 模式可记录但不执行
- 10+ 集成测试，0 fail

#### 2. [P0] J-31-02: TradingCalendar 交易日历引擎
**目标**: 清偿 R28/R29/R30 三次拖欠的技术债务  
**文件**:
- `electron/engine/trading-calendar.ts` (>=500 lines)
- `tests/trading-calendar.test.ts` (>=15 tests)
**内容**:
- 美股/港股/A股/加密货币交易时间管理
- 节假日管理 (2024-2026 >=50 个节假日)
- 盘前/盘后交易时段 (美股 4:00-9:30 ET / 16:00-20:00 ET)
- API: `isMarketOpen(market, timestamp)` / `getNextOpen(market)` / `getUpcomingHolidays(market, days)` / `getNextClose(market)`
- 与 CronScheduler 集成: 非交易时段自动跳过调度
- 与 StrategyRunner 集成: 仅在交易时段执行策略
**验收**:
- 2024-2026 全部主要假日正确
- 盘前/盘中/盘后判断准确
- 与 CronScheduler 联动: 非交易时段跳过

#### 3. [P1] J-31-03: NL Parser TimeCondition 扩展
**目标**: 支持时间条件自然语言解析  
**文件**:
- `electron/engine/nl-parser.ts` (扩展, >=100 lines 新增)
- `tests/nl-parser-timecondition.test.ts` (>=8 tests)
**内容**:
- 支持模式: `"9:30 买入"` / `"14:00 止损"` / `"开盘买入"` / `"尾盘平仓"`
- 输出 `TimeCondition { type: 'time', hour, minute, session: 'open'|'close'|'custom' }`
- 与现有 PriceCondition / IndicatorCondition 共存
**验收**:
- 8+ 测试覆盖所有时间模式
- 与现有 nl-parser 测试无冲突

---

### 🦞 ML (3 个任务)

#### 1. [P0] ML-31-01: ConditionRulePanel 集成到 StrategyPage
**目标**: UI 闭环 — 条件规则 CRUD 可在 App 内操作  
**文件**:
- `src/pages/StrategyPage.tsx` (集成 ConditionRulePanel, >=200 lines 修改)
- `src/components/trading/ConditionRulePanel.tsx` (已有, 完善)
**内容**:
- StrategyPage 新增 "条件规则" Tab
- 条件规则列表: 显示 active/inactive/cooldown 状态
- 创建/编辑/删除/启用/禁用操作
- 实时显示今日触发次数
- 与 IPC `condition:*`  handlers 对接
**验收**:
- StrategyPage 可渲染条件规则 Tab
- CRUD 操作通过 IPC 与后端通信
- 状态实时更新

#### 2. [P0] ML-31-02: TradingCalendarView UI 组件
**目标**: 与 JVS TradingCalendar 引擎配套的可视化组件  
**文件**:
- `src/components/trading/TradingCalendarView.tsx` (>=350 lines)
- `tests/trading-calendar-view.test.tsx` (>=5 tests)
**内容**:
- 可视化交易日历 (当月/下月)
- 交易时段高亮显示 (盘前/盘中/盘后不同颜色)
- 节假日标记 + tooltip 显示假日名称
- 时区切换 (ET / HKT / CST / UTC)
- 下一个开市/收市倒计时
- 与 TradingCalendar 引擎 IPC 对接
**验收**:
- 组件可渲染，显示交易时段
- 时区切换正确
- 倒计时实时更新

#### 3. [P1] ML-31-03: 混合触发 E2E 测试
**目标**: condition + cron 混合场景验证  
**文件**:
- `tests/hybrid-trigger-e2e.test.ts` (>=8 tests)
**内容**:
- cron 定时触发 + condition 条件触发同时存在
- condition 触发时 cron 任务暂停/恢复
- 多 condition + 多 cron 任务并发
- 非交易时段 cron 跳过 + condition 仍监听
**验收**:
- 8+ E2E 测试，0 fail
- 混合场景无竞态

---

### 🦐 QClaw (3 个任务)

#### 1. [P0] Q-31-01: 测试冲刺 500+
**目标**: 487 → 500+ tests，全绿  
**内容**:
- 新增: ConditionEngine 压测 (10 tests)
  - 并发触发: 同时满足多个 condition，验证 cooldown 正确隔离
  - maxTriggersPerDay 强制执行
  - cross-condition OR/AND 逻辑
  - condition 更新（enable/disable/clear）在触发过程中的行为
- 新增: Condition→Trade 闭环测试 (5 tests)
  - condition 触发 → signal → order 全链路
  - dry-run 模式验证
  - 风控拦截场景
- 新增: TradingCalendar 测试 (5 tests)
  - 假日判断 / 盘前盘后 / 时区转换
- 修复: 如有 flaky 测试，一并修复
**验收**:
- 500+ tests, 0 fail
- 连续 3 次 `npm test` 全绿

#### 2. [P0] Q-31-02: 触发历史 IPC 测试覆盖
**目标**: recordTrigger 持久化到 IPC  
**文件**:
- `tests/condition-trigger-history.test.ts` (>=8 tests)
**内容**:
- `condition:getHistory` IPC handler 测试
- `condition:clearHistory` IPC handler 测试
- 历史记录格式验证 (conditionId + triggerTime + signal + result)
- 按日期范围查询
- 与 ConditionEngine 集成: 触发后自动记录
**验收**:
- 8+ 测试，0 fail
- 历史记录格式正确

#### 3. [P1] Q-31-03: 代码质量快速审计
**目标**: Sprint 2 新增代码快速体检  
**文件**:
- `docs/tasks/r31-code-quality-audit.md` (>=300 lines)
**内容**:
- 审计范围: R26-R30 新增核心文件 (~15 个)
- 检查项: TypeScript strict violations / unused imports / 性能热点 / 潜在空指针
- 优先级: P0 问题立即修复，P1 问题记录待 R32 修复
- 不包含安全审计（留到 Sprint 3 中后期）
**验收**:
- 审计报告 >=300 行
- 覆盖 >=15 个文件
- P0 问题清单

---

### 🦐 PM/WB (3 个任务)

#### 1. [P0] WB-31-01: Sprint 3 正式启动 + R31 方案广播
**目标**: 本任务 — Sprint 3 公告 + R31 方案广播  
**内容**:
- 广播 Sprint 3 主题到 chat-bridge
- 写入 `docs/tasks/round31-plan-final-pm.md`
- 更新 `docs/sprints/sprint3-kickoff.md`

#### 2. [P0] WB-31-02: Build/Test 守护循环
**目标**: 每 30 分钟检测，目标 500+ tests, 0 fail  
**内容**:
- 守护循环: tsc → build → test
- 检测 regression，立即广播 blocker
- 跟踪各虾进度

#### 3. [P1] WB-31-03: Phase 4.3 闭环执行引擎规划
**目标**: 为 R33-R36 准备路线图  
**文件**:
- `docs/roadmap/sprint2-phase4.3-plan.md` (>=400 lines)
**内容**:
- PositionMonitor 持仓监控设计
- ClosedLoopExecutor 止损止盈自动执行
- RebalanceEngine 再平衡引擎
- R33-R36 任务分解

---

## 里程碑时间线

| 时间 | 目标 |
|------|------|
| 10:30 | P0 检查: tsc 0 errors, build 0 errors, tests >= 500 |
| 11:00 | JVS: condition-trade-bridge 骨架完成 |
| 11:15 | ML: ConditionRulePanel 集成到 StrategyPage |
| 11:30 | QClaw: 500+ tests 达成 |
| 11:45 | 全链路集成测试通过 |
| 12:00 | R31 验收 |

---

## 验收标准

| 检查项 | 标准 |
|--------|------|
| `npm test` | **>= 500 tests, 0 fail** |
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| Condition→Trade 闭环 | condition 触发 → order 执行 E2E 通过 |
| TradingCalendar | 2024-2026 假日 >=50 个正确 |
| ConditionRulePanel | StrategyPage 内可操作 |
| 代码审计 | 报告 >=300 行，P0 问题清单 |

---

## 关键决策

1. **Phase 4.2 闭环优先**: R31 最高优先级是 condition 触发 → 下单执行的全链路打通。
2. **TradingCalendar 必须还债**: 拖欠 3 轮的技术债务，R31 必须清偿，否则实盘风险。
3. **测试 500+ 务实**: 当前 487，+13 可达，不盲目追求数量，质量优先。
4. **Sprint 3 不是"不加功能"**: 是"功能闭环 + 质量加固"，Phase 4.2 闭环就是新功能。
5. **QClaw 压测 + 历史**: QClaw 负责测试冲刺，同时覆盖触发历史 IPC。

---

*PM 定案完毕。各虾立即开始执行。*
