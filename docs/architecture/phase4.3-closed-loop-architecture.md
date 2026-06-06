# Phase 4.3 闭环执行架构文档

> 版本: v1.0 | 2026-06-06 R35 | ML-35-03

---

## 一、Phase 4.3 概述

Phase 4.3 实现了从"策略触发"到"持仓管理"再到"绩效追踪"的完整闭环执行链路。

### 核心组件

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────┐
│ StrategyEngine│───▶│ ClosedLoopExecutor│───▶│ TradeExecutor │
└─────────────┘    └──────────────────┘    └───────────────┘
                          │                         │
                          ▼                         ▼
                   ┌──────────────┐         ┌───────────────┐
                   │PositionMonitor│◀────────│   Broker API  │
                   └──────────────┘         └───────────────┘
                          │
                          ▼
                   ┌──────────────────┐
                   │PerformanceTracker│
                   └──────────────────┘
                          │
                          ▼
                   ┌──────────────────┐
                   │ RebalanceEngine  │
                   └──────────────────┘
```

---

## 二、ClosedLoopExecutor 状态机

### 状态定义 (13 状态)

```
     ┌──▶ CREATED ──▶ VALIDATING ──▶ VALIDATED ──▶ EXECUTING
     │                                                  │
  IDLE                                                  ▼
     ▲                                               ACTIVE
     │                                                  │
  FAILED ◀──────────────────────────────────────────────┤
     │                                                  │
     │    ┌──────── MONITORING ◀────────────────────────┤
     │    │            │                                │
     │    │            ▼                                │
     │    │        ADJUSTING ──▶ CLOSING ──▶ CLOSED ──▶ COMPLETED
     │    │                                │
     │    └────────────────────────────────┘
     │
     └── CANCELLED
```

### 状态转换规则

| 源状态 | 目标状态 | 条件 |
|--------|---------|------|
| IDLE | CREATED | 创建新 loop |
| CREATED | VALIDATING | 启动 loop |
| CREATED | CANCELLED | 用户取消 |
| VALIDATING | VALIDATED | 验证通过 |
| VALIDATING | FAILED | 验证失败 |
| VALIDATED | EXECUTING | 开始执行 |
| VALIDATED | CANCELLED | 用户取消 |
| EXECUTING | ACTIVE | 下单成功 |
| EXECUTING | FAILED | 下单失败 |
| ACTIVE | MONITORING | 进入监控 |
| ACTIVE | CLOSING | 触发退出 |
| ACTIVE | ADJUSTING | 触发调整 |
| MONITORING | ADJUSTING | 需要调整 |
| MONITORING | CLOSING | 止损/止盈/时间到 |
| MONITORING | ACTIVE | 价格正常 |
| ADJUSTING | ACTIVE | 调整完成 |
| ADJUSTING | MONITORING | 继续监控 |
| CLOSING | CLOSED | 平仓完成 |
| CLOSING | FAILED | 平仓失败 |
| CLOSED | COMPLETED | 最终状态 |
| FAILED | CREATED | 重试 |

### 三种执行模式

| 模式 | 触发方式 | 使用场景 |
|------|---------|---------|
| **immediate** | 手动/API 调用 | 人工交易、紧急平仓 |
| **triggered** | ConditionEngine 条件满足 | 自动化策略 |
| **scheduled** | CronScheduler 定时触发 | 定投、定期再平衡 |

### 风控前置 (Pre-Flight Checks)

1. **策略存在性**: config.strategyId 非空
2. **标的有效性**: symbol 非空
3. **条件完整性**: triggered 模式必须有 conditions
4. **止损合理性**: stopLoss > 0
5. **止盈 > 止损**: takeProfit > stopLoss
6. **冷却期**: Date.now() >= cooldownUntil
7. **日亏损限制**: dailyLoss < maxDailyLoss

### 重试策略

| 策略 | 算法 | 适用 |
|------|------|------|
| Fixed | 固定间隔 | 网络抖动 |
| Exponential | 2^n × 1000ms (max 60s) | 服务暂不可用 |
| Adaptive | 根据错误类型动态选择 | 混合场景 |

---

## 三、RebalanceEngine 策略说明

### 五种再平衡方法

| 方法 | 描述 | 计算方式 |
|------|------|---------|
| **equal_weight** | 等权重 | 每个标的 = 1/N |
| **target_weight** | 目标权重 | 用户指定比例 |
| **risk_parity** | 风险平价 | 按波动率倒数加权 |
| **minimum_variance** | 最小方差 | 协方差矩阵优化 (当前简化为等权) |
| **custom** | 自定义 | 回调函数 |

### 四种触发器

| 触发器 | 机制 | 参数 |
|--------|------|------|
| **threshold** | 权重偏离超过阈值 | threshold% |
| **periodic** | 定时触发 | cron 表达式 |
| **drift** | 价格漂移超过阈值 | drift% |
| **signal** | 外部信号触发 | 事件驱动 |
| **manual** | 手动触发 | 用户操作 |

### 约束引擎

| 约束 | 说明 |
|------|------|
| minTradeSize | 最小交易金额 |
| maxTradeSize | 最大交易金额 |
| maxPositions | 最大持仓数 |
| maxTurnover | 最大换手率(%) |
| minCashBuffer | 最低现金缓冲 |
| excludeSymbols | 排除标的 |

### 再平衡流程

```
1. needsRebalance(config, positions)
   └─ 检查持仓权重偏离是否超过阈值
   
