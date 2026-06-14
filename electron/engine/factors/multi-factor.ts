// ═══════════════════════════════════════════════════════════════════════
// R170 A9: DEPRECATED — multi-factor.ts
//
// Legacy MultiFactorModel has been superseded by DawnFactorFramework
// (electron/engine/factors/dawn-factor-framework.ts).
//
// This file provides backward-compatible re-exports so existing callers
// (main-slim.ts, strategy-ipc.ts, smart-picker-integration.ts) continue
// to work without modification. NEW CODE SHOULD USE DawnFactorFramework.
//
// Scheduled for full removal in R173+ after all callers are migrated.
// ═══════════════════════════════════════════════════════════════════════

import log from 'electron-log';
import {
  DawnFactorFramework,
  getDawnFactorFramework,
  DAWN_DEFAULT_CONFIG,
  type UnifiedFactorScore,
} from './dawn-factor-framework';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';

// ── Re-export legacy types (backward-compatible interface) ──────────────

/** @deprecated Use UnifiedFactorScore from dawn-factor-framework */
export interface FactorConfig {
  sentimentWeight: number;
  capitalFlowWeight: number;
  institutionalFlowWeight: number;
  fundHoldingWeight: number;
  diagnosisWeight: number;
  lookbackDays: number;
  topN: number;
  minScore: number;
  maxDrawdownPct: number;
  minLiquidity: number;
}

/** @deprecated Use UnifiedFactorScore from dawn-factor-framework */
export interface StockFactorScore {
  code: string;
  name: string;
  sentimentScore: number;
  capitalFlowScore: number;
  institutionalFlowScore: number;
  fundHoldingScore: number;
  diagnosisScore: number;
  compositeScore: number;
  rank: number;
  rating: string;
  reasoning: string;
  timestamp: number;
}

/** @deprecated Use DawnFactorFramework */
export interface MultiFactorRequest {
  codes?: string[];
  limit?: number;
  config?: Partial<FactorConfig>;
}

/** @deprecated Use DawnFactorFramework */
export interface MultiFactorResult {
  success: boolean;
  scores?: StockFactorScore[];
  error?: string;
  timestamp?: number;
  config?: FactorConfig;
}

// ── Legacy facade class — delegates to DawnFactorFramework ─────────────

/**
 * @deprecated Use DawnFactorFramework directly.
 * This class exists only for backward compatibility.
 */
export class MultiFactorModel {
  private static instance: MultiFactorModel | null = null;
  private framework: DawnFactorFramework;
  private isInitialized = false;
  private config: FactorConfig;

  private constructor() {
    this.framework = getDawnFactorFramework();
    this.config = {
      sentimentWeight: 0.25,
      capitalFlowWeight: 0.25,
      institutionalFlowWeight: 0.15,
      fundHoldingWeight: 0.20,
      diagnosisWeight: 0.15,
      lookbackDays: 20,
      topN: 20,
      minScore: 30,
      maxDrawdownPct: 0.20,
      minLiquidity: 1000000,
    };
  }

  static getInstance(): MultiFactorModel {
    if (!MultiFactorModel.instance) {
      MultiFactorModel.instance = new MultiFactorModel();
    }
    return MultiFactorModel.instance;
  }

  async init(config?: Partial<FactorConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.isInitialized = true;
    log.info('[MultiFactorModel] Initialized (delegating to DawnFactorFramework)');
  }

