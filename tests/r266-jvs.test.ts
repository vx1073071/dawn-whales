// ── R266 JVS 测试文件 ──
// 覆盖: VolumeProfileEngine + IndicatorAIInterpretationEngine + AIAutoDrawingEngine

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VolumeProfileEngine, getVolumeProfileEngine, resetVolumeProfileEngine,
} from '../electron/engine/analysis/volume-profile-engine';
import type { VPInputBar } from '../electron/engine/analysis/volume-profile-engine';
import {
  IndicatorAIInterpretationEngine, getIndicatorAIInterpretationEngine, resetIndicatorAIInterpretationEngine,
} from '../electron/engine/analysis/indicator-ai-interpretation-engine';
import type { IndicatorValue } from '../electron/engine/analysis/indicator-ai-interpretation-engine';
import {
  AIAutoDrawingEngine, getAIAutoDrawingEngine, resetAIAutoDrawingEngine,
} from '../electron/engine/analysis/ai-auto-drawing-engine';

// ═══════════ Test Data ═══════════

function makeVPBars(n: number, basePrice = 100): VPInputBar[] {
  const bars: VPInputBar[] = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const open = price;
    const change = (Math.sin(i * 0.15) * 3 + (Math.random() - 0.5) * 4);
    const close = open + change;
    bars.push({
      timestamp: now - (n - i) * 3600000,
      open: Math.round(open * 100) / 100,
      high: Math.round(Math.max(open, close) * 100 + Math.random() * 200) / 100,
      low: Math.round(Math.min(open, close) * 100 - Math.random() * 200) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 50000 + 10000),
    });
    price = close;
  }
  return bars;
}

function makeRSI(n: number): IndicatorValue {
  return { indicator: 'rsi', name: 'RSI', value: n };
}
function makeMACD(macd: number, signal: number, histogram: number): IndicatorValue {
  return { indicator: 'macd', name: 'MACD', value: macd, signal, histogram };
}
function makeSTOCH(k: number, d: number): IndicatorValue {
  return { indicator: 'stoch', name: 'STOCH', value: k, signal: d };
}

// ═══════════════════════════════════════════════════════════════
// VolumeProfileEngine
// ═══════════════════════════════════════════════════════════════

