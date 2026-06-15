// ── R182 P0-10: Unified AI Security Gateway ──────────────────────────────────
// Single entry point for all 9 AI security modules in TradingEasy.
// Every AI-facing code path calls: gateway.guard(input) → gateway.guard(output).
//
// Modules gated:
//   ai-input-sanitizer        — strip sensitive data from input
//   ai-output-guard           — 5-layer output inspection
//   ai-hallucination-check    — claim vs ground-truth verification
//   ai-semantic-guard         — semantic similarity detection
//   factor-data-source-guard  — data health check
//   sensitive-field-masker    — field-level masking
//   R178 G14 wallet stripping — walletBalance removed from AI context
//   R179 G26 session isolation — per-user data isolation
//   R181 P0-05 hallucination  — fact anchoring
//
// Usage:
//   import { aiSecurityGateway } from '../security/ai-security-gateway';
//   const inputCheck = aiSecurityGateway.guardInput(query);
//   const outputCheck = aiSecurityGateway.guardOutput(reply, context);

import log from 'electron-log';
import { sanitizeForAI, detectSensitiveData } from './ai-input-sanitizer';
import { getAIOutputGuard, type GuardResult, type GuardViolation } from './ai-output-guard';
import { hallucinationCheck, tagOutputProvenance, type HallucinationReport } from './ai-hallucination-check';
import { semanticCheck, type SemanticCheckResult } from './ai-semantic-guard';
import { getDataSourceGuard } from './factor-data-source-guard';
import { maskSensitiveFields } from '../agents/sensitive-field-masker';

// ── Types ───────────────────────────────────────────────────────────────────

export type SecurityLevel = 'PASS' | 'SANITIZED' | 'WARNED' | 'BLOCKED';

export interface InputSecurityCheck {
  level: SecurityLevel;
  sanitizedInput: string;
  sensitiveFields: string[];
  dataSourcesHealthy: boolean;
  warnings: string[];
}

export interface OutputSecurityCheck {
  level: SecurityLevel;
  allowedOutput: string;
  guardResult: GuardResult;
  hallucinationReport?: HallucinationReport;
  provenanceTags?: Array<{ text: string; source: string; confidence: number }>;
  credibilityBadges: CredibilityBadge[];
  blockExplanation?: string;
  warnings: string[];
}

export interface OutputContext {
  factorIds: string[];
  intent: string;
  userId?: string;
}

// ── R182 P1-06: Credibility Badge ───────────────────────────────────────────

export interface CredibilityBadge {
  metric: string;              // e.g. 'IC', 'Sharpe', 'annualReturn'
  source: 'ETF_REAL' | 'BACKTEST_COMPUTED' | 'AI_INFERRED';
  confidence: number;          // 0-1
  label: string;               // e.g. "🔵 ETF真实数据"
  detail: string;              // e.g. "该IC值来自2024-2025年ETF实际收益率计算"
}

/**
 * Assign credibility badges to metric claims in AI output.
 * Users see at a glance what's "real data" vs "AI opinion".
 */
function assignCredibilityBadges(
  hallucinationReport: HallucinationReport,
  provenanceTags: Array<{ text: string; source: string; confidence: number }>,
): CredibilityBadge[] {
  const badges: CredibilityBadge[] = [];

  for (const check of hallucinationReport.checks) {
    const isVerified = check.verdict === 'VERIFIED';
    const isDeviated = check.verdict === 'DEVIATION';

    let source: CredibilityBadge['source'];
    let label: string;
    let detail: string;
    let confidence: number;

    if (isVerified) {
      source = 'ETF_REAL';
      label = '🟢 系统验证';
      detail = `该${check.field}值(${check.claimedValue.toFixed(2)})与ETF真实数据(+${check.groundTruth.toFixed(2)})一致`;
      confidence = 0.95;
    } else if (isDeviated) {
      source = 'BACKTEST_COMPUTED';
      label = '🟡 回测推算';
      detail = `该${check.field}值(${check.claimedValue.toFixed(2)})与ETF真实值(${check.groundTruth.toFixed(2)})偏差${(check.deviation*100).toFixed(1)}%`;
      confidence = 0.70;
    } else {
      source = 'AI_INFERRED';
      label = '🔴 AI推断';
      detail = `该${check.field}值(${check.claimedValue.toFixed(2)})无法验证，可能为AI幻觉`;
      confidence = 0.30;
    }

    badges.push({ metric: check.field, source, confidence, label, detail });
  }

  // Add badges for untagged sections
  const aiTagged = provenanceTags.filter(p => p.source === 'AI_INFERRED');
  if (aiTagged.length > 0) {
    badges.push({
      metric: '策略分析',
      source: 'AI_INFERRED',
      confidence: 0.60,
      label: '🤖 AI分析',
      detail: `策略解读由AI生成，基于您的查询和已选因子组合`,
    });
  }

  return badges;
}

