// R196 J2: IN5+EU4 = 9 Market-Specific Factor Calculators
// + All 44 regional factor batch performance optimizer (<3s target)
import { FactorCalculator, type FactorInput } from './factor-calculator';
import type { FactorId } from './factor-id-registry';
// === IN 5 ===
export class IN_FII_DII_FLOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'IN_FII_DII_FLOW' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_FLOW', label: 'FII/DII Net Flow Divergence' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const fii = (input.extra as Record<string,number>)?.fiiNetBuyCr ?? 0;
    const dii = (input.extra as Record<string,number>)?.diiNetBuyCr ?? 0;
    const own = (input.extra as Record<string,number>)?.fiiOwnership ?? 0.2;
    const net = (fii - dii) / 100;
    const v = Math.tanh(net) + (own > 0.25 ? 0.3 : own > 0.18 ? 0 : -0.2);
    return { value: v, rawValue: fii };
  }
}

export class IN_MONSOON_EFFECT_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'IN_MONSOON_EFFECT' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_SEASONAL', label: 'Monsoon Seasonal Effect' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const monsoon = (input.extra as Record<string,number>)?.monsoonPeriod ?? 0;
    const agri = (input.extra as Record<string,number>)?.agriExposure ?? 0.15;
    const v = monsoon * agri * 3;
    return { value: Math.tanh(v), rawValue: agri };
  }
}

export class IN_MODI_POLICY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'IN_MODI_POLICY' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CYCLE', label: 'Government Policy Theme' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const theme = (input.extra as Record<string,number>)?.policyThemeScore ?? 0.5;
    const infra = (input.extra as Record<string,number>)?.infraExposure ?? 0.2;
    const v = theme > 0.7 ? 1 : theme > 0.5 ? 0.5 : 0 + (infra > 0.3 ? 0.3 : 0);
    return { value: Math.tanh(v), rawValue: theme };
  }
}

export class IN_RUPEE_HEDGE_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'IN_RUPEE_HEDGE' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CURRENCY', label: 'INR Exchange Hedge' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const inr = (input.extra as Record<string,number>)?.usdInr ?? 84;
    const importExposure = (input.extra as Record<string,number>)?.importExposure ?? 0.25;
    const v = inr > 85 ? -importExposure : inr < 80 ? importExposure : 0;
    return { value: Math.tanh(v), rawValue: inr };
  }
}

export class IN_PLEDGED_SHARES_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'IN_PLEDGED_SHARES' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_RISK', label: 'Promoter Pledged Shares Risk' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const pct = (input.extra as Record<string,number>)?.pledgedPct ?? 0.1;
    const promoter = (input.extra as Record<string,number>)?.promoterHolding ?? 0.5;
    const v = pct > 0.3 ? -1 : pct > 0.15 ? -0.5 : pct > 0.05 ? -0.2 : promoter * 0.3;
    return { value: v, rawValue: pct };
  }
}

// === EU 4 ===
export class EU_STOXX_SECTOR_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'EU_STOXX_SECTOR' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_MOMENTUM', label: 'STOXX Sector Rotation' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const mom = (input.extra as Record<string,number>)?.sectorMomentum ?? 0;
    const rot = (input.extra as Record<string,number>)?.rotationSignal ?? 0;
    const v = Math.tanh(mom * 10) + rot * 0.5;
    return { value: v, rawValue: mom };
  }
}

export class EU_EUR_SENSITIVITY_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'EU_EUR_SENSITIVITY' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_CURRENCY', label: 'EUR Exchange Sensitivity' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const eur = (input.extra as Record<string,number>)?.eurUsd ?? 1.1;
    const exportR = (input.extra as Record<string,number>)?.exportRatio ?? 0.4;
    const v = eur > 1.12 ? -exportR : eur < 1.06 ? exportR : 0;
    return { value: Math.tanh(v), rawValue: eur };
  }
}

export class EU_ESG_PREMIUM_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'EU_ESG_PREMIUM' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_STRUCTURAL', label: 'EU ESG Premium/Discount' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const score = (input.extra as Record<string,number>)?.esgScore ?? 65;
    const contra = (input.extra as Record<string,number>)?.controversy ?? 2;
    const v = score > 80 ? 1 : score > 65 ? 0.5 : score > 50 ? 0 : -0.3 - (contra > 2 ? 0.5 : 0);
    return { value: Math.tanh(v), rawValue: score };
  }
}

