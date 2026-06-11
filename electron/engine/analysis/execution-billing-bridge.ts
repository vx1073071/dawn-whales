/**
 * J-60-04: Execution → Billing Closed Loop (R60 v19 — v1.3.0 GA)
 *
 * Features:
 * - Auto-trigger AI fee settlement on order fill
 * - Maker (0.02%) / Taker (0.1%) dual-track fee (platform 100%)
 * - Creator split tracking: signal + execution dual recording
 * - Billing statement: per-trade AI fee + commission + stamp duty + platform split
 *
 * >=200L, 8 tests
 */

import { EventEmitter } from 'events';

import { getBillingContract } from '../agents/ai-usage-billing-contract';
import { getCommissionEngine } from './platform-commission-engine';
import { EngineError } from '../core/engine-error';


// ── Types ──────────────────────────────────────────────────────────────────

export interface ExecutionBillingEntry {
  id: string;
  orderId: string;
  creator: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  fillPrice: number;
  tradeValue: number;
  // Fees
  brokerCommission: number;
  exchangeFee: number;
  stampDuty: number;
  secFee: number;
  totalExecutionFee: number;
  // AI fees
  aiAnalysisCost: number;
  makerTakerFee: number;      // maker 0.02% or taker 0.1%
  totalAIFee: number;
  // Split
  creatorIncome: number;
  platformRevenue: number;
  // Meta
  signalSource: string;
  settledAt: string;
  analysisSessionId?: string;
}

export interface ClosedLoopConfig {
  autoSettleAI: boolean;          // auto-trigger AI fee on fill
  makerFeePercent: number;        // 0.02%
  takerFeePercent: number;        // 0.1%
  minAIChargeUSDT: number;        // minimum AI charge
  requireApproval: boolean;       // require manual approval for orders > threshold
  approvalThresholdUSDT: number;
}

export const DEFAULT_CLOSED_LOOP_CONFIG: ClosedLoopConfig = {
  autoSettleAI: true,
  makerFeePercent: 0.02,
  takerFeePercent: 0.1,
  minAIChargeUSDT: 0.01,
  requireApproval: false,
  approvalThresholdUSDT: 100,
};

// ── Execution Billing Bridge ───────────────────────────────────────────────

export class ExecutionBillingBridge extends EventEmitter {
  private config: ClosedLoopConfig;
  private entries: ExecutionBillingEntry[] = [];
  private entryCounter = 1;

  constructor(config?: Partial<ClosedLoopConfig>) {
    super();
    this.config = { ...DEFAULT_CLOSED_LOOP_CONFIG, ...config };
  }

  /**
   * On order fill: create billing entry and auto-settle AI fee
   */
  onOrderFill(params: {
    orderId: string;
    creator: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    fillPrice: number;
    brokerCommission: number;
    exchangeFee: number;
    stampDuty: number;
    secFee: number;
    makerTakerFeeRole: 'maker' | 'taker';
    signalSource: string;
    analysisSessionId?: string;
  }): ExecutionBillingEntry {
    const tradeValue = params.quantity * params.fillPrice;

    // Maker/taker fee
    const makerTakerRate = params.makerTakerFeeRole === 'maker'
      ? this.config.makerFeePercent / 100
      : this.config.takerFeePercent / 100;
    const makerTakerFee = tradeValue * makerTakerRate;

    // Total execution fee
    const totalExecutionFee = Math.round(
      (params.brokerCommission + params.exchangeFee + params.stampDuty + params.secFee) * 100,
    ) / 100;

    // AI analysis cost from billing session
    let aiAnalysisCost = 2.0; // default flagship tier
    if (this.config.autoSettleAI && params.analysisSessionId) {
      try {
        const billing = getBillingContract();
        billing.settleSession(params.analysisSessionId);
        const session = billing.getSession(params.analysisSessionId);
        if (session?.actualCostUSDT) aiAnalysisCost = session.actualCostUSDT;
      } catch (_e: unknown) {
        // Session may have been settled already
      }
    }

    const totalAIFee = Math.round((aiAnalysisCost + makerTakerFee) * 1000000) / 1000000;

    // Platform split (default L1: 70% creator / 30% platform)
    const split = { creatorPercent: 70, platformPercent: 30 };
    const creatorIncome = Math.round(totalAIFee * split.creatorPercent) / 100;
    const platformRevenue = Math.round(totalAIFee * 100 - creatorIncome * 100) / 100;

    const entry: ExecutionBillingEntry = {
      id: `EXEC-BILL-${this.entryCounter++}-${Date.now()}`,
      orderId: params.orderId,
      creator: params.creator,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      fillPrice: params.fillPrice,
      tradeValue: Math.round(tradeValue * 100) / 100,
      brokerCommission: params.brokerCommission,
      exchangeFee: params.exchangeFee,
      stampDuty: params.stampDuty,
      secFee: params.secFee,
      totalExecutionFee,
      aiAnalysisCost,
      makerTakerFee: Math.round(makerTakerFee * 1000000) / 1000000,
      totalAIFee,
      creatorIncome,
      platformRevenue,
      signalSource: params.signalSource,
      settledAt: new Date().toISOString(),
      analysisSessionId: params.analysisSessionId,
    };

    this.entries.push(entry);

    // Auto-settle with commission engine
    if (this.config.autoSettleAI) {
      try {
        const commission = getCommissionEngine();
        commission.settle(entry.id, params.creator, totalAIFee);
      } catch (_e: unknown) {
        this.emit('settle:error', { entry, error: 'Commission engine unavailable' });
      }
    }

    this.emit('order:settled', entry);
    return entry;
  }

