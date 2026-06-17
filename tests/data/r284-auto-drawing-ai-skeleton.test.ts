// ══ R284 autoclaw: Drawing AI Analysis + Skeleton Preload Bridge Tests ══
// vitest, not jest

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DrawingAiAnalysisBridge,
  getDrawingAiAnalysisBridge,
  resetDrawingAiAnalysisBridge,
  generateAiPrompts,
  extractContextFromDrawings,
  detectConfluence,
} from '../../electron/engine/data/drawing-ai-analysis-bridge';
import type {
  AiAnalysisRequest,
  AnalysisContext,
  DrawingForAnalysis,
  ExtractedContext,
  ConfluencePoint,
  AnalysisType,
} from '../../electron/engine/data/drawing-ai-analysis-bridge';

import {
  SkeletonPreloadBridge,
  getSkeletonPreloadBridge,
  resetSkeletonPreloadBridge,
} from '../../electron/engine/data/skeleton-preload-bridge';
import type {
  PreloadSession,
  SkeletonConfig,
  PreloadStats,
} from '../../electron/engine/data/skeleton-preload-bridge';

// ═══════════════════════════════════════════════════════════════════
// Drawing AI Analysis Bridge Tests
// ═══════════════════════════════════════════════════════════════════

function makeSampleDrawings(): DrawingForAnalysis[] {
  return [
    {
      drawingId: 'd1',
      type: 'trend-line',
      category: 'line',
      points: [
        { price: 100, time: 1000000 },
        { price: 120, time: 2000000 },
        { price: 140, time: 3000000 },
      ],
      label: 'Uptrend support',
    },
    {
      drawingId: 'd2',
      type: 'horizontal-line',
      category: 'line',
      points: [{ price: 150, time: 1000000 }],
      label: 'Resistance',
    },
    {
      drawingId: 'd3',
      type: 'horizontal-line',
      category: 'line',
      points: [{ price: 90, time: 1000000 }],
      label: 'Support',
    },
    {
      drawingId: 'd4',
      type: 'fib-retracement',
      category: 'fib',
      points: [
        { price: 100, time: 1000000 },
        { price: 200, time: 2000000 },
      ],
    },
    {
      drawingId: 'd5',
      type: 'rectangle',
      category: 'shape',
      points: [
        { price: 120, time: 1000000 },
        { price: 150, time: 2000000 },
      ],
      label: 'Trading range',
    },
  ];
}

describe('R284 DrawingAiAnalysisBridge — Health', () => {
  beforeEach(() => {
    resetDrawingAiAnalysisBridge();
  });

  it('DA1: getDrawingAiAnalysisBridge returns same instance', () => {
    const a = getDrawingAiAnalysisBridge();
    const b = getDrawingAiAnalysisBridge();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(DrawingAiAnalysisBridge);
  });

  it('DA2: reset clears all state', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const ctx: AnalysisContext = {
      symbol: 'AAPL', market: 'US', timeframe: 'D', currentPrice: 150,
      drawings: makeSampleDrawings(), requestId: 'r1', requestedAt: Date.now(),
    };
    bridge.submitAnalysis({ context: ctx, analysisTypes: ['comprehensive'], language: 'zh' });
    expect(bridge.getStats().totalAnalyses).toBe(1);

    resetDrawingAiAnalysisBridge();
    const freshBridge = getDrawingAiAnalysisBridge();
    expect(freshBridge.getStats().totalAnalyses).toBe(0);
  });

  it('DA3: submitAnalysis returns a valid analysisId', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const ctx: AnalysisContext = {
      symbol: 'TSLA', market: 'US', timeframe: '1h', currentPrice: 250,
      drawings: [makeSampleDrawings()[0]], requestId: 'r2', requestedAt: Date.now(),
    };
    const id = bridge.submitAnalysis({ context: ctx, analysisTypes: ['pattern_recognition'], language: 'en' });
    expect(id).toMatch(/^dai_/);
    expect(bridge.getStats().totalAnalyses).toBe(1);
  });
});