export class EU_BREXIT_SHADOW_Calculator extends FactorCalculator {
  constructor() { super({ factorId: 'EU_BREXIT_SHADOW' as FactorId, level1: 'L1_CROSS_ASSET', level2: 'L2_RISK', label: 'Brexit Regulatory Shadow' }); }
  protected override compute(input: FactorInput): { value: number; rawValue?: number; label?: string } {
    const isUk = (input.extra as Record<string,number>)?.isUKChip ?? 0;
    const ukRv = (input.extra as Record<string,number>)?.ukRevenuePct ?? 0;
    const fca = (input.extra as Record<string,number>)?.fcaRegImpact ?? 0;
    const v = isUk > 0 ? (ukRv * -0.8 + fca * 5) : 0;
    return { value: Math.tanh(v), rawValue: ukRv };
  }
}

// === Registry ===
export const INEU_FACTOR_CALCULATORS: Record<string, { new(): FactorCalculator }> = {
  IN_FII_DII_FLOW: IN_FII_DII_FLOW_Calculator,
  IN_MONSOON_EFFECT: IN_MONSOON_EFFECT_Calculator,
  IN_MODI_POLICY: IN_MODI_POLICY_Calculator,
  IN_RUPEE_HEDGE: IN_RUPEE_HEDGE_Calculator,
  IN_PLEDGED_SHARES: IN_PLEDGED_SHARES_Calculator,
  EU_STOXX_SECTOR: EU_STOXX_SECTOR_Calculator,
  EU_EUR_SENSITIVITY: EU_EUR_SENSITIVITY_Calculator,
  EU_ESG_PREMIUM: EU_ESG_PREMIUM_Calculator,
  EU_BREXIT_SHADOW: EU_BREXIT_SHADOW_Calculator,
};
export const INEU_FACTOR_IDS: readonly string[] = Object.keys(INEU_FACTOR_CALCULATORS);

export function getInEuFactorCalculator(factorId: string): FactorCalculator | null {
  const Ctor = INEU_FACTOR_CALCULATORS[factorId];
  return Ctor ? new Ctor() : null;
}

export function getFactorsByMarket(market: string): string[] {
  const pre = market.toUpperCase();
  if (pre === 'IN') return INEU_FACTOR_IDS.filter(id => id.startsWith('IN_'));
  if (pre === 'EU') return INEU_FACTOR_IDS.filter(id => id.startsWith('EU_'));
  return [];
}
export const INEU_FACTOR_COUNT = 9;

// === 44-Factor Regional Batch Optimizer (<3s) ===
export class RegionalBatchOptimizer {
  private cache = new Map<string, { value: number; ts: number }>();
  private cacheTtlMs = 30_000;
  private concurrency = 16;

  constructor(options?: { cacheTtlMs?: number; concurrency?: number }) {
    this.cacheTtlMs = options?.cacheTtlMs ?? this.cacheTtlMs;
    this.concurrency = options?.concurrency ?? this.concurrency;
  }

  async computeAll44(input: FactorInput): Promise<Array<{ factorId: string; value: number; elapsed: number }>> {
    const now = Date.now();
    const all44 = [...require('./jp-tw-factors').JP_TW_FACTOR_IDS, ...require('./kr-sg-au-factors').KRSGAU_FACTOR_IDS, ...INEU_FACTOR_IDS];
    const results: Array<{ factorId: string; value: number; elapsed: number }> = [];

    const batches = [];
    for (let i = 0; i < all44.length; i += this.concurrency) {
      batches.push(all44.slice(i, i + this.concurrency));
    }

    for (const batch of batches) {
      const batchStart = Date.now();
      const batchResults = await Promise.all(batch.map(async (fid) => {
        const cacheKey = `${input.symbol}:${fid}:${Math.floor(input.timestamp / 30000)}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (now - cached.ts) < this.cacheTtlMs) {
          return { factorId: fid, value: cached.value, elapsed: 0 };
        }

        let calculator: FactorCalculator | null = null;
        try { calculator = require('./jp-tw-factors').getJpTwFactorCalculator(fid); } catch {}
        if (!calculator) try { calculator = require('./kr-sg-au-factors').getKrSgAuFactorCalculator(fid); } catch {}
        if (!calculator) calculator = getInEuFactorCalculator(fid);

        if (calculator) {
          const result = (calculator as any).compute(input);
          this.cache.set(cacheKey, { value: result.value, ts: now });
          return { factorId: fid, value: result.value, elapsed: Date.now() - batchStart };
        }
        return { factorId: fid, value: 0, elapsed: Date.now() - batchStart };
      }));
      results.push(...batchResults);
    }
    return results;
  }

  async benchmark(input: FactorInput): Promise<{ totalMs: number; cachedCount: number; perFactorAvg: number }> {
    const start = Date.now();
    const results = await this.computeAll44(input);
    const totalMs = Date.now() - start;
    const cachedCount = results.filter(r => r.elapsed > 0).length;
    return { totalMs, cachedCount, perFactorAvg: totalMs / 44 };
  }

  clearCache(): void { this.cache.clear(); }
  getCacheSize(): number { return this.cache.size; }
}