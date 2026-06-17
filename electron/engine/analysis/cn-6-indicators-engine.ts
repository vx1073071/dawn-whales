// ── R274 JVS-4 🇨🇳 6指标引擎 (CNIndicatorsEngine) ──
// A股6大核心指标: 两融杠杆/龙虎榜/新股破发率/ETF净申购/北向持仓/公募仓位

export interface MarginIndicator {
  date: string;
  marginBalance: number; // 融资余额, RMB 亿
  marginBuy: number; // 融资买入额
  marginRepay: number; // 融资偿还额
  shortBalance: number; // 融券余额
  shortVolume: number; // 融券卖出量
  totalBalance: number; // 两融总额
  leverage: number; // 占流通市值%
  signal: 'overheated' | 'elevated' | 'normal' | 'depressed' | 'frozen';
  trend: 'accumulating' | 'reducing' | 'stable';
}

export interface DragonTigerIndicator {
  date: string;
  totalBuy: number; // 龙虎榜买入总额, RMB 亿
  totalSell: number; // 龙虎榜卖出总额
  netBuy: number;
  institutionBuy: number; // 机构席位买入
  institutionSell: number;
  institutionNet: number;
  retailSentiment: 'fomo' | 'greed' | 'neutral' | 'fear' | 'panic';
  hotSectors: { sector: string; netBuy: number; stocks: string[] }[];
}

export interface IPOBreakIndicator {
  date: string;
  newListings: number; // 当日新股数
  breakCount: number; // 当日破发数
  breakRate: number; // % of new listings breaking issue price
  breakRate30d: number; // trailing 30d
  avgFirstDayReturn: number; // % return on first day
  avgFirstWeekReturn: number;
  signal: 'extremely_cold' | 'cold' | 'normal' | 'hot' | 'overheated';
}

export interface ETFIndicator {
  date: string;
  totalNetSub: number; // 全市场ETF净申购, RMB 亿
  equityETFSub: number; // 股票型ETF净申购
  bondETFSub: number; // 债券型ETF净申购
  industryETFSub: number; // 行业ETF净申购
  topInflows: { code: string; name: string; netSub: number }[];
  topOutflows: { code: string; name: string; netSub: number }[];
  smartMoneySignal: 'accumulating' | 'distributing' | 'neutral';
}

export interface NorthHoldingsIndicator {
  date: string;
  totalHoldingValue: number; // 北向持仓总市值, RMB 亿
  totalHoldingChange: number; // 日变动
  sectorAllocation: { sector: string; value: number; change: number; percent: number }[];
  topAdditions: { code: string; name: string; change: number }[]; // 加仓最多
  topReductions: { code: string; name: string; change: number }[]; // 减仓最多
  holdingConcentration: number; // top10 集中度
}