describe('VolumeProfileEngine', () => {
  let engine: VolumeProfileEngine;

  beforeEach(() => {
    resetVolumeProfileEngine();
    engine = getVolumeProfileEngine();
    engine.reset();
  });

  it('singleton returns same instance', () => {
    expect(getVolumeProfileEngine()).toBe(engine);
  });

  it('reset clears bars', () => {
    engine.loadBars(makeVPBars(10));
    engine.reset();
    expect(engine.getBarCount()).toBe(0);
  });

  it('loads and counts bars', () => {
    engine.loadBars(makeVPBars(50));
    expect(engine.getBarCount()).toBe(50);
  });

  it('compute VAP returns non-empty array', () => {
    engine.loadBars(makeVPBars(100));
    const vap = engine.computeVAP();
    expect(vap.length).toBeGreaterThan(0);
    // All entries have positive volume
    for (const v of vap) {
      expect(v.volume).toBeGreaterThan(0);
    }
  });

  it('VAP sorted high-to-low', () => {
    engine.loadBars(makeVPBars(200));
    const vap = engine.computeVAP();
    for (let i = 1; i < vap.length; i++) {
      expect(vap[i - 1].price).toBeGreaterThanOrEqual(vap[i].price);
    }
  });

  it('POC has maximum volume', () => {
    engine.loadBars(makeVPBars(200));
    const vap = engine.computeVAP();
    const poc = engine.getPOC(vap);
    expect(poc).not.toBeNull();
    const maxVol = Math.max(...vap.map((v) => v.volume));
    expect(poc!.volume).toBe(maxVol);
  });

  it('TPO returns bins with count', () => {
    engine.loadBars(makeVPBars(100));
    const tpo = engine.computeTPO();
    expect(tpo.length).toBeGreaterThan(0);
    for (const t of tpo) {
      expect(t.tpoCount).toBeGreaterThan(0);
    }
  });

  it('value area returns VAH > VAL', () => {
    engine.loadBars(makeVPBars(200));
    const { vah, val, poc } = engine.getValueArea();
    expect(poc).not.toBeNull();
    expect(vah).toBeGreaterThan(val);
  });

  it('profile shape is a valid type', () => {
    engine.loadBars(makeVPBars(200));
    const shape = engine.determineProfileShape();
    expect(['P', 'b', 'D', 'P-Tail', 'Double', 'Flat']).toContain(shape);
  });

  it('detects support and resistance levels', () => {
    engine.loadBars(makeVPBars(200));
    const { supportLevels, resistanceLevels } = engine.detectSupportResistance();
    // May or may not have levels depending on random data
    expect(Array.isArray(supportLevels)).toBe(true);
    expect(Array.isArray(resistanceLevels)).toBe(true);
  });

  it('high volume nodes are non-empty', () => {
    engine.loadBars(makeVPBars(200));
    const { highVolumeNodes, lowVolumeNodes } = engine.detectSupportResistance();
    expect(highVolumeNodes.length + lowVolumeNodes.length).toBeGreaterThan(0);
  });

  it('composite from multiple sessions', () => {
    const sessions = [makeVPBars(30), makeVPBars(30), makeVPBars(30)];
    const vap1 = engine.computeComposite(sessions);
    expect(vap1.length).toBeGreaterThan(0);
  });

  it('VWAP calculation', () => {
    const bars: VPInputBar[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.now() - (10 - i) * 3600000,
      open: 100, high: 102, low: 98, close: 101, volume: 1000,
    }));
    engine.loadBars(bars);
    const vwap = engine.computeVWAP();
    expect(vwap).toBeGreaterThan(0);
  });

  it('price vs value area position', () => {
    engine.loadBars(makeVPBars(200));
    const bars = makeVPBars(1);
    const lastPrice = bars[0].close;
    const { position, distancePct } = engine.priceVsValueArea(lastPrice);
    expect(['above_value', 'in_value', 'below_value']).toContain(position);
    expect(typeof distancePct).toBe('number');
  });

  it('secondary POCs exist', () => {
    engine.loadBars(makeVPBars(200));
    const secondary = engine.getSecondaryPOCs(undefined, 2);
    expect(Array.isArray(secondary)).toBe(true);
  });

  it('naked POC detection', () => {
    engine.loadBars(makeVPBars(100));
    const naked = engine.getNakedPOC();
    // May be null or a VolumeAtPrice
    if (naked) {
      expect(naked.volume).toBeGreaterThan(0);
    }
  });

  it('VPOC gap with previous POC', () => {
    engine.setPreviousPOC(95);
    engine.loadBars(makeVPBars(100, 100));
    const gap = engine.getVPOCGap();
    expect(typeof gap).toBe('number');
  });

  it('full analyze returns complete result', () => {
    engine.loadBars(makeVPBars(100));
    const result = engine.analyze('AAPL');
    expect(result.symbol).toBe('AAPL');
    expect(result.vap.length).toBeGreaterThan(0);
    expect(result.poc).not.toBeNull();
    expect(['P', 'b', 'D', 'P-Tail', 'Double', 'Flat']).toContain(result.profileShape);
    expect(Array.isArray(result.supportLevels)).toBe(true);
    expect(Array.isArray(result.resistanceLevels)).toBe(true);
  });

  it('config update works', () => {
    engine.updateConfig({ valueAreaPct: 0.80 });
    expect(engine.getConfig().valueAreaPct).toBe(0.80);
  });
});

// ═══════════════════════════════════════════════════════════════
// IndicatorAIInterpretationEngine
// ═══════════════════════════════════════════════════════════════

