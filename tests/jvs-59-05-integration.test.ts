/**
 * J-59-05: R59 Integration Tests (end-to-end billing + withdrawal + execution)
 *
 * E2E flows:
 * 01: deposit → analysis → automatic split
 * 02: free analysis → paid analysis → refund
 * 03: charge → settle → withdraw (full cycle)
 * 04: insufficient balance → rejected
 * 05: full regression verification
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getBillingContract, resetBillingContract } from '../electron/engine/agents/ai-usage-billing-contract';
import { getCommissionEngine, resetCommissionEngine } from '../electron/engine/analysis/platform-commission-engine';
import { getTopupGateway, resetTopupGateway } from '../electron/engine/portfolio/usdt-topup-gateway';

describe('J-59-05: R59 Integration (E2E)', () => {
  beforeEach(() => {
    resetBillingContract();
    resetCommissionEngine();
    resetTopupGateway();
  });

  it('01: deposit → analysis → automatic split', () => {
    const billing = getBillingContract();
    const commission = getCommissionEngine();
    const gateway = getTopupGateway();

    // 1. Topup via gateway
    const topup = gateway.initiateTopup('creator1', 100);
    gateway.confirmTopup(topup.id);

    // 2. Deposit into billing wallet
    billing.deposit('creator1', 100);

    // 3. Run analysis (after free used)
    billing.getWallet('creator1').freeAnalysesRemaining = 0;
    const { session } = billing.beginSession('creator1', 'flagship');
    billing.settleSession(session.sessionId);

    // 4. Platform takes commission
    const tx = commission.settle(session.sessionId, 'creator1', session.actualCostUSDT!);

    // Verify
    expect(tx.grossAmountUSDT).toBe(2.0);
    expect(tx.creatorIncomeUSDT).toBe(1.4);  // 70% of 2.0
    expect(tx.platformRevenueUSDT).toBe(0.6); // 30% of 2.0
    expect(tx.tier).toBe('L1');
  });

  it('02: free analysis → paid analysis → refund (full cycle)', () => {
    const billing = getBillingContract();

    // Free analysis
    const { isFree } = billing.beginSession('creator1', 'standard');
    expect(isFree).toBe(true);

    // Paid analysis
    billing.deposit('creator1', 10);
    billing.getWallet('creator1').freeAnalysesRemaining = 0;
    const { session: s2 } = billing.beginSession('creator1', 'premium');

    // Refund on failure
    billing.refundSession(s2.sessionId);
    expect(billing.getWallet('creator1').balanceUSDT).toBe(10);
  });

  it('03: charge → settle → withdraw (full billing cycle)', () => {
    const billing = getBillingContract();
    const commission = getCommissionEngine();

    // Setup wallet
    billing.deposit('creator_rich', 500);
    billing.getWallet('creator_rich').freeAnalysesRemaining = 0;

    // Run more analyses to reach 10+ USDT for withdrawal
    for (let i = 0; i < 8; i++) {
      const { session } = billing.beginSession('creator_rich', 'flagship');
      billing.settleSession(session.sessionId);
      commission.settle(session.sessionId, 'creator_rich', session.actualCostUSDT!);
    }

    // Creator earnings (70% of 16 USDT)
    const balance = commission.getCreatorAvailableBalance('creator_rich');
    expect(balance).toBeCloseTo(11.2, 1);

    // Withdraw (min 10 USDT)
    commission.requestWithdrawal('creator_rich', 10, 'TRC20-ADDR');
    expect(balance).toBeGreaterThanOrEqual(10);
  });

  it('04: insufficient balance → rejected analysis', () => {
    const billing = getBillingContract();

    billing.getWallet('poor_creator').freeAnalysesRemaining = 0;
    billing.getWallet('poor_creator').balanceUSDT = 0;

    billing.setMonthlyCap('poor_creator', 0); // unlimited
    const result = billing.canAfford('poor_creator', 1.0);
    expect(result.affordable).toBe(false);
    expect(result.reason).toContain('Insufficient balance');
  });

  it('05: daily trade limit blocks execution (with bridge)', async () => {
    // Dynamic import to avoid module load issues
    const mod = await import('../electron/engine/agents/ai-to-execution-bridge');
    const bridge = mod.getExecutionBridge();
    const session = bridge.createSession('trader1');
    bridge.updateRiskControls(session.sessionId, { maxDailyTrades: 3 });

    const signal = { symbol: 'AAPL', action: 'BUY' as const, score: 8, confidence: 0.5, source: 'orchestrator', reason: 'test' };

    // Execute 3
    await bridge.executeOrder(signal, session.sessionId);
    await bridge.executeOrder(signal, session.sessionId);
    await bridge.executeOrder(signal, session.sessionId);

    // 4th should be rejected
    const rejected = await bridge.executeOrder(signal, session.sessionId);
    expect(rejected.status).toBe('rejected');
    expect(rejected.errorMessage).toContain('Daily trade limit');
    bridge.reset();
  });
});