2. calculateTargetWeights(config, totalValue)
   └─ 根据 method 计算目标权重
   
3. 计算每个头寸的 drift = currentWeight - targetWeight
   
4. 生成 trades:
   ├─ drift > threshold → SELL
   └─ drift < -threshold → BUY
   
5. 应用约束 (maxTradeSize, minTradeSize, maxTurnover)
   
6. 返回 RebalancePlan { trades, turnoverPct, costBasis }
```

---

## 四、PositionMonitor 监控引擎

### 监控维度

| 维度 | 触发条件 | 动作 |
|------|---------|------|
| **止损** | currentPrice ≤ stopLoss | 立即平仓 |
| **止盈** | currentPrice ≥ takeProfit | 立即平仓 |
| **追踪止损** | trailingStop 激活 | 动态调整止损价 |
| **时间退出** | 持仓时长 ≥ maxPositionTime | 到期平仓 |
| **熔断** | dailyLoss ≥ maxDailyLoss | 停止当日所有交易 |

### 数据流

```
OpenD WS Quote → PositionMonitor.updatePrice()
                → checkStopLoss(currentPrice)
                → checkTakeProfit(currentPrice)
                → checkTrailingStop(currentPrice)
                → checkTimeExit(openTime)
                → 触发事件 → TradeExecutor.placeOrder(CLOSE)
```

---

## 五、PerformanceTracker 绩效引擎

### 核心指标

| 指标 | 公式 | 参考值 |
|------|------|--------|
| **Sharpe** | (Rp - Rf) / σp | >1 良好, >2 优秀 |
| **Sortino** | (Rp - Rf) / σd | 仅用下行波动率 |
| **Calmar** | Rp / MaxDD | >1 良好 |
| **ProfitFactor** | ΣGain / ΣLoss | >1.5 良好 |
| **WinRate** | Wins / Total | >50% 及格 |
| **MaxDD** | max(peak - trough) | 越小越好 |

### 数据聚合

```
per-trade → daily → weekly → monthly → yearly
每笔记录:
  - entryPrice, exitPrice
  - pnl, pnlPct
  - duration
  - strategyId, configId
```

---

## 六、UI 组件层

### PerformanceDashboard

- **KPI 卡片**: 总收益 / 年化收益 / 最大回撤 / 胜率
- **风险指标**: Sharpe / Sortino / Calmar / ProfitFactor
- **权益曲线**: SVG sparkline
- **交易统计**: 盈亏次数 / 平均盈亏 / 连赢连亏
- **极值月份**: 最佳/最差月份可视化

### PositionMonitorPanel

- **实时持仓列表**: 代码/名称/数量/均价/现价/盈亏
- **颜色状态**: 绿(盈)/红(亏)/黄(近止损)
- **止损止盈编辑器**: 内联修改, Enter 确认
- **一键平仓**: 批量市价平仓 (防重复点击)
- **IPC 模式**: `live=true` 通过 bridge-api 读取真实数据
- **自动刷新**: 可配置间隔

---

## 七、文件索引

| 文件 | 行数 | 说明 |
|------|------|------|
| `electron/engine/closed-loop-executor.ts` | ~635 | 闭环执行器状态机 |
| `electron/engine/rebalance-engine.ts` | ~465 | 再平衡引擎 |
| `electron/engine/position-monitor.ts` | ~500 | 持仓监控引擎 |
| `electron/engine/performance-tracker.ts` | ~400 | 绩效追踪器 |
| `src/components/dashboard/PerformanceDashboard.tsx` | ~380 | 绩效仪表盘 |
| `src/components/trading/PositionMonitorPanel.tsx` | ~440 | 持仓监控面板 |
| `src/components/trading/ConditionRulePanel.tsx` | ~320 | 条件规则面板 |
| `src/components/trading/TradingCalendarView.tsx` | ~368 | 交易日历视图 |

---

## 八、下一步 (Phase 4.4)

- [ ] 闭环 E2E 自动化测试覆盖
- [ ] PerformanceTracker 实盘数据接入
- [ ] RebalanceEngine 多时间框架
- [ ] v0.8.0 Release
