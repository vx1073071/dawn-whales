# Round 29 最终方案 (PM 定案版)

**制定人**: PM (WorkBuddy)
**时间**: 2026-06-06 09:03 GMT+8
**状态**: 已确认，立即执行

---

## 项目现状 (09:03 实测)

| 指标 | 结果 |
|------|------|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | **355/355 passed**, 0 failed, 13 files |
| version | 0.7.0 (已打包，114 MB) |
| 券商 | Futu (real) + Moomoo (TCP, 1185L) + IB (mock, 2032L) + UnifiedAccountManager (1229L) |

---

## R28 四虾交付回顾

| 虾 | 状态 | 关键交付 |
|----|:--:|------|
| **JVS** | ✅ | Moomoo 实盘验证 903L + UnifiedAccountManager 1229L + OpenDBaseAdapter 重构指南 1345L |
| **ML** | ✅ | v0.7.0 打包 + Full Pipeline E2E 16 tests + README/Quickstart |
| **QClaw** | ✅ | Backtest Enhancer 31 tests + RiskEngine v3 规划 + 性能回归 |
| **WB/PM** | ✅ | v0.7.0 Release Notes + Phase 4 路线图 + Demo 文档 |

---

## 关键发现

1. **OpenDBaseAdapter 重构已推迟两轮** (R27/R28)，R28-03 重构指南 (1345L) 已就绪，R29 必须实际执行
2. **Phase 4.1 定时执行引擎** 是 Sprint 2 下一阶段核心，但需要一个清晰的起点
3. **RiskEngine v3** 规划已完成，是自动化交易的风控前提
4. **v0.7.0 .exe 已打包** 但尚未正式发布 (GitHub Release)
5. **IB 真实连接** 重要但不紧急，mock 模式已覆盖 12 个美股合约，R30 再做真实验证更合适

---

## Round 29 核心主题

**Phase 4.1 启动: 自动化交易引擎骨架 — 从"手动执行"到"定时自动"**

---

## 四虾任务分配

### 🦐 JVS (3 任务)

#### 1. [P0] J-29-01: OpenDBaseAdapter 抽象基类重构
- 基于 R28-03 重构指南 (`docs/tasks/r28-opend-base-adapter-refactor.md`) 实际执行
- 新建 `electron/broker/opend-base-adapter.ts` (>=500 lines)
  - 共享 TCP 连接管理 + 心跳机制
  - 抽象方法: `buildPacket()` / `parsePacket()` / `getContractMapping()`
  - 错误处理基类 + 自动重连逻辑
- `futu-adapter.ts` 继承 OpenDBaseAdapter (净减 >=150L)
- `moomoo-adapter.ts` 继承 OpenDBaseAdapter (净减 >=150L)
- **验收**: tsc 0 errors, Futu + Moomoo 适配器代码量各减 >=150L, 功能不变, npm test 0 fail

#### 2. [P0] J-29-02: StrategyRunner 策略自动执行器
- 新建 `electron/engine/strategy-runner.ts` (>=400 lines)
- 功能: `runStrategy(strategyId, options)` → 完整执行周期
  - 加载策略配置 → 获取行情 → 生成信号 → 风控检查 → 下单 → 记录结果
- 支持 `dryRun` 模式（模拟执行，记录但不实际下单）
- 支持 `brokerId` 路由（通过 UnifiedAccountManager 选择券商）
- 执行结果持久化（sqlite: strategy_runs 表）
- IPC: `strategyRunner:run` / `strategyRunner:dryRun` / `strategyRunner:getHistory`
- **验收**: dry-run 可验证策略逻辑，live-run 可实际下单，历史记录可查

#### 3. [P1] J-29-03: Trading Calendar 交易日历
- 新建 `electron/engine/trading-calendar.ts` (>=300 lines)
- 美股/港股/A股主要市场假日 (2024-2026)
- 盘前/盘中/盘后时段判断
- 与 StrategyRunner 集成: 非交易时段自动跳过执行
- **验收**: 2024-2026 主要假日判断准确，交易时段边界正确

---

### 🦞 ML (3 任务)

