<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# 8虾并行部署方案 — 从4虾到8虾的效率跃迁

**版本**: v1.0  
**日期**: 2026-06-06  
**目标**: 将单轮产出从 ~3000L 提升至 ~7500L，测试从 ~500 提升至 ~1200

---

## 1. 当前4虾效率瓶颈分析

### 1.1 瓶颈数据（R20-R32 统计）

| 指标 | 平均值 | 瓶颈说明 |
|------|--------|---------|
| 单轮等待时间 | 45 分钟 | PM 需等 3 虾提案后才能定案 |
| 定案时间 | 15 分钟 | PM 手动整合 + 写文档 + 广播 |
| 测试阻塞时间 | 20 分钟 | 一虾失败，全轮卡住 |
| git 冲突解决 | 10 分钟/轮 | 多虾修改同一文件 |
| **有效编码时间占比** | **~40%** | 大量时间消耗在协调而非编码 |

### 1.2 三大瓶颈根因

```
瓶颈1: PM串行整合
  JVS提案 → ML提案 → QClaw提案 → PM整合定案 → 广播
     ↑_________________________________________________↓
  问题: 必须等所有虾提案后才能定案，串行等待时间 = 3 × 提案时间

瓶颈2: 单仓库文件冲突
  JVS修改 trade-executor.ts ──┐
  ML 修改 trade-executor.ts ──┼──► git merge conflict
  QClaw修改 trade-executor.ts─┘
  问题: 3虾同时修改同一文件，冲突解决耗时且易出错

瓶颈3: 测试全局阻塞
  QClaw测试失败 ──► 全轮测试标红 ──► JVS/ML无法提交
  问题: 测试是全局的，一虾失败影响所有虾的验收
```

---

## 2. 8虾分层并行架构

### 2.1 核心原则：领域自治 + 契约先行

```
旧模式 (4虾):          新模式 (8虾):
┌─────────────┐        ┌─────────────┐
│   PM整合     │        │  契约定义    │ ◄── 每轮开始前5分钟，PM定义接口契约
│  (串行)      │        │  (并行)      │
└──────┬──────┘        └──────┬──────┘
       │                       │
   ┌───┴───┐              ┌───┴───┐
   ▼   ▼   ▼              ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼
  JVS ML QClaw           8只虾同时开始，互不等待
```

### 2.2 8虾分工与职责

| 编号 | 虾名 | 代号 | 职责范围 | 代码目录 | 预估产出/轮 |
|------|------|------|---------|---------|------------|
| 1 | 行情数据虾 | DATA-M | 行情订阅、K线、Tick、WS推送 | `electron/data/market/` | 400-600L |
| 2 | 账户数据虾 | DATA-A | 账户、持仓、订单、资金流水 | `electron/data/account/` | 400-600L |
| 3 | 券商适配虾 | BROKER | Futu/Moomoo/IB/统一适配器 | `electron/broker/` | 500-700L |
| 4 | 策略引擎虾 | STRAT | 策略评估、回测、NL解析 | `electron/strategy/` | 600-800L |
| 5 | 风控引擎虾 | RISK | 风控检查、熔断、限额 | `electron/risk/` | 400-600L |
| 6 | 交易执行虾 | EXEC | 下单执行、条件触发、定时 | `electron/execution/` | 500-700L |
| 7 | 交易UI虾 | UI-T | 交易面板、持仓、订单簿 | `src/components/trading/` | 500-700L |
| 8 | 系统UI虾 | UI-S | Dashboard、监控、设置、i18n | `src/components/system/` | 400-600L |

基础设施（3只共享虾，不算在8只工作虾中）：

| 角色 | 代号 | 职责 | 工作方式 |
|------|------|------|---------|
| PM协调虾 | PM | 定义契约、监控进度、验收 | 每轮前5分钟定义契约，轮中自动监控 |
| 测试质量虾 | QA | 测试框架、覆盖率、代码审计 | 并行运行8虾测试，独立验收 |
| 构建部署虾 | CI | 构建、打包、发布、CI/CD | 每轮结束自动构建 + 发布 |

### 2.3 代码目录重构

