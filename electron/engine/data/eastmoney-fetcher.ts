/**
 * R253 DS-03: 东方财富源管线 (EastMoneyFetcher)
 * 
 * QUANT MOO 数据基础 — 中国A股主力数据源
 * 
 * 功能:
 *   1. 实时行情 (个股+指数 — 沪/深/创业板/科创板)
 *   2. 板块资金流向 (行业资金净流入/净流出)
 *   3. 龙虎榜 (游资/机构席位追踪)
 *   4. 北向资金 (沪股通/深股通净流入+个股明细)
 *   5. 公告/研报摘要
 * 
 * 数据格式: 模拟东方财富 API 返回结构
 * 缓存: 行情5s刷新 / 资金流60s / 龙虎榜日更新
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type StockExchange = 'SH' | 'SZ' | 'BJ';
export type MarketBoard = '主板' | '创业板' | '科创板' | '北交所';
export type EastMoneySector = 'industry' | 'concept' | 'region';

export interface EastMoneyQuote {
  code: string;                 // e.g. '600519' or '000001'
  name: string;
  exchange: StockExchange;
  board: MarketBoard;
  price: number;
  change: number;              // price change
  changePercent: number;       // e.g. 3.5 = +3.5%
  open: number;
  high: number;
  low: number;
  preClose: number;
  volume: number;              // shares
  amount: number;              // yuan
  turnover: number;            // turnover rate %
  marketCap: number;           // total market cap in 亿
  pe: number;                  // P/E ratio
  pb: number;                  // P/B ratio
  highLow52w: { high: number; low: number };
  updateTime: number;
}

export interface SectorFlow {
  sectorId: string;
  sectorName: string;
  sectorType: EastMoneySector;
  netInflow: number;           // 亿 — positive=净流入
  mainNetInflow: number;       // 主力净流入 (亿)
  retailNetInflow: number;     // 散户净流入 (亿)
  topStock: string;            // 领涨股
  topStockChange: number;      // 领涨股涨跌幅
  stockCount: number;          // 成分股数
  upCount: number;
  downCount: number;
  updateTime: number;
}

export interface DragonTigerRecord {
  date: string;                // YYYY-MM-DD
  code: string;
  name: string;
  changePercent: number;
  reason: string;              // 上榜原因
  buyAmount: number;           // 买入总计 (万元)
  sellAmount: number;          // 卖出总计 (万元)
  netAmount: number;           // 净买入 (万元)
  topBuyDepts: Array<{ name: string; amount: number; type: '机构' | '游资' | '量化' }>;
  topSellDepts: Array<{ name: string; amount: number; type: '机构' | '游资' | '量化' }>;
}

export interface NorthBoundFlow {
  date: string;
  type: '沪股通' | '深股通';
  inflow: number;              // 亿 — positive=流入
  balance: number;             // 剩余额度 (亿)
  quota: number;               // 总额度 (亿)
  topBuyStocks: Array<{ code: string; name: string; netBuy: number }>;  // 亿
  topSellStocks: Array<{ code: string; name: string; netSell: number }>;
}

export interface EastMoneyAnnouncement {
  code: string;
  name: string;
  title: string;
  type: '公告' | '研报' | '快讯';
  summary: string;
  publishDate: string;
  source: string;
  importance: 1 | 2 | 3;      // 3=high
}

export interface EastMoneyMarketSnapshot {
  indices: {
    shanghai: EastMoneyQuote;  // 上证指数
    shenzhen: EastMoneyQuote;  // 深证成指
    chinext: EastMoneyQuote;   // 创业板指
    star50: EastMoneyQuote;    // 科创50
  };
  marketBreadth: {
    totalStocks: number;
    upStocks: number;
    downStocks: number;
    flatStocks: number;
    limitUp: number;           // 涨停
    limitDown: number;         // 跌停
  };
  totalTurnover: number;       // 两市成交额 (亿)
  updateTime: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// EastMoneyClient — 核心数据获取
// ═══════════════════════════════════════════════════════════════════════════

export class EastMoneyClient {
  private quoteCache: Map<string, EastMoneyQuote> = new Map();
  private flowCache: SectorFlow[] = [];
  private dragonTigerCache: DragonTigerRecord[] = [];
  private northBoundCache: NorthBoundFlow | null = null;
  private announcementCache: EastMoneyAnnouncement[] = [];
  private lastQuoteRefresh = 0;
  private lastFlowRefresh = 0;

  constructor() {
    this._seedQuotes();
    this._seedFlows();
    this._seedDragonTiger();
    this._seedNorthBound();
    this._seedAnnouncements();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 实时行情
  // ═══════════════════════════════════════════════════════════════════════

  /** Get quote for a single stock (with 5s cache) */
  getQuote(code: string): EastMoneyQuote | null {
    this._refreshQuotes();
    return this.quoteCache.get(code) ?? null;
  }

  /** Get quotes for multiple stocks */
  getQuotes(codes: string[]): EastMoneyQuote[] {
    this._refreshQuotes();
    return codes.map(c => this.quoteCache.get(c)).filter(Boolean) as EastMoneyQuote[];
  }

  /** Get all tracked quotes */
  getAllQuotes(): EastMoneyQuote[] {
    this._refreshQuotes();
    return Array.from(this.quoteCache.values());
  }

  /** Get market snapshot (indices + breadth) */
  getMarketSnapshot(): EastMoneyMarketSnapshot {
    this._refreshQuotes();

    const allQuotes = Array.from(this.quoteCache.values());
    const upStocks = allQuotes.filter(q => q.changePercent > 0).length;
    const downStocks = allQuotes.filter(q => q.changePercent < 0).length;
    const flatStocks = allQuotes.filter(q => q.changePercent === 0).length;
    const limitUp = allQuotes.filter(q => q.changePercent >= 9.9).length;
    const limitDown = allQuotes.filter(q => q.changePercent <= -9.9).length;

    return {
      indices: {
        shanghai: this.quoteCache.get('000001')!,
        shenzhen: this.quoteCache.get('399001')!,
        chinext: this.quoteCache.get('399006')!,
        star50: this.quoteCache.get('000688')!,
      },
      marketBreadth: {
        totalStocks: allQuotes.length,
        upStocks, downStocks, flatStocks, limitUp, limitDown,
      },
      totalTurnover: allQuotes.reduce((s, q) => s + q.amount, 0),
      updateTime: Date.now(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 板块资金流向
  // ═══════════════════════════════════════════════════════════════════════

  /** Get sector flows (60s cache) */
  getSectorFlows(type?: EastMoneySector): SectorFlow[] {
    this._refreshFlows();
    if (type) return this.flowCache.filter(f => f.sectorType === type);
    return [...this.flowCache];
  }

  /** Get top N inflow sectors */
  getTopInflowSectors(n = 5): SectorFlow[] {
    this._refreshFlows();
    return [...this.flowCache]
      .sort((a, b) => b.netInflow - a.netInflow)
      .slice(0, n);
  }

  /** Get top N outflow sectors */
  getTopOutflowSectors(n = 5): SectorFlow[] {
    this._refreshFlows();
    return [...this.flowCache]
      .sort((a, b) => a.netInflow - b.netInflow)
      .slice(0, n);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 龙虎榜
  // ═══════════════════════════════════════════════════════════════════════

  /** Get dragon tiger records for a date */
  getDragonTiger(date?: string): DragonTigerRecord[] {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    return this.dragonTigerCache.filter(r => r.date === targetDate);
  }

  /** Get top net buy records */
  getTopNetBuy(n = 10): DragonTigerRecord[] {
    return [...this.dragonTigerCache]
      .sort((a, b) => b.netAmount - a.netAmount)
      .slice(0, n);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. 北向资金
  // ═══════════════════════════════════════════════════════════════════════

  /** Get north-bound flow */
  getNorthBoundFlow(): NorthBoundFlow | null {
    return this.northBoundCache;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. 公告研报
  // ═══════════════════════════════════════════════════════════════════════

  /** Search announcements by code or keyword */
  searchAnnouncements(query: { code?: string; type?: EastMoneyAnnouncement['type']; importance?: number; limit?: number }): EastMoneyAnnouncement[] {
    let results = [...this.announcementCache];
    if (query.code) results = results.filter(a => a.code === query.code);
    if (query.type) results = results.filter(a => a.type === query.type);
    if (query.importance) results = results.filter(a => a.importance >= query.importance!);
    return results
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate))
      .slice(0, query.limit ?? 20);
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  reset(): void {
    this.quoteCache.clear();
    this.flowCache.length = 0;
    this.dragonTigerCache.length = 0;
    this.northBoundCache = null;
    this.announcementCache.length = 0;
    this.lastQuoteRefresh = 0;
    this.lastFlowRefresh = 0;
    this._seedQuotes();
    this._seedFlows();
    this._seedDragonTiger();
    this._seedNorthBound();
    this._seedAnnouncements();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: Seed Data
  // ═══════════════════════════════════════════════════════════════════════════

  private _refreshQuotes(): void {
    const now = Date.now();
    if (now - this.lastQuoteRefresh < 5000) return;
    this.lastQuoteRefresh = now;

    // Simulate slight price movements
    for (const [_, q] of this.quoteCache) {
      const drift = (this._hash(q.code + now.toString()) % 200 - 100) / 10000;
      q.price = Math.round((q.price * (1 + drift)) * 100) / 100;
      q.change = Math.round((q.price - q.preClose) * 100) / 100;
      q.changePercent = Math.round((q.price / q.preClose - 1) * 10000) / 100;
      q.updateTime = now;
    }
  }

  private _refreshFlows(): void {
    const now = Date.now();
    if (now - this.lastFlowRefresh < 60000) return;
    this.lastFlowRefresh = now;

    for (const flow of this.flowCache) {
      const drift = (this._hash(flow.sectorId + now.toString()) % 300 - 150) / 100;
      flow.netInflow = Math.round((flow.netInflow + drift) * 100) / 100;
      flow.updateTime = now;
    }
  }

  private _seedQuotes(): void {
    const stocks: Array<[string, string, StockExchange, MarketBoard, number, number, number]> = [
      // 指数
      ['000001', '上证指数', 'SH', '主板', 3350, 20e8, 15],
      ['399001', '深证成指', 'SZ', '主板', 10850, 15e8, 22],
      ['399006', '创业板指', 'SZ', '创业板', 2180, 8e8, 35],
      ['000688', '科创50', 'SH', '科创板', 1020, 5e8, 42],
      // 沪市主板
      ['600519', '贵州茅台', 'SH', '主板', 1780, 2e4, 32],
      ['601318', '中国平安', 'SH', '主板', 48.50, 8e6, 9.5],
      ['600036', '招商银行', 'SH', '主板', 38.20, 5e7, 6.8],
      ['601012', '隆基绿能', 'SH', '主板', 22.30, 3e7, 18],
      ['600276', '恒瑞医药', 'SH', '主板', 45.60, 1.5e7, 45],
      // 深市主板
      ['000858', '五粮液', 'SZ', '主板', 155.00, 1.2e7, 22],
      ['000333', '美的集团', 'SZ', '主板', 62.00, 8e6, 14],
      ['002415', '海康威视', 'SZ', '主板', 35.50, 6e6, 25],
      // 创业板
      ['300750', '宁德时代', 'SZ', '创业板', 210.00, 1.8e7, 28],
      ['300059', '东方财富', 'SZ', '创业板', 16.80, 2.5e7, 35],
      ['300274', '阳光电源', 'SZ', '创业板', 95.00, 8e6, 32],
      // 科创板
      ['688981', '中芯国际', 'SH', '科创板', 48.00, 1.2e7, 55],
      ['688111', '金山办公', 'SH', '科创板', 280.00, 3e6, 80],
      // 北交所
      ['430047', '诺思兰德', 'BJ', '北交所', 25.00, 1e6, 40],
    ];

    const now = Date.now();
    for (const [code, name, exchange, board, price, volume, pe] of stocks) {
      const seed = this._hash(code + 'quote');
      const changePct = (seed % 600 - 300) / 100; // -3% to +3%

      this.quoteCache.set(code, {
        code, name, exchange, board,
        price: Math.round(price * 100) / 100,
        change: Math.round(price * changePct / 100 * 100) / 100,
        changePercent: Math.round(changePct * 100) / 100,
        open: Math.round(price * (1 - 0.002) * 100) / 100,
        high: Math.round(price * 1.015 * 100) / 100,
        low: Math.round(price * 0.985 * 100) / 100,
        preClose: Math.round(price * (1 - changePct / 100) * 100) / 100,
        volume, amount: Math.round(volume * price / 1e8 * 100) / 100,
        turnover: Math.round((seed % 300 + 50) / 100 * 100) / 100,
        marketCap: Math.round(volume * price / 1e8 * 10) / 10,
        pe, pb: Math.round(pe / 3 * 10) / 10,
        highLow52w: { high: Math.round(price * 1.3 * 100) / 100, low: Math.round(price * 0.7 * 100) / 100 },
        updateTime: now,
      });
    }
  }

  private _seedFlows(): void {
    const sectors: Array<[string, string, EastMoneySector, number]> = [
      ['BK0001', '半导体', 'industry', 15.2],
      ['BK0002', '新能源车', 'industry', 22.8],
      ['BK0003', '人工智能', 'concept', 18.5],
      ['BK0004', '白酒', 'industry', -5.3],
      ['BK0005', '光伏', 'industry', 8.1],
      ['BK0006', '创新药', 'concept', 3.7],
      ['BK0007', '机器人', 'concept', 12.4],
      ['BK0008', '银行', 'industry', -2.1],
      ['BK0009', '房地产', 'industry', -8.5],
      ['BK0010', '国企改革', 'concept', 5.0],
      ['BK0011', '长三角', 'region', 2.3],
      ['BK0012', '粤港澳', 'region', 4.1],
    ];

    const now = Date.now();
    for (const [id, name, type, inflow] of sectors) {
      this.flowCache.push({
        sectorId: id, sectorName: name, sectorType: type,
        netInflow: inflow,
        mainNetInflow: Math.round(inflow * 0.7 * 100) / 100,
        retailNetInflow: Math.round(inflow * 0.3 * 100) / 100,
        topStock: name === '半导体' ? '中芯国际' : name === '白酒' ? '贵州茅台' : '宁德时代',
        topStockChange: this._hash(id) % 800 / 100 - 2,
        stockCount: 30 + (this._hash(id + 'n') % 50),
        upCount: 15 + (this._hash(id + 'u') % 20),
        downCount: 10 + (this._hash(id + 'd') % 15),
        updateTime: now,
      });
    }
  }

  private _seedDragonTiger(): void {
    const today = new Date().toISOString().slice(0, 10);
    const records: DragonTigerRecord[] = [
      {
        date: today, code: '300750', name: '宁德时代', changePercent: 8.2,
        reason: '日涨幅偏离值达7%',
        buyAmount: 85000, sellAmount: 62000, netAmount: 23000,
        topBuyDepts: [
          { name: '机构专用', amount: 28000, type: '机构' },
          { name: '深股通专用', amount: 22000, type: '机构' },
          { name: '华泰证券总部', amount: 15000, type: '量化' },
        ],
        topSellDepts: [
          { name: '招商证券深圳益田路', amount: 18000, type: '游资' },
          { name: '机构专用', amount: 15000, type: '机构' },
        ],
      },
      {
        date: today, code: '600519', name: '贵州茅台', changePercent: -3.5,
        reason: '日跌幅偏离值达7%',
        buyAmount: 120000, sellAmount: 185000, netAmount: -65000,
        topBuyDepts: [
          { name: '沪股通专用', amount: 55000, type: '机构' },
          { name: '中信证券总部', amount: 30000, type: '机构' },
        ],
        topSellDepts: [
          { name: '机构专用', amount: 80000, type: '机构' },
          { name: '中信证券上海分公司', amount: 35000, type: '游资' },
        ],
      },
      {
        date: today, code: '002415', name: '海康威视', changePercent: 10.0,
        reason: '连续三个交易日内涨幅偏离值累计达20%',
        buyAmount: 45000, sellAmount: 28000, netAmount: 17000,
        topBuyDepts: [
          { name: '深股通专用', amount: 18000, type: '机构' },
          { name: '机构专用', amount: 12000, type: '机构' },
        ],
        topSellDepts: [
          { name: '中金公司上海分公司', amount: 8000, type: '量化' },
        ],
      },
    ];
    this.dragonTigerCache = records;
  }

  private _seedNorthBound(): void {
    this.northBoundCache = {
      date: new Date().toISOString().slice(0, 10),
      type: '沪股通',
      inflow: 52.30,
      balance: 520 - 52.30,
      quota: 520,
      topBuyStocks: [
        { code: '600519', name: '贵州茅台', netBuy: 12.5 },
        { code: '601318', name: '中国平安', netBuy: 8.3 },
        { code: '600036', name: '招商银行', netBuy: 5.2 },
      ],
      topSellStocks: [
        { code: '601012', name: '隆基绿能', netSell: 3.5 },
        { code: '600276', name: '恒瑞医药', netSell: 2.8 },
      ],
    };
  }

  private _seedAnnouncements(): void {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    this.announcementCache = [
      {
        code: '300750', name: '宁德时代', title: '2026年半年度业绩预告',
        type: '公告', summary: '预计2026年上半年归母净利润同比增长35%-45%，动力电池出货量全球第一。',
        publishDate: today, source: '巨潮资讯网', importance: 3,
      },
      {
        code: '600519', name: '贵州茅台', title: '贵州茅台：提价预期升温，高端白酒景气度回升',
        type: '研报', summary: '中信证券维持"买入"评级，目标价2000元。茅台酒批价回升至2700元/瓶。',
        publishDate: today, source: '中信证券', importance: 2,
      },
      {
        code: '688981', name: '中芯国际', title: '中芯国际：14nm良率突破90%',
        type: '快讯', summary: '消息人士称中芯国际14nm制程良率已突破90%，有望提升产能利用率。',
        publishDate: today, source: '财联社', importance: 3,
      },
      {
        code: '000858', name: '五粮液', title: '第五届董事会第二十次会议决议公告',
        type: '公告', summary: '审议通过2025年度利润分配预案，拟10派45元。',
        publishDate: yesterday, source: '巨潮资讯网', importance: 2,
      },
      {
        code: '300059', name: '东方财富', title: '东方财富：AI投顾产品DAU突破500万',
        type: '研报', summary: '华泰证券维持"增持"评级。公司AI投顾产品增长超预期。',
        publishDate: yesterday, source: '华泰证券', importance: 2,
      },
      {
        code: '601012', name: '隆基绿能', title: '关于签订重大销售合同的公告',
        type: '公告', summary: '与某央企签订50GW光伏组件长期供货协议，合同金额预计超800亿元。',
        publishDate: yesterday, source: '巨潮资讯网', importance: 3,
      },
    ];
  }

  private _hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EastMoneyPipeline — 管线适配层 (对接 QUANT MOO engine)
// ═══════════════════════════════════════════════════════════════════════════

export interface EastMoneyPipelineConfig {
  refreshIntervalMs: number;     // default 5000
  maxSymbols: number;
  cacheEnabled: boolean;
}

export interface PipelineQuoteOutput {
  symbol: string;
  name: string;
  market: 'A';
  exchange: string;
  price: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  source: 'eastmoney';
}

export interface PipelineFlowOutput {
  sectorId: string;
  sectorName: string;
  netFlow: number;              // 亿
  direction: 'inflow' | 'outflow';
  timestamp: number;
}

export class EastMoneyPipeline {
  private client: EastMoneyClient;
  private config: EastMoneyPipelineConfig;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<EastMoneyPipelineConfig>) {
    this.client = new EastMoneyClient();
    this.config = {
      refreshIntervalMs: config?.refreshIntervalMs ?? 5000,
      maxSymbols: config?.maxSymbols ?? 50,
      cacheEnabled: config?.cacheEnabled ?? true,
    };
  }

  /** Get quotes in engine-compatible format */
  getEngineQuotes(codes?: string[]): PipelineQuoteOutput[] {
    const quotes = codes ? this.client.getQuotes(codes) : this.client.getAllQuotes();
    return quotes.slice(0, this.config.maxSymbols).map(q => ({
      symbol: `${q.exchange}:${q.code}`,
      name: q.name,
      market: 'A',
      exchange: q.exchange,
      price: q.price,
      changePercent: q.changePercent,
      volume: q.volume,
      timestamp: q.updateTime,
      source: 'eastmoney' as const,
    }));
  }

  /** Get sector flows in engine-compatible format */
  getEngineFlows(): PipelineFlowOutput[] {
    return this.client.getSectorFlows().map(f => ({
      sectorId: f.sectorId,
      sectorName: f.sectorName,
      netFlow: f.netInflow,
      direction: f.netInflow >= 0 ? 'inflow' : 'outflow',
      timestamp: f.updateTime,
    }));
  }

  /** Get market snapshot */
  getMarketSnapshot() { return this.client.getMarketSnapshot(); }

  /** Get dragon tiger (龙虎榜) */
  getDragonTiger(date?: string) { return this.client.getDragonTiger(date); }

  /** Get north-bound flow (北向资金) */
  getNorthBoundFlow() { return this.client.getNorthBoundFlow(); }

  /** Search announcements */
  searchAnnouncements(code: string, limit?: number) {
    return this.client.searchAnnouncements({ code, limit });
  }

  /** Start auto-refresh */
  startAutoRefresh(onData: (quotes: PipelineQuoteOutput[]) => void): void {
    this.stopAutoRefresh();
    this.interval = setInterval(() => {
      onData(this.getEngineQuotes());
    }, this.config.refreshIntervalMs);
  }

  /** Stop auto-refresh */
  stopAutoRefresh(): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  /** Access raw client for advanced queries */
  getClient(): EastMoneyClient { return this.client; }

  reset(): void {
    this.stopAutoRefresh();
    this.client.reset();
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: EastMoneyPipeline | null = null;

export function eastMoneyPipeline(config?: Partial<EastMoneyPipelineConfig>): EastMoneyPipeline {
  if (!instance) instance = new EastMoneyPipeline(config);
  return instance;
}

export function resetEastMoneyPipeline(): void { instance?.reset(); instance = null; }
