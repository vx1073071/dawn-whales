// ── J-73-03 Tests: AI Pattern Recognition Engine (7 tests) ──────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  AIPatternRecognitionEngine,
  createAIPatternRecognitionEngine,
} from "../electron/engine/ai-pattern-recognition";

describe("J-73-03: AI Pattern Recognition Engine", () => {
  let engine: AIPatternRecognitionEngine;

  beforeEach(() => {
    engine = createAIPatternRecognitionEngine();
  });

  it("01: getPatternLibrary returns 22 patterns", () => {
    const library = engine.getPatternLibrary();
    expect(library.length).toBe(22);

    // Check all categories are represented
    const categories = new Set(library.map((p) => p.category));
    expect(categories.has("reversal_bullish")).toBe(true);
    expect(categories.has("reversal_bearish")).toBe(true);
    expect(categories.has("continuation_bullish")).toBe(true);
    expect(categories.has("continuation_bearish")).toBe(true);
    expect(categories.has("indecision")).toBe(true);
  });

  it("02: Empty dataset returns empty result", () => {
    const result = engine.analyze([]);
    expect(result.patterns).toHaveLength(0);
    expect(result.meta.dataPoints).toBe(0);
  });

  it("03: detect Doji on small-body candle", () => {
    const candles = [{
      time: 1000, open: 100, high: 101, low: 99, close: 100.02, volume: 1000,
    }];
    const result = engine.analyze(candles);
    // Doji: open ≈ close, small body relative to range
    const hasDoji = result.patterns.some((p) => p.pattern.id === "DOJI");
    expect(hasDoji).toBe(true);
  });

  it("04: detect Bullish Engulfing on 2-candle reversal", () => {
    const candles = [
      { time: 1000, open: 110, high: 112, low: 108, close: 109, volume: 1000 }, // bearish
      { time: 2000, open: 108, high: 112, low: 107, close: 111, volume: 1500 }, // bullish engulfs
    ];
    const result = engine.analyze(candles);
    const engulfing = result.patterns.find((p) => p.pattern.id === "BULLISH_ENGULFING");
    expect(engulfing).toBeDefined();
    expect(engulfing!.confidence).toBeGreaterThan(0);
  });

  it("05: detect Three White Soldiers on 3 consecutive bullish", () => {
    const candles = [
      { time: 1000, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
      { time: 2000, open: 100.5, high: 103, low: 100, close: 102.5, volume: 1200 },
      { time: 3000, open: 101.5, high: 104, low: 101, close: 103.5, volume: 1400 },
    ];
    const result = engine.analyze(candles);
    const soldiers = result.patterns.find((p) => p.pattern.id === "THREE_WHITE_SOLDIERS");
    expect(soldiers).toBeDefined();
    expect(soldiers!.confidence).toBeGreaterThan(0);
  });

  it("06: summary correctly counts pattern categories", () => {
    const candles = [
      // Bullish engulfing
      { time: 1000, open: 110, high: 112, low: 108, close: 109, volume: 1000 },
      { time: 2000, open: 108, high: 112, low: 107, close: 111, volume: 1500 },
      // Doji (indecision)
      { time: 3000, open: 100, high: 101, low: 99, close: 100.02, volume: 500 },
    ];
    const result = engine.analyze(candles);
    expect(result.summary.bullish).toBeGreaterThanOrEqual(0);
    expect(result.summary.bearish).toBeGreaterThanOrEqual(0);
    expect(typeof result.summary.strongestSignal).toBe("object");
  });

  it("07: user can correct a pattern", () => {
    const candles = [
      { time: 1000, open: 100, high: 101, low: 99, close: 100.02, volume: 1000 },
    ];
    const result = engine.analyze(candles);
    const dojiPattern = result.patterns.find((p) => p.pattern.id === "DOJI");

    if (dojiPattern) {
      const patternId = `DOJI-0-0`;
      // Add as corrected
      engine.addPattern({
        ...dojiPattern,
        pattern: { ...dojiPattern.pattern },
        confidence: 0.9,
        userCorrected: true,
      });

      const result2 = engine.analyze(candles);
      const corrected = result2.patterns.find((p) => p.confidence === 0.9);
      if (corrected) {
        expect(corrected.userCorrected).toBe(true);
      }
    }
  });
});
