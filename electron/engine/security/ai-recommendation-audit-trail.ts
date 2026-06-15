// ── R183 P2-05: AI Recommendation Audit Trail ───────────────────────────────
// Records the full input→compute→output chain for every AI recommendation.
// Enables:
//   - Dispute resolution: "AI told me to buy and I lost 5000U"
//   - Compliance: regulators can replay any recommendation
//   - Debugging: trace why a specific recommendation was given
//
// Each trail entry: immutable, 30-day retention, searchable by userId/intent/time.

import log from 'electron-log';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuditTrailEntry {
  trailId: string;
  timestamp: number;
  /** Masked userId (last 8 chars only) */
  userId: string;
  sessionId: string;

  // ── Input chain ──────────────────────────────────────────────────────
  rawInput: string;              // Original user query
  sanitizedInput: string;        // After sanitizeForAI()
  detectedIntent: string;        // Parsed intent
  intentConfidence: number;     // 0-1
  market: string;                // US/HK/CRYPTO

  // ── Compute chain ────────────────────────────────────────────────────
  factorWeights: Record<string, number>;
  icEstimates: Record<string, number>;
  backtestSummary: {
    expectedReturn: number;
    expectedSharpe: number;
    expectedMaxDrawdown: number;
    expectedWinRate: number;
  };
  dataSourcesHealthy: boolean;

  // ── Output chain ────────────────────────────────────────────────────
  rawAIOutput: string;           // AI output before guard
  guardResult: {
    passed: boolean;
    totalScore: number;
    violations: number;
  };
  finalOutput: string;           // What user actually saw
  blockReason?: string;

  // ── Security ─────────────────────────────────────────────────────────
  billingCharged: boolean;
  billingAmount: number;
  securityLevel: string;         // 'PASS' | 'SANITIZED' | 'WARNED' | 'BLOCKED'

  // ── Metadata ─────────────────────────────────────────────────────────
  totalLatencyMs: number;
  factors: string[];             // List of factor IDs
}

export interface TrailQuery {
  userId?: string;
  sessionId?: string;
  since?: number;                // timestamp
  until?: number;
  intent?: string;
  minRiskScore?: number;         // for compliance: find risky recommendations
  limit?: number;
}

export interface TrailStats {
  totalTrails: number;
  uniqueUsers: number;
  blockedCount: number;
  avgLatencyMs: number;
  topIntents: Array<{ intent: string; count: number }>;
}

// ── Audit Trail Store ───────────────────────────────────────────────────────

export class AIRecommendationAuditTrail {
  private trails: AuditTrailEntry[] = [];
  private static readonly MAX_TRAILS = 10000;
  private static readonly RETENTION_MS = 30 * 24 * 3600000; // 30 days

  /** Record a full recommendation audit trail. */
  record(entry: AuditTrailEntry): void {
    // Purge old entries
    this.purge();

    this.trails.push(entry);
    if (this.trails.length > AIRecommendationAuditTrail.MAX_TRAILS) {
      this.trails = this.trails.slice(-AIRecommendationAuditTrail.MAX_TRAILS);
    }
  }