#### 1. [P0] ML-29-01: CronScheduler 定时任务调度器
- 新建 `electron/engine/cron-scheduler.ts` (>=400 lines)
- 功能:
  - `schedule(taskId, cronExpr, strategyId, options)` — 创建定时任务
  - `cancel(taskId)` — 取消任务
  - `list()` — 列出所有任务
  - `pause(taskId)` / `resume(taskId)` — 暂停/恢复
- 支持 cron 表达式 (`0 9 * * 1-5` = 工作日 9:00)
- 支持简单间隔 (`every 5 minutes`, `every hour`)
- 任务持久化 (sqlite: cron_tasks 表)
- 任务状态机: pending → running → completed / failed / paused
- 触发时调用 StrategyRunner
- IPC handler: `cron:schedule` / `cron:cancel` / `cron:list` / `cron:pause` / `cron:resume`
- **验收**: 可创建/暂停/恢复/删除定时任务，到时间自动触发 StrategyRunner

#### 2. [P1] ML-29-02: Backtest → Auto-Exec 桥接
- 修改 BacktestPage / BacktestResult 组件
- 回测结果页增加 "Set Auto Schedule" 按钮
- 点击后跳转到 CronScheduler 配置页，预填充:
  - 策略 ID（来自回测）
  - 建议 cron 表达式（来自回测结果中的 `recommendation.schedule`）
  - 默认 dry-run 模式
- **验收**: 回测 → 一键创建定时任务，cron 表达式自动填充，默认 dry-run

#### 3. [P1] ML-29-03: v0.7.0 最终验证 + Landing Page 更新
- 验证 v0.7.0 安装/启动/全页面无 crash
- 截图 11 个核心场景（Dashboard/Market/Strategy/Backtest/Trade/Settings/BrokerSelector/AccountSummary/Scheduler/Risk/Alert）
- 更新 `site/index.html`: v0.7.0 截图 + 三券商 + 355 tests badges + 下载链接
- **验收**: Landing Page 可访问，截图展示全部核心功能

---

### 🦐 QClaw (3 任务)

#### 1. [P0] Q-29-01: RiskEngine v3 Phase 1 实现
- 基于 `docs/tasks/riskengine-v3-planning.md` 执行第一阶段
- 新建 `electron/engine/risk-engine-v3.ts` (>=600 lines)
- 核心功能:
  - `aggregateAccounts()`: 跨 Futu/Moomoo/IB 账户聚合 (USD 标准化)
  - `getMarginUtilization()`: 跨券商保证金占用实时计算
  - `getPortfolioExposure()`: 行业/资产类别敞口分析
  - `checkCircuitBreaker()`: 账户级熔断 (单日亏损 N% 自动禁开新仓)
- 向后兼容: v2 `RiskEngine` 类保持不变
- 与 StrategyRunner 集成: 自动执行前调用 RiskEngine v3 检查
- **验收**: 50+ tests, tsc 0 errors, 熔断逻辑可触发

#### 2. [P0] Q-29-02: 自动化交易引擎测试 (>=20 tests)
- 新建 `tests/cron-scheduler.test.ts` (>=10 tests)
  - 创建/删除/触发 cron 任务
  - 状态机转换 (pending→running→completed/failed/paused)
  - 持久化恢复 (重启后任务恢复)
  - 并发任务隔离
- 新建 `tests/strategy-runner.test.ts` (>=10 tests)
  - dry-run 模式验证
  - live-run 端到端 (mock broker)
  - 风控拒绝场景
  - 执行历史记录
- **验收**: >=20 新测试, npm test >= 375, 0 fail

#### 3. [P1] Q-29-03: 前端性能优化
- StrategyPage: `useCallback`/`useMemo` 优化 33 个 state 计算
- MarketPage: ECharts 按需加载 (延迟初始化)
- LiveMonitorPage: 修复 5 个 useEffect 内存泄漏
- React DevTools Profiler 基线: 首屏 < 3s
- **验收**: Lighthouse Performance > 70 (当前 ~45)

---

### 🦐 WB/PM (3 任务)

