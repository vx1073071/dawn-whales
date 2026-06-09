// ── J-70-01 Tests: Server Deployment & Configuration (5 tests) ────────────
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DeploymentManager, createDeploymentManager, DeploymentConfig } from "../electron/engine/server-deployment";
import path from "path";
import fs from "fs";
import os from "os";

const TMP_DIR = path.join(os.tmpdir(), `dw-deploy-test-${Date.now()}`);

describe("J-70-01: Server Deployment & Configuration", () => {
  beforeEach(() => {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("01: creates DeploymentManager with default config", () => {
    const dm = createDeploymentManager();
    expect(dm).toBeDefined();
    const status = dm.getStatus();
    expect(status.version).toBe("1.7.0");
    expect(status.endpoints).toBeDefined();
  });

  it("02: creates DeploymentManager with custom config", () => {
    const dm = createDeploymentManager({ port: 4000, host: "127.0.0.1" });
    const status = dm.getStatus();
    expect(status.version).toBe("1.7.0");
  });

  it("03: generates PM2 config file", () => {
    const dm = createDeploymentManager();
    const outputPath = path.join(TMP_DIR, "ecosystem.config.json");
    dm.generatePM2Config(outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    expect(data.apps).toBeDefined();
    expect(data.apps[0].name).toBe("dawn-whales-api");
    expect(data.apps[0].env.NODE_ENV).toBe("production");
    expect(data.apps[0].env.DEEPSEEK_API_KEY).toBe("${DEEPSEEK_API_KEY}");
  });

  it("04: generates Nginx config with domain", () => {
    const dm = createDeploymentManager();
    const outputPath = path.join(TMP_DIR, "nginx-dw.conf");
    dm.generateNginxConfig(outputPath, "dawnwhales.com");

    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, "utf-8");
    expect(content).toContain("server_name dawnwhales.com");
    expect(content).toContain("location /api/");
    expect(content).toContain("location /admin/");
    expect(content).toContain("ssl_certificate");
    expect(content).toContain("limit_req_zone");
  });

  it("05: generates .env template with no hardcoded secrets", () => {
    const dm = createDeploymentManager();
    const outputPath = path.join(TMP_DIR, ".env.template");
    dm.generateEnvTemplate(outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    const content = fs.readFileSync(outputPath, "utf-8");
    expect(content).toContain("DEEPSEEK_API_KEY");
    expect(content).toContain("JWT_SECRET");
    expect(content).toContain("ADMIN_API_TOKEN");
    expect(content).not.toContain("sk-real-key");
    expect(content).toContain("Never commit");
  });
});
