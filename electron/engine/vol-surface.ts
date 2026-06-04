// ── Q41: Volatility Surface Builder ──────────────────────────────────────────
// IV smile/skew interpolation + term structure
// 3D mesh data for surface visualization + historical comparison

import log from 'electron-log';

// ── Types ──────────────────────────────────────────────────────────────────

export interface IVPoint {
  strike: number;
  expiry: string;
  iv: number;              // Implied vol (decimal, e.g. 0.25 for 25%)
  delta?: number;          // Delta for options
  type: 'CALL' | 'PUT' | 'ATM' | 'OTM';
}

export interface VolSurface {
  symbol: string;
  date: string;
  spot: number;
  surface: IVPoint[];
  atmVol: number;         // ATM vol (closest to spot)
  rr20: number;           // 25-delta risk reversal (PUT-CALL)
  bf25: number;           // 25-delta butterfly
  skewIndex: number;       // Aggregate skew metric
  termStructure: Array<{ expiry: string; atmVol: number; rr: number }>;
}

export interface SurfaceSlice {
  expiry: string;
  ivs: Array<{ strike: number; iv: number; type: string }>;
  fittedCurve: Array<{ moneyness: number; iv: number }>; // Fitted vol smile
  atmStrike: number;
  skew: number;            // Skew (high strike vol - low strike vol)
  skewDirection: 'left' | 'right' | 'symmetric';
}

export interface SurfaceComparison {
  symbol: string;
  currentSurface: VolSurface;
  historicalSurface?: VolSurface;
  change: Array<{ expiry: string; atmVolChange: number; skewChange: number }>;
  significantChanges: Array<{
    expiry: string;
    type: 'spike' | 'drop' | 'smile_shift' | 'term_structure_shift';
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  recommendations: string[];
}

// ── Smile Interpolation ──────────────────────────────────────────────────

function interpolateSmile(
  strikes: number[],
  ivs: number[],
  targetStrike: number
): number {
  if (strikes.length === 0) return 0.25;
  if (strikes.length === 1) return ivs[0];

  // Find bracketing strikes
  let lower = strikes[0], upper = strikes[strikes.length - 1];
  let lowerIV = ivs[0], upperIV = ivs[ivs.length - 1];

  for (let i = 0; i < strikes.length - 1; i++) {
    if (strikes[i] <= targetStrike && strikes[i + 1] >= targetStrike) {
      lower = strikes[i]; upper = strikes[i + 1];
      lowerIV = ivs[i]; upperIV = ivs[i + 1];
      break;
    }
  }

  if (targetStrike <= lower) return lowerIV;
  if (targetStrike >= upper) return upperIV;

  // Linear interpolation
  const t = (targetStrike - lower) / (upper - lower);
  return lowerIV + t * (upperIV - lowerIV);
}

// ── Moneyness Calculation ──────────────────────────────────────────────

function moneyness(strike: number, spot: number, vol: number, t: number): number {
  // Moneyness in standard deviations
  return Math.log(strike / spot) / Math.sqrt(t) / vol;
}

// ── Volatility Surface Builder ───────────────────────────────────────────

export class VolatilitySurfaceBuilder {
  constructor() {
    log.info('[VolatilitySurfaceBuilder] Initialized');
  }

  // ── Build Surface ───────────────────────────────────────────────────

