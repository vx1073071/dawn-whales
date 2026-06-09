// ── J-72-01 Tests: Factor Compatibility Engine (10 tests) ──────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  FactorCompatibilityEngine,
  createFactorCompatibilityEngine,
} from "../electron/engine/factor-compatibility-engine";

describe("J-72-01: Factor Compatibility Engine", () => {
  let engine: FactorCompatibilityEngine;

  beforeEach(() => {
    engine = createFactorCompatibilityEngine();
  });

  it("01: getAllFactors returns 30+ factors", () => {
    const factors = engine.getAllFactors();
    expect(factors.length).toBeGreaterThanOrEqual(30);
  });

  it("02: Universal factor compatible with all 8 markets", () => {
    const result = engine.checkCompatibility("MOM_12M", "HKEX", "stock");
    expect(result.compatible).toBe(true);

    // US market
    expect(engine.checkCompatibility("MOM_12M", "NYSE", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("MOM_12M", "NASDAQ", "stock").compatible).toBe(true);

    // Asian markets
    expect(engine.checkCompatibility("MOM_12M", "SGX", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("MOM_12M", "TSE", "stock").compatible).toBe(true);
  });

  it("03: HKEX-specific factor only works on HKEX", () => {
    const hkOk = engine.checkCompatibility("HKEX_NORTHBOUND", "HKEX", "stock");
    expect(hkOk.compatible).toBe(true);

    const usNotOk = engine.checkCompatibility("HKEX_NORTHBOUND", "NYSE", "stock");
    expect(usNotOk.compatible).toBe(false);
    expect(usNotOk.reason).toContain("仅适用");

    const jpNotOk = engine.checkCompatibility("HKEX_NORTHBOUND", "TSE", "stock");
    expect(jpNotOk.compatible).toBe(false);
  });

  it("04: US-specific factors only work on NYSE/NASDAQ", () => {
    expect(engine.checkCompatibility("US_VIX", "NYSE", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("US_VIX", "NASDAQ", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("US_VIX", "HKEX", "stock").compatible).toBe(false);
    expect(engine.checkCompatibility("US_SHORT_RATIO", "NYSE", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("US_INST_HOLD", "NASDAQ", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("US_BUYBACK", "NYSE", "stock").compatible).toBe(true);
  });

  it("05: Instrument type filtering — CBBC factor only for cbcs/warrant", () => {
    const cbbcOk = engine.checkCompatibility("HKEX_CBCS_PREMIUM", "HKEX", "cbcs");
    expect(cbbcOk.compatible).toBe(true);

    const cbbcWrong = engine.checkCompatibility("HKEX_CBCS_PREMIUM", "HKEX", "stock");
    expect(cbbcWrong.compatible).toBe(false);

    const warrantIV = engine.checkCompatibility("HKEX_WARRANT_IV", "HKEX", "warrant");
    expect(warrantIV.compatible).toBe(true);
  });

  it("06: getCompatibleFactors filters correctly", () => {
    // HKEX stock: should have 20+ universal + 6 HKEX-specific = 26+
    const hkexFactors = engine.getCompatibleFactors("HKEX", "stock");
    expect(hkexFactors.length).toBeGreaterThanOrEqual(24);

    // All should be compatible
    for (const f of hkexFactors) {
      expect(f.compatibleMarkets).toContain("HKEX");
      expect(f.compatibleInstruments).toContain("stock");
    }

    // NYSE option should include OPTION_PCR + universal + US-specific
    const nyseOptions = engine.getCompatibleFactors("NYSE", "option");
    expect(nyseOptions.some((f) => f.id === "OPTION_PCR")).toBe(true);
    expect(nyseOptions.some((f) => f.id === "US_VIX")).toBe(true);
  });

  it("07: filterCompatible separates compatible and incompatible", () => {
    const ids = ["MOM_12M", "HKEX_NORTHBOUND", "US_VIX", "QUAL", "YIELD"];
    const { compatible, incompatible } = engine.filterCompatible(ids, "NYSE", "stock");

    expect(compatible).toContain("MOM_12M");
    expect(compatible).toContain("US_VIX");
    expect(compatible).toContain("QUAL");
    expect(compatible).toContain("YIELD");
    expect(incompatible).toHaveLength(1);
    expect(incompatible[0].factorId).toBe("HKEX_NORTHBOUND");
  });

  it("08: Unknown factor returns not compatible", () => {
    const result = engine.checkCompatibility("FAKE_FACTOR", "HKEX", "stock");
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("不存在");
  });

  it("09: getMarketCoverage shows all 8 markets with factors", () => {
    const coverage = engine.getMarketCoverage();
    expect(coverage.size).toBe(8);

    // Each market should have >= 20 factors
    for (const [, stats] of coverage) {
      expect(stats.totalFactors).toBeGreaterThanOrEqual(20);
      expect(stats.universalFactors + stats.marketSpecific).toBe(stats.totalFactors);
    }
  });

  it("10: suggestFactors returns top N by strategy type", () => {
    const momentumFactors = engine.suggestFactors("HKEX", "stock", "momentum", 3);
    expect(momentumFactors).toHaveLength(3);
    // Momentum strategy should prefer momentum/trend categories
    const categories = momentumFactors.map((f) => f.category);
    expect(categories.some((c) => c === "momentum" || c === "trend")).toBe(true);

    const valueFactors = engine.suggestFactors("NYSE", "stock", "value", 3);
    expect(valueFactors).toHaveLength(3);
    const vCategories = valueFactors.map((f) => f.category);
    expect(vCategories.some((c) => c === "value" || c === "quality")).toBe(true);

    const defFactors = engine.suggestFactors("HKEX", "stock", "defensive", 5);
    expect(defFactors.length).toBeGreaterThanOrEqual(1);
    const dCategories = defFactors.map((f) => f.category);
    expect(dCategories.some((c) => c === "volatility" || c === "yield")).toBe(true);
  });
});
