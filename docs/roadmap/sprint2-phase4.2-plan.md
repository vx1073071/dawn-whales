<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: PM
purpose: (auto-generated, needs review)
-->

# Sprint 2 Phase 4.2 规划 — 条件触发引擎

**规划人**: PM (WorkBuddy)
**日期**: 2026-06-06
**基于**: Phase 4.1 进展 (R29)
**目标**: 从"定时自动"到"条件自动"

---

## 背景

Phase 4.1 完成了定时执行引擎:
- ✅ CronScheduler — 按 cron 表达式定时运行策略
- ✅ StrategyRunner — 策略自动执行 (dry-run + live-run)
- ✅ RiskEngine v3 — 跨券商风控 + 熔断
- ✅ OpenDBaseAdapter — Futu/Moomoo 统一基类

Phase 4.2 的核心问题: **用户已经能定时执行策略，如何让系统在条件满足时自动触发？**

---

## 目标

**构建条件触发引擎，支持四种条件类型:**
1. **价格条件** — 标的达到指定价格时触发
2. **指标条件** — MACD/RSI/KDJ 等技术指标满足条件时触发
3. **波动率条件** — 隐含波动率/历史波动率突破阈值时触发
4. **市场状态条件** —  regime 切换/趋势确认时触发

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    ConditionEngine                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PriceCond   │  │ IndicatorCond│  │ VolatilityCond   │  │
│  │  - above     │  │  - MACD      │  │  - IV rank     │  │
│  │  - below     │  │  - RSI       │  │  - HV spike    │  │
│  │  - crosses   │  │  - KDJ       │  │  - VIX level   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │            │
│         └──────────────────┼────────────────────┘            │
│                            ▼                                 │
│                   ┌─────────────────┐                        │
│                   │  ConditionRule  │                        │
│                   │  - symbol       │                        │
│                   │  - condition    │                        │
│                   │  - strategyId   │                        │
│                   │  - cooldown     │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  MarketDataWatcher                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  WS Price    │  │  Quote Snap  │  │  Tick Stream   │  │
│  │  (push)      │  │  (poll)      │  │  (realtime)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │            │
│         └──────────────────┼────────────────────┘            │
│                            ▼                                 │
│                   ┌─────────────────┐                        │
│                   │  EventRouter    │                        │
│                   │  - dispatch()   │                        │
│                   └────────┬────────┘                        │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │  StrategyRunner │  ← Phase 4.1
                   │  (triggered)    │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  RiskEngine v3  │  ← Phase 4.1
                   │  (check)        │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Broker (order) │  ← Phase 3
                   └─────────────────┘
```

---

## 核心模块

### 1. ConditionEngine (`electron/engine/condition-engine.ts`)

**职责**: 条件规则管理 + 评估

**接口**:
```typescript
interface ConditionRule {
  id: string;
  symbol: string;
  condition: Condition;
  strategyId: string;
  brokerId?: string;
  cooldownMs: number;      // 触发冷却期
  maxTriggersPerDay: number;
  enabled: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
}

type Condition =
  | PriceCondition
  | IndicatorCondition
  | VolatilityCondition
  | MarketRegimeCondition;

interface PriceCondition {
  type: 'price';
  operator: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  targetPrice: number;
  reference?: 'open' | 'high' | 'low' | 'close' | 'vwap';
}

