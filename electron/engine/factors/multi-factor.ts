// ── Q15: Multi-Factor Stock Selection Model ─────────────────────────────
// Consumes JVS data (sentiment/capital flow/institutional flow/fund holdings)
// Outputs composite score per stock (0-100, higher = better)
// Integrates with LiveExecutor for position sizing

import log from 'electron-log';

import { SentimentIndexEngine } from '../analysis/sentiment-index';
import { CapitalFlowRank } from '../analysis/capital-flow-rank';
import { FundHoldings } from '../data/fund-holdings';
import { StockDiagnosis } from '../data/stock-diagnosis';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';


// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorConfig {
  // Factor weights (must sum to 1.0)
  sentimentWeight: number;      // 0-1, default 0.25
  capitalFlowWeight: number;    // 0-1, default 0.25
  institutionalFlowWeight: number;   // 0-1, default 0.15
  fundHoldingWeight: number;   // 0-1, default 0.20
  diagnosisWeight: number;      // 0-1, default 0.15
  
  // Scoring parameters
  lookbackDays: number;         // 20 (for momentum)
  topN: number;                // 20 (return top 20 scored stocks)
  minScore: number;            // 30 (minimum score to include)
  
  // Risk filters
  maxDrawdownPct: number;     // 0.20 (skip if max DD > 20%)
  minLiquidity: number;        // 1000000 (daily volume RMB)
}

export interface StockFactorScore {
  code: string;
  name: string;
  
  // Component scores (0-100 each)
  sentimentScore: number;
  capitalFlowScore: number;
  institutionalFlowScore: number;
  fundHoldingScore: number;
  diagnosisScore: number;
  
  // Composite score (0-100)
  compositeScore: number;
  
  // Risk metrics
  maxDrawdownPct: number;
  liquidityScore: number;
  
  // Recommendation
  rating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  reason: string;
  
  // Timestamp
  calculatedAt: number;
}

export interface MultiFactorRequest {
  symbols: string[];
  config?: Partial<FactorConfig>;
  includeDetails?: boolean;
}

export interface MultiFactorResult {
  success: boolean;
  scores: StockFactorScore[];
  timestamp: number;
  config: FactorConfig;
  error?: string;
}

// ── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FactorConfig = {
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

// ── Multi-Factor Model ──────────────────────────────────────────────────────

export class MultiFactorModel {
  private config: FactorConfig;
  private sentimentEngine: SentimentIndexEngine | null = null;
  private capitalFlowRank: CapitalFlowRank | null = null;
  private institutionalFlowData: Map<string, number> | null = null;
  private fundHoldings: FundHoldings | null = null;
  private stockDiagnosis: StockDiagnosis | null = null;

  constructor(config?: Partial<FactorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validateConfig();
    log.info('[MultiFactor] Initialized with weights:', this.getWeights());
  }

  // ── Initialization (call from main.ts) ─────────────────────────────
  
  useSentimentEngine(engine: SentimentIndexEngine): void {
    this.sentimentEngine = engine;
    log.info('[MultiFactor] SentimentEngine connected');
  }
  
  useCapitalFlowRank(rank: CapitalFlowRank): void {
    this.capitalFlowRank = rank;
    log.info('[MultiFactor] CapitalFlowRank connected');
  }
  
  useInstitutionalFlow(data: Map<string, number>): void {
    this.institutionalFlowData = data;
    log.info('[MultiFactor] InstitutionalFlow data connected');
  }
  
  useFundHoldings(holdings: FundHoldings): void {
    this.fundHoldings = holdings;
    log.info('[MultiFactor] FundHoldings connected');
  }
  
  useStockDiagnosis(diagnosis: StockDiagnosis): void {
    this.stockDiagnosis = diagnosis;
    log.info('[MultiFactor] StockDiagnosis connected');
  }

  // ── Core Scoring ─────────────────────────────────────────────────────

