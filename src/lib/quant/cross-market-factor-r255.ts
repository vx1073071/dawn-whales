// ══ R255 LOBEHUB QU-05: 跨市场因子相关性分析 ══
// Cross-Market Factor Correlation — 29市场间的隐藏联动
// "A股涨了，港股会跟吗？日经跌了，标普500会怎样？"

export interface MarketPairCorrelation {
  marketA: string; marketB: string;
  correlation: number; pValue: number; dataPoints: number;
  leadingMarket?: string; leadLagHours?: number;
  interpretation: string;
}

export interface CrossMarketFactorSnapshot {
  timestamp: number; factorId: string; factorName: string;
  globalIC: number;
  marketBreakdown: Array<{ market: string; IC: number; sharpe: number; signalCount: number }>;
  bestMarket: string; worstMarket: string;
  correlationMatrix: MarketPairCorrelation[];
  heatmap: number[][];
}

export interface FactorGlobalSummary {
  timestamp: number; factorId: string; factorName: string;
  totalMarkets: number; effectiveMarkets: number;
  globalAvgIC: number; bestRegion: string;
  recommendations: string[];
}

export const MARKET_CODES: Record<string, string> = {
  US: '🇺🇸美国', HK: '🇭🇰香港', CN: '🇨🇳A股', JP: '🇯🇵日本',
  UK: '🇬🇧英国', DE: '🇩🇪德国', FR: '🇫🇷法国', NL: '🇳🇱荷兰',
  CA: '🇨🇦加拿大', AU: '🇦🇺澳洲', KR: '🇰🇷韩国', TW: '🇹🇼台湾',
  SG: '🇸🇬新加坡', IN: '🇮🇳印度', BR: '🇧🇷巴西', SA: '🇸🇦沙特',
  ID: '🇮🇩印尼', TH: '🇹🇭泰国', VN: '🇻🇳越南', ZA: '🇿🇦南非',
  MY: '🇲🇾马来', PH: '🇵🇭菲', CH: '🇨🇭瑞士', AE: '🇦🇪阿联酋', IL: '🇮🇱以色列',
  CRYPTO: '🪙加密', COMMODITY: '🏗️商品', FOREX: '💱外汇',
};

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    cov += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  const denom = Math.sqrt(vx * vy);
  return denom > 0 ? Math.round(cov / denom * 1000) / 1000 : 0;
}

export function buildCorrelationMatrix(
  marketReturns: Record<string, number[]>,
): { markets: string[]; matrix: number[][]; pairs: MarketPairCorrelation[] } {
  const markets = Object.keys(marketReturns);
  const n = markets.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const pairs: MarketPairCorrelation[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const corr = pearsonCorrelation(marketReturns[markets[i]], marketReturns[markets[j]]);
      matrix[i][j] = matrix[j][i] = corr;
      const absR = Math.abs(corr);
      const aName = MARKET_CODES[markets[i]] || markets[i];
      const bName = MARKET_CODES[markets[j]] || markets[j];
      pairs.push({
        marketA: markets[i], marketB: markets[j], correlation: corr,
        pValue: 0, dataPoints: Math.min(marketReturns[markets[i]].length, marketReturns[markets[j]].length),
        interpretation: absR > 0.8
          ? (corr > 0 ? `🫂${aName}和${bName}高度联动` : `🔄${aName}和${bName}高度反向`)
          : absR > 0.5
            ? (corr > 0 ? `🤝${aName}和${bName}明显正相关` : `⚔️${aName}和${bName}明显负相关`)
            : absR > 0.2
              ? `🆓${aName}和${bName}弱相关——适合分散配置`
              : `🚀${aName}和${bName}几乎不相关——绝佳分散组合`,
      });
    }
    matrix[i][i] = 1;
  }
  pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  return { markets, matrix, pairs };
}

export interface LeadLagResult {
  leader: string; lagger: string; lagHours: number;
  maxCorrelation: number;
  significance: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  tradeIdea: string;
}

export function detectLeadLag(
  marketA: string, marketB: string,
  aReturns: number[], bReturns: number[],
  maxLag: number = 48,
): LeadLagResult {
  let bestLag = 0, bestCorr = 0, leader = marketA, lagger = marketB;

  for (let lag = 0; lag <= maxLag; lag++) {
    const sa = aReturns.slice(0, aReturns.length - lag);
    const sb = bReturns.slice(lag);
    const corr = pearsonCorrelation(sa, sb);
    if (Math.abs(corr) > Math.abs(bestCorr)) { bestCorr = corr; bestLag = lag; leader = marketA; lagger = marketB; }
  }
  for (let lag = 0; lag <= maxLag; lag++) {
    const sb = bReturns.slice(0, bReturns.length - lag);
    const sa = aReturns.slice(lag);
    const corr = pearsonCorrelation(sb, sa);
    if (Math.abs(corr) > Math.abs(bestCorr)) { bestCorr = corr; bestLag = lag; leader = marketB; lagger = marketA; }
  }

  let sig: LeadLagResult['significance'] = 'NONE';
  if (Math.abs(bestCorr) > 0.6) sig = 'STRONG';
  else if (Math.abs(bestCorr) > 0.4) sig = 'MODERATE';
  else if (Math.abs(bestCorr) > 0.2) sig = 'WEAK';

  const lName = MARKET_CODES[leader] || leader;
  const gName = MARKET_CODES[lagger] || lagger;

  return {
    leader, lagger, lagHours: bestLag, maxCorrelation: bestCorr, significance: sig,
    tradeIdea: (sig === 'STRONG' || sig === 'MODERATE')
      ? `${lName}领先${gName}约${bestLag}h——收盘后可预判${gName}开盘方向`
      : '无显著的领先滞后关系',
  };
}

export function factorGlobalSummary(
  factorId: string, factorName: string,
  marketICs: Array<{ market: string; IC: number; sharpe: number; signalCount: number }>,
): FactorGlobalSummary {
  const effective = marketICs.filter(m => Math.abs(m.IC) > 0.03);
  const avgIC = marketICs.reduce((s, m) => s + m.IC, 0) / marketICs.length;
  const sorted = [...marketICs].sort((a, b) => b.IC - a.IC);
  const recs: string[] = [];
  if (effective.length === 0) recs.push('❌该因子在任何市场都无效——建议从因子池移除');
  else if (effective.length < marketICs.length * 0.3) recs.push('⚠️该因子仅在少数市场有效——使用时注意市场限制');
  else recs.push(`✅该因子在${effective.length}/${marketICs.length}个市场有效——通用性好`);
  return {
    timestamp: Date.now(), factorId, factorName,
    totalMarkets: marketICs.length, effectiveMarkets: effective.length,
    globalAvgIC: avgIC, bestRegion: sorted[0]?.market || '', recommendations: recs,
  };
}

export default CrossMarketFactorSnapshot;
