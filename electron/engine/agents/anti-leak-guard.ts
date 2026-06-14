// ── R182 P1-09: AI Output Anti-Leak Guard ────────────────────────────────────
//
// PROBLEM: When AI replies "您余额不够" / "您的余额充足" / "affordable" / "not enough",
// attackers can binary-search users' real wallet balances through repeated queries.
//
// SOLUTION: Uniform reply envelope that NEVER includes:
//   - "余额" / "balance" / "wallet" / "USDT" amounts in AI response text
//   - "够" / "不够" / "充足" / "不足" / "enough" / "not enough" / "affordable"
//   - Any numeric balance indicators
//
// Architecture:
//   1. isLeakyText(text) → detect dangerous balance-inference language
//   2. maskLeakyText(text) → replace with uniform abstract phrasing
//   3. applyAntiLeakPolicy(aiResponse, context) → wrapper for AI output pipeline
//
// Example transformations:
//   BEFORE: "您的余额只需再补 50 USDT"  → AFTER: "该策略需额外资金"
//   BEFORE: "affordable with your balance" → AFTER: "within platform parameters"
//   BEFORE: "Not enough USDT (have 100, need 150)" → AFTER: "Insufficient funds for this strategy"

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AntiLeakConfig {
  enabled: boolean;
  /** Max leaky tokens before blocking the entire response */
  maxLeakyTokens: number;
  /** If true, block the response entirely when leak detected */
  blockOnLeak: boolean;
  /** Replacement phrase for balance leaks */
  balanceReplacement: string;
}

export interface LeakDetectionResult {
  leaked: boolean;
  leakedTokens: string[];
  cleanedText: string;
  originalText: string;
  leakCategories: string[];
}

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: AntiLeakConfig = {
  enabled: true,
  maxLeakyTokens: 2,
  blockOnLeak: true,
  balanceReplacement: '平台参数范围内',
};

let config: AntiLeakConfig = { ...DEFAULT_CONFIG };

// ── Leak Patterns ──────────────────────────────────────────────────────────

/**
 * Balance inference patterns (CN + EN).
 *
 * L1: Direct balance references
 * L2: Sufficiency inference (enough/not enough)
 * L3: Amount + balance combination
 */
const BALANCE_PATTERNS: Array<{ regex: RegExp; category: string }> = [
  // ── Chinese ──
  { regex: /余额\s*(充足|足够|够|不够|不足|仅|只剩|还剩|有.{0,8}USDT|有.{0,8}美金|有.{0,8}美元)/, category: 'balance-direct-cn' },
  { regex: /(您|你).{0,6}(余额|账面|资金|钱包|账户).{0,6}(为|有|剩|仅|约|大概|约为|是).{0,6}\d/, category: 'balance-numeric-cn' },
  { regex: /(需要|只需|还得|还差|再补|缺少).{0,8}\d{1,6}\s*(USDT|美金|美元|USDC)/, category: 'amount-gap-cn' },
  { regex: /(您|你).{0,6}有.{0,3}\d+\s*(USDT|美金|美元)/, category: 'has-balance-cn' },

  // ── English ──
  { regex: /\b(balance|wallet|funds|account)\s+.{0,6}(has|have|holds?|contains?|sufficient|enough|insufficient|adequate|low|is)\b/i, category: 'balance-direct-en' },
  { regex: /\b(enough|sufficient|insufficient|affordable|not enough|too low)\b.{0,20}\b(USDT|balance|wallet|funds?)\b/i, category: 'sufficiency-en' },
  { regex: /\b(your|current)\s+.{0,10}(balance|wallet|USDT|funds)\s+.{0,5}(is|at|shows|has)\s+.{0,5}\d+/i, category: 'balance-numeric-en' },
  { regex: /\b(need|require|short by|missing|additional)\s+\d+\s*(USDT|USD|dollars|units)\b/i, category: 'amount-gap-en' },
  { regex: /\b(have|hold|own)\s+\d+\s*(USDT|USD|dollars)\s+in\s+.{0,10}(wallet|balance|account)\b/i, category: 'holding-numeric-en' },
  { regex: /\b(affordable|enough)\b.{0,20}\b(balance|wallet|USDT)\b/i, category: 'sufficiency-en' },

  // ── Universal patterns (both languages) ──
  { regex: /\d{2,}\s*(USDT|USTD|usdt)\s*(余额|in.*balance|in.*wallet|in.*account|剩余)/, category: 'universal-amount-context' },
  { regex: /(扣费|扣款|计费|billed|charged|deducted)\s+\d+\s*(USDT|美金)/, category: 'billing-leak' },
];

/**
 * Leaky phrase redaction map.
 * Each entry: [trigger regex, replacement text]
 */
