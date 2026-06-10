// ── Q60: Portfolio Governance Engine ───────────────────────────────────────────
// Compliance checks + Position limits + Regulatory constraints + Rule engine
// Violation tracking + Risk mandate adherence + Automated alerts

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export type ViolationSeverity = 'INFO' | 'WARNING' | 'MINOR' | 'MAJOR' | 'CRITICAL';
export type ViolationType =
  | 'POSITION_LIMIT' | 'SECTOR_LIMIT' | 'NET_EXPOSURE' | 'GROSS_EXPOSURE'
  | 'LEVERAGE_LIMIT' | 'CONCENTRATION' | 'SHORT_SELLING' | 'MARGIN_LIMIT'
  | 'RESTRICTED_SECURITY' | 'INSIDER_LIST' | 'LIQUIDITY_MIN' | 'VAR_LIMIT'
  | 'DIVERSIFICATION' | 'CURRENCY_EXPOSURE' | 'COUNTERPARTY_RISK' | 'STRATEGY_ALLOCATION';

export interface GovernanceRule {
  ruleId: string;
  name: string;
  type: ViolationType;
  description: string;
  threshold: number;          // Limit value
  scope: 'PORTFOLIO' | 'STRATEGY' | 'ASSET_CLASS' | 'SYMBOL' | 'SECTOR';
  scopeValue?: string;       // e.g. "FINANCE" sector
  action: 'ALERT' | 'BLOCK' | 'REDUCE';
  severity: ViolationSeverity;
  enabled: boolean;
}

export interface Violation {
  ruleId: string;
  ruleName: string;
  type: ViolationType;
  severity: ViolationSeverity;
  currentValue: number;
  limit: number;
  deviation: number;        // % over limit
  affectedPositions: string[];
  detectedAt: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'WAIVED';
  resolution?: string;
  resolvedAt?: string;
}

export interface GovernanceCheck {
  portfolioId: string;
  timestamp: string;

  // Overall status
  compliant: boolean;
  overallStatus: 'GREEN' | 'YELLOW' | 'RED';
  nViolations: number;
  nCritical: number;
  nMajor: number;
  nMinor: number;

  // Violations by type
  violations: Violation[];

  // Rule evaluation
  ruleResults: Array<{
    ruleId: string;
    ruleName: string;
    compliant: boolean;
    currentValue: number;
    threshold: number;
    margin: number;          // Headroom before violation
  }>;

  // Compliance score
  complianceScore: number;  // 0-100
  scoreGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

  // Historical
  historicalViolations: Array<{ date: string; type: ViolationType; severity: ViolationSeverity }>;

  recommendations: string[];
}

// ── Default Rules ────────────────────────────────────────────────────────

const DEFAULT_RULES: GovernanceRule[] = [
  {
    ruleId: 'POS_LIMIT_SINGLE',
    name: 'Single Position Limit',
    type: 'POSITION_LIMIT',
    description: 'Max 20% of portfolio in single position',
    threshold: 20,
    scope: 'SYMBOL',
    action: 'BLOCK',
    severity: 'MAJOR',
    enabled: true,
  },
  {
    ruleId: 'SECTOR_LIMIT',
    name: 'Sector Concentration Limit',
    type: 'SECTOR_LIMIT',
    description: 'Max 30% in single sector',
    threshold: 30,
    scope: 'SECTOR',
    action: 'ALERT',
    severity: 'MINOR',
    enabled: true,
  },
  {
    ruleId: 'NET_EXPOSURE',
    name: 'Net Long Exposure',
    type: 'NET_EXPOSURE',
    description: 'Net exposure must be 0-100%',
    threshold: 100,
    scope: 'PORTFOLIO',
    action: 'BLOCK',
    severity: 'CRITICAL',
    enabled: true,
  },
  {
    ruleId: 'GROSS_EXPOSURE',
    name: 'Gross Exposure Limit',
    type: 'GROSS_EXPOSURE',
    description: 'Gross exposure max 200%',
    threshold: 200,
    scope: 'PORTFOLIO',
    action: 'BLOCK',
    severity: 'MAJOR',
    enabled: true,
  },
  {
    ruleId: 'LEVERAGE_LIMIT',
    name: 'Leverage Limit',
    type: 'LEVERAGE_LIMIT',
    description: 'Max leverage 2x',
    threshold: 2,
    scope: 'PORTFOLIO',
    action: 'BLOCK',
    severity: 'CRITICAL',
    enabled: true,
  },
  {
    ruleId: 'VAR_LIMIT',
    name: 'VaR Limit',
    type: 'VAR_LIMIT',
    description: 'Portfolio VaR max 15% of portfolio value',
    threshold: 15,
    scope: 'PORTFOLIO',
    action: 'ALERT',
    severity: 'MAJOR',
    enabled: true,
  },
  {
    ruleId: 'LIQUIDITY_MIN',
    name: 'Minimum Liquidity',
    type: 'LIQUIDITY_MIN',
    description: 'Min 80% assets must be TIER1/2 liquidity',
    threshold: 80,
    scope: 'PORTFOLIO',
    action: 'ALERT',
    severity: 'MINOR',
    enabled: true,
  },
  {
    ruleId: 'DIVERSIFICATION',
    name: 'Minimum Diversification',
    type: 'DIVERSIFICATION',
    description: 'Min 10 positions',
    threshold: 10,
    scope: 'PORTFOLIO',
    action: 'ALERT',
    severity: 'MINOR',
    enabled: true,
  },
  {
    ruleId: 'CURRENCY_EXPOSURE',
    name: 'Single Currency Exposure',
    type: 'CURRENCY_EXPOSURE',
    description: 'Max 70% in single currency',
    threshold: 70,
    scope: 'PORTFOLIO',
    action: 'ALERT',
    severity: 'MINOR',
    enabled: true,
  },
  {
    ruleId: 'SHORT_LIMIT',
    name: 'Short Selling Limit',
    type: 'SHORT_SELLING',
    description: 'Short positions max 30% of portfolio',
    threshold: 30,
    scope: 'PORTFOLIO',
    action: 'BLOCK',
    severity: 'MAJOR',
    enabled: true,
  },
];

