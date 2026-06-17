// ── R274 JVS-3 🇭🇰 6指标引擎 (HKIndicatorsEngine) ──
// 港交所6大核心指标: AH溢价(132/134)/卖空比率/牛熊证街货/窝轮成交/港股通南向/北向流动

export interface AHPremium {
  date: string;
  ahPremiumIndex: number; // Hang Seng AH Premium Index (HKEX code: 132)
  dollarPriceIndex: number; // index value
  interpretation: 'A_expensive' | 'H_expensive' | 'balanced';
  aPremiumStocks: AHPremiumStock[];
}

export interface AHPremiumStock {
  code: string; name: string;
  aSharePriceCNY: number;
  hSharePriceHKD: number;
  premiumPercent: number; // (A/H - 1) * 100, positive = A premium
  signal: 'buy_H' | 'buy_A' | 'arbitrage_close';
}

export interface ShortSellIndicator {
  date: string;
  shortSellRatio: number; // % of total turnover
  shortSellAmount: number; // HKD million
  totalTurnover: number; // HKD million
  ssi: number; // Short Sell Sentiment Index (20d normalized)
  trend: 'declining' | 'rising' | 'stable';
  alert: boolean; // SSI > 80th percentile or < 20th
  sectorShort: SectorShortSell[];
}

export interface SectorShortSell {
  sector: string; ratio: number; amt: number;
  weekAgo: number; monthAgo: number; trend: 'increasing' | 'decreasing' | 'stable';
}

export interface CBBCStreetIndicator {
  date: string;
  bullStreet: number; // streets (1 street = 1 index level)
  bearStreet: number;
  bullBearRatio: number;
  nearestBull: number; // nearest bull street level
  nearestBear: number;
  maxBullStreet: number; // heaviest kill zone
  maxBearStreet: number;
  totalBullTurnover: number; fullBearTurnover: number;
  sentiment: 'bull_dominant' | 'bear_dominant' | 'balanced';
}

export interface WarrantIndicator {
  date: string;
  totalTurnover: number; // HKD bil
  totalIssues: number;
  callTurnover: number; putTurnover: number;
  callPutRatio: number;
  top10Underliers: { code: string; name: string; turnover: number; percent: number }[];
  marketShare: { issuer: string; turnover: number; percent: number }[];
}

export interface SouthBoundIndicator {
  date: string;
  southBoundNet: number; // 港股通(沪+深), RMB 亿
  shanghaiConnect: number;
  shenzhenConnect: number;
  dailyQuotaUsageSH: number; // %
  dailyQuotaUsageSZ: number; // %
  topBuy: { code: string; name: string; amt: number }[]; // top 10
  topSell: { code: string; name: string; amt: number }[];
  cumulativeBalance: number; // 累计净买入
  consecutiveNetInflow: number;
}

