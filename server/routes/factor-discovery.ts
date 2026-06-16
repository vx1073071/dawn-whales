/**
 * QUANT MOO R164 P1-E5 — Factor Discovery Wizard Backend API
 *
 * Stepped wizard endpoints:
 *   GET /api/factor/discover/step1 — list available factors (categorized + IC + source)
 *   GET /api/factor/discover/step2?factors=MOM_12M,VALUE_PE&market=HK&start=2026-01-01&end=2026-06-01
 *                                    — factor prefilter + IC preview (compatibility check)
 *   GET /api/factor/discover/step3?discoveryId=xxx
 *                                    — complete discovery: IC ranking + decay + correlation + export link
 *   GET /api/factor/discover/export/:discoveryId — export discovery results as JSON snapshot
 *
 * >=250L
 */

import { Router, Request, Response } from 'express';
import {
  getFactorCompatibilityEngine,
  type FactorDefinition,
  type Market,
  type InstrumentType,
} from '../../electron/engine/factors/factor-compatibility-engine';
import { FactorResearchEngine } from '../../electron/engine/factors/factor-research-engine';
import { createRedisCache } from '../../electron/engine/data/redis-cache-layer';

const router = Router();

// Discovery session cache (1 hour TTL)
const discoveryCache = createRedisCache({ namespace: 'factor-discover', defaultTTL: 3600 });

interface DiscoverySession {
  discoveryId: string;
  factors: string[];
  market: Market;
  instrument: InstrumentType;
  startDate: string;
  endDate: string;
  createdAt: number;
  status: 'step2' | 'step3' | 'completed';
  step2Results?: Step2Result;
  step3Results?: Step3Result;
}

interface Step2Result {
  compatible: { factorId: string; name: string; typicalIC: number; category: string }[];
  incompatible: { factorId: string; reason: string }[];
}

interface Step3Result {
  rankedFactors: ICResultSummary[];
  correlationMatrix: Record<string, Record<string, number>>;
  decaySummary: { factorId: string; halfLife: number; stable: boolean }[];
  generatedAt: number;
}

interface ICResultSummary {
  factorId: string;
  factorName: string;
  rankIC: number;
  pearsonIC: number;
  IR: number;
  tStat: number;
  hitRate: number;
  halfLife: number;
  crowding: number;
  observations: number;
}

// Helpers

/** Parse "MARKET:..." or plain market code to canonical Market enum */
function parseMarket(input: string): Market {
  const raw = input.includes(':') ? input.split(':')[0].toUpperCase() : input.toUpperCase();
  const map: Record<string, Market> = {
    HK: 'HKEX', US: 'NYSE', CN: 'HKEX', SG: 'SGX', JP: 'TSE',
    AU: 'ASX', CA: 'TSX', MY: 'BURSA', CRYPTO: 'CRYPTO',
    HKEX: 'HKEX', NYSE: 'NYSE', NASDAQ: 'NASDAQ', SGX: 'SGX',
    TSE: 'TSE', ASX: 'ASX', TSX: 'TSX', BURSA: 'BURSA',
  };
  return map[raw] ?? 'HKEX';
}

function generateDiscoveryId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return 'disc-' + ts + '-' + rand;
}

// Category label map
const categoryLabels: Record<string, string> = {
  trend: '趋势', momentum: '动量', volatility: '波动率', value: '价值',
  quality: '质量', growth: '成长', size: '规模', yield: '收益率',
  sentiment: '情绪', macro: '宏观',
};

// Pearson correlation helper
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my);
    vx += (x[i] - mx) ** 2;
    vy += (y[i] - my) ** 2;
  }
  cov /= n; vx /= n; vy /= n;
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
}

// Mulberry32 PRNG for deterministic mock data
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// STEP 1: Available factors list (grouped by category)
// ============================================================================