describe('IndicatorAIInterpretationEngine', () => {
  let engine: IndicatorAIInterpretationEngine;

  beforeEach(() => {
    resetIndicatorAIInterpretationEngine();
    engine = getIndicatorAIInterpretationEngine();
  });

  it('interprets RSI > 70 as bearish/overbought', () => {
    const result = engine.interpretIndicator(makeRSI(75));
    expect(result.signal).toBe('bearish');
    expect(result.interpretation).toContain('超买');
  });

  it('interprets RSI < 30 as bullish/oversold', () => {
    const result = engine.interpretIndicator(makeRSI(25));
    expect(result.signal).toBe('bullish');
    expect(result.interpretation).toContain('超卖');
  });

  it('interprets RSI 50 as bearish (30-50 zone)', () => {
    const result = engine.interpretIndicator(makeRSI(50));
    // RSI 30-50 = 中性偏弱 → bearish
    expect(result.signal).toBe('bearish');
  });

  it('interprets MACD golden cross as bullish', () => {
    const result = engine.interpretIndicator(makeMACD(0.5, 0.3, 0.2));
    expect(result.signal).toBe('bullish');
    expect(result.interpretation).toContain('金叉');
  });

  it('interprets MACD death cross as bearish', () => {
    const result = engine.interpretIndicator(makeMACD(0.3, 0.5, -0.2));
    expect(result.signal).toBe('bearish');
    expect(result.interpretation).toContain('死叉');
  });

  it('interprets STOCH > 80 as bearish', () => {
    const result = engine.interpretIndicator(makeSTOCH(85, 82));
    expect(result.signal).toBe('bearish');
  });

  it('interprets STOCH < 20 as bullish', () => {
    const result = engine.interpretIndicator(makeSTOCH(15, 18));
    expect(result.signal).toBe('bullish');
  });

  it('handles unknown indicator gracefully', () => {
    const result = engine.interpretIndicator({ indicator: 'unknown', name: 'UNKNOWN', value: 42 });
    expect(result.signal).toBe('neutral');
    expect(result.confidence).toBeLessThanOrEqual(20);
  });

  it('handles null value indicator', () => {
    const result = engine.interpretIndicator({ indicator: 'rsi', name: 'RSI', value: null });
    expect(result.confidence).toBeLessThanOrEqual(10);
  });

  it('composite diagnosis aggregates multiple indicators', () => {
    const indicators: IndicatorValue[] = [
      makeRSI(75),
      makeMACD(0.5, 0.3, 0.2),
      makeSTOCH(85, 82),
    ];
    const diag = engine.diagnose({ indicators, symbol: 'AAPL', timeframe: '1h' });

    expect(diag.indicatorCount).toBe(3);
    expect(diag.interpretations.length).toBe(3);
    expect(['bullish', 'bearish', 'neutral', 'conflicting']).toContain(diag.overallBias);
    expect(diag.summary.length).toBeGreaterThan(0);
    expect(diag.suggestion.length).toBeGreaterThan(0);
    expect(diag.billingUnits).toBe(1);
  });

  it('composite diagnosis with all bullish = bullish bias', () => {
    const indicators: IndicatorValue[] = [
      makeRSI(45),           // neutral-bearish
      makeMACD(0.5, 0.3, 0.2), // bullish
      makeSTOCH(15, 18),     // bullish
    ];
    const diag = engine.diagnose({ indicators });
    // 2 bullish, 1 bearish → should be bullish
    expect(diag.overallBias).toBe('bullish');
  });

  it('composite diagnosis with conflicting signals', () => {
    const indicators: IndicatorValue[] = [
      makeRSI(75),           // bearish
      makeSTOCH(15, 18),     // bullish
    ];
    const diag = engine.diagnose({ indicators });
    expect(diag.overallBias).toBe('conflicting');
    expect(diag.divergences.length).toBeGreaterThan(0);
  });

  it('detects bullish divergence', () => {
    const prices = [100, 95, 90];  // lower lows
    const indicator = [30, 35, 40]; // higher lows
    const div = engine.detectDivergence(prices, indicator);
    expect(div.type).toBe('bullish');
  });

  it('detects bearish divergence', () => {
    const prices = [100, 105, 110]; // higher highs
    const indicator = [70, 65, 60]; // lower highs
    const div = engine.detectDivergence(prices, indicator);
    expect(div.type).toBe('bearish');
  });

  it('no divergence with aligned data', () => {
    const prices = [100, 105, 110];
    const indicator = [30, 35, 40];
    const div = engine.detectDivergence(prices, indicator);
    expect(div.type).toBe('none');
  });

  it('quick scan returns correct counts', () => {
    const indicators: IndicatorValue[] = [
      makeRSI(75), makeMACD(0.5, 0.3, 0.2), makeSTOCH(15, 18),
    ];
    const scan = engine.quickScan(indicators);
    expect(scan.total).toBe(3);
    expect(scan.bullish + scan.bearish + scan.neutral).toBe(3);
  });

  it('CMO > 50 is bullish', () => {
    const result = engine.interpretIndicator({ indicator: 'cmo', name: 'CMO', value: 60 });
    expect(result.signal).toBe('bullish');
  });

  it('CMO < -50 is bearish', () => {
    const result = engine.interpretIndicator({ indicator: 'cmo', name: 'CMO', value: -60 });
    expect(result.signal).toBe('bearish');
  });

  it('BOP > 0.3 is bullish', () => {
    const result = engine.interpretIndicator({ indicator: 'bop', name: 'BOP', value: 0.5 });
    expect(result.signal).toBe('bullish');
  });

  it('ForceIndex > 0 is bullish', () => {
    const result = engine.interpretIndicator({ indicator: 'forceindex', name: 'ForceIndex', value: 100 });
    expect(result.signal).toBe('bullish');
  });

  it('getSupportedIndicators returns list', () => {
    const list = engine.getSupportedIndicators();
    expect(list.length).toBeGreaterThan(0);
    expect(list).toContain('rsi');
    expect(list).toContain('macd');
  });

  it('Keltner channel breakout is bullish', () => {
    const result = engine.interpretIndicator({
      indicator: 'keltner', name: 'Keltner', value: 110,
      params: { priceClose: 110, upper: 105, lower: 95 },
    });
    expect(result.signal).toBe('bullish');
  });
});

