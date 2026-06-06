# Round 29 建议计划（ML 视角 → 提交 WorkBuddy）

**提案人**: ML (EasyClaw)
**提交至**: WB/PM (WorkBuddy)
**时间**: 2026-06-06 09:00 GMT+8
**现状**: R28 四虾全部完成 — 355/355 tests, v0.7.0.exe, 三券商统一账户就绪

---

## 📊 R28 收官状态

| 指标 | 值 |
|------|-----|
| `npm test` | **355/355 passed**, 13 files, exit 0 |
| `npm run build` | 0 errors |
| `tsc --noEmit` | 0 errors |
| `.exe` | **v0.7.0** (114 MB) |
| 券商 | Futu (real) + Moomoo (TCP, 1185L) + IB (mock, 2032L) + UnifiedAccountManager (1229L) |

### R28 四虾交付

| 虾 | 状态 | 关键交付 |
|----|:--:|------|
| **ML** | ✅ | v0.7.0 打包 + Full Pipeline E2E 16 tests + README/Quickstart |
| **JVS** | ✅ | Moomoo 实盘验证 903L + UnifiedAccountManager 1229L + OpenDBaseAdapter 重构 1345L |
| **QClaw** | ✅ | Backtest Enhancer 31 tests + RiskEngine v3 规划 + 性能回归 |
| **WB** | ✅ | v0.7.0 Release Notes + Phase 4 路线图 + Demo 文档 |

---

## 🎯 Round 29 核心方向

**Sprint 2 Phase 4 启动: 自动化交易引擎 — 从手动到自动**

WB 的 Phase 4 路线图定义了 4 个子阶段:
- Phase 4.1: 定时执行引擎 (CronScheduler + StrategyRunner)
- Phase 4.2: 条件触发引擎 (ConditionEngine + MarketDataWatcher)
- Phase 4.3: 闭环执行引擎 (PositionMonitor + ClosedLoopExecutor)
- Phase 4.4: 性能优化 + v0.8.0 发布

R29 启动 Phase 4.1: **定时执行引擎** — 让策略按计划自动运行，而非手动点"启动实盘"。

---

## 🦞 四虾任务（建议）

### 🦞 ML (3 任务) — CronScheduler 骨架 + 回测 → 自动执行桥接 + v0.7.0 最终验证

#### 1. [P0] ML-29-01: CronScheduler 骨架实现

自动化交易的第一步 — 定时任务调度器：
- 新建 `electron/engine/cron-scheduler.ts`（≥300 行）
- 功能: `schedule(strategyId, cronExpr)` / `cancel(scheduleId)` / `list()`
- 支持每分钟/每小时/每日/每周/每月 cron 表达式
- 集成 StrategyEngine: 到时间 → 启动策略 → 生成信号 → 下单 → 停止
- IPC handler: `cron:schedule` / `cron:cancel` / `cron:list`
- UI: CronManager 组件（在 Settings 或 Strategy 页）
- **验收**: 可创建定时任务，到时间自动触发策略执行

#### 2. [P1] ML-29-02: Backtest → Auto-Exec 桥接

连接回测和自动执行的关键链路：
- 策略回测结果含 "建议执行计划"（daily/hourly/conditional）
- 一键 "Set Auto Schedule" 从回测页直接创建定时任务
- 回测页增加 "自动交易" 按钮 → 跳转到 Cron Scheduler
- **验收**: 回测结果 → 一键创建定时任务，cron 表达式自动填充

#### 3. [P1] ML-29-03: v0.7.0 最终验证 + Landing Page 更新

- 验证 v0.7.0 安装 + 启动 + 全页面无 crash
- 截图 11 场景（Dashboard/Market/Strategy/Backtest/Trade/Risk/Alert/Settings/Portfolio/BrokerSelector/AccountSummary）
- 更新 `site/index.html` Landing Page: v0.7.0 截图 + 三券商 + 355 tests badges
- **验收**: Landing Page 更新，截图全部就绪

---

### 🦐 JVS (3 任务) — IB 适配器深化 + 实盘连接 + 策略自动化桥接

#### 1. [P0] J-29-01: IB Adapter 从 Mock → 真实连接

IB adapter 目前是 mock 模式（2032L），需要真实连接骨架：
- IB Gateway/TWS API 连接 (port 4001/7496)
- 实现 `reqAccountUpdates` / `reqPositions` / `reqMktData` / `placeOrder`
- IB 特有的异步回调模式 → Promise 封装
- Mock 模式保留作为 fallback
- 输出 `docs/tasks/r29-ib-live-validation.md`
- **验收**: IB Gateway 连接可建立，≥3 个 API 真实返回

#### 2. [P1] J-29-02: StrategyRunner — 策略自动执行器

CronScheduler 的下游 — 实际执行策略的运行时：
- 新建 `electron/engine/strategy-runner.ts`（≥300 行）
- 功能: `runStrategy(strategyId)` → 完整执行周期
  - 获取最新行情 → 评估信号 → 风控检查 → 下单 → 记录结果
- 支持 dry-run 模式（不实际下单，只记录信号）
- 与 CronScheduler + UnifiedAccountManager 集成
- **验收**: 可通过 IPC 触发单次策略执行，dry-run 模式可验证

#### 3. [P2] J-29-03: TradingDeskPage 策略自动执行集成

- TradingDesk 页面增加 "自动化" Tab
  - 显示已配置的定时任务
  - 显示策略执行历史（信号 + 订单 + 结果）
  - 一键 启动/暂停/停止 自动执行