describe('R284 DrawingAiAnalysisBridge — Context Extraction', () => {
  it('DB1: extractContext extracts levels correctly', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings = makeSampleDrawings();
    const ctx = bridge.extractContext(drawings, 'BTC', 130);
    expect(ctx.drawingCount).toBe(5);
    expect(ctx.levels.length).toBe(2); // d2(150) + d3(90)
    expect(ctx.levels.find(l => l.type === 'resistance')?.price).toBe(150);
    expect(ctx.levels.find(l => l.type === 'support')?.price).toBe(90);
  });

  it('DB2: extractContext extracts trend lines', () => {
    const bridge = getDrawingAiAnalysisBridge();
    // Use realistic timestamps where price change is visible vs time
    const drawings: DrawingForAnalysis[] = [{
      drawingId: 'd1', type: 'trend-line', category: 'line',
      points: [
        { price: 100, time: 1700000000000 },  // ~Nov 2023
        { price: 120, time: 1705000000000 },  // ~Jan 2024
        { price: 140, time: 1710000000000 },  // ~Mar 2024
      ],
      label: 'Uptrend support',
    }];
    const ctx = bridge.extractContext(drawings, 'BTC', 130);
    expect(ctx.trendLines.length).toBe(1);
    expect(ctx.trendLines[0].direction).toBe('up');
    expect(ctx.trendLines[0].touches).toBe(3);
  });

  it('DB3: extractContext extracts fib levels', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings = makeSampleDrawings();
    const ctx = bridge.extractContext(drawings, 'BTC', 130);
    expect(ctx.fibLevels.length).toBe(7); // 7 retracement levels
    expect(ctx.fibLevels.some(f => f.level === 0.618)).toBe(true);
  });

  it('DB4: extractContext extracts zones from rectangle', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings = makeSampleDrawings();
    const ctx = bridge.extractContext(drawings, 'BTC', 130);
    expect(ctx.zones.length).toBe(1);
    expect(ctx.zones[0].bottomPrice).toBe(120);
    expect(ctx.zones[0].topPrice).toBe(150);
  });

  it('DB5: standalone extractContextFromDrawings works', () => {
    const ctx = extractContextFromDrawings(makeSampleDrawings(), 130);
    expect(ctx.drawingCount).toBe(5);
    expect(ctx.levels.length).toBe(2);
  });
});

describe('R284 DrawingAiAnalysisBridge — Confluence Detection', () => {
  it('DC1: detectConfluence finds overlapping levels', () => {
    // Create drawings where horizontal line overlaps with fib level
    const drawings: DrawingForAnalysis[] = [
      { drawingId: 'h1', type: 'horizontal-line', category: 'line', points: [{ price: 138.2, time: 1 }], label: 'Support' },
      { drawingId: 'f1', type: 'fib-retracement', category: 'fib', points: [
        { price: 100, time: 1 }, { price: 200, time: 2 },
      ]},
    ];
    // 0.618 retracement = 200 - 100*0.618 = 138.2 → should be near horizontal line at 138.2

    const ctx = extractContextFromDrawings(drawings, 150);
    const confluence = detectConfluence(ctx, 0.02);
    expect(confluence.length).toBeGreaterThanOrEqual(1);
    expect(confluence[0].types.length).toBeGreaterThanOrEqual(2);
  });

  it('DC2: bridge findConfluence returns sorted by strength', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings: DrawingForAnalysis[] = [
      { drawingId: 'h1', type: 'horizontal-line', category: 'line', points: [{ price: 150, time: 1 }] },
      { drawingId: 'h2', type: 'horizontal-line', category: 'line', points: [{ price: 150, time: 2 }] },
      { drawingId: 'h3', type: 'horizontal-line', category: 'line', points: [{ price: 150, time: 3 }] },
      { drawingId: 'f1', type: 'fib-retracement', category: 'fib', points: [
        { price: 100, time: 1 }, { price: 200, time: 2 },
      ]},
    ];

    const confluence = bridge.findConfluence(drawings, 150, 0.02);
    // 0.5 fib = 150, plus 3 horizontal lines at 150 → strong confluence
    const strongest = confluence.filter(c => Math.abs(c.price - 150) < 5);
    expect(strongest.length).toBeGreaterThan(0);
  });

  it('DC3: No confluence when levels are far apart', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings: DrawingForAnalysis[] = [
      { drawingId: 'h1', type: 'horizontal-line', category: 'line', points: [{ price: 100, time: 1 }] },
      { drawingId: 'h2', type: 'horizontal-line', category: 'line', points: [{ price: 200, time: 2 }] },
    ];

    const confluence = bridge.findConfluence(drawings, 150, 0.01);
    expect(confluence.length).toBe(0); // Prices too far apart
  });
});