  buildSurface(
    symbol: string,
    spot: number,
    optionData: Array<{
      strike: number;
      expiry: string;
      iv: number;
      type: 'CALL' | 'PUT';
      delta?: number;
    }>
  ): VolSurface {
    if (optionData.length === 0) return this.emptySurface(symbol);

    // Group by expiry
    const byExpiry = new Map<string, typeof optionData>();
    for (const opt of optionData) {
      const arr = byExpiry.get(opt.expiry) ?? [];
      arr.push(opt);
      byExpiry.set(opt.expiry, arr);
    }

    const surface: IVPoint[] = [];
    const termStructure: VolSurface['termStructure'] = [];
    let rr20 = 0, bf25 = 0;
    let atmVol = 0;

    for (const [expiry, opts] of byExpiry) {
      const strikes = opts.map(o => o.strike).sort((a, b) => a - b);
      const ivs = opts.map(o => o.iv);

      // ATM is the strike closest to spot
      let minDist = Infinity, atmIdx = 0;
      strikes.forEach((s, i) => {
        const dist = Math.abs(s - spot);
        if (dist < minDist) { minDist = dist; atmIdx = i; }
      });

      const atmStrike = strikes[atmIdx];
      const atmIV = ivs[atmIdx];
      atmVol = atmIV;

      // 25-delta risk reversal (simplified)
      const highStrike = atmStrike * 1.05;
      const lowStrike = atmStrike * 0.95;
      const rr25 = interpolateSmile(strikes, ivs, highStrike) -
        interpolateSmile(strikes, ivs, lowStrike);
      const bf25d = (interpolateSmile(strikes, ivs, highStrike) +
        interpolateSmile(strikes, ivs, lowStrike)) / 2 - atmIV;

      rr20 += rr25;
      bf25 += bf25d;

      termStructure.push({
        expiry,
        atmVol: Math.round(atmIV * 10000) / 100,
        rr: Math.round(rr25 * 10000) / 100,
      });

      // Add IV points
      for (let i = 0; i < strikes.length; i++) {
        surface.push({
          strike: strikes[i],
          expiry,
          iv: ivs[i],
          delta: opts[i].delta,
          type: strikes[i] === atmStrike ? 'ATM' :
            opts[i].type === 'PUT' ? 'OTM' : 'ITM',
        });
      }
    }

    rr20 /= Math.max(1, byExpiry.size);
    bf25 /= Math.max(1, byExpiry.size);

    // Skew index: aggregate measure
    const skewIndex = Math.abs(rr20) * 100;

    return {
      symbol,
      date: new Date().toISOString().slice(0, 10),
      spot,
      surface,
      atmVol: Math.round(atmVol * 10000) / 100,
      rr20: Math.round(rr20 * 10000) / 100,
      bf25: Math.round(bf25 * 10000) / 100,
      skewIndex: Math.round(skewIndex * 100) / 100,
      termStructure,
    };
  }

  // ── Build Per-Expiry Slices ─────────────────────────────────────────

  buildSlices(surface: VolSurface): SurfaceSlice[] {
    const byExpiry = new Map<string, IVPoint[]>();
    for (const pt of surface.surface) {
      const arr = byExpiry.get(pt.expiry) ?? [];
      arr.push(pt);
      byExpiry.set(pt.expiry, arr);
    }

    return [...byExpiry.entries()].map(([expiry, pts]) => {
      const strikes = pts.map(p => p.strike).sort((a, b) => a - b);
      const ivs = strikes.map(s =>
        pts.find(p => p.strike === s)?.iv ?? 0.25
      );

      // ATM strike
      let minDist = Infinity, atmStrike = strikes[0];
      strikes.forEach(s => {
        const dist = Math.abs(s - surface.spot);
        if (dist < minDist) { minDist = dist; atmStrike = s; }
      });

      // Fitted smile (simplified parabola)
      const fittedCurve = strikes.map(s => ({
        moneyness: Math.log(s / surface.spot),
        iv: interpolateSmile(strikes, ivs, s),
      }));

      // Skew direction
      const highIV = Math.max(...ivs);
      const lowIV = Math.min(...ivs);
      const highStrike = strikes[ivs.indexOf(highIV)];
      const lowStrike = strikes[ivs.indexOf(lowIV)];
      const skew = highIV - lowIV;
      const skewDirection = highStrike > atmStrike ? 'left' :
        lowStrike < atmStrike ? 'right' : 'symmetric';

      return {
        expiry,
        ivs: strikes.map((s, i) => ({
          strike: s,
          iv: ivs[i],
          type: pts.find(p => p.strike === s)?.type ?? 'ATM',
        })),
        fittedCurve,
        atmStrike,
        skew: Math.round(skew * 10000) / 100,
        skewDirection: skewDirection as SurfaceSlice['skewDirection'],
      };
    });
  }

  // ── 3D Mesh Data for Visualization ─────────────────────────────────

