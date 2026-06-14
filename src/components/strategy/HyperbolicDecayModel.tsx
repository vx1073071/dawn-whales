// ── R171 F2: Hyperbolic Decay Model Integration ─────────────────────────
// Extends DecayCurveChart.tsx with dual-track decay model:
//   - Mechanical decay: hyperbolic 1/(1+λ·t)^k (smooth, predictable)
//   - Judgment decay: exponential with structural breaks (discontinuous)
//
// Classification: mechanical factors (MKT/SMB/HML/MOM) decay slower,
// judgment/sentiment factors (LIQ/YIELD/SENTIMENT) decay faster and erratically.
//
// Visual markers: dashed line for mechanical, dotted for judgment;
// structural break points marked with ⚡ vertical lines.

import React from 'react';

// ── Hyperbolic Decay Model (mirrors engine A7 implementation) ────────────────

export interface HyperbolicDecayParams {
  /** Factor type: mechanical (smooth) or judgment (erratic) */
  type: 'mechanical' | 'judgment';
  /** Decay rate λ (higher = faster decay) */
  lambda: number;
  /** Decay exponent k (higher = steeper initial decay) */
  k: number;
  /** Initial IC at lag 0 */
  initialIC: number;
  /** For judgment: break points where regime shifts occurred (lag indices) */
  breakPoints?: number[];
  /** For judgment: IC drop at each break point */
  breakMagnitudes?: number[];
}

export interface HyperbolicDecayCurve {
  factorId: string;
  nameCN: string;
  params: HyperbolicDecayParams;
  curve: number[];          // IC values at each lag
  halfLife: number;         // Lag where IC = 50% of initial
  quarterLife: number;      // Lag where IC = 25% of initial
  color: string;
}

// ── Compute hyperbolic decay curve ───────────────────────────────────────────

export function computeHyperbolicDecay(
  params: HyperbolicDecayParams,
  maxLag: number = 60,
): HyperbolicDecayCurve {
  const curve: number[] = [];
  let halfLife = maxLag;
  let quarterLife = maxLag;
  const halfTarget = Math.abs(params.initialIC) / 2;
  const quarterTarget = Math.abs(params.initialIC) / 4;

  for (let lag = 0; lag < maxLag; lag++) {
    let ic: number;

    if (params.type === 'mechanical') {
      // Hyperbolic: IC(t) = IC₀ / (1 + λ·t)^k
      const denominator = Math.pow(1 + params.lambda * lag, params.k);
      ic = params.initialIC / denominator;
    } else {
      // Exponential with structural breaks (judgment)
      let baseDecay = params.initialIC * Math.exp(-params.lambda * lag);
      // Apply break-point drops
      if (params.breakPoints && params.breakMagnitudes) {
        for (let b = 0; b < params.breakPoints.length; b++) {
          if (lag >= params.breakPoints[b]) {
            baseDecay -= params.breakMagnitudes[b];
          }
        }
      }
      ic = Math.max(0, baseDecay);
    }

    curve.push(Number(ic.toFixed(6)));

    if (halfLife === maxLag && Math.abs(ic) <= halfTarget && lag > 0) {
      halfLife = lag;
    }
    if (quarterLife === maxLag && Math.abs(ic) <= quarterTarget && lag > 0) {
      quarterLife = lag;
    }
  }

  return {
    factorId: '', // filled by caller
    nameCN: '',
    params,
    curve,
    halfLife,
    quarterLife,
    color: '',
  };
}

// ── Default decay params for 8 core factors ──────────────────────────────────

const FACTOR_COLORS: Record<string, string> = {
  MKT: '#00bcd4', MOM_12M: '#00e676', HML: '#448aff',
  VOL_60D: '#e040fb', QUAL: '#ffc107', SMB: '#69f0ae',
  LIQ: '#ff6e40', YIELD: '#ffee58',
};

const FACTOR_NAMES: Record<string, string> = {
  MKT: '市场Beta', MOM_12M: '12月动量', HML: '价值因子',
  VOL_60D: '60日低波', QUAL: '品质因子', SMB: '小盘因子',
  LIQ: '流动性因子', YIELD: '股息率',
};

export const HYPERBOLIC_DECAY_DEFAULTS: Record<string, HyperbolicDecayParams> = {
  MKT: {
    type: 'mechanical', lambda: 0.08, k: 1.2, initialIC: 0.055,
  },
  MOM_12M: {
    type: 'mechanical', lambda: 0.15, k: 1.8, initialIC: 0.045,
  },
  HML: {
    type: 'mechanical', lambda: 0.04, k: 0.8, initialIC: 0.035,
  },
  VOL_60D: {
    type: 'mechanical', lambda: 0.10, k: 1.0, initialIC: -0.040,
  },
  QUAL: {
    type: 'mechanical', lambda: 0.06, k: 0.9, initialIC: 0.038,
  },
  SMB: {
    type: 'mechanical', lambda: 0.03, k: 0.6, initialIC: 0.018,
  },
  LIQ: {
    type: 'judgment', lambda: 0.25, k: 2.0, initialIC: 0.025,
    breakPoints: [12, 30, 48],
    breakMagnitudes: [0.005, 0.008, 0.012],
  },
  YIELD: {
    type: 'judgment', lambda: 0.12, k: 1.5, initialIC: 0.028,
    breakPoints: [20, 42],
    breakMagnitudes: [0.004, 0.007],
  },
};

// ── Generate all decay curves ────────────────────────────────────────────────

export function generateHyperbolicDecayCurves(): HyperbolicDecayCurve[] {
  return Object.entries(HYPERBOLIC_DECAY_DEFAULTS).map(([fid, params]) => {
    const curve = computeHyperbolicDecay(params);
    return {
      factorId: fid,
      nameCN: FACTOR_NAMES[fid] || fid,
      params,
      curve: curve.curve,
      halfLife: curve.halfLife,
      quarterLife: curve.quarterLife,
      color: FACTOR_COLORS[fid] || '#fff',
    };
  });
}

// ── Classification badge sub-component ───────────────────────────────────────

export const DecayTypeBadge: React.FC<{
  type: 'mechanical' | 'judgment';
  size?: 'sm' | 'md';
}> = ({ type, size = 'sm' }) => {
  const config = type === 'mechanical'
    ? { label: '机械衰减', color: '#22c55e', icon: '⚙️', tip: '双曲型平滑衰减，可预测' }
    : { label: '判断衰减', color: '#f59e0b', icon: '🧠', tip: '指数衰减+结构突变，不可预测' };

  const szClass = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border ${szClass}`}
      style={{
        color: config.color,
        backgroundColor: config.color + '15',
        borderColor: config.color + '30',
      }}
      title={config.tip}
    >
      {config.icon} {config.label}
    </span>
  );
};

export default HyperbolicDecayCurve;
