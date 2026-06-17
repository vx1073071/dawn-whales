/**
 * R255 AI-05: MultiStockCompare — 多股对比评分引擎
 * LOBEHUB | v3.0.0 QUANT MOO
 * 5维度: Sharpe/CAGR/MaxDD/ROE/PE + 雷达图 + 排名
 * >=350L
 */

export interface StockSnapshot {
  symbol: string; name: string; market: string;
  sharpe: number; cagr: number; maxDrawdown: number;
  roe: number; pe: number;
  volatility: number; winRate: number; price: number; changePct: number;
}

export interface CompareResult {
  symbol: string; name: string;
  scores: { dimension: string; value: number; normalized: number; rank: number }[];
  compositeScore: number; // 0-100
  rank: number;
  strengths: string[]; weaknesses: string[];
  summary: string;
}

export interface CompareReport {
  stocks: StockSnapshot[];
  results: CompareResult[];
  bestOverall: string;
  bestPerDimension: Record<string, string>;
  correlationNote: string;
}

export class MultiStockCompare {
  readonly id = 'multi_stock_compare'; readonly version = '3.0.0';

  readonly dimensions = [
    { key: 'sharpe', label: 'Sharpe', weight: 20, direction: 'higher_better' as const },
    { key: 'cagr', label: '年化收益', weight: 20, direction: 'higher_better' as const },
    { key: 'maxDrawdown', label: '最大回撤', weight: 20, direction: 'lower_better' as const },
    { key: 'roe', label: 'ROE', weight: 20, direction: 'higher_better' as const },
    { key: 'pe', label: 'PE', weight: 20, direction: 'lower_better' as const },
  ];

  compare(stocks: StockSnapshot[]): CompareReport {
    if (stocks.length < 2) return { stocks, results: [], bestOverall: stocks[0]?.symbol || '', bestPerDimension: {}, correlationNote: '' };

    // 标准化: 0-1, higher=better
    const normed: Record<string, Record<string, number>> = {};
    const dimKeys = this.dimensions.map(d => d.key);

    for (const d of this.dimensions) {
      const values = stocks.map(s => (s as any)[d.key] || 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      normed[d.key] = {};
      for (const s of stocks) {
        const v = (s as any)[d.key] || 0;
        const range = max - min || 1;
        if (d.direction === 'higher_better') normed[d.key][s.symbol] = (v - min) / range;
        else normed[d.key][s.symbol] = (max - v) / range;
      }
    }

    // 排名
    const resultMap: CompareResult[] = stocks.map(s => {
      let composite = 0;
      const scores: CompareResult['scores'] = [];

      for (const d of this.dimensions) {
        const nv = normed[d.key][s.symbol];
        composite += nv * d.weight;
        scores.push({ dimension: d.label, value: (s as any)[d.key], normalized: Math.round(nv * 100), rank: 0 });
      }

      // 优劣势
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      for (const sc of scores) {
        if (sc.normalized >= 80) strengths.push(`${sc.dimension}: ${sc.value}`);
        if (sc.normalized <= 20) weaknesses.push(`${sc.dimension}: ${sc.value}`);
      }

      return { symbol: s.symbol, name: s.name, scores, compositeScore: Math.round(composite / 5), rank: 0, strengths, weaknesses, summary: '' };
    });

    // 排序
    resultMap.sort((a, b) => b.compositeScore - a.compositeScore);
    resultMap.forEach((r, i) => { r.rank = i + 1; });

    // 各维度排名
    for (const d of this.dimensions) {
      for (const r of resultMap) {
        const sc = r.scores.find(x => x.dimension === d.label)!;
        const allVals = resultMap.map(rr => rr.scores.find(x => x.dimension === d.label)!.normalized).sort((a, b) => b - a);
        sc.rank = allVals.indexOf(sc.normalized) + 1;
      }
    }

    // 最佳
    const bestOverall = resultMap[0]?.symbol || '';
    const bestPerDimension: Record<string, string> = {};
    for (const d of this.dimensions) {
      const best = resultMap.sort((a, b) => {
        const sa = a.scores.find(x => x.dimension === d.label)!.normalized;
        const sb = b.scores.find(x => x.dimension === d.label)!.normalized;
        return sb - sa;
      })[0];
      if (best) bestPerDimension[d.label] = best.symbol;
    }

    // 相关性提示
    const similar = resultMap.filter(r => Math.abs(r.compositeScore - resultMap[0].compositeScore) < 10);
    const correlationNote = similar.length > 1 ? `前${similar.length}名差距很小(<10分)，更多关注维度差异` : '第一名明显领先';

    // 摘要
    resultMap.forEach(r => {
      r.summary = r.rank === 1 ? '综合最佳选择' :
        r.strengths.length > r.weaknesses.length ? '优势明显，可优先考虑' :
        r.weaknesses.length > r.strengths.length ? '需关注弱势维度' : '各维度均衡';
    });

    return { stocks, results: resultMap, bestOverall, bestPerDimension, correlationNote };
  }
}
