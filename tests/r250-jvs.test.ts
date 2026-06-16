import { describe, it, expect, beforeEach } from 'vitest';
import { CounterGameEngine } from '../electron/engine/news/CounterGameEngine';
import { InformationGameEngine } from '../electron/engine/news/InformationGameEngine';
import { Top5SelectionEngine } from '../electron/engine/news/Top5SelectionEngine';

// ═══════════════════════════════════════════════════════════════
// P2-15 CounterGameEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('CounterGameEngine', () => {
  let engine: CounterGameEngine;
  beforeEach(() => { engine = CounterGameEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(CounterGameEngine.getInstance()).toBe(engine); });

  it('register player', () => {
    const p = engine.registerPlayer({
      id: 'self', type: 'self', symbol: 'AAPL',
      estimatedPosition: 1000, estimatedCost: 180, confidence: 0.9,
      recentActions: ['buy'], aggressiveness: 0.5, sophistication: 0.7, capitalWeight: 1.0,
    });
    expect(p.id).toBe('self');
    expect(p.type).toBe('self');
  });

  it('detect whale distribution pattern', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'AAPL', estimatedPosition: 1000, estimatedCost: 180, confidence: 0.9, recentActions: ['hold'], aggressiveness: 0.5, sophistication: 0.7, capitalWeight: 1.0 });
    engine.registerPlayer({ id: 'w1', type: 'whale', symbol: 'AAPL', estimatedPosition: 50000, estimatedCost: 175, confidence: 0.6, recentActions: ['distribute', 'sell'], aggressiveness: 0.9, sophistication: 0.9, capitalWeight: 5.0 });
    engine.registerPlayer({ id: 'r1', type: 'retail', symbol: 'AAPL', estimatedPosition: 100, estimatedCost: 185, confidence: 0.5, recentActions: ['buy', 'accumulate'], aggressiveness: 0.7, sophistication: 0.3, capitalWeight: 0.1 });

    const analysis = engine.analyzeSymbol('AAPL', 'self');
    expect(analysis.detectedPattern.name).toBe('whale_distribution');
    expect(analysis.recommendedAction).not.toBe('hold');
    expect(analysis.conviction).toBeGreaterThan(0);
  });

  it('detect stop hunting', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'MSFT', estimatedPosition: 500, estimatedCost: 400, confidence: 0.9, recentActions: ['hold'], aggressiveness: 0.5, sophistication: 0.7, capitalWeight: 1.0 });
    engine.registerPlayer({ id: 'i1', type: 'institution', symbol: 'MSFT', estimatedPosition: 10000, estimatedCost: 395, confidence: 0.7, recentActions: ['hunt_stop'], aggressiveness: 0.9, sophistication: 0.9, capitalWeight: 3.0 });

    const analysis = engine.analyzeSymbol('MSFT', 'self');
    expect(analysis.detectedPattern.name).toBe('stop_hunting');
    expect(analysis.detectedPattern.adversarialIntensity).toBeGreaterThanOrEqual(0.8);
  });

  it('detect accumulation zone', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'GOOG', estimatedPosition: 100, estimatedCost: 150, confidence: 0.8, recentActions: ['hold'], aggressiveness: 0.5, sophistication: 0.6, capitalWeight: 1.0 });
    engine.registerPlayer({ id: 'i1', type: 'institution', symbol: 'GOOG', estimatedPosition: 20000, estimatedCost: 148, confidence: 0.7, recentActions: ['accumulate'], aggressiveness: 0.6, sophistication: 0.8, capitalWeight: 3.0 });
    engine.registerPlayer({ id: 'w1', type: 'whale', symbol: 'GOOG', estimatedPosition: 50000, estimatedCost: 149, confidence: 0.6, recentActions: ['accumulate'], aggressiveness: 0.7, sophistication: 0.9, capitalWeight: 5.0 });

    const analysis = engine.analyzeSymbol('GOOG', 'self');
    expect(analysis.detectedPattern.name).toBe('accumulation_zone');
  });

  it('compute payoff matrix', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'TSLA', estimatedPosition: 100, estimatedCost: 200, confidence: 0.8, recentActions: ['hold'], aggressiveness: 0.5, sophistication: 0.7, capitalWeight: 1.0 });
    engine.registerPlayer({ id: 'other', type: 'retail', symbol: 'TSLA', estimatedPosition: 50, estimatedCost: 201, confidence: 0.5, recentActions: ['buy'], aggressiveness: 0.6, sophistication: 0.3, capitalWeight: 0.1 });

    const matrix = engine.computePayoffMatrix(engine.getPlayersBySymbol('TSLA'), 'self');
    expect(matrix.actions.length).toBe(7);
    expect(matrix.payoffs.length).toBe(7);
    expect(matrix.payoffs[0].length).toBe(7);
  });

  it('nash equilibrium found for buy-dominated strategy', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'NVDA', estimatedPosition: 200, estimatedCost: 500, confidence: 0.9, recentActions: ['buy'], aggressiveness: 0.8, sophistication: 0.9, capitalWeight: 1.0 });
    engine.registerPlayer({ id: 'r1', type: 'retail', symbol: 'NVDA', estimatedPosition: 10, estimatedCost: 505, confidence: 0.5, recentActions: ['sell'], aggressiveness: 0.5, sophistication: 0.2, capitalWeight: 0.05 });

    const analysis = engine.analyzeSymbol('NVDA', 'self');
    expect(analysis.profiles.length).toBeGreaterThan(0);
    // Some Nash equilibrium exists
    expect(analysis.profiles.some(p => p.isNashEquilibrium)).toBe(true);
  });

  it('no pattern when no adversarial players', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'CALM', estimatedPosition: 500, estimatedCost: 50, confidence: 0.9, recentActions: ['hold'], aggressiveness: 0.3, sophistication: 0.5, capitalWeight: 1.0 });

    const analysis = engine.analyzeSymbol('CALM', 'self');
    expect(analysis.detectedPattern.name).toBe('random_walk');
    expect(analysis.detectedPattern.adversarialIntensity).toBe(0);
  });

  it('active patterns', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'HOT', estimatedPosition: 100, estimatedCost: 100, confidence: 0.8, recentActions: ['hold'], aggressiveness: 0.5, sophistication: 0.7, capitalWeight: 1.0 });
    engine.registerPlayer({ id: 'w1', type: 'whale', symbol: 'HOT', estimatedPosition: 50000, estimatedCost: 98, confidence: 0.6, recentActions: ['distribute'], aggressiveness: 0.8, sophistication: 0.9, capitalWeight: 5.0 });
    engine.registerPlayer({ id: 'r1', type: 'retail', symbol: 'HOT', estimatedPosition: 100, estimatedCost: 102, confidence: 0.5, recentActions: ['buy', 'accumulate'], aggressiveness: 0.7, sophistication: 0.3, capitalWeight: 0.1 });

    engine.analyzeSymbol('HOT', 'self');
    const patterns = engine.getActivePatterns();
    expect(patterns.length).toBe(1);
    expect(patterns[0].symbol).toBe('HOT');
  });

  it('get analysis history', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'IBM', estimatedPosition: 100, estimatedCost: 140, confidence: 0.9, recentActions: ['hold'], aggressiveness: 0.5, sophistication: 0.7, capitalWeight: 1.0 });
    engine.analyzeSymbol('IBM', 'self');
    engine.analyzeSymbol('IBM', 'self');
    const history = engine.getAnalysisHistory('IBM');
    expect(history.length).toBe(2);
  });

  it('bear trap pattern', () => {
    engine.registerPlayer({ id: 'self', type: 'self', symbol: 'TRAP', estimatedPosition: 100, estimatedCost: 100, confidence: 0.8, recentActions: ['hold'], aggressiveness: 0.5, sophistication: 0.7, capitalWeight: 1.0 });
    engine.registerPlayer({ id: 'i1', type: 'institution', symbol: 'TRAP', estimatedPosition: 1000, estimatedCost: 98, confidence: 0.7, recentActions: ['distribute', 'sell'], aggressiveness: 0.8, sophistication: 0.8, capitalWeight: 3.0 });
    engine.registerPlayer({ id: 'r1', type: 'retail', symbol: 'TRAP', estimatedPosition: 10, estimatedCost: 101, confidence: 0.4, recentActions: ['sell'], aggressiveness: 0.6, sophistication: 0.2, capitalWeight: 0.05 });
    engine.registerPlayer({ id: 'r2', type: 'retail', symbol: 'TRAP', estimatedPosition: 15, estimatedCost: 100, confidence: 0.4, recentActions: ['sell'], aggressiveness: 0.5, sophistication: 0.2, capitalWeight: 0.05 });

    const analysis = engine.analyzeSymbol('TRAP', 'self');
    expect(['bear_trap', 'whale_distribution']).toContain(analysis.detectedPattern.name);
  });
});

