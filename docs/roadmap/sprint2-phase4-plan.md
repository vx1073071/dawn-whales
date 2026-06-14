<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: PM
purpose: (auto-generated, needs review)
-->

# Sprint 2 Phase 4 规划 — 自动化交易引擎

**规划人**: PM (WorkBuddy)
**日期**: 2026-06-06
**基于**: Sprint 2 Phase 3 收官状态 (v0.7.0)
**目标**: 从"手动交易"到"自动化执行"

---

## 背景

Sprint 2 Phase 3 完成了多券商基础设施：
- ✅ 3 家券商适配器（Futu real + Moomoo TCP + IB mock）
- ✅ 多券商 UI 集成（BrokerSelector + AccountSummary + BrokerStatusBar）
- ✅ 策略-券商绑定（按 brokerId 路由订单）
- ✅ 259 tests, 0 fail

Phase 4 的核心问题：**用户已经能在 TradingEasy 上手动交易，如何让系统自动化执行？**

---

## 目标

**构建自动化交易引擎，支持三种执行模式：**
1. **定时执行** — 按 cron 表达式定时运行策略
2. **条件触发** — 价格/指标/新闻达到条件时自动触发
3. **闭环执行** — 信号生成 → 风控检查 → 下单 → 持仓监控 → 止盈止损

---

## 里程碑

| 阶段 | 时间 | 目标 |
|------|------|-----|
| Phase 4.1 | R29-R30 | 定时执行引擎 + 任务调度器 |
| Phase 4.2 | R31-R33 | 条件触发引擎 + 实时告警联动 |
| Phase 4.3 | R34-R36 | 闭环执行引擎 + 止盈止损自动化 |
| Phase 4.4 | R37-R38 | 性能优化 + 稳定性验证 + v0.8.0 发布 |

---

## 任务分解

### Phase 4.1: 定时执行引擎 (R29-R30)

#### JVS — 后端引擎
- **J-29-01 [P0]**: CronScheduler 核心引擎
  - `electron/engine/cron-scheduler.ts`
  - 支持 cron 表达式（`0 9 * * 1-5` = 工作日 9:00）
  - 支持简单间隔（每 5 分钟 / 每小时）
  - 任务持久化（sqlite）
  - 任务状态: pending → running → completed / failed

- **J-29-02 [P0]**: StrategyRunner 策略执行器
  - 按调度计划加载策略配置
  - 执行策略信号生成
  - 调用 TradeExecutor 下单
  - 记录执行日志

- **J-30-01 [P1]**: 调度器 IPC 暴露
  - `scheduler:list` — 列出所有定时任务
  - `scheduler:create` — 创建新任务
  - `scheduler:pause/resume` — 暂停/恢复任务
  - `scheduler:delete` — 删除任务
  - `scheduler:logs` — 查询执行日志

#### ML — 前端 UI
- **ML-29-01 [P0]**: SchedulerPage 定时任务页面
  - 任务列表（名称/策略/调度/状态/下次执行）
  - 新建任务表单（策略选择 + cron 输入 + 参数）
  - 任务启停/删除操作
  - 执行日志查看

- **ML-30-01 [P1]**: Dashboard 任务概览卡片
  - 今日执行任务数
  - 最近执行结果（成功/失败）
  - 下次执行倒计时

#### QClaw — 测试 + 稳定性
- **Q-29-01 [P0]**: CronScheduler 单元测试（≥15 tests）
  - cron 表达式解析正确性
  - 任务状态机转换
  - 持久化恢复
  - 并发任务隔离

- **Q-30-01 [P1]**: 调度器压力测试
  - 100 个并发任务
  - 长时间运行稳定性（模拟 7 天）

#### PM — 规划 + 守护
- **WB-29-01 [P1]**: Phase 4.1 执行计划细化
- **WB-29-02 [P0]**: 守护循环持续执行

---

### Phase 4.2: 条件触发引擎 (R31-R33)

#### JVS — 后端引擎
- **J-31-01 [P0]**: ConditionEngine 条件引擎
  - 价格条件: `AAPL > 150`
  - 指标条件: `RSI(14) > 70`
  - 时间条件: `market_open` / `market_close`
  - 复合条件: `AAPL > 150 AND RSI < 30`

- **J-32-01 [P0]**: MarketDataWatcher 行情监听器
  - 订阅指定标的实时行情
  - 指标计算（RSI/MACD/MA）
  - 条件触发时发送 SignalEvent

- **J-33-01 [P1]**: 条件触发与 Alert 系统联动
  - 条件触发时同时发送 Alert
  - Alert 确认后可选择是否执行
  - 支持 "自动执行" 和 "手动确认" 两种模式

#### ML — 前端 UI
- **ML-31-01 [P0]**: ConditionBuilder 条件构建器
  - 可视化条件编辑（下拉选择 + 输入值）
  - 复合条件组合（AND/OR）
  - 条件预览和测试

- **ML-32-01 [P1]**: Alert → Action 联动配置
  - Alert 规则可绑定执行动作
  - 执行前确认弹窗

#### QClaw — 测试 + 性能
- **Q-31-01 [P0]**: ConditionEngine 测试（≥15 tests）
- **Q-32-01 [P1]**: 行情监听性能测试（100 标的并发）