const REDACTION_RULES: Array<{ pattern: RegExp; replace: string }> = [
  // Direct balance mentions
  { pattern: /余额\s*(充足|足够|够|不够|不足|仅剩|为\d+|是\d+|有\d+)/g, replace: '余额状态正常' },
  { pattern: /您.{0,6}(账面|资金|钱包|账户)余额.{0,6}\d+/g, replace: '您的账户状态正常' },
  { pattern: /\b(your|current)\s+balance\s+is\s+\d+|\byour\s+wallet\s+has\s+\d+/gi, replace: 'your account is active' },

  // Sufficiency inference
  { pattern: /(足够|不够|充足|不足)\s*(的|了|支付|买入|进行|覆盖)?/g, replace: '符合平台参数' },
  { pattern: /\b(sufficient|insufficient|enough|not enough|affordable|too low)\s+(to|for|funds?|balance|the)?/gi, replace: 'within platform parameters' },

  // Amount gaps
  { pattern: /(需要|只需|还得|还差|再补|还需要)\s*\d+\s*(USDT|美金|美元)/g, replace: '需额外资金补充' },
  { pattern: /(need|require|short by|missing)\s+\d+\s*USDT/gi, replace: 'requires additional funds' },

  // Billing leaks
  { pattern: /(扣费|扣款|计费|billed|charged)\s+\d+\s*(USDT|美金|美元)/g, replace: '费用已结算' },
];

// ── Core Detection ─────────────────────────────────────────────────────────

/**
 * Detect whether AI response text contains balance-inference leaks.
 */
export function isLeakyText(text: string): LeakDetectionResult {
  const leakedTokens: string[] = [];
  const leakCategories: string[] = [];
  let cleanedText = text;

  for (const { regex, category } of BALANCE_PATTERNS) {
    let match: RegExpExecArray | null;
    // Reset lastIndex (global regex)
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      const token = match[0];
      if (token && token.length > 0) {
        leakedTokens.push(token);
        if (!leakCategories.includes(category)) {
          leakCategories.push(category);
        }
      }
      // Prevent infinite loop on zero-length match
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      // Safety: max 50 iterations per regex
      if (leakedTokens.length > 50) break;
    }
  }

  return {
    leaked: leakedTokens.length > 0,
    leakedTokens,
    cleanedText: leakedTokens.length > 0 ? maskLeakyText(text) : text,
    originalText: text,
    leakCategories,
  };
}

/**
 * Replace all leaky phrases with abstract equivalents.
 */
export function maskLeakyText(text: string): string {
  let result = text;
  for (const { pattern, replace } of REDACTION_RULES) {
    result = result.replace(pattern, replace);
  }
  return result;
}

/**
 * Main policy: apply anti-leak guard to AI response.
 * @returns The safe response text or a uniform error block.
 */
export function applyAntiLeakPolicy(
  aiResponse: string,
  _context?: { userId?: string; queryType?: string },
): { safe: boolean; text: string; action: 'pass' | 'mask' | 'block' } {
  if (!config.enabled) {
    return { safe: true, text: aiResponse, action: 'pass' };
  }

  const detection = isLeakyText(aiResponse);

  if (!detection.leaked) {
    return { safe: true, text: aiResponse, action: 'pass' };
  }

  if (config.blockOnLeak && detection.leakedTokens.length >= config.maxLeakyTokens) {
    log.error(
      `[AntiLeak] ${detection.leakedTokens.length} leak tokens detected: ` +
      `${detection.leakedTokens.slice(0, 5).join(' | ')}... — BLOCKED`,
    );
    return {
      safe: false,
      text: 'AI analysis unavailable due to security policy. Please check your strategy parameters manually or try again with a different query.',
      action: 'block',
    };
  }

  // Mask: replace leaks with abstract text
  const masked = detection.cleanedText;
  log.warn(
    `[AntiLeak] ${detection.leakedTokens.length} leak tokens masked: ` +
    `categories=${detection.leakCategories.join(',')}`,
  );

  return { safe: true, text: masked, action: 'mask' };
}

/**
 * Safe reply envelope generator.
 * Creates a uniform response that NEVER reveals balance state.
 */
export function createSafeReplyEnvelope(template: string, vars: Record<string, string>): string {
  // Sanitize all variable values — strip any balance-inference text
  const sanitizedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    sanitizedVars[key] = maskLeakyText(value);
  }

  let result = template;
  for (const [key, value] of Object.entries(sanitizedVars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return result;
}

// ── Configuration ──────────────────────────────────────────────────────────

export function getAntiLeakConfig(): Readonly<AntiLeakConfig> {
  return { ...config };
}

export function updateAntiLeakConfig(partial: Partial<AntiLeakConfig>): void {
  config = { ...config, ...partial };
  log.info('[AntiLeak] Config updated:', JSON.stringify(partial));
}

export function resetAntiLeakConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

// ── Audit ──────────────────────────────────────────────────────────────────

interface LeakAuditEntry {
  timestamp: string;
  action: string;
  leakCategories: string[];
  originalPreview: string;
}

const auditTrail: LeakAuditEntry[] = [];
const MAX_AUDIT = 100;

export function recordLeakAudit(action: string, result: LeakDetectionResult): void {
  auditTrail.push({
    timestamp: new Date().toISOString(),
    action,
    leakCategories: result.leakCategories,
    originalPreview: result.originalText.slice(0, 120),
  });
  if (auditTrail.length > MAX_AUDIT) auditTrail.shift();
}

export function getLeakAudit(): Readonly<LeakAuditEntry[]> {
  return [...auditTrail];
}

log.info('[AntiLeak] Initialized — 10 balance-inference patterns + 8 redaction rules');
