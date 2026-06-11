// ── J-70-01 Tests: Server Deployment & Configuration (5 tests) ────────────
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DeploymentManager, createDeploymentManager, RateLimiter, CORSValidator } from "../electron/engine/core/server-deployment";

describe("J-70-01: Server Deployment & Configuration", () => {
  let dm: DeploymentManager;

  beforeEach(() => {
    dm = createDeploymentManager();
  });

  // ── Test 1: Default Config ─────────────────────────────────

  it("01: creates DeploymentManager with default config", () => {
    expect(dm).toBeDefined();
    const status = dm.getStatus();
    expect(status.version).toBe("1.7.0");
    expect(status.endpoints).toBeDefined();
  });

  // ── Test 2: Custom Config ──────────────────────────────────

  it("02: creates DeploymentManager with custom config", () => {
    const custom = createDeploymentManager({
      port: 4000,
      host: "127.0.0.1",
      domain: "test.dawnwhales.com",
    });
    const config = custom.getConfig();
    expect(config.port).toBe(4000);
    expect(config.host).toBe("127.0.0.1");
    expect(config.domain).toBe("test.dawnwhales.com");
  });

  // ── Test 3: PM2 Config ─────────────────────────────────────

  it("03: generates valid PM2 config", () => {
    const apps = dm.generatePM2Config();
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe("dawn-whales-api");
    expect(apps[0].env.NODE_ENV).toBe("production");
    expect(apps[0].env.DEEPSEEK_API_KEY).toBe("${DEEPSEEK_API_KEY}");
    expect(apps[0].max_memory_restart).toBe("512M");
  });

  // ── Test 4: Nginx Config ───────────────────────────────────

  it("04: generates Nginx config with correct structure", () => {
    const nginx = dm.generateNginxConfig();
    expect(nginx).toContain("server_name dawnwhales.com");
    expect(nginx).toContain("location /api/");
    expect(nginx).toContain("location /admin/");
    expect(nginx).toContain("ssl_certificate");
    expect(nginx).toContain("limit_req_zone");
    expect(nginx).toContain("TLSv1.2 TLSv1.3");
  });

  // ── Test 5: .env Template ──────────────────────────────────

  it("05: generates .env template with no hardcoded secrets", () => {
    const tmpl = dm.generateEnvTemplate();
    expect(tmpl).toContain("DEEPSEEK_API_KEY=sk-your-deepseek-key-here");
    expect(tmpl).toContain("JWT_SECRET=change-me-to-random-128-char-string");
    expect(tmpl).toContain("ADMIN_API_TOKEN=change-me-to-random-64-char-string");
    expect(tmpl).toContain("Never commit this file to Git");
    // Must NOT contain real secrets
    expect(tmpl).not.toContain("sk-real");
  });

  // ── Test 6: Rate Limiter ───────────────────────────────────

  it("06: rate limiter allows within limit and blocks excess", () => {
    const rl = new RateLimiter(60_000, 5);
    for (let i = 0; i < 5; i++) {
      expect(rl.check("192.168.1.1").allowed).toBe(true);
    }
    expect(rl.check("192.168.1.1").allowed).toBe(false);
  });

  // ── Test 7: CORS Validator ─────────────────────────────────

  it("07: CORS validator allows whitelisted origins", () => {
    const cors = new CORSValidator(["https://dawnwhales.com", "app://dawnwhales"]);
    expect(cors.isAllowed("https://dawnwhales.com")).toBe(true);
    expect(cors.isAllowed("app://dawnwhales")).toBe(true);
    expect(cors.isAllowed("https://evil.com")).toBe(false);
    expect(cors.isAllowed("")).toBe(false);
  });

  // ── Test 8: Deploy Checklist ───────────────────────────────

  it("08: deployment checklist covers all required items", () => {
    const checklist = dm.runDeployChecklist();
    expect(checklist.length).toBe(7);
    expect(checklist.every((c) => c.passed)).toBe(true);
    expect(checklist.map((c) => c.item)).toEqual([
      "PM2 config",
      "Nginx reverse proxy",
      "SSL",
      "CORS",
      "Rate limiting",
      "DeepSeek key",
      "PM2 process",
    ]);
  });
});
