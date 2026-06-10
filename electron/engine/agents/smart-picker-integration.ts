// ── Q21: SmartPicker Integration ────────────────────────────────────────────
// Consumes JVS SmartPicker scores → blends into MultiFactor model
// Feeds top picks into strategy creation pipeline
// Two modes: (1) enhance multi-factor with SmartPicker scores, (2) standalone top picks

import log from 'electron-log';
import { SmartPickerService, SmartPickResult } from './smart-picker';
import { scoreTopAStocks } from '../factors/multi-factor';
import i18n from '../../../src/i18n';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SmartPickerWeightConfig {
  // How much SmartPicker contributes to blended score
  smartPickerWeight: number;   // 0-1, default 0.30 (30%)
  multiFactorWeight: number;   // 0-1, default 0.70 (70%)
}

export interface BlendedScore {
  code: string;
  name: string;

  // Individual scores (0-100)
  smartPickerScore: number;   // From SmartPicker
  multiFactorScore: number;   // From MultiFactor engine

  // Blended
  blendedScore: number;       // Weighted combination
  grade: 'S' | 'A' | 'B' | 'C' | 'D';

  // Metadata
  smartPickerReasons: string[];
  multiFactorFactors: Record<string, number>;  // e.g. { sentiment: 65, capitalFlow: 80 }
  signals: string[];
  risks: string[];

  // Source stocks (for UX)
  source: 'smartpicker' | 'multifactor' | 'blended';
}

export interface StrategyPick {
  code: string;
  name: string;
  blendedScore: number;
  grade: string;
  recommendedStrategy: string; // e.g. 'MA5/MA20 momentum breakout'
  entrySignals: string[];
  riskFactors: string[];
  positionSizePct: number;     // Kelly-based
  stopLossPct: number;
  takeProfitPct: number;
  holdingPeriodDays: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;              // Human-readable summary
}

export interface IntegrationReport {
  success: boolean;
  picks: BlendedScore[];
  strategies: StrategyPick[];
  timestamp: number;
  sourcesQueried: string[];
  error?: string;
}

// ── SmartPicker Integration ──────────────────────────────────────────────────

export class SmartPickerIntegration {
  private smartPicker: SmartPickerService;
  private weights: SmartPickerWeightConfig;

  constructor(weights?: Partial<SmartPickerWeightConfig>) {
    this.smartPicker = new SmartPickerService();
    this.weights = {
      smartPickerWeight: weights?.smartPickerWeight ?? 0.30,
      multiFactorWeight: weights?.multiFactorWeight ?? 0.70,
    };
    log.info('[SmartPickerIntegration] Initialized', this.weights);
  }

  // ── Blended Score ────────────────────────────────────────────────────────

  async getBlendedScores(topN = 20): Promise<BlendedScore[]> {
    const [spReport, mfReport] = await Promise.allSettled([
      this.smartPicker.pick({ limit: topN }),
      scoreTopAStocks(topN).catch(() => ({ scores: [], success: false })),
    ]);

    const spPicks = spReport.status === 'fulfilled' ? spReport.value.picks : [];
    const mfPicks = mfReport.status === 'fulfilled' ? mfReport.value.scores : [];

    const spMap = new Map<string, SmartPickResult>();
    for (const p of spPicks) spMap.set(p.code, p);

    const mfMap = new Map<string, number>();
    for (const s of mfPicks) mfMap.set(s.code, s.compositeScore);

    // Union of all codes
    const allCodes = new Set([...spMap.keys(), ...mfMap.keys()]);
    const results: BlendedScore[] = [];

    for (const code of allCodes) {
      const sp = spMap.get(code);
      const mfScore = mfMap.get(code) ?? 50;  // Default if not in mf

      const smartPickerScore = sp?.totalScore ?? 50;
      const multiFactorScore = mfScore;
      const blendedScore = Math.round(
        smartPickerScore * this.weights.smartPickerWeight +
        multiFactorScore * this.weights.multiFactorWeight
      );

      let grade: BlendedScore['grade'];
      if (blendedScore >= 80) grade = 'S';
      else if (blendedScore >= 70) grade = 'A';
      else if (blendedScore >= 60) grade = 'B';
      else if (blendedScore >= 50) grade = 'C';
      else grade = 'D';

      // Multi-factor breakdown (if available)
      const mfEntry = mfPicks.find((s) => s.code === code);
      const mfFactors: Record<string, number> = {};
      if (mfEntry) {
        mfFactors.sentiment = Math.round(mfEntry.sentimentScore ?? 50);
        mfFactors.capitalFlow = Math.round(mfEntry.capitalFlowScore ?? 50);
        mfFactors.dragonTiger = Math.round(mfEntry.dragonTigerScore ?? 50);
        mfFactors.fundHolding = Math.round(mfEntry.fundHoldingScore ?? 50);
        mfFactors.diagnosis = Math.round(mfEntry.diagnosisScore ?? 50);
      }

      // Signals
      const signals: string[] = [
        ...(sp?.signals || []),
        ...(mfEntry && mfEntry.capitalFlowScore > 70 ? [i18n.t('smartPickerIntegration.k1')] : []),
        ...(mfEntry && mfEntry.sentimentScore > 70 ? [i18n.t('smartPickerIntegration.k2')] : []),
      ];

      // Risks
      const risks: string[] = [
        ...(sp?.risks || []),
        ...(mfEntry && mfEntry.diagnosisScore < 40 ? [i18n.t('smartPickerIntegration.k3')] : []),
      ];

      results.push({
        code,
        name: sp?.name || mfEntry?.name || code,
        smartPickerScore,
        multiFactorScore,
        blendedScore,
        grade,
        smartPickerReasons: sp?.reasons || [],
        multiFactorFactors: mfFactors,
        signals,
        risks,
        source: sp && mfEntry ? 'blended' : sp ? 'smartpicker' : 'multifactor',
      });
    }

    results.sort((a, b) => b.blendedScore - a.blendedScore);
    return results.slice(0, topN);
  }