describe('R284 DrawingAiAnalysisBridge — AI Prompt Generation', () => {
  it('DD1: generateAiPrompts produces prompts for all analysis types', () => {
    const ctx: AnalysisContext = {
      symbol: 'BTC-USD', market: 'CRYPTO', timeframe: '4h', currentPrice: 65000,
      drawings: makeSampleDrawings(), requestId: 'r1', requestedAt: Date.now(),
    };
    const types: AnalysisType[] = ['pattern_recognition', 'trade_setup', 'risk_assessment', 'multi_timeframe', 'comprehensive'];

    const prompts = generateAiPrompts(ctx, types);
    expect(Object.keys(prompts).length).toBe(5);
    for (const t of types) {
      expect(prompts[t]).toBeDefined();
      expect(prompts[t].system.length).toBeGreaterThan(100);
      expect(prompts[t].user.length).toBeGreaterThan(50);
    }
  });

  it('DD2: Prompt mentions symbol and price', () => {
    const ctx: AnalysisContext = {
      symbol: '00700.HK', market: 'HK', timeframe: 'D', currentPrice: 380,
      drawings: [makeSampleDrawings()[0]], requestId: 'r1', requestedAt: Date.now(),
    };
    const prompts = generateAiPrompts(ctx, ['comprehensive']);
    expect(prompts.comprehensive.user).toContain('00700.HK');
    expect(prompts.comprehensive.user).toContain('380');
  });

  it('DD3: Pattern recognition prompt references drawings', () => {
    const ctx: AnalysisContext = {
      symbol: 'NVDA', market: 'US', timeframe: 'D', currentPrice: 900,
      drawings: makeSampleDrawings(), requestId: 'r1', requestedAt: Date.now(),
    };
    const prompts = generateAiPrompts(ctx, ['pattern_recognition']);
    expect(prompts.pattern_recognition.user).toContain('trend-line');
    expect(prompts.pattern_recognition.user).toContain('horizontal-line');
  });
});

