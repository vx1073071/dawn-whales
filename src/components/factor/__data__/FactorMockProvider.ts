// @ts-nocheck
// R282 ML#4: FactorMockProvider — 统一mock数据层 (4h)
// Replaces individual per-file mock data with centralized FactorRegistry-driven mocks
// All 53 factor components now use getMockFactors() instead of per-file hardcoded data
// 统一mock: 所有组件从这取数据，不再是各写各的
import { getAllFactors, getFactorsByMarket, getFactorsByCategory, getTopFactorsByIC, searchFactors, type FactorRecord } from './__data__/FactorRegistry';

// ─── Mock Factor (enriched for UI) ─────────────────────────────────
export interface MockFactor {
  id: string;
  nameCn: string;
  nameEn: string;
  emoji: string;
  category: string;
  categoryCN: string;
  market: string;
  marketCN: string;
  level: 'basic' | 'advanced' | 'pro';
  signal: string;
  ic: number;
  icTrend: number[];
  stars: number;
  isHot: boolean;
  isNew: boolean;
  humanLabel: string;
  description: string;
  dontUseWhen: string;
  freshness: string;
  sharpe: number;
  winRate: number;
  turnover: number;
}

/** Seed-based RNG for IC trends */
function seededTrend(seed: number, baseIc: number, count: number = 6): number[] {
  let s = seed;
  return Array.from({ length: count }, () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return +(baseIc * (0.7 + (s % 1000) / 1000 * 0.6)).toFixed(3);
  });
}

/** Freshness based on hours */
function freshnessTag(hoursAgo: number): string {
  if (hoursAgo <= 2) return '🟢 2h';
  if (hoursAgo <= 24) return '🟡 1d';
  return '🔴 3d';
}

/** Convert FactorRecord → MockFactor (UI-ready) */
function enrich(f: FactorRecord, seed: number): MockFactor {
  const emojiMap: Record<string, string> = {
    VALUE: '💰', GROWTH: '📈', MOMENTUM: '⚡', QUALITY: '⭐', SIZE: '📏',
    VOLATILITY: '🌊', LIQUIDITY: '💧', FLOW: '💵', MACRO: '🌐', SENTIMENT: '😤',
    ESG: '🌿', OPTIONS: '🎯', FI: '🏦', ALT: '🛰️', ACADEMIC: '📚',
  };
  return {
    ...f,
    emoji: emojiMap[f.category] || '📊',
    icTrend: seededTrend(seed + parseInt(f.id.replace('FACTOR_', ''), 10), f.ic, 6),
    freshness: freshnessTag(seed % 48),
    sharpe: +(0.2 + (seed % 100) / 100 * 0.8).toFixed(2),
    winRate: +(0.45 + (seed % 100) / 100 * 0.35).toFixed(2),
    turnover: +(0.05 + (seed % 100) / 100 * 0.4).toFixed(2),
  };
}

// ─── Public API ────────────────────────────────────────────────────

/** Get ALL factors as UI-ready mocks */
export function getMockFactors(): MockFactor[] {
  return getAllFactors().map((f, i) => enrich(f, i + 1));
}

/** Get mock factors by market (UI-ready) */
export function getMockByMarket(market: string): MockFactor[] {
  return getFactorsByMarket(market as any).map((f, i) => enrich(f, i + 100));
}

/** Get mock factors by category (UI-ready) */
export function getMockByCategory(category: string, n?: number): MockFactor[] {
  let result = getFactorsByCategory(category as any).map((f, i) => enrich(f, i + 200));
  if (n) result = result.slice(0, n);
  return result;
}

/** Get top N mock factors by absolute IC */
export function getMockTop(n: number = 10): MockFactor[] {
  return getTopFactorsByIC(n).map((f, i) => enrich(f, i + 300));
}

/** Search mock factors */
export function searchMockFactors(query: string): MockFactor[] {
  return searchFactors(query).map((f, i) => enrich(f, i + 400));
}

/** Get mock factors for beginner view (level === 'basic') */
export function getMockBeginner(): MockFactor[] {
  return getMockFactors().filter(f => f.level === 'basic').slice(0, 35);
}

/** Get mock factors for advanced view (basic + advanced) */
export function getMockAdvanced(): MockFactor[] {
  return getMockFactors().filter(f => f.level === 'basic' || f.level === 'advanced').slice(0, 188);
}

/** Get mock factors for pro view (all) */
export function getMockPro(): MockFactor[] {
  return getMockFactors().slice(0, 200); // cap for perf
}

/** Get mock factor by ID */
export function getMockById(id: string): MockFactor | undefined {
  const all = getMockFactors();
  const idx = all.findIndex(f => f.id === id);
  if (idx === -1) return undefined;
  return enrich(all[idx], idx + 500);
}

/** Get hot mock factors */
export function getMockHot(n: number = 6): MockFactor[] {
  return getMockFactors().filter(f => f.isHot).slice(0, n);
}

/** Get new mock factors */
export function getMockNew(n: number = 6): MockFactor[] {
  return getMockFactors().filter(f => f.isNew).slice(0, n);
}

/** Get mock stats summary for dashboards */
export function getMockStats() {
  const all = getMockFactors();
  return {
    total: all.length,
    active: all.filter(f => f.signal !== 'NEUTRAL').length,
    avgIc: +(all.reduce((s, f) => s + f.ic, 0) / all.length).toFixed(3),
    avgSharpe: +(all.reduce((s, f) => s + f.sharpe, 0) / all.length).toFixed(2),
    byCategory: Object.fromEntries(
      Object.entries(
        all.reduce((acc, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1])
    ),
    byMarket: Object.fromEntries(
      Object.entries(
        all.reduce((acc, f) => { acc[f.market] = (acc[f.market] || 0) + 1; return acc; }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1])
    ),
  };
}
