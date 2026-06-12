// ── R121 PM: 交易标配 — 绿涨红跌全局色 + 主题切换 + 现价线 + 资金曲线 + 多股对比 + 差价图 ──
// Owner要求: 全品牌统一绿涨红跌 + 资金曲线 + 深色/浅色切换 + 现价线 + 成本线 + 买卖打点
//
// @author PM (WorkBuddy)
// @round R121
// @since 2026-06-12

// ═══════════════════════════════════════════════════════════════════════
// 1. 绿涨红跌 全品牌统一色 → 所有组件引用此常量
// ═══════════════════════════════════════════════════════════════════════

export const BRAND_COLORS = {
  // 涨跌色 (中国大陆习惯: 红涨绿跌)
  up: '#ef4444',        // 红色 = 上涨
  down: '#22c55e',      // 绿色 = 下跌
  upLight: 'rgba(239,68,68,0.15)',
  downLight: 'rgba(34,197,94,0.15)',

  // 交易方向色
  buy: '#ef4444',       // 买入 = 红色
  sell: '#22c55e',      // 卖出 = 绿色

  // 盈亏色
  profit: '#ef4444',
  loss: '#22c55e',

  // 中性/当前价
  neutral: '#3b82f6',   // 蓝色
  current: '#f59e0b',   // 橙色
};

// ═══════════════════════════════════════════════════════════════════════
// 2. 深色/浅色主题
// ═══════════════════════════════════════════════════════════════════════

export type AppTheme = 'dark' | 'light';

export const THEME_LIGHT = {
  background: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  grid: '#f3f4f6',
  crosshair: '#9ca3af',
  upColor: '#ef4444',
  downColor: '#22c55e',
  volumeUp: 'rgba(239,68,68,0.5)',
  volumeDown: 'rgba(34,197,94,0.5)',
};

export const THEME_DARK = {
  background: '#131722',
  text: '#d1d4dc',
  textSecondary: '#787b86',
  border: '#2a2e39',
  grid: '#1e222d',
  crosshair: '#434651',
  upColor: '#ef4444',
  downColor: '#22c55e',
  volumeUp: 'rgba(239,68,68,0.5)',
  volumeDown: 'rgba(34,197,94,0.5)',
};

const THEME_KEY = 'dw_theme';

export function getSavedTheme(): AppTheme {
  try { return (localStorage.getItem(THEME_KEY) as AppTheme) || 'dark'; }
  catch { return 'dark'; }
}

export function saveTheme(theme: AppTheme): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function getThemeColors(theme: AppTheme) {
  return theme === 'light' ? THEME_LIGHT : THEME_DARK;
}

// ═══════════════════════════════════════════════════════════════════════
// 3. 现价线常驻线配置
// ═══════════════════════════════════════════════════════════════════════

export const CURRENT_PRICE_LINE = {
  color: '#f59e0b',     // 橙色现价线
  width: 1,
  style: 2,             // dashed
  axisLabelVisible: true,
  title: '',
};

// ═══════════════════════════════════════════════════════════════════════
// 4. 资金曲线计算引擎
// ═══════════════════════════════════════════════════════════════════════

export interface PnLPoint {
  time: number;
  pnl: number;          // 累计盈亏
  pnlPercent: number;   // 累计收益率(%)
  dailyPnl: number;     // 当日盈亏
  equity: number;       // 总权益
}

export function computeEquityCurve(
  initialCapital: number,
  trades: { time: number; pnl: number; side: 'buy' | 'sell'; price: number; qty: number }[],
): PnLPoint[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => a.time - b.time);
  let cumPnl = 0;
  let equity = initialCapital;

  return sorted.map(t => {
    cumPnl += t.pnl;
    equity = initialCapital + cumPnl;
    return {
      time: t.time,
      pnl: cumPnl,
      pnlPercent: initialCapital > 0 ? (cumPnl / initialCapital) * 100 : 0,
      dailyPnl: t.pnl,
      equity,
    };
  });
}