interface IndicatorCondition {
  type: 'indicator';
  indicator: 'macd' | 'rsi' | 'kdj' | 'bollinger';
  operator: 'above' | 'below' | 'crosses' | 'divergence';
  threshold: number;
  period?: number;
}
```

**方法**:
- `createRule(rule: Omit<ConditionRule, 'id'>)` — 创建规则
- `deleteRule(ruleId)` — 删除规则
- `evaluate(symbol, marketData)` — 评估所有相关规则
- `listRules(filter?)` — 列出规则
- `enableRule(ruleId)` / `disableRule(ruleId)` — 启用/禁用

### 2. MarketDataWatcher (`electron/engine/market-data-watcher.ts`)

**职责**: 行情监听 + 事件分发

**功能**:
- 订阅 WebSocket 行情推送 (`quotes:push`)
- 聚合多券商行情 (Futu + Moomoo + IB)
- 去重: 同一标的多个券商报价，取最新
- 分发: 价格变化 → ConditionEngine.evaluate()
- 回退: WebSocket 断开时切换轮询模式

**接口**:
```typescript
interface MarketDataWatcher {
  subscribe(symbols: string[]): void;
  unsubscribe(symbols: string[]): void;
  onPriceUpdate(callback: (data: PriceUpdate) => void): void;
  getLatestPrice(symbol: string): PriceSnapshot | null;
}
```

### 3. 条件类型详细设计

#### 3.1 价格条件

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `above` | 价格高于目标 | AAPL > $200 |
| `below` | 价格低于目标 | TQQQ < $35 |
| `crosses_above` | 上穿目标 | 从 <200 变为 >200 |
| `crosses_below` | 下穿目标 | 从 >200 变为 <200 |

**防抖动**: crosses 类型需记录前一状态，仅在穿越瞬间触发一次

#### 3.2 指标条件

| 指标 | 参数 | 触发条件 |
|------|------|----------|
| MACD | fast, slow, signal | 金叉/死叉 |
| RSI | period (默认 14) | >70 (超买) / <30 (超卖) |
| KDJ | k, d, j | K 上穿 D (金叉) |
| Bollinger | period, stdDev | 触及上轨/下轨 |

**计算方式**: 基于历史 K 线数据实时计算（已有 `historical-data.ts`）

#### 3.3 波动率条件

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| IV Rank | 隐含波动率百分位 | 期权卖方择时 |
| HV Spike | 历史波动率突增 | 避险/对冲触发 |
| VIX Level | VIX 指数阈值 | 全局风控 |

**数据源**: IB 期权链数据 / Futu 期权数据

#### 3.4 市场状态条件

| 类型 | 说明 | 触发 |
|------|------|------|
| Regime Switch | 趋势/震荡切换 | 均线排列变化 |
| Trend Confirm | 趋势确认 | 价格突破 + 成交量确认 |
| Gap | 跳空 | 开盘缺口 > N% |

---

## 数据流

```
WebSocket 行情推送
       │
       ▼
┌─────────────────┐
│ MarketDataWatcher│
│ - 去重           │
│ - 格式化         │
└────────┬────────┘
         │ PriceUpdate
         ▼
┌─────────────────┐
│ ConditionEngine  │
│ - 查找相关规则   │
│ - 评估条件       │
│ - 检查冷却期     │
└────────┬────────┘
         │ TriggerEvent (条件满足)
         ▼
┌─────────────────┐
│ StrategyRunner   │ ← Phase 4.1
│ (triggered mode) │
└────────┬────────┘
         │
         ▼
    [RiskEngine v3]
         │
         ▼
    [Broker Order]
```

---

## 里程碑

| 阶段 | 时间 | 目标 |
|------|------|------|
| R30 | 第 1 周 | ConditionEngine 骨架 + PriceCondition |
| R31 | 第 2 周 | IndicatorCondition + MarketDataWatcher |
| R32 | 第 3 周 | VolatilityCondition + MarketRegimeCondition |
| R33 | 第 4 周 | 集成测试 + 性能优化 + UI |

---

## 验收标准

| 检查项 | 标准 |
|--------|------|
| ConditionEngine | 可创建/删除/启用/禁用条件规则 |
| PriceCondition | above/below/crosses_above/crosses_below 可用 |
| IndicatorCondition | MACD/RSI/KDJ/Bollinger 至少 2 种可用 |
| MarketDataWatcher | WebSocket 推送 → 条件评估 延迟 < 500ms |
| 冷却期 | 同一规则触发后冷却期内不再触发 |
| 测试 | >= 25 新测试 (条件评估 + 冷却期 + 多条件并发) |
| 集成 | Condition → StrategyRunner → RiskEngine → Broker 全链路 |

---

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 指标计算延迟 | 条件触发慢 | 预计算 + 缓存 + 增量更新 |
| WebSocket 不稳定 | 行情丢失 | 轮询回退 + 心跳检测 |
| 多条件并发 | 资源竞争 | 规则分片 + 异步评估 |
| 假触发 | 频繁误报 | 冷却期 + 确认机制 + 回测验证 |

---

**Phase 4.2 规划完毕，待 R29 验收后启动。**
