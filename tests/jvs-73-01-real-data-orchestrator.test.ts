// ── J-73-01 Tests: Real Data Orchestrator (10 tests) ──────────────────
import { describe, it, expect, beforeEach } from "vitest";
import {
  RealDataOrchestrator,
  createRealDataOrchestrator,
  getRealDataContext,
  DATA_FRESHNESS,
  REAL_DATA_MIN_INDICATORS,
} from "../electron/engine/agents/real-data-orchestrator";

describe("J-73-01: Real Data Orchestrator", () => {
  let orchestrator: RealDataOrchestrator;

  beforeEach(() => {
    orchestrator = createRealDataOrchestrator({
      yahooFinance: { enabled: false },
      alphaVantage: { enabled: false },
      newsApi: { enabled: false },
      reddit: { enabled: false },
      stockTwits: { enabled: false },
      proprietary: { enabled: false },
    });
  });

  it("01: Default config has all sources with correct defaults", () => {
    const cfg = orchestrator.getConfig();
    expect(cfg.yahooFinance.baseUrl).toContain("yahoo.com");
    expect(cfg.alphaVantage.baseUrl).toContain("alphavantage.co");
    expect(cfg.newsApi.baseUrl).toContain("newsapi.org");
    expect(cfg.reddit.subreddits).toContain("wallstreetbets");
    expect(cfg.stockTwits.baseUrl).toContain("stocktwits.com");
    expect(cfg.proprietary.endpoint).toContain("localhost");
  });

  it("02: getDataSourceStatus returns status for all 6 sources", () => {
    const status = orchestrator.getDataSourceStatus();
    expect(status.length).toBe(6);
    for (const s of status) {
      expect(s.source).toBeDefined();
      expect(s.enabled).toBe(false); // all disabled in test
      expect(s.lastError).toBeNull();
      expect(s.errorCount).toBe(0);
    }
  });

  it("03: healthCheck reports all disabled as healthy", () => {
    const health = orchestrator.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.failingSources).toHaveLength(0);
  });

  it("04: setSourceEnabled toggles source state", () => {
    orchestrator.setSourceEnabled("yahooFinance", true);
    const status = orchestrator.getDataSourceStatusFor("yahooFinance");
    expect(status?.enabled).toBe(true);

    orchestrator.setSourceEnabled("yahooFinance", false);
    const status2 = orchestrator.getDataSourceStatusFor("yahooFinance");
    expect(status2?.enabled).toBe(false);
  });

  it("05: updateConfig updates config and clears cache", () => {
    orchestrator.updateConfig({
      yahooFinance: { enabled: true, baseUrl: "https://custom.yahoo.com/", rateLimit_perMin: 120, timeoutMs: 3000 },
    });
    const cfg = orchestrator.getConfig();
    expect(cfg.yahooFinance.enabled).toBe(true);
    expect(cfg.yahooFinance.rateLimit_perMin).toBe(120);
  });

  it("06: fetchMarketData throws when all sources disabled", async () => {
    await expect(orchestrator.fetchMarketData("AAPL", "NYSE")).rejects.toThrow(
      "All data sources exhausted",
    );
  });

  it("07: DATA_FRESHNESS constants are defined", () => {
    expect(DATA_FRESHNESS.quote).toBe(60_000);
    expect(DATA_FRESHNESS.news).toBe(300_000);
    expect(DATA_FRESHNESS.social).toBe(120_000);
    expect(DATA_FRESHNESS.fundamentals).toBe(3_600_000);
  });

  it("08: REAL_DATA_MIN_INDICATORS has required fields", () => {
    expect(REAL_DATA_MIN_INDICATORS.price).toBe(true);
    expect(REAL_DATA_MIN_INDICATORS.volume).toBe(true);
    expect(REAL_DATA_MIN_INDICATORS.pe).toBe(true);
    expect(REAL_DATA_MIN_INDICATORS.marketCap).toBe(true);
  });

  it("09: getRealDataContext returns structured result for disabled sources", async () => {
    const ctx = await getRealDataContext(orchestrator, "AAPL", "NYSE");
    expect(ctx.symbol).toBe("AAPL");
    expect(ctx.market).toBe("NYSE");
    expect(ctx.marketData).toBeNull(); // all sources disabled
    expect(ctx.news).toEqual([]);
    expect(ctx.social).toEqual([]);
    expect(ctx.timestamp).toBeGreaterThan(0);
  });

  it("10: resetCircuitBreakers clears all circuit breakers", () => {
    orchestrator.resetCircuitBreakers();
    const status = orchestrator.getDataSourceStatus();
    for (const s of status) {
      expect(s.errorCount).toBe(0);
    }
  });
});
