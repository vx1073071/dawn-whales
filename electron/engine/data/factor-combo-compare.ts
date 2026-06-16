/**
 * R248 P1-11: 因子组合对比桥接 (FactorComboCompare)
 * 
 * 对比不同的因子组合 — 皮卡丘(vs)A/B测试
 * 
 * Pipeline:
 *   Pick 2+ factor bundles → run head-to-head → compare metrics
 *     → identify winner → output comparison report
 * 
 * 对比维度:
 *   1. 收益对比: totalReturn / CAGR / annualReturn
 *   2. 风险对比: maxDrawdown / volatility / downsideDeviation
 *   3. 效率对比: sharpeRatio / sortinoRatio / calmarRatio
 *   4. 稳定性对比: winRate / profitFactor / avgWinAvgLoss
 *   5. 相关性对比: beta / alpha vs benchmark
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FactorCombo {
  comboId: string;
  name: string;
  nameCn: string;
  description: string;
  factors: Array<{ factorId: string; weight: number; direction: 'long' | 'short' }>;
  /** Source scene (if from FactorSceneBridge) */
  sceneId?: string;
}

export interface ComboBacktestMetrics {
  totalReturn: number;
  cagr: number;
  annualizedReturn: number;
  maxDrawdown: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  turnoverRate: number;
  /** Monthly returns for charting */
  monthlyReturns: number[];
}

export interface ComboComparisonResult {
  comparisonId: string;
  combos: FactorCombo[];
  metrics: ComboBacktestMetrics[];
  /** Which combo won each dimension */
  winnerMap: Record<string, string>; // dimension → comboId
  /** Overall winner */
  overallWinner: string;
  /** Score breakdown */
  scores: Record<string, { total: number; breakdown: Record<string, number> }>;
  /** Correlation between combos */
  comboCorrelation: number;
  /** Human-readable summary */
  summary: string;
  summaryCn: string;
  /** Generated at */
  comparedAt: number;
}

export interface QuickCompareRequest {
  symbol: string;
  comboIds: string[];
  timeframe?: string;
  capital?: number;
}

export interface ComboStats {
  totalComparisons: number;
  mostComparedComboId: string;
  winningComboId: string;
  avgScoreDiff: number;
}

// ── Scoring weights ─────────────────────────────────────────────────────────

const SCORING_WEIGHTS: Record<string, number> = {
  cagr: 15, sharpeRatio: 20, maxDrawdown: 15,
  sortinoRatio: 10, calmarRatio: 10, winRate: 10,
  profitFactor: 10, alpha: 5, informationRatio: 5,
};

// ═══════════════════════════════════════════════════════════════════════════
// FactorComboCompare
// ═══════════════════════════════════════════════════════════════════════════

export class FactorComboCompare {
  private combos: Map<string, FactorCombo> = new Map();
  private comparisons: ComboComparisonResult[] = [];
  private stats_: ComboStats = this._initStats();

  constructor() {
    this._seedCombos();
  }

  // ── Public API: Combo Management ──────────────────────────────────────

  /** List all available factor combos */
  listCombos(filter?: { sceneId?: string; factorId?: string; minFactors?: number }): FactorCombo[] {
    let results = Array.from(this.combos.values());
    if (filter?.sceneId) results = results.filter(c => c.sceneId === filter.sceneId);
    if (filter?.factorId) results = results.filter(c => c.factors.some(f => f.factorId === filter.factorId));
    if (filter?.minFactors) results = results.filter(c => c.factors.length >= filter.minFactors!);
    return results;
  }

  /** Get a specific combo */
  getCombo(comboId: string): FactorCombo | null {
    return this.combos.get(comboId) ?? null;
  }

  /** Register a custom combo */
  registerCombo(combo: FactorCombo): void {
    this.combos.set(combo.comboId, combo);
  }

  // ── Public API: Comparison ────────────────────────────────────────────

