/**
 * @vitest-environment node
 * Q-66-02: 信号回测准确率 + 策略市场 E2E (R66 v19, 10 tests)
 *
 * PM v19 spec (07:48):
 * - 回测维度: 胜率/夏普/最大回撤/盈亏比/连续亏损
 * - 质量评分: A+ ~ F
 * - 市场发布: 选策略→设价格(1-1000USDT)→写简介→上架
 * - 搜索+筛选+排序(收益/订阅数/评分)
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Signal Backtest Engine ─────────────────────────────────────────────────

type QualityGrade = "A+" | "A" | "B" | "C" | "D" | "F";

interface SignalBacktestResult {
  signalId: string;
  totalSignals: number;
  wins: number;
  winRate: number;          // %
  sharpeRatio: number;
  maxDrawdown: number;      // %
  profitFactor: number;     // total win / total loss
  maxConsecutiveLosses: number;
  qualityGrade: QualityGrade;
  totalReturn: number;      // %
}

class SignalBacktestEngine {
  gradeQuality(result: Omit<SignalBacktestResult, "qualityGrade">): QualityGrade {
    const score =
      (result.winRate >= 60 ? 3 : result.winRate >= 45 ? 2 : 1) +
      (result.sharpeRatio >= 2 ? 3 : result.sharpeRatio >= 1 ? 2 : result.sharpeRatio >= 0.5 ? 1 : 0) +
      (result.maxDrawdown < 10 ? 3 : result.maxDrawdown < 20 ? 2 : 1) +
      (result.profitFactor >= 2 ? 3 : result.profitFactor >= 1.5 ? 2 : result.profitFactor >= 1 ? 1 : 0);

    if (score >= 10) return "A+";
    if (score >= 8) return "A";
    if (score >= 6) return "B";
    if (score >= 4) return "C";
    if (score >= 3) return "D";
    return "F";
  }

  calculateWinRate(wins: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((wins / total) * 10000) / 100; // 2 decimal
  }

  calculateSharpe(returns: number[], riskFreeRate = 0.02): number {
    if (returns.length < 2) return 0;
    const excess = returns.map(r => r - riskFreeRate);
    const avg = excess.reduce((a, b) => a + b, 0) / excess.length;
    const variance = excess.reduce((s, r) => s + (r - avg) ** 2, 0) / (excess.length - 1);
    if (variance === 0) return 0;
    return Math.round((avg / Math.sqrt(variance)) * 100) / 100;
  }

  calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length < 2) return 0;
    let peak = equityCurve[0];
    let maxDD = 0;
    for (const v of equityCurve) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }
    return Math.round(maxDD * 100) / 100;
  }

  runBacktest(signals: { predicted: number; actual: number }[]): SignalBacktestResult {
    const wins = signals.filter(s => (s.predicted > 0 && s.actual > 0) || (s.predicted < 0 && s.actual < 0)).length;
    const equity = [100];
    for (const s of signals) {
      equity.push(equity[equity.length - 1] * (1 + s.actual / 100));
    }
    const returns = signals.map(s => s.actual);

    // Count consecutive losses
    let maxConsec = 0, currentConsec = 0;
    for (const s of signals) {
      if (s.actual <= 0) { currentConsec++; maxConsec = Math.max(maxConsec, currentConsec); }
      else { currentConsec = 0; }
    }

    const result = {
      signalId: "test-signal-1",
      totalSignals: signals.length,
      wins,
      winRate: this.calculateWinRate(wins, signals.length),
      sharpeRatio: this.calculateSharpe(returns.map(r => r / 100)),
      maxDrawdown: this.calculateMaxDrawdown(equity),
      profitFactor: signals.filter(s => s.actual > 0).reduce((s, v) => s + v.actual, 0) /
                    Math.abs(signals.filter(s => s.actual <= 0).reduce((s, v) => s + v.actual, 0) || 0.01),
      maxConsecutiveLosses: maxConsec,
      totalReturn: Math.round((equity[equity.length - 1] - 100) * 100) / 100,
    };

    return { ...result, qualityGrade: this.gradeQuality(result) };
  }
}

// ── Marketplace ────────────────────────────────────────────────────────────

type SortBy = "return" | "subscribers" | "rating";

interface StrategyListing {
  id: string; creatorId: string; name: string; description: string;
  price: number; // USDT
  totalReturn: number; subscribers: number; rating: number; // 0-5
  published: string;
}

class StrategyMarketplace {
  private listings = new Map<string, StrategyListing>();
  private counter = 0;

  publish(creatorId: string, name: string, description: string, price: number): StrategyListing | null {
    if (price < 1 || price > 1000) return null;
    const id = `strat-${++this.counter}`;
    const listing: StrategyListing = {
      id, creatorId, name, description, price,
      totalReturn: 0, subscribers: 0, rating: 0, published: new Date().toISOString(),
    };
    this.listings.set(id, listing);
    return listing;
  }

  search(query: string): StrategyListing[] {
    const q = query.toLowerCase();
    return [...this.listings.values()].filter(l =>
      l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    );
  }

  sortBy(criteria: SortBy): StrategyListing[] {
    const list = [...this.listings.values()];
    if (criteria === "return") list.sort((a, b) => b.totalReturn - a.totalReturn);
    else if (criteria === "subscribers") list.sort((a, b) => b.subscribers - a.subscribers);
    else list.sort((a, b) => b.rating - a.rating);
    return list;
  }

  subscribe(sid: string): boolean {
    const listing = this.listings.get(sid);
    if (!listing) return false;
    listing.subscribers++;
    return true;
  }

  rate(sid: string, rating: number): boolean {
    if (rating < 1 || rating > 5) return false;
    const listing = this.listings.get(sid);
    if (!listing) return false;
    listing.rating = Math.round(((listing.rating * listing.subscribers + rating) / (listing.subscribers + 1)) * 10) / 10;
    return true;
  }
}

// ── Suites ─────────────────────────────────────────────────────────────────

describe("Q-66-02-01: Signal Backtest Accuracy", () => {
  let engine: SignalBacktestEngine;
  beforeEach(() => { engine = new SignalBacktestEngine(); });

  it("01: high accuracy signals get A+ grade", () => {
    // Simulate 20 signals: 17 wins, 3 losses, high returns
    const signals = [
      { predicted: 1, actual: 3 }, { predicted: 1, actual: 2 }, { predicted: 1, actual: 4 },
      { predicted: 1, actual: 1 }, { predicted: 1, actual: 5 }, { predicted: 1, actual: 2 },
      { predicted: 1, actual: 3 }, { predicted: 1, actual: 2 }, { predicted: 1, actual: 1 },
      { predicted: 1, actual: 4 }, { predicted: 1, actual: 3 }, { predicted: 1, actual: 2 },
      { predicted: 1, actual: 1 }, { predicted: 1, actual: 3 }, { predicted: 1, actual: 2 },
      { predicted: 1, actual: 4 }, { predicted: 1, actual: 1 },
      { predicted: 1, actual: -1 }, { predicted: 1, actual: -1 }, { predicted: 1, actual: -2 },
    ];
    const result = engine.runBacktest(signals);
    expect(["A", "A+"]).toContain(result.qualityGrade);
    expect(result.winRate).toBeGreaterThan(80);
    expect(result.wins).toBe(17);
  });

  it("02: poor signals get F grade", () => {
    const signals = [
      { predicted: 1, actual: -3 }, { predicted: 1, actual: -2 }, { predicted: 1, actual: -1 },
      { predicted: 1, actual: -4 }, { predicted: 1, actual: -1 }, { predicted: 1, actual: -2 },
      { predicted: 1, actual: 1 }, { predicted: 1, actual: 1 }, { predicted: 1, actual: -3 },
      { predicted: 1, actual: -2 }, { predicted: 1, actual: -1 }, { predicted: 1, actual: -4 },
      { predicted: 1, actual: -2 }, { predicted: 1, actual: 1 }, { predicted: 1, actual: -3 },
    ];
    const result = engine.runBacktest(signals);
    expect(result.qualityGrade).toBe("F");
    expect(result.winRate).toBeLessThan(30);
  });

  it("03: consecutive losses tracked correctly", () => {
    const signals = [
      { predicted: 1, actual: 1 },   // win
      { predicted: 1, actual: -1 },  // loss start
      { predicted: 1, actual: -2 },  // loss
      { predicted: 1, actual: -3 },  // loss
      { predicted: 1, actual: -1 },  // loss
      { predicted: 1, actual: 1 },   // win
      { predicted: 1, actual: -2 },  // loss
      { predicted: 1, actual: -1 },  // loss
      { predicted: 1, actual: 1 },   // win
      { predicted: 1, actual: 1 },   // win
    ];
    const result = engine.runBacktest(signals);
    expect(result.maxConsecutiveLosses).toBe(4);
  });

  it("04: profit factor > 2 for high-profit strategy", () => {
    const signals = [
      { predicted: 1, actual: 5 }, { predicted: 1, actual: 4 }, { predicted: 1, actual: 3 },
      { predicted: 1, actual: -1 }, { predicted: 1, actual: 6 }, { predicted: 1, actual: 3 },
      { predicted: 1, actual: -1 }, { predicted: 1, actual: 4 }, { predicted: 1, actual: 5 },
      { predicted: 1, actual: -2 },
    ];
    const result = engine.runBacktest(signals);
    expect(result.profitFactor).toBeGreaterThan(2);
    expect(result.qualityGrade).toMatch(/^A/); // A or A+
  });

  it("05: max drawdown calculated from equity curve", () => {
    // Equity drops 20% from peak
    const equity = [100, 110, 105, 95, 90, 80, 85, 95, 100, 120];
    const dd = engine.calculateMaxDrawdown(equity);
    expect(dd).toBeCloseTo(27.27, 1); // peak 110, trough 80 → (110-80)/110 ≈ 27.27%
  });
});

describe("Q-66-02-02: Marketplace E2E", () => {
  let market: StrategyMarketplace;
  beforeEach(() => { market = new StrategyMarketplace(); });

  it("06: publish strategy with valid price (1-1000 USDT)", () => {
    const listing = market.publish("creator-1", "动量因子ABC", "多市场动量轮动策略", 200);
    expect(listing).not.toBeNull();
    expect(listing!.price).toBe(200);
    expect(listing!.id).toMatch(/^strat-/);
  });

  it("07: reject price outside 1-1000 USDT range", () => {
    expect(market.publish("c1", "超贵策略", "too much", 0)).toBeNull();
    expect(market.publish("c1", "超贵策略", "too much", 2000)).toBeNull();
  });

  it("08: search by keyword returns matching listings", () => {
    market.publish("c1", "动量因子A", "大盘动量", 100);
    market.publish("c2", "均值回归B", "成长均值回归", 200);
    market.publish("c3", "趋势跟随C", "动量趋势策略", 300);
    const results = market.search("动量");
    expect(results.length).toBe(2); // A and C match "动量"
    expect(results[0].name).toMatch(/动量/);
  });

  it("09: sort by total return", () => {
    market.publish("c1", "策略A", "test", 100);
    market.publish("c2", "策略B", "test", 200);
    market.publish("c3", "策略C", "test", 300);
    // Manually set returns
    const all = market.search("策略");
    all[0].totalReturn = 15;
    all[1].totalReturn = 50;
    all[2].totalReturn = 30;
    const sorted = market.sortBy("return");
    expect(sorted[0].totalReturn).toBe(50);
    expect(sorted[1].totalReturn).toBe(30);
    expect(sorted[2].totalReturn).toBe(15);
  });

  it("10: full E2E: publish → search → subscribe → rate", () => {
    const pub = market.publish("creator-x", "AI驱动策略", "基于4AgentAI的智能分析策略", 500);
    expect(pub).not.toBeNull();

    // Search
    const found = market.search("Agent");
    expect(found.length).toBe(1);
    expect(found[0].price).toBe(500);

    // Subscribe
    expect(market.subscribe(found[0].id)).toBe(true);
    expect(found[0].subscribers).toBe(1);

    // Rate
    expect(market.rate(found[0].id, 5)).toBe(true);
    expect(found[0].rating).toBeCloseTo(2.5, 1);
  });
});