  async scoreStocks(
    codes: string[],
    config?: Partial<FactorConfig>,
  ): Promise<StockFactorScore[]> {
    // Translate to DawnFactorFramework scoring
    const merged = { ...this.config, ...config };
    const results: StockFactorScore[] = [];

    for (let i = 0; i < Math.min(codes.length, merged.topN); i++) {
      const code = codes[i];
      // Parse symbol (e.g., "US.AAPL" → "AAPL")
      const parts = code.includes('.') ? code.split('.') : [code];
      const symbol = parts[parts.length - 1] ?? code;
      const market = this.guessMarket(code);

      try {
        const score = await this.framework.score(symbol, market as Parameters<DawnFactorFramework['score']>[1], 'stock');
        const legacyPrecision = Math.round(score.compositeScore * 10) / 10;
        results.push({
          code,
          name: symbol,
          sentimentScore: this.getFactorScore(score, 'sentiment'),
          capitalFlowScore: this.getFactorScore(score, 'capital_flow'),
          institutionalFlowScore: this.getFactorScore(score, 'institutional_flow'),
          fundHoldingScore: this.getFactorScore(score, 'fund_holdings'),
          diagnosisScore: this.getFactorScore(score, 'stock_diagnosis'),
          compositeScore: legacyPrecision,
          rank: i + 1,
          rating: this.scoreToRating(legacyPrecision),
          reasoning: score.reasoning ?? i18n.t('multiFactor.k5'),
          timestamp: score.timestamp,
        });
      } catch {
        // Fallback on error
        results.push({
          code,
          name: symbol,
          sentimentScore: 50,
          capitalFlowScore: 50,
          institutionalFlowScore: 50,
          fundHoldingScore: 50,
          diagnosisScore: 50,
          compositeScore: 50,
          rank: i + 1,
          rating: i18n.t('multiFactor.k27'),
          reasoning: `Unable to score ${symbol}`,
          timestamp: Date.now(),
        });
      }
    }

    return results.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  async scoreTopStocks(
    codes: string[],
    limit: number = 20,
  ): Promise<{ success: boolean; scores: StockFactorScore[]; error?: string; timestamp?: number; config?: FactorConfig }> {
    try {
      const scores = await this.scoreStocks(codes, { topN: limit });
      return {
        success: true,
        scores,
        timestamp: Date.now(),
        config: this.config,
      };
    } catch (err) {
      return {
        success: false,
        error: EngineError.from(err).message,
      };
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private guessMarket(code: string): 'HKEX' | 'NYSE' | 'NASDAQ' | 'CRYPTO' | 'SGX' {
    const prefix = code.split('.')[0]?.toUpperCase() ?? '';
    if (prefix === 'HK') return 'HKEX';
    if (prefix === 'US') return 'NYSE';
    if (prefix === 'CRYPTO' || prefix === 'BTC' || prefix === 'ETH') return 'CRYPTO';
    if (prefix === 'SG') return 'SGX';
    return 'NYSE'; // default
  }

  private getFactorScore(score: UnifiedFactorScore, factorType: string): number {
    const f = score.factors?.find(x => x.category === factorType || x.factorId === factorType);
    return f ? Math.round(f.normalizedScore * 10) / 10 : 50;
  }

  private scoreToRating(score: number): string {
    if (score >= 85) return i18n.t('multiFactor.k21');
    if (score >= 70) return i18n.t('multiFactor.k22');
    if (score >= 60) return i18n.t('multiFactor.k23');
    if (score >= 40) return i18n.t('multiFactor.k24');
    if (score >= 25) return i18n.t('multiFactor.k25');
    return i18n.t('multiFactor.k26');
  }
}

// ── Singleton wrappers (backward-compatible) ─────────────────────────────

/** @deprecated Use getDawnFactorFramework */
export function initMultiFactor(config?: Partial<FactorConfig>): MultiFactorModel {
  const m = new MultiFactorModel();
  void m.init(config);
  return m;
}

/** @deprecated Use getDawnFactorFramework */
export function getMultiFactor(): MultiFactorModel {
  return MultiFactorModel.getInstance();
}

// ── Top-level convenience functions (backward-compatible) ──────────────

/** @deprecated Use DawnFactorFramework.scoreBatch */
export async function scoreStocks(
  codes: string[],
  config?: Partial<FactorConfig>,
): Promise<StockFactorScore[]> {
  return getMultiFactor().scoreStocks(codes, config);
}

/** @deprecated Use DawnFactorFramework.scoreBatch + sort */
export async function scoreTopStocks(
  codes: string[],
  limit: number = 20,
  config?: Partial<FactorConfig>,
): Promise<{ success: boolean; scores: StockFactorScore[]; error?: string; timestamp: number; config: FactorConfig }> {
  return getMultiFactor().scoreTopStocks(codes, limit);
}

/** @deprecated Legacy market universe helper */
export function getTopStockCodes(limit: number): string[] {
  return [
    'US.AAPL', 'US.MSFT', 'US.GOOGL', 'US.AMZN', 'US.TSLA',
    'US.NVDA', 'US.META', 'US.BRK.B', 'US.V', 'US.JPM',
    'HK.0700', 'HK.9988', 'HK.0005', 'HK.0941', 'HK.0388',
    'HK.1299', 'HK.0883', 'HK.2318', 'HK.0016', 'HK.3968',
  ].slice(0, limit);
}
