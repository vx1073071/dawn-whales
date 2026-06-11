<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# Phase 5.0 用户指南

**版本**: v0.9.0-alpha  
**作者**: dao  
**时间**: 2026-06-07T05:38:00+08:00  

---

## 目录

1. [Phase 5.0 概述](#phase-50-概述)
2. [策略优化引擎](#策略优化引擎)
3. [多周期信号融合](#多周期信号融合)
4. [组合风险分析](#组合风险分析)
5. [实盘交易桥接](#实盘交易桥接)
6. [Walk-Forward 验证](#walk-forward-验证)
7. [策略导入导出](#策略导入导出)
8. [多源数据聚合](#多源数据聚合)
9. [策略排名系统](#策略排名系统)
10. [通知引擎](#通知引擎)
11. [最佳实践](#最佳实践)
12. [常见问题](#常见问题)

---

## Phase 5.0 概述

Phase 5.0 是 DAWN WHALES 项目的智能策略优化与可视化阶段，核心目标：

1. **策略自动优化**: 基于历史表现自动调整策略参数
2. **多周期分析**: 7 个时间周期信号融合
3. **组合风险管理**: VaR/CVaR/相关性矩阵/压力测试
4. **实盘交易**: Paper/Live 模式无缝切换
5. **Walk-Forward 验证**: 防止过拟合的前推验证
6. **多源数据**: 4 个金融数据源聚合
7. **策略市场**: 多维度评分排名

### Phase 5.0 引擎清单

| 引擎 | 行数 | 测试 | 功能 |
|-----|------|------|------|
| StrategyOptimizer | 814L | 27 | 策略参数优化 |
| MultiTimeframeEngine | 656L | 37 | 多周期信号融合 |
| PortfolioRiskEngine | 695L | 27 | 组合风险分析 |
| LiveTradeBridge | 924L | 25 | 实盘交易桥接 |
| WalkForwardEngine | 734L | 18 | 前推验证 |
| StrategyExportImport | 809L | 22 | 策略导入导出 |
| MultiSourceAggregator | 888L | 45 | 多源数据聚合 |
| StrategyRankingEngine | 503L | 23 | 策略排名 |
| NotificationEngine | 346L | 18 | 通知引擎 |

---

## 策略优化引擎

### 概述

StrategyOptimizer 提供 3 种优化模式，支持 5 种优化目标，自动寻找最优参数组合。

### 使用步骤

#### 1. 配置参数范围

```typescript
import { StrategyOptimizer } from './strategy-optimizer';

const optimizer = new StrategyOptimizer({
  mode: 'bayesian',           // 优化模式
  objectives: 'composite',    // 优化目标
  maxIterations: 100,
});

// 设置参数范围
optimizer.setParamSpecs([
  { name: 'fastMA', min: 5, max: 20, step: 1, default: 10 },
  { name: 'slowMA', min: 20, max: 60, step: 5, default: 30 },
  { name: 'rsiPeriod', min: 10, max: 20, step: 1, default: 14 },
]);
```

#### 2. 设置评估函数

```typescript
optimizer.setEvaluateFunction((params) => {
  // 运行回测
  const result = runBacktest(params);
  return {
    params,
    sharpe: result.sharpe,
    totalReturn: result.totalReturn,
    maxDrawdown: result.maxDrawdown,
    winRate: result.winRate,
    tradeCount: result.tradeCount,
    fitness: calculateFitness(result),
    evaluationTimeMs: result.duration,
  };
});
```

#### 3. 开始优化

```typescript
const result = await optimizer.start();
console.log(`最优参数: ${JSON.stringify(result.bestParams)}`);
console.log(`最优适应度: ${result.bestFitness}`);
```

### 优化模式对比

| 模式 | 适用场景 | 速度 | 精度 |
|-----|---------|------|------|
| grid_search | 参数空间小 (<100 组合) | 慢 | 高 |
| random_search | 参数空间大 (>1000 组合) | 快 | 中 |
| bayesian | 昂贵评估函数 | 中 | 高 |

### 优化目标

| 目标 | 说明 | 适用策略 |
|-----|------|---------|
| sharpe | 夏普比率最大化 | 稳健型策略 |
| return | 总收益率最大化 | 激进型策略 |
| drawdown | 最大回撤最小化 | 保守型策略 |
| winRate | 胜率最大化 | 高频策略 |
| composite | 多目标加权 | 通用策略 |

---

## 多周期信号融合

### 概述

MultiTimeframeEngine 支持 7 个时间周期的信号融合，提供 3 种融合模式。

### 使用步骤

#### 1. 初始化引擎

```typescript
import { MultiTimeframeEngine } from './multi-timeframe-engine';

const engine = new MultiTimeframeEngine({
  fusion: {
    mode: 'weighted',           // 融合模式
    minTimeframes: 2,           // 最少周期数
    majorityThreshold: 0.6,     // 多数阈值
  },
});
```

#### 2. 提交信号

```typescript
// 提交 1 小时周期信号
engine.submitSignal({
  timeframe: '1h',
  symbol: 'HK.00700',
  direction: 'BUY',
  strength: 75,
  timestamp: Date.now(),
  strategy: 'MA_CROSS',
});

// 提交 4 小时周期信号
engine.submitSignal({
  timeframe: '4h',
  symbol: 'HK.00700',
  direction: 'BUY',
  strength: 80,
  timestamp: Date.now(),
  strategy: 'RSI',
});
```

#### 3. 获取融合结果

```typescript
engine.on('fusion:result', (result) => {
  console.log(`融合方向: ${result.direction}`);
  console.log(`置信度: ${result.confidence}`);
  console.log(`贡献周期: ${result.contributingTimeframes.join(', ')}`);
});
```

### 融合模式

| 模式 | 逻辑 | 适用场景 |
|-----|------|---------|
| majority | >60% 周期同向 | 趋势确认 |
| weighted | 高周期权重更大 | 稳健策略 |
| any | 任一周期满足阈值 | 敏感策略 |

### 时间周期权重

```
1m:  0.05  (最低)
5m:  0.10
15m: 0.15
30m: 0.15
1h:  0.20
4h:  0.20
1d:  0.15  (较高)
```

---

## 组合风险分析

### 概述

PortfolioRiskEngine 提供完整的组合风险分析，包括 VaR/CVaR、相关性矩阵、压力测试。

### 使用步骤

#### 1. 设置组合

```typescript
import { PortfolioRiskEngine } from './portfolio-risk-engine';

const engine = new PortfolioRiskEngine();

engine.setPortfolio({
  positions: [
    { symbol: 'HK.00700', quantity: 200, avgPrice: 180, currentPrice: 185, marketValue: 37000, weight: 0.4 },
    { symbol: 'HK.09988', quantity: 100, avgPrice: 100, currentPrice: 105, marketValue: 10500, weight: 0.3 },
    { symbol: 'US.AAPL', quantity: 50, avgPrice: 180, currentPrice: 175, marketValue: 8750, weight: 0.3 },
  ],
  totalValue: 100000,
  cashPosition: 43750,
  timestamp: Date.now(),
});
```

#### 2. 添加历史数据

```typescript
engine.addHistoricalReturns('HK.00700', [
  { symbol: 'HK.00700', date: '2024-01-01', return: 0.02 },
  { symbol: 'HK.00700', date: '2024-01-02', return: -0.01 },
  // ... more data
]);
```

#### 3. 计算风险指标

```typescript
const metrics = engine.calculateRiskMetrics();
console.log(`VaR 95%: ${metrics.portfolioVaR.var_95}`);
console.log(`CVaR 95%: ${metrics.portfolioVaR.cvar_95}`);
console.log(`Sharpe: ${metrics.sharpeRatio}`);
console.log(`Max Drawdown: ${metrics.maxDrawdown}`);
```

#### 4. 运行压力测试

```typescript
const stressResult = engine.runStressTest({
  name: '2008 金融危机',
  description: '所有资产 -30%',
  shocks: {
    'HK.00700': -0.30,
    'HK.09988': -0.30,
    'US.AAPL': -0.30,
  },
});

console.log(`压力测试损失: ${stressResult.portfolioLoss}`);
```

### 风险指标说明

| 指标 | 公式 | 说明 |
|-----|------|------|
| VaR | 95% 置信度下最大损失 | 风险度量 |
| CVaR | 超过 VaR 的平均损失 | 尾部风险 |
| Sharpe | (收益 - 无风险) / 波动率 | 风险调整收益 |
| Sortino | (收益 - 无风险) / 下行波动率 | 下行风险调整 |
| Max Drawdown | 最大回撤 | 极端损失 |
| Beta | 与市场的相关性 | 系统性风险 |

---

## 实盘交易桥接

### 概述

LiveTradeBridge 实现 Paper/Live 模式无缝切换，提供风控校验、仓位对账、审计追踪。

### 使用步骤

#### 1. 初始化桥接器

```typescript
import { LiveTradeBridge } from './live-trade-bridge';

const bridge = new LiveTradeBridge({
  mode: 'paper',              // 初始模式
  riskRules: [
    { type: 'concentration', value: 0.3, enabled: true },
    { type: 'daily_loss', value: 0.05, enabled: true },
    { type: 'min_order_size', value: 100, enabled: true },
  ],
});
```

#### 2. 提交订单

```typescript
const result = await bridge.submitOrder({
  symbol: 'HK.00700',
  side: 'BUY',
  quantity: 100,
  type: 'MARKET',
});

console.log(`订单状态: ${result.status}`);
console.log(`风控结果: ${result.riskPassed}`);
```

#### 3. 切换到实盘

```typescript
// 切换到 Live 模式（需要确认）
await bridge.switchMode('live', {
  confirmed: true,
  reason: '策略验证通过',
});
```

#### 4. 仓位对账

```typescript
const reconciliation = await bridge.reconcilePositions();
console.log(`差异数量: ${reconciliation.deltas.length}`);
reconciliation.deltas.forEach(d => {
  console.log(`${d.symbol}: Paper ${d.paperQty} vs Live ${d.liveQty}`);
});
```

### 安全机制

| 机制 | 说明 |
|-----|------|
| 双重确认 | 模式切换需要密码 + 验证码 |
| 资金限制 | 单笔/单日最大金额限制 |
| 频率限制 | 每分钟最大订单数 |
| 异常熔断 | 连续失败自动切换模拟盘 |
| 审计日志 | 所有操作完整记录 |

---

## Walk-Forward 验证

### 概述

WalkForwardEngine 实现步进式前推验证，防止策略过拟合。

### 使用步骤

#### 1. 配置验证参数

```typescript
import { WalkForwardEngine } from './walk-forward-engine';

const engine = new WalkForwardEngine({
  windows: 8,                   // 窗口数量
  inSampleRatio: 0.7,           // 样本内比例
  optimizationObjective: 'sharpe',
  windowType: 'rolling',        // 滚动窗口
  minTrades: 10,
});
```

#### 2. 加载数据

```typescript
const klines = loadHistoricalData('HK.00700', '1d');
engine.setKLines(klines);
```

#### 3. 运行验证

```typescript
const result = await engine.run();
console.log(`平均效率: ${result.averageEfficiency}`);
console.log(`过拟合窗口: ${result.overfitWindows.length}`);
```

### 效率评估

```
效率 = OOS 收益 / IS 收益

效率 > 0.8: 良好（绿色）
效率 0.5-0.8: 警告（黄色）
效率 < 0.5: 过拟合（红色）
```

---

## 策略导入导出

### 概述

StrategyExportImport 支持 JSON/YAML 格式的策略导入导出，提供版本管理和冲突解决。

### 使用步骤

#### 1. 导出策略

```typescript
import { StrategyExportImport } from './strategy-export-import';

const exporter = new StrategyExportImport();

const result = await exporter.exportStrategies({
  strategyIds: ['s1', 's2', 's3'],
  format: 'json',
  includeHistory: true,
});

console.log(`导出文件: ${result.filePath}`);
console.log(`策略数量: ${result.strategyCount}`);
```

#### 2. 导入策略

```typescript
const importResult = await exporter.importStrategies({
  filePath: './strategies.json',
  conflictPolicy: 'merge',      // overwrite / merge / skip / rename
  validate: true,
});

console.log(`导入成功: ${importResult.importedCount}`);
console.log(`冲突数量: ${importResult.conflictCount}`);
```

### 冲突解决策略

| 策略 | 说明 |
|-----|------|
| overwrite | 覆盖现有策略 |
| merge | 合并参数 |
| skip | 跳过冲突策略 |
| rename | 重命名导入策略 |

---

## 多源数据聚合

### 概述

MultiSourceAggregator 聚合 4 个金融数据源，提供优先级降级和共识评分。

### 使用步骤

#### 1. 初始化聚合器

```typescript
import { MultiSourceAggregator } from './multi-source-aggregator';

const aggregator = new MultiSourceAggregator({
  sources: [
    { id: 'eastmoney', priority: 1, enabled: true },
    { id: 'sina', priority: 2, enabled: true },
    { id: 'tencent', priority: 3, enabled: true },
    { id: 'xueqiu', priority: 4, enabled: true },
  ],
});
```

#### 2. 获取数据

```typescript
const data = await aggregator.getData('HK.00700');
console.log(`聚合价格: ${data.price}`);
console.log(`共识评分: ${data.consensusScore}`);
console.log(`数据源数量: ${data.sources.length}`);
```

#### 3. 监控健康状态

```typescript
aggregator.on('source:down', (health) => {
  console.log(`数据源宕机: ${health.id}`);
  console.log(`错误信息: ${health.lastError}`);
});
```

### 数据源优先级

```
东方财富: 1 (最高)
新浪财经: 2
腾讯财经: 3
雪球:     4 (最低)
```

---

## 策略排名系统

### 概述

StrategyRankingEngine 提供 8 维度加权评分和 S/A/B/C/D 分级。

### 使用步骤

#### 1. 初始化排名引擎

```typescript
import { StrategyRankingEngine } from './strategy-ranking-engine';

const engine = new StrategyRankingEngine({
  dimensions: ['sharpe', 'return', 'drawdown', 'winRate', 'calmar'],
  weights: {
    sharpe: 0.25,
    return: 0.20,
    drawdown: 0.20,
    winRate: 0.15,
    calmar: 0.20,
  },
  minTrades: 10,
  minHistoryDays: 30,
});
```

#### 2. 提交策略指标

```typescript
const metrics = [
  {
    strategyId: 's1',
    name: 'MA Cross',
    sharpe: 1.5,
    totalReturn: 0.25,
    maxDrawdown: -0.10,
    winRate: 0.60,
    tradeCount: 50,
    calmar: 2.5,
    sortino: 1.8,
    profitFactor: 1.5,
    avgHoldingDays: 5,
  },
  // ... more strategies
];
```

#### 3. 获取排名

```typescript
const result = engine.rankStrategies(metrics);
console.log(`排名第一: ${result.rankings[0].name} (${result.rankings[0].tier})`);
console.log(`得分: ${result.rankings[0].score}`);
```

### 分级标准

| 等级 | 分数 | 说明 |
|-----|------|------|
| S | 90-100 | 顶级策略 |
| A | 75-89 | 优秀策略 |
| B | 60-74 | 良好策略 |
| C | 40-59 | 一般策略 |
| D | 0-39 | 较差策略 |

---

## 通知引擎

### 概述

NotificationEngine 提供多渠道通知（应用内/邮件/Webhook），支持规则引擎和优先级排序。

### 使用步骤

#### 1. 初始化通知引擎

```typescript
import { NotificationEngine } from './notification-engine';

const engine = new NotificationEngine({
  channels: [
    { type: 'in_app', enabled: true },
    { type: 'email', enabled: true, config: { smtp: '...' } },
    { type: 'webhook', enabled: true, config: { url: '...' } },
  ],
});
```

#### 2. 创建通知规则

```typescript
engine.addRule({
  id: 'rule-1',
  name: '策略信号通知',
  condition: 'signal.strength > 80',
  channels: ['in_app', 'email'],
  priority: 'high',
  cooldownMs: 300000,           // 5 分钟冷却
});
```

#### 3. 发送通知

```typescript
engine.send({
  title: '买入信号',
  message: 'HK.00700 强度 85',
  priority: 'high',
  metadata: { symbol: 'HK.00700', strength: 85 },
});
```

---

## 最佳实践

### 策略优化

1. **参数范围合理**: 避免过大参数空间
2. **样本外验证**: 必须使用 Walk-Forward 验证
3. **多目标平衡**: 不要只优化单一指标
4. **效率阈值**: 效率 < 0.5 视为过拟合

### 多周期分析

1. **周期选择**: 至少 3 个周期融合
2. **权重配置**: 高周期权重更大
3. **陈旧检测**: 启用陈旧信号过滤
4. **融合模式**: 趋势确认用 majority

### 风险管理

1. **VaR 监控**: 每日计算 VaR
2. **压力测试**: 定期运行压力场景
3. **相关性**: 避免高相关性持仓
4. **止损设置**: 必须设置止损

### 实盘交易

1. **模拟先行**: 至少 1 个月模拟盘
2. **小仓位**: 初始仓位不超过 10%
3. **风控开启**: 所有风控规则启用
4. **审计日志**: 定期检查审计日志

---

## 常见问题

### Q1: 优化后策略表现下降？

**A**: 可能过拟合。检查 Walk-Forward 效率，效率 < 0.5 需要重新优化。

### Q2: 多周期信号冲突？

**A**: 使用 weighted 融合模式，高周期权重更大，减少短期噪音。

### Q3: VaR 计算不准确？

**A**: 确保历史数据 > 100 天，使用历史模拟法更准确。

### Q4: 实盘订单失败？

**A**: 检查风控规则，确认资金充足，查看审计日志错误原因。

### Q5: 数据源不可用？

**A**: MultiSourceAggregator 自动降级，检查健康状态，启用备用源。

---

## 附录

### Phase 5.0 版本历史

| 版本 | 日期 | 主要更新 |
|-----|------|---------|
| v0.8.0 | 2026-06-07 | Phase 4.4 + 5.0 引擎 |
| v0.9.0-alpha | 2026-06-07 | MultiSource + Ranking + Notification |

### 相关文档

- [StrategyOptimizer API](./api/strategy-optimizer-api.md)
- [MultiTimeframeEngine API](./api/multi-timeframe-api.md)
- [PortfolioRiskEngine API](./api/portfolio-risk-api.md)
- [Live Trading 架构](./architecture/live-trading-architecture.md)
- [Phase 5.0 架构](./architecture/phase5-architecture.md)

---

**文档生成**: dao  
**时间**: 2026-06-07T05:38:00+08:00  
**版本**: v0.9.0-alpha  
**状态**: Phase 5.0 用户指南完成