---

### Phase 4.3: 闭环执行引擎 (R34-R36)

#### JVS — 后端引擎
- **J-34-01 [P0]**: PositionMonitor 持仓监控器
  - 实时跟踪持仓盈亏
  - 止盈止损条件检查
  - 自动平仓逻辑

- **J-35-01 [P0]**: ClosedLoopExecutor 闭环执行器
  - 信号生成 → 风控检查 → 下单 → 持仓监控 → 止盈止损
  - 状态机: idle → signal → check → order → monitor → exit
  - 异常处理: 下单失败 → 重试 → 报警 → 人工介入

- **J-36-01 [P1]**: 执行报告生成器
  - 每笔闭环交易的完整记录
  - PnL 归因分析
  - 可导出 CSV/PDF

#### ML — 前端 UI
- **ML-34-01 [P0]**: ClosedLoopStatus 闭环状态面板
  - 当前活跃闭环交易列表
  - 实时盈亏/止盈止损进度条
  - 手动干预按钮（提前平仓/修改止盈止损）

- **ML-35-01 [P1]**: 执行报告页面
  - 闭环交易历史列表
  - PnL 曲线
  - 胜率/盈亏比统计

#### QClaw — 测试 + 风控
- **Q-34-01 [P0]**: ClosedLoopExecutor 测试（≥20 tests）
- **Q-35-01 [P1]**: 异常场景测试（网络断开/券商拒绝/价格跳空）

---

### Phase 4.4: 性能优化 + 发布 (R37-R38)

#### 全员
- **全员 [P0]**: 性能回归测试（对比 Phase 3 基线）
- **全员 [P0]**: Bug 修复和稳定性验证
- **ML [P0]**: v0.8.0 Release 打包
- **PM [P0]**: v0.8.0 Release Announcement
- **PM [P1]**: Sprint 2 回顾 + Sprint 3 规划

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Automation Engine                        │
├──────────────┬──────────────┬───────────────────────────────┤
│  Cron        │  Condition   │  Closed Loop                  │
│  Scheduler   │  Engine      │  Executor                     │
├──────────────┼──────────────┼───────────────────────────────┤
│  • Cron      │  • Price     │  • Signal Gen                 │
│    parse     │  • Indicator │  • Risk Check                 │
│  • Task      │  • Time      │  • Order Exec                 │
│    queue     │  • Composite │  • Position Monitor           │
│  • Persist   │  • Alert     │  • TP/SL Auto-exit            │
│    (sqlite)  │    linkage   │  • Report Gen                 │
└──────────────┴──────────────┴───────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
            ┌─────────────┐  ┌─────────────┐
            │  Strategy   │  │  Trade      │
            │  Engine     │  │  Executor   │
            └─────────────┘  └─────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
            ┌─────────────┐  ┌─────────────┐
            │  Broker     │  │  Risk       │
            │  Manager    │  │  Engine     │
            └─────────────┘  └─────────────┘
```

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|:----:|:----:|------|
| 定时任务调度精度不足 | 中 | 中 | 使用 `node-cron` + 补偿机制，记录实际执行时间 |
| 100+ 并发行情订阅性能问题 | 中 | 高 | 分批订阅 + WS 连接池 + 降级到轮询 |
| 闭环执行异常导致资金损失 | 低 | 高 | 多重保险: 风控拦截 + 人工确认 + 紧急停止 |
| 条件触发误报率高 | 中 | 中 | 增加确认阈值 + 回测验证条件有效性 |
| sqlite 任务队列成为瓶颈 | 低 | 中 | 预留迁移到 PostgreSQL 的路径 |

---

## 验收标准

### Phase 4.1 验收 (R30)
- [ ] CronScheduler ≥ 15 tests, 0 fail
- [ ] 可创建/暂停/恢复/删除定时任务
- [ ] 任务执行日志可查询
- [ ] `npm test` ≥ 300 tests, 0 fail

### Phase 4.2 验收 (R33)
- [ ] ConditionEngine ≥ 15 tests, 0 fail
- [ ] 支持价格/指标/时间/复合条件
- [ ] Alert 联动可配置
- [ ] 100 标的并发监听性能达标

### Phase 4.3 验收 (R36)
- [ ] ClosedLoopExecutor ≥ 20 tests, 0 fail
- [ ] 完整闭环流程可跑通
- [ ] 止盈止损自动执行
- [ ] 执行报告可导出

### Phase 4.4 验收 (R38)
- [ ] v0.8.0 .exe 可用
- [ ] 性能无 >15% 退步
- [ ] 稳定性测试通过（7 天模拟）

---

## 依赖关系

```
Phase 4.1 (定时) ──────────────────────┐
                                        ├──→ Phase 4.3 (闭环)
Phase 4.2 (条件) ──────────────────────┘      │
                                        └──→ Phase 4.4 (发布)
```

Phase 4.1 和 4.2 可并行开发，Phase 4.3 依赖两者完成。

---

*本规划基于 Sprint 2 Phase 3 收官状态。实际执行中可能根据 R28/R29 进展调整优先级。*
