# RiskEngine v3 规划文档
**版本:** v3.0-draft
**作者:** QClaw
**日期:** 2026-06-06
**目标 Sprint:** R29 实现蓝图
**状态:** 初稿，待 PM 审核

---

## 一、现状分析

### 1.1 RiskEngine v2 已实现能力

RiskEngine v2 当前实现于 `electron/engine/risk-engine.ts`，提供以下核心功能：

| 方法 | 功能 | 性能 |
|------|------|------|
| `calculatePositionSize(price, atr, stopPrice)` | Kelly + ATR 动态仓位计算 | ~4,300 ops/s |
| `checkOrder(order)` |  blacklist + 单一订单风险校验 | ~4,300 ops/s |
| `getDrawdownState()` | 回撤 cap 状态追踪 | ~40M ops/s |
| `getKellyStats()` | Kelly 统计（胜率/盈亏比/ Kelly fraction） | ~10M ops/s |
| `getConfig()` | 配置只读 | ~14M ops/s |
| `getStatusSnapshot()` | 完整风险状态快照 | ~2.8M ops/s |
| `updateTotalAssets(v)` | 权益更新，触发回撤 cap 检查 | — |
| `recordTrade(trade)` | 交易记录，维护 Kelly 统计 | — |

### 1.2 v2 无法覆盖的场景

| 缺失能力 | 业务影响 |
|---------|---------|
| 多券商账户聚合 | Futu + Moomoo + IB 三平台总风险无法统一计算 |
| 组合层面 VaR | 无法计算 99% VaR / CVaR（组合层面） |
| Options Greeks | 备兑仓（07552）的 Delta/Gamma 无法量化 |
| 跨券商保证金追踪 | 净空头 $439万 + 备兑仓 $1,880万 的保证金无法统一 |
| 板块/地区敞口 | 无法识别科技股过度集中（腾讯+阿里+PDD） |
| 市场熔断检测 | VIX 飙升时无自动降仓机制 |
| Margin Call 预警 | 保证金不足前无预警 |
| Portfolio-level Kelly | 三个账户 Kelly 分配无法协调 |

### 1.3 为什么现在需要 v3

**用户实际账户结构（2026-06-06）：**
- 总资产：HKD 1,726万
- 现金倒欠：$439万（净空头杠杆）
- 备兑仓：$1,880万（核心仓位）
- 持仓：07552（恒科空头，亏损$32万）

**当前 RiskEngine 无法回答的问题：**
1. "我三个账户综合敞口是多少？"
2. "如果腾讯跌 10%，我的组合会亏多少？"（需要 Portfolio VaR）
3. "07552 的 Greeks 是什么？"（需要 Black-Scholes）
4. "VIX 突破 30，我的保证金够吗？"（需要 margin monitoring）
5. "当前组合 Kelly fraction 是多少？"（需要 portfolio-level Kelly）

---

## 二、v3 API 设计

### 2.1 核心设计原则

1. **向后兼容**：v2 所有接口保持不变，v3 仅新增方法
2. **账户无关**：单一 RiskEngine 实例可管理多个券商账户
3. **同步优先**：VaR/Greeks 计算 < 100ms，超时用缓存
4. **类型安全**：完整 TypeScript 类型，无 `any`

### 2.2 新增数据类型

```typescript
// ── 多券商账户聚合 ────────────────────────────────────────────────────────

/** 单个账户快照 */
interface AccountSnapshot {
  brokerId: string;          // 'futu' | 'moomoo' | 'ib'
  accountId: string;
  totalAssets: number;       // HKD 折算
  cash: number;
  marketValue: number;
  frozenCash: number;        // 冻结资金
  availableCash: number;
  positions: PositionInfo[];  // 来自各券商
  currency: string;          // 'HKD' | 'USD'
  updatedAt: number;          // unix ms
}

/** 多券商组合视图 */
interface AggregatedPortfolio {
  accounts: AccountSnapshot[];
  totalAssets: number;        // 所有账户加总
  totalMarketValue: number;
  totalCash: number;
  totalExposure: number;      // 总敞口（多头 + 空头绝对值）
  netExposure: number;        // 净敞口（多头 - 空头）
  leverageRatio: number;       // totalExposure / totalAssets
}

/** 账户查询请求 */
interface AggregateAccountsRequest {
  brokerIds: string[];       // ['futu', 'moomoo', 'ib']
  accountIds?: string[];      // 可选，指定账户
  forceRefresh?: boolean;    // 强制刷新缓存
}

/** 账户聚合结果 */
interface AggregateAccountsResult {
  success: boolean;
  portfolio: AggregatedPortfolio;
  errors: Array<{ brokerId: string; error: string }>;
  cachedAt?: number;         // 缓存时间，ms
}
```

