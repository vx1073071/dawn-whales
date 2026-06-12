// ── R116 QTE-42/43/44 PM: 套利引擎 + 智能路由增强 ─────────────────────
// QTE-42: 三角套利 (A→B→C→A环形)
// QTE-43: 统计套利 (配对交易Z-score+协整+跨所价差±2σ)
// QTE-44: SmartOrderRouter增强 (routeSplit/routeByLiquidity)
//
// @author PM (WorkBuddy)
// @round R116
// @since 2026-06-12

import type { OrderBookSnapshot } from './depth-types';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** 简单价差套利机会 */
export interface ArbitrageOpportunity {
  id: string;
  type: 'spread' | 'triangular' | 'statistical';
  symbol: string;
  buyBroker: string;
  sellBroker: string;
  buyPrice: number;
  sellPrice: number;
  spreadPct: number;
  /** 扣除双边手续费后的净收益% */
  netProfitPct: number;
  /** 最小成交量(取买卖两方较小者) */
  maxVolume: number;
  /** 预估收益(美元) */
  estimatedProfit: number;
  timestamp: number;
}

/** 三角套利路径 */
export interface TriangularPath {
  legs: [string, string, string];  // 三个交易对
  brokers: [string, string, string]; // 三家券商
  rates: [number, number, number];  // 三个汇率
  /** 初始本金投入后终值倍数 (>1有利可图) */
  endRatio: number;
  /** 成本倍数 (含手续费) */
  costRatio: number;
  netProfitPct: number;
}

/** 统计套利对 */
export interface StatArbPair {
  symbolA: string;
  symbolB: string;
  brokerId: string;
  /** A/B价格比率的Z-score */
  zScore: number;
  /** 均值 */
  mean: number;
  /** 标准差 */
  stdDev: number;
  /** 信号: 做多A做空B / 做空A做多B / 无 */
  signal: 'long_short' | 'short_long' | 'none';
  confidence: number;
  halfLifeMs: number;  // 均值回归半衰期
}

/** 智能路由拆分结果 */
export interface RouteSplitResult {
  originalVolume: number;
  splits: {
    brokerId: string;
    volume: number;
    price: number;
    fee: number;
    reason: string;
  }[];
  totalCost: number;
  avgPrice: number;
  savedPercent: number;  // 比单券商下单节省%
}

// ═══════════════════════════════════════════════════════════════════════
// QTE-42: TRIANGULAR ARBITRAGE (三角套利)
// ═══════════════════════════════════════════════════════════════════════

/** 常用三角套利路径 */
const TRIANGULAR_ROUTES: [string, string, string][] = [
  ['BTCUSDT', 'ETHBTC', 'ETHUSDT'],
  ['ETHUSDT', 'BNBETH', 'BNBUSDT'],
  ['BTCUSDT', 'SOLBTC', 'SOLUSDT'],
  ['BTCUSDT', 'LINKBTC', 'LINKUSDT'],
  ['ETHUSDT', 'ARBETH', 'ARBUSDT'],
];