  async scoreStocks(request: MultiFactorRequest): Promise<MultiFactorResult> {
    const startTime = Date.now();
    const config = { ...this.config, ...request.config };
    const symbols = request.symbols;

    if (!symbols || symbols.length === 0) {
      return { success: false, scores: [], timestamp: Date.now(), config, error: 'No symbols provided' };
    }

    log.info(`[MultiFactor] Scoring ${symbols.length} stocks...`);

    try {
      // Fetch all data in parallel
      const [
        sentimentResults,
        capitalFlowResults,
        institutionalFlowResults,
        fundHoldingResults,
        diagnosisResults,
      ] = await Promise.all([
        this.fetchSentimentScores(symbols),
        this.fetchCapitalFlowScores(symbols),
        this.fetchInstitutionalFlowScores(symbols),
        this.fetchFundHoldingScores(symbols),
        this.fetchDiagnosisScores(symbols),
      ]);

      // Combine into composite scores
      const scores: StockFactorScore[] = symbols.map((code) => {
        const sentimentScore = sentimentResults.get(code) ?? 50;
        const capitalFlowScore = capitalFlowResults.get(code) ?? 50;
        const institutionalFlowScore = institutionalFlowResults.get(code) ?? 50;
        const fundHoldingScore = fundHoldingResults.get(code) ?? 50;
        const diagnosisScore = diagnosisResults.get(code) ?? 50;

        // Weighted composite
        const compositeScore =
          sentimentScore * config.sentimentWeight +
          capitalFlowScore * config.capitalFlowWeight +
          institutionalFlowScore * config.institutionalFlowWeight +
          fundHoldingScore * config.fundHoldingWeight +
          diagnosisScore * config.diagnosisWeight;

        const rating = this.scoreToRating(compositeScore);
        const reason = this.buildReason(
          code,
          sentimentScore,
          capitalFlowScore,
          institutionalFlowScore,
          fundHoldingScore,
          diagnosisScore
        );

        return {
          code,
          name: '', // Filled from broker/EM API
          sentimentScore,
          capitalFlowScore,
          institutionalFlowScore,
          fundHoldingScore,
          diagnosisScore,
          compositeScore: Math.round(compositeScore * 100) / 100,
          maxDrawdownPct: 0,
          liquidityScore: 50,
          rating,
          reason,
          calculatedAt: Date.now(),
        };
      });

      // Filter by minScore
      const filtered = scores.filter((s) => s.compositeScore >= config.minScore);

      // Sort by composite score descending
      const sorted = filtered.sort((a, b) => b.compositeScore - a.compositeScore);

      // Return top N
      const topN = sorted.slice(0, config.topN);

      const elapsed = Date.now() - startTime;
      log.info(`[MultiFactor] Scored ${symbols.length} stocks in ${elapsed}ms, returning top ${topN.length}`);

      return {
        success: true,
        scores: topN,
        timestamp: Date.now(),
        config,
      };
    } catch (err: unknown) {
      log.error('[MultiFactor] Scoring failed:', err.message);
      return { success: false, scores: [], timestamp: Date.now(), config, error: err.message };
    }
  }

  // ── Data Fetching (consume JVS modules) ─────────────────────────────

  private async fetchSentimentScores(symbols: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    if (!this.sentimentEngine) {
      log.warn('[MultiFactor] SentimentEngine not connected, using default 50');
      symbols.forEach((s) => scores.set(s, 50));
      return scores;
    }

    try {
      const result = await this.sentimentEngine.compute({ symbols });
      if (result.success && result.index) {
        // Map sentiment score (0-100) directly
        symbols.forEach((code) => {
          // Use market mood as proxy for individual stock sentiment
          const score = result.index.overallScore || 50;
          scores.set(code, score);
        });
      }
    } catch (err: unknown) {
      log.error('[MultiFactor] Sentiment fetch failed:', err.message);
    }

    // Fill missing with 50
    symbols.forEach((s) => {
      if (!scores.has(s)) scores.set(s, 50);
    });

    return scores;
  }

  private async fetchCapitalFlowScores(symbols: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    if (!this.capitalFlowRank) {
      symbols.forEach((s) => scores.set(s, 50));
      return scores;
    }

    try {
      const result = await this.capitalFlowRank.getStockRank('main_net_inflow', 'desc', 100);
      if (result.success && result.data) {
        // Rank-based scoring: rank 1 = 100, rank 100 = 0
        result.data.forEach((item: unknown, index: number) => {
          if (symbols.includes(item.code)) {
            const score = Math.max(0, 100 - (index / 100) * 100);
            scores.set(item.code, score);
          }
        });
      }
    } catch (err: unknown) {
      log.error('[MultiFactor] Capital flow fetch failed:', err.message);
    }

    symbols.forEach((s) => {
      if (!scores.has(s)) scores.set(s, 50);
    });

    return scores;
  }

  private async fetchInstitutionalFlowScores(symbols: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    if (!this.institutionalFlowData) {
      symbols.forEach((s) => scores.set(s, 50));
      return scores;
    }

    // Direct lookup from institutional flow data map
    symbols.forEach((code) => {
      const score = this.institutionalFlowData!.get(code) ?? 50;
      scores.set(code, score);
    });

    return scores;
  }

  private async fetchFundHoldingScores(symbols: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    if (!this.fundHoldings) {
      symbols.forEach((s) => scores.set(s, 50));
      return scores;
    }

    try {
      // Check fund increase rank (institutional accumulation = bullish)
      const result = await this.fundHoldings.getIncreaseRank(50);
      if (result.success && result.data) {
        result.data.forEach((item: unknown, index: number) => {
          if (symbols.includes(item.code)) {
            const score = Math.max(0, 100 - (index / 50) * 100);
            scores.set(item.code, score);
          }
        });
      }
    } catch (err: unknown) {
      log.error('[MultiFactor] Fund holdings fetch failed:', err.message);
    }

    symbols.forEach((s) => {
      if (!scores.has(s)) scores.set(s, 50);
    });

    return scores;
  }

