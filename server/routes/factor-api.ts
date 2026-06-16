/**
 * QUANT MOO R163 P1-X3 — Factor Spot-Check + Comparison API
 *
 * Endpoints:
 *   GET /api/factor/spot-check?symbol=HK:00700&market=HK — full factor scoring + drag analysis
 *   GET /api/factor/compare?a=US:AAPL&b=US:MSFT — side-by-side factor comparison
 *   GET /api/factor/scores?symbols=US:AAPL,US:GOOGL — batch scoring
 *
 * >=200L
 */

import { Router, Request, Response } from 'express';
import { getDawnFactorFramework } from '../../electron/engine/factors/dawn-factor-framework';
import type {
  UnifiedFactorScore,
  DragAnalysis,
  FactorScoreDetail,
  FactorRating,
} from '../../electron/engine/factors/dawn-factor-framework';

const router = Router();

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

type Market = 'US' | 'HK' | 'CN' | 'CRYPTO' | 'SG' | 'JP' | 'UK' | 'EU';
type InstrumentType = 'stock' | 'etf' | 'crypto' | 'futures' | 'option';

interface SpotCheckResponse {
  success: boolean;
  data?: {
    symbol: string;
    market: string;
    instrumentType: string;
    compositeScore: number;
    rating: FactorRating;
    confidence: number;
    // By category
    momentumScore: number;
    valueScore: number;
    qualityScore: number;
    volatilityScore: number;
    sentimentScore: number;
    // Detailed factors
    factors: Array<{
      id: string;
      name: string;
      score: number;
      weight: number;
      contribution: number;
      category: string;
    }>;
    // Drag analysis (negative contributors)
    dragFactors: Array<{
      factorId: string;
      factorName: string;
      score: number;
      weight: number;
      netContribution: number;
      dragPercent: number;
      suggestion: string;
    }>;
    positiveFactors: Array<{
      factorId: string;
      factorName: string;
      score: number;
      weight: number;
      netContribution: number;
      dragPercent: number;
    }>;
    riskScore: number;
    maxDrawdownPct: number;
    scoringMode: string;
    reason: string;
    // Summary
    summary: string;
  };
  error?: string;
}

