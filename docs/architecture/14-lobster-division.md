<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# 14 虾并行分工架构

> 版本: v1.0 | 日期: 2026-06-06 | 状态: 已生效

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        PM 协调虾 (WorkBuddy)                      │
│              守护循环 / 方案广播 / 契约维护 / 冲突仲裁              │
└─────────────────────────────────────────────────────────────────┘
                              │
    ┌─────────┬─────────┬─────┴─────┬─────────┬─────────┐
    ▼         ▼         ▼           ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ 数据层 │ │ 券商层 │ │ 引擎层 │ │  UI层  │ │ 基础设施│
└───────┘ └───────┘ └───────┘ └───────┘ └───────┘
  3只虾    2只虾    4只虾    3只虾    2只虾
```

## 14 虾详细分工

### 数据层 (3只虾)

| # | 虾名 | 代号 | 核心职责 | 代码目录 | 契约文件 |
|---|------|------|---------|---------|---------|
| 1 | 📊 **行情数据虾** | MARKET | 实时行情推送、WebSocket管理、行情缓存、K线实时聚合 | `electron/data/market/` | `contracts/data-contracts.ts` |
| 2 | 💰 **账户数据虾** | ACCOUNT | 持仓同步、订单跟踪、资金计算、盈亏实时统计 | `electron/data/account/` | `contracts/data-contracts.ts` |
| 3 | 📚 **历史数据虾** | HISTORY | 历史K线存储、回测数据集、数据清洗、导入导出 | `electron/data/history/` | `contracts/data-contracts.ts` |

**行情数据虾 (MARKET)** 具体任务:
- WS 行情连接管理 (connect/disconnect/reconnect)
- 行情数据缓存层 (内存 + SQLite)
- K线实时聚合 (1m/5m/15m/30m/1h/1d/1w/1M)
- 行情订阅管理 (按需订阅/取消订阅)
- 行情质量监控 (延迟/丢包/乱序检测)

**账户数据虾 (ACCOUNT)** 具体任务:
- 持仓同步 (定时拉取 + 推送更新)
- 订单生命周期跟踪 (待成交/部分成交/已成交/已取消)
- 资金实时计算 (可用/冻结/总市值)
- 盈亏统计 (实现盈亏 + 浮动盈亏)
- 账户历史记录

**历史数据虾 (HISTORY)** 具体任务:
- 历史K线下载/存储/查询
- 回测数据准备
- 数据质量检查 (缺失/异常值)
- 数据导入导出 (CSV/Parquet)
- 数据压缩/归档

### 券商层 (2只虾)

| # | 虾名 | 代号 | 核心职责 | 代码目录 | 契约文件 |
|---|------|------|---------|---------|---------|
| 4 | 🇭🇰 **富途适配虾** | FUTU | Futu OpenD TCP连接、港股/A股行情、下单 | `electron/broker/futu/` | `contracts/broker-contracts.ts` |
| 5 | 🌍 **海外券商虾** | INTL | Moomoo + IB适配、美股行情、多币种 | `electron/broker/intl/` | `contracts/broker-contracts.ts` |

**富途适配虾 (FUTU)** 具体任务:
- Futu OpenD TCP长连接管理
- 港股/A股行情协议解析
- 港股/A股下单/撤单
- 港股期权支持
- A股通/港股通适配

**海外券商虾 (INTL)** 具体任务:
- Moomoo TCP连接
- IB Gateway/TWS连接
- 美股行情 (Nasdaq/NYSE)
- 多币种账户 (USD/HKD/CNY)
- 美股期权支持

### 引擎层 (4只虾)

| # | 虾名 | 代号 | 核心职责 | 代码目录 | 契约文件 |
|---|------|------|---------|---------|---------|
| 6 | 🧠 **策略虾** | STRATEGY | StrategyEngine、策略模板、回测引擎、参数优化 | `electron/engine/strategy/` | `contracts/engine-contracts.ts` |
| 7 | 🛡️ **风控虾** | RISK | RiskEngine v3、熔断、回撤、限额、压力测试 | `electron/engine/risk/` | `contracts/engine-contracts.ts` |
| 8 | ⚡ **执行虾** | EXEC | TradeExecutor、智能下单、重试、滑点控制 | `electron/engine/executor/` | `contracts/engine-contracts.ts` |
| 9 | 🤖 **自动化虾** | AUTO | Cron调度、条件触发、闭环执行、再平衡 | `electron/engine/automation/` | `contracts/engine-contracts.ts` |

**策略虾 (STRATEGY)** 具体任务:
- StrategyEngine 核心逻辑
- 策略模板库 (趋势跟踪/均值回归/突破)
- 回测引擎 (事件驱动)
- 参数优化 (网格搜索/遗传算法)
- 策略绩效分析

**风控虾 (RISK)** 具体任务:
- RiskEngine v3 持续优化
- 熔断机制 (价格/波动率/流动性)
- 回撤监控 (实时计算/告警)
- 限额管理 (单日/单标/单策略)
- 压力测试场景

**执行虾 (EXEC)** 具体任务:
- TradeExecutor 核心优化
- 智能下单 (TWAP/VWAP/冰山)
- 重试机制 (Fixed/Exponential/Adaptive)
- 滑点控制与估计
- 订单路由 (最优券商选择)

**自动化虾 (AUTO)** 具体任务:
- CronScheduler 定时调度
- ConditionWatcher 条件监听
- ClosedLoopExecutor 闭环执行
- RebalanceEngine 再平衡
- TradingCalendar 交易日历集成

### UI层 (3只虾)

| # | 虾名 | 代号 | 核心职责 | 代码目录 | 契约文件 |
|---|------|------|---------|---------|---------|
| 10 | 🖥️ **交易UI虾** | UI-TRADE | 订单面板、持仓列表、条件规则、快速下单 | `src/components/trading/` | `contracts/ui-contracts.ts` |
| 11 | 📈 **监控UI虾** | UI-MON | 绩效面板、系统监控、图表、实时告警 | `src/components/dashboard/` | `contracts/ui-contracts.ts` |
| 12 | ⚙️ **配置UI虾** | UI-CONFIG | 设置、券商配置、用户偏好、主题、快捷键 | `src/components/settings/` | `contracts/ui-contracts.ts` |

**交易UI虾 (UI-TRADE)** 具体任务:
- 订单面板 (买卖/方向/数量/价格)
- 持仓列表 (实时刷新/颜色指示/盈亏)
- 条件规则面板 (CRUD/状态/触发历史)
- 快速下单 (预设模板/一键下单)
- 订单簿 (Level 2 深度)

**监控UI虾 (UI-MON)** 具体任务:
- 绩效面板 (Sharpe/Sortino/Calmar/Profit Factor)
- 系统监控 (引擎状态/延迟/错误率)
- 实时图表 (价格/成交量/技术指标)
- 告警中心 (实时/历史/分级)
- 日志查看器

**配置UI虾 (UI-CONFIG)** 具体任务:
- 通用设置 (语言/主题/时区)
- 券商配置 (连接参数/凭证/测试/生产)
- 用户偏好 (默认数量/默认价格类型)
- 主题系统 (Light/Dark/自定义)
- 快捷键配置

### 基础设施 (2只虾)

| # | 虾名 | 代号 | 核心职责 | 代码目录 | 契约文件 |
|---|------|------|---------|---------|---------|
| 13 | 🧪 **QA虾** | QA | 测试框架、测试覆盖、性能基准、CI/CD | `tests/qa/` | `contracts/engine-contracts.ts` |
| 14 | 🚀 **DevOps虾** | DEVOPS | 构建优化、部署脚本、性能分析、监控 | `scripts/devops/` | `contracts/ui-contracts.ts` |

**QA虾 (QA)** 具体任务:
- 测试框架维护 (vitest)
- 测试覆盖率监控 (>=80%)
- 性能基准测试 (延迟/内存/CPU)
- CI/CD 配置 (GitHub Actions)
- 回归测试自动化

**DevOps虾 (DEVOPS)** 具体任务:
- 构建优化 (vite/rollup配置)
- 部署脚本 (Windows/macOS/Linux)
- 性能分析 (Profiler/Benchmark)
- 应用监控 (错误追踪/性能指标)
- 版本发布流程

## 代码目录隔离规则

```
dawn-whales/
├── contracts/              # 共享契约 (所有虾只读)
│   ├── index.ts
│   ├── data-contracts.ts
│   ├── broker-contracts.ts
│   ├── engine-contracts.ts
│   └── ui-contracts.ts
├── electron/
│   ├── data/
│   │   ├── market/         # 📊 MARKET 独占
│   │   ├── account/        # 💰 ACCOUNT 独占
│   │   └── history/        # 📚 HISTORY 独占
│   ├── broker/
│   │   ├── futu/           # 🇭🇰 FUTU 独占
│   │   └── intl/           # 🌍 INTL 独占
│   ├── engine/
│   │   ├── strategy/       # 🧠 STRATEGY 独占
│   │   ├── risk/           # 🛡️ RISK 独占
│   │   ├── executor/       # ⚡ EXEC 独占
│   │   └── automation/     # 🤖 AUTO 独占
│   ├── ipc/                # PM 协调修改
│   └── main.ts             # PM 协调修改
├── src/
│   └── components/
│       ├── trading/        # 🖥️ UI-TRADE 独占
│       ├── dashboard/      # 📈 UI-MON 独占
│       └── settings/       # ⚙️ UI-CONFIG 独占
├── tests/
│   ├── market/             # 📊 MARKET 测试
│   ├── account/            # 💰 ACCOUNT 测试
│   ├── history/            # 📚 HISTORY 测试
│   ├── broker/             # 🏦 FUTU + INTL 测试
│   ├── strategy/           # 🧠 STRATEGY 测试
│   ├── risk/               # 🛡️ RISK 测试
│   ├── executor/           # ⚡ EXEC 测试
│   ├── automation/         # 🤖 AUTO 测试
│   ├── ui-trading/         # 🖥️ UI-TRADE 测试
│   ├── ui-monitor/         # 📈 UI-MON 测试
│   ├── ui-config/          # ⚙️ UI-CONFIG 测试
│   ├── integration/        # 🧪 QA 主导
│   └── performance/        # 🚀 DEVOPS 主导
└── scripts/
    └── devops/             # 🚀 DEVOPS 独占