#### 1. [P0] WB-29-01: v0.7.0 正式发布
- 基于 `docs/releases/v0.7.0-release-notes.md` 发布最终版
- `gh release create v0.7.0` — 上传 .exe + Release Notes
- 更新 `site/index.html` (配合 ML-29-03)
- 广播 v0.7.0 发布公告
- **验收**: GitHub Release 可下载，Landing Page 更新

#### 2. [P0] WB-29-02: Build + Test 守护 (目标 375+)
- 每 30 分钟守护循环: tsc → build → test
- 目标: npm test >= 375, 0 fail
- 跟踪 Phase 4.1 完成度
- **验收**: 375+ tests, 0 fail, exit 0

#### 3. [P1] WB-29-03: Phase 4.2 预规划 (条件触发引擎)
- 基于 Phase 4.1 经验，规划 4.2
- ConditionEngine 设计: price/volatility/regime/MACD/RSI 触发
- MarketDataWatcher: WebSocket 行情监听 → 条件评估 → 触发
- 输出 `docs/roadmap/sprint2-phase4.2-plan.md`
- **验收**: Phase 4.2 路线图含 4 种条件类型 + 数据流

---

## 依赖关系

```
J-29-01 (OpenDBaseAdapter)
    ↓
J-29-02 (StrategyRunner) ←── Q-29-01 (RiskEngine v3)
    ↓                           ↓
ML-29-01 (CronScheduler) ←────┘
    ↓
ML-29-02 (Backtest桥接) ←── ML-29-01
    ↓
Q-29-02 (自动化测试) ←── ML-29-01 + J-29-02
    ↓
WB-29-01 (v0.7.0 发布) ←── ML-29-03 (Landing Page)
    ↓
WB-29-03 (Phase 4.2 规划) ←── R29 progress
```

---

## 里程碑

| 时间 | 目标 |
|------|------|
| 09:30 | P0 完成: OpenDBaseAdapter 重构 + CronScheduler + RiskEngine v3 + 自动化测试 20+ + v0.7.0 发布 |
| 10:30 | P1 完成: StrategyRunner + Backtest桥接 + Trading Calendar + 前端性能 + Phase 4.2 规划 |
| 11:00 | P2 收尾 + 最终验收 |
| 11:15 | R29 验收 + Phase 4.1 完成宣告 + Sprint 2 半程里程碑 |

---

## 关键决策说明

1. **OpenDBaseAdapter 重构终于执行**: 推迟两轮 (R27/R28)，R28-03 指南已就绪，R29 必须落地
2. **不做 IB 真实连接**: mock 模式已覆盖 12 个美股合约，真实连接需 IB Gateway 环境，放到 R30
3. **CronScheduler + StrategyRunner 是 Phase 4.1 核心**: ML 负责调度器 (定时触发)，JVS 负责执行器 (策略运行)，分工明确
4. **RiskEngine v3 是自动化前提**: 自动执行必须有风控保障，QClaw P0 优先
5. **v0.7.0 正式发布**: R28 已打包，R29 做正式发布到 GitHub
6. **测试目标 375+**: 当前 355，+20 新测试可达，务实目标
7. **Backtest桥接放在 P1**: 需先完成 CronScheduler 骨架，但不阻塞 R29 验收

---

## 验收标准

| 检查项 | 标准 |
|--------|------|
| `tsc --noEmit` | 0 errors |
| `npm run build` | 0 errors |
| `npm test` | **>= 375 tests, 0 fail, exit 0** |
| OpenDBaseAdapter | Futu + Moomoo 继承，代码量各减 >=150L |
| CronScheduler | 可创建/暂停/恢复/删除定时任务，cron 表达式支持 |
| StrategyRunner | dry-run + live-run 双模式可用，执行历史可查 |
| RiskEngine v3 | aggregateAccounts + margin + exposure + circuit breaker 可用 |
| 自动化测试 | >= 20 新测试 (cron + strategy-runner) |
| v0.7.0 Release | GitHub Release 可下载 |
| Landing Page | 截图 + 三券商 + tests badges |
| 前端性能 | Lighthouse Performance > 70 |

---

**方案制定完毕，请各虾确认收到，立即执行！**
