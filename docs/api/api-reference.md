<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# quant-moo API 参考文档

**版本**: v0.13.0  
**更新日期**: 2026-06-07  
**作者**: dao  
**状态**: Phase 6.4 完整 API 参考

---

## 目录

1. [概述](#概述)
2. [策略引擎 API](#策略引擎-api)
3. [回测引擎 API](#回测引擎-api)
4. [优化引擎 API](#优化引擎-api)
5. [Marketplace API](#marketplace-api)
6. [AI 助理 API](#ai-助理-api)
7. [多账户 API](#多账户-api)
8. [性能监控 API](#性能监控-api)
9. [数据管道 API](#数据管道-api)
10. [WebSocket API](#websocket-api)

---

## 概述

### API 架构

```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
│  - StrategyPage / BacktestPage / ...    │
└───────────────┬─────────────────────────┘
                │ IPC
┌───────────────┴─────────────────────────┐
│         Main Process (Electron)         │
│  - StrategyEngine                       │
│  - BacktestEngine                       │
│  - OptimizationEngine                   │
│  - MarketplaceAPI                       │
│  - AIAssistant                          │
│  - MultiAccountManager                  │
│  - PerformanceMonitor                   │
│  - DataPipeline                         │
└───────────────┬─────────────────────────┘
                │
┌───────────────┴─────────────────────────┐
│         External Services               │
│  - Futu OpenD / Moomoo OpenD            │
│  - Database (SQLite)                    │
│  - WebSocket Server                     │
└─────────────────────────────────────────┘
```

### API 分类

| 类别 | 模块 | 说明 |
|-----|------|------|
| 策略引擎 | StrategyEngine | 策略创建、管理、执行 |
| 回测引擎 | BacktestEngine | 历史数据回测 |
| 优化引擎 | OptimizationEngine | 参数优化 |
| Marketplace | MarketplaceAPI | 策略市场 |
| AI 助理 | AIAssistant | 智能助手 |
| 多账户 | MultiAccountManager | 账户管理 |
| 性能监控 | PerformanceMonitor | 性能指标 |
| 数据管道 | DataPipeline | 数据处理 |
| WebSocket | WebSocketServer | 实时数据 |

---

## 策略引擎 API

### StrategyEngine

策略引擎负责策略的创建、管理和执行。

#### 创建策略

```typescript
interface CreateStrategyRequest {
  name: string;
  description: string;
  type: 'template' | 'ai' | 'manual';
  code: string;
  params: Record<string, any>;
}

interface CreateStrategyResponse {
  strategyId: string;
  createdAt: string;
  status: 'created' | 'error';
  error?: string;
}

// 示例
const response = await strategyEngine.createStrategy({
  name: '双均线策略',
  description: '基于 10/30 均线的交叉策略',
  type: 'template',
  code: '...',
  params: { fastPeriod: 10, slowPeriod: 30 },
});
```

#### 获取策略列表

```typescript
interface GetStrategiesRequest {
  page?: number;
  pageSize?: number;
  filter?: {
    type?: string;
    status?: string;
  };
}

interface GetStrategiesResponse {
  strategies: Strategy[];
  total: number;
  page: number;
  pageSize: number;
}

interface Strategy {
  id: string;
  name: string;
  description: string;
  type: string;
  params: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive';
}

// 示例
const response = await strategyEngine.getStrategies({
  page: 1,
  pageSize: 20,
  filter: { type: 'template' },
});
```

#### 更新策略

```typescript
interface UpdateStrategyRequest {
  strategyId: string;
  name?: string;
  description?: string;
  params?: Record<string, any>;
  code?: string;
}

interface UpdateStrategyResponse {
  strategyId: string;
  updatedAt: string;
  status: 'updated' | 'error';
  error?: string;
}

// 示例
const response = await strategyEngine.updateStrategy({
  strategyId: 'strat_001',
  params: { fastPeriod: 12, slowPeriod: 26 },
});
```

#### 删除策略

```typescript
interface DeleteStrategyRequest {
  strategyId: string;
}

interface DeleteStrategyResponse {
  strategyId: string;
  status: 'deleted' | 'error';
  error?: string;
}

// 示例
const response = await strategyEngine.deleteStrategy({
  strategyId: 'strat_001',
});
```

#### 执行策略

```typescript
interface ExecuteStrategyRequest {
  strategyId: string;
  symbol: string;
  quantity: number;
}

interface ExecuteStrategyResponse {
  executionId: string;
  status: 'executing' | 'completed' | 'error';
  trades: Trade[];
  error?: string;
}

interface Trade {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
}

// 示例
const response = await strategyEngine.executeStrategy({
  strategyId: 'strat_001',
  symbol: 'HK.00700',
  quantity: 100,
});
```

---

## 回测引擎 API

### BacktestEngine

回测引擎负责历史数据回测。

#### 运行回测

```typescript
interface RunBacktestRequest {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  commission: number;
  slippage: number;
}

interface RunBacktestResponse {
  backtestId: string;
  status: 'running' | 'completed' | 'error';
  result?: BacktestResult;
  error?: string;
}

interface BacktestResult {
  totalReturn: number;
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  equityCurve: EquityPoint[];
  trades: Trade[];
}

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

// 示例
const response = await backtestEngine.runBacktest({
  strategyId: 'strat_001',
  symbol: 'HK.00700',
  startDate: '2023-01-01',
  endDate: '2024-12-31',
  initialCapital: 100000,
  commission: 0.0003,
  slippage: 0.001,
});
```

#### 获取回测结果

```typescript
interface GetBacktestRequest {
  backtestId: string;
}

interface GetBacktestResponse {
  backtestId: string;
  status: 'running' | 'completed' | 'error';
  result?: BacktestResult;
  error?: string;
}

// 示例
const response = await backtestEngine.getBacktest({
  backtestId: 'bt_001',
});
```

#### 导出回测报告

```typescript
interface ExportBacktestRequest {
  backtestId: string;
  format: 'pdf' | 'excel' | 'json';
}

interface ExportBacktestResponse {
  backtestId: string;
  format: string;
  filePath: string;
  status: 'exported' | 'error';
  error?: string;
}

// 示例
const response = await backtestEngine.exportBacktest({
  backtestId: 'bt_001',
  format: 'pdf',
});
```

---

## 优化引擎 API

### OptimizationEngine

优化引擎负责策略参数优化。

#### 运行优化

```typescript
interface RunOptimizationRequest {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  mode: 'grid' | 'random' | 'bayesian';
  objective: 'sharpe' | 'return' | 'drawdown';
  paramRanges: ParamRange[];
}

interface ParamRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

interface RunOptimizationResponse {
  optimizationId: string;
  status: 'running' | 'completed' | 'error';
  result?: OptimizationResult;
  error?: string;
}

interface OptimizationResult {
  bestParams: Record<string, number>;
  bestObjective: number;
  iterations: number;
  history: OptimizationPoint[];
  paretoFront?: ParetoPoint[];
}

interface OptimizationPoint {
  params: Record<string, number>;
  objective: number;
  iteration: number;
}

interface ParetoPoint {
  params: Record<string, number>;
  objectives: Record<string, number>;
}

// 示例
const response = await optimizationEngine.runOptimization({
  strategyId: 'strat_001',
  symbol: 'HK.00700',
  startDate: '2023-01-01',
  endDate: '2024-12-31',
  mode: 'bayesian',
  objective: 'sharpe',
  paramRanges: [
    { name: 'fastPeriod', min: 5, max: 20, step: 1 },
    { name: 'slowPeriod', min: 20, max: 60, step: 5 },
  ],
});
```

#### 运行 Walk-Forward 验证

```typescript
interface RunWalkForwardRequest {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  windows: number;
  inSampleRatio: number;
  windowType: 'rolling' | 'expanding';
}

interface RunWalkForwardResponse {
  walkForwardId: string;
  status: 'running' | 'completed' | 'error';
  result?: WalkForwardResult;
  error?: string;
}

interface WalkForwardResult {
  windows: WalkForwardWindow[];
  averageEfficiency: number;
  overfittingDetected: boolean;
}

interface WalkForwardWindow {
  windowIndex: number;
  inSampleStart: string;
  inSampleEnd: string;
  outSampleStart: string;
  outSampleEnd: string;
  inSampleReturn: number;
  outSampleReturn: number;
  efficiency: number;
  optimizedParams: Record<string, number>;
}

// 示例
const response = await optimizationEngine.runWalkForward({
  strategyId: 'strat_001',
  symbol: 'HK.00700',
  startDate: '2023-01-01',
  endDate: '2024-12-31',
  windows: 8,
  inSampleRatio: 0.7,
  windowType: 'rolling',
});
```

---

## Marketplace API

### MarketplaceAPI

Marketplace API 负责策略市场的搜索、筛选、详情、订阅。

#### 搜索策略

```typescript
interface SearchStrategiesRequest {
  query: string;
  filters?: {
    tags?: string[];
    minRating?: number;
    minSharpe?: number;
    priceRange?: { min?: number; max?: number };
  };
  sort?: 'rating' | 'downloads' | 'sharpe' | 'newest';
  page?: number;
  pageSize?: number;
}

interface SearchStrategiesResponse {
  strategies: MarketplaceStrategy[];
  total: number;
  page: number;
  pageSize: number;
}

interface MarketplaceStrategy {
  id: string;
  name: string;
  description: string;
  author: string;
  rating: number;
  ratingCount: number;
  downloads: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  tags: string[];
  price?: number;
  createdAt: string;
}

// 示例
const response = await marketplaceAPI.searchStrategies({
  query: '双均线',
  filters: {
    tags: ['趋势', '港股'],
    minRating: 4,
    minSharpe: 1.5,
  },
  sort: 'rating',
  page: 1,
  pageSize: 20,
});
```

#### 获取策略详情

```typescript
interface GetStrategyDetailRequest {
  strategyId: string;
}

interface GetStrategyDetailResponse {
  strategy: MarketplaceStrategyDetail;
  status: 'found' | 'not_found';
}

interface MarketplaceStrategyDetail extends MarketplaceStrategy {
  fullDescription: string;
  backtestResult: BacktestResult;
  reviews: Review[];
  subscriptionCount: number;
  updatedAt: string;
}

interface Review {
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// 示例
const response = await marketplaceAPI.getStrategyDetail({
  strategyId: 'strat_001',
});
```

#### 订阅策略

```typescript
interface SubscribeStrategyRequest {
  strategyId: string;
  subscriptionType: 'free' | 'monthly' | 'yearly';
}

interface SubscribeStrategyResponse {
  subscriptionId: string;
  strategyId: string;
  status: 'subscribed' | 'error';
  expiresAt?: string;
  error?: string;
}

// 示例
const response = await marketplaceAPI.subscribeStrategy({
  strategyId: 'strat_001',
  subscriptionType: 'monthly',
});
```

#### 评价策略

```typescript
interface ReviewStrategyRequest {
  strategyId: string;
  rating: number;
  comment: string;
}

interface ReviewStrategyResponse {
  reviewId: string;
  strategyId: string;
  status: 'submitted' | 'error';
  error?: string;
}

// 示例
const response = await marketplaceAPI.reviewStrategy({
  strategyId: 'strat_001',
  rating: 5,
  comment: '非常优秀的策略，夏普比率很高！',
});
```

---

## AI 助理 API

### AIAssistant

AI 助理提供智能助手功能。

#### 策略建议

```typescript
interface GetStrategySuggestionRequest {
  market: string;
  riskLevel: 'low' | 'medium' | 'high';
  investmentHorizon: 'short' | 'medium' | 'long';
}

interface GetStrategySuggestionResponse {
  suggestions: StrategySuggestion[];
  status: 'success' | 'error';
  error?: string;
}

interface StrategySuggestion {
  strategyType: string;
  description: string;
  expectedSharpe: { min: number; max: number };
  params: Record<string, any>;
  reasoning: string;
}

// 示例
const response = await aiAssistant.getStrategySuggestion({
  market: '港股',
  riskLevel: 'medium',
  investmentHorizon: 'medium',
});
```

#### 风险问答

```typescript
interface AskRiskQuestionRequest {
  question: string;
  context?: {
    strategyId?: string;
    portfolioValue?: number;
  };
}

interface AskRiskQuestionResponse {
  answer: string;
  references: string[];
  status: 'success' | 'error';
  error?: string;
}

// 示例
const response = await aiAssistant.askRiskQuestion({
  question: '如何控制最大回撤？',
  context: {
    portfolioValue: 1000000,
  },
});
```

#### NL 回测配置

```typescript
interface ParseNLBacktestRequest {
  naturalLanguage: string;
}

interface ParseNLBacktestResponse {
  config: BacktestConfig;
  confidence: number;
  status: 'parsed' | 'error';
  error?: string;
}

interface BacktestConfig {
  strategyId?: string;
  symbol: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  params?: Record<string, any>;
}

// 示例
const response = await aiAssistant.parseNLBacktest({
  naturalLanguage: '用腾讯股票回测双均线策略，快线 10 慢线 30，从 2023 年到 2024 年',
});
```

---

## 多账户 API

### MultiAccountManager

多账户管理器负责账户的添加、切换、隔离。

#### 添加账户

```typescript
interface AddAccountRequest {
  name: string;
  type: 'real' | 'paper';
  broker: 'futu' | 'moomoo';
  apiKey: string;
  apiSecret: string;
}

interface AddAccountResponse {
  accountId: string;
  status: 'added' | 'error';
  error?: string;
}

// 示例
const response = await multiAccountManager.addAccount({
  name: '个人实盘',
  type: 'real',
  broker: 'futu',
  apiKey: '...',
  apiSecret: '...',
});
```

#### 切换账户

```typescript
interface SwitchAccountRequest {
  accountId: string;
}

interface SwitchAccountResponse {
  accountId: string;
  status: 'switched' | 'error';
  error?: string;
}

// 示例
const response = await multiAccountManager.switchAccount({
  accountId: 'acc_001',
});
```

#### 获取账户列表

```typescript
interface GetAccountsResponse {
  accounts: Account[];
  currentAccountId: string;
}

interface Account {
  id: string;
  name: string;
  type: 'real' | 'paper';
  broker: string;
  balance: number;
  createdAt: string;
}

// 示例
const response = await multiAccountManager.getAccounts();
```

---

## 性能监控 API

### PerformanceMonitor

性能监控器负责系统性能指标的收集和告警。

#### 获取实时指标

```typescript
interface GetRealtimeMetricsResponse {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  latency: number;
  qps: number;
  timestamp: string;
}

// 示例
const response = await performanceMonitor.getRealtimeMetrics();
```

#### 配置告警规则

```typescript
interface SetAlertRuleRequest {
  type: 'CPU_HIGH' | 'MEMORY_HIGH' | 'LATENCY_HIGH' | 'QPS_LOW';
  operator: '>' | '<' | '>=' | '<=';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
}

interface SetAlertRuleResponse {
  ruleId: string;
  status: 'set' | 'error';
  error?: string;
}

// 示例
const response = await performanceMonitor.setAlertRule({
  type: 'CPU_HIGH',
  operator: '>',
  threshold: 80,
  severity: 'warning',
});
```

#### 获取性能趋势

```typescript
interface GetPerformanceTrendRequest {
  metric: 'cpu' | 'memory' | 'latency' | 'qps';
  timeRange: '1h' | '24h' | '7d';
}

interface GetPerformanceTrendResponse {
  metric: string;
  dataPoints: TrendPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
}

interface TrendPoint {
  timestamp: string;
  value: number;
}

// 示例
const response = await performanceMonitor.getPerformanceTrend({
  metric: 'cpu',
  timeRange: '1h',
});
```

---

## 数据管道 API

### DataPipeline

数据管道负责数据的采集、清洗、一致性检查。

#### 添加数据清洗阶段

```typescript
interface AddCleaningStageRequest {
  name: string;
  type: 'filter' | 'transform' | 'aggregate';
  config: Record<string, any>;
}

interface AddCleaningStageResponse {
  stageId: string;
  status: 'added' | 'error';
  error?: string;
}

// 示例
const response = await dataPipeline.addCleaningStage({
  name: '去除异常值',
  type: 'filter',
  config: { method: 'zscore', threshold: 3 },
});
```

#### 运行数据一致性检查

```typescript
interface RunConsistencyCheckRequest {
  dataSource: string;
  checkType: 'stock' | 'multi_source' | 'custom';
}

interface RunConsistencyCheckResponse {
  checkId: string;
  status: 'completed' | 'error';
  result?: ConsistencyResult;
  error?: string;
}

interface ConsistencyResult {
  passedCount: number;
  failedCount: number;
  warningCount: number;
  details: ConsistencyDetail[];
}

interface ConsistencyDetail {
  field: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
}

// 示例
const response = await dataPipeline.runConsistencyCheck({
  dataSource: 'futu',
  checkType: 'stock',
});
```

---

## WebSocket API

### WebSocketServer

WebSocket 服务器提供实时数据推送。

### 连接 WebSocket

```javascript
const ws = new WebSocket('wss://api.quant-moo.ai/ws');

ws.onopen = () => {
  console.log('Connected');
  
  // 订阅实时行情
  ws.send(JSON.stringify({
    action: 'subscribe',
    channel: 'quotes',
    symbols: ['HK.00700', 'HK.09988'],
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### 订阅频道

```typescript
interface SubscribeRequest {
  action: 'subscribe';
  channel: 'quotes' | 'trades' | 'orders' | 'signals';
  symbols?: string[];
}

// 示例
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'quotes',
  symbols: ['HK.00700'],
}));
```

### 取消订阅

```typescript
interface UnsubscribeRequest {
  action: 'unsubscribe';
  channel: string;
  symbols?: string[];
}

// 示例
ws.send(JSON.stringify({
  action: 'unsubscribe',
  channel: 'quotes',
  symbols: ['HK.00700'],
}));
```

### 接收数据

```typescript
interface QuoteMessage {
  type: 'quote';
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
}

interface TradeMessage {
  type: 'trade';
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
}

interface SignalMessage {
  type: 'signal';
  strategyId: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: string;
}

// 示例
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'quote':
      console.log(`Quote: ${data.symbol} @ ${data.price}`);
      break;
    case 'trade':
      console.log(`Trade: ${data.side} ${data.quantity} ${data.symbol}`);
      break;
    case 'signal':
      console.log(`Signal: ${data.action} ${data.symbol}`);
      break;
  }
};
```

---

## 附录

### 错误码

| 错误码 | 说明 |
|-------|------|
| 1001 | 参数错误 |
| 1002 | 资源不存在 |
| 1003 | 权限不足 |
| 2001 | 策略执行失败 |
| 2002 | 回测失败 |
| 2003 | 优化失败 |
| 3001 | 网络错误 |
| 3002 | 数据源错误 |
| 4001 | 内部错误 |

### 相关文档

- [完整用户手册 v2](../guides/complete-user-manual-v2.md)
- [Phase 6.4 技术文档](../architecture/phase6-technical-documentation.md)
- [v1.0.0 发布指南](../guides/v1.0.0-release-guide.md)

---

**文档版本**: v0.13.0  
**最后更新**: 2026-06-07T22:15:00+08:00  
**作者**: dao  
**状态**: ✅ API 参考文档完成
