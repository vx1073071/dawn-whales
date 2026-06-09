// ── J-72-02 Tests: Template Compatibility Engine (8 tests) ─────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  TemplateCompatibilityEngine,
  createTemplateCompatibilityEngine,
} from "../electron/engine/template-compatibility-engine";

describe("J-72-02: Template Compatibility Engine", () => {
  let engine: TemplateCompatibilityEngine;

  beforeEach(() => {
    engine = createTemplateCompatibilityEngine();
  });

  it("01: getAllTemplates returns 20+ templates", () => {
    const templates = engine.getAllTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(20);
  });

  it("02: Universal templates compatible with multiple markets", () => {
    const result = engine.checkCompatibility("MOMENTUM_ROTATION", "HKEX", "stock");
    expect(result.compatible).toBe(true);

    expect(engine.checkCompatibility("MOMENTUM_ROTATION", "NYSE", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("MOMENTUM_ROTATION", "TSE", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("MOMENTUM_ROTATION", "BURSA", "stock").compatible).toBe(true);
  });

  it("03: Market-specific templates are properly constrained", () => {
    expect(engine.checkCompatibility("US_EARNINGS_EVENT", "NYSE", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("US_EARNINGS_EVENT", "NASDAQ", "stock").compatible).toBe(true);
    expect(engine.checkCompatibility("US_EARNINGS_EVENT", "HKEX", "stock").compatible).toBe(false);
    expect(engine.checkCompatibility("US_EARNINGS_EVENT", "TSE", "stock").compatible).toBe(false);

    expect(engine.checkCompatibility("HKEX_CBCS_HEDGE", "HKEX", "cbcs").compatible).toBe(true);
    expect(engine.checkCompatibility("HKEX_CBCS_HEDGE", "NYSE", "stock").compatible).toBe(false);
  });

  it("04: Instrument type filtering for templates", () => {
    expect(engine.checkCompatibility("OPTION_STRADDLE", "HKEX", "option").compatible).toBe(true);
    expect(engine.checkCompatibility("OPTION_STRADDLE", "NYSE", "option").compatible).toBe(true);
    expect(engine.checkCompatibility("OPTION_STRADDLE", "HKEX", "stock").compatible).toBe(false);

    expect(engine.checkCompatibility("FUTURES_CROSS_MARKET", "SGX", "future").compatible).toBe(true);
    expect(engine.checkCompatibility("FUTURES_CROSS_MARKET", "ASX", "future").compatible).toBe(false);
  });

  it("05: getCompatibleTemplates returns correct templates for market+instrument", () => {
    const hkexStock = engine.getCompatibleTemplates("HKEX", "stock");
    expect(hkexStock.length).toBeGreaterThanOrEqual(12);
    for (const t of hkexStock) {
      expect(t.compatibleMarkets).toContain("HKEX");
      expect(t.compatibleInstruments).toContain("stock");
    }

    const nyseOption = engine.getCompatibleTemplates("NYSE", "option");
    expect(nyseOption.some((t) => t.id === "OPTION_STRADDLE")).toBe(true);
    expect(nyseOption.some((t) => t.id === "OPTION_BUTTERFLY")).toBe(true);
  });

  it("06: filterCompatible separates good and bad", () => {
    const ids = ["MOMENTUM_ROTATION", "MEAN_REVERSION", "US_EARNINGS_EVENT", "HKEX_CBCS_HEDGE", "FAKE_TMPL"];
    const { compatible, incompatible } = engine.filterCompatible(ids, "NYSE", "stock");

    expect(compatible).toHaveLength(3); // momentum + mean + earnings
    expect(compatible).toContain("MOMENTUM_ROTATION");
    expect(compatible).toContain("US_EARNINGS_EVENT");
    expect(incompatible).toHaveLength(2); // HKEX CBBC + fake
  });

  it("07: suggestTemplates respects risk profile and capital", () => {
    // Low risk, small capital → conservative templates
    const lowRisk = engine.suggestTemplates("HKEX", "stock", "low", 10000, 5);
    expect(lowRisk.length).toBeGreaterThanOrEqual(1);
    for (const t of lowRisk) {
      expect(t.riskLevel).toBe("low");
      expect(t.minCapital).toBeLessThanOrEqual(10000);
    }

    // High risk, large capital → many options including high risk
    const highRisk = engine.suggestTemplates("NYSE", "stock", "high", 500000, 10);
    expect(highRisk.some((t) => t.riskLevel === "high")).toBe(true);
  });

  it("08: getTemplatesByCategory groups correctly", () => {
    const grouped = engine.getTemplatesByCategory();
    expect(Object.keys(grouped).length).toBeGreaterThanOrEqual(5);
    expect(grouped.trend?.some((t) => t.id === "MOMENTUM_ROTATION")).toBe(true);
    expect(grouped.options?.some((t) => t.id === "OPTION_STRADDLE")).toBe(true);
    expect(grouped.arbitrage?.some((t) => t.id === "HKEX_CBCS_HEDGE")).toBe(true);
  });
});