  /**
   * Compare 2 factor combos head-to-head.
   * Runs simulated backtests for each → scores all dimensions → declares winner.
   */
  compare(
    comboIds: string[],
    symbol: string,
    options?: { timeframe?: string; capital?: number },
  ): ComboComparisonResult | null {
    if (comboIds.length < 2) return null;

    const selectedCombos: FactorCombo[] = [];
    for (const id of comboIds) {
      const combo = this.combos.get(id);
      if (!combo) return null;
      selectedCombos.push(combo);
    }

    // Run simulated backtests for each
    const metricsList = selectedCombos.map(c => this._simulateBacktest(c, symbol, options?.capital ?? 10000));

    // Score each combo
    const scores = this._scoreCombos(selectedCombos, metricsList);

    // Winner map per dimension
    const winnerMap = this._computeWinners(selectedCombos, metricsList);

    // Overall winner
    const overallWinner = Object.entries(scores)
      .sort((a, b) => b[1].total - a[1].total)[0][0];

    // Correlation between combos
    const comboCorrelation = this._computeCorrelation(
      metricsList[0].monthlyReturns,
      metricsList[1].monthlyReturns,
    );

    const summary = this._generateSummary(selectedCombos, metricsList, winnerMap, overallWinner);
    const summaryCn = this._generateSummaryCn(selectedCombos, metricsList, winnerMap, overallWinner);

    const result: ComboComparisonResult = {
      comparisonId: `compare:${comboIds.join('-')}:${Date.now()}`,
      combos: selectedCombos,
      metrics: metricsList,
      winnerMap,
      overallWinner,
      scores,
      comboCorrelation,
      summary,
      summaryCn,
      comparedAt: Date.now(),
    };

    this.comparisons.push(result);
    this._updateStats(result);

    return result;
  }

  /**
   * Quick compare — pick 2 combos + symbol → get result.
   */
  quickCompare(req: QuickCompareRequest): ComboComparisonResult | null {
    return this.compare(req.comboIds, req.symbol, { timeframe: req.timeframe, capital: req.capital });
  }

  /**
   * Compare ALL combos against each other (benchmarking).
   * Returns ranked list.
   */
  benchmarkAll(
    symbol: string,
    options?: { capital?: number },
  ): ComboComparisonResult | null {
    const allIds = Array.from(this.combos.keys());
    return this.compare(allIds, symbol, options);
  }

  // ── Public API: Queries ────────────────────────────────────────────────

  /** Get comparison history */
  getComparisonHistory(): ComboComparisonResult[] {
    return [...this.comparisons].reverse();
  }

  /** Get stats */
  getStats(): ComboStats { return { ...this.stats_ }; }

  /** Export comparison as markdown report */
  exportReport(comparisonId: string): string | null {
    const result = this.comparisons.find(c => c.comparisonId === comparisonId);
    if (!result) return null;

    const lines: string[] = [
      `# Factor Combo Comparison Report`,
      `**Symbol**: ${result.combos[0].factors.length > 0 ? 'Multi-factor' : 'N/A'} | **Date**: ${new Date(result.comparedAt).toISOString()}`,
      `**Overall Winner**: ${result.combos.find(c => c.comboId === result.overallWinner)?.name ?? result.overallWinner}`,
      ``,
      `## Combos Compared`,
    ];

    for (const c of result.combos) {
      lines.push(`- **${c.nameCn}** (${c.name}): ${c.factors.map(f => f.factorId).join(', ')}`);
    }

    lines.push('', '## Metrics Comparison', '');
    lines.push('| Metric | ' + result.combos.map(c => c.name).join(' | ') + ' | Winner |');
    lines.push('|--------|' + result.combos.map(() => '--------|').join('') + '--------|');

    const dims: Array<{ key: keyof ComboBacktestMetrics; label: string }> = [
      { key: 'cagr', label: 'CAGR (%)' },
      { key: 'sharpeRatio', label: 'Sharpe Ratio' },
      { key: 'maxDrawdown', label: 'Max Drawdown (%)' },
      { key: 'sortinoRatio', label: 'Sortino Ratio' },
      { key: 'calmarRatio', label: 'Calmar Ratio' },
      { key: 'winRate', label: 'Win Rate (%)' },
      { key: 'profitFactor', label: 'Profit Factor' },
      { key: 'volatility', label: 'Volatility (%)' },
      { key: 'alpha', label: 'Alpha (%)' },
      { key: 'beta', label: 'Beta' },
    ];

    for (const d of dims) {
      const values = result.metrics.map(m => {
        const v = m[d.key];
        if (typeof v === 'number') {
          if (d.key === 'maxDrawdown' || d.key === 'volatility') return v > 0 ? v.toFixed(1) : v.toFixed(1);
          return v.toFixed(2);
        }
        return String(v);
      });
      const winner = result.winnerMap[d.key] ?? '-';
      const winnerName = result.combos.find(c => c.comboId === winner)?.name ?? '-';
      lines.push(`| ${d.label} | ${values.join(' | ')} | ${winnerName} |`);
    }

    lines.push('', '## Scores', '');
    for (const [comboId, score] of Object.entries(result.scores)) {
      const combo = result.combos.find(c => c.comboId === comboId);
      lines.push(`- **${combo?.nameCn ?? comboId}**: ${score.total} points`);
    }

    lines.push('', `## Correlation: ${result.comboCorrelation.toFixed(2)}`);
    lines.push('', '---', `*Generated by QUANT MOO FactorComboCompare*`);

    return lines.join('\n');
  }

