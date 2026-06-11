<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# PortfolioRiskEngine API 文档

**Phase**: 5.0 R39  
**文件**: `electron/engine/portfolio-risk-engine.ts` (695 行)  
**作者**: JVS  
**审查**: dao (94%)  

---

## 概述

PortfolioRiskEngine 组合风险引擎，支持 VaR/CVaR 计算、相关性矩阵、压力测试和风险预算分配。

---

## 类型定义

### Position

```typescript
interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  weight: number; // Portfolio weight (0-1)
}
```

### Portfolio

```typescript
interface Portfolio {
  positions: Position[];
  totalValue: number;
  cashPosition: number;
  timestamp: number;
}
```

### VaRResult

```typescript
interface VaRResult {
  var_95: number; // 95% confidence VaR
  var_99: number; // 99% confidence VaR
  cvar_95: number; // 95% CVaR (Expected Shortfall)
  cvar_99: number; // 99% CVaR
  horizon: number; // Days
  method: 'historical' | 'parametric' | 'monte_carlo';
  calculatedAt: number;
}
```

### CorrelationMatrix

```typescript
interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // Correlation coefficients
}
```

### StressScenario

```typescript
interface StressScenario {
  name: string;
  description: string;
  shocks: Record<string, number>; // Symbol -> shock percentage
}
```

### StressTestResult

```typescript
interface StressTestResult {
  scenario: StressScenario;
  portfolioLoss: number;
  positionImpacts: {
    symbol: string;
    shock: number;
    impact: number;
    newPrice: number;
  }[];
  totalValueAfter: number;
  testedAt: number;
}
```

### RiskMetrics

```typescript
interface RiskMetrics {
  portfolioVaR: VaRResult;
  correlationMatrix: CorrelationMatrix;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  calculatedAt: number;
}
```

### RiskBudget

```typescript
interface RiskBudget {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  riskContribution: number; // % of total portfolio risk
  riskBudget: number; // Allocated risk budget
  deviation: number; // currentWeight - targetWeight
}
```

### HistoricalReturn

```typescript
interface HistoricalReturn {
  symbol: string;
  date: string;
  return: number;
}
```

---

## PortfolioRiskEngine 类

### 构造函数

```typescript
constructor()
```

### 组合管理

#### setPortfolio(portfolio)
设置当前组合。

```typescript
setPortfolio(portfolio: Portfolio): void
```

#### getPortfolio()
获取当前组合。

```typescript
getPortfolio(): Portfolio | null
```

#### addHistoricalReturns(symbol, returns)
添加历史收益数据。

```typescript
addHistoricalReturns(symbol: string, returns: HistoricalReturn[]): void
```

#### setBenchmarkReturns(returns)
设置基准收益。

```typescript
setBenchmarkReturns(returns: number[]): void
```

#### setRiskFreeRate(rate)
设置无风险利率。

```typescript
setRiskFreeRate(rate: number): void
```

### VaR 计算

#### calculateHistoricalVaR(horizon?, confidence?)
计算历史 VaR。

```typescript
calculateHistoricalVaR(horizon?: number, confidence?: number): VaRResult
```

#### calculateParametricVaR(horizon?)
计算参数法 VaR。

```typescript
calculateParametricVaR(horizon?: number): VaRResult
```

### 相关性分析

#### calculateCorrelationMatrix()
计算相关性矩阵。

```typescript
calculateCorrelationMatrix(): CorrelationMatrix
```

### 压力测试

#### runStressTest(scenario)
运行压力测试。

```typescript
runStressTest(scenario: StressScenario): StressTestResult
```

#### runAllStressTests()
运行所有预设压力测试。

```typescript
runAllStressTests(): StressTestResult[]
```

### 风险指标

#### calculateRiskMetrics()
计算完整风险指标。

```typescript
calculateRiskMetrics(): RiskMetrics
```

#### calculateSharpeRatio()
计算夏普比率。

```typescript
calculateSharpeRatio(): number
```

#### calculateSortinoRatio()
计算索提诺比率。

```typescript
calculateSortinoRatio(): number
```

#### calculateMaxDrawdown()
计算最大回撤。

```typescript
calculateMaxDrawdown(): number
```

#### calculateBeta()
计算 Beta。

```typescript
calculateBeta(): number
```

#### calculateTrackingError()
计算跟踪误差。

```typescript
calculateTrackingError(): number
```

#### calculateInformationRatio()
计算信息比率。

```typescript
calculateInformationRatio(): number
```

### 风险预算

#### calculateRiskBudget(targetWeights?)
计算风险预算。

```typescript
calculateRiskBudget(targetWeights?: Record<string, number>): RiskBudget[]
```

### 管理方法

#### reset()
重置引擎。

```typescript
reset(): void
```

---

## VaR 计算方法

### Historical (历史模拟法)
- 使用历史收益分布
- 不假设分布形状
- 需要 >100 样本

### Parametric (参数法)
- 假设正态分布
- 计算快速
- 可能低估厚尾风险

### Monte Carlo (蒙特卡洛)
- 随机模拟
- 最灵活
- 计算量大 (未实现)

---

## 压力测试场景

### 预设场景
1. **2008 金融危机**: 所有资产 -30%
2. **2020 新冠冲击**: 所有资产 -20%
3. **科技股崩盘**: 科技资产 -40%
4. **利率上升**: 债券 -15%, 股票 -10%
5. **黑天鹅事件**: 所有资产 -50%

---

## 风险指标说明

| 指标 | 公式 | 说明 |
|-----|------|------|
| Sharpe Ratio | (R - Rf) / σ | 风险调整收益 |
| Sortino Ratio | (R - Rf) / σ_down | 下行风险调整 |
| Max Drawdown | max(peak - trough) / peak | 最大回撤 |
| Beta | Cov(R, Rm) / Var(Rm) | 市场敏感度 |
| Tracking Error | σ(R - Rm) | 跟踪误差 |
| Information Ratio | (R - Rm) / TE | 超额收益/跟踪误差 |

---

## 事件列表

| 事件名 | 触发时机 | 回调参数 |
|-------|---------|---------|
| `portfolio:updated` | 组合更新 | `Portfolio` |
| `var:calculated` | VaR 计算完成 | `VaRResult` |
| `stress:complete` | 压力测试完成 | `StressTestResult` |
| `risk:metrics` | 风险指标计算 | `RiskMetrics` |
| `budget:calculated` | 风险预算计算 | `RiskBudget[]` |

---

**文档生成**: dao  
**时间**: 2026-06-07T04:48:00+08:00
