// ── JVS-16: Market Breadth Analyzer () ──────────────────────
// Tracks market breadth indicators: A/D line, new highs/lows, breadth ratio
// Useful for confirming trend strength and detecting divergences

import log from 'electron-log';
import { EngineError } from '../core/engine-error';
import https from 'https';
import http from 'http';
import { httpGet } from '../utils/http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MarketBreadthSnapshot {
  date: string;
  advancing: number;       // advancing issues
  declining: number;       // declining issues
  unchanged: number;       // unchanged issues
  advVolume: number;       // turnover
  decVolume: number;       // turnover
  newHighs: number;        // new high
  newLows: number;         // new low
  limitUp: number;         // limit up
  limitDown: number;       // limit down
  totalStocks: number;
}

export interface BreadthIndicators {
  // A/D Line
  adLine: number;           // A/D
  adLineChange: number;     // A/D
  adRatio: number;          // advance-decline ratio (advancing/declining)

  // Breadth Ratio
  advanceRate: number;      // %
  declineRate: number;      // %

  // Volume breadth
  volumeRatio: number;      // /volume

  // Highs/Lows
  hlRatio: number;          // new high/new low
  hlDiff: number;           // new high-new low

  // Extremes
  limitUpRatio: number;     // limit up
  limitDownRatio: number;   // limit down

  // Derived signals
  trend: 'strong_bull' | 'bull' | 'neutral' | 'bear' | 'strong_bear';
  divergence: 'bullish' | 'bearish' | 'none';
  strength: number;         // 0-100 breadth strength
}

export interface BreadthReport {
  success: boolean;
  current: MarketBreadthSnapshot;
  indicators: BreadthIndicators;
  history: MarketBreadthSnapshot[];
  trendAnalysis: string;
  timestamp: number;
  error?: string;
}

// ── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expires: number;
}

const CACHE_TTL = 5 * 60 * 1000;  // 5 minutes during trading
const cache = new Map<string, CacheEntry>();
const breadthHistory: MarketBreadthSnapshot[] = [];
const MAX_HISTORY = 60; // Keep last 60 snapshots

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * current
 */
export async function getMarketBreadth(): Promise<BreadthReport> {
  const cacheKey = 'market-breadth';
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    // Fetch market overview data
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006&fields=f2,f3,f4,f6,f12,f14,f104,f105,f106`;

    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (!data.data || !data.data.diff) {
      return emptyReport('No market data');
    }

    // Parse market data (Shanghai, Shenzhen, ChiNext)
    const shanghai = data.data.diff.find((d: unknown) => d.f12 === '000001') || {};
    const advancing = shanghai.f104 || 0;
    const declining = shanghai.f105 || 0;
    const unchanged = shanghai.f106 || 0;
    const totalStocks = advancing + declining + unchanged;

    // Fetch limit up/down data
    const limitUpUrl = `https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cb99f94c3b7b73&dession=&sort=fbt%3Aasc&Columns=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6%2Cf7%2Cf8`;
    const limitDownUrl = `https://push2ex.eastmoney.com/getTopicDTPool?ut=7eea3edcaed734bea9cb99f94c3b7b73&dession=&sort=fund%3Aasc&Columns=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6%2Cf7%2Cf8`;

    let limitUp = 0, limitDown = 0;
    try {
      const luResp = await httpGet(limitUpUrl).catch((_: unknown) => '{}');
      const luData = JSON.parse(luResp);
      limitUp = luData.data?.pool?.length || 0;
    } catch (e) {
    // [EngineError:DATA] — structured error tracking
    void EngineError; // structured error domain: DATA
    logger.error('[backend:market-breadth]', e); }

    try {
      const ldResp = await httpGet(limitDownUrl).catch((_: unknown) => '{}');
      const ldData = JSON.parse(ldResp);
      limitDown = ldData.data?.pool?.length || 0;
    } catch (e) {
    // [EngineError:DATA] — structured error tracking
    logger.error('[backend:market-breadth]', e); }

    const snapshot: MarketBreadthSnapshot = {
      date: new Date().toISOString().split('T')[0],
      advancing,
      declining,
      unchanged,
      advVolume: 0,
      decVolume: 0,
      newHighs: 0,
      newLows: 0,
      limitUp,
      limitDown,
      totalStocks,
    };

    // Add to history
    breadthHistory.push(snapshot);
    if (breadthHistory.length > MAX_HISTORY) {
      breadthHistory.shift();
    }

    // Calculate indicators
    const indicators = calculateIndicators(snapshot, breadthHistory);

    const report: BreadthReport = {
      success: true,
      current: snapshot,
      indicators,
      history: breadthHistory.slice(-20),
      trendAnalysis: generateTrendAnalysis(indicators, breadthHistory),
      timestamp: Date.now(),
    };

    cache.set(cacheKey, { data: report, expires: Date.now() + CACHE_TTL });
    log.info(`[MarketBreadth] A/D: ${advancing}/${declining}, trend: ${indicators.trend}`);
    return report;
  } catch (err: unknown) {
    log.error('[MarketBreadth] Fetch error:', err.message);
    return emptyReport(err.message);
  }
}