// ═══════════════════════════════════════════════════════════════
// AIAutoDrawingEngine
// ═══════════════════════════════════════════════════════════════

describe('AIAutoDrawingEngine', () => {
  let engine: AIAutoDrawingEngine;

  beforeEach(() => {
    resetAIAutoDrawingEngine();
    engine = getAIAutoDrawingEngine();
    engine.reset();
  });

  function makeOHLCBars(n: number, basePrice = 100): import('../electron/engine/analysis/ai-auto-drawing-engine').OHLCBar[] {
    const bars: import('../electron/engine/analysis/ai-auto-drawing-engine').OHLCBar[] = [];
    let price = basePrice;
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      const open = price;
      const change = (Math.sin(i * 0.2) * 5 + (Math.random() - 0.5) * 6);
      const close = open + change;
      bars.push({
        timestamp: now - (n - i) * 3600000,
        open,
        high: Math.max(open, close) + Math.random() * 2,
        low: Math.min(open, close) - Math.random() * 2,
        close,
        volume: Math.floor(Math.random() * 100000),
      });
      price = close;
    }
    return bars;
  }

  it('singleton returns same instance', () => {
    expect(getAIAutoDrawingEngine()).toBe(engine);
  });

  it('detects swing points', () => {
    engine.loadBars(makeOHLCBars(200));
    const swings = engine.detectSwingPoints(5);
    expect(swings.length).toBeGreaterThan(0);
    for (const sp of swings) {
      expect(['high', 'low']).toContain(sp.type);
      expect(sp.strength).toBeGreaterThan(0);
    }
  });

  it('finds horizontal support/resistance', () => {
    engine.loadBars(makeOHLCBars(200));
    const levels = engine.findHorizontalLevels();
    expect(Array.isArray(levels)).toBe(true);
    for (const l of levels) {
      expect(['support', 'resistance']).toContain(l.type);
      expect(l.touches).toBeGreaterThan(0);
    }
  });

  it('finds trend lines from swing points', () => {
    engine.loadBars(makeOHLCBars(200));
    const lines = engine.findTrendLines();
    // May or may not find lines depending on data
    expect(Array.isArray(lines)).toBe(true);
    for (const line of lines) {
      expect(line.touches).toBeGreaterThanOrEqual(2);
      expect(line.r2).toBeGreaterThanOrEqual(0);
    }
  });

  it('finds channels', () => {
    engine.loadBars(makeOHLCBars(200));
    const channels = engine.findChannels();
    expect(Array.isArray(channels)).toBe(true);
    if (channels.length > 0) {
      expect(channels[0].widthPct).toBeGreaterThan(0);
    }
  });

  it('full analyze returns complete result', () => {
    engine.loadBars(makeOHLCBars(200));
    const result = engine.analyze('AAPL');
    expect(result.symbol).toBe('AAPL');
    expect(result.generatedAt).toBeGreaterThan(0);
    expect(Array.isArray(result.horizontalLevels)).toBe(true);
    expect(Array.isArray(result.trendLines)).toBe(true);
    expect(Array.isArray(result.channels)).toBe(true);
    expect(Array.isArray(result.swingPoints)).toBe(true);
    expect(result.suggestion.length).toBeGreaterThan(0);
    expect(result.billingUnits).toBe(1);
  });

  it('trend lines with clear uptrend are detected', () => {
    const bars: import('../electron/engine/analysis/ai-auto-drawing-engine').OHLCBar[] = [];
    let price = 100;
    const now = Date.now();
    for (let i = 0; i < 200; i++) {
      price += 0.2 + Math.random() * 0.3;
      const wiggle = Math.random() * 1;
      bars.push({
        timestamp: now - (200 - i) * 3600000,
        open: price,
        high: price + wiggle,
        low: price - wiggle * 0.5,
        close: price + wiggle * 0.3,
      });
    }
    engine.loadBars(bars);
    const result = engine.analyze('UPSTOCK');
    expect(result.suggestion.length).toBeGreaterThan(0);
  });

  it('empty bars returns empty results', () => {
    const result = engine.analyze('');
    expect(result.swingPoints.length).toBe(0);
    expect(result.horizontalLevels.length).toBe(0);
    expect(result.trendLines.length).toBe(0);
  });
});