```
dawn-whales/
├── contracts/                    # 层间契约接口（关键！）
│   ├── data-provider.d.ts       # IDataProvider, IQuote, IKline
│   ├── broker-adapter.d.ts      # IBrokerAdapter, IOrderRequest
│   ├── strategy.d.ts            # IStrategy, ISignal, IBacktestResult
│   ├── risk.d.ts                # IRiskCheck, IRiskRule
│   └── execution.d.ts           # IExecutionUnit, IClosedLoopConfig
│
├── electron/
│   ├── data/                     # 数据层（2虾）
│   │   ├── market/              # 行情数据虾 (DATA-M)
│   │   │   ├── quote-provider.ts
│   │   │   ├── kline-provider.ts
│   │   │   └── tick-stream.ts
│   │   └── account/             # 账户数据虾 (DATA-A)
│   │       ├── account-provider.ts
│   │       ├── position-tracker.ts
│   │       └── order-history.ts
│   │
│   ├── broker/                   # 券商层（1虾）
│   │   ├── futu-opend.ts
│   │   ├── moomoo-adapter.ts
│   │   ├── ib-adapter.ts
│   │   └── unified-manager.ts
│   │
│   ├── strategy/                 # 策略层（1虾）
│   │   ├── engine.ts
│   │   ├── nl-parser.ts
│   │   ├── backtest-runner.ts
│   │   └── registry.ts
│   │
│   ├── risk/                     # 风控层（1虾）
│   │   ├── engine-v3.ts
│   │   ├── circuit-breaker.ts
│   │   ├── rules/
│   │   └── integrator.ts
│   │
│   ├── execution/                # 执行层（1虾）
│   │   ├── trade-executor.ts
│   │   ├── condition-engine.ts
│   │   ├── cron-scheduler.ts
│   │   └── position-monitor.ts
│   │
│   └── ipc/                      # IPC层（共享，各虾注册自己的handler）
│       ├── market-ipc.ts        # DATA-M 注册
│       ├── broker-ipc.ts        # BROKER 注册
│       ├── strategy-ipc.ts      # STRAT 注册
│       ├── risk-ipc.ts          # RISK 注册
│       ├── execution-ipc.ts     # EXEC 注册
│       └── index.ts             # 统一注册入口
│
├── src/
│   ├── components/
│   │   ├── trading/             # 交易UI虾 (UI-T)
│   │   │   ├── OrderPanel.tsx
│   │   │   ├── PositionPanel.tsx
│   │   │   └── BrokerSelector.tsx
│   │   └── system/              # 系统UI虾 (UI-S)
│   │       ├── Dashboard.tsx
│   │       ├── HealthMonitor.tsx
│   │       └── SettingsPanel.tsx
│   └── hooks/                   # 各虾的React hooks
│       ├── useMarketData.ts     # DATA-M
│       ├── useBroker.ts         # BROKER
│       ├── useStrategy.ts       # STRAT
│       ├── useRisk.ts           # RISK
│       └── useExecution.ts      # EXEC
│
├── tests/
│   ├── data/                    # DATA-M + DATA-A 测试
│   ├── broker/                  # BROKER 测试
│   ├── strategy/                # STRAT 测试
│   ├── risk/                    # RISK 测试
│   ├── execution/               # EXEC 测试
│   ├── ui-trading/              # UI-T 测试
│   ├── ui-system/               # UI-S 测试
│   └── e2e/                     # E2E 测试（QA虾）
│
└── docs/contracts/              # 契约变更日志
    ├── r33-contracts.md
    ├── r34-contracts.md
    └── ...
```

---

## 3. 核心机制变革

### 3.1 契约先行机制（解决PM串行瓶颈）

```
旧模式:                     新模式:
等待3虾提案 (30min)         PM定义契约 (5min)
     │                          │
     ▼                          ▼
PM手动整合 (15min)          8虾并行执行 (45min)
     │                          │
     ▼                          ▼
广播方案 (5min)             QA并行测试 (10min)
     │                          │
     ▼                          ▼
各虾执行 (45min)            CI自动构建 (5min)
     │                          │
     ▼                          ▼
测试阻塞 (20min)            本轮完成 ✅
     │
     ▼
合并冲突 (10min)
     │
     ▼
本轮完成 (125min)          新模式 (65min) — 效率提升 1.9x
```

**契约定义流程**：

1. **每轮开始前 5 分钟**，PM 定义本轮契约变更：
   - 哪些接口新增/修改
   - 数据结构变更
   - 事件格式变更

2. **契约文件**写入 `docs/contracts/r{round}-contracts.md`：