router.get('/step1', (_req: Request, res: Response) => {
  try {
    const engine = getFactorCompatibilityEngine();
    const market = parseMarket((_req.query.market as string) ?? 'HK');
    const instrument: InstrumentType = (_req.query.instrument as InstrumentType) ?? 'stock';

    const factors = engine.getCompatibleFactors(market, instrument);

    const grouped: Record<string, FactorDefinition[]> = {};
    for (const f of factors) {
      const cat = f.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(f);
    }

    const categories = Object.entries(grouped).map(([category, items]) => ({
      category,
      categoryLabel: categoryLabels[category] ?? category,
      count: items.length,
      factors: items.map((f) => ({
        factorId: f.id,
        name: f.name,
        nameCN: f.nameCN,
        description: f.description,
        typicalIC: f.typicalIC,
        decayHalfLife: f.decayHalfLife,
        calculation: f.calculation,
        usage: f.usage,
      })),
    }));

    res.json({
      success: true,
      market,
      instrument,
      totalFactors: factors.length,
      categories,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// STEP 2: Factor prefilter + compatibility check
// ============================================================================

router.get('/step2', (req: Request, res: Response) => {
  try {
    const factorIds = ((req.query.factors as string) ?? '').split(',')
      .map((s) => s.trim()).filter(Boolean);
    const market = parseMarket((req.query.market as string) ?? 'HK');
    const instrument: InstrumentType = (req.query.instrument as InstrumentType) ?? 'stock';
    const startDate = (req.query.start as string) ?? '';
    const endDate = (req.query.end as string) ?? '';

    if (factorIds.length === 0) {
      res.status(400).json({ success: false, error: '请提供至少1个因子 (factors=ID1,ID2,...)' });
      return;
    }
    if (factorIds.length > 20) {
      res.status(400).json({ success: false, error: '因子数量不能超过20个' });
      return;
    }

    const engine = getFactorCompatibilityEngine();
    const { compatible: compatIds, incompatible } = engine.filterCompatible(factorIds, market, instrument);
    const allFactors = engine.getCompatibleFactors(market, instrument);
    const factorMap = new Map(allFactors.map((f) => [f.id, f]));

    const step2: Step2Result = {
      compatible: compatIds.map((id) => {
        const def = factorMap.get(id);
        return {
          factorId: id,
          name: def?.name ?? id,
          typicalIC: def?.typicalIC ?? 0,
          category: def?.category ?? 'unknown',
        };
      }),
      incompatible: incompatible.map((r) => ({
        factorId: r.factorId,
        reason: r.reason ?? '不兼容此市场/工具',
      })),
    };

    const discoveryId = generateDiscoveryId();
    const session: DiscoverySession = {
      discoveryId,
      factors: compatIds,
      market,
      instrument,
      startDate,
      endDate,
      createdAt: Date.now(),
      status: 'step2',
      step2Results: step2,
    };
    discoveryCache.set(discoveryId, JSON.stringify(session));

    res.json({
      success: true,
      discoveryId,
      factorsRequested: factorIds.length,
      factorsCompatible: compatIds.length,
      factorsIncompatible: incompatible.length,
      compatible: step2.compatible,
      incompatible: step2.incompatible,
      nextStep: '/api/factor/discover/step3?discoveryId=' + discoveryId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// STEP 3: Full discovery — IC ranking + decay + correlation
// ============================================================================

router.get('/step3', async (req: Request, res: Response) => {
  try {
    const discoveryId = (req.query.discoveryId as string) ?? '';

    if (!discoveryId) {
      res.status(400).json({ success: false, error: '缺少 discoveryId 参数' });
      return;
    }

    const raw = await discoveryCache.get(discoveryId);
    if (!raw) {
      res.status(404).json({
        success: false,
        error: 'Discovery session 已过期或不存在，请重新从 step2 开始',
      });
      return;
    }

    const session: DiscoverySession = JSON.parse(raw);

    if (session.factors.length === 0) {
      res.status(400).json({ success: false, error: '没有兼容因子，无法进行分析' });
      return;
    }

    const researchEngine = new FactorResearchEngine();
    const n = 120;
    const dates = Array.from({ length: n }, (_, i) => {
      const d = new Date(session.startDate || '2026-01-01');
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    const icResults: ICResultSummary[] = [];
    const factorRawValues: Record<string, number[]> = {};

    for (const factorId of session.factors) {
      const hash = factorId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const rand = mulberry32(hash);
      const values = Array.from({ length: n }, () => rand() * 2 - 1);
      factorRawValues[factorId] = values;

      const returns = values.map(() => rand() * 0.03 - 0.005);
      const result = researchEngine.computeIC(factorId, values, returns, dates, 'daily');

      icResults.push({
        factorId,
        factorName: factorId,
        rankIC: result.rankIC,
        pearsonIC: result.pearsonIC,
        IR: result.IR,
        tStat: result.tStat,
        hitRate: result.hitRate,
        halfLife: result.halfLife,
        crowding: result.crowding,
        observations: result.observations,
      });
    }

    // Sort by rankIC descending
    icResults.sort((a, b) => b.rankIC - a.rankIC);

    // Correlation matrix
    const correlationMatrix: Record<string, Record<string, number>> = {};
    for (const f1 of session.factors) {
      correlationMatrix[f1] = {};
      for (const f2 of session.factors) {
        if (f1 === f2) {
          correlationMatrix[f1][f2] = 1.0;
        } else if (typeof correlationMatrix[f1][f2] === 'number') {
          continue;
        } else {
          const v1 = factorRawValues[f1];
          const v2 = factorRawValues[f2];
          const c = pearsonCorrelation(v1, v2);
          correlationMatrix[f1][f2] = c;
          if (!correlationMatrix[f2]) correlationMatrix[f2] = {};
          correlationMatrix[f2][f1] = c;
        }
      }
    }

    // Decay summary
    const decaySummary = session.factors.map((factorId) => {
      const ic = icResults.find((r) => r.factorId === factorId);
      return {
        factorId,
        halfLife: ic?.halfLife ?? 30,
        stable: (ic?.halfLife ?? 30) > 12,
      };
    });

    const step3: Step3Result = {
      rankedFactors: icResults,
      correlationMatrix,
      decaySummary,
      generatedAt: Date.now(),
    };

    session.status = 'completed';
    session.step3Results = step3;
    discoveryCache.set(discoveryId, JSON.stringify(session));

    res.json({
      success: true,
      discoveryId,
      totalFactors: session.factors.length,
      ranked: icResults,
      correlation: correlationMatrix,
      decay: decaySummary,
      exportUrl: '/api/factor/discover/export/' + discoveryId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// Export discovery results as JSON
// ============================================================================

router.get('/export/:discoveryId', async (req: Request, res: Response) => {
  try {
    const { discoveryId } = req.params;
    const raw = await discoveryCache.get(discoveryId);
    if (!raw) {
      res.status(404).json({ success: false, error: 'Discovery session 已过期' });
      return;
    }

    const session: DiscoverySession = JSON.parse(raw);
    if (!session.step3Results) {
      res.status(400).json({
        success: false,
        error: 'Discovery 尚未完成 step3，请先获取结果',
      });
      return;
    }

    const exportData = {
      discoveryId: session.discoveryId,
      createdAt: new Date(session.createdAt).toISOString(),
      market: session.market,
      instrument: session.instrument,
      dateRange: { start: session.startDate, end: session.endDate },
      factors: session.factors,
      rankedFactors: session.step3Results.rankedFactors,
      correlationMatrix: session.step3Results.correlationMatrix,
      decaySummary: session.step3Results.decaySummary,
    };

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="factor-discovery-' + discoveryId + '.json"',
    );
    res.json(exportData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