  /**
   * Build a trail entry from recommendation context.
   * Call after guardOutput() for accurate guardResult.
   */
  buildTrail(params: {
    userId: string;
    sessionId: string;
    rawInput: string;
    sanitizedInput: string;
    intent: string;
    intentConfidence: number;
    market: string;
    factorWeights: Record<string, number>;
    icEstimates: Record<string, number>;
    backtestResult: { expectedReturn: number; expectedSharpe: number; expectedMaxDrawdown: number; expectedWinRate: number };
    rawAIOutput: string;
    guardPassed: boolean;
    guardScore: number;
    guardViolations: number;
    finalOutput: string;
    securityLevel: string;
    blockReason?: string;
    billingCharged: boolean;
    billingAmount: number;
    dataSourcesHealthy: boolean;
    latencyMs: number;
    factors: string[];
  }): string {
    const trailId = `trail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const entry: AuditTrailEntry = {
      trailId,
      timestamp: Date.now(),
      userId: this.maskUserId(params.userId),
      sessionId: params.sessionId,
      rawInput: params.rawInput,
      sanitizedInput: params.sanitizedInput,
      detectedIntent: params.intent,
      intentConfidence: params.intentConfidence,
      market: params.market,
      factorWeights: params.factorWeights,
      icEstimates: params.icEstimates,
      backtestSummary: params.backtestResult,
      dataSourcesHealthy: params.dataSourcesHealthy,
      rawAIOutput: params.rawAIOutput,
      guardResult: {
        passed: params.guardPassed,
        totalScore: params.guardScore,
        violations: params.guardViolations,
      },
      finalOutput: params.finalOutput,
      blockReason: params.blockReason,
      billingCharged: params.billingCharged,
      billingAmount: params.billingAmount,
      securityLevel: params.securityLevel,
      totalLatencyMs: params.latencyMs,
      factors: params.factors,
    };

    this.record(entry);
    return trailId;
  }

  /** Query audit trails with filters. */
  query(q: TrailQuery): AuditTrailEntry[] {
    let results = this.trails;

    if (q.userId) {
      const masked = this.maskUserId(q.userId);
      results = results.filter(t => t.userId === masked);
    }
    if (q.sessionId) {
      results = results.filter(t => t.sessionId === q.sessionId);
    }
    if (q.since) {
      results = results.filter(t => t.timestamp >= q.since!);
    }
    if (q.until) {
      results = results.filter(t => t.timestamp <= q.until!);
    }
    if (q.intent) {
      results = results.filter(t => t.detectedIntent === q.intent);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  /** Get a single trail by ID for full replay. */
  replay(trailId: string): AuditTrailEntry | null {
    return this.trails.find(t => t.trailId === trailId) || null;
  }

  /** Get aggregate statistics. */
  getStats(): TrailStats {
    const uniqueUsers = new Set(this.trails.map(t => t.userId)).size;
    const blockedCount = this.trails.filter(t => !t.guardResult.passed).length;
    const avgLatencyMs = this.trails.length > 0
      ? Math.round(this.trails.reduce((s, t) => s + t.totalLatencyMs, 0) / this.trails.length)
      : 0;

    const intentCounts: Record<string, number> = {};
    for (const t of this.trails) {
      intentCounts[t.detectedIntent] = (intentCounts[t.detectedIntent] || 0) + 1;
    }

    return {
      totalTrails: this.trails.length,
      uniqueUsers,
      blockedCount,
      avgLatencyMs,
      topIntents: Object.entries(intentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([intent, count]) => ({ intent, count })),
    };
  }

  /** Generate a dispute report for a specific recommendation. */
  generateDisputeReport(trailId: string): {
    found: boolean;
    report?: {
      trailId: string;
      date: string;
      intent: string;
      factors: string[];
      whatAISaid: string;
      whatUserSaw: string;
      wasBlocked: boolean;
      dataSourcesWere: string;
      billingAmount: number;
    };
  } {
    const trail = this.replay(trailId);
    if (!trail) return { found: false };

    return {
      found: true,
      report: {
        trailId: trail.trailId,
        date: new Date(trail.timestamp).toISOString(),
        intent: trail.detectedIntent,
        factors: trail.factors,
        whatAISaid: trail.rawAIOutput.substring(0, 200),
        whatUserSaw: trail.finalOutput.substring(0, 200),
        wasBlocked: !trail.guardResult.passed,
        dataSourcesWere: trail.dataSourcesHealthy ? 'healthy' : 'degraded',
        billingAmount: trail.billingAmount,
      },
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────

  private maskUserId(userId: string): string {
    if (userId.length <= 8) return '***-****';
    return `***-${userId.slice(-4)}`;
  }

  private purge(): void {
    const cutoff = Date.now() - AIRecommendationAuditTrail.RETENTION_MS;
    this.trails = this.trails.filter(t => t.timestamp >= cutoff);
  }

  clear(): void {
    this.trails = [];
    log.info('[AuditTrail] Cleared');
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _auditTrail: AIRecommendationAuditTrail | null = null;

export function getAIRecommendationAuditTrail(): AIRecommendationAuditTrail {
  if (!_auditTrail) _auditTrail = new AIRecommendationAuditTrail();
  return _auditTrail;
}

export function resetAuditTrail(): void {
  _auditTrail?.clear();
  _auditTrail = null;
}
