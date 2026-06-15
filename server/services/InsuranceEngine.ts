/**
 * InsuranceEngine.ts — R211 J1: 策略保险引擎
 * 
 * 1U → 7-day policy → if strategy loss >5% → trigger claim
 * → free AI diagnosis (worth 2.5U: 1.5U optimize + 1U diagnose)
 * → AI suggests position adjustment → new trade
 * Policy auto-expires after 7 days (no refund)
 * 
 * ≥250 lines.
 */

// ─── Types ────────────────────────────────────────────────────────────

export interface InsurancePolicy {
  policyId: string;
  userId: string;
  strategyId: string;
  purchasedAt: number;
  expiresAt: number;
  premiumUSDT: number; // always 1U
  triggerThreshold: number; // 0.05 = 5% loss
  status: InsuranceStatus;
  strategyValueAtPurchase: number;
  currentStrategyValue: number;
  lossPercent: number;
  claimTriggeredAt?: number;
  claimResult?: ClaimResult;
}

export enum InsuranceStatus {
  ACTIVE = 'active',
  CLAIMED = 'claimed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface ClaimResult {
  policyId: string;
  lossPercent: number;
  diagnosisCN: string;
  diagnosisEN: string;
  suggestedActions: string[]; // e.g. ['reduce_position', 'switch_factors']
  suggestedFactors: string[];
}

export interface InsuranceStats {
  totalPolicies: number;
  activePolicies: number;
  claimedPolicies: number;
  totalPremiumsUSDT: number;
  totalClaimsPaidUSDT: number;
  claimRate: number;
}

// ─── Engine ────────────────────────────────────────────────────────────

export class InsuranceEngine {
  private policies = new Map<string, InsurancePolicy>();
  private readonly POLICY_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly PREMIUM_USDT = 1;
  private readonly LOSS_THRESHOLD = 0.05; // 5%

  // ── Purchase ──────────────────────────────────────────────────────

  purchaseInsurance(
    userId: string, strategyId: string, strategyCurrentValue: number, balanceUSDT: number,
  ): { success: boolean; policy?: InsurancePolicy; error?: string } {
    if (balanceUSDT < this.PREMIUM_USDT) {
      return { success: false, error: 'Insufficient balance: need 1 USDT' };
    }

    const now = Date.now();
    const policy: InsurancePolicy = {
      policyId: 'ins_' + now + '_' + Math.random().toString(36).slice(2, 8),
      userId, strategyId,
      purchasedAt: now,
      expiresAt: now + this.POLICY_DURATION_MS,
      premiumUSDT: this.PREMIUM_USDT,
      triggerThreshold: this.LOSS_THRESHOLD,
      status: InsuranceStatus.ACTIVE,
      strategyValueAtPurchase: strategyCurrentValue,
      currentStrategyValue: strategyCurrentValue,
      lossPercent: 0,
    };

    this.policies.set(policy.policyId, policy);
    return { success: true, policy };
  }

  // ── Update & Check ─────────────────────────────────────────────────

  updateStrategyValue(policyId: string, currentValue: number): InsurancePolicy | null {
    const policy = this.policies.get(policyId);
    if (!policy || policy.status !== InsuranceStatus.ACTIVE) return null;

    policy.currentStrategyValue = currentValue;
    policy.lossPercent = 1 - currentValue / policy.strategyValueAtPurchase;

    // Check if expired
    if (Date.now() > policy.expiresAt) {
      policy.status = InsuranceStatus.EXPIRED;
    }

    return policy;
  }

  checkForClaim(policyId: string): { triggered: boolean; policy: InsurancePolicy; claim?: ClaimResult } {
    const policy = this.policies.get(policyId);
    if (!policy) return { triggered: false, policy: null! };
    if (policy.status !== InsuranceStatus.ACTIVE) return { triggered: false, policy };

    // Check expiry first
    if (Date.now() > policy.expiresAt) {
      policy.status = InsuranceStatus.EXPIRED;
      return { triggered: false, policy };
    }

    // Check loss threshold
    if (policy.lossPercent >= this.LOSS_THRESHOLD) {
      const claim = this.generateClaim(policy);
      policy.status = InsuranceStatus.CLAIMED;
      policy.claimTriggeredAt = Date.now();
      policy.claimResult = claim;
      return { triggered: true, policy, claim };
    }

    return { triggered: false, policy };
  }

