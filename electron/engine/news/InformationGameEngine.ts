/**
 * P2-17 InformationGameEngine — Information Asymmetry Game Engine
 * R250 — P2 Deepening
 * JVS / 引擎虾
 *
 * Models information flow as a game between informed and uninformed
 * traders. Tracks information arrival, propagation delay, insider
 * signals, and computes information advantage metrics. Helps identify
 * when you have (or lack) information edge.
 * Singleton pattern, fully testable with reset().
 */

import log from 'electron-log';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type InfoSourceType = 'order_flow' | 'options_flow' | 'dark_pool' | 'news' | 'social' | 'insider' | 'technical';

export type InfoQuality = 'high' | 'medium' | 'low' | 'unverified';

export type InfoAdvantage = 'significant_edge' | 'moderate_edge' | 'slight_edge' | 'no_edge' | 'disadvantaged';

export interface InformationSignal {
  id: string;
  source: InfoSourceType;
  symbol: string;
  content: string;
  quality: InfoQuality;
  confidence: number; // 0-1
  /** Timestamp when the information was first available */
  firstAvailableAt: number;
  /** Timestamp when we received it */
  receivedAt: number;
  /** Delay in ms */
  propagationDelay: number;
  /** Estimated half-life of information value (ms) */
  halfLife: number;
  /** Whether action already exists for this signal */
  acted: boolean;
  actedAt?: number;
  /** Expected price impact */
  expectedImpact: number; // -1 to 1
  /** Actual price impact (if known later) */
  actualImpact?: number;
}

export interface InformationEdge {
  id: string;
  symbol: string;
  /** Sources we have access to */
  availableSources: InfoSourceType[];
  /** Average delay vs market */
  avgDelay: number;
  /** Number of high-quality signals received */
  highQualityCount: number;
  /** Total signals received */
  totalSignals: number;
  /** Signal-to-noise ratio */
  signalToNoiseRatio: number;
  /** Information advantage assessment */
  advantage: InfoAdvantage;
  /** Advantage score 0-100 (100 = complete edge) */
  advantageScore: number;
  /** How long edge persists (ms) */
  edgeDuration: number;
  /** Recommendation */
  recommendation: string;
  computedAt: number;
}

export interface PropagatedInfo {
  symbol: string;
  signalCount: number;
  avgDelay: number;
  sourceDistribution: Record<InfoSourceType, number>;
  /** Whether information cascade is forming */
  cascadeDetected: boolean;
  cascadeDirection?: 'bullish' | 'bearish';
}

export interface InfoGameSummary {
  symbolsWithEdge: number;
  symbolsWithoutEdge: number;
  avgAdvantageScore: number;
  bestEdge: string; // symbol
  worstEdge: string; // symbol
  recommendation: string;
}

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

export class InformationGameEngine {
  private static instance: InformationGameEngine;

  private signals: Map<string, InformationSignal[]> = new Map(); // symbol → signals
  private edges: Map<string, InformationEdge[]> = new Map(); // symbol → edge snapshots
  private idCounter = 0;

  private constructor() {}

  static getInstance(): InformationGameEngine {
    if (!InformationGameEngine.instance) {
      InformationGameEngine.instance = new InformationGameEngine();
    }
    return InformationGameEngine.instance;
  }

  reset(): void {
    this.signals.clear();
    this.edges.clear();
    this.idCounter = 0;
  }

