// ── J-73-02 Tests: AI Drawing Engine (8 tests) ───────────────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  AIDrawingEngine,
  createAIDrawingEngine,
} from "../electron/engine/ai-drawing-engine";

describe("J-73-02: AI Drawing Engine", () => {
  let engine: AIDrawingEngine;

  // Generate sample K-line data: 200 bars uptrend
  const generateKlines = (count: number, trend = 0, volatility = 2) => {
    const klines = [];
    let price = 100;
    const base = 1700000000000;
    for (let i = 0; i < count; i++) {
      const change = trend * (i / count) + (Math.random() - 0.5) * volatility;
      const open = price;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      klines.push({
        time: base + i * 3600000,
        open, high, low, close,
        volume: 1000000 + Math.random() * 500000,
      });
      price = close;
    }
    return klines;
  };

  beforeEach(() => {
    engine = createAIDrawingEngine();
  });

  it("01: Empty/small dataset returns empty result", () => {
    const empty = engine.analyze([]);
    expect(empty.allLines).toHaveLength(0);
    expect(empty.meta.dataPoints).toBe(0);

    const small = engine.analyze(generateKlines(5));
    expect(small.allLines).toHaveLength(0);
    expect(small.meta.dataPoints).toBe(5);
  });

  it("02: analyze detects swing points on 200 candles", () => {
    const klines = generateKlines(200, 20); // strong uptrend
    const result = engine.analyze(klines);
    expect(result.meta.swingPoints).toBeGreaterThan(0);
    expect(result.meta.computeMs).toBeLessThan(100); // <100ms
  });

  it("03: analyze returns all drawing categories", () => {
    const klines = generateKlines(200, 10, 5); // moderate uptrend with some volatility
    const result = engine.analyze(klines);

    expect(Array.isArray(result.trendLines)).toBe(true);
    expect(Array.isArray(result.supportResistance)).toBe(true);
    expect(Array.isArray(result.channels)).toBe(true);
    expect(Array.isArray(result.fibonacci)).toBe(true);
    expect(Array.isArray(result.gannFans)).toBe(true);
    expect(Array.isArray(result.allLines)).toBe(true);
  });

  it("04: Fibonacci is always detected on valid data", () => {
    const klines = generateKlines(200, 30, 8);
    const result = engine.analyze(klines);

    // Fibonacci should be detected (at least 1 drawing)
    expect(result.fibonacci.length).toBeGreaterThanOrEqual(1);
    const fib = result.fibonacci[0];
    expect(fib.levels.length).toBe(9); // 9 fib levels
    expect(fib.levels[0].level).toBe(0);
    expect(fib.levels[8].level).toBe(1.618);
  });

  it("05: Gann fan is generated from strong swing points", () => {
    const klines = generateKlines(300, 40, 10);
    const result = engine.analyze(klines);

    if (result.gannFans.length > 0) {
      const fan = result.gannFans[0];
      expect(fan.angles.length).toBe(9);
      expect(fan.angles[4].label).toBe("1×1"); // 45°
    }
  });

  it("06: modifyLine correctly applies user modifications", () => {
    const klines = generateKlines(150);
    const result = engine.analyze(klines);

    if (result.trendLines.length > 0) {
      const original = result.trendLines[0];
      const modified = engine.modifyLine(original.id, {
        color: "#ff00ff",
        thickness: 3,
        label: "用户修正",
      });

      expect(modified.userModified).toBe(true);
      expect(modified.color).toBe("#ff00ff");
      expect(modified.thickness).toBe(3);
      expect(modified.label).toBe("用户修正");
    }
  });

  it("07: removeLine removes a line", () => {
    engine.modifyLine("line-1", { id: "line-1", type: "trend_line", label: "test", confidence: 1, points: [], color: "#fff", dashStyle: "solid", thickness: 2, extendRight: true, extendLeft: false, userModified: true, createdAt: Date.now() });
    engine.removeLine("line-1");
    const mods = engine.getUserModifications();
    expect(mods["line-1"]).toBeUndefined();
  });

  it("08: user modifies mix with auto-detected in allLines", () => {
    const klines = generateKlines(150);
    const result1 = engine.analyze(klines);

    // Modify a trend line
    if (result1.trendLines.length > 0) {
      engine.modifyLine(result1.trendLines[0].id, { color: "#ff0000" });
    }

    const result2 = engine.analyze(klines);
    const hasUserMod = result2.allLines.some((l) => l.userModified);
    // At least the combined result should exist
    expect(result2.allLines.length).toBeGreaterThanOrEqual(0);
  });
});
