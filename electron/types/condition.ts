// electron/types/condition.ts
// 统一类型定义 — Phase 4.2 条件触发引擎

export interface ConditionRule {
  id: string;
  symbol: string;
  condition: Condition;
  strategyId: string;
  brokerId?: string;
  cooldownMs: number;
  maxTriggersPerDay: number;
  enabled: boolean;
  createdAt: Date;
  lastTriggeredAt?: number; // unix ms
  triggerCount: number;
}

export type Condition = PriceCondition | IndicatorCondition | VolatilityCondition | MarketRegimeCondition;

// --- PriceCondition ---
export interface PriceCondition {
  type: 'price';
  operator: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  targetPrice: number;
  reference?: 'open' | 'high' | 'low' | 'close' | 'vwap';
}

// --- IndicatorCondition ---
export interface IndicatorCondition {
  type: 'indicator';
  indicator: 'macd' | 'rsi' | 'kdj' | 'bollinger';
  operator: 'above' | 'below' | 'crosses' | 'divergence';
  threshold: number;
  period?: number;
  params?: Record<string, number>; // e.g. { fast: 12, slow: 26, signal: 9 } for MACD
}

// --- VolatilityCondition ---
export interface VolatilityCondition {
  type: 'volatility';
  subtype: 'iv_rank' | 'hv_spike' | 'vix_level';
  operator: 'above' | 'below';
  threshold: number; // percentage for rank, absolute for vix
}

// --- MarketRegimeCondition ---
export interface MarketRegimeCondition {
  type: 'regime';
  regime: 'bull' | 'bear' | 'sideways' | 'high_vol';
  operator: 'is' | 'not';
}

// --- TriggerResult ---
export interface TriggerResult {
  ruleId: string;
  triggered: boolean;
  cooldownActive: boolean;
  reason?: string;
  priceAtTrigger?: number;
  triggeredAt?: number; // unix ms
}

// --- MarketSnapshot (输入) ---
export interface MarketSnapshot {
  symbol: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  vwap?: number;
  volume?: number;
  timestamp?: number;
}

// --- TriggerEvent (历史) ---
export interface TriggerEvent {
  ruleId: string;
  symbol: string;
  condition: Condition;
  triggeredAt: number; // unix ms
  priceAtTrigger: number;
  cooldownEndsAt?: number;
}

// --- ConditionEngine config ---
export interface ConditionEngineConfig {
  defaultCooldownMs?: number;
  defaultMaxTriggersPerDay?: number;
}
