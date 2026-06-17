// ══ R253 LOBEHUB QU-01: 因子IC评估引擎 ══
// Factor Information Coefficient (IC) Evaluator — measures signal skill
// "320因子中到底谁真正有用？用IC告诉你。"
// IC = corr(factor_t, return_t+1), |IC|>0.03 → 有效信号

export interface FactorICRecord {
  factorId: string;
  factorName: string;
  L1: string;              // 一级分类 (Value/Momentum/Quality/Volatility/Growth/Size/Sentiment/Macro...)
  L2: string;              // 二级分类
  IC: number;              // 当前信息系数
  ICAvg: number;           // 滚动均值 (20期)
  ICStd: number;           // IC标准差 → IC_IR = ICAvg / ICStd
  ICIR: number;            // Information Coefficient Information Ratio
  rank: number;            // 排名(按|IC|降序)
  effective: boolean;      // |IC_IR| > 0.3 → 有效
  decayFlag: 'STABLE' | 'DECAYING' | 'SHARP_DECAY' | 'DEAD';
  lastEvaluated: number;
  sampleCount: number;
}

export interface FactorICSnapshot {
  timestamp: number;
  market: string;
  totalFactors: number;
  effectiveFactors: number;
  top10: FactorICRecord[];
  decayList: FactorICRecord[];
  summary: string;
}

// ═══════════════════ IC评估核心 ═══════════════════

const EFFECTIVE_IC_THRESHOLD = 0.03;  // |IC| > 0.03 → 有效
const DECAY_THRESHOLD = -0.5;          // IC变化 < -50% → 衰减
const SHARP_DECAY_THRESHOLD = -0.8;    // IC变化 < -80% → 急剧衰减
// _IC_STABLE_WINDOW = 20 (used implicitly via historicalIC array length)

export function evaluateFactorIC(
  factorId: string,
  factorName: string,
  L1: string,
  L2: string,
  currentIC: number,
  historicalIC: number[],  // 最近20期IC值
): FactorICRecord {
  const n = historicalIC.length;
  const avg = n > 0 ? historicalIC.reduce((a, b) => a + b, 0) / n : currentIC;
  const variance = n > 1
    ? historicalIC.reduce((s, v) => s + (v - avg) ** 2, 0) / (n - 1)
    : 0;
  const std = Math.sqrt(variance);
  const icir = std > 0 ? avg / std : 0;

  // Decay detection
  let decayFlag: FactorICRecord['decayFlag'] = 'STABLE';
  if (n >= 4) {
    const recent = historicalIC.slice(-4);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / 4;
    const change = avg > 0.001 || avg < -0.001 ? (recentAvg - avg) / Math.abs(avg) : 0;
    if (change < SHARP_DECAY_THRESHOLD) decayFlag = 'SHARP_DECAY';
    else if (change < DECAY_THRESHOLD) decayFlag = 'DECAYING';
  }

  return {
    factorId, factorName, L1, L2,
    IC: currentIC,
    ICAvg: avg,
    ICStd: std,
    ICIR: icir,
    rank: 0, // filled later
    effective: Math.abs(avg) > EFFECTIVE_IC_THRESHOLD && Math.abs(icir) > 0.3,
    decayFlag,
    lastEvaluated: Date.now(),
    sampleCount: n + 1,
  };
}

// ═══════════════════ 批量评估 ═══════════════════

export function batchEvaluateIC(
  factors: Array<{ factorId: string; factorName: string; L1: string; L2: string; currentIC: number; historicalIC: number[] }>,
): FactorICSnapshot {
  const records = factors.map(f =>
    evaluateFactorIC(f.factorId, f.factorName, f.L1, f.L2, f.currentIC, f.historicalIC)
  );

  // Rank by |IC_IR|
  records.sort((a, b) => Math.abs(b.ICIR) - Math.abs(a.ICIR));
  records.forEach((r, i) => { r.rank = i + 1; });

  const effective = records.filter(r => r.effective);
  const decaying = records.filter(r => r.decayFlag !== 'STABLE');
  const top10 = records.slice(0, 10);

  return {
    timestamp: Date.now(),
    market: 'GLOBAL',
    totalFactors: records.length,
    effectiveFactors: effective.length,
    top10,
    decayList: decaying,
    summary: `320因子→${effective.length}个有效(|IC|>0.03, |ICIR|>0.3)。衰减信号: ${decaying.length}个。Top3: ${top10.slice(0,3).map(r=>r.factorName).join(', ')}`,
  };
}

// ═══════════════════ L1分类统计 ═══════════════════

export interface L1Summary {
  L1: string;
  factorCount: number;
  effectiveCount: number;
  avgIC: number;
  bestFactor: string;
  bestICIR: number;
}

export function summarizeByL1(records: FactorICRecord[]): L1Summary[] {
  const groups = new Map<string, FactorICRecord[]>();
  for (const r of records) {
    const list = groups.get(r.L1) || [];
    list.push(r);
    groups.set(r.L1, list);
  }
  return Array.from(groups.entries()).map(([L1, recs]) => ({
    L1,
    factorCount: recs.length,
    effectiveCount: recs.filter(r => r.effective).length,
    avgIC: recs.reduce((s, r) => s + r.IC, 0) / recs.length,
    bestFactor: recs.sort((a, b) => Math.abs(b.ICIR) - Math.abs(a.ICIR))[0]?.factorName || '',
    bestICIR: recs[0]?.ICIR || 0,
  })).sort((a, b) => b.avgIC - a.avgIC);
}