// ── R182 P1-07: Guard Explain ───────────────────────────────────────────────

export interface GuardExplanation {
  blocked: boolean;
  headline: string;
  layersTriggered: string[];
  details: Array<{ layer: string; pattern: string; severity: number; userFriendly: string }>;
  suggestion: string;
}

/**
 * Generate human-readable explanation when AI output is blocked.
 * Instead of "你的回复被拦截", tell users what & why + how to fix.
 */
function guardExplain(guardResult: GuardResult): GuardExplanation {
  const layerNames: Record<string, string> = {
    FUNDS: '资金数据',
    SYSTEM: '系统配置',
    DATA: '个人信息',
    PRICING: '产品定价',
    ROLE: '角色冒充',
  };

  const patternExplanations: Record<string, string> = {
    walletBalance: '查询中出现了钱包余额信息',
    USDT_amount: '查询中出现了USDT金额',
    fee_breakdown: '查询中出现了手续费明细',
    hold_amount: '查询中出现了预扣金额',
    api_key: '查询中包含了API密钥',
    system_prompt: '查询尝试获取系统提示词',
    email: '查询中包含了邮箱地址',
    token_jwt: '查询中包含了登录令牌',
    price_quote: '查询试图获取产品定价',
    human_persona: 'AI在扮演人类角色',
    guarantee: 'AI做出了保本承诺（违规）',
  };

  const layersTriggered = [...new Set(guardResult.violations.map(v => v.layer))];
  const details = guardResult.violations.map(v => ({
    layer: layerNames[v.layer] || v.layer,
    pattern: v.pattern,
    severity: v.severity,
    userFriendly: patternExplanations[v.pattern] || `检测到敏感内容 (${v.layer})`,
  }));

  const suggestions: Record<string, string> = {
    FUNDS: '⚠️ 请避免在查询中包含金额、余额等财务数据',
    SYSTEM: '⚠️ 请不要尝试获取系统内部配置信息',
    DATA: '⚠️ 请移除个人信息（邮箱、手机号、证件号等）',
    PRICING: '⚠️ 定价信息请在产品页面查看，不要通过AI获取',
    ROLE: '⚠️ AI不提供投资建议和收益保证',
  };

  const suggestion = layersTriggered
    .map(l => suggestions[l])
    .filter(Boolean)
    .join('。\n');

  return {
    blocked: true,
    headline: `为了您的信息安全，AI回复已被安全护栏拦截`,
    layersTriggered: layersTriggered.map(l => layerNames[l] || l),
    details,
    suggestion: suggestion || '请去除敏感信息后重试，或联系客服获取帮助。',
  };
}

// ── Gateway ──────────────────────────────────────────────────────────────────

export class AISecurityGateway {
  private inputSessions = 0;
  private outputSessions = 0;
  private blocksThisHour = 0;
  private lastHourReset = Date.now();

  /** Guard AI input: sanitize + check data sources. */
  guardInput(input: string, userId?: string): InputSecurityCheck {
    this.inputSessions++;

    const warnings: string[] = [];
    let level: SecurityLevel = 'PASS';

    // Check data source health
    const dsGuard = getDataSourceGuard();
    const dataSourcesHealthy = dsGuard.isSafeForAI();

    if (!dataSourcesHealthy) {
      warnings.push('数据源异常，AI推荐可能不准确');
      level = 'WARNED';
    }

    // Detect sensitive fields
    const sensitiveFields = detectSensitiveData(input);
    if (sensitiveFields.length > 0) {
      warnings.push(`输入包含敏感数据: ${sensitiveFields.join(', ')}`);
    }

    // Sanitize
    const sanitizedInput = sanitizeForAI(input);
    if (sanitizedInput !== input) {
      level = level === 'PASS' ? 'SANITIZED' : level;
    }

    return {
      level: sensitiveFields.length > 5 ? 'BLOCKED' : level,
      sanitizedInput,
      sensitiveFields,
      dataSourcesHealthy,
      warnings,
    };
  }