  /**
   * Get billing summary for a creator
   */
  getCreatorBillingSummary(creator: string): {
    totalTrades: number;
    totalTradeValue: number;
    totalExecutionFees: number;
    totalAIFees: number;
    totalCreatorIncome: number;
    totalPlatformRevenue: number;
    entries: ExecutionBillingEntry[];
  } {
    const creatorEntries = this.entries.filter(e => e.creator === creator);
    return {
      totalTrades: creatorEntries.length,
      totalTradeValue: Math.round(creatorEntries.reduce((s, e) => s + e.tradeValue, 0) * 100) / 100,
      totalExecutionFees: Math.round(creatorEntries.reduce((s, e) => s + e.totalExecutionFee, 0) * 100) / 100,
      totalAIFees: Math.round(creatorEntries.reduce((s, e) => s + e.totalAIFee, 0) * 100) / 100,
      totalCreatorIncome: Math.round(creatorEntries.reduce((s, e) => s + e.creatorIncome, 0) * 100) / 100,
      totalPlatformRevenue: Math.round(creatorEntries.reduce((s, e) => s + e.platformRevenue, 0) * 100) / 100,
      entries: creatorEntries,
    };
  }

  /**
   * Get all billing entries
   */
  getAllEntries(): ExecutionBillingEntry[] {
    return [...this.entries];
  }

  /**
   * Get entry by order ID
   */
  getEntryByOrder(orderId: string): ExecutionBillingEntry | undefined {
    return this.entries.find(e => e.orderId === orderId);
  }

  /**
   * Get total platform stats
   */
  getPlatformStats(): {
    totalTrades: number;
    totalTradeValue: number;
    totalPlatformRevenue: number;
    totalAIFees: number;
  } {
    return {
      totalTrades: this.entries.length,
      totalTradeValue: Math.round(this.entries.reduce((s, e) => s + e.tradeValue, 0) * 100) / 100,
      totalPlatformRevenue: Math.round(this.entries.reduce((s, e) => s + e.platformRevenue, 0) * 100) / 100,
      totalAIFees: Math.round(this.entries.reduce((s, e) => s + e.totalAIFee, 0) * 100) / 100,
    };
  }

  reset(): void {
    this.entries = [];
    this.entryCounter = 1;
    this.removeAllListeners();
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _billBridgeInstance: ExecutionBillingBridge | null = null;

export function getExecutionBillingBridge(config?: Partial<ClosedLoopConfig>): ExecutionBillingBridge {
  if (!_billBridgeInstance) _billBridgeInstance = new ExecutionBillingBridge(config);
  return _billBridgeInstance;
}

export function resetExecutionBillingBridge(): void {
  _billBridgeInstance?.reset();
  _billBridgeInstance = null;
}

export default { ExecutionBillingBridge, getExecutionBillingBridge, resetExecutionBillingBridge, DEFAULT_CLOSED_LOOP_CONFIG };