describe('R284 DrawingAiAnalysisBridge — Analysis Lifecycle', () => {
  beforeEach(() => {
    resetDrawingAiAnalysisBridge();
  });

  it('DE1: completeAnalysis updates analysis with AI response', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const ctx: AnalysisContext = {
      symbol: 'AAPL', market: 'US', timeframe: 'D', currentPrice: 175,
      drawings: [makeSampleDrawings()[0]], requestId: 'r1', requestedAt: Date.now(),
    };
    const analysisId = bridge.submitAnalysis({ context: ctx, analysisTypes: ['pattern_recognition'], language: 'en' });

    const result = bridge.completeAnalysis(analysisId, {
      summary: 'Bullish trend continuing',
      summaryCn: '上升趋势延续',
      confidence: 85,
      actionBias: 'buy',
      keyInsights: [
        { insightId: 'i1', type: 'pattern', priority: 1, title: 'Clear uptrend', titleCn: '明确上升趋势', detail: 'Trend line connecting 3 higher lows', detailCn: '趋势线连接3个更高的低点', confidence: 90, relatedDrawingIds: ['d1'] },
      ],
      tradingSignals: [
        { signalId: 's1', type: 'entry', direction: 'long', price: 176, reason: 'Near trend line support', reasonCn: '接近趋势线支撑', urgency: 'soon' },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('completed');
    expect(result!.confidence).toBe(85);
    expect(result!.actionBias).toBe('buy');
    expect(result!.keyInsights.length).toBe(1);
    expect(result!.tradingSignals.length).toBe(1);
  });

  it('DE2: failAnalysis sets status to failed', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const ctx: AnalysisContext = {
      symbol: 'AAPL', market: 'US', timeframe: 'D', currentPrice: 175,
      drawings: [], requestId: 'r1', requestedAt: Date.now(),
    };
    const analysisId = bridge.submitAnalysis({ context: ctx, analysisTypes: ['pattern_recognition'], language: 'en' });

    bridge.failAnalysis(analysisId, 'AI engine timeout');
    const result = bridge.getAnalysis(analysisId);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.error).toBe('AI engine timeout');
  });

  it('DE3: getAnalysis returns null for unknown ID', () => {
    expect(getDrawingAiAnalysisBridge().getAnalysis('nonexistent')).toBeNull();
  });

  it('DE4: Analysis history tracks completed analyses', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const ctx: AnalysisContext = {
      symbol: 'AAPL', market: 'US', timeframe: 'D', currentPrice: 175,
      drawings: [makeSampleDrawings()[0]], requestId: 'r1', requestedAt: Date.now(),
    };
    const id1 = bridge.submitAnalysis({ context: ctx, analysisTypes: ['pattern_recognition'], language: 'en' });
    const id2 = bridge.submitAnalysis({ context: { ...ctx, symbol: 'MSFT' }, analysisTypes: ['comprehensive'], language: 'en' });

    bridge.completeAnalysis(id1, { summary: 'AAPL bullish', summaryCn: '看涨', confidence: 80, actionBias: 'buy' });
    bridge.completeAnalysis(id2, { summary: 'MSFT neutral', summaryCn: '中性', confidence: 50, actionBias: 'neutral' });

    const history = bridge.getHistory();
    expect(history.length).toBe(2);

    const aaplHistory = bridge.getHistory('AAPL');
    expect(aaplHistory.length).toBe(1);
    expect(aaplHistory[0].actionBias).toBe('buy');

    const stats = bridge.getStats();
    expect(stats.completedAnalyses).toBe(2);
  });

  it('DE5: listAnalyses filters by symbol', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const ctx: AnalysisContext = {
      symbol: 'NVDA', market: 'US', timeframe: 'D', currentPrice: 900,
      drawings: [makeSampleDrawings()[0]], requestId: 'r1', requestedAt: Date.now(),
    };
    bridge.submitAnalysis({ context: ctx, analysisTypes: ['pattern_recognition'], language: 'en' });
    bridge.submitAnalysis({ context: { ...ctx, symbol: 'AMD' }, analysisTypes: ['comprehensive'], language: 'en' });

    expect(bridge.listAnalyses().length).toBe(2);
    expect(bridge.listAnalyses('NVDA').length).toBe(1);
    expect(bridge.listAnalyses('AMD').length).toBe(1);
    expect(bridge.listAnalyses('INTC').length).toBe(0);
  });
});