  /** Reset */
  reset(): void {
    this.combos.clear();
    this.comparisons.length = 0;
    this.stats_ = this._initStats();
    this._seedCombos();
  }

  // ── Private: Backtest simulation ────────────────────────────────────────

  private _simulateBacktest(combo: FactorCombo, symbol: string, capital: number): ComboBacktestMetrics {
    // Seed based on combo + symbol for reproducibility
    const seed = this._hash(combo.comboId + symbol) % 1000;
    const rng = (min: number, max: number, offset = 0) =>
      min + ((seed + offset) % 1000) / 1000 * (max - min);

    const cagr = rng(5, 25);
    const maxDrawdown = -rng(5, 35);
    const volatility = rng(10, 40);
    const sharpe = rng(0.4, 2.2);
    const sortino = sharpe + rng(0.1, 0.6);
    const calmar = cagr / Math.abs(maxDrawdown);
    const winRate = rng(38, 65);
    const profitFactor = rng(1.1, 2.8);
    const beta = rng(0.5, 1.5);
    const alpha = rng(-3, 8);
    const infoRatio = rng(0.2, 1.2);

    const monthlyReturns: number[] = [];
    for (let i = 0; i < 36; i++) {
      monthlyReturns.push(rng(-8, 12, i * 7));
    }

    return {
      totalReturn: Math.round(rng(10, 80) * 10) / 10,
      cagr: Math.round(cagr * 100) / 100,
      annualizedReturn: Math.round(cagr * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      sortinoRatio: Math.round(sortino * 100) / 100,
      calmarRatio: Math.round(calmar * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(rng(1.5, 8) * 100) / 100,
      avgLoss: Math.round(-rng(1, 6) * 100) / 100,
      beta: Math.round(beta * 100) / 100,
      alpha: Math.round(alpha * 100) / 100,
      informationRatio: Math.round(infoRatio * 100) / 100,
      turnoverRate: Math.round(rng(20, 150)),
      monthlyReturns,
    };
  }

  // ── Private: Scoring ────────────────────────────────────────────────────

  private _scoreCombos(
    combos: FactorCombo[],
    metricsList: ComboBacktestMetrics[],
  ): Record<string, { total: number; breakdown: Record<string, number> }> {
    const scores: Record<string, { total: number; breakdown: Record<string, number> }> = {};

    for (let ci = 0; ci < combos.length; ci++) {
      const combo = combos[ci];
      const m = metricsList[ci];
      const breakdown: Record<string, number> = {};
      let total = 0;

      for (const [dim, weight] of Object.entries(SCORING_WEIGHTS)) {
        // Normalize: rank each combo on this dimension
        const values = metricsList.map(ml => {
          const v = ml[dim as keyof ComboBacktestMetrics];
          if (typeof v === 'number') {
            // For drawdown, lower is better
            if (dim === 'maxDrawdown' || dim === 'volatility') return -v;
            return v;
          }
          return 0;
        });

        const maxVal = Math.max(...values, 0.01);
        const minVal = Math.min(...values, 0);
        const range = maxVal - minVal || 1;

        const val = values[ci];
        const normalized = range > 0 ? (val - minVal) / range : 0.5;
        const score = Math.round(normalized * weight * 100) / 100;
        breakdown[dim] = score;
        total += score;
      }

      scores[combo.comboId] = {
        total: Math.round(total * 10) / 10,
        breakdown,
      };
    }

    return scores;
  }

  private _computeWinners(
    combos: FactorCombo[],
    metricsList: ComboBacktestMetrics[],
  ): Record<string, string> {
    const winnerMap: Record<string, string> = {};

    const dimensions: Array<{ key: keyof ComboBacktestMetrics; lowerIsBetter: boolean }> = [
      { key: 'cagr', lowerIsBetter: false },
      { key: 'sharpeRatio', lowerIsBetter: false },
      { key: 'maxDrawdown', lowerIsBetter: true },
      { key: 'sortinoRatio', lowerIsBetter: false },
      { key: 'calmarRatio', lowerIsBetter: false },
      { key: 'winRate', lowerIsBetter: false },
      { key: 'profitFactor', lowerIsBetter: false },
      { key: 'volatility', lowerIsBetter: true },
      { key: 'alpha', lowerIsBetter: false },
      { key: 'beta', lowerIsBetter: false },
      { key: 'informationRatio', lowerIsBetter: false },
    ];

    for (const dim of dimensions) {
      let bestIdx = 0;
      let bestVal = dim.lowerIsBetter ? Infinity : -Infinity;
      for (let i = 0; i < metricsList.length; i++) {
        const v = metricsList[i][dim.key];
        if (typeof v === 'number') {
          if (dim.lowerIsBetter ? v < bestVal : v > bestVal) {
            bestVal = v;
            bestIdx = i;
          }
        }
      }
      winnerMap[dim.key] = combos[bestIdx].comboId;
    }

    return winnerMap;
  }

  // ── Private: Helpers ────────────────────────────────────────────────────

  private _computeCorrelation(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;

    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;

    let cov = 0, varA = 0, varB = 0;
    for (let i = 0; i < n; i++) {
      const da = a[i] - meanA;
      const db = b[i] - meanB;
      cov += da * db;
      varA += da * da;
      varB += db * db;
    }

    if (varA === 0 || varB === 0) return 0;
    return Math.round(cov / Math.sqrt(varA * varB) * 100) / 100;
  }

  private _generateSummary(
    combos: FactorCombo[],
    metrics: ComboBacktestMetrics[],
    winnerMap: Record<string, string>,
    overallWinner: string,
  ): string {
    const winner = combos.find(c => c.comboId === overallWinner);
    const loser = combos.find(c => c.comboId !== overallWinner);
    if (!winner || !loser) return 'Comparison complete.';

    const winDims = Object.values(winnerMap).filter(v => v === overallWinner).length;
    const totalDims = Object.keys(winnerMap).length;

    return `${winner.name} wins in ${winDims}/${totalDims} dimensions vs ${loser.name}. ` +
      `${winner.name}: CAGR ${metrics[combos.indexOf(winner)].cagr}%, MaxDD ${metrics[combos.indexOf(winner)].maxDrawdown}%, Sharpe ${metrics[combos.indexOf(winner)].sharpeRatio}.`;
  }

  private _generateSummaryCn(
    combos: FactorCombo[],
    metrics: ComboBacktestMetrics[],
    winnerMap: Record<string, string>,
    overallWinner: string,
  ): string {
    const winner = combos.find(c => c.comboId === overallWinner);
    const loser = combos.find(c => c.comboId !== overallWinner);
    if (!winner || !loser) return '对比完成。';

    const winDims = Object.values(winnerMap).filter(v => v === overallWinner).length;
    const totalDims = Object.keys(winnerMap).length;

    return `${winner.nameCn}在${winDims}/${totalDims}项指标上优于${loser.nameCn}。` +
      `${winner.nameCn}：年化${metrics[combos.indexOf(winner)].cagr}%，最大回撤${metrics[combos.indexOf(winner)].maxDrawdown}%，夏普${metrics[combos.indexOf(winner)].sharpeRatio}。`;
  }

  private _updateStats(result: ComboComparisonResult): void {
    this.stats_.totalComparisons++;
    this.stats_.winningComboId = result.overallWinner;

    const comboCounts: Record<string, number> = {};
    for (const c of result.combos) {
      comboCounts[c.comboId] = (comboCounts[c.comboId] ?? 0) + 1;
    }
    let maxId = '', maxCount = 0;
    for (const [id, count] of Object.entries(comboCounts)) {
      if (count > maxCount) { maxCount = count; maxId = id; }
    }
    this.stats_.mostComparedComboId = maxId;

    const scores = Object.values(result.scores);
    if (scores.length >= 2) {
      this.stats_.avgScoreDiff = Math.round(Math.abs(scores[0].total - scores[1].total) * 10) / 10;
    }
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  private _initStats(): ComboStats {
    return { totalComparisons: 0, mostComparedComboId: '', winningComboId: '', avgScoreDiff: 0 };
  }

  // ── Private: Seed combos ─────────────────────────────────────────────────

  private _seedCombos(): void {
    const builtIns: FactorCombo[] = [
      {
        comboId: 'defensive-combo', name: 'Defensive Shield', nameCn: '防御护盾',
        description: 'Low vol + high quality + dividends. Maximum capital preservation.',
        factors: [
          { factorId: 'VOL_HISTORICAL', weight: 0.30, direction: 'long' },
          { factorId: 'VALUE_DIVIDEND_YIELD', weight: 0.25, direction: 'long' },
          { factorId: 'QUALITY_ROE', weight: 0.25, direction: 'long' },
          { factorId: 'QUALITY_FCF_STABILITY', weight: 0.20, direction: 'long' },
        ],
        sceneId: 'defensive-safe',
      },
      {
        comboId: 'momentum-combo', name: 'Momentum Rocket', nameCn: '动量火箭',
        description: 'Multi-timeframe momentum. Catch trends at every horizon.',
        factors: [
          { factorId: 'MOMENTUM_12M', weight: 0.35, direction: 'long' },
          { factorId: 'MOMENTUM_3M', weight: 0.35, direction: 'long' },
          { factorId: 'MOMENTUM_1M', weight: 0.30, direction: 'long' },
        ],
        sceneId: 'growth-aggressive',
      },
      {
        comboId: 'value-combo', name: 'Deep Value', nameCn: '深度价值',
        description: 'Earnings yield + FCF yield + dividend. Classic value approach.',
        factors: [
          { factorId: 'VALUE_EARNINGS_YIELD', weight: 0.35, direction: 'long' },
          { factorId: 'VALUE_FCF_YIELD', weight: 0.35, direction: 'long' },
          { factorId: 'VALUE_DIVIDEND_YIELD', weight: 0.30, direction: 'long' },
        ],
        sceneId: 'income-stable',
      },
      {
        comboId: 'quality-growth-combo', name: 'Quality Growth', nameCn: '优质成长',
        description: 'High ROE + earnings growth. Warren Buffett style.',
        factors: [
          { factorId: 'QUALITY_ROE', weight: 0.40, direction: 'long' },
          { factorId: 'GROWTH_EPS_3Y', weight: 0.35, direction: 'long' },
          { factorId: 'SENT_EARNINGS_SURPRISE', weight: 0.25, direction: 'long' },
        ],
        sceneId: 'balanced-moderate',
      },
      {
        comboId: 'crypto-momentum-combo', name: 'Crypto Surge', nameCn: '加密浪潮',
        description: 'Crypto volume + short momentum + RSI. High risk, high reward.',
        factors: [
          { factorId: 'CRYPTO_VOLUME', weight: 0.40, direction: 'long' },
          { factorId: 'MOMENTUM_1M', weight: 0.35, direction: 'long' },
          { factorId: 'TECH_RSI', weight: 0.25, direction: 'long' },
        ],
        sceneId: 'speculation-highrisk',
      },
      {
        comboId: 'macro-aware-combo', name: 'Macro Navigator', nameCn: '宏观领航',
        description: 'Rate sensitivity + inflation + volatility. For regime-aware investing.',
        factors: [
          { factorId: 'MACRO_INTEREST_RATE', weight: 0.40, direction: 'long' },
          { factorId: 'VOL_HISTORICAL', weight: 0.30, direction: 'long' },
          { factorId: 'MOMENTUM_12M', weight: 0.30, direction: 'long' },
        ],
      },
    ];

    for (const c of builtIns) {
      this.combos.set(c.comboId, c);
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: FactorComboCompare | null = null;

export function factorComboCompare(): FactorComboCompare {
  if (!instance) instance = new FactorComboCompare();
  return instance;
}

export function resetFactorComboCompare(): void { instance = null; }