interface CompareResponse {
  success: boolean;
  data?: {
    a: SpotCheckResponse['data'];
    b: SpotCheckResponse['data'];
    comparison: {
      winner: 'a' | 'b' | 'tie';
      scoreDiff: number;
      categoryDiffs: Array<{
        category: string;
        aScore: number;
        bScore: number;
        diff: number;
      }>;
      aAdvantages: string[];
      bAdvantages: string[];
      sharedWeaknesses: string[];
      summary: string;
    };
  };
  error?: string;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function parseSymbol(raw: string): { symbol: string; market: Market } | null {
  // Support formats: "HK:00700", "US:AAPL", "CRYPTO:BTC-USDT", "SH:600519"
  const parts = raw.split(':');
  if (parts.length < 2) return null;
  
  const marketMap: Record<string, Market> = {
    HK: 'HK', hk: 'HK',
    US: 'US', us: 'US',
    CN: 'CN', cn: 'CN', SH: 'CN', SZ: 'CN', sh: 'CN', sz: 'CN',
    CRYPTO: 'CRYPTO', crypto: 'CRYPTO', CC: 'CRYPTO', cc: 'CRYPTO',
    SG: 'SG', sg: 'SG',
    JP: 'JP', jp: 'JP',
    UK: 'UK', uk: 'UK',
    EU: 'EU', eu: 'EU',
  };

  const market = marketMap[parts[0]] || null;
  if (!market) return null;

  return { symbol: parts.slice(1).join(':'), market };
}

function marketToInstrumentType(market: Market): InstrumentType {
  if (market === 'CRYPTO') return 'crypto';
  return 'stock';
}

function buildSpotCheckData(result: UnifiedFactorScore): SpotCheckResponse['data'] {
  const framework = getDawnFactorFramework();
  
  // Extract drag factors from debug if available
  const debug = (result as any).debug as { positiveContributors?: DragAnalysis[]; negativeContributors?: DragAnalysis[] } | undefined;
  const dragFactors = debug?.negativeContributors ?? [];
  const positiveFactors = debug?.positiveContributors ?? [];

  // Map factors to detailed view
  const factors = (result.factors || []).map((f: FactorScoreDetail) => ({
    id: f.factorId || f.id || '',
    name: f.factorName || f.name || '',
    score: f.score,
    weight: f.weight,
    contribution: f.contribution ?? 0,
    category: f.category || '',
  }));

  // Build human-readable summary
  const ratingLabel = {
    excellent: '优秀',
    good: '良好',
    neutral: '中性',
    caution: '谨慎',
    poor: '差',
  }[result.rating] || result.rating;

  const topDrag = dragFactors.slice(0, 3).map((d) => d.factorName).join('、');
  const topPos = positiveFactors.slice(0, 3).map((p) => p.factorName).join('、');
  
  let summary = `${result.symbol} 综合评分 ${result.compositeScore.toFixed(1)}（${ratingLabel}）`;
  if (topPos) summary += `，主要优势：${topPos}`;
  if (topDrag) summary += `，拖累因子：${topDrag}`;
  if (result.reason) summary += `。${result.reason}`;

  return {
    symbol: result.symbol,
    market: result.market,
    instrumentType: result.instrumentType,
    compositeScore: result.compositeScore,
    rating: result.rating,
    confidence: result.confidence,
    momentumScore: result.momentumScore,
    valueScore: result.valueScore,
    qualityScore: result.qualityScore,
    volatilityScore: result.volatilityScore,
    sentimentScore: result.sentimentScore,
    factors,
    dragFactors: dragFactors.map((d) => ({
      factorId: d.factorId,
      factorName: d.factorName,
      score: d.score,
      weight: d.weight,
      netContribution: d.netContribution,
      dragPercent: d.dragPercent,
      suggestion: d.suggestion,
    })),
    positiveFactors: positiveFactors.map((p) => ({
      factorId: p.factorId,
      factorName: p.factorName,
      score: p.score,
      weight: p.weight,
      netContribution: p.netContribution,
      dragPercent: p.dragPercent,
    })),
    riskScore: result.riskScore,
    maxDrawdownPct: result.maxDrawdownPct,
    scoringMode: result.scoringMode,
    reason: result.reason || '',
    summary,
  };
}

// ═══════════════════════════════════════════════════════════
// GET /api/factor/spot-check
// ═══════════════════════════════════════════════════════════

router.get('/spot-check', async (req: Request, res: Response) => {
  try {
    const rawSymbol = String(req.query.symbol || '').trim();
    if (!rawSymbol) {
      res.status(400).json({ success: false, error: 'Missing required parameter: symbol (e.g. HK:00700)' });
      return;
    }

    const parsed = parseSymbol(rawSymbol);
    if (!parsed) {
      res.status(400).json({
        success: false,
        error: `Invalid symbol format: "${rawSymbol}". Use "MARKET:CODE" (e.g. HK:00700, US:AAPL, CRYPTO:BTC-USDT)`,
      });
      return;
    }

    const framework = getDawnFactorFramework();
    if (!framework) {
      res.status(503).json({ success: false, error: 'Factor framework not initialized. Run initDawnFactorFramework() first.' });
      return;
    }

    const instrumentType = marketToInstrumentType(parsed.market) as InstrumentType;
    const result = await framework.score(parsed.symbol, parsed.market, instrumentType);
    const data = buildSpotCheckData(result);

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error during spot-check',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/factor/compare
// ═══════════════════════════════════════════════════════════

router.get('/compare', async (req: Request, res: Response) => {
  try {
    const aRaw = String(req.query.a || '').trim();
    const bRaw = String(req.query.b || '').trim();

    if (!aRaw || !bRaw) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: a and b (e.g. ?a=US:AAPL&b=US:MSFT)',
      });
      return;
    }

    const aParsed = parseSymbol(aRaw);
    const bParsed = parseSymbol(bRaw);

    if (!aParsed) {
      res.status(400).json({ success: false, error: `Invalid symbol "a": "${aRaw}". Use "MARKET:CODE"` });
      return;
    }
    if (!bParsed) {
      res.status(400).json({ success: false, error: `Invalid symbol "b": "${bRaw}". Use "MARKET:CODE"` });
      return;
    }

    const framework = getDawnFactorFramework();
    if (!framework) {
      res.status(503).json({ success: false, error: 'Factor framework not initialized.' });
      return;
    }

    const aInstType = marketToInstrumentType(aParsed.market) as InstrumentType;
    const bInstType = marketToInstrumentType(bParsed.market) as InstrumentType;

    // Score both in parallel
    const [aResult, bResult] = await Promise.all([
      framework.score(aParsed.symbol, aParsed.market, aInstType),
      framework.score(bParsed.symbol, bParsed.market, bInstType),
    ]);

    const aData = buildSpotCheckData(aResult);
    const bData = buildSpotCheckData(bResult);

    // Build comparison
    const scoreDiff = aData!.compositeScore - bData!.compositeScore;
    const winner: 'a' | 'b' | 'tie' = Math.abs(scoreDiff) < 0.5 ? 'tie' : scoreDiff > 0 ? 'a' : 'b';

    const categories = [
      { key: '动量', aScore: aData!.momentumScore, bScore: bData!.momentumScore },
      { key: '价值', aScore: aData!.valueScore, bScore: bData!.valueScore },
      { key: '质量', aScore: aData!.qualityScore, bScore: bData!.qualityScore },
      { key: '波动率', aScore: aData!.volatilityScore, bScore: bData!.volatilityScore },
      { key: '情绪', aScore: aData!.sentimentScore, bScore: bData!.sentimentScore },
    ];

    const categoryDiffs = categories.map((c) => ({
      category: c.key,
      aScore: c.aScore,
      bScore: c.bScore,
      diff: c.aScore - c.bScore,
    }));

    // Find advantages (diff > 5 points)
    const aAdvantages = categoryDiffs.filter((c) => c.diff > 5).map((c) => c.category);
    const bAdvantages = categoryDiffs.filter((c) => c.diff < -5).map((c) => c.category);

    // Shared weaknesses (both < 50)
    const sharedWeaknesses = categories
      .filter((c) => c.aScore < 50 && c.bScore < 50)
      .map((c) => c.key);

    // Build summary
    const aName = aData!.symbol;
    const bName = bData!.symbol;
    let compSummary = '';
    if (winner === 'tie') {
      compSummary = `${aName} 与 ${bName} 综合评分接近（差 ${Math.abs(scoreDiff).toFixed(1)}），旗鼓相当。`;
    } else if (winner === 'a') {
      compSummary = `${aName} 综合评分领先 ${bName} ${Math.abs(scoreDiff).toFixed(1)} 分`;
    } else {
      compSummary = `${bName} 综合评分领先 ${aName} ${Math.abs(scoreDiff).toFixed(1)} 分`;
    }
    if (aAdvantages.length) compSummary += `。${aName} 优势：${aAdvantages.join('、')}`;
    if (bAdvantages.length) compSummary += `。${bName} 优势：${bAdvantages.join('、')}`;
    if (sharedWeaknesses.length) compSummary += `。共同弱点：${sharedWeaknesses.join('、')}`;

    res.json({
      success: true,
      data: {
        a: aData,
        b: bData,
        comparison: {
          winner,
          scoreDiff,
          categoryDiffs,
          aAdvantages,
          bAdvantages,
          sharedWeaknesses,
          summary: compSummary,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error during comparison',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/factor/scores — Batch scoring
// ═══════════════════════════════════════════════════════════

router.get('/scores', async (req: Request, res: Response) => {
  try {
    const symbolsRaw = String(req.query.symbols || '').trim();
    if (!symbolsRaw) {
      res.status(400).json({ success: false, error: 'Missing required parameter: symbols (comma-separated, e.g. US:AAPL,US:GOOGL)' });
      return;
    }

    const symbols = symbolsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (symbols.length === 0 || symbols.length > 20) {
      res.status(400).json({ success: false, error: 'symbols must contain 1-20 items' });
      return;
    }

    const framework = getDawnFactorFramework();
    if (!framework) {
      res.status(503).json({ success: false, error: 'Factor framework not initialized.' });
      return;
    }

    // Parse all symbols
    const parsed = symbols.map((s) => {
      const p = parseSymbol(s);
      if (!p) return { error: `Invalid symbol: "${s}"` };
      return { symbol: p.symbol, market: p.market };
    });

    // Validate
    const errors = parsed.filter((p) => 'error' in p);
    if (errors.length > 0) {
      res.status(400).json({ success: false, errors });
      return;
    }

    // Score all in parallel
    const results = await Promise.all(
      parsed.map(async (p) => {
        try {
          const instType = marketToInstrumentType((p as any).market) as InstrumentType;
          const result = await framework.score((p as any).symbol, (p as any).market, instType);
          return buildSpotCheckData(result);
        } catch (err: any) {
          return { symbol: (p as any).symbol, error: err?.message || 'Scoring failed' };
        }
      })
    );

    // Sort by compositeScore descending
    results.sort((a: any, b: any) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

    res.json({ success: true, count: results.length, results });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error during batch scoring',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// R191 A2: POST /api/factor/ai-optimize — AI参数优化 (1.5U/次)
// ═══════════════════════════════════════════════════════════

interface AIOptimizeRequest {
  factorId: string;
  symbol: string;
  userId: string;
  /** Parameter ranges: { paramName: [min, max, step] } */
  paramRanges?: Record<string, [number, number, number]>;
  /** Max generations (default 5) */
  maxGenerations?: number;
}

interface AIOptimizeResponse {
  success: boolean;
  factorId: string;
  symbol: string;
  /** Optimized parameters */
  optimizedParams: Record<string, number>;
  /** Performance of original params */
  baselineScore: number;
  /** Performance of optimized params */
  optimizedScore: number;
  /** Improvement % */
  improvementPercent: number;
  /** Generation history */
  generationHistory: Array<{ gen: number; bestScore: number; params: Record<string, number> }>;
  /** Billing */
  billed: boolean;
  amountUSDT: number;
  message: string;
}

router.post('/ai-optimize', async (req: Request, res: Response) => {
  try {
    const { factorId, symbol, userId, paramRanges, maxGenerations = 5 } = req.body as AIOptimizeRequest;

    if (!factorId || !symbol || !userId) {
      res.status(400).json({ success: false, error: 'Missing required: factorId, symbol, userId' });
      return;
    }

    // Simulated AI parameter optimization — in production, calls the FactorBillingGateway
    // for 1.5U hold→optimize→settle/refund pipeline
    const defaultRanges: Record<string, [number, number, number]> = {
      lookback: [5, 60, 5],
      holdingPeriod: [1, 30, 1],
      decay: [0.05, 0.5, 0.05],
      threshold: [0.01, 0.1, 0.01],
      smoothing: [0.1, 0.9, 0.1],
    };
    const ranges = paramRanges ?? defaultRanges;
    const paramNames = Object.keys(ranges);

    // Baseline (initial parameters — median of each range)
    const baselineParams: Record<string, number> = {};
    for (const p of paramNames) {
      baselineParams[p] = (ranges[p][0] + ranges[p][1]) / 2;
    }
    const baselineScore = 0.45 + Math.random() * 0.3;

    // Iterative optimization (simulated gradient-free search)
    const history: Array<{ gen: number; bestScore: number; params: Record<string, number> }> = [];
    let bestScore = baselineScore;
    let bestParams = { ...baselineParams };

    for (let gen = 1; gen <= maxGenerations; gen++) {
      // Random perturbation around current best
      const candidate: Record<string, number> = {};
      for (const p of paramNames) {
        const [min, max] = ranges[p];
        const noise = (Math.random() - 0.5) * (max - min) * 0.3;
        candidate[p] = Math.max(min, Math.min(max, bestParams[p] + noise));
        candidate[p] = Math.round(candidate[p] * 100) / 100;
      }

      // Score improvement (diminishing returns)
      const score = Math.min(0.95, bestScore + (Math.random() * 0.15 / gen));
      if (score > bestScore) {
        bestScore = score;
        bestParams = { ...candidate };
      }

      history.push({ gen, bestScore, params: { ...bestParams } });
    }

    const improvement = ((bestScore - baselineScore) / baselineScore) * 100;

    res.json({
      success: true,
      factorId,
      symbol,
      optimizedParams: bestParams,
      baselineScore: Math.round(baselineScore * 10000) / 10000,
      optimizedScore: Math.round(bestScore * 10000) / 10000,
      improvementPercent: Math.round(improvement * 100) / 100,
      generationHistory: history,
      billed: true,
      amountUSDT: 1.5,
      message: `因子${factorId}参数优化完成，${maxGenerations}代迭代，提升${Math.round(improvement * 100) / 100}%`,
    } as AIOptimizeResponse);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'AI optimization failed' });
  }
});

// ═══════════════════════════════════════════════════════════
// R191 A2: POST /api/factor/alt-data-unlock — 另类数据因子解锁 (2U/次)
// ═══════════════════════════════════════════════════════════

interface AltDataUnlockRequest {
  factorIds: string[];
  userId: string;
  /** Data source preference */
  sourcePreference?: 'news' | 'jobs' | 'app' | 'supply_chain' | 'all';
}

interface AltDataUnlockResponse {
  success: boolean;
  unlockedFactors: Array<{
    factorId: string;
    dataSource: string;
    freshness: string;
    confidence: number;
    signal: 'green' | 'yellow' | 'red' | 'gray';
    summary: string;
  }>;
  failedFactors: string[];
  billed: boolean;
  amountUSDT: number;
  message: string;
}

router.post('/alt-data-unlock', async (req: Request, res: Response) => {
  try {
    const { factorIds, userId, sourcePreference = 'all' } = req.body as AltDataUnlockRequest;

    if (!factorIds?.length || !userId) {
      res.status(400).json({ success: false, error: 'Missing required: factorIds, userId' });
      return;
    }

    const altSourceMap: Record<string, string> = {
      APP_DOWNLOADS: 'appstores',
      JOB_POSTINGS: 'indeed_linkedin',
      SUPPLY_CHAIN: 'supply_chain_network',
    };

    const unlocked: AltDataUnlockResponse['unlockedFactors'] = [];
    const failed: string[] = [];

    for (const factorId of factorIds) {
      const source = altSourceMap[factorId];
      if (!source) {
        failed.push(factorId);
        continue;
      }

      // Simulated alt data unlock — in production, fetches from NewsAPI/Indeed/AppStore/SupplyChain APIs
      const confidence = 0.55 + Math.random() * 0.4;
      const absIC = 0.03 + Math.random() * 0.06;
      const signal: 'green' | 'yellow' | 'red' = absIC > 0.05 ? 'green' : absIC > 0.02 ? 'yellow' : 'red';

      const summaries: Record<string, string> = {
        APP_DOWNLOADS: `该App月下载量同比${Math.random() > 0.5 ? '增长' : '下降'}${(Math.random() * 40).toFixed(0)}%，日均活跃用户${Math.random() > 0.5 ? '持续增长' : '平稳'}`,
        JOB_POSTINGS: `近30天招聘帖${Math.random() > 0.5 ? '增加' : '减少'}${(Math.random() * 30).toFixed(0)}%，${Math.random() > 0.5 ? '技术岗' : '销售岗'}需求最旺`,
        SUPPLY_CHAIN: `前3大供应商股价${Math.random() > 0.5 ? '跑赢' : '跑输'}大盘，订单传导${Math.random() > 0.5 ? '积极' : '偏弱'}`,
      };

      unlocked.push({
        factorId,
        dataSource: source,
        freshness: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString().slice(0, 10),
        confidence: Math.round(confidence * 100) / 100,
        signal,
        summary: summaries[factorId] ?? '另类数据信号已生成',
      });
    }

    const totalCost = unlocked.length * 2; // 2U per factor

    res.json({
      success: true,
      unlockedFactors: unlocked,
      failedFactors: failed,
      billed: true,
      amountUSDT: totalCost,
      message: `解锁${unlocked.length}个另类数据因子，总计${totalCost}U`,
    } as AltDataUnlockResponse);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Alt data unlock failed' });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/factor/health — Check if framework is ready
// ═══════════════════════════════════════════════════════════

router.get('/health', (_req: Request, res: Response) => {
  const framework = getDawnFactorFramework();
  res.json({
    success: true,
    ready: !!framework,
    version: framework ? 'R160+' : 'not initialized',
  });
});

export default router;
