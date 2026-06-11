// ── J-72-03 Tests: Factor Research Engine (8 tests) ─────────────────────
import { describe, it, expect } from "vitest";
import {
  FactorResearchEngine,
  createFactorResearchEngine,
} from "../electron/engine/factors/factor-research-engine";

describe("J-72-03: Factor Research Engine", () => {
  const engine = createFactorResearchEngine();

  // Generate sample factor + return data
  const n = 200;
  const factorValues: number[] = [];
  const forwardReturns: number[] = [];
  const dates: string[] = [];

  for (let i = 0; i < n; i++) {
    factorValues.push(Math.random() * 2 - 1); // -1..1
    forwardReturns.push((factorValues[i] * 0.3 + Math.random() * 0.1 - 0.05)); // partial correlation
    dates.push(`2024-${String(Math.floor(i / 20) + 1).padStart(2, "0")}-${String((i % 20) + 1).padStart(2, "0")}`);
  }

  it("01: computeIC returns valid IC/IR", () => {
    const result = engine.computeIC("momentum", factorValues, forwardReturns, dates);
    expect(result.factorName).toBe("momentum");
    expect(result.observations).toBe(n);
    expect(typeof result.rankIC).toBe("number");
    expect(typeof result.pearsonIC).toBe("number");
    expect(result.IR).toBeGreaterThanOrEqual(0); // IR >= 0
    expect(result.hitRate).toBeGreaterThanOrEqual(0);
    expect(result.hitRate).toBeLessThanOrEqual(1);
  });

  it("02: computeIC with < 20 obs returns empty IC", () => {
    const short = engine.computeIC("test", [1, 2, 3], [0.1, 0.2, 0.3], ["d1", "d2", "d3"]);
    expect(short.observations).toBe(0);
    expect(short.IR).toBe(0);
  });

  it("03: Rank IC uses Spearman correlation", () => {
    // Perfect correlation should yield rankIC ≈ 1
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const rets = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
    const ds = vals.map((v) => `d${v}`);

    const result = engine.computeIC("perfect", vals, rets, ds);
    expect(result.rankIC).toBeCloseTo(1.0, 1);
    expect(result.hitRate).toBeCloseTo(1.0, 0);
  });

  it("04: computeExposure returns exposure with beta + contribution", () => {
    const vals = [0.5, 0.8, 0.3, 0.9, 0.2];
    const rets = [0.02, 0.04, 0.01, 0.05, 0.005];
    const ds = ["d1", "d2", "d3", "d4", "d5"];

    const exposures = engine.computeExposure("AAPL", vals, rets, ds);
    expect(exposures).toHaveLength(5);
    expect(typeof exposures[0].exposure).toBe("number");
    expect(typeof exposures[0].contribution).toBe("number");
  });

  it("05: computeFactorReturn calculates long-short spread", () => {
    const results = engine.computeFactorReturn(factorValues, forwardReturns, dates);
    expect(results).toHaveLength(n);
    expect(typeof results[0].longShortSpread).toBe("number");
  });

  it("06: computeDecay returns decay curve with half-life", () => {
    const decay = engine.computeDecay(factorValues, forwardReturns, 30);
    expect(decay.decayCurve.length).toBeGreaterThan(0);
    expect(decay.halfLife).toBeGreaterThanOrEqual(0);
    expect(typeof decay.stable).toBe("boolean");
  });

  it("07: compareFactors ranks by composite score", () => {
    const ic1 = engine.computeIC("factor_a", factorValues, forwardReturns, dates);
    const ic2 = engine.computeIC("factor_b", forwardReturns, factorValues, dates); // swapped = lower IC

    const result = engine.compareFactors([ic1, ic2]);
    expect(result.ranking).toHaveLength(2);
    expect(result.best).not.toBeNull();
    // factor_a should outrank factor_b (the factor_values → forwardReturns corr > random)
    expect(result.ranking[0].name).toBe("factor_a");
  });

  it("08: empty data edge cases", () => {
    expect(engine.computeIC("empty", [], [], []).observations).toBe(0);
    expect(engine.computeExposure("X", [], [], [])).toEqual([]);
    expect(engine.computeFactorReturn([], [], [])).toEqual([]);

    const compareResult = engine.compareFactors([]);
    expect(compareResult.best).toBeNull();
    expect(compareResult.ranking).toEqual([]);
  });
});