  // ── Strategy Picks ──────────────────────────────────────────────────────

  async getStrategyPicks(topN = 10): Promise<StrategyPick[]> {
    const blended = await this.getBlendedScores(topN * 2);

    return blended.slice(0, topN).map((stock, idx) => {
      // Strategy recommendation based on score pattern
      const strategy = this.recommendStrategy(stock);
      const confidence = this.assessConfidence(stock);

      // Position sizing: Kelly fraction, capped at 10%
      const kelly = this.kellyFraction(stock.blendedScore);
      const positionSizePct = Math.min(0.10, kelly * 0.5);

      // Stop loss / take profit
      const stopLossPct = stock.smartPickerScore < 60 ? 0.05 : 0.08;
      const takeProfitPct = stock.blendedScore >= 80 ? 0.20 : stock.blendedScore >= 70 ? 0.15 : 0.10;

      return {
        code: stock.code,
        name: stock.name,
        blendedScore: stock.blendedScore,
        grade: stock.grade,
        recommendedStrategy: strategy,
        entrySignals: stock.signals.slice(0, 3),
        riskFactors: stock.risks.slice(0, 3),
        positionSizePct: Math.round(positionSizePct * 100) / 100,
        stopLossPct,
        takeProfitPct,
        holdingPeriodDays: this.estimateHoldingDays(stock),
        confidence,
        reason: this.generateReason(stock, strategy),
      };
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private recommendStrategy(stock: BlendedScore): string {
    const sp = stock.smartPickerScore;
    const mf = stock.multiFactorScore;
    const tech = stock.multiFactorFactors.technical ?? stock.smartPickerScore;

    // Momentum strategy
    if (tech >= 75 && sp >= 70) {
      return i18n.t('smartPickerIntegration.k4');
    }
    // Value + sentiment strategy
    if (stock.multiFactorFactors.diagnosis > 70 && stock.smartPickerScore >= 65) {
      return i18n.t('smartPickerIntegration.k5');
    }
    // Capital flow driven
    if (stock.multiFactorFactors.capitalFlow >= 75) {
      return i18n.t('smartPickerIntegration.k6');
    }
    // Breakout
    if (tech >= 65) {
      return i18n.t('smartPickerIntegration.k7');
    }
    // Default
    return i18n.t('smartPickerIntegration.k8');
  }

  private assessConfidence(stock: BlendedScore): 'HIGH' | 'MEDIUM' | 'LOW' {
    const score = stock.blendedScore;
    const reasonsCount = stock.smartPickerReasons.length + Object.keys(stock.multiFactorFactors).filter(k => (stock.multiFactorFactors as any)[k] >= 65).length;
    const risksCount = stock.risks.length;

    if (score >= 75 && reasonsCount >= 3 && risksCount <= 1) return 'HIGH';
    if (score >= 60 && risksCount <= 2) return 'MEDIUM';
    return 'LOW';
  }

  private kellyFraction(score: number): number {
    // Kelly = winRate - (1 - winRate) / (win/loss ratio)
    // Approximated from blended score
    const winRate = Math.min(0.9, Math.max(0.3, score / 100 + 0.2));
    const avgWin = score / 100;
    const avgLoss = 1 - avgWin;
    const wlRatio = avgWin / Math.max(avgLoss, 0.01);
    return Math.max(0, winRate - (1 - winRate) / wlRatio);
  }

  private estimateHoldingDays(stock: BlendedScore): number {
    if (stock.blendedScore >= 80) return 5;
    if (stock.blendedScore >= 70) return 10;
    if (stock.blendedScore >= 60) return 15;
    return 20;
  }

  private generateReason(stock: BlendedScore, strategy: string): string {
    const reasons = stock.smartPickerReasons.slice(0, 2);
    if (reasons.length > 0) {
      return i18n.t('smartPickerIntegration.k9');
    }
    return i18n.t('smartPickerIntegration.k10');
  }

  // ── Report ─────────────────────────────────────────────────────────────

  async generateReport(topN = 20): Promise<IntegrationReport> {
    log.info(`[SmartPickerIntegration] Generating report, top ${topN}`);

    try {
      const [picks, strategies] = await Promise.all([
        this.getBlendedScores(topN),
        this.getStrategyPicks(Math.min(topN, 10)),
      ]);

      return {
        success: true,
        picks,
        strategies,
        timestamp: Date.now(),
        sourcesQueried: ['SmartPicker (JVS-25)', 'MultiFactor (Q15)'],
      };
    } catch (err: unknown) {
      log.error('[SmartPickerIntegration] Error:', err.message);
      return {
        success: false,
        picks: [],
        strategies: [],
        timestamp: Date.now(),
        sourcesQueried: ['SmartPicker (JVS-25)', 'MultiFactor (Q15)'],
        error: err.message,
      };
    }
  }

  // ── Weight Control ─────────────────────────────────────────────────────

  setWeights(weights: Partial<SmartPickerWeightConfig>): void {
    this.weights = { ...this.weights, ...weights };
    log.info('[SmartPickerIntegration] Weights updated:', this.weights);
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let instance: SmartPickerIntegration | null = null;

export function getSmartPickerIntegration(): SmartPickerIntegration {
  if (!instance) instance = new SmartPickerIntegration();
  return instance;
}

export default SmartPickerIntegration;