  /** Guard AI output: inspect + hallucination check + credibility badges. */
  guardOutput(output: string, context?: OutputContext): OutputSecurityCheck {
    this.outputSessions++;

    const warnings: string[] = [];
    let level: SecurityLevel = 'PASS';

    // 1. Output guard inspection
    const guard = getAIOutputGuard();
    const guardResult = guard.inspect(output);

    if (!guardResult.passed) {
      this.blocksThisHour++;
      const explanation = guardExplain(guardResult);
      return {
        level: 'BLOCKED',
        allowedOutput: 'AI回复已被安全护栏拦截。',
        guardResult,
        credibilityBadges: [],
        blockExplanation: `${explanation.headline}\n${explanation.details.map(d => d.userFriendly).join('; ')}\n${explanation.suggestion}`,
        warnings,
      };
    }

    if (guardResult.violations.length > 0) {
      level = 'SANITIZED';
      warnings.push('输出已脱敏处理');
    }

    // 1.5 Semantic circumvention check (R182 P1-08)
    const semanticResult = semanticCheck(output);
    if (!semanticResult.passed) {
      level = 'WARNED';
      warnings.push(semanticResult.summary);

      // Block if severe semantic circumvention detected
      if (!semanticResult.safeToDeliver) {
        this.blocksThisHour++;
        return {
          level: 'BLOCKED',
          allowedOutput: 'AI回复被语义安全检测拦截。检测到疑似绕过安全护栏的表达方式。',
          guardResult,
          credibilityBadges: [],
          blockExplanation: `${semanticResult.summary}
${semanticResult.matches.map(m => m.explanation).join('; ')}`,
          warnings,
        };
      }
    }

    // 2. Hallucination check
    let hallucinationReport: HallucinationReport | undefined;
    let provenanceTags: Array<{ text: string; source: string; confidence: number }> | undefined;

    if (context?.factorIds.length) {
      const primaryFactor = context.factorIds[0];
      hallucinationReport = hallucinationCheck(output, primaryFactor);
      provenanceTags = tagOutputProvenance(output, context.factorIds);

      if (!hallucinationReport.safeToRecommend) {
        level = 'WARNED';
        warnings.push(hallucinationReport.summary);
      }

      const aiRatio = provenanceTags.filter(p => p.source === 'AI_INFERRED').length / Math.max(provenanceTags.length, 1);
      if (aiRatio > 0.4) {
        warnings.push(`⚠️ ${(aiRatio*100).toFixed(0)}%内容为AI推断，请以系统回测数据为准`);
      }
    }

    // 3. Credibility badges
    const credibilityBadges = hallucinationReport && provenanceTags
      ? assignCredibilityBadges(hallucinationReport, provenanceTags)
      : [];

    // Reset hourly block counter
    if (Date.now() - this.lastHourReset > 3600000) {
      this.blocksThisHour = 0;
      this.lastHourReset = Date.now();
    }

    return {
      level,
      allowedOutput: guardResult.sanitized || output,
      guardResult,
      hallucinationReport,
      provenanceTags,
      credibilityBadges,
      warnings,
    };
  }

  /** Quick check: is this text safe to display? */
  quickCheck(text: string): boolean {
    const guard = getAIOutputGuard();
    return guard.preScreen(text).safe;
  }

  /** R182 P1-07: Explain why a previous output was blocked. */
  explainBlock(text: string): GuardExplanation {
    const guard = getAIOutputGuard();
    const result = guard.inspect(text);
    return guardExplain(result);
  }

  /** Get security stats for monitoring dashboard. */
  getStats(): {
    inputSessions: number;
    outputSessions: number;
    blocksThisHour: number;
    blocksTotal: number;
    warnedTotal: number;
  } {
    const guard = getAIOutputGuard();
    const gs = guard.getStats();
    return {
      inputSessions: this.inputSessions,
      outputSessions: this.outputSessions,
      blocksThisHour: this.blocksThisHour,
      blocksTotal: gs.blockedCount,
      warnedTotal: gs.warnedCount,
    };
  }

  /** Mask context object for IPC transfer. */
  maskContext<T extends Record<string, unknown>>(obj: T): T {
    return maskSensitiveFields(obj) as T;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _gateway: AISecurityGateway | null = null;

export function getAISecurityGateway(): AISecurityGateway {
  if (!_gateway) _gateway = new AISecurityGateway();
  return _gateway;
}

export function resetAISecurityGateway(): void {
  _gateway = null;
}

log.info('[AISecurityGateway] Initialized — 9 security modules unified');