```typescript
// ── Portfolio VaR ───────────────────────────────────────────────────────────

/** VaR 计算结果 */
interface VaRResult {
  confidence: number;         // 置信度，如 0.95 / 0.99
  varAmount: number;         // 美元/HKD 损失金额
  varPercent: number;        // 占总资产的百分比
  cvarAmount: number;        // CVaR（Expected Shortfall）
  cvarPercent: number;
  method: 'historical' | 'parametric' | 'monte-carlo';
  horizonDays: number;        // 持有期（天）
  calculatedAt: number;       // unix ms
}

/** VaR 查询请求 */
interface VaRRequest {
  confidence: number;         // 0.95 或 0.99
  horizonDays?: number;       // 默认 1
  method?: 'historical' | 'parametric';
  lookbackDays?: number;      // 历史数据天数，默认 252
}
```

```typescript
// ── Options Greeks ──────────────────────────────────────────────────────────

/** 期权 Greeks */
interface GreeksResult {
  positionId: string;
  delta: number;             // 价格敏感度
  gamma: number;            // delta 变化率
  theta: number;            // 时间衰减（/天）
  vega: number;             // 波动率敏感度
  rho: number;              // 利率敏感度
  iv: number;               // 隐含波动率
  spotPrice: number;
  strikePrice: number;
  daysToExpiry: number;
  optionType: 'call' | 'put';
  notional: number;         // 名义本金
  calculatedAt: number;
}

/** Greeks 查询请求 */
interface GreeksRequest {
  positionId: string;
  // 优先从持仓数据获取参数；若传入则覆盖
  spotPrice?: number;
  strikePrice?: number;
  daysToExpiry?: number;
  iv?: number;              // 隐含波动率
  riskFreeRate?: number;    // 默认 0.05
}
```

```typescript
// ── Margin Monitoring ───────────────────────────────────────────────────────

/** 保证金状态 */
interface MarginResult {
  brokerId: string;
  accountId: string;
  marginUsed: number;        // 已用保证金（HKD）
  marginAvailable: number;   // 可用保证金
  marginTotal: number;       // 总保证金
  utilizationRatio: number;   // marginUsed / marginTotal
  marginCallRisk: 'none' | 'warning' | 'danger'; // >70% warning, >85% danger
  marginCallLevel: number;   // 触发 margin call 的阈值
  maintenanceMargin: number; // 维持保证金
  unrealizedPnl: number;     // 未实现盈亏
  currency: string;
}

/** 组合保证金总览 */
interface PortfolioMarginResult {
  accounts: MarginResult[];
  totalMarginUsed: number;
  totalMarginAvailable: number;
  maxUtilization: number;    // 所有账户中的最高保证金使用率
  anyMarginCallRisk: boolean;
}
```

```typescript
// ── Portfolio Exposure ──────────────────────────────────────────────────────

/** 敞口分布 */
interface ExposureResult {
  bySector: Record<string, number>;   // 板块 → 权重（0-1）
  byGeography: Record<string, number>; // 地区 → 权重
  byAssetClass: Record<string, number>; // 股票/期权/期货 → 权重
  byMarket: Record<string, number>;   // HK/US/CN/其他
  topPositions: Array<{ symbol: string; weight: number; pnl: number }>;
  concentrationRisk: number;           // HHI 指数（>0.25 为集中）
}
```