```typescript
// contracts/r33-contracts.md 示例
## R33 契约变更

### 新增接口
interface IPositionMonitor {
  trackPosition(pos: Position): void;
  updatePrice(symbol: string, price: number): void;
  setStopLoss(unitId: string, config: StopLossConfig): void;
  on(event: 'stopLossHit', cb: (unitId: string) => void): void;
}

### 修改接口
// IExecutionUnit 新增字段
interface IExecutionUnit {
  // 原有字段...
  + stopLossConfig?: StopLossConfig;  // 新增
  + takeProfitConfig?: TakeProfitConfig;  // 新增
}

### 事件变更
// 新增事件
'position:stopLossHit' { unitId: string, symbol: string, price: number }
```

3. **8虾并行执行**，各自只依赖契约接口，不需要等对方实现完成。

### 3.2 代码目录隔离（解决git冲突）

```
冲突矩阵（旧模式 vs 新模式）

旧模式（4虾共享目录）:
          JVS    ML    QClaw   PM
JVS        -    HIGH   HIGH   LOW
ML       HIGH     -    HIGH   LOW
QClaw    HIGH   HIGH     -    LOW
冲突概率: ~35% (每轮至少1次冲突)

新模式（8虾独立目录）:
          D-M   D-A   BROK  STRAT  RISK  EXEC  UI-T  UI-S
D-M        -    LOW   LOW    LOW   LOW   LOW   LOW   LOW
D-A      LOW     -    LOW    LOW   LOW   LOW   LOW   LOW
BROK     LOW   LOW     -    LOW   LOW   LOW   LOW   LOW
STRAT    LOW   LOW   LOW     -    LOW   LOW   LOW   LOW
RISK     LOW   LOW   LOW   LOW     -    LOW   LOW   LOW
EXEC     LOW   LOW   LOW   LOW   LOW     -    LOW   LOW
UI-T     LOW   LOW   LOW   LOW   LOW   LOW     -    LOW
UI-S     LOW   LOW   LOW   LOW   LOW   LOW   LOW     -
冲突概率: ~5% (仅契约接口变更时可能冲突)
```

**冲突解决规则**：
- 各虾只修改自己的目录，不修改其他虾的目录
- 契约接口（`contracts/`）的修改需提前在契约文档中声明
- IPC 注册（`electron/ipc/`）采用追加模式，不修改已有 handler

### 3.3 测试分片机制（解决测试全局阻塞）

```
旧模式（单测试套件）:
npm test ──► 运行所有测试 ──► 1个失败 = 全轮失败
     │                              │
     └── 18个测试文件, 487 tests ───┘

新模式（分片测试）:
DATA-M:  npm test -- tests/data/market/        (跑自己的)
DATA-A:  npm test -- tests/data/account/       (跑自己的)
BROKER:  npm test -- tests/broker/             (跑自己的)
STRAT:   npm test -- tests/strategy/           (跑自己的)
RISK:    npm test -- tests/risk/               (跑自己的)
EXEC:    npm test -- tests/execution/          (跑自己的)
UI-T:    npm test -- tests/ui-trading/         (跑自己的)
UI-S:    npm test -- tests/ui-system/          (跑自己的)
QA:      npm test -- tests/e2e/                (E2E)
PM:      npm run test:full                     (全量, 轮末跑)

各虾独立跑测试，互不阻塞！
```

**package.json 配置**：

```json
{
  "scripts": {
    "test:data-market": "vitest run tests/data/market/",
    "test:data-account": "vitest run tests/data/account/",
    "test:broker": "vitest run tests/broker/",
    "test:strategy": "vitest run tests/strategy/",
    "test:risk": "vitest run tests/risk/",
    "test:execution": "vitest run tests/execution/",
    "test:ui-trading": "vitest run tests/ui-trading/",
    "test:ui-system": "vitest run tests/ui-system/",
    "test:e2e": "vitest run tests/e2e/",
    "test:full": "vitest run",
    "test:ci": "vitest run --reporter=json --outputFile=tests/results.json"
  }
}
```

### 3.4 连续轮次机制（解决轮次串行）

