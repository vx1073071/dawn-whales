/**
 * DAWN WHALES R163 P1-X3 — Factor Spot-Check + Compare API
 *
 * Endpoints:
 *   GET  /api/factor/spot-check?symbol=HK:00700    — Full factor scores + drag factors
 *   GET  /api/factor/compare?a=HK:00700&b=HK:09988 — Side-by-side diff
 *   POST /api/factor/batch-spot-check               — Batch spot-check (body: {symbols: [...]})
 *
 * ≥200L
 */

import { Router, Request, Response } from 'express';
import {
  getDawnFactorFramework,
  type UnifiedFactorScore,
  type FactorScoreDetail,
  type Market,
  type InstrumentType,
} from '../../electron/engine/factors/dawn-factor-framework';
import { getFactorCompatibilityEngine } from '../../electron/engine/factors/factor-compatibility-engine';
import log from 'electron-log';

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse "HK:00700" → { market: "HKEX", symbol: "00700" }
 */
function parseQualifiedSymbol(qualified: string): { market: Market; symbol: string; instrumentType: InstrumentType } | null {
  const parts = qualified.split(':');
  if (parts.length < 2) return null;

  const prefix = parts[0].toUpperCase();
  const symbol = parts.slice(1).join(':');

  const marketMap: Record<string, Market> = {
    HK: 'HKEX', HKEX: 'HKEX',
    US: 'NYSE', NYSE: 'NYSE', NASDAQ: 'NASDAQ',
    SG: 'SGX', SGX: 'SGX',
    CRYPTO: 'CRYPTO', CRYP: 'CRYPTO', CC: 'CRYPTO',
    JP: 'TSE', TSE: 'TSE',
  };

  const market = marketMap[prefix] || 'NYSE';

  // Infer instrument type from prefix/symbol
  let instrumentType: InstrumentType = 'stock';
  if (prefix === 'CRYPTO' || prefix === 'CRYP' || prefix === 'CC') {
    instrumentType = symbol.includes('PERP') || symbol.includes('USD') ? 'crypto_perp' : 'crypto_spot';
  }

  return { market, symbol, instrumentType };
}

/**
 * Format symbol for display: "HKEX:00700"
 */
function formatDisplaySymbol(market: Market, symbol: string): string {
  const labelMap: Record<string, string> = {
    HKEX: 'HK', NYSE: 'US', NASDAQ: 'US', SGX: 'SG',
    CRYPTO: 'CC', TSE: 'JP', TSX: 'CA', ASX: 'AU',
  };
  return `${labelMap[market] || market}:${symbol}`;
}

// ── Drag Factor Detection ──────────────────────────────────────────────────

interface DragFactorInfo {
  factorId: string;
  factorName: string;
  category: string;
  score: number;
  contribution: number;
  severity: 'mild' | 'moderate' | 'severe';
  suggestion: string;
}