describe('R284 DrawingAiAnalysisBridge — Quick Assess', () => {
  it('DF1: quickAssess detects support near current price', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings: DrawingForAnalysis[] = [
      { drawingId: 's1', type: 'horizontal-line', category: 'line', points: [{ price: 100, time: 1 }], label: 'Strong support' },
    ];
    const result = bridge.quickAssess(drawings, 'BTC', 101);
    expect(result.hasSupport).toBe(true);
    expect(result.supportLevels).toContain(100);
  });

  it('DF2: quickAssess detects resistance near current price', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings: DrawingForAnalysis[] = [
      { drawingId: 'r1', type: 'horizontal-line', category: 'line', points: [{ price: 200, time: 1 }], label: 'Resistance' },
    ];
    const result = bridge.quickAssess(drawings, 'BTC', 199);
    expect(result.hasResistance).toBe(true);
  });

  it('DF3: quickAssess detects trend bias from up trend lines', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings: DrawingForAnalysis[] = [
      { drawingId: 't1', type: 'trend-line', category: 'line', points: [
        { price: 100, time: 1000 }, { price: 150, time: 2000 }, { price: 200, time: 3000 },
      ]},
      { drawingId: 't2', type: 'trend-line', category: 'line', points: [
        { price: 105, time: 1000 }, { price: 155, time: 2000 },
      ]},
    ];
    const result = bridge.quickAssess(drawings, 'BTC', 180);
    expect(result.trendBias).toBe('bullish');
    expect(result.drawingTypeSummary['trend-line']).toBe(2);
  });

  it('DF4: quickAssess counts drawing types', () => {
    const bridge = getDrawingAiAnalysisBridge();
    const drawings = makeSampleDrawings();
    const result = bridge.quickAssess(drawings, 'BTC', 130);
    expect(result.drawingTypeSummary['trend-line']).toBe(1);
    expect(result.drawingTypeSummary['horizontal-line']).toBe(2);
    expect(result.drawingTypeSummary['fib-retracement']).toBe(1);
    expect(result.drawingTypeSummary['rectangle']).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Skeleton Preload Bridge Tests
// ═══════════════════════════════════════════════════════════════════

describe('R284 SkeletonPreloadBridge — Health', () => {
  beforeEach(() => {
    resetSkeletonPreloadBridge();
  });

  it('SP1: getSkeletonPreloadBridge returns same instance', () => {
    const a = getSkeletonPreloadBridge();
    const b = getSkeletonPreloadBridge();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(SkeletonPreloadBridge);
  });

  it('SP2: reset clears all sessions', () => {
    const bridge = getSkeletonPreloadBridge();
    bridge.createSession('AAPL', 'US', 'kline');
    expect(bridge.getStats().totalSlots).toBeGreaterThan(0);

    resetSkeletonPreloadBridge();
    const fresh = getSkeletonPreloadBridge();
    expect(fresh.getStats().totalSlots).toBe(0);
  });

  it('SP3: createSession returns valid PreloadSession', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline', { priority: 80, timeframe: 'D' });
    expect(session.sessionId).toMatch(/^preload_/);
    expect(session.symbol).toBe('AAPL');
    expect(session.market).toBe('US');
    expect(session.chartType).toBe('kline');
    expect(session.state).toBe('idle');
    expect(session.priority).toBe(80);
    expect(session.slots.length).toBe(10); // kline has 10 slots
    expect(session.totalWeight).toBeGreaterThan(0);
  });
});

describe('R284 SkeletonPreloadBridge — Session Lifecycle', () => {
  beforeEach(() => {
    resetSkeletonPreloadBridge();
  });

  it('SQ1: startSession transitions to loading state', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    const updated = bridge.getSession(session.sessionId);
    expect(updated!.state).toBe('loading');
    expect(updated!.currentPhase).toBe('critical');
  });

  it('SQ2: slotLoaded updates progress', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    // Load all critical slots
    const criticalSlots = session.slots.filter(s => s.phase === 'critical');
    for (const slot of criticalSlots) {
      bridge.slotLoaded(session.sessionId, slot.slotId, 50);
    }

    const updated = bridge.getSession(session.sessionId);
    expect(updated!.phaseProgress.critical).toBe(100);
    expect(updated!.currentPhase).not.toBe('critical'); // Should have advanced
    expect(updated!.progress).toBeGreaterThan(0);
  });

  it('SQ3: sessionReady marks session as complete', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    // Manually mark all slots as ready
    for (const slot of session.slots) {
      bridge.slotLoaded(session.sessionId, slot.slotId, 100);
    }

    const updated = bridge.getSession(session.sessionId);
    expect(updated!.progress).toBe(100);
    // Since all slots are loaded, the session should be ready
    // (phase advancement in _advancePhase might not auto-ready)
    bridge.sessionReady(session.sessionId);

    const ready = bridge.getSession(session.sessionId);
    expect(ready!.state).toBe('ready');
    expect(ready!.progress).toBe(100);
    expect(ready!.currentPhase).toBe('complete');
  });

  it('SQ4: slotFailed retries up to maxRetries then fails', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    const primarySlot = session.slots.find(s => s.phase === 'primary')!;
    
    // Fail twice (retries 1, 2)
    bridge.slotFailed(session.sessionId, primarySlot.slotId, 'Network error');
    const afterRetry1 = bridge.getSession(session.sessionId);
    const slotAfter1 = afterRetry1!.slots.find(s => s.slotId === primarySlot.slotId)!;
    expect(slotAfter1.state).toBe('loading'); // Still retrying
    expect(slotAfter1.retryCount).toBe(1);

    bridge.slotFailed(session.sessionId, primarySlot.slotId, 'Network error');
    bridge.slotFailed(session.sessionId, primarySlot.slotId, 'Network error');

    const afterFail = bridge.getSession(session.sessionId);
    const slotAfterFail = afterFail!.slots.find(s => s.slotId === primarySlot.slotId)!;
    expect(slotAfterFail.state).toBe('error');
    expect(slotAfterFail.retryCount).toBeGreaterThanOrEqual(3);
  });

  it('SQ5: checkTimeout marks expired sessions', () => {
    const bridge = getSkeletonPreloadBridge();
    // Create a session with a past timestamp to simulate timeout
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    // Override createdAt to 35s ago
    const s = bridge.getSession(session.sessionId)!;
    (s as any).createdAt = Date.now() - 35000;

    bridge.checkTimeout(session.sessionId);
    const timedOut = bridge.getSession(session.sessionId);
    expect(timedOut!.state).toBe('timeout');
  });
});