// ═══════════════════════════════════════════════════════════════
// P2-17 InformationGameEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('InformationGameEngine', () => {
  let engine: InformationGameEngine;
  beforeEach(() => { engine = InformationGameEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(InformationGameEngine.getInstance()).toBe(engine); });

  const now = Date.now();

  it('ingest signal', () => {
    const sig = engine.ingestSignal({
      source: 'order_flow', symbol: 'AAPL', content: 'Large buy order',
      quality: 'high', confidence: 0.8, firstAvailableAt: now - 5000, receivedAt: now,
      expectedImpact: 0.3,
    });
    expect(sig.id).toMatch(/ige-/);
    expect(sig.propagationDelay).toBe(5000);
    expect(sig.symbol).toBe('AAPL');
  });

  it('compute edge for single symbol', () => {
    engine.ingestSignal({ source: 'options_flow', symbol: 'MSFT', content: 'Unusual call volume', quality: 'high', confidence: 0.9, firstAvailableAt: now - 2000, receivedAt: now, expectedImpact: 0.5 });
    engine.ingestSignal({ source: 'dark_pool', symbol: 'MSFT', content: 'Dark pool buy', quality: 'medium', confidence: 0.7, firstAvailableAt: now - 1000, receivedAt: now, expectedImpact: 0.2 });

    const edge = engine.computeEdge('MSFT');
    expect(edge.advantage).not.toBe('disadvantaged');
    expect(edge.advantageScore).toBeGreaterThan(0);
    expect(edge.availableSources).toContain('options_flow');
    expect(edge.availableSources).toContain('dark_pool');
    expect(edge.totalSignals).toBe(2);
  });

  it('disadvantaged with no signals', () => {
    const edge = engine.computeEdge('ZZZZ');
    expect(edge.advantage).toBe('disadvantaged');
    expect(edge.advantageScore).toBe(0);
  });

  it('mark signal acted', () => {
    const sig = engine.ingestSignal({ source: 'news', symbol: 'NFLX', content: 'Earnings beat', quality: 'high', confidence: 0.9, firstAvailableAt: now - 10000, receivedAt: now, expectedImpact: 0.6 });
    engine.markActed(sig.id, 0.55);
    // SNR should be good now
    const edge = engine.computeEdge('NFLX');
    expect(edge.advantageScore).toBeGreaterThan(0);
  });

  it('analyze propagation with cascade', () => {
    for (let i = 0; i < 4; i++) {
      engine.ingestSignal({ source: 'social', symbol: 'GME', content: 'WallStreetBets hype', quality: 'low', confidence: 0.5, firstAvailableAt: now - (4 - i) * 5000, receivedAt: now - (4 - i) * 4000, expectedImpact: 0.7 });
    }
    const prop = engine.analyzePropagation('GME');
    expect(prop.signalCount).toBe(4);
    expect(prop.cascadeDetected).toBe(true);
    expect(prop.cascadeDirection).toBe('bullish');
  });

  it('cascade after 3+ same-source signals', () => {
    engine.ingestSignal({ source: 'insider', symbol: 'INSD', content: 'Insider buying', quality: 'high', confidence: 0.9, firstAvailableAt: now - 5000, receivedAt: now, expectedImpact: 0.8 });
    engine.ingestSignal({ source: 'insider', symbol: 'INSD', content: 'Insider buying', quality: 'high', confidence: 0.9, firstAvailableAt: now - 4000, receivedAt: now, expectedImpact: 0.8 });
    engine.ingestSignal({ source: 'insider', symbol: 'INSD', content: 'Insider buying', quality: 'high', confidence: 0.9, firstAvailableAt: now - 3000, receivedAt: now, expectedImpact: 0.8 });
    const prop = engine.analyzePropagation('INSD');
    expect(prop.cascadeDetected).toBe(true);
  });

  it('compute all edges', () => {
    engine.ingestSignal({ source: 'order_flow', symbol: 'AAPL', content: 'x', quality: 'high', confidence: 0.8, firstAvailableAt: now - 1000, receivedAt: now, expectedImpact: 0.2 });
    engine.ingestSignal({ source: 'news', symbol: 'MSFT', content: 'y', quality: 'medium', confidence: 0.6, firstAvailableAt: now - 50000, receivedAt: now, expectedImpact: -0.1 });
    engine.ingestSignal({ source: 'options_flow', symbol: 'AAPL', content: 'z', quality: 'high', confidence: 0.9, firstAvailableAt: now - 500, receivedAt: now, expectedImpact: 0.4 });

    const summary = engine.computeAllEdges();
    expect(summary.symbolsWithEdge + summary.symbolsWithoutEdge).toBe(2);
    expect(summary.avgAdvantageScore).toBeGreaterThan(0);
  });

  it('get symbols with edge', () => {
    engine.ingestSignal({ source: 'order_flow', symbol: 'EDGE1', content: 'high confidence', quality: 'high', confidence: 0.95, firstAvailableAt: now - 100, receivedAt: now, expectedImpact: 0.5 });
    engine.ingestSignal({ source: 'news', symbol: 'EDGE1', content: 'more data', quality: 'high', confidence: 0.9, firstAvailableAt: now - 200, receivedAt: now, expectedImpact: 0.3 });
    engine.ingestSignal({ source: 'social', symbol: 'NOEDGE', content: 'twitter rumor', quality: 'low', confidence: 0.2, firstAvailableAt: now - 60000, receivedAt: now, expectedImpact: 0.1 });

    engine.computeEdge('EDGE1');
    engine.computeEdge('NOEDGE');

    const symbols = engine.getSymbolsWithEdge(30);
    expect(symbols).toContain('EDGE1');
  });

  it('purge stale signals', () => {
    const oldNow = now - 7200000; // 2 hours ago
    engine.ingestSignal({ source: 'news', symbol: 'OLD', content: 'stale', quality: 'low', confidence: 0.5, firstAvailableAt: oldNow, receivedAt: oldNow, expectedImpact: 0 });
    const purged = engine.purgeStaleSignals(3600000); // older than 1 hour
    expect(purged).toBe(1);
    expect(engine.getSignals('OLD').length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// P2-16 Top5SelectionEngine Tests
// ═══════════════════════════════════════════════════════════════

describe('Top5SelectionEngine', () => {
  let engine: Top5SelectionEngine;
  beforeEach(() => { engine = Top5SelectionEngine.getInstance(); engine.reset(); });

  it('singleton', () => { expect(Top5SelectionEngine.getInstance()).toBe(engine); });

  it('set candidate', () => {
    const c = engine.setCandidate({
      symbol: 'AAPL', market: 'US', factors: { technical_score: 85, momentum_score: 75 },
    });
    expect(c.symbol).toBe('AAPL');
    expect(c.factors.technical_score).toBe(85);
    expect(c.factors.fundamental_score).toBe(50); // default
  });

  it('rank top 5 from multiple candidates', () => {
    for (let i = 0; i < 12; i++) {
      engine.setCandidate({
        symbol: `SYM${i}`, market: 'US',
        factors: { technical_score: 50 + i * 4, fundamental_score: 60 - i * 2, momentum_score: 40 + i * 3 },
      });
    }
    const result = engine.rankTop5();
    expect(result.top5.length).toBe(5);
    expect(result.next5.length).toBe(5);
    expect(result.totalCandidates).toBe(12);
    expect(result.top5[0].compositeScore).toBeGreaterThanOrEqual(result.top5[4].compositeScore);
  });

  it('top 5 with market filter', () => {
    engine.setCandidate({ symbol: 'US1', market: 'US', factors: { technical_score: 90 } });
    engine.setCandidate({ symbol: 'HK1', market: 'HK', factors: { technical_score: 80 } });
    const result = engine.rankTop5('US');
    expect(result.totalCandidates).toBe(1);
    expect(result.top5[0].symbol).toBe('US1');
  });

  it('strong buy recommendation', () => {
    engine.setCandidate({
      symbol: 'SUPER', market: 'US',
      factors: { technical_score: 95, fundamental_score: 95, momentum_score: 95, trend_score: 95, liquidity_score: 95, sentiment_score: 95, volume_score: 95, risk_adjusted_score: 90 },
    });
    const result = engine.rankTop5();
    expect(['strong_buy', 'buy']).toContain(result.top5[0].recommendation);
  });

  it('avoid recommendation for weak candidate', () => {
    engine.setCandidate({
      symbol: 'WEAK', market: 'US',
      factors: { technical_score: 20, fundamental_score: 15, momentum_score: 10, trend_score: 5 },
    });
    const result = engine.rankTop5();
    expect(result.top5[0].recommendation).toBe('avoid');
  });

  it('set weights', () => {
    engine.setWeights({ technical_score: 0.5, fundamental_score: 0.3, momentum_score: 0.2 });
    const weights = engine.getWeights();
    const techW = weights.find(w => w.factor === 'technical_score')!;
    expect(techW.weight).toBe(0.5);
  });

  it('enable/disable factor', () => {
    engine.enableFactor('sentiment_score', false);
    const sentW = engine.getWeights().find(w => w.factor === 'sentiment_score')!;
    expect(sentW.enabled).toBe(false);

    engine.setCandidate({ symbol: 'TEST', market: 'US', factors: { technical_score: 80, sentiment_score: 0 } });
    const result = engine.rankTop5();
    // sentiment disabled so not factored in
    expect(result.top5[0].compositeScore).toBeGreaterThan(0);
  });

  it('compare factors', () => {
    engine.setCandidate({ symbol: 'A', market: 'US', factors: { technical_score: 90, momentum_score: 85 } });
    engine.setCandidate({ symbol: 'B', market: 'US', factors: { technical_score: 80, momentum_score: 75 } });
    engine.setCandidate({ symbol: 'C', market: 'US', factors: { technical_score: 70, momentum_score: 65 } });

    const corr = engine.compareFactors('technical_score', 'momentum_score');
    expect(corr.correlation).toBeGreaterThan(0.5);
    expect(corr.significance).toBe('high');
  });

  it('rank distribution (buy/watch/avoid)', () => {
    engine.setCandidate({ symbol: 'STRONG', market: 'US', factors: { technical_score: 90, fundamental_score: 85, momentum_score: 88, trend_score: 90, liquidity_score: 90 } });
    engine.setCandidate({ symbol: 'MID', market: 'US', factors: { technical_score: 55, fundamental_score: 50, momentum_score: 52 } });
    engine.setCandidate({ symbol: 'WEAK', market: 'US', factors: { technical_score: 10, fundamental_score: 8, momentum_score: 5, trend_score: 5, sentiment_score: 10, volume_score: 10, liquidity_score: 10, risk_adjusted_score: 10 } });

    const result = engine.rankTop5();
    expect(result.buyCount).toBeGreaterThanOrEqual(1);
    expect(result.avoidCount).toBeGreaterThanOrEqual(1);
  });

  it('get result history', () => {
    engine.setCandidate({ symbol: 'T', market: 'US', factors: { technical_score: 70 } });
    engine.rankTop5();
    engine.rankTop5();
    expect(engine.getResultHistory().length).toBe(2);
  });
});