export interface FundPositionIndicator {
  date: string;
  avgEquityPosition: number; // 平均股票仓位%
  medianPosition: number;
  highPositionFunds: number; // 仓位>90% 的基金数
  lowPositionFunds: number; // 仓位<60% 的基金数
  positionChange: number; // 仓位环比变化
  cashReserve: number; // 现金储备%, 可用于加仓
  signal: 'bullish_cash' | 'fully_invested' | 'de-risking' | 'neutral';
}

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class CNIndicatorsEngine {
  private margin: MarginIndicator[] = [];
  private dragonTiger: DragonTigerIndicator[] = [];
  private ipoBreak: IPOBreakIndicator[] = [];
  private etf: ETFIndicator[] = [];
  private northHoldings: NorthHoldingsIndicator[] = [];
  private fundPosition: FundPositionIndicator[] = [];

  reset(): void {
    this.margin = []; this.dragonTiger = []; this.ipoBreak = [];
    this.etf = []; this.northHoldings = []; this.fundPosition = [];
  }

  // ═══════════ 1. 两融杠杆指标 ═══════════

  loadMargin(data: MarginIndicator[]): number { this.margin.push(...data); return data.length; }

  getLatestMargin(): MarginIndicator | null { return this.margin[this.margin.length - 1] || null; }

  getMarginHistory(days: number): MarginIndicator[] { return this.margin.slice(-days); }

  /** 两融余额趋势：融资>1.8万亿→过热，<1.2万亿→低迷 */
  analyzeMargin(): { balance: number; leverage: number; signal: string; marginBuyRatio: number } {
    const latest = this.getLatestMargin();
    if (!latest) return { balance: 0, leverage: 0, signal: 'N/A', marginBuyRatio: 0 };
    const ratio = latest.totalBalance > 0 ? latest.marginBuy / (latest.marginBuy + latest.marginRepay || 1) * 100 : 50;
    return { balance: latest.marginBalance, leverage: latest.leverage, signal: latest.signal, marginBuyRatio: Number(ratio.toFixed(1)) };
  }

  /** 融资融券比率: 融券↑→做空活跃 */
  getShortBalanceRatio(): { margin: number; short: number; ratio: number; trend: string } {
    const latest = this.getLatestMargin();
    if (!latest) return { margin: 0, short: 0, ratio: 0, trend: 'N/A' };
    const ratio = latest.marginBalance > 0 ? latest.shortBalance / latest.marginBalance * 100 : 0;
    const trend = this.margin.slice(-5).reduce((s, d) => s + (d.shortBalance > d.marginBalance * 0.01 ? 1 : 0), 0) >= 3 ? 'SHORT_BUILDING' : 'NORMAL';
    return { margin: latest.marginBalance, short: latest.shortBalance, ratio: Number(ratio.toFixed(2)), trend };
  }

  // ═══════════ 2. 龙虎榜指标 ═══════════

  loadDragonTiger(data: DragonTigerIndicator[]): number { this.dragonTiger.push(...data); return data.length; }

  getLatestDragonTiger(): DragonTigerIndicator | null { return this.dragonTiger[this.dragonTiger.length - 1] || null; }

  /** 龙虎榜机构净买入→聪明钱方向 */
  analyzeDragonTiger(): { institutionNet: number; totalNet: number; signal: string; hotSectors: string } {
    const latest = this.getLatestDragonTiger();
    if (!latest) return { institutionNet: 0, totalNet: 0, signal: 'N/A', hotSectors: '-' };
    const signal = latest.institutionNet > 10 ? 'INSTITUTION_BUYING' : latest.institutionNet < -10 ? 'INSTITUTION_SELLING' : 'NEUTRAL';
    return { institutionNet: latest.institutionNet, totalNet: latest.netBuy, signal, hotSectors: latest.hotSectors.map(s => s.sector).join(', ') };
  }

  // ═══════════ 3. 新股破发率指标 ═══════════

  loadIPOBreak(data: IPOBreakIndicator[]): number { this.ipoBreak.push(...data); return data.length; }

  getLatestIPOBreak(): IPOBreakIndicator | null { return this.ipoBreak[this.ipoBreak.length - 1] || null; }

  /** 破发率>50%→市场冰点，<10%→过热 */
  analyzeIPOBreak(): { breakRate: number; firstDayReturn: number; signal: string; historicalPercentile: number } {
    const latest = this.getLatestIPOBreak();
    if (!latest) return { breakRate: 0, firstDayReturn: 0, signal: 'N/A', historicalPercentile: 50 };
    const allRates = this.ipoBreak.map(d => d.breakRate).sort((a, b) => a - b);
    const percentile = allRates.length > 0 ? allRates.filter(r => r <= latest.breakRate).length / allRates.length * 100 : 50;
    return { breakRate: latest.breakRate, firstDayReturn: latest.avgFirstDayReturn, signal: latest.signal, historicalPercentile: Number(percentile.toFixed(1)) };
  }

  // ═══════════ 4. ETF净申购指标 ═══════════

  loadETF(data: ETFIndicator[]): number { this.etf.push(...data); return data.length; }

  getLatestETF(): ETFIndicator | null { return this.etf[this.etf.length - 1] || null; }

  getETFHistory(days: number): ETFIndicator[] { return this.etf.slice(-days); }

  /** ETF大额申购→机构底部建仓信号 */
  analyzeETF(): { netSub: number; equitySub: number; signal: string; smartMoneyDirection: string } {
    const latest = this.getLatestETF();
    if (!latest) return { netSub: 0, equitySub: 0, signal: 'N/A', smartMoneyDirection: 'N/A' };
    return { netSub: latest.totalNetSub, equitySub: latest.equityETFSub, signal: latest.smartMoneySignal, smartMoneyDirection: latest.equityETFSub > 100 ? 'BOTTOM_BUILDING' : latest.equityETFSub < -50 ? 'DISTRIBUTING' : 'HOLDING' };
  }

  // ═══════════ 5. 北向持仓指标 ═══════════

  loadNorthHoldings(data: NorthHoldingsIndicator[]): number { this.northHoldings.push(...data); return data.length; }

  getLatestNorthHoldings(): NorthHoldingsIndicator | null { return this.northHoldings[this.northHoldings.length - 1] || null; }

  /** 北向持仓行业配置分析 */
  analyzeNorthHoldings(): { totalValue: number; change: number; topSector: string; bottomSector: string } {
    const latest = this.getLatestNorthHoldings();
    if (!latest) return { totalValue: 0, change: 0, topSector: '-', bottomSector: '-' };
    const sorted = [...latest.sectorAllocation].sort((a, b) => b.change - a.change);
    return { totalValue: latest.totalHoldingValue, change: latest.totalHoldingChange, topSector: sorted[0]?.sector || '-', bottomSector: sorted[sorted.length - 1]?.sector || '-' };
  }

  // ═══════════ 6. 公募仓位指标 ═══════════

  loadFundPosition(data: FundPositionIndicator[]): number { this.fundPosition.push(...data); return data.length; }

  getLatestFundPosition(): FundPositionIndicator | null { return this.fundPosition[this.fundPosition.length - 1] || null; }

  /** 公募仓位>90%=88魔咒→市场顶部信号 */
  analyzeFundPosition(): { avgPos: number; median: number; cash: number; signal: string; isFull: boolean } {
    const latest = this.getLatestFundPosition();
    if (!latest) return { avgPos: 85, median: 87, cash: 10, signal: 'N/A', isFull: false };
    const isFull = latest.avgEquityPosition > 88;
    return { avgPos: latest.avgEquityPosition, median: latest.medianPosition, cash: latest.cashReserve, signal: latest.signal, isFull };
  }

  // ═══════════ 综合面板 ═══════════

  getDashboard(): {
    margin: { balance: number; leverage: number; signal: string };
    dragonTiger: { institutionNet: number; signal: string };
    ipo: { breakRate: number; signal: string };
    etf: { netSub: number; direction: string };
    north: { totalValue: number; topSector: string };
    fund: { avgPos: number; isFull: boolean };
  } | null {
    return {
      margin: this.analyzeMargin(),
      dragonTiger: this.analyzeDragonTiger(),
      ipo: this.analyzeIPOBreak(),
      etf: this.analyzeETF(),
      north: this.analyzeNorthHoldings(),
      fund: this.analyzeFundPosition(),
    };
  }

  // ═══════════ Seed ═══════════

  seed(): void {
    for (let d = 30; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      this.margin.push({
        date, marginBalance: 14000 + Math.random() * 2000, marginBuy: 600 + Math.random() * 400, marginRepay: 500 + Math.random() * 400,
        shortBalance: 800 + Math.random() * 200, shortVolume: 50 + Math.random() * 50, totalBalance: 14800 + Math.random() * 2200,
        leverage: 2.1 + Math.random() * 0.5, signal: Math.random() > 0.7 ? 'overheated' : Math.random() > 0.5 ? 'elevated' : 'normal', trend: Math.random() > 0.6 ? 'accumulating' : 'stable',
      });
      this.dragonTiger.push({
        date, totalBuy: 80 + Math.random() * 120, totalSell: 70 + Math.random() * 100, netBuy: 10 + (Math.random() - 0.3) * 40,
        institutionBuy: 30 + Math.random() * 50, institutionSell: 20 + Math.random() * 40, institutionNet: 10 + (Math.random() - 0.3) * 30,
        retailSentiment: Math.random() > 0.6 ? 'greed' : Math.random() > 0.4 ? 'neutral' : 'fear',
        hotSectors: [{ sector: 'TMT', netBuy: 15, stocks: ['600519'] }, { sector: '新能源', netBuy: 10, stocks: ['300750'] }],
      });
      this.ipoBreak.push({
        date, newListings: 0, breakCount: 0, breakRate: 20 + Math.random() * 30, breakRate30d: 25 + Math.random() * 20,
        avgFirstDayReturn: 30 - Math.random() * 20, avgFirstWeekReturn: 25 - Math.random() * 15, signal: 'normal',
      });
      this.etf.push({
        date, totalNetSub: 50 + (Math.random() - 0.3) * 100, equityETFSub: 30 + (Math.random() - 0.3) * 80, bondETFSub: 15 + Math.random() * 30, industryETFSub: 5 + (Math.random() - 0.3) * 20,
        topInflows: [{ code: '510300', name: '沪深300ETF', netSub: 20 + Math.random() * 30 }],
        topOutflows: [{ code: '510500', name: '中证500ETF', netSub: -10 - Math.random() * 20 }],
        smartMoneySignal: Math.random() > 0.6 ? 'accumulating' : Math.random() > 0.4 ? 'neutral' : 'distributing',
      });
      this.northHoldings.push({
        date, totalHoldingValue: 22000 + Math.random() * 1000, totalHoldingChange: (Math.random() - 0.5) * 100, holdingConcentration: 45 + Math.random() * 10,
        sectorAllocation: [{ sector: '食品饮料', value: 4000, change: 20 + Math.random() * 30, percent: 18 }, { sector: '新能源', value: 3500, change: -10 + Math.random() * 30, percent: 16 }, { sector: '金融', value: 3000, change: (Math.random() - 0.5) * 20, percent: 14 }],
        topAdditions: [{ code: '600519', name: '茅台', change: 10 + Math.random() * 15 }], topReductions: [{ code: '000858', name: '五粮液', change: -5 - Math.random() * 10 }],
      });
      this.fundPosition.push({
        date, avgEquityPosition: 82 + Math.random() * 8, medianPosition: 85 + Math.random() * 8, highPositionFunds: 500 + Math.random() * 200,
        lowPositionFunds: 100 + Math.random() * 100, positionChange: (Math.random() - 0.5) * 3, cashReserve: 10 + Math.random() * 5,
        signal: Math.random() > 0.5 ? 'fully_invested' : 'neutral',
      });
    }
  }
}

// ═══════════ Singleton ═══════════

let cn6Instance: CNIndicatorsEngine | null = null;
export function getCNIndicatorsEngine(): CNIndicatorsEngine {
  if (!cn6Instance) cn6Instance = new CNIndicatorsEngine();
  return cn6Instance;
}
export function resetCNIndicatorsEngine(): void { cn6Instance = null; }