export function scanTriangularArbitrage(
  orderBooks: Map<string, OrderBookSnapshot[]>,
  feeBps: number = 10, // 默认0.1%
): TriangularPath[] {
  const results: TriangularPath[] = [];

  for (const [leg1, leg2, leg3] of TRIANGULAR_ROUTES) {
    const books1 = orderBooks.get(leg1);
    const books2 = orderBooks.get(leg2);
    const books3 = orderBooks.get(leg3);
    if (!books1 || !books2 || !books3) continue;

    for (const b1 of books1) {
      for (const b2 of books2) {
        for (const b3 of books3) {
          // 避免同一券商(无套利空间)
          const brokers = new Set([b1.exchange, b2.exchange, b3.exchange]);
          if (brokers.size < 2) continue;

          // 三角套利: 用baseQuantity在b1买入leg1→换leg2→换leg3→回到baseCurrency
          const baseQuantity = 1000; // 模拟1000 USDT

          // leg1: 在b1买入leg1 (如USDT→BTC)
          const leg1Ask = getBestAsk(b1);
          if (!leg1Ask) continue;
          const afterLeg1 = baseQuantity / leg1Ask.price * (1 - feeBps/10000);

          // leg2: 在b2买入leg2 (如BTC→ETH)
          const leg2Bid = getBestBid(b2);
          if (!leg2Bid) continue;
          const afterLeg2 = afterLeg1 / books2.reduce((sum, b) => {
            const ask = getBestAsk(b);
            return ask ? Math.max(sum, 1/ask.price) : sum;
          }, 0) * (1 - feeBps/10000);

          // leg3: 在b3卖出leg3回到USDT (如ETH→USDT)
          const leg3Bid = getBestBid(b3);
          if (!leg3Bid) continue;
          const finalAmount = afterLeg2 * leg3Bid.price * (1 - feeBps/10000);

          const endRatio = finalAmount / baseQuantity;
          if (endRatio <= 1) continue;

          const costRatio = Math.pow(1 - feeBps/10000, 3);
          const netProfitPct = (endRatio - 1) * 100;

          results.push({
            legs: [leg1, leg2, leg3],
            brokers: [b1.exchange, b2.exchange, b3.exchange],
            rates: [getBestAsk(b1)!.price, 1/getBestBid(b2)!.price, getBestBid(b3)!.price],
            endRatio,
            costRatio,
            netProfitPct,
          });
        }
      }
    }
  }

  // 按净收益排序, 取前10
  return results
    .sort((a, b) => b.netProfitPct - a.netProfitPct)
    .slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════
// QTE-43: STATISTICAL ARBITRAGE (统计套利)
// ═══════════════════════════════════════════════════════════════════════

export interface StatArbConfig {
  /** Z-score阈值 (默认±2) */
  entryThreshold: number;
  /** Z-score退出阈值 */
  exitThreshold: number;
  /** 均值计算窗口 (K线数量) */
  windowSize: number;
  /** 最小置信度 */
  minConfidence: number;
}

const DEFAULT_STAT_ARB_CONFIG: StatArbConfig = {
  entryThreshold: 2.0,
  exitThreshold: 0.5,
  windowSize: 60,
  minConfidence: 0.3,
};

/**
 * 计算配对交易的Z-score
 * 输入: 两个时间序列的价格
 */
export function computePairZScore(
  pricesA: number[],
  pricesB: number[],
  windowSize: number = 60,
): StatArbPair | null {
  if (pricesA.length < windowSize || pricesB.length < windowSize) return null;

  const ratios: number[] = [];
  for (let i = 0; i < Math.min(pricesA.length, pricesB.length); i++) {
    if (pricesB[i] > 0) {
      ratios.push(pricesA[i] / pricesB[i]);
    }
  }

  const recent = ratios.slice(-windowSize);
  const mean = recent.reduce((s, r) => s + r, 0) / recent.length;
  const variance = recent.reduce((s, r) => s + (r - mean) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 1e-10) return null;

  const currentRatio = ratios[ratios.length - 1];
  const zScore = (currentRatio - mean) / stdDev;

  let signal: 'long_short' | 'short_long' | 'none' = 'none';
  if (zScore > 2) signal = 'short_long';   // A超涨B超跌, 做空A做多B
  else if (zScore < -2) signal = 'long_short'; // A超跌B超涨, 做多A做空B

  // 半衰期: ratio回复到均值所需K线数
  const halfLife = computeHalfLife(ratios.slice(-windowSize * 2));

  return {
    symbolA: 'A',
    symbolB: 'B',
    brokerId: '',
    zScore,
    mean,
    stdDev,
    signal,
    confidence: Math.min(1, Math.abs(zScore) / 4),
    halfLifeMs: halfLife * 60000, // 假设1分钟K线
  };
}

/** Ornstein-Uhlenbeck半衰期估计 */
function computeHalfLife(series: number[]): number {
  if (series.length < 2) return Infinity;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = series.length - 1;

  for (let i = 0; i < n; i++) {
    const x = series[i];
    const y = series[i + 1] - series[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return Infinity;

  const slope = (n * sumXY - sumX * sumY) / denom;
  if (slope >= 0) return Infinity; // 非均值回归

  return -Math.log(2) / slope;
}

/**
 * 跨所价差统计套利扫描
 * 同一标的在不同券商的最优买卖价差是否偏离均值>2σ
 */
export function scanCrossExchangeSpread(
  symbol: string,
  orderBooks: OrderBookSnapshot[],
  historySpreads: number[],
  config?: Partial<StatArbConfig>,
): ArbitrageOpportunity[] {
  const cfg = { ...DEFAULT_STAT_ARB_CONFIG, ...config };
  const results: ArbitrageOpportunity[] = [];

  if (orderBooks.length < 2 || historySpreads.length < cfg.windowSize) return results;

  // 计算历史价差统计量
  const recentSpreads = historySpreads.slice(-cfg.windowSize);
  const mean = recentSpreads.reduce((s, v) => s + v, 0) / recentSpreads.length;
  const variance = recentSpreads.reduce((s, v) => s + (v - mean) ** 2, 0) / recentSpreads.length;
  const stdDev = Math.sqrt(variance);

  // 扫描所有券商对
  for (let i = 0; i < orderBooks.length; i++) {
    for (let j = i + 1; j < orderBooks.length; j++) {
      const bookA = orderBooks[i];
      const bookB = orderBooks[j];
      const bidA = getBestBid(bookA);
      const askB = getBestAsk(bookB);
      if (!bidA || !askB) continue;

      const spread = askB.price - bidA.price;
      const spreadPct = spread / bidA.price * 100;

      if (recentSpreads.length >= cfg.windowSize) {
        const zScore = (spreadPct - mean) / (stdDev || 0.01);

        if (Math.abs(zScore) < cfg.entryThreshold) continue;

        const netProfitPct = spreadPct - 0.2; // 假设双边手续费0.2%
        if (netProfitPct <= 0) continue;

        const maxVol = Math.min(bidA.size, askB.size);
        results.push({
          id: `stat_spread_${symbol}_${bookA.exchange}_${bookB.exchange}`,
          type: 'statistical',
          symbol,
          buyBroker: bookA.exchange,
          sellBroker: bookB.exchange,
          buyPrice: bidA.price,
          sellPrice: askB.price,
          spreadPct,
          netProfitPct,
          maxVolume: maxVol,
          estimatedProfit: maxVol * spreadPct / 100,
          timestamp: Date.now(),
        });
      }
    }
  }

  return results
    .filter(r => r.netProfitPct > 0)
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit);
}

// ═══════════════════════════════════════════════════════════════════════
// QTE-44: SMART ORDER ROUTER ENHANCEMENT (路由增强)
// ═══════════════════════════════════════════════════════════════════════

export interface RouteConfig {
  /** 最大拆分数量 */
  maxSplits: number;
  /** 每笔最小量 */
  minSplitVolume: number;
  /** 手续费 (bps) */
  feeBps: number;
  /** 滑点容忍度 */
  slippageTolerance: number;
}

const DEFAULT_ROUTE_CONFIG: RouteConfig = {
  maxSplits: 5,
  minSplitVolume: 0.01,
  feeBps: 10,
  slippageTolerance: 0.005,
};

/**
 * 按深度自动拆分大单到多个券商
 * routeSplit: 当单券商深度不足以承接时, 拆分到多个券商
 */
export function routeSplit(
  volume: number,
  side: 'buy' | 'sell',
  orderBooks: OrderBookSnapshot[],
  config?: Partial<RouteConfig>,
): RouteSplitResult {
  const cfg = { ...DEFAULT_ROUTE_CONFIG, ...config };
  const splits: RouteSplitResult['splits'] = [];
  let remaining = volume;
  let totalCost = 0;
  let totalVolume = 0;

  // 按最优价格排序
  const sorted = [...orderBooks].sort((a, b) => {
    if (side === 'buy') return (getBestAsk(a)?.price || Infinity) - (getBestAsk(b)?.price || Infinity);
    return (getBestBid(b)?.price || 0) - (getBestBid(a)?.price || 0);
  });

  for (const book of sorted) {
    if (remaining <= 0) break;
    if (splits.length >= cfg.maxSplits) break;

    const bestPrice = side === 'buy' ? getBestAsk(book) : getBestBid(book);
    if (!bestPrice) continue;

    // 计算该券商可承接量
    const available = Math.min(
      remaining,
      bestPrice.size * 0.8, // 留20%余量
      side === 'buy' ? getDepthLiquidity(book.asks) : getDepthLiquidity(book.bids),
    );

    if (available < cfg.minSplitVolume) continue;

    const fee = available * bestPrice.price * cfg.feeBps / 10000;
    splits.push({
      brokerId: book.exchange,
      volume: available,
      price: bestPrice.price,
      fee,
      reason: `${side === 'buy' ? '买' : '卖'}${available.toFixed(4)}@${book.exchange}`,
    });

    totalCost += available * bestPrice.price + fee;
    totalVolume += available;
    remaining -= available;
  }

  // 整体节省(与单券商下单相比)
  const singleBest = sorted[0];
  const singlePrice = side === 'buy'
    ? (getBestAsk(singleBest)?.price || 0)
    : (getBestBid(singleBest)?.price || 0);
  const singleCost = volume * singlePrice * (1 + cfg.feeBps/10000);

  return {
    originalVolume: volume,
    splits,
    totalCost: totalCost || volume * singlePrice * (1 + cfg.feeBps/10000),
    avgPrice: totalVolume > 0 ? totalCost / totalVolume : singlePrice,
    savedPercent: singleCost > 0 ? (singleCost - totalCost) / singleCost * 100 : 0,
  };
}

/**
 * 按流动性选最优券商
 * routeByLiquidity: 基于滑点预估选择流动性最好的券商
 */
export function routeByLiquidity(
  volume: number,
  side: 'buy' | 'sell',
  orderBooks: OrderBookSnapshot[],
  config?: Partial<RouteConfig>,
): { brokerId: string; avgPrice: number; estimatedSlippage: number }[] {
  const cfg = { ...DEFAULT_ROUTE_CONFIG, ...config };
  const results: { brokerId: string; avgPrice: number; estimatedSlippage: number }[] = [];

  for (const book of orderBooks) {
    const levels = side === 'buy' ? book.asks : book.bids;
    const bestPrice = side === 'buy' ? getBestAsk(book) : getBestBid(book);
    if (!bestPrice || levels.length === 0) continue;

    // 滑点预估: 遍历深度档位直到满足volume
    let filled = 0;
    let cost = 0;
    for (const level of levels) {
      const take = Math.min(volume - filled, level.size);
      cost += take * level.price;
      filled += take;
      if (filled >= volume) break;
    }

    if (filled < volume * 0.9) continue; // 流动性不足

    const avgPrice = cost / filled;
    const slippage = side === 'buy'
      ? (avgPrice - bestPrice.price) / bestPrice.price
      : (bestPrice.price - avgPrice) / bestPrice.price;

    if (slippage > cfg.slippageTolerance) continue;

    results.push({
      brokerId: book.exchange,
      avgPrice,
      estimatedSlippage: slippage,
    });
  }

  return results.sort((a, b) => a.estimatedSlippage - b.estimatedSlippage);
}

// ═══════════════════════════════════════════════════════════════════════
// SPREAD ARBITRAGE (跨所简单价差 — 模块10基础)
// ═══════════════════════════════════════════════════════════════════════

export function scanSpreadArbitrage(
  symbol: string,
  orderBooks: OrderBookSnapshot[],
  minSpreadPct: number = 0.3,
  minVolume: number = 0,
): ArbitrageOpportunity[] {
  const results: ArbitrageOpportunity[] = [];

  for (let i = 0; i < orderBooks.length; i++) {
    for (let j = 0; j < orderBooks.length; j++) {
      if (i === j) continue;
      const ask = getBestAsk(orderBooks[j]);
      const bid = getBestBid(orderBooks[i]);
      if (!ask || !bid) continue;

      const spreadPct = (ask.price - bid.price) / bid.price * 100;
      if (spreadPct < minSpreadPct) continue;

      const vol = Math.min(bid.size, ask.size);
      if (vol < minVolume) continue;

      results.push({
        id: `spread_${symbol}_${orderBooks[i].exchange}_${orderBooks[j].exchange}`,
        type: 'spread',
        symbol,
        buyBroker: orderBooks[i].exchange,
        sellBroker: orderBooks[j].exchange,
        buyPrice: bid.price,
        sellPrice: ask.price,
        spreadPct,
        netProfitPct: spreadPct - 0.2, // 双边手续费
        maxVolume: vol,
        estimatedProfit: vol * spreadPct / 100,
        timestamp: Date.now(),
      });
    }
  }

  return results
    .filter(r => r.netProfitPct > 0)
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit);
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function getBestBid(book: OrderBookSnapshot): { price: number; size: number } | null {
  if (book.best?.bidPrice) return { price: book.best.bidPrice, size: book.best.bidSize };
  return book.bids[0] || null;
}

function getBestAsk(book: OrderBookSnapshot): { price: number; size: number } | null {
  if (book.best?.askPrice) return { price: book.best.askPrice, size: book.best.askSize };
  return book.asks[0] || null;
}

function getDepthLiquidity(levels: { size: number }[]): number {
  return levels.reduce((s, l) => s + l.size, 0);
}