```
旧模式（串行轮次）:
R32 ──► 等所有虾完成 ──► R33 ──► 等所有虾完成 ──► R34
  ↑      (45min)          ↑        (45min)
  └──────────────────────────────────────────────┘
  问题: 快的虾等慢的虾，时间浪费

新模式（连续轮次）:
R32: D-M ━━━━━━━━ DONE ──┐
     D-A ━━━━━━━━━━━━━━━━ DONE ──┐
     BROK ━━━━━━━━━━━━━━━━━━━━━━━ DONE ──┐
     ...                                │
                                          ▼
R33: D-M 无需等待，R32完成后立即开始R33 ──┘
     D-A 无需等待，R32完成后立即开始R33
     ...

关键规则:
1. 每虾有自己的轮次编号（虾私有）
2. 虾完成当前轮任务后，立即读取契约开始下一轮
3. 不需要等所有虾同步轮次
4. PM每30分钟更新一次契约文档
```

---

## 4. Chat-Bridge 升级

### 4.1 消息格式升级

```typescript
// 旧格式（广播式）
{ from: "PM", to: "ALL", type: "R32_PLAN", content: "..." }

// 新格式（定向 + 自治）
interface BridgeMessage {
  msgId: string;
  timestamp: string;
  from: string;           // 发件虾
  to: string[];           // 收件虾列表 ["DATA-M", "BROKER", ...]
  type: MessageType;
  round: number;          // 该虾的私有轮次
  payload: unknown;
}

type MessageType =
  | "CONTRACT_UPDATE"     // PM 更新契约
  | "TASK_CLAIM"          // 虾认领任务
  | "TASK_PROGRESS"       // 虾进度更新（每10分钟）
  | "TASK_DONE"           // 虾任务完成
  | "TEST_RESULT"         // 虾测试报告
  | "BLOCKER"             // 虾遇到阻塞
  | "CODE_REVIEW"         // 虾请求代码审查
  | "MERGE_REQUEST";      // 虾请求合并
```

### 4.2 虾状态机

```
每虾独立状态:

IDLE ──► CONTRACT_READ ──► CODING ──► TESTING ──► MERGE_READY ──► IDLE
            │                   │           │             │
            │                   │           │             ▼
            │                   │           │        PM验收通过?
            │                   │           │        YES: 合并，回IDLE
            │                   │           │        NO: 回CODING
            │                   │           │
            │                   │           ▼
            │                   │      test:full 通过?
            │                   │      YES: 到MERGE_READY
            │                   │      NO: 回CODING
            │                   │
            │                   ▼
            │              blocker?
            │              YES: 发BLOCKER消息，等协助
            │              NO: 继续CODING
            │
            ▼
       契约有变化?
       YES: 更新本地契约，继续
       NO: 继续
```

---

## 5. 部署实施步骤

### 5.1 Phase 1: 基础设施改造（1轮，R33）

**目标**: 搭建8虾协作基础设施，不修改业务逻辑。

| 虾 | 任务 | 产出 |
|----|------|------|
| PM | 创建 `contracts/` 目录 + 契约模板 | 5个契约文件 |
| PM | 重构 `electron/ipc/` 为分片注册 | ipc/index.ts + 各虾ipc文件 |
| CI | 配置分片测试脚本 | package.json scripts |
| CI | 配置CI/CD流水线 | GitHub Actions workflow |
| QA | 迁移现有测试到分片目录 | tests/ 子目录重构 |

**验收标准**:
- `npm run test:data-market` 到 `npm run test:ui-system` 均可独立运行
- `npm run test:full` 仍能通过（487 tests）
- 各虾目录隔离，无交叉引用（除 `contracts/`）

### 5.2 Phase 2: 契约定义（1轮，R34）

**目标**: 定义初始契约，8虾开始并行工作。

| 契约文件 | 定义者 | 内容 |
|---------|--------|------|
| `contracts/data-provider.d.ts` | DATA-M + DATA-A | 行情/账户数据接口 |
| `contracts/broker-adapter.d.ts` | BROKER | 券商统一接口 |
| `contracts/strategy.d.ts` | STRAT | 策略/信号/回测接口 |
| `contracts/risk.d.ts` | RISK | 风控检查接口 |
| `contracts/execution.d.ts` | EXEC | 执行引擎接口 |

**验收标准**:
- 所有契约文件通过 TypeScript 编译
- 各虾基于契约可独立开发（mock实现）

### 5.3 Phase 3: 8虾并行运行（R35+）

**目标**: 8虾正式并行，每轮产出目标：

