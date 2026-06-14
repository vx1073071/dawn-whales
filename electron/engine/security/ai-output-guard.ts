// ── R178 G7: AI Output Guard ────────────────────────────────────────────────
// 5-layer defense for AI-generated output in TradingEasy.
//
// Layer 1: 资金拦截 (Funds)    — block AI from leaking walletBalance / USDT / fee
// Layer 2: 系统提示拦截 (System) — block AI from revealing internal config
// Layer 3: 敏感数据拦截 (Data)    — block PII / API keys / tokens
// Layer 4: 产品定价拦截 (Pricing) — block AI from quoting prices
// Layer 5: 角色混淆拦截 (Role)   — block AI from impersonating human/expert
//
// Architecture: inspired by Azure AI Content Safety severity scoring +
//               Guardrails AI validator chain pattern.
//
// Each layer: score 0-10, cumulative threshold ≥ THRESHOLD triggers BLOCK.

import log from 'electron-log';
// R179 G20: Sensitive field masker — consistent field-level masking
import { maskSensitiveFields, maskEmail, maskWallet } from '../agents/sensitive-field-masker';
// R182 P1-09: Anti-leak guard — prevent balance binary inference
import { applyAntiLeakPolicy, isLeakyText } from '../agents/anti-leak-guard';

// ── Types ───────────────────────────────────────────────────────────────────

export type GuardLayer = 'FUNDS' | 'SYSTEM' | 'DATA' | 'PRICING' | 'ROLE';

export interface GuardViolation {
  layer: GuardLayer;
  severity: number;    // 0-10
  pattern: string;     // regex pattern name that matched
  snippet: string;     // up to 80 chars of matched context
}

export interface GuardResult {
  passed: boolean;
  totalScore: number;
  violations: GuardViolation[];
  sanitized?: string;   // cleaned output if passed with warnings
  blockReason?: string;
}

// ── Layer 1: Funds Intercept ────────────────────────────────────────────────
// Block AI from leaking: wallet balances, USDT amounts, fee specifics,
// account values, billing internals.

const FUNDS_PATTERNS: Array<{ name: string; regex: RegExp; severity: number }> = [
  { name: 'walletBalance', regex: /\b(walletBalance|钱包余额|账户余额|wallet_?balance)\s*[:：是为]\s*[\d,.]+/gi, severity: 10 },
  { name: 'USDT_amount', regex: /\b\d+[\d,.]*\s*(USDT|U)\b/gi, severity: 8 },
  { name: 'fee_breakdown', regex: /\b(totalFee|手续费|feeCost|fee_detail)\s*[:：是为]\s*[\d,.]+/gi, severity: 8 },
  { name: 'hold_amount', regex: /\b(holdAmount|heldAmount|冻结金额|预扣)\s*[:：是为]\s*[\d,.]+/gi, severity: 9 },
  { name: 'account_equity', regex: /\b(accountEquity|净资产|总资产|account_value)\s*[:：是为]\s*[\d,.]+/gi, severity: 9 },
  { name: 'cost_usdt', regex: /\bcostUSDT\s*[:：是为]\s*\d+/gi, severity: 7 },
  { name: 'revenue_total', regex: /\b(totalRevenue|总收入|平台收入)\s*[:：是为]\s*[\d,.]+/gi, severity: 9 },
  { name: 'billing_internal', regex: /\b(TOUCHPOINT_CONFIGS|billingTouchpoint|settleUSDT|refundUSDT)\b/gi, severity: 8 },
  { name: 'subscription_cost', regex: /\b(订阅费|subscription.?fee|月费|年费)\s*[:：是为]\s*[\d,.]+/gi, severity: 7 },
];

// ── Layer 2: System Prompt Intercept ────────────────────────────────────────
// Block AI from revealing: system prompts, internal instructions, tool names,
// model configuration, infrastructure details.

