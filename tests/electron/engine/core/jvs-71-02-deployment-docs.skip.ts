// ── J-71-02 Tests: Deployment Docs (3 tests) ─────────────────────────────
import { describe, it, expect } from "vitest";
import { DeploymentGuide, createDeploymentGuide } from "../electron/engine/core/deployment-docs";

describe("J-71-02: Deployment & Packaging Docs", () => {
  it("01: generates Win/Mac/Linux install guides", () => {
    const dg = createDeploymentGuide("1.7.0");
    const guides = dg.getAllGuides();

    expect(guides).toHaveLength(3);

    const platforms = guides.map((g) => g.platform);
    expect(platforms).toEqual(["Windows", "macOS", "Linux"]);

    // Each guide has title + steps
    for (const g of guides) {
      expect(g.title).toContain("1.7.0");
      expect(g.steps.length).toBeGreaterThanOrEqual(5);
    }

    // Windows specific
    expect(guides[0].steps[0]).toContain("Dawn-Whales-Setup");
    // macOS specific
    expect(guides[1].steps[1]).toContain(".dmg");
    // Linux specific
    expect(guides[2].steps[2]).toContain("chmod +x");
  });

  it("02: generates complete API deploy manual (7 sections)", () => {
    const dg = createDeploymentGuide();
    const manual = dg.generateDeployManual();

    expect(manual.version).toBe("1.7.0");
    expect(manual.sections.length).toBe(5);
    expect(manual.sections[0].id).toBe("prerequisites");
    expect(manual.sections[4].id).toBe("monitoring");

    // Deploy steps should have 7 subsections
    const deploySteps = manual.sections[1];
    expect(deploySteps.subsections?.length).toBe(7);
  });

  it("03: generates full summary text", () => {
    const dg = createDeploymentGuide("1.7.0");
    const summary = dg.getSummary();

    expect(summary).toContain("Dawn Whales v1.7.0 GA 部署文档");
    expect(summary).toContain("桌面端安装");
    expect(summary).toContain("服务器部署");
    expect(summary).toContain("步骤 1: 获取代码");
    expect(summary).toContain("步骤 7: 验证");
    expect(summary).toContain("常见问题");
    expect(summary).toContain("监控建议");
  });
});