| 虾 | 每轮目标 | 测试目标 |
|----|---------|---------|
| DATA-M | 400-600L | +10 tests |
| DATA-A | 400-600L | +10 tests |
| BROKER | 500-700L | +10 tests |
| STRAT | 600-800L | +15 tests |
| RISK | 400-600L | +10 tests |
| EXEC | 500-700L | +15 tests |
| UI-T | 500-700L | +10 tests |
| UI-S | 400-600L | +10 tests |
| **合计** | **3700-5300L** | **+100 tests** |

---

## 6. 效率对比预测

### 6.1 单轮时间对比

| 阶段 | 4虾旧模式 | 8虾新模式 | 提升 |
|------|----------|----------|------|
| 提案等待 | 30 min | 0 min | ∞ |
| PM定案 | 15 min | 5 min | 3x |
| 编码执行 | 45 min | 45 min | 1x |
| 测试阻塞 | 20 min | 0 min | ∞ |
| 冲突解决 | 10 min | 2 min | 5x |
| **单轮总计** | **120 min** | **52 min** | **2.3x** |

### 6.2 单轮产出对比

| 指标 | 4虾旧模式 (R30) | 8虾新模式 (预测) | 提升 |
|------|-----------------|-----------------|------|
| 代码产出 | ~3000L | ~7500L | **2.5x** |
| 测试产出 | +100 tests | +250 tests | **2.5x** |
| 功能模块 | 3-4 个 | 8-10 个 | **2.5x** |
| 单轮时间 | 120 min | 52 min | **2.3x** |
| **单位时间产出** | **25 L/min** | **144 L/min** | **5.8x** |

---

## 7. 风险控制

### 7.1 架构风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 契约频繁变更 | 8虾反复修改 | 契约冻结期（每轮前5分钟定义后不再变更） |
| 接口不匹配 | 集成时编译错误 | 契约文件自动编译检查（CI前置） |
| 测试覆盖不足 | 各虾只测自己 | QA虾负责E2E + 契约集成测试 |
| 目录边界模糊 | 虾之间抢代码 | PM虾严格仲裁 + 代码所有权规则 |

### 7.2 回退方案

如果8虾并行出现严重问题，可回退到**混合模式**：

```
混合模式 ( fallback ):
- 保留8虾分工
- 但轮次仍同步（等最慢的虾）
- 测试仍分片独立跑
- PM每轮仍整合定案

预期效率: 比旧模式提升 1.5x，比全并行低但稳定
```

---

## 8. 立即行动项

### 8.1 本轮（R32 剩余时间）可做的事

1. **PM虾**: 创建 `contracts/` 目录骨架（5分钟）
2. **CI虾**: 添加 `test:*` 分片脚本到 package.json（10分钟）
3. **QA虾**: 规划 tests/ 子目录迁移方案（文档）

### 8.2 R33 正式启动8虾

1. 完成目录重构
2. 定义初始契约
3. 8虾认领领域
4. 开始并行轮次

---

## 9. 附录

### 9.1 虾命名规范

| 虾名 | 代号 | chat-bridge from字段 | 代码注释署名 |
|------|------|---------------------|-------------|
| 行情数据虾 | DATA-M | `DATA-M` | `@author DATA-M` |
| 账户数据虾 | DATA-A | `DATA-A` | `@author DATA-A` |
| 券商适配虾 | BROKER | `BROKER` | `@author BROKER` |
| 策略引擎虾 | STRAT | `STRAT` | `@author STRAT` |
| 风控引擎虾 | RISK | `RISK` | `@author RISK` |
| 交易执行虾 | EXEC | `EXEC` | `@author EXEC` |
| 交易UI虾 | UI-T | `UI-T` | `@author UI-T` |
| 系统UI虾 | UI-S | `UI-S` | `@author UI-S` |
| PM协调虾 | PM | `PM` | `@author PM` |
| 测试质量虾 | QA | `QA` | `@author QA` |
| 构建部署虾 | CI | `CI` | `@author CI` |

### 9.2 相关文档

- `docs/architecture/8-lobster-deployment-plan.md` — 本文档
- `docs/contracts/r{round}-contracts.md` — 每轮契约文档
- `docs/sprints/sprint3-8-lobster-kickoff.md` — Sprint 3 8虾启动计划

---

*文档完成时间: 2026-06-06 11:35*  
*作者: PM (WorkBuddy)*  
*状态: 方案完成，等待用户确认后实施*
