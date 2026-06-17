/**
 * R278 auto#2a: MSCI ESG 数据源桥接 (ESGDataSource) v1.0
 * 
 * QUANT MOO — 桥接 MSCI ESG 评级+指标数据 → 因子管线
 * 
 * 数据维度:
 *   E — Environmental (环境): 20+ 指标
 *     · 碳排放强度 / 碳足迹 / 化石燃料暴露
 *     · 水资源管理 / 生物多样性 / 清洁科技机会
 *   S — Social (社会): 20+ 指标
 *     · 人力资本发展 / 供应链劳动标准
 *     · 产品安全 / 隐私与数据安全 / 社区关系
 *   G — Governance (治理): 20+ 指标
 *     · 董事会独立性 / 薪酬 / 所有权结构
 *     · 会计审计 / 商业道德 / 税收透明度
 * 
 * 评级体系:
 *   ESG Rating: CCC / B / BB / BBB / A / AA / AAA
 *   ESG Score: 0.0 - 10.0
 *   ESG Momentum: 评级变化方向
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type ESGPillar = 'E' | 'S' | 'G';
export type ESGRating = 'CCC' | 'B' | 'BB' | 'BBB' | 'A' | 'AA' | 'AAA';
export type ESGMomentum = 'improving' | 'stable' | 'deteriorating';

export interface ESGIndicator {
  id: string;
  name: string;
  nameCn: string;
  pillar: ESGPillar;
  category: string;
  categoryCn: string;
  weight: number;         // 0-1, within pillar
  unit: string;
  description: string;
}

export interface ESGScore {
  symbol: string;
  companyName: string;
  timestamp: number;
  overallRating: ESGRating;
  overallScore: number;   // 0-10
  momentum: ESGMomentum;
  scores: {
    E: { rating: ESGRating; score: number; indicators: Record<string, number> };
    S: { rating: ESGRating; score: number; indicators: Record<string, number> };
    G: { rating: ESGRating; score: number; indicators: Record<string, number> };
  };
  controversyScore: number;   // 0-10 (lower = more controversies)
  industryAdjustment: number; // sector-relative adjustment
  percentile: number;         // 0-100 within industry
}

export interface ESGFactorSignal {
  signalId: string;
  symbol: string;
  companyName: string;
  category: 'rating_change' | 'controversy' | 'momentum_alert' | 'pillar_extreme' | 'peer_outlier';
  severity: 'info' | 'warning' | 'critical';
  direction: 'bullish' | 'bearish' | 'neutral';
  message: string;
  messageCn: string;
  score: number;
  timestamp: number;
}

export interface ESGPortfolioStats {
  totalHoldings: number;
  ratedCount: number;
  avgESGScore: number;
  avgEScore: number;
  avgSScore: number;
  avgGScore: number;
  ratingDistribution: Record<ESGRating, number>;
  momentumBreakdown: Record<ESGMomentum, number>;
  controversyCount: number;
  topPerformers: Array<{ symbol: string; name: string; score: number }>;
  bottomPerformers: Array<{ symbol: string; name: string; score: number }>;
}

export interface ESGSourceStats {
  totalScores: number;
  lastUpdate: number;
  signalsGenerated: number;
  avgOverallScore: number;
}

// ── ESG Indicator Registry (MSCI-aligned) ────────────────────────────────

const ESG_INDICATORS: ESGIndicator[] = [
  // ═══ ENVIRONMENTAL ═══════════════════════════════════════════════════════
  { id:'E_CARBON_INTENSITY', name:'Carbon Emission Intensity', nameCn:'碳排放强度', pillar:'E', category:'Climate Change', categoryCn:'气候变化', weight:0.15, unit:'tCO2e/M USD', description:'Scope 1+2 carbon emissions per million USD revenue' },
  { id:'E_CARBON_FOOTPRINT', name:'Carbon Footprint', nameCn:'碳足迹', pillar:'E', category:'Climate Change', categoryCn:'气候变化', weight:0.12, unit:'tCO2e', description:'Total Scope 1+2+3 carbon emissions' },
  { id:'E_FOSSIL_FUEL', name:'Fossil Fuel Exposure', nameCn:'化石燃料暴露', pillar:'E', category:'Climate Change', categoryCn:'气候变化', weight:0.10, unit:'% revenue', description:'Percentage of revenue from fossil fuel activities' },
  { id:'E_CLEAN_TECH', name:'Clean Technology Revenue', nameCn:'清洁科技收入', pillar:'E', category:'Climate Change', categoryCn:'气候变化', weight:0.08, unit:'% revenue', description:'Revenue from clean technology solutions' },
  { id:'E_WATER_STRESS', name:'Water Stress Management', nameCn:'水资源管理', pillar:'E', category:'Natural Capital', categoryCn:'自然资源', weight:0.10, unit:'score 0-10', description:'Water management practices in water-stressed regions' },
  { id:'E_BIODIVERSITY', name:'Biodiversity Impact', nameCn:'生物多样性影响', pillar:'E', category:'Natural Capital', categoryCn:'自然资源', weight:0.08, unit:'score 0-10', description:'Impact on biodiversity and land use' },
  { id:'E_WASTE_MGMT', name:'Waste Management', nameCn:'废弃物管理', pillar:'E', category:'Natural Capital', categoryCn:'自然资源', weight:0.07, unit:'score 0-10', description:'Hazardous waste management and recycling rate' },
  { id:'E_ENV_MGMT_SYS', name:'Environmental Mgmt System', nameCn:'环境管理体系', pillar:'E', category:'Management', categoryCn:'管理', weight:0.10, unit:'score 0-10', description:'ISO 14001 certification, EMS maturity' },
  { id:'E_RENEWABLE_ENERGY', name:'Renewable Energy Use', nameCn:'可再生能源使用', pillar:'E', category:'Climate Change', categoryCn:'气候变化', weight:0.10, unit:'% energy', description:'Percentage of energy from renewable sources' },
  { id:'E_CDP_SCORE', name:'CDP Disclosure Score', nameCn:'CDP披露评分', pillar:'E', category:'Disclosure', categoryCn:'信息披露', weight:0.10, unit:'A-F', description:'Carbon Disclosure Project rating' },
  // ═══ SOCIAL ═══════════════════════════════════════════════════════════════
  { id:'S_HUMAN_CAPITAL', name:'Human Capital Development', nameCn:'人力资本发展', pillar:'S', category:'Human Capital', categoryCn:'人力资本', weight:0.15, unit:'score 0-10', description:'Training, career development, employee engagement' },
  { id:'S_LABOR_STANDARDS', name:'Supply Chain Labor Standards', nameCn:'供应链劳动标准', pillar:'S', category:'Human Capital', categoryCn:'人力资本', weight:0.12, unit:'score 0-10', description:'Labor standards in supply chain management' },
  { id:'S_WORKER_SAFETY', name:'Health & Safety', nameCn:'职业健康安全', pillar:'S', category:'Human Capital', categoryCn:'人力资本', weight:0.13, unit:'TRIR', description:'Total Recordable Injury Rate' },
  { id:'S_PRODUCT_SAFETY', name:'Product Safety & Quality', nameCn:'产品安全质量', pillar:'S', category:'Product', categoryCn:'产品责任', weight:0.12, unit:'score 0-10', description:'Product recalls, quality management systems' },
  { id:'S_PRIVACY_SECURITY', name:'Privacy & Data Security', nameCn:'隐私与数据安全', pillar:'S', category:'Product', categoryCn:'产品责任', weight:0.10, unit:'score 0-10', description:'Data breach history, privacy policies, GDPR compliance' },
  { id:'S_COMMUNITY_REL', name:'Community Relations', nameCn:'社区关系', pillar:'S', category:'Stakeholder', categoryCn:'利益相关方', weight:0.08, unit:'score 0-10', description:'Community engagement, local hiring, social investment' },
  { id:'S_ACCESS_TO_FIN', name:'Access to Finance', nameCn:'金融可及性', pillar:'S', category:'Stakeholder', categoryCn:'利益相关方', weight:0.08, unit:'score 0-10', description:'Providing financial services to underserved populations' },
  { id:'S_HEALTH_DEMO', name:'Health & Demographic Risk', nameCn:'健康人口风险', pillar:'S', category:'Stakeholder', categoryCn:'利益相关方', weight:0.07, unit:'score 0-10', description:'Exposure to health and demographic risk factors' },
  { id:'S_CHEMICAL_SAFETY', name:'Chemical Safety', nameCn:'化学品安全', pillar:'S', category:'Product', categoryCn:'产品责任', weight:0.08, unit:'score 0-10', description:'Chemical management and REACH compliance' },
  { id:'S_FIN_PRODUCT', name:'Responsible Investment Products', nameCn:'负责任投资产品', pillar:'S', category:'Product', categoryCn:'产品责任', weight:0.07, unit:'% AUM', description:'AUM in ESG/sustainable investment products' },
  // ═══ GOVERNANCE ═══════════════════════════════════════════════════════════
  { id:'G_BOARD_INDEP', name:'Board Independence', nameCn:'董事会独立性', pillar:'G', category:'Board', categoryCn:'董事会', weight:0.15, unit:'% independent', description:'Percentage of independent directors' },
  { id:'G_BOARD_DIVERSITY', name:'Board Diversity', nameCn:'董事会多样性', pillar:'G', category:'Board', categoryCn:'董事会', weight:0.10, unit:'% women', description:'Percentage of women on board' },
  { id:'G_EXEC_COMP', name:'Executive Compensation', nameCn:'高管薪酬', pillar:'G', category:'Compensation', categoryCn:'薪酬', weight:0.12, unit:'score 0-10', description:'Pay-for-performance alignment, clawback provisions' },
  { id:'G_OWNERSHIP', name:'Ownership Structure', nameCn:'所有权结构', pillar:'G', category:'Ownership', categoryCn:'所有权', weight:0.12, unit:'score 0-10', description:'Controlling shareholder, dual-class shares, takeover defenses' },
  { id:'G_AUDIT_QUALITY', name:'Audit & Accounting', nameCn:'审计与会计质量', pillar:'G', category:'Transparency', categoryCn:'透明度', weight:0.15, unit:'score 0-10', description:'Auditor independence, restatements, internal controls' },
  { id:'G_BUSINESS_ETHICS', name:'Business Ethics', nameCn:'商业道德', pillar:'G', category:'Transparency', categoryCn:'透明度', weight:0.13, unit:'score 0-10', description:'Anti-corruption, whistleblower protection, bribery policies' },
  { id:'G_TAX_TRANSPARENCY', name:'Tax Transparency', nameCn:'税收透明度', pillar:'G', category:'Transparency', categoryCn:'透明度', weight:0.10, unit:'score 0-10', description:'Tax strategy disclosure, country-by-country reporting' },
  { id:'G_SHAREHOLDER_RTS', name:'Shareholder Rights', nameCn:'股东权利', pillar:'G', category:'Ownership', categoryCn:'所有权', weight:0.13, unit:'score 0-10', description:'One-share-one-vote, proxy access, special meeting rights' },
];

// ── ESGDataSource ──────────────────────────────────────────────────────────

export class ESGDataSource {
  private indicators: Map<string, ESGIndicator> = new Map();
  private scores: Map<string, ESGScore> = new Map();
  private signals: ESGFactorSignal[] = [];
  private stats: ESGSourceStats = {
    totalScores: 0, lastUpdate: 0, signalsGenerated: 0, avgOverallScore: 0,
  };
  private signalHandlers: Array<(signal: ESGFactorSignal) => void> = [];

  constructor() {
    for (const ind of ESG_INDICATORS) this.indicators.set(ind.id, ind);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Indicators
  // ═══════════════════════════════════════════════════════════════════════

  getIndicators(pillar?: ESGPillar): ESGIndicator[] {
    let list = Array.from(this.indicators.values());
    if (pillar) list = list.filter(i => i.pillar === pillar);
    return list;
  }

  getIndicator(id: string): ESGIndicator | null {
    return this.indicators.get(id) ?? null;
  }

  getPillarWeights(): Record<ESGPillar, number> {
    const weights: Record<string, number> = { E: 0, S: 0, G: 0 };
    for (const ind of this.indicators.values()) weights[ind.pillar] += ind.weight;
    const total = weights.E + weights.S + weights.G;
    return {
      E: Math.round(weights.E / total * 100) / 100,
      S: Math.round(weights.S / total * 100) / 100,
      G: Math.round(weights.G / total * 100) / 100,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: ESG Scores
  // ═══════════════════════════════════════════════════════════════════════

  /** Ingest an ESG score for a company */
  ingestScore(score: ESGScore): void {
    this.scores.set(score.symbol, score);
    this.stats.totalScores = this.scores.size;
    this.stats.lastUpdate = Date.now();
    this._recalculateAvg();
    
    // Detect signals
    this._detectSignals(score);
  }

  /** Batch ingest ESG scores */
  ingestScores(scores: ESGScore[]): void {
    for (const s of scores) {
      this.scores.set(s.symbol, s);
    }
    this.stats.totalScores = this.scores.size;
    this.stats.lastUpdate = Date.now();
    this._recalculateAvg();
  }

  /** Get ESG score for a symbol */
  getScore(symbol: string): ESGScore | null {
    return this.scores.get(symbol) ?? null;
  }

  /** Get all ESG scores */
  getAllScores(): ESGScore[] {
    return Array.from(this.scores.values());
  }

  /** Get top ESG performers */
  getTopPerformers(limit = 10): ESGScore[] {
    return Array.from(this.scores.values())
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, limit);
  }

  /** Get bottom ESG performers */
  getBottomPerformers(limit = 10): ESGScore[] {
    return Array.from(this.scores.values())
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, limit);
  }

  /** Filter scores by rating */
  getByRating(rating: ESGRating): ESGScore[] {
    return Array.from(this.scores.values())
      .filter(s => s.overallRating === rating);
  }

  /** Filter scores by ESG momentum */
  getByMomentum(momentum: ESGMomentum): ESGScore[] {
    return Array.from(this.scores.values())
      .filter(s => s.momentum === momentum);
  }

  /** Get companies with controversies */
  getControversial(threshold = 3): ESGScore[] {
    return Array.from(this.scores.values())
      .filter(s => s.controversyScore < threshold)
      .sort((a, b) => a.controversyScore - b.controversyScore);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Portfolio ESG Analytics
  // ═══════════════════════════════════════════════════════════════════════

  /** Compute ESG stats for a portfolio */
  computePortfolioESG(holdings: Array<{ symbol: string; name: string; weight: number }>): ESGPortfolioStats {
    const rated: Array<{ symbol: string; name: string; score: ESGScore; weight: number }> = [];
    for (const h of holdings) {
      const s = this.scores.get(h.symbol);
      if (s) rated.push({ ...h, score: s });
    }

    if (rated.length === 0) {
      return {
        totalHoldings: holdings.length, ratedCount: 0, avgESGScore: 0, avgEScore: 0, avgSScore: 0, avgGScore: 0,
        ratingDistribution: {} as Record<ESGRating, number>, momentumBreakdown: {} as Record<ESGMomentum, number>,
        controversyCount: 0, topPerformers: [], bottomPerformers: [],
      };
    }

    let totalWeight = 0;
    let weightedESG = 0, weightedE = 0, weightedS = 0, weightedG = 0;
    const ratingDist: Record<string, number> = {};
    const momentumBreak: Record<string, number> = {};
    let controversyCount = 0;

    for (const r of rated) {
      totalWeight += r.weight;
      weightedESG += r.score.overallScore * r.weight;
      weightedE += r.score.scores.E.score * r.weight;
      weightedS += r.score.scores.S.score * r.weight;
      weightedG += r.score.scores.G.score * r.weight;
      ratingDist[r.score.overallRating] = (ratingDist[r.score.overallRating] ?? 0) + 1;
      momentumBreak[r.score.momentum] = (momentumBreak[r.score.momentum] ?? 0) + 1;
      if (r.score.controversyScore < 3) controversyCount++;
    }

    const sorted = [...rated].sort((a, b) => b.score.overallScore - a.score.overallScore);

    return {
      totalHoldings: holdings.length, ratedCount: rated.length,
      avgESGScore: Math.round(weightedESG / totalWeight * 100) / 100,
      avgEScore: Math.round(weightedE / totalWeight * 100) / 100,
      avgSScore: Math.round(weightedS / totalWeight * 100) / 100,
      avgGScore: Math.round(weightedG / totalWeight * 100) / 100,
      ratingDistribution: ratingDist as Record<ESGRating, number>,
      momentumBreakdown: momentumBreak as Record<ESGMomentum, number>,
      controversyCount,
      topPerformers: sorted.slice(0, 5).map(r => ({ symbol: r.symbol, name: r.name, score: r.score.overallScore })),
      bottomPerformers: sorted.slice(-5).reverse().map(r => ({ symbol: r.symbol, name: r.name, score: r.score.overallScore })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Signals
  // ═══════════════════════════════════════════════════════════════════════

  getSignals(limit = 50): ESGFactorSignal[] {
    return this.signals.slice(0, limit);
  }

  getStats(): ESGSourceStats {
    return { ...this.stats };
  }

  onSignal(handler: (signal: ESGFactorSignal) => void): () => void {
    this.signalHandlers.push(handler);
    return () => { const idx = this.signalHandlers.indexOf(handler); if (idx >= 0) this.signalHandlers.splice(idx, 1); };
  }

  reset(): void {
    this.scores.clear();
    this.signals = [];
    this.stats = { totalScores: 0, lastUpdate: 0, signalsGenerated: 0, avgOverallScore: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private
  // ═══════════════════════════════════════════════════════════════════════

  private _recalculateAvg(): void {
    const all = Array.from(this.scores.values());
    this.stats.avgOverallScore = all.length > 0
      ? Math.round(all.reduce((s, c) => s + c.overallScore, 0) / all.length * 100) / 100
      : 0;
  }

  private _detectSignals(score: ESGScore): void {
    // Controversy alert
    if (score.controversyScore < 2) {
      this._emitSignal(score, 'controversy', 'critical', 'bearish',
        `${score.companyName} severe ESG controversy (score ${score.controversyScore.toFixed(1)}) — major reputational risk`,
        `${score.companyName} ESG严重争议(${score.controversyScore.toFixed(1)}分) — 重大声誉风险`,
      );
    } else if (score.controversyScore < 4) {
      this._emitSignal(score, 'controversy', 'warning', 'bearish',
        `${score.companyName} ESG controversy detected (score ${score.controversyScore.toFixed(1)}) — monitor closely`,
        `${score.companyName} ESG争议(${score.controversyScore.toFixed(1)}分) — 需密切监控`,
      );
    }

    // Momentum alert
    if (score.momentum === 'deteriorating') {
      this._emitSignal(score, 'momentum_alert', 'warning', 'bearish',
        `${score.companyName} ESG momentum deteriorating — rating downgrade risk`,
        `${score.companyName} ESG动量恶化 — 评级下调风险`,
      );
    }

    // Pillar extreme
    if (score.scores.E.score < 2) {
      this._emitSignal(score, 'pillar_extreme', 'warning', 'bearish',
        `${score.companyName} environmental score critically low (${score.scores.E.score.toFixed(1)})`,
        `${score.companyName} 环境评分极低(${score.scores.E.score.toFixed(1)})`,
      );
    }
    if (score.scores.G.score < 2) {
      this._emitSignal(score, 'pillar_extreme', 'warning', 'bearish',
        `${score.companyName} governance score critically low (${score.scores.G.score.toFixed(1)}) — control risk elevated`,
        `${score.companyName} 治理评分极低(${score.scores.G.score.toFixed(1)}) — 管控风险`,
      );
    }
  }

  private _emitSignal(score: ESGScore, category: ESGFactorSignal['category'], severity: 'info' | 'warning' | 'critical', direction: 'bullish' | 'bearish' | 'neutral', message: string, messageCn: string): void {
    const signal: ESGFactorSignal = {
      signalId: `esg_${score.symbol}_${category}_${Date.now()}`,
      symbol: score.symbol, companyName: score.companyName, category, severity, direction, message, messageCn,
      score: score.overallScore, timestamp: Date.now(),
    };
    this.signals.unshift(signal);
    if (this.signals.length > 500) this.signals = this.signals.slice(0, 500);
    this.stats.signalsGenerated++;
    for (const h of this.signalHandlers) { try { h(signal); } catch { /* non-fatal */ } }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _esgSource: ESGDataSource | null = null;

export function getESGSource(): ESGDataSource {
  if (!_esgSource) _esgSource = new ESGDataSource();
  return _esgSource;
}

export function resetESGSource(): void {
  if (_esgSource) _esgSource.reset();
  _esgSource = null;
}