  build3DMesh(
    surface: VolSurface,
    nStrikes = 20,
    nExpiry = 10
  ): {
    strikes: number[];
    expiries: string[];
    mesh: number[][];       // [expiryIdx][strikeIdx] = iv
    moneynessGrid: number[][];
  } {
    const allExpiries = surface.termStructure.map(t => t.expiry);
    const allStrikes = [...new Set(surface.surface.map(p => p.strike))]
      .sort((a, b) => a - b);

    // Resample to regular grid
    const minStrike = allStrikes[0];
    const maxStrike = allStrikes[allStrikes.length - 1];
    const resampledStrikes = Array.from(
      { length: nStrikes },
      (_, i) => minStrike + (maxStrike - minStrike) * i / (nStrikes - 1)
    );

    const mesh: number[][] = [];
    const moneynessGrid: number[][] = [];

    for (let ei = 0; ei < allExpiries.length; ei++) {
      const expiry = allExpiries[ei];
      const pts = surface.surface.filter(p => p.expiry === expiry);
      const strikes = pts.map(p => p.strike);
      const ivs = pts.map(p => p.iv);

      const row: number[] = [];
      const mnRow: number[] = [];
      for (const strike of resampledStrikes) {
        const iv = interpolateSmile(strikes, ivs, strike);
        row.push(Math.round(iv * 10000) / 100);
        const t = 30 / 365; // Placeholder time
        mnRow.push(Math.round(moneyness(strike, surface.spot, iv, t) * 100) / 100);
      }
      mesh.push(row);
      moneynessGrid.push(mnRow);
    }

    return {
      strikes: resampledStrikes.map(s => Math.round(s * 100) / 100),
      expiries: allExpiries,
      mesh,
      moneynessGrid,
    };
  }

  // ── Surface Comparison ───────────────────────────────────────────────

  compareSurface(
    current: VolSurface,
    historical?: VolSurface
  ): SurfaceComparison {
    if (!historical) {
      return {
        symbol: current.symbol,
        currentSurface: current,
        change: [],
        significantChanges: [],
        recommendations: ['Historical data needed for comparison'],
      };
    }

    const change: SurfaceComparison['change'] = [];
    const significantChanges: SurfaceComparison['significantChanges'] = [];

    for (const curTerm of current.termStructure) {
      const histTerm = historical.termStructure.find(t => t.expiry === curTerm.expiry);
      if (!histTerm) continue;

      const atmVolChange = curTerm.atmVol - histTerm.atmVol;
      const skewChange = curTerm.rr - histTerm.rr;

      change.push({
        expiry: curTerm.expiry,
        atmVolChange: Math.round(atmVolChange * 10000) / 100,
        skewChange: Math.round(skewChange * 10000) / 100,
      });

      if (Math.abs(atmVolChange) > 0.03) {
        significantChanges.push({
          expiry: curTerm.expiry,
          type: atmVolChange > 0 ? 'spike' : 'drop',
          description: `ATM vol changed ${(atmVolChange * 100).toFixed(1)}% (${histTerm.atmVol.toFixed(1)}% → ${curTerm.atmVol.toFixed(1)}%)`,
          severity: Math.abs(atmVolChange) > 0.08 ? 'HIGH' :
            Math.abs(atmVolChange) > 0.05 ? 'MEDIUM' : 'LOW',
        });
      }
    }

    const recommendations: string[] = [];
    if (current.skewIndex > historical.skewIndex * 1.3) {
      recommendations.push('⚠️ Skew increased: market pricing more downside risk');
    }
    if (significantChanges.some(c => c.severity === 'HIGH')) {
      recommendations.push('🚨 Significant vol surface changes detected — review positions');
    }
    if (recommendations.length === 0) {
      recommendations.push('✅ Vol surface stable vs historical');
    }

    return {
      symbol: current.symbol,
      currentSurface: current,
      historicalSurface: historical,
      change,
      significantChanges,
      recommendations,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private emptySurface(symbol: string): VolSurface {
    return {
      symbol,
      date: new Date().toISOString().slice(0, 10),
      spot: 0,
      surface: [],
      atmVol: 0,
      rr20: 0,
      bf25: 0,
      skewIndex: 0,
      termStructure: [],
    };
  }
}

export default VolatilitySurfaceBuilder;