export function computePnLStats(curve: PnLPoint[]): {
  totalReturn: number; maxDrawdown: number; sharpeRatio: number;
  winRate: number; profitFactor: number; totalTrades: number;
} {
  if (curve.length < 2) return { totalReturn: 0, maxDrawdown: 0, sharpeRatio: 0, winRate: 0, profitFactor: 0, totalTrades: 0 };

  const totalReturn = curve[curve.length - 1].pnlPercent;
  let peak = curve[0].equity;
  let maxDD = 0;

  for (const p of curve) {
    if (p.equity > peak) peak = p.equity;
    const dd = (peak - p.equity) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }

  const dailyReturns: number[] = [];
  let wins = 0, totalWins = 0, totalLosses = 0;
  for (let i = 1; i < curve.length; i++) {
    const ret = curve[i].pnlPercent - curve[i - 1].pnlPercent;
    dailyReturns.push(ret);
    if (ret > 0) { wins++; totalWins += ret; }
    else { totalLosses += Math.abs(ret); }
  }

  const avgDaily = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const stdDaily = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgDaily) ** 2, 0) / dailyReturns.length);
  const sharpe = stdDaily > 0 ? (avgDaily / stdDaily) * Math.sqrt(252) : 0;

  return {
    totalReturn,
    maxDrawdown: maxDD,
    sharpeRatio: sharpe,
    winRate: wins / dailyReturns.length * 100,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    totalTrades: curve.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 5. 多股对比引擎 (归一化价格叠加)
// ═══════════════════════════════════════════════════════════════════════

export interface NormalizedSeries {
  symbol: string;
  name: string;
  color: string;
  data: { time: number; value: number }[];
  changePct: number;  // 对比期间总涨跌%
}

const COMPARISON_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export function computeNormalizedComparison(
  priceMap: Map<string, { time: number; close: number }[]>,
  symbols: string[],
  names: string[],
): NormalizedSeries[] {
  const results: NormalizedSeries[] = [];
  let colorIdx = 0;

  for (let i = 0; i < symbols.length; i++) {
    const prices = priceMap.get(symbols[i]);
    if (!prices || prices.length < 2) continue;

    const basePrice = prices[0].close;
    if (basePrice === 0) continue;

    const data = prices.map(p => ({
      time: p.time,
      value: (p.close / basePrice) * 100, // 归一化到100
    }));

    results.push({
      symbol: symbols[i],
      name: names[i] || symbols[i],
      color: COMPARISON_COLORS[colorIdx++ % COMPARISON_COLORS.length],
      data,
      changePct: data[data.length - 1].value - 100,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════
// 6. 差价图 (两个标的差值)
// ═══════════════════════════════════════════════════════════════════════

export interface SpreadChartData {
  symbolA: string;
  symbolB: string;
  data: { time: number; spread: number; spreadPct: number }[];
  mean: number;
  upperBand: number;  // mean + 2σ
  lowerBand: number;  // mean - 2σ
  currentZScore: number;
}

export function computeSpreadChart(
  priceA: { time: number; close: number }[],
  priceB: { time: number; close: number }[],
  windowSize: number = 60,
): SpreadChartData | null {
  const length = Math.min(priceA.length, priceB.length);

  const data: { time: number; spread: number; spreadPct: number }[] = [];
  for (let i = 0; i < length; i++) {
    if (priceB[i].close === 0) continue;
    const spread = priceA[i].close - priceB[i].close;
    data.push({
      time: priceA[i].time,
      spread,
      spreadPct: (spread / priceB[i].close) * 100,
    });
  }

  if (data.length < windowSize) return null;

  const recent = data.slice(-windowSize);
  const mean = recent.reduce((s, d) => s + d.spread, 0) / recent.length;
  const variance = recent.reduce((s, d) => s + (d.spread - mean) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);

  return {
    symbolA: 'A',
    symbolB: 'B',
    data,
    mean,
    upperBand: mean + 2 * stdDev,
    lowerBand: mean - 2 * stdDev,
    currentZScore: stdDev > 0 ? (data[data.length - 1].spread - mean) / stdDev : 0,
  };
}
