# Round 29 提案 — QClaw

> 基于项目当前状态制定。Sprint 2 收尾阶段，多券商基础设施就绪，RiskEngine v3 规划完成。

---

## 📊 项目现状 (R28 完成后)

| 维度 | 状态 |
|------|------|
| **测试** | 17 test files, 13 discovered, **355 tests passed** |
| **TSC** | 0 errors |
| **组件** | 30 React 组件, 30 Electron 模块 |
| **核心文件** | risk-engine.ts (24KB), trade-executor.ts (55KB), nl-parser.ts (21KB) |
| **架构** | IBrokerAdapter + UnifiedAccountManager + BrokerManager 多券商架构 |
| **风险** | RiskEngine v3 规划完成（PortfolioVaR/Greeks/熔断） |

---

## 🎯 Round 29 核心方向

**RiskEngine v3 Phase 1 实现 + 回测引擎增强 + 前端性能优化**

---

## 📋 QClaw 任务 (3个)

### 1. [P0] Q-29-01: RiskEngine v3 Phase 1 实现
**目标**: 实施 `riskengine-v3-planning.md` 第一阶段
- `aggregateAccounts()`: 跨 Futu/Moomoo/IB 账户聚合，USD/HKD/SGD 货币转换
- `getMarginUtilization()`: 跨券商保证金占用实时计算
- `getPortfolioExposure()`: 行业/资产类别敞口分析
- `checkCircuitBreaker()`: 账户级熔断（单日亏损 N% 自动禁开新仓）
- 向后兼容: v2 接口（`RiskEngine` 类）保持不变，新增 `RiskEngineV3` 类
- 验收: 50+ new tests, TSC 0 errors

### 2. [P1] Q-29-02: BacktestEngine 增强
**目标**: 将 backtest-enhancer.ts 功能集成到主回测引擎
- Sortino Ratio 计算（已有测试但 engine 未集成）
- Calmar Ratio（最大回撤/年化收益）
- Omega Ratio（概率加权收益/损失）
- Walk-Forward Analysis 可视化（参数稳定性图表）
- 5个现有测试扩展覆盖深度风险指标
- 验收: 20+ new tests

### 3. [P2] Q-29-03: 前端性能优化
**目标**: 落实 `frontend-perf-q26-02.md` P0 建议
- StrategyPage: 添加 `useCallback`/`useMemo` 包装 33 个 state 的计算函数
- MarketPage: ECharts 按需加载（延迟初始化而非首屏）
- LiveMonitorPage: 修复 5 个 useEffect 潜在内存泄漏
- 添加 React DevTools Profiler 基线（首屏 < 3s）
- 验收: Lighthouse Performance > 70 (当前 ~45)

---

## ⏱️ 里程碑

| 时间 | 目标 |
|------|------|
| 09:30 | Q-29-01 P0 完成 (RiskEngineV3 骨架 + aggregateAccounts + 20 tests) |
| 10:30 | Q-29-01 完成 + Q-29-02 开始 |
| 11:30 | Q-29-02 完成 + Q-29-03 开始 |
| 12:30 | Q-29-03 P0 完成，前端性能基准建立 |
| 13:00 | R29 验收 + 广播 |

---

## 🔗 依赖关系

```
Q-29-01 (RiskEngineV3)
  ├── 依赖: riskengine-v3-planning.md (已有)
  └── 为 Q-29-02 提供: getPortfolioExposure() → 回测引擎使用真实保证金数据

Q-29-02 (BacktestEnhancer)
  └── 依赖: Q-29-01 getMarginUtilization() → walk-forward 压力测试使用真实保证金

Q-29-03 (前端性能)
  └── 独立，可并行
```
