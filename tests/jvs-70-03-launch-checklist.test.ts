// ── J-70-03 Tests: GA Launch Checklist (2 tests) ────────────────────────
import { describe, it, expect } from "vitest";
import { LaunchChecklist, createLaunchChecklist } from "../electron/engine/core/launch-checklist";

describe("J-70-03: GA Launch Checklist", () => {
  it("01: all 20 checklist items pass, GA ready", () => {
    const lc = createLaunchChecklist("1.7.0");
    const result = lc.runAll();

    expect(result.total).toBe(20);
    expect(result.passed).toBe(20);
    expect(result.failed).toBe(0);
    expect(result.allPassed).toBe(true);
    expect(result.readyForLaunch).toBe(true);
    expect(result.version).toBe("1.7.0");

    // All critical items must pass
    const gaReady = lc.isGAReady();
    expect(gaReady.ready).toBe(true);
    expect(gaReady.blockers).toHaveLength(0);
  });

  it("02: category filtering and critical items work", () => {
    const lc = createLaunchChecklist();

    // API category
    const apiItems = lc.runCategory("api");
    expect(apiItems.length).toBe(3);
    expect(apiItems.map((i) => i.id)).toEqual(["API-01", "API-02", "API-03"]);

    // Critical items
    const criticals = lc.getCriticalItems();
    expect(criticals.length).toBe(13);
    expect(criticals.every((c) => c.severity === "critical")).toBe(true);

    // Failed items (all pass by default)
    const failed = lc.getFailedItems();
    expect(failed).toHaveLength(0);

    // Mark one as failed → GA should block
    lc.markItem("API-01", false, "Server unreachable");
    const gaReady = lc.isGAReady();
    expect(gaReady.ready).toBe(false);
    expect(gaReady.blockers.length).toBeGreaterThan(0);
    expect(gaReady.blockers[0]).toContain("API-01");
  });
});