```typescript
// ── Circuit Breaker ─────────────────────────────────────────────────────────

/** 熔断状态 */
interface CircuitBreakerResult {
  market: string;             // 'HK' | 'US' | 'CN'
  status: 'open' | 'halted' | 'resume_pending';
  triggerLevel: number;      // 1=L1, 2=L2, 3=L3
  triggerPrice?: number;     // 触发价格（如有）
  haltedAt?: number;         // 熔断时间 unix ms
  resumeAt?: number;         // 预计恢复时间 unix ms
  reason?: string;
}

// 交易所熔断阈值（示例）
const CIRCUIT_BREAKER_RULES = {
  HK: { L1: 0.05, L2: 0.10, L3: 0.20 },   // 恒生指数跌幅
  US: { L1: 0.07, L2: 0.13, L3: 0.20 },    // S&P500
  CN: { L1: 0.05, L2: 0.07, L3: 0.10 },    // 沪深300
};
```

### 2.3 新增公开方法

```typescript
export class RiskEngine {
  // ── 现有 v2 方法（保持不变）───────────────────────────────────────────
  calculatePositionSize(price: number, atr?: number, stopPrice?: number): PositionSizeResult;
  checkOrder(order: PlaceOrderRequest): RiskCheckResult;
  getDrawdownState(): DrawdownState;
  getKellyStats(): KellyStats;
  getConfig(): RiskConfig;
  getStatusSnapshot(): RiskStatusSnapshot;
  updateTotalAssets(assets: number): void;
  recordTrade(trade: TradeRecord): void;
  updateConfig(config: Partial<RiskConfig>): void;

  // ── v3 新增方法 ──────────────────────────────────────────────────────

  /**
   * 多券商账户聚合
   * 将 Futu + Moomoo + IB 账户合并为统一视图
   * 性能目标：< 200ms（含所有券商查询）
   */
  aggregateAccounts(req: AggregateAccountsRequest): Promise<AggregateAccountsResult>;

  /**
   * Portfolio-level VaR
   * 使用历史模拟法或参数法计算组合风险价值
   * 性能目标：< 100ms（100持仓，252天历史）
   */
  getPortfolioVaR(req: VaRRequest): Promise<VaRResult>;

  /**
   * Options Greeks（Black-Scholes）
   * 计算单个持仓的 Delta/Gamma/Theta/Vega/Rho
   * 性能目标：< 10ms / 持仓
   */
  getGreeks(req: GreeksRequest): Promise<GreeksResult>;

  /**
   * 组合保证金监控
   * 按账户返回保证金使用率，识别 margin call 风险
   */
  getMarginUtilization(): Promise<PortfolioMarginResult>;

  /**
   * Portfolio 敞口分析
   * 返回板块/地区/资产类别权重分布
   * 自动计算集中度风险（HHI）
   */
  getPortfolioExposure(): Promise<ExposureResult>;

  /**
   * 市场熔断检测
   * 监控 HK/US/CN 主要指数，检测是否触及熔断阈值
   * 缓存结果 60s，避免频繁 API 调用
   */
  checkCircuitBreaker(market: string): Promise<CircuitBreakerResult>;

  /**
   * Portfolio-level Kelly Fraction
   * 综合三个账户的 Kelly 统计，返回组合级别 Kelly 比例
   */
  getPortfolioKelly(): KellyStats;

  /**
   * 综合风险仪表盘
   * 一次性返回所有关键指标（VaR/Greeks/Margin/Exposure）
   * 用于 Dashboard 一次性加载
   */
  getRiskDashboard(): Promise<RiskDashboardResult>;
}

interface RiskDashboardResult {
  portfolio: AggregatedPortfolio;
  var95: VaRResult;
  margin: PortfolioMarginResult;
  exposure: ExposureResult;
  kellyStats: KellyStats;
  circuitBreakers: Record<string, CircuitBreakerResult>;
  alerts: RiskAlert[];
  timestamp: number;
}
```

---

## 三、实施路线图

### R29 — Phase 1：多券商账户聚合

**目标：** 打通 Futu + Moomoo + IB 三个账户的统一视图

**实现内容：**
1. `aggregateAccounts()` 核心逻辑
   - 遍历 brokerIds，调用各 adapter.getFunds() / getPositions()
   - 折算为统一货币（HKD）
   - 缓存 30s