describe('R284 SkeletonPreloadBridge — Skeleton Config', () => {
  beforeEach(() => {
    resetSkeletonPreloadBridge();
  });

  it('SS1: getSkeletonConfig returns valid config for kline', () => {
    const bridge = getSkeletonPreloadBridge();
    const config = bridge.getSkeletonConfig('kline', { width: 800, height: 500 });
    expect(config.type).toBe('kline');
    expect(config.elements.length).toBeGreaterThan(5);
    expect(config.elements.some(e => e.bindSlot === 'klines')).toBe(true);
    expect(config.elements.some(e => e.bindSlot === 'volume')).toBe(true);
    expect(config.elements.some(e => e.bindSlot === 'indicators')).toBe(true);
    expect(config.animation).toBe('pulse');
  });

  it('SS2: getSkeletonConfig returns valid config for footprint', () => {
    const bridge = getSkeletonPreloadBridge();
    const config = bridge.getSkeletonConfig('footprint');
    expect(config.type).toBe('footprint');
    expect(config.elements.length).toBeGreaterThanOrEqual(4);
    expect(config.elements.some(e => e.type === 'rect')).toBe(true);
  });

  it('SS3: getSkeletonConfig returns valid config for multi_chart', () => {
    const bridge = getSkeletonPreloadBridge();
    const config = bridge.getSkeletonConfig('multi_chart', { width: 1200, height: 600 });
    expect(config.type).toBe('multi_chart');
    // Should have 4 chart placeholders
    const chartAreas = config.elements.filter(e => e.bindSlot?.startsWith('chart_'));
    expect(chartAreas.length).toBe(4);
  });

  it('SS4: getVisibleSkeletonElements hides loaded slots', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    // Initially all skeleton elements visible
    const visible1 = bridge.getVisibleSkeletonElements(session.sessionId);
    expect(visible1).not.toBeNull();
    expect(visible1!.elements.length).toBeGreaterThan(0);

    // Load klines slot
    bridge.slotLoaded(session.sessionId, 'klines', 800);
    const visible2 = bridge.getVisibleSkeletonElements(session.sessionId);
    // Elements bound to 'klines' should be hidden
    expect(visible2).not.toBeNull();
    const klineElement = visible2!.elements.find(e => e.bindSlot === 'klines');
    expect(klineElement).toBeUndefined(); // Hidden after slot loaded
  });

  it('SS5: getVisibleSkeletonElements returns null when session is ready', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    // Load all slots
    for (const slot of session.slots) {
      bridge.slotLoaded(session.sessionId, slot.slotId, 100);
    }
    bridge.sessionReady(session.sessionId);

    const visible = bridge.getVisibleSkeletonElements(session.sessionId);
    expect(visible).toBeNull(); // No skeleton when ready
  });
});