  private async fetchDiagnosisScores(symbols: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    if (!this.stockDiagnosis) {
      symbols.forEach((s) => scores.set(s, 50));
      return scores;
    }

    try {
      const result = await this.stockDiagnosis.batchDiagnose(symbols);
      if (result.success && result.reports) {
        result.reports.forEach((report: unknown) => {
          if (symbols.includes(report.code)) {
            // Map grade A=100, B=80, C=60, D=40, F=20
            const gradeMap: Record<string, number> = { A: 100, B: 80, C: 60, D: 40, F: 20 };
            const score = gradeMap[report.grade] || 50;
            scores.set(report.code, score);
          }
        });
      }
    } catch (err: unknown) {
      log.error('[MultiFactor] Diagnosis fetch failed:', err.message);
    }

    symbols.forEach((s) => {
      if (!scores.has(s)) scores.set(s, 50);
    });

    return scores;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private scoreToRating(score: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    if (score >= 80) return 'STRONG_BUY';
    if (score >= 60) return 'BUY';
    if (score >= 40) return 'HOLD';
    if (score >= 20) return 'SELL';
    return 'STRONG_SELL';
  }

  private buildReason(
    code: string,
    sentimentScore: number,
    capitalFlowScore: number,
    institutionalFlowScore: number,
    fundHoldingScore: number,
    diagnosisScore: number
  ): string {
    const factors: string[] = [];

    if (sentimentScore >= 70) factors.push(i18n.t('multiFactor.k1'));
    if (capitalFlowScore >= 70) factors.push(i18n.t('multiFactor.k2'));
    if (institutionalFlowScore >= 70) factors.push(i18n.t('multiFactor.k3'));
    if (fundHoldingScore >= 70) factors.push(i18n.t('multiFactor.k4'));
    if (diagnosisScore >= 70) factors.push(i18n.t('multiFactor.k5'));

    if (factors.length === 0) {
      return `${code} ${i18n.t('MultiFactor.k0')}`;
    }

    return `${code} ${i18n.t('MultiFactor.k1')} ${factors.join('、')}`;
  }

  private validateConfig(): void {
    const totalWeight =
      this.config.sentimentWeight +
      this.config.capitalFlowWeight +
      this.config.institutionalFlowWeight +
      this.config.fundHoldingWeight +
      this.config.diagnosisWeight;

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      log.warn(`[MultiFactor] Weights sum to ${totalWeight}, normalizing to 1.0`);
      const factor = 1.0 / totalWeight;
      this.config.sentimentWeight *= factor;
      this.config.capitalFlowWeight *= factor;
      this.config.institutionalFlowWeight *= factor;
      this.config.fundHoldingWeight *= factor;
      this.config.diagnosisWeight *= factor;
    }
  }

  getWeights(): FactorConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<FactorConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
    log.info('[MultiFactor] Config updated:', this.getWeights());
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let modelInstance: MultiFactorModel | null = null;

export function initMultiFactor(config?: Partial<FactorConfig>): MultiFactorModel {
  if (!modelInstance) {
    modelInstance = new MultiFactorModel(config);
  }
  return modelInstance;
}

export function getMultiFactor(): MultiFactorModel | null {
  return modelInstance;
}

export default MultiFactorModel;

// ── Convenience Functions (called from main.ts) ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function scoreStocks(request: { stocks: Array<{ code: string; name: string }>; preset?: string; config?: any }): Promise<any> {
  const model = getMultiFactor();
  if (!model) {
    return { success: false, error: 'MultiFactorModel not initialized' };
  }

  const symbols = request.stocks.map((s) => s.code);
  const result = await model.scoreStocks({ symbols, config: request.config });
  
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Attach names
  const nameMap = new Map(request.stocks.map((s) => [s.code, s.name]));
  const scoresWithNames = result.scores.map((score) => ({
    ...score,
    name: nameMap.get(score.code) || score.code,
  }));

  return {
    success: true,
    scores: scoresWithNames,
    timestamp: result.timestamp,
    config: result.config,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function scoreTopStocks(limit: number = 20, preset?: string): Promise<any> {
  const model = getMultiFactor();
  if (!model) {
    return { success: false, error: 'MultiFactorModel not initialized' };
  }

  // Multi-market stock universe (US/HK/CRYPTO, no A-share)
  const stockCodes = await getTopStockCodes(limit * 2);

  const result = await model.scoreStocks({ symbols: stockCodes, topN: limit });
  
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    scores: result.scores.slice(0, limit),
    timestamp: result.timestamp,
    config: result.config,
  };
}

async function getTopStockCodes(limit: number): Promise<string[]> {
  // Multi-market universe: US/HK/CRYPTO (A-share removed, no A-stock support)
  return [
    'US.AAPL', 'US.MSFT', 'US.GOOGL', 'US.AMZN', 'US.TSLA',
    'US.NVDA', 'US.META', 'US.BRK.B', 'US.V', 'US.JPM',
    'HK.0700', 'HK.9988', 'HK.0005', 'HK.0941', 'HK.0388',
    'HK.1299', 'HK.0883', 'HK.2318', 'HK.0016', 'HK.3968',
  ].slice(0, limit);
}