2. `getMarginUtilization()`
   - 从各 adapter 获取 margin 使用情况
   - 定义 marginCallRisk 阈值：>70% warning, >85% danger

3. 单元测试（20+ tests）
   - Mock 三个 broker adapter
   - 聚合计算正确性
   - 货币折算
   - 缓存逻辑

**验收标准：**
- `aggregateAccounts(['futu', 'moomoo'])` 返回完整 AggregatedPortfolio
- 响应时间 < 500ms（含 mock）
- 所有新测试通过

**预计工作量：** 3-4 人天

---

### R30 — Phase 2：组合 VaR + 敞口分析

**目标：** 实现 Portfolio-level 风险量化

**实现内容：**
1. `getPortfolioVaR()`
   - Historical simulation: 用日收益率分布的 5th percentile
   - Parametric（正态）作为 fallback
   - 输入：组合持仓历史（可从 BacktestEngine 获取）

2. `getPortfolioExposure()`
   - 手动映射表：symbol → sector/geography
   - HHI 集中度计算
   - Top-10 持仓权重

3. `getRiskDashboard()`
   - 聚合所有 v3 方法为单一调用
   - Dashboard 一次性加载

**验收标准：**
- VaR 计算与理论值误差 < 1%
- Exposure 返回正确 sector 分布
- Dashboard 响应 < 500ms

**预计工作量：** 4-5 人天

---

### R31 — Phase 3：Options Greeks

**目标：** 为用户的备兑仓（07552）计算 Greeks

**实现内容：**
1. `getGreeks()` — Black-Scholes 实现
   ```
   d1 = (ln(S/K) + (r + σ²/2)T) / (σ√T)
   d2 = d1 - σ√T
   Call = S·N(d1) - K·e^(-rT)·N(d2)
   Delta = N(d1)
   Gamma = N'(d1) / (S·σ·√T)
   Theta = -S·N'(d1)·σ/(2√T) - r·K·e^(-rT)·N(d2)
   Vega = S·N'(d1)·√T
   Rho = K·T·e^(-rT)·N(d2)
   ```

2. Greeks 聚合进 Portfolio VaR
   - 期权持仓按 Notional 折算进 VaR

**验收标准：**
- Greeks 结果与量化平台对照误差 < 0.01
- 支持 Call / Put 两种类型

**预计工作量：** 3-4 人天

---

### R32 — Phase 4：市场熔断 + 自动降仓

**目标：** 市场异动时自动保护组合

**实现内容：**
1. `checkCircuitBreaker()`
   - 订阅恒生指数 / S&P500 实时行情
   - 对比 CIRCUIT_BREAKER_RULES 阈值

2. 自动降仓触发器
   - 当 `utilizationRatio > 0.85` → 警告 + 建议降仓
   - 当 `varPercent > 0.20`（单日亏损 >20%）→ 紧急降仓
   - 对接 TradeExecutor 的 `emergencyStop()` 接口

**预计工作量：** 2-3 人天

---

## 四、向后兼容方案

### 4.1 v2 接口保持不变

所有 v2 公开方法保持现有签名，**不修改任何现有接口**：

```typescript
// v2 方法签名（不变）
calculatePositionSize(price: number, atr?: number, stopPrice?: number): PositionSizeResult
checkOrder(order: PlaceOrderRequest): RiskCheckResult
getDrawdownState(): DrawdownState
getKellyStats(): KellyStats
getConfig(): RiskConfig
getStatusSnapshot(): RiskStatusSnapshot
updateTotalAssets(assets: number): void
recordTrade(trade: TradeRecord): void
updateConfig(config: Partial<RiskConfig>): void
```

### 4.2 v2 → v3 迁移路径

```typescript
// v2 用法（继续工作）
const risk = new RiskEngine(config);
risk.recordTrade(trade);
risk.calculatePositionSize(price, atr);

// v3 新增（可选）
const portfolio = await risk.aggregateAccounts({ brokerIds: ['futu', 'moomoo', 'ib'] });
const varResult = await risk.getPortfolioVaR({ confidence: 0.99 });
const greeks = await risk.getGreeks({ positionId: '07552-calls' });
```