function calculateIndicators(
  current: MarketBreadthSnapshot,
  history: MarketBreadthSnapshot[]
): BreadthIndicators {
  const { advancing, declining, unchanged, totalStocks, limitUp, limitDown } = current;

  // A/D Ratio
  const adRatio = declining > 0 ? advancing / declining : advancing > 0 ? 999 : 0;

  // Advance/Decline rate
  const advanceRate = totalStocks > 0 ? (advancing / totalStocks) * 100 : 0;
  const declineRate = totalStocks > 0 ? (declining / totalStocks) * 100 : 0;

  // Cumulative A/D line
  let adLine = 0;
  for (const h of history) {
    adLine += h.advancing - h.declining;
  }
  const adLineChange = history.length > 1
    ? (advancing - declining) - (history[history.length - 2].advancing - history[history.length - 2].declining)
    : 0;

  // Volume ratio (placeholder - would need more data)
  const volumeRatio = current.advVolume > 0 && current.decVolume > 0
    ? current.advVolume / current.decVolume
    : 1;

  // Highs/Lows
  const hlRatio = current.newLows > 0 ? current.newHighs / current.newLows : current.newHighs > 0 ? 999 : 0;
  const hlDiff = current.newHighs - current.newLows;

  // Limit ratios
  const limitUpRatio = totalStocks > 0 ? (limitUp / totalStocks) * 100 : 0;
  const limitDownRatio = totalStocks > 0 ? (limitDown / totalStocks) * 100 : 0;

  // Trend determination
  let trend: BreadthIndicators['trend'];
  if (adRatio > 3 && advanceRate > 70) trend = 'strong_bull';
  else if (adRatio > 1.5 && advanceRate > 55) trend = 'bull';
  else if (adRatio < 0.33 && declineRate > 70) trend = 'strong_bear';
  else if (adRatio < 0.67 && declineRate > 55) trend = 'bear';
  else trend = 'neutral';

  // Divergence detection
  let divergence: BreadthIndicators['divergence'] = 'none';
  if (history.length >= 3) {
    const recentAD = history.slice(-3).reduce((s, h) => s + (h.advancing - h.declining), 0);
    const prevAD = history.slice(-6, -3).reduce((s, h) => s + (h.advancing - h.declining), 0);
    if (recentAD > prevAD + 100) divergence = 'bullish';
    else if (recentAD < prevAD - 100) divergence = 'bearish';
  }

  // Strength score (0-100)
  const strengthFactors = [
    Math.min(100, advanceRate * 1.5),
    Math.min(100, adRatio * 25),
    limitUp > limitDown * 3 ? 80 : limitUp > limitDown ? 60 : 30,
  ];
  const strength = Math.round(strengthFactors.reduce((s, v) => s + v, 0) / strengthFactors.length);

  return {
    adLine,
    adLineChange,
    adRatio: Math.round(adRatio * 100) / 100,
    advanceRate: Math.round(advanceRate * 10) / 10,
    declineRate: Math.round(declineRate * 10) / 10,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    hlRatio: Math.round(hlRatio * 100) / 100,
    hlDiff,
    limitUpRatio: Math.round(limitUpRatio * 100) / 100,
    limitDownRatio: Math.round(limitDownRatio * 100) / 100,
    trend,
    divergence,
    strength,
  };
}

function generateTrendAnalysis(
  indicators: BreadthIndicators,
  history: MarketBreadthSnapshot[]
): string {
  const parts: string[] = [];

  parts.push(`Market breadth: ${indicators.trend.replace('_', ' ')} (A/D ratio: ${indicators.adRatio})`);
  parts.push(`${indicators.advanceRate}% advancing, ${indicators.declineRate}% declining`);

  if (indicators.divergence !== 'none') {
    parts.push(`Divergence detected: ${indicators.divergence}`);
  }

  if (history.length >= 5) {
    const avgAD = history.slice(-5).reduce((s, h) => s + (h.advancing - h.declining), 0) / 5;
    parts.push(`5-period avg A/D: ${avgAD > 0 ? '+' : ''}${avgAD.toFixed(0)}`);
  }

  return parts.join('. ');
}

function emptyReport(error: string): BreadthReport {
  return {
    success: false,
    current: { date: '', advancing: 0, declining: 0, unchanged: 0, advVolume: 0, decVolume: 0, newHighs: 0, newLows: 0, limitUp: 0, limitDown: 0, totalStocks: 0 },
    indicators: { adLine: 0, adLineChange: 0, adRatio: 0, advanceRate: 0, declineRate: 0, volumeRatio: 0, hlRatio: 0, hlDiff: 0, limitUpRatio: 0, limitDownRatio: 0, trend: 'neutral', divergence: 'none', strength: 0 },
    history: [],
    trendAnalysis: error,
    timestamp: Date.now(),
    error,
  };
}


export function clearBreadthCache(): void {
  cache.clear();
  breadthHistory.length = 0;
}