// ── Portfolio Governance Engine ─────────────────────────────────────────

export class PortfolioGovernanceEngine {
  private rules: GovernanceRule[] = [...DEFAULT_RULES];
  private violationHistory: Array<{ date: string; type: ViolationType; severity: ViolationSeverity }> = [];

  constructor() {
    log.info('[PortfolioGovernanceEngine] Initialized');
  }

  // ── Add / Update Rules ────────────────────────────────────────────

  addRule(rule: GovernanceRule): void {
    const idx = this.rules.findIndex(r => r.ruleId === rule.ruleId);
    if (idx >= 0) {
      this.rules[idx] = rule;
    } else {
      this.rules.push(rule);
    }
    log.info(`[Governance] Rule ${rule.ruleId} added/updated`);
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.ruleId === ruleId);
    if (rule) rule.enabled = false;
  }

  // ── Check Compliance ─────────────────────────────────────────────

  check(
    portfolioId: string,
    positions: Array<{
      symbol: string;
      marketValue: number;
      netValue: number;       // Long positive, short negative
      sector: string;
      currency: string;
      liquidityTier: string;
      beta: number;
    }>,
    portfolioMetrics: {
      netExposure: number;
      grossExposure: number;
      leverage: number;
      portfolioVaR: number;
      varLimit: number;
      liquidityTier1Pct: number;
    }
  ): GovernanceCheck {
    log.info(`[Governance] Checking ${portfolioId}, ${positions.length} positions`);

    const now = new Date();
    const timestamp = now.toISOString();
    const portfolioValue = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0);
    const violations: Violation[] = [];
    const ruleResults: GovernanceCheck['ruleResults'] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      let currentValue = 0;
      let affected: string[] = [];

      switch (rule.type) {
        case 'POSITION_LIMIT':
          currentValue = positions.length > 0
            ? (Math.max(...positions.map(p => Math.abs(p.marketValue)) / portfolioValue * 100))
            : 0;
          affected = positions
            .filter(p => Math.abs(p.marketValue) / portfolioValue * 100 > rule.threshold)
            .map(p => p.symbol);
          break;

        case 'SECTOR_LIMIT':
          const sectorValues: Record<string, number> = {};
          for (const p of positions) {
            sectorValues[p.sector] = (sectorValues[p.sector] ?? 0) + Math.abs(p.marketValue);
          }
          const maxSectorPct = portfolioValue > 0
            ? Math.max(...Object.values(sectorValues)) / portfolioValue * 100
            : 0;
          currentValue = maxSectorPct;
          affected = Object.entries(sectorValues)
            .filter(([, v]) => v / portfolioValue * 100 > rule.threshold)
            .map(([s]) => s);
          break;

        case 'NET_EXPOSURE':
          currentValue = Math.abs(portfolioMetrics.netExposure * 100);
          break;

        case 'GROSS_EXPOSURE':
          currentValue = portfolioMetrics.grossExposure * 100;
          break;

        case 'LEVERAGE_LIMIT':
          currentValue = portfolioMetrics.leverage;
          break;

        case 'VAR_LIMIT':
          currentValue = portfolioMetrics.portfolioVaR / portfolioValue * 100;
          break;

        case 'LIQUIDITY_MIN':
          currentValue = portfolioMetrics.liquidityTier1Pct;
          affected = positions
            .filter(p => p.liquidityTier !== 'TIER1' && p.liquidityTier !== 'TIER2')
            .map(p => p.symbol);
          break;

        case 'DIVERSIFICATION':
          currentValue = positions.length;
          break;

        case 'CURRENCY_EXPOSURE':
          const currencyValues: Record<string, number> = {};
          for (const p of positions) {
            currencyValues[p.currency] = (currencyValues[p.currency] ?? 0) + Math.abs(p.marketValue);
          }
          currentValue = portfolioValue > 0
            ? Math.max(...Object.values(currencyValues)) / portfolioValue * 100
            : 0;
          break;

        case 'SHORT_SELLING':
          const shortValue = positions.filter(p => p.netValue < 0)
            .reduce((s, p) => s + Math.abs(p.netValue), 0);
          currentValue = portfolioValue > 0 ? shortValue / portfolioValue * 100 : 0;
          break;

        default:
          currentValue = 0;
      }

      const compliant = rule.type === 'LIQUIDITY_MIN' || rule.type === 'DIVERSIFICATION'
        ? currentValue >= rule.threshold
        : currentValue <= rule.threshold;

      const margin = rule.threshold > 0
        ? (rule.type === 'LIQUIDITY_MIN' || rule.type === 'DIVERSIFICATION'
          ? (currentValue - rule.threshold) / rule.threshold * 100
          : (rule.threshold - currentValue) / rule.threshold * 100)
        : 0;

      ruleResults.push({
        ruleId: rule.ruleId,
        ruleName: rule.name,
        compliant,
        currentValue: Math.round(currentValue * 100) / 100,
        threshold: rule.threshold,
        margin: Math.round(margin * 10) / 10,
      });

      if (!compliant) {
        const deviation = rule.threshold > 0
          ? Math.abs(currentValue - rule.threshold) / rule.threshold * 100
          : 0;

        violations.push({
          ruleId: rule.ruleId,
          ruleName: rule.name,
          type: rule.type,
          severity: rule.severity,
          currentValue: Math.round(currentValue * 100) / 100,
          limit: rule.threshold,
          deviation: Math.round(deviation * 10) / 10,
          affectedPositions: affected,
          detectedAt: timestamp,
          status: 'ACTIVE',
        });

        this.violationHistory.push({
          date: timestamp,
          type: rule.type,
          severity: rule.severity,
        });
      }
    }

    // Keep last 100 violation history
    if (this.violationHistory.length > 100) {
      this.violationHistory = this.violationHistory.slice(-100);
    }

    // Status
    const nCritical = violations.filter(v => v.severity === 'CRITICAL').length;
    const nMajor = violations.filter(v => v.severity === 'MAJOR').length;
    const nMinor = violations.filter(v => v.severity === 'MINOR').length;
    const compliant_status = violations.length === 0;
    const overallStatus: GovernanceCheck['overallStatus'] =
      nCritical > 0 ? 'RED' :
        nMajor > 0 || violations.length > 3 ? 'YELLOW' : 'GREEN';

    // Compliance score
    const baseScore = 100;
    const scoreDeduction = violations.reduce((s, v) => {
      const deduct = v.severity === 'CRITICAL' ? 20 : v.severity === 'MAJOR' ? 10 : v.severity === 'MINOR' ? 3 : 1;
      return s + deduct;
    }, 0);
    const complianceScore = Math.max(0, baseScore - scoreDeduction);

    let scoreGrade: GovernanceCheck['scoreGrade'];
    if (complianceScore >= 95) scoreGrade = 'A+';
    else if (complianceScore >= 85) scoreGrade = 'A';
    else if (complianceScore >= 75) scoreGrade = 'B';
    else if (complianceScore >= 60) scoreGrade = 'C';
    else if (complianceScore >= 40) scoreGrade = 'D';
    else scoreGrade = 'F';

    const recommendations: string[] = [];
    if (nCritical > 0) recommendations.push('🚨 CRITICAL violations detected — immediate action required');
    if (nMajor > 0) recommendations.push(`⚠️ ${nMajor} major violations — review and reduce positions`);
    if (complianceScore < 75) recommendations.push(`❌ Compliance score ${complianceScore}/100 — governance review required`);
    if (recommendations.length === 0) recommendations.push('✅ All governance rules passed');

    return {
      portfolioId,
      timestamp,
      compliant: compliant_status,
      overallStatus,
      nViolations: violations.length,
      nCritical,
      nMajor,
      nMinor,
      violations,
      ruleResults,
      complianceScore,
      scoreGrade,
      historicalViolations: [...this.violationHistory],
      recommendations,
    };
  }

  // ── Acknowledge / Resolve Violation ──────────────────────────────

  acknowledgeViolation(ruleId: string): void {
    log.info(`[Governance] Violation ${ruleId} acknowledged`);
  }

  resolveViolation(ruleId: string, resolution: string): void {
    log.info(`[Governance] Violation ${ruleId} resolved: ${resolution}`);
  }

  // ── Get Rules ───────────────────────────────────────────────────

  getRules(): GovernanceRule[] {
    return [...this.rules];
  }
}

export default PortfolioGovernanceEngine;