  private nextId(): string {
    return `ige-${++this.idCounter}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // Signal Ingestion
  // ═══════════════════════════════════════════════════════════════

  ingestSignal(params: {
    source: InfoSourceType;
    symbol: string;
    content: string;
    quality: InfoQuality;
    confidence: number;
    firstAvailableAt: number;
    receivedAt: number;
    expectedImpact: number;
    halfLife?: number;
  }): InformationSignal {
    const signal: InformationSignal = {
      id: this.nextId(),
      source: params.source,
      symbol: params.symbol.toUpperCase(),
      content: params.content,
      quality: params.quality,
      confidence: Math.max(0, Math.min(1, params.confidence)),
      firstAvailableAt: params.firstAvailableAt,
      receivedAt: params.receivedAt,
      propagationDelay: params.receivedAt - params.firstAvailableAt,
      halfLife: params.halfLife || 1800000, // default 30 min
      acted: false,
      expectedImpact: Math.max(-1, Math.min(1, params.expectedImpact)),
    };

    const key = signal.symbol;
    if (!this.signals.has(key)) {
      this.signals.set(key, []);
    }
    this.signals.get(key)!.push(signal);

    return signal;
  }

  markActed(signalId: string, actualImpact?: number): boolean {
    for (const [, signals] of this.signals) {
      const sig = signals.find(s => s.id === signalId);
      if (sig) {
        sig.acted = true;
        sig.actedAt = Date.now();
        if (actualImpact !== undefined) sig.actualImpact = actualImpact;
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // Information Edge Computation
  // ═══════════════════════════════════════════════════════════════

  computeEdge(symbol: string): InformationEdge {
    const symSignals = this.signals.get(symbol.toUpperCase()) || [];
    const now = Date.now();

    if (symSignals.length === 0) {
      const edge: InformationEdge = {
        id: this.nextId(), symbol: symbol.toUpperCase(),
        availableSources: [], avgDelay: 0, highQualityCount: 0, totalSignals: 0,
        signalToNoiseRatio: 0, advantage: 'disadvantaged', advantageScore: 0,
        edgeDuration: 0, recommendation: 'No information flow detected. Gather more data sources.',
        computedAt: now,
      };
      this.storeEdge(symbol, edge);
      return edge;
    }

    // Source diversity
    const sources = new Set<InfoSourceType>();
    let totalDelay = 0;
    let highQuality = 0;

    for (const sig of symSignals) {
      sources.add(sig.source);
      totalDelay += sig.propagationDelay;
      if (sig.quality === 'high') highQuality++;
    }

    const avgDelay = totalDelay / symSignals.length;
    const highRatio = highQuality / symSignals.length;

    // Signal-to-noise: correlation between expected and actual impact
    const actedSignals = symSignals.filter(s => s.acted && s.actualImpact !== undefined);
    let snr = 0;
    if (actedSignals.length >= 3) {
      const accuracy = actedSignals.filter(
        s => Math.sign(s.expectedImpact) === Math.sign(s.actualImpact!),
      ).length / actedSignals.length;
      snr = accuracy;
    } else {
      snr = highRatio * 0.7; // proxy SNR
    }

    // Advantage scoring
    let advantageScore = 0;

    // Source diversity: max 30 points
    advantageScore += Math.min(30, sources.size * 5);

    // Low delay: max 25 points (delay < 1s = 25, delay > 60s = 0)
    const delayScore = Math.max(0, 25 * (1 - avgDelay / 60000));
    advantageScore += Math.min(25, delayScore);

    // High quality ratio: max 25 points
    advantageScore += highRatio * 25;

    // SNR: max 20 points
    advantageScore += snr * 20;

    advantageScore = Math.round(Math.min(100, advantageScore));

    let advantage: InfoAdvantage;
    if (advantageScore >= 80) advantage = 'significant_edge';
    else if (advantageScore >= 60) advantage = 'moderate_edge';
    else if (advantageScore >= 30) advantage = 'slight_edge';
    else if (advantageScore >= 15) advantage = 'no_edge';
    else advantage = 'disadvantaged';

    // Edge duration: based on half-life of most recent signal
    const recentSignals = symSignals.filter(s => (now - s.receivedAt) < 600000); // last 10 min
    const edgeDuration = recentSignals.length > 0
      ? Math.max(...recentSignals.map(s => s.halfLife))
      : 0;

    let recommendation: string;
    if (advantage === 'significant_edge' || advantage === 'moderate_edge') {
      recommendation = 'Capitalize on information edge aggressively. Increase position on high-conviction signals.';
    } else if (advantage === 'slight_edge') {
      recommendation = 'Moderate position sizing. Seek more reliable information sources.';
    } else if (advantage === 'no_edge') {
      recommendation = 'Reduce exposure. Avoid trading on low-quality information.';
    } else {
      recommendation = 'Stop trading or use only passive strategies. Information disadvantage is severe.';
    }

    const edge: InformationEdge = {
      id: this.nextId(),
      symbol: symbol.toUpperCase(),
      availableSources: Array.from(sources),
      avgDelay: Math.round(avgDelay),
      highQualityCount: highQuality,
      totalSignals: symSignals.length,
      signalToNoiseRatio: Math.round(snr * 100) / 100,
      advantage,
      advantageScore,
      edgeDuration,
      recommendation,
      computedAt: now,
    };

    this.storeEdge(symbol, edge);
    return edge;
  }

  private storeEdge(symbol: string, edge: InformationEdge): void {
    const key = symbol.toUpperCase();
    if (!this.edges.has(key)) {
      this.edges.set(key, []);
    }
    this.edges.get(key)!.push(edge);
  }

  // ═══════════════════════════════════════════════════════════════
  // Information Propagation Analysis
  // ═══════════════════════════════════════════════════════════════

  analyzePropagation(symbol: string): PropagatedInfo {
    const symSignals = this.signals.get(symbol.toUpperCase()) || [];
    if (symSignals.length === 0) {
      return { symbol: symbol.toUpperCase(), signalCount: 0, avgDelay: 0, sourceDistribution: {} as Record<InfoSourceType, number>, cascadeDetected: false };
    }

    const delays = symSignals.map(s => s.propagationDelay);
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

    const sourceDist: Record<InfoSourceType, number> = {
      order_flow: 0, options_flow: 0, dark_pool: 0, news: 0, social: 0, insider: 0, technical: 0,
    };
    for (const sig of symSignals) {
      sourceDist[sig.source]++;
    }

    // Cascade detection: 3+ signals from same source in quick succession
    let cascadeDetected = false;
    let cascadeDirection: 'bullish' | 'bearish' | undefined;
    const recentSignals = symSignals.slice(-10);
    for (const source of Object.keys(sourceDist) as InfoSourceType[]) {
      const sameSource = recentSignals.filter(s => s.source === source);
      if (sameSource.length >= 3) {
        const avgImpact = sameSource.reduce((s, sig) => s + sig.expectedImpact, 0) / sameSource.length;
        cascadeDetected = true;
        cascadeDirection = avgImpact > 0 ? 'bullish' : 'bearish';
        break;
      }
    }

    return {
      symbol: symbol.toUpperCase(),
      signalCount: symSignals.length,
      avgDelay: Math.round(avgDelay),
      sourceDistribution: sourceDist,
      cascadeDetected,
      cascadeDirection,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Multi-Symbol Analysis
  // ═══════════════════════════════════════════════════════════════

  computeAllEdges(): InfoGameSummary {
    const symbols = new Set<string>();
    for (const [sym] of this.signals) symbols.add(sym);

    let totalScore = 0;
    let bestScore = -1;
    let worstScore = 101;
    let bestSym = '';
    let worstSym = '';
    let symbolsWithEdge = 0;

    for (const sym of symbols) {
      const edge = this.computeEdge(sym);
      totalScore += edge.advantageScore;

      if (edge.advantageScore > bestScore) {
        bestScore = edge.advantageScore;
        bestSym = sym;
      }

      if (edge.advantageScore < worstScore) {
        worstScore = edge.advantageScore;
        worstSym = sym;
      }

      if (edge.advantage !== 'disadvantaged' && edge.advantage !== 'no_edge') {
        symbolsWithEdge++;
      }
    }

    const avgScore = symbols.size > 0 ? Math.round(totalScore / symbols.size) : 0;

    let recommendation: string;
    if (symbolsWithEdge >= symbols.size * 0.5) {
      recommendation = 'Strong overall information position. Scale up on high-edge symbols.';
    } else if (symbolsWithEdge >= 2) {
      recommendation = `Focus capital on ${bestSym} (edge=${bestScore}). Reduce others.`;
    } else {
      recommendation = 'Weak information position across portfolio. Seek better data sources.';
    }

    return {
      symbolsWithEdge,
      symbolsWithoutEdge: symbols.size - symbolsWithEdge,
      avgAdvantageScore: avgScore,
      bestEdge: bestSym || 'N/A',
      worstEdge: worstSym || 'N/A',
      recommendation,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════════════════════════

  getSignals(symbol: string, limit?: number): InformationSignal[] {
    const symSignals = this.signals.get(symbol.toUpperCase()) || [];
    return limit ? symSignals.slice(-limit) : [...symSignals];
  }

  getLatestEdge(symbol: string): InformationEdge | undefined {
    const history = this.edges.get(symbol.toUpperCase());
    return history?.length ? history[history.length - 1] : undefined;
  }

  getEdgeHistory(symbol: string, limit?: number): InformationEdge[] {
    const history = this.edges.get(symbol.toUpperCase()) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  getSymbolsWithEdge(minScore: number = 30): string[] {
    const result: string[] = [];
    for (const [sym, history] of this.edges) {
      if (history.length > 0 && history[history.length - 1].advantageScore >= minScore) {
        result.push(sym);
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════

  purgeStaleSignals(olderThanMs: number = 3600000): number {
    let count = 0;
    const cutoff = Date.now() - olderThanMs;
    for (const [sym, signals] of this.signals) {
      const kept = signals.filter(s => s.receivedAt >= cutoff);
      count += signals.length - kept.length;
      if (kept.length === 0) {
        this.signals.delete(sym);
      } else {
        this.signals.set(sym, kept);
      }
    }
    if (count > 0) log.info(`[InfoGame] Purged ${count} stale signals`);
    return count;
  }
}