```

## 14 虾资源分配

| 资源 | 单虾峰值 | 14虾总计 | 可用 | 利用率 |
|------|---------|---------|------|--------|
| CPU核心 | 1.5 | 21 | 24 | **87.5%** |
| 内存 | 400MB | 5.6GB | 64GB | **8.8%** |
| 磁盘IO | 30MB/s | 420MB/s | 3000MB/s | **14%** |

**结论**: CPU 接近满载 (87.5%)，内存充裕，磁盘无压力。

## 测试分片

```bash
# 各虾独立运行自己的测试
npm run test:market      # 📊 MARKET
npm run test:account     # 💰 ACCOUNT
npm run test:history     # 📚 HISTORY
npm run test:broker      # 🏦 FUTU + INTL
npm run test:strategy    # 🧠 STRATEGY
npm run test:risk        # 🛡️ RISK
npm run test:executor    # ⚡ EXEC
npm run test:automation  # 🤖 AUTO
npm run test:ui-trading  # 🖥️ UI-TRADE
npm run test:ui-monitor  # 📈 UI-MON
npm run test:ui-config   # ⚙️ UI-CONFIG
npm run test:integration # 🧪 QA
npm run test:performance # 🚀 DEVOPS

# PM 守护循环运行全量
npm run test:all         # 全量测试
npm run test:ci          # CI模式
```

## 14 虾当前状态映射

> 当前只有 4 个实际 agent，14 虾是角色分工。

| 实际Agent | 承担角色 | 当前状态 |
|-----------|---------|---------|
| 主龙虾 (ML) | 🤖 AUTO + 📈 UI-MON + 🧪 QA | R33 已完成 |
| JVS | 🧠 STRATEGY + 🇭🇰 FUTU | R33 执行中 |
| QClaw | 🛡️ RISK + ⚡ EXEC | R33 执行中 |
| WorkBuddy (PM) | PM 协调 | R33 守护中 |

**需要新增的 10 个 agent 角色**:
📊 MARKET / 💰 ACCOUNT / 📚 HISTORY / 🌍 INTL / 🖥️ UI-TRADE / ⚙️ UI-CONFIG / 🚀 DEVOPS

> 已存在的角色可由现有 agent 继续承担，新增角色需要部署新 agent。

## 契约先行规则 (T+0 to T+5)

```
T+0 min: PM 收集需求 → 确定本轮目标
T+1 min: PM 定义契约 → 更新 contracts/*.ts
T+2 min: PM 广播契约 → chat-bridge
T+3 min: 各虾确认契约 → 确认可 mock 开发
T+4 min: 各虾基于契约 mock → 开始编码
T+5 min: 14 虾全部并行编码 → 最大产出
```

## 冲突仲裁机制

1. **目录隔离**: 各虾只修改自己的目录，冲突概率 <5%
2. **契约变更**: 需 PM 审批，广播后方可修改
3. **跨目录修改**: 需提交 PR 到 PM，PM 合并
4. **git冲突**: 自动检测，PM 仲裁分配修复任务

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-06 | 14虾架构首次发布，从10虾扩展 |
