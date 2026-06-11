# Round 34 最终方案 — 14虾首航

> PM定案版 | 2026-06-06 13:10 | v0.7.0 → v0.8.0-alpha

## 项目现状 (13:10)

| 指标 | 数值 |
|------|------|
| tsc --noEmit | ✅ 0 errors |
| npm run build | ✅ 0 errors |
| npm test | ✅ **1311 passed / 0 failed / 8 skipped** |
| 版本 | v0.7.0 (已发布) |
| 14虾基建 | ✅ 全部完成 |

**历史性里程碑**: 全量测试 **0 failed**！QClaw/ML 清场任务完美收官。

## 14虾首航主题

**v0.8.0-alpha 冲刺**: Phase 4.3 闭环执行引擎 + 全虾就位首次并行

## 任务分配

### 数据层

#### 📊 行情数据虾 (agent-market)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| M-34-01 | WS行情缓存层优化 | P0 | `electron/data/market/cache.ts` >=300L, 延迟<50ms |
| M-34-02 | K线历史数据聚合 | P1 | 支持1m/5m/15m/1h/1d, 5+ tests |

#### 💰 账户数据虾 (agent-account)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| A-34-01 | PositionMonitor完善 | P0 | 持仓同步+实时盈亏, 10+ tests |
| A-34-02 | 订单簿本地缓存 | P1 | `electron/data/account/order-cache.ts` >=200L |

#### 📚 历史数据虾 (agent-history)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| H-34-01 | 历史行情存储引擎 | P0 | SQLite时序表+查询API, 8+ tests |
| H-34-02 | 数据回放功能 | P1 | 支持指定日期回放tick数据 |

### 券商层

#### 🇭🇰 富途适配虾 (agent-futu)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| F-34-01 | Futu OpenD实时连接 | P0 | TCP重连+心跳, 连接状态IPC |
| F-34-02 | 港股期权链获取 | P1 | 完整期权链+到期日筛选 |

#### 🌍 海外券商虾 (agent-intl)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| I-34-01 | IB Gateway骨架完善 | P0 | `electron/broker/ib-adapter.ts` 补充真实连接 |
| I-34-02 | Moomoo TCP适配优化 | P1 | 继承OpenDBaseAdapter, 减少重复代码 |

### 引擎层

#### 🧠 策略虾 (agent-strategy)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| S-34-01 | NL Parser复合条件 | P0 | "A>100 AND B<50"解析, 8+ tests |
| S-34-02 | 策略模板系统 | P1 | 3个预设策略模板 (均线/突破/反转) |

#### 🛡️ 风控虾 (agent-risk)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| R-34-01 | RiskEngine缓存优化 | P0 | 风控延迟<10ms, 5+ tests |
| R-34-02 | 回撤实时监控 | P1 | 最大回撤计算+告警触发 |

#### ⚡ 执行虾 (agent-exec)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| E-34-01 | TradeExecutor重试机制 | P0 | Fixed/Exponential/Adaptive, 10+ tests |
| E-34-02 | 订单状态机完善 | P1 | 10状态完整转换, tsc 0 errors |

#### 🤖 自动化虾 (agent-auto)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| AU-34-01 | **ClosedLoopExecutor实现** | P0 | >=600L, 10状态机, 15+ tests |
| AU-34-02 | **RebalanceEngine骨架** | P0 | >=400L, 3种触发+3种执行, 8+ tests |
| AU-34-03 | TradingCalendar集成 | P1 | 非交易时段自动跳过调度 |

### UI层

#### 🖥️ 交易UI虾 (agent-ui-trade)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| UIT-34-01 | PositionMonitorPanel完善 | P0 | 实时刷新+颜色指示+一键平仓 |
| UIT-34-02 | 快速下单组件 | P1 | 预设模板+快捷键支持 |

#### 📈 监控UI虾 (agent-ui-mon)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| UIM-34-01 | **PerformanceDashboard实现** | P0 | Sharpe/Sortino/Calmar可视化 |
| UIM-34-02 | SystemHealthPanel完善 | P1 | 14虾状态实时显示(集成AgentDashboard) |

#### ⚙️ 配置UI虾 (agent-ui-config)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| UIC-34-01 | 策略配置面板 | P0 | 条件规则CRUD+参数调优 |
| UIC-34-02 | 券商连接配置 | P1 | Futu/Moomoo/IB连接参数UI |

### 基础设施

#### 🧪 QA虾 (agent-qa)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| QA-34-01 | **测试扩量至1500+** | P0 | 新增200+ tests, 0 fail |
| QA-34-02 | 性能基准报告 | P1 | 延迟/内存/CPU报告 >=200L |
| QA-34-03 | 并发测试验证 | P1 | 14进程chat-bridge写入无冲突 |

#### 🚀 DevOps虾 (agent-devops)
| # | 任务 | 优先级 | 验收标准 |
|---|------|--------|---------|
| D-34-01 | GitHub Actions CI配置 | P0 | `.github/workflows/ci.yml` 完整配置 |
| D-34-02 | 版本发布脚本 | P1 | `npm run release` 一键发布 |

### PM虾 (WorkBuddy)

| # | 任务 | 优先级 |
|---|------|--------|
| PM-34-01 | R34方案广播 (本消息) | P0 |
| PM-34-02 | Build/Test守护循环 (0 fail目标) | P0 |
| PM-34-03 | 契约维护更新 | P1 |
| PM-34-04 | 14虾状态监控 | P1 |

## 里程碑

| 时间 | 目标 |
|------|------|
| 13:15 | 14虾全部启动运行 |
| 13:30 | ClosedLoopExecutor + RebalanceEngine 骨架完成 |
| 13:45 | PerformanceDashboard + PositionMonitorPanel 完成 |
| 14:00 | 测试扩量至1500+, 0 fail |
| 14:15 | CI配置 + 版本发布脚本完成 |
| 14:30 | R34验收, v0.8.0-alpha发布 |

## 关键决策

1. **14虾首航**: 从R34永久使用14独立agent架构
2. **v0.8.0-alpha目标**: ClosedLoopExecutor + RebalanceEngine + PerformanceDashboard三大核心组件
3. **0 fail铁律**: 新增代码必须带测试，不接受回归
4. **契约先行**: 各agent只修改自己目录的文件，跨目录调用走contracts/
5. **Token预算**: 预估R34消耗~800k tokens，监控实际使用

## 产出文件

- `docs/tasks/round34-plan-final-pm.md` (本文件)
- `electron/engine/closed-loop-executor.ts` (AU-34-01)
- `electron/engine/rebalance-engine.ts` (AU-34-02)
- `src/components/dashboard/PerformanceDashboard.tsx` (UIM-34-01)
- `.github/workflows/ci.yml` (D-34-01)