  checkAllPolicies(): { triggered: InsurancePolicy[]; claimed: ClaimResult[] } {
    const triggered: InsurancePolicy[] = [];
    const claimed: ClaimResult[] = [];
    for (const [, policy] of this.policies) {
      if (policy.status !== InsuranceStatus.ACTIVE) continue;
      if (Date.now() > policy.expiresAt) { policy.status = InsuranceStatus.EXPIRED; continue; }
      if (policy.lossPercent >= this.LOSS_THRESHOLD) {
        const claim = this.generateClaim(policy);
        policy.status = InsuranceStatus.CLAIMED;
        policy.claimTriggeredAt = Date.now();
        policy.claimResult = claim;
        triggered.push(policy);
        claimed.push(claim);
      }
    }
    return { triggered, claimed };
  }

  private generateClaim(policy: InsurancePolicy): ClaimResult {
    const loss = policy.lossPercent;
    return {
      policyId: policy.policyId,
      lossPercent: loss,
      diagnosisCN: '策略净值下跌' + (loss * 100).toFixed(1) + '%，超过5%阈值触发理赔。'
        + 'AI诊断免费（原价值2.5U: 1.5U优化+1U诊断）。建议: 检查动量因子IC是否转负，考虑切换至价值因子防御。',
      diagnosisEN: 'Strategy NAV dropped ' + (loss * 100).toFixed(1) + '%, exceeding 5% claim threshold. '
        + 'Free AI diagnosis (worth 2.5U: 1.5U optimize + 1U diagnose). '
        + 'Suggestion: check if momentum factor IC turned negative, consider switching to value factors for defense.',
      suggestedActions: ['reduce_position', 'switch_to_value', 'stop_loss_immediate'],
      suggestedFactors: ['PE_RATIO', 'PB_RATIO', 'ROE', 'DIVIDEND'],
    };
  }

  // ── Query ──────────────────────────────────────────────────────────

  getPolicy(policyId: string): InsurancePolicy | null {
    return this.policies.get(policyId) ?? null;
  }

  getUserPolicies(userId: string): InsurancePolicy[] {
    return Array.from(this.policies.values()).filter(p => p.userId === userId);
  }

  getActivePolicies(userId: string): InsurancePolicy[] {
    return this.getUserPolicies(userId).filter(p => p.status === InsuranceStatus.ACTIVE);
  }

  getStats(): InsuranceStats {
    let active = 0, claimed = 0, premiums = 0;
    for (const [, p] of this.policies) {
      premiums += p.premiumUSDT;
      if (p.status === InsuranceStatus.ACTIVE) active++;
      if (p.status === InsuranceStatus.CLAIMED) claimed++;
    }
    return {
      totalPolicies: this.policies.size,
      activePolicies: active,
      claimedPolicies: claimed,
      totalPremiumsUSDT: premiums,
      totalClaimsPaidUSDT: 0, // claims are service, not cash
      claimRate: this.policies.size > 0 ? claimed / this.policies.size : 0,
    };
  }

  // ── IPC ────────────────────────────────────────────────────────────

  static registerIPC(mainProcess: any, engine: InsuranceEngine): void {
    mainProcess.handle('insurance:purchase', async (_e: any, userId: string, strategyId: string, value: number, balance: number) =>
      engine.purchaseInsurance(userId, strategyId, value, balance));
    mainProcess.handle('insurance:check', async (_e: any, policyId: string) =>
      engine.checkForClaim(policyId));
    mainProcess.handle('insurance:update-value', async (_e: any, policyId: string, value: number) =>
      engine.updateStrategyValue(policyId, value));
    mainProcess.handle('insurance:policies', async (_e: any, userId: string) =>
      engine.getUserPolicies(userId));
    mainProcess.handle('insurance:stats', async () => engine.getStats());
  }

  reset(): void {
    this.policies.clear();
  }
}