function detectDragFactors(
  factors: FactorScoreDetail[],
  compositeScore: number
): DragFactorInfo[] {
  const dragFactors: DragFactorInfo[] = [];

  for (const f of factors) {
    // A factor is "dragging" if its contribution is notably below the average
    if (factors.length === 0) break;

    const avgContribution = factors.reduce((s, x) => s + x.contribution, 0) / factors.length;

    // Factor is dragging if score < 40 AND contribution > 0 but well below average
    // OR if contribution is negative (detrimental)
    const isDetrimental = f.contribution < 0;
    const isWeak = f.score < 40 && f.contribution < avgContribution * 0.5;

    if (isDetrimental || isWeak) {
      let severity: DragFactorInfo['severity'] = 'mild';
      let suggestion = '';

      if (isDetrimental) {
        severity = 'severe';
        suggestion = `因子 "${f.factorId}" 产生负面贡献 ${Math.abs(f.contribution).toFixed(1)}%，建议降低权重或移除`;
      } else if (f.score < 30) {
        severity = 'moderate';
        suggestion = `因子 "${f.factorId}" 得分较低 (${f.score})，建议检查数据源或降低权重`;
      } else {
        suggestion = `因子 "${f.factorId}" 表现偏弱，可考虑调整为中性权重`;
      }

      dragFactors.push({
        factorId: f.factorId,
        factorName: f.factorName,
        category: f.factorCategory,
        score: f.score,
        contribution: f.contribution,
        severity,
        suggestion,
      });
    }
  }

  // Sort most severe first, then by lowest contribution
  dragFactors.sort((a, b) => {
    const sevOrder = { severe: 0, moderate: 1, mild: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return a.contribution - b.contribution;
  });

  return dragFactors;
}

// ═════════════════════════════════════════════════════════════════════════
// GET /api/factor/spot-check — Single-stock full factor scoring
// ═════════════════════════════════════════════════════════════════════════

router.get('/spot-check', async (req: Request, res: Response) => {
  try {
    const rawSymbol = String(req.query.symbol || '').trim();
    if (!rawSymbol) {
      res.status(400).json({ success: false, error: 'Missing query parameter "symbol" (e.g. "HK:00700")' });
      return;
    }

    const parsed = parseQualifiedSymbol(rawSymbol);
    if (!parsed) {
      res.status(400).json({
        success: false,
        error: `Invalid symbol format "${rawSymbol}". Use "MARKET:CODE" (e.g. "HK:00700", "US:AAPL", "CRYPTO:BTC")`,
      });
      return;
    }

    const { market, symbol, instrumentType } = parsed;
    const framework = getDawnFactorFramework();

    if (!framework) {
      res.status(503).json({ success: false, error: 'Factor framework not initialized' });
      return;
    }

    const score = await framework.score(symbol, market, instrumentType);
    const dragFactors = detectDragFactors(score.factors, score.compositeScore);

    log.info(`[FactorAPI] Spot-check: ${rawSymbol} → ${score.compositeScore.toFixed(1)} (${score.rating}), ${dragFactors.length} drag factors`);

    res.json({
      success: true,
      symbol: formatDisplaySymbol(market, symbol),
      rawSymbol,
      market,
      instrumentType,
      compositeScore: score.compositeScore,
      rating: score.rating,
      confidence: score.confidence,
      // Category scores
      categoryScores: {
        momentum: score.momentumScore,
        value: score.valueScore,
        quality: score.qualityScore,
        volatility: score.volatilityScore,
        sentiment: score.sentimentScore,
      },
      riskScore: score.riskScore,
      // All factor details
      factors: score.factors.map(f => ({
        factorId: f.factorId,
        factorName: f.factorName,
        category: f.factorCategory,
        score: f.score,
        weight: f.weight,
        contribution: f.contribution,
        icValue: f.icValue,
        percentile: f.percentile,
      })),
      // Drag factors (contribution < 0 or score < 40)
      dragFactors,
      scoringMode: score.scoringMode,
      reason: score.reason,
      calculatedAt: score.calculatedAt,
    });
  } catch (err: unknown) {
    log.error('[FactorAPI] Spot-check failed:', err);
    res.status(500).json({ success: false, error: (err as Error).message || 'Internal server error' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/factor/compare — Two-stock side-by-side comparison
// ═════════════════════════════════════════════════════════════════════════

router.get('/compare', async (req: Request, res: Response) => {
  try {
    const rawA = String(req.query.a || '').trim();
    const rawB = String(req.query.b || '').trim();

    if (!rawA || !rawB) {
      res.status(400).json({ success: false, error: 'Missing query parameters "a" and "b" (e.g. "?a=HK:00700&b=HK:09988")' });
      return;
    }

    const parsedA = parseQualifiedSymbol(rawA);
    const parsedB = parseQualifiedSymbol(rawB);

    if (!parsedA) {
      res.status(400).json({ success: false, error: `Invalid symbol "a": "${rawA}"` });
      return;
    }
    if (!parsedB) {
      res.status(400).json({ success: false, error: `Invalid symbol "b": "${rawB}"` });
      return;
    }

    const framework = getDawnFactorFramework();
    if (!framework) {
      res.status(503).json({ success: false, error: 'Factor framework not initialized' });
      return;
    }

    // Score both in parallel
    const [scoreA, scoreB] = await Promise.all([
      framework.score(parsedA.symbol, parsedA.market, parsedA.instrumentType),
      framework.score(parsedB.symbol, parsedB.market, parsedB.instrumentType),
    ]);

    const dragFactorsA = detectDragFactors(scoreA.factors, scoreA.compositeScore);
    const dragFactorsB = detectDragFactors(scoreB.factors, scoreB.compositeScore);

    // Build factor comparison table
    const allFactorIds = new Set([
      ...scoreA.factors.map(f => f.factorId),
      ...scoreB.factors.map(f => f.factorId),
    ]);

    const factorComparison: Array<{
      factorId: string;
      factorName: string;
      category: string;
      scoreA: number;
      scoreB: number;
      diff: number;
      winner: 'a' | 'b' | 'tie';
    }> = [];

    for (const fid of allFactorIds) {
      const fa = scoreA.factors.find(f => f.factorId === fid);
      const fb = scoreB.factors.find(f => f.factorId === fid);

      const scoreAVal = fa?.score ?? 50;
      const scoreBVal = fb?.score ?? 50;
      const diff = scoreAVal - scoreBVal;

      factorComparison.push({
        factorId: fid,
        factorName: fa?.factorName || fb?.factorName || fid,
        category: fa?.factorCategory || fb?.factorCategory || 'unknown',
        scoreA: scoreAVal,
        scoreB: scoreBVal,
        diff: Math.round(diff * 100) / 100,
        winner: Math.abs(diff) < 1 ? 'tie' : diff > 0 ? 'a' : 'b',
      });
    }

    // Sort by largest absolute diff
    factorComparison.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));

    // Summary
    const compositeDiff = scoreA.compositeScore - scoreB.compositeScore;
    const winner: 'a' | 'b' | 'tie' = Math.abs(compositeDiff) < 1 ? 'tie' : compositeDiff > 0 ? 'a' : 'b';

    const summary = winner === 'tie'
      ? `${rawA} 与 ${rawB} 综合评分相近 (差距 ${Math.abs(compositeDiff).toFixed(1)})`
      : winner === 'a'
        ? `${rawA} 综合评分领先 ${rawB} ${compositeDiff.toFixed(1)} 分`
        : `${rawB} 综合评分领先 ${rawA} ${Math.abs(compositeDiff).toFixed(1)} 分`;

    // Find largest advantage factors
    const topAdvA = factorComparison
      .filter(f => f.winner === 'a')
      .sort((x, y) => y.diff - x.diff)
      .slice(0, 3);

    const topAdvB = factorComparison
      .filter(f => f.winner === 'b')
      .sort((x, y) => x.diff - y.diff)
      .slice(0, 3);

    log.info(`[FactorAPI] Compare: ${rawA} vs ${rawB} → composite diff ${compositeDiff.toFixed(1)}, winner ${winner}`);

    res.json({
      success: true,
      symbolA: formatDisplaySymbol(parsedA.market, parsedA.symbol),
      symbolB: formatDisplaySymbol(parsedB.market, parsedB.symbol),
      rawA,
      rawB,

      // Composite comparison
      compositeDiff: Math.round(compositeDiff * 100) / 100,
      winner,
      summary,

      // Side-by-side
      scoreA: {
        symbol: rawA,
        compositeScore: scoreA.compositeScore,
        rating: scoreA.rating,
        momentumScore: scoreA.momentumScore,
        valueScore: scoreA.valueScore,
        qualityScore: scoreA.qualityScore,
        volatilityScore: scoreA.volatilityScore,
        sentimentScore: scoreA.sentimentScore,
        riskScore: scoreA.riskScore,
        dragFactors: dragFactorsA,
        reason: scoreA.reason,
      },
      scoreB: {
        symbol: rawB,
        compositeScore: scoreB.compositeScore,
        rating: scoreB.rating,
        momentumScore: scoreB.momentumScore,
        valueScore: scoreB.valueScore,
        qualityScore: scoreB.qualityScore,
        volatilityScore: scoreB.volatilityScore,
        sentimentScore: scoreB.sentimentScore,
        riskScore: scoreB.riskScore,
        dragFactors: dragFactorsB,
        reason: scoreB.reason,
      },

      // Factor-level comparison
      factorComparison,
      advantagesA: topAdvA.map(f => ({ factorId: f.factorId, factorName: f.factorName, advantage: f.diff })),
      advantagesB: topAdvB.map(f => ({ factorId: f.factorId, factorName: f.factorName, advantage: Math.abs(f.diff) })),

      calculatedAt: Date.now(),
    });
  } catch (err: unknown) {
    log.error('[FactorAPI] Compare failed:', err);
    res.status(500).json({ success: false, error: (err as Error).message || 'Internal server error' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/factor/batch-spot-check — Batch scoring
// ═════════════════════════════════════════════════════════════════════════

router.post('/batch-spot-check', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      res.status(400).json({ success: false, error: 'Missing or empty "symbols" array in body' });
      return;
    }

    if (symbols.length > 50) {
      res.status(400).json({ success: false, error: 'Batch limit is 50 symbols' });
      return;
    }

    const parsed = symbols
      .map((s: string) => ({ raw: s, parsed: parseQualifiedSymbol(String(s).trim()) }))
      .filter((x: { parsed: null | ReturnType<typeof parseQualifiedSymbol> }) => x.parsed !== null);

    if (parsed.length === 0) {
      res.status(400).json({ success: false, error: 'No valid symbols found' });
      return;
    }

    const framework = getDawnFactorFramework();
    if (!framework) {
      res.status(503).json({ success: false, error: 'Factor framework not initialized' });
      return;
    }

    const results = await Promise.all(
      parsed.map(async (p: { raw: string; parsed: NonNullable<ReturnType<typeof parseQualifiedSymbol>> }) => {
        const score = await framework.score(p.parsed.symbol, p.parsed.market, p.parsed.instrumentType);
        return {
          symbol: p.raw,
          compositeScore: score.compositeScore,
          rating: score.rating,
          dragFactors: detectDragFactors(score.factors, score.compositeScore).slice(0, 5),
        };
      })
    );

    results.sort((a, b) => b.compositeScore - a.compositeScore);

    log.info(`[FactorAPI] Batch spot-check: ${symbols.length} requested → ${results.length} scored`);

    res.json({
      success: true,
      total: symbols.length,
      scored: results.length,
      results,
      calculatedAt: Date.now(),
    });
  } catch (err: unknown) {
    log.error('[FactorAPI] Batch spot-check failed:', err);
    res.status(500).json({ success: false, error: (err as Error).message || 'Internal server error' });
  }
});

export default router;