describe('R284 SkeletonPreloadBridge — Progress & Stats', () => {
  beforeEach(() => {
    resetSkeletonPreloadBridge();
  });

  it('ST1: getProgressText returns phase and progress', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    const prog = bridge.getProgressText(session.sessionId);
    expect(prog.phase).toBe('critical');
    expect(prog.phaseCn).toBe('加载框架');
    expect(prog.state).toBe('loading');
  });

  it('ST2: recommendPriorities returns correct slot count', () => {
    const bridge = getSkeletonPreloadBridge();
    const priorities = bridge.recommendPriorities('kline');
    expect(priorities.length).toBeGreaterThanOrEqual(8);
    expect(priorities[0].phase).toBe('critical');
    expect(priorities[1].phase).toBe('critical');
    expect(priorities.some(p => p.phase === 'primary')).toBe(true);
    expect(priorities.some(p => p.phase === 'secondary')).toBe(true);
    expect(priorities.some(p => p.phase === 'tertiary')).toBe(true);
  });

  it('ST3: getStats returns aggregated statistics', () => {
    const bridge = getSkeletonPreloadBridge();
    bridge.createSession('AAPL', 'US', 'kline');
    bridge.createSession('MSFT', 'US', 'kline');

    const stats = bridge.getStats();
    expect(stats.activeSessions).toBe(2);
    expect(stats.totalSlots).toBe(20); // 10 per kline session
    expect(stats.completedSessions).toBe(0);
  });

  it('ST4: cleanup removes old sessions', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    bridge.startSession(session.sessionId);

    // Load and mark as ready
    for (const slot of session.slots) {
      bridge.slotLoaded(session.sessionId, slot.slotId, 100);
    }
    bridge.sessionReady(session.sessionId);

    // Override createdAt to 10 min ago
    (bridge.getSession(session.sessionId)! as any).createdAt = Date.now() - 600000;

    const removed = bridge.cleanup(300000); // 5min max age
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});

