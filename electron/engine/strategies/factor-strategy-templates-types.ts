// ── R204 autoclaw #3 + #4: Factor-Based Strategy Template Definitions ──────
// 13 core templates: 5 HK + 8 Crypto
// Each template: 四铁律 + factor combo with weights + AI trigger points (3-5)
// Designed for JVS TemplateEngine + TemplateRegistry consumption
//
// Market coverage: 🇭🇰 HK(5) + 🪙 Crypto(8)
// Factor base: 298 factors across 44 categories
//
// ≥ 500L production-ready

// ── Types (aligned with JVS TemplateEngine expected interface) ─────────────

export type MarketTag = '🇭🇰' | '🇺🇸' | '🪙' | '🇯🇵' | '🇹🇼' | '🇰🇷' | '🇸🇬' | '🇦🇺' | '🇮🇳' | '🇪🇺' | '🛢️';

/** R206: DeepSeek conversational chat configuration for AI-native templates */

/** Structured holding days for filtering/sorting */
export interface HoldingDays {
  min: number;
  max: number;
  unit: 'day' | 'month' | 'year';
}

export interface DeepSeekChatConfig {
  enabled: boolean;
  /** System prompt prefix — injected before user prompt */
  systemPrompt: string;
  /** Suggested conversation starters (max 5) */
  conversationStarters: string[];
  /** Parameters the AI can tune via conversation */
  tunableParams: { paramName: string; description: string; currentValue: string; range: string }[];
  /** Billing: per conversation turn */
  costPerTurn: number;          // USDT, typically 1.0
  /** AI degradation chain: V4ProFold → V4ProRaw → V4Flash → MiniMax */
  degradationChain: 'AIDegradationChain';
  /** Whether user can one-click apply AI-suggested params to template */
  oneClickApply: boolean;
  /** Max conversation rounds per session before re-auth */
  maxRounds: number;
}

export interface AITriggerPoint {
  id: string;                    // e.g. "backtest-read"
  label: string;                  // AI回测解读
  touchpointId: string;          // BillingTouchpoint identifier
  costUSDT: number;              // 1 | 1.5 | 2
  description: string;           // What the AI does
}

export interface TemplateFourIronRules {
  /** 铁律1: 一句话人话 ≤80字 */
  humanLine: string;
  /** 铁律2: 止损规则 */
  stopLossRule: string;
  /** 铁律3: 适用市场+品种 */
  marketScope: { market: MarketTag; assetClass: string; symbols?: string[] }[];
  /** 铁律4: 失效自检 */
  failureCheck: string;
}

export interface FactorComboEntry {
  factorId: string;
  factorName: string;
  weight: number;                // 0-100, sum = 100
  direction: 'long' | 'short';   // Factor exposure direction
  threshold?: { min?: number; max?: number };  // Signal threshold
}

export interface FactorStrategyTemplate {
  id: string;                    // e.g. "hk-ah-premium"
  name: string;                  // English name
  nameCn: string;                // Chinese name
  /** R214: Expanded category to match all 11 market tags + AI + cross-market + commodity */
  category: 'hk' | 'us' | 'crypto' | 'jp' | 'kr' | 'tw' | 'sg' | 'au' | 'in' | 'eu' | 'cross' | 'commodity' | 'ai';
  difficulty: 1 | 2 | 3 | 4 | 5; // ⭐ rating
  timeHorizon: 'intraday' | 'swing' | 'position' | 'long-term';
  expectedHoldingDays: string;   // e.g. "3-14天"

  /** 四铁律 */
  fourIronRules: TemplateFourIronRules;

  /** Factor combo: all factor weights must sum to 100 */
  factorCombo: FactorComboEntry[];

  /** 3-5 AI付费触发点 */
  aiTriggerPoints: AITriggerPoint[];

  /** R206: DeepSeek conversational chat trigger (for AI-native templates) */
  deepSeekChat?: DeepSeekChatConfig;

  /** R214: Structured holding days for filtering/sorting (P8) */
  holdingDays: HoldingDays;

  /** Backtest summary (placeholder until real backtest runs) */
  backtestSummary?: string;

  /** Metadata */
  tags: string[];
  version: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🇭🇰 HK TEMPLATES (5) — autoclaw #3
// ═══════════════════════════════════════════════════════════════════════════════

// R222 JVS#2: Templates split into per-market files.
// Import individual markets from factor-strategy-templates-{market}.ts
