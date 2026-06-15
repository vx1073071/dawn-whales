/**
 * AIFaultAutoRecoveryEngine.ts — R214 J1 (CORRECTED per Owner永久铁令 2026-06-16)
 *
 * ⚠️ Owner铁令: 不存在任何退款！唯一例外: AI服务执行失败时自动回退扣款（已在AIDegradationChain实现：4级全败→退1U）
 *
 * This engine:
 *   1. Reacts to AI service failures ONLY — never user-initiated
 *   2. Integrates with AIDegradationChain for 4-tier failure recovery
 *   3. Auto-reverses charge when ALL 4 tiers (deepseek→qwen→glm→er4) fail
 *   4. Logs every fault recovery for audit (no "refund" terminology)
 *   5. Provides fault statistics for system health monitoring
 *
 * v2.1.2 — COMPLIANT with Owner永久铁令: 无用户主动退款逻辑
 * "服务一经消费，非AI故障不退款"
 */

import log from 'electron-log';

// ── Types ────────────────────────────────────────────────────────────

/** AI fault severity — only EXEC_FAILURE triggers charge reversal */
export type AIFaultSeverity =
  | 'TIMEOUT_5S'       // Response >5s but delivered — no reversal
  | 'TIMEOUT_30S'      // Response >30s — no reversal but warn
  | 'PARTIAL_OUTPUT'   // Incomplete output — no reversal but warn
  | 'EXEC_FAILURE';     // ALL 4 tiers failed — CHARGE REVERSED

/** AI fault detection triggers */
export type AIFaultTrigger =
  | 'ALL_TIERS_FAILED'          // 4级全败
  | 'PARSE_ERROR'               // Output unparseable
  | 'CONNECTION_LOST'           // API connection lost mid-request
  | 'MODEL_QUOTA_EXCEEDED'      // Quota exhausted
  | 'TIMEOUT_EXCEEDED'          // Hard timeout

export interface AIFaultEvent {
  eventId: string;
  userId: string;
  serviceId: string;     // transactionId
  serviceType: string;
  chargeUSDT: number;
  severity: AIFaultSeverity;
  trigger: AIFaultTrigger;
  degraded: boolean;     // whether AIDegradationChain tried alternatives
  tiersTried: number;    // how many tiers were attempted (1-4)
  chargedReversed: boolean;
  reversedAt?: number;
  createdAt: number;
}

export interface AIFaultStats {
  totalFaults: number;
  criticalFaults: number;      // EXEC_FAILURE
  totalReversedUSDT: number;
  reversalCount: number;
  byServiceType: Record<string, { faults: number; reversed: number }>;
  byTrigger: Record<string, number>;
  faultRate: number;            // faults / total requests
  tierDistribution: Record<string, number>; // tier1...tier4 counts
}

export interface AIFaultRecoveryResult {
  reversed: boolean;
  eventId: string;
  severity: AIFaultSeverity;
  chargeUSDT: number;
  reversedUSDT: number;
  message: string;
}

// ── Engine ────────────────────────────────────────────────────────────

export class AIFaultAutoRecoveryEngine {
  private faultEvents: AIFaultEvent[] = [];
  private totalRequests: number = 0;

  // ── Record & Auto-Recover ──────────────────────────────────────────

  /**
   * Called by AIDegradationChain when an AI service encounters a fault.
   * Only EXEC_FAILURE (all 4 tiers failed) triggers charge reversal.
   * This is the ONLY path for charge reversal — users CANNOT trigger it.
   */
  recordFault(params: {
    userId: string;
    serviceId: string;
    serviceType: string;
    chargeUSDT: number;
    severity: AIFaultSeverity;
    trigger: AIFaultTrigger;
    tiersTried: number;
  }): AIFaultRecoveryResult {
    this.totalRequests++;
    const now = Date.now();
    const eventId = `aifault_${now}_${Math.random().toString(36).slice(2, 8)}`;

    // Only EXEC_FAILURE triggers charge reversal
    const shouldReverse = params.severity === 'EXEC_FAILURE';

    const event: AIFaultEvent = {
      eventId,
      userId: params.userId,
      serviceId: params.serviceId,
      serviceType: params.serviceType,
      chargeUSDT: params.chargeUSDT,
      severity: params.severity,
      trigger: params.trigger,
      degraded: params.tiersTried > 1,
      tiersTried: params.tiersTried,
      chargedReversed: shouldReverse,
      ...(shouldReverse ? { reversedAt: now } : {}),
      createdAt: now,
    };

    this.faultEvents.push(event);

    log.warn(
      `[AIFaultRecovery] ${params.severity} fault on ${params.serviceType}: ` +
      `${params.tiersTried} tiers tried, charge ${shouldReverse ? 'REVERSED' : 'NOT reversed'} ` +
      `(${params.chargeUSDT} USDT) for user ${params.userId} | trigger=${params.trigger}`
    );

    return {
      reversed: shouldReverse,
      eventId,
      severity: params.severity,
      chargeUSDT: params.chargeUSDT,
      reversedUSDT: shouldReverse ? params.chargeUSDT : 0,
      message: shouldReverse
        ? `AI服务执行失败（${params.tiersTried}层模型均失败），费用已自动退回（${params.chargeUSDT} USDT）`
        : `AI服务部分降级（${params.severity}），费用正常扣收。`,
    };
  }

