// ── J-72-06 Tests: Multi-Market Quote + K-line Engine (10 tests) ──────
import { describe, it, expect, beforeEach } from "vitest";
import {
  MultiMarketQuoteEngine,
  createMultiMarketQuoteEngine,
  MARKET_REGISTRY,
} from "../electron/engine/multi-market-quote-engine";

describe("J-72-06: Multi-Market Quote + K-line Engine", () => {
  let engine: MultiMarketQuoteEngine;

  beforeEach(() => {
    engine = createMultiMarketQuoteEngine();
  });

  it("01: MARKET_REGISTRY has all 8 markets", () => {
    const markets = Object.keys(MARKET_REGISTRY);
    expect(markets).toHaveLength(8);
    expect(markets).toContain("HKEX");
    expect(markets).toContain("NYSE");
    expect(markets).toContain("NASDAQ");
    expect(markets).toContain("SGX");
    expect(markets).toContain("TSE");
    expect(markets).toContain("ASX");
    expect(markets).toContain("TSX");
    expect(markets).toContain("BURSA");
  });

  it("02: updateQuote / getQuote round trips", () => {
    engine.updateQuote({
      market: "HKEX", symbol: "00700", bid: 350.0, ask: 350.2,
      last: 350.1, volume: 1_000_000, turnover: 350_100_000,
      high: 352.0, low: 348.0, open: 349.0, prevClose: 348.0,
      change: 0, changeAmount: 0, timestamp: Date.now(),
    });

    const q = engine.getQuote("HKEX", "00700");
    expect(q).toBeDefined();
    expect(q!.last).toBe(350.1);
    expect(q!.change).toBeCloseTo(0.603, 0); // (350.1-348)/348*100
  });

  it("03: getQuotes for multiple symbols in same market", () => {
    engine.updateQuote({ market: "HKEX", symbol: "00700", bid: 350, ask: 350.2, last: 350.1, volume: 1e6, turnover: 0, high: 352, low: 348, open: 349, prevClose: 348, change: 0, changeAmount: 0, timestamp: Date.now() });
    engine.updateQuote({ market: "HKEX", symbol: "09988", bid: 88, ask: 88.1, last: 88.05, volume: 5e6, turnover: 0, high: 89, low: 87.5, open: 88, prevClose: 87.5, change: 0, changeAmount: 0, timestamp: Date.now() });

    const allHK = engine.getAllQuotes("HKEX");
    expect(allHK).toHaveLength(2);
  });

  it("04: appendKline / getKlines for 9 periods", () => {
    const periods = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"] as const;

    for (const p of periods) {
      for (let i = 0; i < 30; i++) {
        engine.appendKline({
          market: "NYSE", symbol: "AAPL", period: p,
          time: 1700000000000 + i * 60000,
          open: 180 + Math.random(), high: 182 + Math.random(),
          low: 179 + Math.random(), close: 181 + Math.random(),
          volume: 1e6, turnover: 0,
        });
      }

      const series = engine.getKlines("NYSE", "AAPL", p);
      expect(series.length).toBe(30);
      expect(series[0].period).toBe(p);
    }
  });

  it("05: getKlines with from/to/limit filters", () => {
    const baseTime = 1700000000000;
    for (let i = 0; i < 50; i++) {
      engine.appendKline({
        market: "HKEX", symbol: "00700", period: "1d",
        time: baseTime + i * 86400000,
        open: 350 + i, high: 355 + i, low: 348 + i, close: 352 + i,
        volume: 1e6, turnover: 0,
      });
    }

    const all = engine.getKlines("HKEX", "00700", "1d");
    expect(all.length).toBe(50);

    const limited = engine.getKlines("HKEX", "00700", "1d", { limit: 10 });
    expect(limited.length).toBe(10);

    const fromDate = engine.getKlines("HKEX", "00700", "1d", { from: baseTime + 30 * 86400000 });
    expect(fromDate.length).toBe(20);
  });

  it("06: aggregateKlines from 1m to 5m", () => {
    // Push 10 minutes of 1m data
    for (let i = 0; i < 10; i++) {
      engine.appendKline({
        market: "SGX", symbol: "D05", period: "1m",
        time: 1700000000000 + i * 60000,
        open: 30 + i * 0.1, high: 30.5 + i * 0.1, low: 29.8 + i * 0.1,
        close: 30.2 + i * 0.1, volume: 10000, turnover: 0,
      });
    }

    const agg = engine.aggregateKlines("SGX", "D05", "1m", "5m");
    expect(agg.length).toBeGreaterThanOrEqual(2); // 10min → 2 bars of 5m
    expect(agg[0].period).toBe("5m");
  });

  it("07: Order book with depth and VWAP", () => {
    engine.updateOrderBook({
      market: "NYSE", symbol: "AAPL",
      bids: [
        { price: 180.01, volume: 500, orderCount: 3 },
        { price: 180.00, volume: 1000, orderCount: 5 },
        { price: 179.99, volume: 800, orderCount: 2 },
      ],
      asks: [
        { price: 180.02, volume: 600, orderCount: 4 },
        { price: 180.03, volume: 1200, orderCount: 6 },
      ],
      timestamp: Date.now(),
      totalBidVolume: 0, totalAskVolume: 0, spread: 0, spreadPct: 0,
    });

    const book = engine.getOrderBook("NYSE", "AAPL");
    expect(book).toBeDefined();
    expect(book!.spread).toBeCloseTo(0.01, 2);
    expect(book!.totalBidVolume).toBe(2300);
    expect(book!.totalAskVolume).toBe(1800);

    // VWAP for buying 800 shares
    const vwapAsk = engine.calculateVWAP("NYSE", "AAPL", "ask", 800);
    expect(vwapAsk).toBeGreaterThan(180);
    expect(vwapAsk).toBeLessThanOrEqual(180.03);
  });

  it("08: Tick recording and retrieval", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      engine.appendTick({
        market: "TSE", symbol: "7203", price: 30000 + i * 5,
        volume: 100, direction: i % 3 === 0 ? "buy" : i % 3 === 1 ? "sell" : "neutral",
        timestamp: now + i * 100, tradeId: `tick_${i}`,
      });
    }

    const ticks = engine.getTicks("TSE", "7203", { limit: 10 });
    expect(ticks.length).toBe(10);
    expect(ticks[0].direction).toBeDefined();
  });

  it("09: Crosshair data on K-line series", () => {
    for (let i = 0; i < 100; i++) {
      engine.appendKline({
        market: "ASX", symbol: "BHP", period: "1h",
        time: 1700000000000 + i * 3600000,
        open: 45, high: 46, low: 44, close: 45.5, volume: 1e6, turnover: 0,
      });
    }

    const crosshair = engine.getCrosshairData("ASX", "BHP", "1h", 750, 1000);
    expect(crosshair.kline).toBeDefined();
    expect(crosshair.price).toBe(45.5);
    expect(crosshair.percentX).toBeGreaterThanOrEqual(0);
    expect(crosshair.percentX).toBeLessThanOrEqual(1);
  });

  it("10: All 7 markets work with at least one quote", () => {
    const markets = ["HKEX", "NYSE", "NASDAQ", "SGX", "TSE", "ASX", "BURSA"];
    for (const m of markets) {
      engine.updateQuote({
        market: m, symbol: "TEST",
        bid: 10, ask: 10.01, last: 10.005, volume: 1000, turnover: 10000,
        high: 10.5, low: 9.5, open: 10, prevClose: 10,
        change: 0, changeAmount: 0, timestamp: Date.now(),
      });

      const q = engine.getQuote(m, "TEST");
      expect(q).toBeDefined();
      expect(q!.market).toBe(m);
    }
  });
});