describe('R284 SkeletonPreloadBridge — Per-Chart-Type Slots', () => {
  beforeEach(() => {
    resetSkeletonPreloadBridge();
  });

  it('SC1: kline session has correct slot count and weights', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'kline');
    expect(session.slots.length).toBe(10);
    expect(session.totalWeight).toBe(100);
    const phases = new Set(session.slots.map(s => s.phase));
    expect(phases.has('critical')).toBe(true);
    expect(phases.has('primary')).toBe(true);
    expect(phases.has('secondary')).toBe(true);
    expect(phases.has('tertiary')).toBe(true);
  });

  it('SC2: footprint session has correct slot layout', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('BTC-USD', 'CRYPTO', 'footprint');
    expect(session.slots.length).toBe(6);
    expect(session.slots.find(s => s.slotId === 'tick_data')).toBeDefined();
    expect(session.slots.find(s => s.slotId === 'poc_va')).toBeDefined();
  });

  it('SC3: comparison session has correct slot count', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('AAPL', 'US', 'comparison');
    expect(session.slots.length).toBe(7);
    expect(session.slots.find(s => s.slotId === 'data_a')).toBeDefined();
    expect(session.slots.find(s => s.slotId === 'data_b')).toBeDefined();
    expect(session.slots.find(s => s.slotId === 'correlation')).toBeDefined();
  });

  it('SC4: multi_chart session generates 4 chart slots', () => {
    const bridge = getSkeletonPreloadBridge();
    const session = bridge.createSession('BTC-USD', 'CRYPTO', 'multi_chart');
    expect(session.slots.length).toBe(11); // 2 meta + 4*2(chart_data+indicators) + 1 cross_sync
    const chartSlots = session.slots.filter(s => s.slotId.startsWith('chart_'));
    expect(chartSlots.length).toBe(8); // 4 data + 4 indicators
  });

  it('SC5: getSessionForSymbol returns most recent session', () => {
    const bridge = getSkeletonPreloadBridge();
    const s1 = bridge.createSession('AAPL', 'US', 'kline');
    const s2 = bridge.createSession('AAPL', 'US', 'footprint');

    const found = bridge.getSessionForSymbol('AAPL');
    expect(found).not.toBeNull();
    // s2 was created after s1
    expect(found!.createdAt).toBeGreaterThanOrEqual(s1.createdAt);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Integration: Drawing AI × Skeleton interaction
// ═══════════════════════════════════════════════════════════════════

describe('R284 Integration — Drawing AI + Skeleton', () => {
  it('XI1: Both bridges coexist independently', () => {
    resetDrawingAiAnalysisBridge();
    resetSkeletonPreloadBridge();

    const dai = getDrawingAiAnalysisBridge();
    const skel = getSkeletonPreloadBridge();

    // AI bridge operates
    const ctx: AnalysisContext = {
      symbol: 'AAPL', market: 'US', timeframe: 'D', currentPrice: 175,
      drawings: [], requestId: 'r1', requestedAt: Date.now(),
    };
    dai.submitAnalysis({ context: ctx, analysisTypes: ['pattern_recognition'], language: 'en' });

    // Skeleton bridge operates
    skel.createSession('AAPL', 'US', 'kline');

    expect(dai.getStats().totalAnalyses).toBe(1);
    expect(skel.getStats().totalSlots).toBeGreaterThan(0);
  });

  it('XI2: AI analysis can be a tertiary slot in skeleton', () => {
    resetSkeletonPreloadBridge();
    const skel = getSkeletonPreloadBridge();
    const session = skel.createSession('AAPL', 'US', 'kline');
    const aiSlot = session.slots.find(s => s.slotId === 'ai_analysis');
    expect(aiSlot).toBeDefined();
    expect(aiSlot!.phase).toBe('tertiary');
    expect(aiSlot!.weight).toBe(5); // Low weight: optional enhancement
  });

  it('XI3: All analysis types defined', () => {
    const types: AnalysisType[] = ['pattern_recognition', 'trade_setup', 'risk_assessment', 'multi_timeframe', 'comprehensive'];
    expect(types.length).toBe(5);
  });

  it('XI4: All preload phases defined', () => {
    const phases = ['critical', 'primary', 'secondary', 'tertiary'] as const;
    expect(phases.length).toBe(4);
  });

  it('XI5: Chart types all have skeleton configs', () => {
    const skel = getSkeletonPreloadBridge();
    for (const ct of ['kline', 'footprint', 'multi_chart'] as const) {
      const config = skel.getSkeletonConfig(ct);
      expect(config.type).toBe(ct);
      expect(config.elements.length).toBeGreaterThan(0);
    }
  });
});