export interface NorthBoundIndicator {
  date: string;
  northBoundNet: number; // 陆股通(沪+深), RMB 亿
  cumulativeBalance: number;
  fiiActive: number; // active foreign net flow
  fiiPassive: number; // ETF/index-tracking flow
  topBuy: { code: string; name: string; amt: number }[];
  topSell: { code: string; name: string; amt: number }[];
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class HKIndicatorsEngine {
  private ahPremium: AHPremium[] = [];
  private shortSell: ShortSellIndicator[] = [];
  private cbbc: CBBCStreetIndicator[] = [];
  private warrant: WarrantIndicator[] = [];
  private southBound: SouthBoundIndicator[] = [];
  private northBound: NorthBoundIndicator[] = [];

  reset(): void {
    this.ahPremium = []; this.shortSell = []; this.cbbc = [];
    this.warrant = []; this.southBound = []; this.northBound = [];
  }

  // ═══════════ 1. AH溢价指标 ═══════════

  loadAHPremium(data: AHPremium[]): number { this.ahPremium.push(...data); return data.length; }

  getLatestAHPremium(): AHPremium | null { return this.ahPremium[this.ahPremium.length - 1] || null; }

  getAHPremiumHistory(days: number): AHPremium[] { return this.ahPremium.slice(-days); }

  detectArbitrageOpportunities(): AHPremiumStock[] {
    const latest = this.getLatestAHPremium();
    if (!latest) return [];
    return latest.aPremiumStocks.filter(s => Math.abs(s.premiumPercent) > 10);
  }

  /** AH溢价指数历史分析: A贵→H有吸引力，H贵→A有吸引力 */
  analyzeAHPremium(): { trend: 'A_premium_widening' | 'H_recovering' | 'stable'; avgPremium: number; signal: string } {
    const last30 = this.ahPremium.slice(-30);
    const avg = last30.length > 0 ? last30.reduce((s, d) => s + d.ahPremiumIndex, 0) / last30.length : 100;
    const recent = last30.slice(-5).reduce((s, d) => s + d.ahPremiumIndex, 0) / Math.max(1, last30.slice(-5).length);
    const trend = recent > avg + 5 ? 'A_premium_widening' : recent < avg - 5 ? 'H_recovering' : 'stable';
    return { trend, avgPremium: Number(avg.toFixed(1)), signal: trend === 'H_recovering' ? 'BUY_H' : trend === 'A_premium_widening' ? 'BUY_A' : 'HOLD' };
  }

  // ═══════════ 2. 卖空比率指标 ═══════════

  loadShortSell(data: ShortSellIndicator[]): number { this.shortSell.push(...data); return data.length; }

  getLatestShortSell(): ShortSellIndicator | null { return this.shortSell[this.shortSell.length - 1] || null; }

  getShortSellHistory(days: number): ShortSellIndicator[] { return this.shortSell.slice(-days); }

  /** 卖空比率趋势分析：>20% 高度做空，>25% 极致悲观 */
  analyzeShortSell(): { ratio: number; signal: string; ssi: number; sectorsHighShort: string[] } {
    const latest = this.getLatestShortSell();
    if (!latest) return { ratio: 0, signal: 'N/A', ssi: 0, sectorsHighShort: [] };
    const signal = latest.shortSellRatio > 25 ? 'EXTREME_PESSIMISM' : latest.shortSellRatio > 20 ? 'HIGH_SHORT' : latest.shortSellRatio > 15 ? 'ELEVATED' : 'NORMAL';
    const highShort = latest.sectorShort.filter(s => s.ratio > 20).map(s => s.sector);
    return { ratio: latest.shortSellRatio, signal, ssi: latest.ssi, sectorsHighShort: highShort };
  }

  // ═══════════ 3. 牛熊证街货指标 ═══════════

  loadCBBC(data: CBBCStreetIndicator[]): number { this.cbbc.push(...data); return data.length; }

  getLatestCBBC(): CBBCStreetIndicator | null { return this.cbbc[this.cbbc.length - 1] || null; }

  /** 牛熊证重街货区域 → 大市可能被引导至这些区域 */
  findCBBCKillZones(): { bullKillZone: number; bearKillZone: number; distanceToBull: number; distanceToBear: number } | null {
    const latest = this.getLatestCBBC();
    if (!latest) return null;
    return {
      bullKillZone: latest.maxBullStreet, bearKillZone: latest.maxBearStreet,
      distanceToBull: 0, distanceToBear: 0,
    };
  }

  // ═══════════ 4. 窝轮指标 ═══════════

  loadWarrant(data: WarrantIndicator[]): number { this.warrant.push(...data); return data.length; }

  getLatestWarrant(): WarrantIndicator | null { return this.warrant[this.warrant.length - 1] || null; }

  /** Call/Put比率 >1.2做多情绪，<0.8做空 */
  getWarrantSentiment(): { callPutRatio: number; sentiment: 'bullish' | 'bearish' | 'neutral'; topUnderlier: string } {
    const latest = this.getLatestWarrant();
    if (!latest) return { callPutRatio: 0, sentiment: 'neutral', topUnderlier: '-' };
    const sentiment = latest.callPutRatio > 1.2 ? 'bullish' : latest.callPutRatio < 0.8 ? 'bearish' : 'neutral';
    return { callPutRatio: latest.callPutRatio, sentiment, topUnderlier: latest.top10Underliers[0]?.name || '-' };
  }

  // ═══════════ 5. 南向资金 ═══════════

  loadSouthBound(data: SouthBoundIndicator[]): number { this.southBound.push(...data); return data.length; }

  getLatestSouthBound(): SouthBoundIndicator | null { return this.southBound[this.southBound.length - 1] || null; }

  getSouthBoundHistory(days: number): SouthBoundIndicator[] { return this.southBound.slice(-days); }

  /** 南向资金分析: 持续流入→港股支撑，流出→警惕 */
  analyzeSouthBound(): { net30d: number; consecutive: number; signal: 'strong_inflow' | 'inflow' | 'neutral' | 'outflow' | 'strong_outflow' } {
    const last30 = this.southBound.slice(-30);
    const net30d = last30.reduce((s, d) => s + d.southBoundNet, 0);
    const latest = this.getLatestSouthBound();
    const signal = net30d > 500 ? 'strong_inflow' : net30d > 200 ? 'inflow' : net30d > -100 ? 'neutral' : net30d > -300 ? 'outflow' : 'strong_outflow';
    return { net30d: Number(net30d.toFixed(1)), consecutive: latest?.consecutiveNetInflow || 0, signal };
  }

  // ═══════════ 6. 北向资金 ═══════════

  loadNorthBound(data: NorthBoundIndicator[]): number { this.northBound.push(...data); return data.length; }

  getLatestNorthBound(): NorthBoundIndicator | null { return this.northBound[this.northBound.length - 1] || null; }

  /** 北向FII拆解: 被动(ETF)vs主动 */
  analyzeNorthBoundComposition(): { total: number; active: number; passive: number; activeRatio: number; quality: 'smart' | 'passive' | 'mixed' } {
    const latest = this.getLatestNorthBound();
    if (!latest) return { total: 0, active: 0, passive: 0, activeRatio: 0, quality: 'mixed' };
    const activeRatio = latest.fiiActive / (latest.fiiActive + latest.fiiPassive || 1);
    return {
      total: latest.northBoundNet, active: latest.fiiActive, passive: latest.fiiPassive,
      activeRatio: Number(activeRatio.toFixed(2)),
      quality: activeRatio > 0.7 ? 'smart' : activeRatio < 0.3 ? 'passive' : 'mixed',
    };
  }

  // ═══════════ 综合面板 ═══════════

  getDashboard(): {
    ah: { premium: number; signal: string };
    shortSell: { ratio: number; signal: string };
    cbbc: { bullBearRatio: number; sentiment: string };
    warrant: { cpr: number; sentiment: string };
    south: { net30d: number; signal: string };
    north: { total: number; quality: string };
  } | null {
    const ah = this.getLatestAHPremium();
    const ss = this.getLatestShortSell();
    const cb = this.getLatestCBBC();
    const w = this.getLatestWarrant();
    const sb = this.analyzeSouthBound();
    const nb = this.analyzeNorthBoundComposition();

    return {
      ah: { premium: ah?.ahPremiumIndex || 100, signal: this.analyzeAHPremium().signal },
      shortSell: { ratio: ss?.shortSellRatio || 0, signal: this.analyzeShortSell().signal },
      cbbc: { bullBearRatio: cb?.bullBearRatio || 1, sentiment: cb?.sentiment || 'balanced' },
      warrant: { cpr: this.getWarrantSentiment().callPutRatio, sentiment: this.getWarrantSentiment().sentiment },
      south: { net30d: sb.net30d, signal: sb.signal },
      north: { total: nb.total, quality: nb.quality },
    };
  }

  // ═══════════ Seed ═══════════

  seed(): void {
    for (let d = 30; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      // AH Premium
      this.ahPremium.push({
        date, ahPremiumIndex: 98 + Math.random() * 10, dollarPriceIndex: 200 + Math.random() * 50,
        interpretation: 'A_expensive',
        aPremiumStocks: [
          { code: '601398', name: '工商银行', aSharePriceCNY: 5.2, hSharePriceHKD: 4.3, premiumPercent: 30 + Math.random() * 10, signal: 'buy_H' },
          { code: '601939', name: '建设银行', aSharePriceCNY: 6.8, hSharePriceHKD: 5.5, premiumPercent: 32 + Math.random() * 10, signal: 'buy_H' },
        ],
      });
      // Short Sell
      this.shortSell.push({
        date, shortSellRatio: 12 + Math.random() * 8, shortSellAmount: 15000 + Math.random() * 10000, totalTurnover: 80000 + Math.random() * 40000,
        ssi: 40 + Math.random() * 40, trend: Math.random() > 0.5 ? 'rising' : 'stable', alert: Math.random() > 0.85,
        sectorShort: [{ sector: 'Tech', ratio: 18, amt: 2000, weekAgo: 16, monthAgo: 15, trend: 'increasing' }, { sector: 'Property', ratio: 25, amt: 1500, weekAgo: 22, monthAgo: 20, trend: 'increasing' }],
      });
      // CBBC
      this.cbbc.push({
        date, bullStreet: 6, bearStreet: 4, bullBearRatio: 1.5, nearestBull: 22800, nearestBear: 23200,
        maxBullStreet: 22500, maxBearStreet: 23500, totalBullTurnover: 80, fullBearTurnover: 60, sentiment: 'bull_dominant',
      });
      // Warrant
      this.warrant.push({
        date, totalTurnover: 10 + Math.random() * 5, totalIssues: 5500,
        callTurnover: 6 + Math.random() * 4, putTurnover: 4 + Math.random() * 3,
        callPutRatio: 1.2 + Math.random() * 0.5,
        top10Underliers: [{ code: '00700', name: '腾讯', turnover: 2000, percent: 20 }, { code: '09988', name: 'Alibaba', turnover: 1500, percent: 15 }],
        marketShare: [{ issuer: 'SG', turnover: 3000, percent: 30 }, { issuer: 'HSBC', turnover: 2500, percent: 25 }],
      });
      // SouthBound
      this.southBound.push({
        date, southBoundNet: 20 + Math.random() * 40, shanghaiConnect: 15 + Math.random() * 25, shenzhenConnect: 5 + Math.random() * 15,
        dailyQuotaUsageSH: 30 + Math.random() * 30, dailyQuotaUsageSZ: 20 + Math.random() * 20,
        topBuy: [{ code: '00941', name: '中移动', amt: 1000 }, { code: '00883', name: '中海油', amt: 800 }],
        topSell: [{ code: '00388', name: '港交所', amt: 500 }],
        cumulativeBalance: 15000 + Math.random() * 1000, consecutiveNetInflow: 10 + Math.floor(Math.random() * 10),
      });
      this.northBound.push({
        date, northBoundNet: 10 + Math.random() * 20, cumulativeBalance: 18000 + Math.random() * 500,
        fiiActive: 5 + Math.random() * 10, fiiPassive: 5 + Math.random() * 8,
        topBuy: [{ code: '600519', name: '茅台', amt: 800 }], topSell: [{ code: '000858', name: '五粮液', amt: 400 }],
      });
    }
  }
}

// ═══════════ Singleton ═══════════

let hk6Instance: HKIndicatorsEngine | null = null;
export function getHKIndicatorsEngine(): HKIndicatorsEngine {
  if (!hk6Instance) hk6Instance = new HKIndicatorsEngine();
  return hk6Instance;
}
export function resetHKIndicatorsEngine(): void { hk6Instance = null; }