const SYSTEM_PATTERNS: Array<{ name: string; regex: RegExp; severity: number }> = [
  { name: 'system_prompt', regex: /\b(system.?prompt|系统提示词|system.?instruction|SYSTEM_PROMPT|你是一个)\b/gi, severity: 10 },
  { name: 'model_name', regex: /\b(deepseek|gpt-4|claude-3|gemini|qwen|llama)\s*(v\d|pro|turbo|opus|sonnet)/gi, severity: 8 },
  { name: 'tool_list', regex: /\b(tools?|functions?)\s*(available|列表|可用):\s*\[/gi, severity: 9 },
  { name: 'api_key', regex: /\b(sk-[a-zA-Z0-9]{20,}|api[_-]?key\s*[:=]\s*\S+|AK[A-Za-z0-9]{16,})\b/g, severity: 10 },
  { name: 'internal_port', regex: /\b(:\d{4,5})\b.*\b(port|端口|listen)/gi, severity: 7 },
  { name: 'db_connection', regex: /\b(mongodb|postgresql?|mysql|redis|sqlite)\s*:\/\/\S+/gi, severity: 10 },
  { name: 'env_vars', regex: /\b(process\.env\.|环境变量|DATABASE_URL|REDIS_URL|SECRET_KEY)\b/gi, severity: 9 },
  { name: 'ip_address', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b(?!\d*\.\d*\.)/g, severity: 8 },
  { name: 'source_code', regex: /\b(export\s+(const|function|class|interface|type)|import\s+\{.*\}\s+from)\b.*\b(\.ts|\.tsx)\b/gi, severity: 7 },
];

// ── Layer 3: Sensitive Data Intercept ───────────────────────────────────────
// Block AI from leaking: user PII, emails, phone numbers, IDs.

const DATA_PATTERNS: Array<{ name: string; regex: RegExp; severity: number }> = [
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, severity: 8 },
  { name: 'phone', regex: /\b(\+?\d{1,3}[-.]?)?\(?\d{2,4}\)?[-.]?\d{3,4}[-.]?\d{3,4}\b/g, severity: 7 },
  { name: 'user_id_raw', regex: /\b(userId|user_id|openId|unionId)\s*[:：是为]\s*[a-zA-Z0-9_-]{8,}\b/gi, severity: 8 },
  { name: 'token_jwt', regex: /\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g, severity: 10 },
  { name: 'credit_card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, severity: 10 },
  { name: 'ssn_id', regex: /\b\d{6}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, severity: 10 },
];

// ── Layer 4: Product Pricing Intercept ──────────────────────────────────────
// Block AI from quoting: product prices, subscription tiers, free trial details.

const PRICING_PATTERNS: Array<{ name: string; regex: RegExp; severity: number }> = [
  { name: 'price_quote', regex: /\b(价格是|售价|定价为|只需|价格\s*[:：是为])\s*[\d,.]+/gi, severity: 9 },
  { name: 'tier_exposure', regex: /\b(free|basic|pro|enterprise)\s*(tier|套餐|档位|会员)\b/gi, severity: 7 },
  { name: 'free_trial', regex: /\b(免费试用\s*\d+\s*天|free.?trial\s*\d+\s*days?)\b/gi, severity: 6 },
  { name: 'subscription_period', regex: /\b(one_time|monthly|quarterly|yearly|一次性|月付|季付|年付)\b/gi, severity: 6 },
  { name: 'revenue_share', regex: /\b(revenueShare|分成比例|平台抽成)\s*[:：是为]\s*[\d.]+/gi, severity: 8 },
];

// ── Layer 5: Role Impersonation Intercept ───────────────────────────────────
// Block AI from pretending to be: a human, licensed professional, or the system.

const ROLE_PATTERNS: Array<{ name: string; regex: RegExp; severity: number }> = [
  { name: 'human_persona', regex: /\b(我是(一[位个名])?人[类们]|作为(一[位个名])?人[类们]|I am (a |the )?human)\b/gi, severity: 10 },
  { name: 'licensed_pro', regex: /\b(持牌|CFA|CPA|注册金融分析师|持证|licensed|registered)\s+(adviser|advisor|分析师|顾问)\b/gi, severity: 10 },
  { name: 'guarantee', regex: /\b(保证|保本|稳赚|包赚|一定[能会]赚|guarantee[d]? return|risk.?free)\b/gi, severity: 10 },
  { name: 'system_admin', regex: /\b(系统管理员|我是管理员|admin|root|superuser|system operator)\b/gi, severity: 10 },
  { name: 'legal_advice', regex: /\b(法律建议|legal advice|税法建议|tax advice|合规建议)\b/gi, severity: 9 },
  { name: 'past_performance', regex: /\b(历史业绩不代表|历史表现保证|过去.*保证.*未来)\b/gi, severity: 8 },
];

// ── Configuration ────────────────────────────────────────────────────────────

const ALL_LAYERS: Array<{ layer: GuardLayer; patterns: typeof FUNDS_PATTERNS; threshold: number }> = [
  { layer: 'FUNDS', patterns: FUNDS_PATTERNS, threshold: 15 },
  { layer: 'SYSTEM', patterns: SYSTEM_PATTERNS, threshold: 12 },
  { layer: 'DATA', patterns: DATA_PATTERNS, threshold: 10 },
  { layer: 'PRICING', patterns: PRICING_PATTERNS, threshold: 10 },
  { layer: 'ROLE', patterns: ROLE_PATTERNS, threshold: 8 },
];

const GLOBAL_BLOCK_THRESHOLD = 20; // total score ≥ 20 → BLOCK

// ── Core Engine ─────────────────────────────────────────────────────────────

export class AIOutputGuard {
  private blockedCount = 0;
  private warnedCount = 0;

  /** Inspect AI-generated output across all 5 layers. */
  inspect(text: string): GuardResult {
    const violations: GuardViolation[] = [];

    for (const { layer, patterns, threshold } of ALL_LAYERS) {
      let layerScore = 0;

      for (const { name, regex, severity } of patterns) {
        // Reset lastIndex for global regex
        regex.lastIndex = 0;
        const matches = text.match(regex);
        if (matches) {
          layerScore += severity * Math.min(matches.length, 3); // cap repeats
          const snippet = text.substring(
            Math.max(0, text.indexOf(matches[0]) - 10),
            Math.min(text.length, text.indexOf(matches[0]) + 70),
          );
          violations.push({ layer, severity, pattern: name, snippet });
        }
      }

      if (layerScore >= threshold) {
        log.warn(`[AIOutputGuard] Layer ${layer} exceeded threshold: ${layerScore}/${threshold}`);
      }
    }

    const totalScore = violations.reduce((s, v) => s + v.severity, 0);

    if (totalScore >= GLOBAL_BLOCK_THRESHOLD) {
      this.blockedCount++;
      // Group violations by layer for clear messaging
      const byLayer = violations.reduce((acc, v) => {
        if (!acc[v.layer]) acc[v.layer] = [];
        acc[v.layer].push(v.pattern);
        return acc;
      }, {} as Record<string, string[]>);

      const layersBlocked = Object.keys(byLayer)
        .map(l => `${l}(${byLayer[l].join(',')})`)
        .join('; ');

      const reason = `[AI_GUARD_BLOCKED] 总分${totalScore}/${GLOBAL_BLOCK_THRESHOLD}。触犯层级: ${layersBlocked}`;
      log.warn(`[AIOutputGuard] ${reason}`);

      return {
        passed: false,
        totalScore,
        violations,
        blockReason: 'AI回复包含敏感信息，已被安全护栏拦截。如需查看结果请使用风险披露确认功能。',
      };
    }

    if (violations.length > 0) {
      this.warnedCount++;
      log.info(`[AIOutputGuard] Passed with warnings: score=${totalScore}, violations=${violations.length}`);
    }

    return {
      passed: true,
      totalScore,
      violations,
      sanitized: violations.length > 0 ? this.sanitize(text, violations) : text,
    };
  }

  /** Sanitize output by redacting matched patterns. */
  sanitize(text: string, violations: GuardViolation[]): string {
    let cleaned = text;
    const seen = new Set<string>();

    for (const v of violations) {
      const key = `${v.layer}:${v.pattern}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Find the matching pattern definition
      for (const { patterns } of ALL_LAYERS) {
        const def = patterns.find(p => p.name === v.pattern);
        if (def) {
          cleaned = cleaned.replace(def.regex, '[已脱敏]');
          break;
        }
      }
    }

    return cleaned;
  }

  /** Quick pre-screen before full inspection — cheaper check. */
  preScreen(text: string): { safe: boolean; hitLayers: GuardLayer[] } {
    const hitLayers: GuardLayer[] = [];

    for (const { layer, patterns } of ALL_LAYERS) {
      const layerHits: string[] = [];
      for (const { name, regex } of patterns) {
        regex.lastIndex = 0;
        if (regex.test(text)) {
          layerHits.push(name);
          if (layerHits.length >= 2) break; // 2+ pattern hits = layer hit
        }
      }
      if (layerHits.length >= 2) hitLayers.push(layer);
    }

    return { safe: hitLayers.length === 0, hitLayers };
  }

  /** Get statistics. */
  getStats(): { blockedCount: number; warnedCount: number; totalProcessed: number } {
    return {
      blockedCount: this.blockedCount,
      warnedCount: this.warnedCount,
      totalProcessed: this.blockedCount + this.warnedCount,
    };
  }

  reset(): void {
    this.blockedCount = 0;
    this.warnedCount = 0;
    log.info('[AIOutputGuard] Reset');
  }
}

// ── Convenience wrappers ────────────────────────────────────────────────────

let _guard: AIOutputGuard | null = null;

export function getAIOutputGuard(): AIOutputGuard {
  if (!_guard) _guard = new AIOutputGuard();
  return _guard;
}

/** One-liner: screen and block AI output. */
export function guardAIOutput(text: string): { allowed: boolean; content: string; reason?: string } {
  const guard = getAIOutputGuard();
  const result = guard.inspect(text);

  if (!result.passed) {
    return {
      allowed: false,
      content: 'AI回复已被安全护栏拦截。该回复可能包含资金数据、系统信息或敏感内容。',
      reason: result.blockReason,
    };
  }

  // ── R182 P1-09: Anti-leak guard — prevent balance binary inference ─
  const outputText = result.sanitized || text;
  const antiLeak = applyAntiLeakPolicy(outputText);
  if (!antiLeak.safe) {
    return {
      allowed: false,
      content: antiLeak.text,
      reason: 'BALANCE_INFERENCE_LEAK',
    };
  }

  return {
    allowed: true,
    content: antiLeak.text,
  };
}

// ── Severity scoring helper (for external monitoring/dashboards) ────────────

export function scoreAISafety(text: string): { score: number; risk: 'low' | 'medium' | 'high' | 'critical' } {
  const guard = getAIOutputGuard();
  const result = guard.inspect(text);

  let risk: 'low' | 'medium' | 'high' | 'critical';
  if (result.totalScore === 0) risk = 'low';
  else if (result.totalScore < 8) risk = 'medium';
  else if (result.totalScore < GLOBAL_BLOCK_THRESHOLD) risk = 'high';
  else risk = 'critical';

  return { score: result.totalScore, risk };
}

// ── R179 G20: Structured output masker ──────────────────────────────────────

/**
 * Mask sensitive fields in a structured AI output object before IPC delivery.
 * Uses sensitive-field-masker for consistent field-level masking.
 */
export function guardAIOutputObject<T extends Record<string, unknown>>(obj: T): T {
  return maskSensitiveFields(obj) as T;
}
