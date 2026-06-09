// ── J-70-02 Tests: Platform Packaging & CI (3 tests) ──────────────────────
import { describe, it, expect } from "vitest";
import { PackageManager, createPackageManager, ArtifactInfo } from "../electron/engine/platform-packaging";

describe("J-70-02: Platform Packaging & CI", () => {
  let pm: PackageManager;

  // ── Test 1: Electron Builder Config ────────────────────────

  it("01: generates valid electron-builder config for all platforms", () => {
    pm = createPackageManager();
    const cfg = pm.generateElectronBuilderConfig();

    expect(cfg.appId).toBe("com.dawnwhales.desktop");
    expect(cfg.productName).toBe("Dawn Whales");
    expect(cfg.version).toBe("1.7.0");

    // Windows
    const win = cfg.win as Record<string, unknown>;
    expect(win.target).toEqual(["nsis"]);
    expect(win.signingHashAlgorithms).toEqual(["sha256"]);

    // Mac
    const mac = cfg.mac as Record<string, unknown>;
    expect(mac.target).toEqual(["dmg", "zip"]);
    expect(mac.hardenedRuntime).toBe(true);

    // Linux
    const linux = cfg.linux as Record<string, unknown>;
    expect(linux.category).toBe("Finance");

    // Auto-update
    const publish = cfg.publish as Record<string, unknown>;
    expect(publish.provider).toBe("github");
    expect(publish.channel).toBe("latest");
  });

  // ── Test 2: Expected Artifacts ─────────────────────────────

  it("02: returns expected artifacts for all 3 platforms", () => {
    pm = createPackageManager();
    const artifacts = pm.getExpectedArtifacts();

    expect(artifacts).toHaveLength(3);

    const platforms = artifacts.map((a) => a.platform);
    expect(platforms).toContain("win");
    expect(platforms).toContain("mac");
    expect(platforms).toContain("linux");

    // All should contain version
    for (const a of artifacts) {
      expect(a.fileName).toContain("1.7.0");
    }
  });

  // ── Test 3: CI Pipeline ────────────────────────────────────

  it("03: generates GitHub Actions CI config with 4 jobs", () => {
    pm = createPackageManager();
    const ci = pm.generateGithubActionsConfig();

    expect(ci.name).toContain("1.7.0");
    expect(ci.on).toContain("push");
    expect(ci.jobs).toHaveLength(4);

    const jobNames = ci.jobs.map((j) => j.name);
    expect(jobNames).toContain("build-windows");
    expect(jobNames).toContain("build-macos");
    expect(jobNames).toContain("build-linux");
    expect(jobNames).toContain("create-release");
  });
});