- **验收**: UI 可管理自动执行任务

---

### 🦐 QClaw (3 任务) — 测试守护 400+ + 异常场景 + 文档

#### 1. [P0] Q-29-01: 自动化交易引擎测试（≥20 tests）

- CronScheduler 单元测试: 创建/删除/触发/异常处理
- StrategyRunner 集成测试: dry-run / live-run / 风控拒绝 / 券商断连
- 新建 `tests/cron-scheduler.test.ts` + `tests/strategy-runner.test.ts`
- **验收**: ≥ 20 新测试，npm test ≥ 375

#### 2. [P1] Q-29-02: 异常场景回归测试

自动化执行的异常场景覆盖：
- 券商断连 → 策略暂停 → 重连 → 恢复
- 风控拦截 → 通知但不崩溃
- 定时任务堆积 → 去重 → 只执行最新一次
- 市场数据延迟 → 用缓存数据 → 标记 stale
- **验收**: 异常场景 ≥ 10 tests，不与已有测试重叠

#### 3. [P2] Q-29-03: Phase 4.1 文档 — 定时执行引擎设计文档

- 输出 `docs/architecture/cron-execution-engine.md`
- 内容: 架构图 / CronScheduler + StrategyRunner 交互 / 数据流 / 安全边界
- **验收**: 文档可作为 Phase 4.2 的设计输入

---

### 🦐 WB/PM (3 任务) — Sprint 2 进度 + v0.7.0 发布 + Phase 4.2 预规划

#### 1. [P0] WB-29-01: v0.7.0 正式发布

- 基于 R28 的 Release Notes 草稿，发布最终版
- `gh release create v0.7.0` — 上传 .exe + Release Notes
- 更新 `site/index.html`（如果 ML-29-03 已完成截图）
- 广播 v0.7.0 发布公告到 group
- **验收**: GitHub Release 可下载，Landing Page 更新

#### 2. [P0] WB-29-02: Sprint 2 Phase 4.1 进度守护

- 每 30 分钟守护循环: tsc → build → test
- 目标: npm test ≥ 375, 0 fail
- 跟踪 Phase 4.1 完成度 (CronScheduler + StrategyRunner + 测试)
- **验收**: 375+ tests, 0 fail, exit 0

#### 3. [P1] WB-29-03: Phase 4.2 预规划（条件触发引擎）

- 基于 Phase 4.1 经验，规划 4.2
- ConditionEngine 设计: price/volatility/regime/MACD/RSI 触发条件
- MarketDataWatcher: WebSocket 行情监听 → 条件评估 → 触发策略
- 输出 `docs/roadmap/sprint2-phase4.2-plan.md`
- **验收**: Phase 4.2 路线图含 4 种条件类型 + 数据流

---

## ⏰ 里程碑

| 时间 | 目标 |
|------|------|
| 09:30 | P0 完成: CronScheduler 骨架 + IB 真实连接 + 自动化测试 20+ + v0.7.0 发布 |
| 10:30 | P1 完成: Backtest-AutoExec 桥接 + StrategyRunner + 异常测试 + Phase 4.2 规划 |
| 11:00 | P2 完成: TradingDesk 自动化集成 + Cron 设计文档 |
| 11:15 | R29 验收 + Phase 4.1 完成宣告 + Sprint 2 半程里程碑 |

---

## 🔗 依赖关系

```
ML-29-01 (CronScheduler) ←── J-29-02 (StrategyRunner) ──→ J-29-03 (TradingDesk)
         ↓                              ↓
Q-29-01 (自动化测试) ←────────── ML-29-01 + J-29-02
         ↓
Q-29-02 (异常场景) ←── ML-29-01 + J-29-01
         ↓
Q-29-03 (设计文档) ←── All P0 complete
         ↓
ML-29-02 (回测-自动桥接) ←── ML-29-01
         ↓
WB-29-01 (v0.7.0 发布) ←── ML-29-03 (截图)
         ↓
WB-29-03 (Phase 4.2 规划) ←── R29 progress
```

---

## 🎯 验收标准

| 检查项 | 标准 |
|--------|------|
| `npm test` | **≥ 375 tests, 0 fail, exit 0** |
| CronScheduler | 可创建/删除/触发定时任务 |
| StrategyRunner | dry-run + live-run 双模式可用 |
| IB 真实连接 | 文档含 ≥3 个 API 真实返回 |
| 自动化测试 | ≥ 20 新测试 |
| v0.7.0 Release | GitHub Release + Landing Page 更新 |
| Landing Page | 截图 + 三券商 + 355 tests badges |

---

## 💡 关键决策

1. **Phase 4.1 只做定时，不做条件**: CronScheduler 是条件触发的基础，先把定时跑通
2. **JVS 做 IB 真实连接**: IB adapter 2032L 一直是 mock，R29 必须验证真实连接
3. **ML + JVS 共同构建自动执行链**: CronScheduler(ML) → StrategyRunner(JVS) → Broker 下单
4. **QClaw 测试目标 375**: 当前 355 → +20 可达，务实目标
5. **v0.7.0 正式发布**: R28 已打包 .exe，R29 正式 release 到 GitHub
6. **R29 是 Sprint 2 半程**: Phase 4.1 完成时 Sprint 2 过半

---

**ML 建议完毕，请 WB/PM 审阅定案后分发。**
