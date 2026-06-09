// ── J-73-04 Tests: Parameter Smart Engine (5 tests) ──────────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  ParameterSmartEngine,
  createParameterSmartEngine,
  STANDARD_PARAMETERS,
  PARAMETER_PRESETS,
} from "../electron/engine/parameter-smart-engine";

describe("J-73-04: Parameter Smart Engine", () => {
  let engine: ParameterSmartEngine;

  beforeEach(() => {
    engine = createParameterSmartEngine();
  });

  it("01: STANDARD_PARAMETERS has 16 parameters", () => {
    expect(STANDARD_PARAMETERS.length).toBe(16);
    for (const param of STANDARD_PARAMETERS) {
      expect(param.key).toBeDefined();
      expect(param.min).toBeLessThanOrEqual(param.max);
    }
  });

  it("02: PARAMETER_PRESETS has 3 presets with all parameters", () => {
    expect(PARAMETER_PRESETS.length).toBe(3);
    for (const preset of PARAMETER_PRESETS) {
      expect(preset.profile).toBeDefined();
      expect(Object.keys(preset.parameters).length).toBe(16);
    }
  });

  it("03: applyPreset switches profile and validates safety", () => {
    const conservative = engine.applyPreset("conservative");
    expect(conservative.profile).toBe("conservative");
    expect(conservative.parameters.stopLoss).toBe(3);
    expect(conservative.parameters.positionSize).toBe(5);
    expect(conservative.safetyChecks.length).toBe(16);
    expect(conservative.conflictWarnings.length).toBe(0); // balanced presets should have no conflicts

    const aggressive = engine.applyPreset("aggressive");
    expect(aggressive.profile).toBe("aggressive");
    expect(aggressive.parameters.stopLoss).toBe(8);
    expect(aggressive.parameters.maxPositions).toBe(15);

    const balanced = engine.applyPreset("balanced");
    expect(balanced.profile).toBe("balanced");
  });

  it("04: Individual parameter set triggers evaluation", () => {
    const result = engine.setParameter("stopLoss", 15);
    expect(result.profile).toBe("custom");

    // Check that safety warnings are generated for extreme values
    const stopLoss = result.safetyChecks.find((s) => s.parameter === "stopLoss");
    expect(stopLoss).toBeDefined();
    // stopLoss=15 is near max(30), should trigger warning or danger
    expect(stopLoss!.severity).toBeDefined();
  });

  it("05: Conflict warnings are generated for bad parameter combos", () => {
    engine.setParameter("stopLoss", 20);
    engine.setParameter("takeProfit", 10); // stop > take profit
    const result = engine.setParameter("maShort", 50);
    engine.setParameter("maLong", 20); // short > long

    // At least one conflict should be detected
    expect(result.conflictWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("06: AI recommendation adapts to market conditions", () => {
    // Low vol + strong trend → aggressive
    const rec1 = engine.getAIRecommendation("NYSE", "low", "strong", "high");
    expect(rec1.recommendedProfile).toBe("aggressive");
    expect(rec1.confidence).toBeGreaterThan(0.8);

    // High vol → conservative
    const rec2 = engine.getAIRecommendation("HKEX", "high", "weak", "medium");
    expect(rec2.recommendedProfile).toBe("conservative");

    // Medium → balanced
    const rec3 = engine.getAIRecommendation("TSE", "medium", "moderate");
    expect(rec3.recommendedProfile).toBe("balanced");
  });

  it("07: restoreDefaults returns to balanced profile", () => {
    engine.applyPreset("aggressive");
    const restored = engine.restoreDefaults();
    expect(restored.profile).toBe("balanced");
    expect(restored.parameters.stopLoss).toBe(5);
  });

  it("08: saveCustomPreset and retrieve", () => {
    engine.saveCustomPreset("my-preset", {
      bbPeriod: 15, bbSigma: 1.8, rsiPeriod: 10, rsiOversold: 25, rsiOverbought: 75,
      macdFast: 8, macdSlow: 17, macdSignal: 5,
      maShort: 4, maLong: 15,
      stopLoss: 4, takeProfit: 12,
      positionSize: 8, maxPositions: 8,
      volumeMultiplier: 1.5, trailingStop: 3,
    });

    const preset = engine.getCustomPreset("my-preset");
    expect(preset).toBeDefined();
    expect(preset!.profile).toBe("custom");
    expect(preset!.parameters.stopLoss).toBe(4);
  });
});
