// ══ R257 LOBEHUB QU-10: 29市场相关性热力图 ══
// 29-Market Correlation Heatmap — 90对市场的Pearson矩阵+领先滞后
// "全球市场的血管脉络——一张图看清楚"

import {
  buildCorrelationMatrix,
  detectLeadLag, MARKET_CODES,
} from './cross-market-factor-r255';

export interface MarketHeatmapData {
  markets: string[];
  labels: string[];
  matrix: number[][];
  topPairs: Array<{
    marketA: string; marketB: string;
    labelA: string; labelB: string;
    correlation: number;
    interpretation: string;
  }>;
  leadLagTop: Array<ReturnType<typeof detectLeadLag>>;
  timestamp: number;
}

export function generateMarketHeatmap(
  marketReturns: Record<string, number[]>,
): MarketHeatmapData {
  const { markets, matrix, pairs } = buildCorrelationMatrix(marketReturns);
  const labels = markets.map(m => MARKET_CODES[m] || m);

  const topPairs = pairs
    .filter(p => Math.abs(p.correlation) > 0.3)
    .slice(0, 15)
    .map(p => ({
      marketA: p.marketA, marketB: p.marketB,
      labelA: MARKET_CODES[p.marketA] || p.marketA,
      labelB: MARKET_CODES[p.marketB] || p.marketB,
      correlation: p.correlation,
      interpretation: p.interpretation,
    }));

  // Lead-lag for top correlated pairs
  const leadLagTop: ReturnType<typeof detectLeadLag>[] = [];
  for (const pair of topPairs.slice(0, 5)) {
    const aRet = marketReturns[pair.marketA];
    const bRet = marketReturns[pair.marketB];
    if (aRet && bRet && aRet.length > 10 && bRet.length > 10) {
      leadLagTop.push(detectLeadLag(pair.marketA, pair.marketB, aRet, bRet));
    }
  }

  return {
    markets, labels, matrix, topPairs,
    leadLagTop,
    timestamp: Date.now(),
  };
}

export function formatHeatmapAsText(data: MarketHeatmapData): string {
  const lines: string[] = [
    `# 🌍 29市场相关性热力图`,
    `> 生成时间: ${new Date(data.timestamp).toISOString()}`,
    '',
    `## 🔥 Top 15 高关联市场对`,
    '| # | 市场A | 市场B | 相关性 | 含义 |',
    '|---|-------|-------|--------|------|',
    ...data.topPairs.map((p, i) =>
      `| ${i + 1} | ${p.labelA} | ${p.labelB} | ${(p.correlation * 100).toFixed(1)}% | ${p.interpretation} |`
    ),
    '',
    `## ⏱️ 领先-滞后关系 (Top 5)`,
    '| 领先 | 落后 | 滞后(h) | 最大相关 | 强度 |',
    '|------|------|---------|----------|------|',
    ...data.leadLagTop.map(ll => {
      const ldrLabel = MARKET_CODES[ll.leader] || ll.leader;
      const lgrLabel = MARKET_CODES[ll.lagger] || ll.lagger;
      return `| ${ldrLabel} | ${lgrLabel} | ${ll.lagHours}h | ${(ll.maxCorrelation * 100).toFixed(1)}% | ${ll.significance} |`;
    }),
    '',
    `## 📊 矩阵概要`,
    `- 市场总数: ${data.markets.length}`,
    `- 高关联对(|r|>0.5): ${data.topPairs.filter(p => Math.abs(p.correlation) > 0.5).length}`,
    `- 分散配对的绝佳选择(|r|<0.2): ${data.topPairs.filter(p => Math.abs(p.correlation) < 0.2).length}`,
    `- 领先滞后对: ${data.leadLagTop.filter(ll => ll.significance !== 'NONE').length}`,
    '',
  ];
  return lines.join('\n');
}

export default MarketHeatmapData;