// ═══════════════════ IC趋势监控 ═══════════════════

export interface ICTrendAlert {
  factorId: string;
  factorName: string;
  alertType: 'ACTIVATED' | 'DECAYING' | 'SHARPLY_DECAYING' | 'DEAD' | 'REVIVING';
  oldIC: number;
  newIC: number;
  changePct: number;
  recommendation: string;
}

export function generateICTrendAlerts(
  previous: FactorICRecord[],
  current: FactorICRecord[],
): ICTrendAlert[] {
  const alerts: ICTrendAlert[] = [];
  const prevMap = new Map(previous.map(r => [r.factorId, r]));
  const currMap = new Map(current.map(r => [r.factorId, r]));

  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id);
    if (!prev) continue;

    const changePct = prev.ICAvg !== 0 ? (curr.ICAvg - prev.ICAvg) / Math.abs(prev.ICAvg) : 0;
    let alertType: ICTrendAlert['alertType'] | null = null;

    if (!prev.effective && curr.effective) alertType = 'ACTIVATED';
    else if (prev.effective && !curr.effective) alertType = 'DEAD';
    else if (changePct < -0.8) alertType = 'SHARPLY_DECAYING';
    else if (changePct < -0.5) alertType = 'DECAYING';
    else if (changePct > 0.5 && !prev.effective) alertType = 'REVIVING';

    if (alertType) {
      alerts.push({
        factorId: id,
        factorName: curr.factorName,
        alertType,
        oldIC: prev.ICAvg,
        newIC: curr.ICAvg,
        changePct,
        recommendation: alertType === 'DEAD' || alertType === 'SHARPLY_DECAYING'
          ? `建议暂停使用因子${curr.factorName}，等待下一期验证`
          : alertType === 'ACTIVATED'
            ? `因子${curr.factorName}刚激活，可纳入策略池`
            : `因子${curr.factorName}持续衰减，监控中`,
      });
    }
  }

  return alerts.sort((a, b) => a.changePct - b.changePct);
}

// ═══════════════════ 数据阈值设定引擎 ═══════════════════

export interface DataThreshold {
  metric: string;           // 指标名
  unit: string;
  safeRange: [number, number];   // 安全范围
  warningRange: [number, number]; // 警告范围
  criticalRange: [number, number]; // 危险范围
  description: string;
  source: string;           // 阈值来源：quantile/regulation/empirical
}

export const MARKET_DATA_THRESHOLDS: DataThreshold[] = [
  {
    metric: 'quoteDelayMs', unit: 'ms',
    safeRange: [0, 200], warningRange: [200, 1000], criticalRange: [1000, Infinity],
    description: '行情延迟。>200ms影响高频策略，>1000ms不可用',
    source: 'empirical',
  },
  {
    metric: 'bidAskSpread', unit: '%',
    safeRange: [0, 0.5], warningRange: [0.5, 2], criticalRange: [2, Infinity],
    description: '买卖价差百分比。>2%说明流动性极差',
    source: 'empirical',
  },
  {
    metric: 'dailyVolume', unit: 'shares',
    safeRange: [100000, Infinity], warningRange: [10000, 100000], criticalRange: [0, 10000],
    description: '日成交量。低于1万=流动性风险',
    source: 'empirical',
  },
  {
    metric: 'priceChangeLimit', unit: '%',
    safeRange: [-10, 10], warningRange: [-20, -10], criticalRange: [-Infinity, -20],
    description: '单日涨跌幅。A股有涨跌停限制(±10%/±20%)',
    source: 'regulation',
  },
  {
    metric: 'factorIC', unit: 'correlation',
    safeRange: [0.03, 1], warningRange: [0.01, 0.03], criticalRange: [-Infinity, 0.01],
    description: '因子IC绝对值。<0.03=无效信号',
    source: 'empirical',
  },
  {
    metric: 'sharpeRatio', unit: 'ratio',
    safeRange: [0.5, Infinity], warningRange: [0, 0.5], criticalRange: [-Infinity, 0],
    description: '夏普比率。<0=亏钱，>0.5=可接受',
    source: 'empirical',
  },
  {
    metric: 'maxDrawdown', unit: '%',
    safeRange: [0, 20], warningRange: [20, 35], criticalRange: [35, 100],
    description: '最大回撤。>35%=严重问题',
    source: 'empirical',
  },
  {
    metric: 'winRate', unit: '%',
    safeRange: [45, 100], warningRange: [35, 45], criticalRange: [0, 35],
    description: '胜率。<35%可能策略有问题',
    source: 'empirical',
  },
];

export function evaluateThreshold(value: number, threshold: DataThreshold): 'SAFE' | 'WARNING' | 'CRITICAL' {
  if (threshold.safeRange[0] <= value && value <= threshold.safeRange[1]) return 'SAFE';
  if (threshold.warningRange[0] <= value && value <= threshold.warningRange[1]) return 'WARNING';
  return 'CRITICAL';
}

// ═══════════════════ 导出 ═══════════════════

export default FactorICRecord;
