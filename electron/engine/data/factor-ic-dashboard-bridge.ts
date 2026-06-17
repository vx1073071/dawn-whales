/**
 * R280+ Claw(PM): 因子IC仪表盘接线桥接
 * 
 * factor-ic-dashboard-engine (JVS R279) → IPC → 前端展示
 * 功能: 因子IC排名 · IR信息比率 · 衰退预警 · IC热力图
 */
export interface ICData {
  factorId: string;
  factorName: string;
  factorNameCn: string;
  ic: number;            // Information Coefficient (-1 to 1)
  icTStat: number;       // IC t-statistic
  ir: number;            // Information Ratio
  decay: number;         // IC half-life in months
  status: 'hot' | 'warm' | 'cool' | 'cold';
  monthlyIC: { month: string; ic: number }[];
  cumulativeIC: { month: string; cumulativeIC: number }[];
}

export interface ICDashboard {
  timestamp: number;
  topFactors: ICData[];
  bottomFactors: ICData[];
  avgIC: number;
  avgIR: number;
  factorCount: number;
  icHeatmap: { factorId: string; month: string; ic: number }[];
  decayAlerts: { factorId: string; factorName: string; decay: number; warning: string }[];
  recommendations: string[];
}

export class FactorICDashboardBridge {
  /** 从因子引擎获取IC数据并格式化 */
  async getDashboard(topN: number = 20): Promise<ICDashboard> {
    const ics: ICData[] = [];

    try {
      const { FactorICDashboardEngine } = require('../../analysis/factor-ic-dashboard-engine');
      const engine = FactorICDashboardEngine.getInstance();
      // engine returns raw IC data; format here
      const rawICs = engine?.getAllICs() || [];
      
      for (const raw of rawICs.slice(0, 200)) {
        ics.push({
          factorId: raw.factorId,
          factorName: raw.factorName,
          factorNameCn: raw.factorNameCn || raw.factorName,
          ic: raw.ic || 0,
          icTStat: raw.icTStat || 0,
          ir: raw.ir || 0,
          decay: raw.decay || 12,
          status: this.classifyIC(raw.ic || 0),
          monthlyIC: raw.monthlyIC || [],
          cumulativeIC: raw.cumulativeIC || [],
        });
      }
    } catch { /* engine not yet loaded */ }

    const sorted = ics.sort((a, b) => b.ic - a.ic);
    const topFactors = sorted.slice(0, topN);
    const bottomFactors = sorted.slice(-topN).reverse();

    const avgIC = ics.length > 0 ? ics.reduce((s, f) => s + f.ic, 0) / ics.length : 0;
    const avgIR = ics.length > 0 ? ics.reduce((s, f) => s + f.ir, 0) / ics.length : 0;

    const decayAlerts = ics.filter(f => f.decay < 3).map(f => ({
      factorId: f.factorId, factorName: f.factorNameCn,
      decay: f.decay, warning: `IC半衰期仅${f.decay}个月——因子信号可能已衰减，建议重新评估`,
    }));

    const recommendations: string[] = [];
    if (avgIC < 0.03) recommendations.push('整体因子IC偏低(<0.03)——市场接近有效，因子策略效果可能受限');
    if (decayAlerts.length > 5) recommendations.push(`${decayAlerts.length}个因子IC快速衰减——考虑缩短换仓周期`);
    if (topFactors[0] && topFactors[0].ic > 0.08) recommendations.push(`${topFactors[0].factorNameCn} IC表现优异——建议增加该因子权重`);

    return {
      timestamp: Date.now(),
      topFactors, bottomFactors, avgIC: Math.round(avgIC * 10000) / 10000,
      avgIR: Math.round(avgIR * 100) / 100, factorCount: ics.length,
      icHeatmap: ics.slice(0, 50).flatMap(f => f.monthlyIC.slice(-12).map(m => ({ factorId: f.factorId, month: m.month, ic: m.ic }))),
      decayAlerts: decayAlerts.slice(0, 10),
      recommendations,
    };
  }

  private classifyIC(ic: number): ICData['status'] {
    if (ic >= 0.06) return 'hot';
    if (ic >= 0.03) return 'warm';
    if (ic >= 0.01) return 'cool';
    return 'cold';
  }
}