### 4.3 配置兼容

`RiskConfig` 新增可选字段，不影响 v2 现有配置：

```typescript
interface RiskConfig {
  // ── v2 现有字段（不变）──────────────────────────────────────
  maxDrawdownPercent: number;    // 20
  maxSinglePositionPercent: number; // 15
  blacklist: string[];
  whitelist: string[];
  dailyLossLimitPercent: number; // 5
  tradingHoursOnly: boolean;

  // ── v3 新增字段（可选，有默认值）──────────────────────────
  varConfidence?: number;         // 默认 0.95
  marginWarningThreshold?: number; // 默认 0.70
  marginDangerThreshold?: number;  // 默认 0.85
  circuitBreakerEnabled?: boolean; // 默认 true
  brokerIds?: string[];           // 默认 ['futu']
}
```

---

## 五、性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| `aggregateAccounts` | < 500ms | 含三券商 mock |
| `getPortfolioVaR` | < 100ms | 100持仓，252天 |
| `getGreeks` | < 10ms | 单持仓 |
| `getMarginUtilization` | < 200ms | 含三账户 |
| `getRiskDashboard` | < 1s | 全量指标 |
| 内存占用 | < 50MB | 含 252天历史数据 |

---

## 六、测试策略

### 6.1 单元测试（新增 60+ tests）

```typescript
// tests/risk-engine-v3.test.ts
describe('RiskEngine v3 - Multi-broker Aggregation', () => {
  it('aggregateAccounts 合并两个账户');
  it('aggregateAccounts 三个账户权重正确');
  it('货币折算：USD→HKD');
  it('缓存：30s 内返回缓存结果');
  it('forceRefresh 绕过缓存');
  it('broker 查询失败时返回 partial result + error');
});

describe('VaR Calculation', () => {
  it('历史模拟法：VaR95 = 5th percentile of returns');
  it('参数法：VaR99 正态分布');
  it('CVaR = average of losses beyond VaR');
  it('空组合 → varPercent = 0');
  it('100持仓计算 < 100ms');
});

describe('Greeks (Black-Scholes)', () => {
  it('平价期权 Delta ≈ 0.5');
  it('深度实值 Call Delta → 1');
  it('深度虚值 Put Delta → 0');
  it('Gamma 在 ATM 附近最大');
  it('Theta 为负（时间衰减）');
  it('Vega 为正（波动率上升有利于买方）');
});

describe('Margin Monitoring', () => {
  it('utilization > 70% → marginCallRisk = warning');
  it('utilization > 85% → marginCallRisk = danger');
  it('anyMarginCallRisk = true 当任一账户超过阈值');
});

describe('Circuit Breaker', () => {
  it('恒指下跌 7% → L1 halted');
  it('恒指下跌 13% → L2 halted');
  it('S&P500 下跌 20% → L3 halted');
  it('status = resume_pending 在恢复前');
});
```

### 6.2 集成测试

- Mock 三个 BrokerAdapter 返回真实数据结构
- 端到端：账户聚合 → VaR → Greeks → Dashboard
- Backward compatibility：所有 v2 方法仍然通过

### 6.3 压力测试

- 100 持仓 × 252 天历史 → VaR < 100ms
- 1000 Greeks 计算 → < 5s

---

## 七、已知风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 多券商 API 延迟不确定 | 30s 缓存 + parallel fetch |
| Greeks 隐含波动率获取 | 用 ATR 估算 IV 作为 fallback |
| VaR 历史数据不足 | 至少 63 天（一个季度）才计算 |
| Margin data 实时性 | 使用各券商推送，不轮询 |
| Black-Scholes 假设不成立 | 实际使用调整模型（Bjerksund-Stensland）|

---

## 八、决策待定（Open Issues）

1. **VaR 置信度**：95% 还是 99% 作为默认？
2. **历史数据来源**：从 BacktestEngine 历史 K 线，还是单独存储？
3. **Greeks IV 来源**：ATM IV API 还是 ATR 估算？
4. **Currency 折算**：实时汇率还是日终汇率？
5. **熔断触发后**：自动降仓还是仅警告？