  /** Record a successful AI request (for fault rate calculation) */
  recordSuccess(): void {
    this.totalRequests++;
  }

  // ── Queries ────────────────────────────────────────────────────────

  getFaultEvents(userId?: string, limit: number = 50, severityFilter?: AIFaultSeverity): AIFaultEvent[] {
    let events = [...this.faultEvents];
    if (userId) events = events.filter(e => e.userId === userId);
    if (severityFilter) events = events.filter(e => e.severity === severityFilter);
    return events.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  getEventById(eventId: string): AIFaultEvent | undefined {
    return this.faultEvents.find(e => e.eventId === eventId);
  }

  getUserReversalTotal(userId: string): { count: number; totalUSDT: number } {
    const reversed = this.faultEvents.filter(e => e.userId === userId && e.chargedReversed);
    return {
      count: reversed.length,
      totalUSDT: Math.round(reversed.reduce((s, e) => s + e.chargeUSDT, 0) * 100) / 100,
    };
  }

  // ── Statistics ─────────────────────────────────────────────────────

  getStats(): AIFaultStats {
    const critical = this.faultEvents.filter(e => e.severity === 'EXEC_FAILURE');
    const reversedEvents = this.faultEvents.filter(e => e.chargedReversed);

    const byServiceType: Record<string, { faults: number; reversed: number }> = {};
    for (const e of this.faultEvents) {
      const entry = byServiceType[e.serviceType] || { faults: 0, reversed: 0 };
      entry.faults++;
      if (e.chargedReversed) entry.reversed++;
      byServiceType[e.serviceType] = entry;
    }

    const byTrigger: Record<string, number> = {};
    for (const e of this.faultEvents) {
      byTrigger[e.trigger] = (byTrigger[e.trigger] || 0) + 1;
    }

    const tierDistribution: Record<string, number> = {};
    for (const e of this.faultEvents) {
      const tier = `tier${e.tiersTried}`;
      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
    }

    return {
      totalFaults: this.faultEvents.length,
      criticalFaults: critical.length,
      totalReversedUSDT: Math.round(reversedEvents.reduce((s, e) => s + e.chargeUSDT, 0) * 100) / 100,
      reversalCount: reversedEvents.length,
      byServiceType,
      byTrigger,
      faultRate: this.totalRequests > 0
        ? Math.round((this.faultEvents.length / this.totalRequests) * 10000) / 100
        : 0,
      tierDistribution,
    };
  }

  /** Check if a recent fault is recoverable (for billing decision) */
  isFaultRecoverable(serviceId: string): boolean {
    const event = this.faultEvents.find(e => e.serviceId === serviceId && e.chargedReversed);
    return !!event;
  }

  /** Get the AI fault disclaimer text (required by Owner铁令 #5) */
  getDisclaimer(): { cn: string; en: string } {
    return {
      cn: '服务一经消费，非AI故障不退款',
      en: 'No refunds for consumed services except AI execution failure.',
    };
  }

  // ── Seed mock data for dev ─────────────────────────────────────────

  seedMockData(count: number = 10): void {
    const triggers: AIFaultTrigger[] = ['ALL_TIERS_FAILED', 'PARSE_ERROR', 'CONNECTION_LOST', 'TIMEOUT_EXCEEDED', 'MODEL_QUOTA_EXCEEDED'];
    const severities: AIFaultSeverity[] = ['EXEC_FAILURE', 'TIMEOUT_30S', 'PARTIAL_OUTPUT', 'TIMEOUT_5S'];
    const services = ['AI_CHAT', 'BACKTEST_READ', 'OPTIMIZE', 'PARAM_FILL', 'TA_STANDARD'];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const severity = severities[i % severities.length];
      const tiersTried = severity === 'EXEC_FAILURE' ? 4 : [1, 2, 3][Math.floor(Math.random() * 3)];
      this.recordFault({
        userId: 'user_mock_1',
        serviceId: `txn_fault_mock_${i}`,
        serviceType: services[i % services.length],
        chargeUSDT: [1, 1.5, 2][Math.floor(Math.random() * 3)],
        severity,
        trigger: triggers[i % triggers.length],
        tiersTried,
      });
      // Simulate ~70% success rate
      for (let s = 0; s < 3; s++) this.recordSuccess();
    }
  }

  reset(): void {
    this.faultEvents = [];
    this.totalRequests = 0;
  }
}

export const aiFaultAutoRecoveryEngine = new AIFaultAutoRecoveryEngine();
