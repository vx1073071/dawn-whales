/**
 * R241 JVS#3: RegulatoryTrackerV2 — 监管追踪扩展
 *
 * Extends R240 RegulatoryTracker with:
 *   1. 中文政策源: 国务院+发改委+证监会+银保监+工信部+央行+外汇局
 *   2. 加密监管: SEC Crypto+CFTC+MICA+香港SFC加密+VARA(迪拜)+MAS(新加坡)
 *   3. 商品监管: CFTC持仓限制+交易所保证金+LME+COMEX+SHFE
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                   RegulatoryTrackerV2                        │
 *   │  ┌────────────────────────────────────────────────────────┐  │
 *   │  │ 中文政策源 (7 ministries)                               │  │
 *   │  │  ├─ 国务院 State Council                               │  │
 *   │  │  ├─ 发改委 NDRC                                        │  │
 *   │  │  ├─ 证监会 CSRC                                        │  │
 *   │  │  ├─ 银保监会 CBIRC                                      │  │
 *   │  │  ├─ 工信部 MIIT                                        │  │
 *   │  │  ├─ 央行 PBOC                                           │  │
 *   │  │  └─ 外汇局 SAFE                                         │  │
 *   │  └──────────────────┬─────────────────────────────────────┘  │
 *   │                     │                                         │
 *   │  ┌──────────────────┴─────────────────────────────────────┐  │
 *   │  │ 加密货币监管 (6 jurisdictions)                          │  │
 *   │  │  ├─ SEC (US) — securities classification              │  │
 *   │  │  ├─ CFTC (US) — commodity derivatives                 │  │
 *   │  │  ├─ MiCA (EU) — Markets in Crypto-Assets              │  │
 *   │  │  ├─ SFC (HK) — virtual asset licensing               │  │
 *   │  │  ├─ VARA (Dubai) — virtual asset regulatory authority │  │
 *   │  │  └─ MAS (Singapore) — Digital Payment Token           │  │
 *   │  └──────────────────┬─────────────────────────────────────┘  │
 *   │                     │                                         │
 *   │  ┌──────────────────┴─────────────────────────────────────┐  │
 *   │  │ 商品期货监管                                           │  │
 *   │  │  ├─ CFTC持仓限制 (US)                                  │  │
 *   │  │  ├─ 交易所保证金调整 (LME/COMEX/SHFE/INE)              │  │
 *   │  │  ├─ 交割规则变更                                       │  │
 *   │  │  └─ 逼仓/限仓通知                                      │  │
 *   │  └────────────────────────────────────────────────────────┘  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Pricing: FREE (扩展公共政策服务)
 *
 * v2.7.0-NEWS | production-ready
 */

import log from 'electron-log';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export type CNRegBody = 'state_council' | 'ndrc' | 'csrc' | 'cbirc' | 'miit' | 'pboc' | 'safe';
export type CryptoRegBody = 'sec_crypto' | 'cftc_crypto' | 'mica_eu' | 'sfc_hk' | 'vara_dubai' | 'mas_sg';
export type CommodityExchange = 'cftc' | 'lme' | 'comex' | 'shfe' | 'ine' | 'ice';

export interface CNRegEvent {
  body: CNRegBody;
  bodyName: string;
  title: string;
  description?: string;
  policyType: 'new_regulation' | 'amendment' | 'guidance' | 'notice' | 'speech' | 'circular';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  keywords: string[];
  affectedSectors: string[];
  affectedSymbols: string[];
  timestamp: number;
  url?: string;
}

export interface CryptoRegEvent {
  jurisdiction: CryptoRegBody;
  jurisdictionName: string;
  title: string;
  description?: string;
  policyType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affectedTokens: string[];
  affectedExchanges: string[];
  keyRequirements: string[];
  complianceDeadline?: string;
  timestamp: number;
  url?: string;
}

export interface CommodityRegEvent {
  exchange: CommodityExchange;
  exchangeName: string;
  commodity: string;
  symbol: string;
  title: string;
  description?: string;
  eventType: 'position_limit' | 'margin_change' | 'delivery_rule' | 'emergency_rule' | 'squeeze_notice' | 'warehouse_report';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impactDirection: 'increasing_cost' | 'decreasing_cost' | 'restrictive' | 'expansionary' | 'neutral';
  oldValue?: string;
  newValue?: string;
  effectiveDate?: string;
  timestamp: number;
  url?: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// Chinese Regulatory Body Configuration
// ═════════════════════════════════════════════════════════════════════════════

const CN_REG_BODIES: Record<CNRegBody, { name: string; pattern: RegExp; sectors: string[]; symbols: string[] }> = {
  state_council: {
    name: '国务院',
    pattern: /国务院|国常会|李克强|李强|State Council|中央政府/i,
    sectors: ['全部行业'],
    symbols: ['SPY'],
  },
  ndrc: {
    name: '发改委 (NDRC)',
    pattern: /发改委|NDRC|国家发展改革委|价格司|产业目录/i,
    sectors: ['能源', '制造业', '基建', '新能源'],
    symbols: ['XOM', 'CAT', '600585', '601668'],
  },
  csrc: {
    name: '证监会 (CSRC)',
    pattern: /证监会|CSRC|易会满|吴清|注册制|ipo/i,
    sectors: ['金融', '券商', '全部'],
    symbols: ['600030', '300059', '601688', '601211'],
  },
  cbirc: {
    name: '银保监会 (CBIRC)',
    pattern: /银保监|CBIRC|金融监管总局|银行保险/i,
    sectors: ['银行', '保险', '金融科技'],
    symbols: ['601398', '601939', '601318', '601628'],
  },
  miit: {
    name: '工信部 (MIIT)',
    pattern: /工信部|MIIT|产业政策|新能源汽车|芯片/i,
    sectors: ['科技', '半导体', '新能源汽车', '通信'],
    symbols: ['NVDA', 'SMH', 'TSLA', '002594'],
  },
  pboc: {
    name: '人民银行 (PBOC)',
    pattern: /人民银行|央行|PBOC|潘功胜|准备金|利率|降息|降准/i,
    sectors: ['银行', '房地产', '全部'],
    symbols: ['601398', '000001', '601288'],
  },
  safe: {
    name: '外汇管理局 (SAFE)',
    pattern: /外汇局|SAFE|外汇管理|跨境资金|QDII|QFII/i,
    sectors: ['券商', '银行', '进出口'],
    symbols: ['601398', '601988'],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// Crypto Regulatory Configuration
// ═════════════════════════════════════════════════════════════════════════════

const CRYPTO_REG_BODIES: Record<CryptoRegBody, { name: string; region: string; pattern: RegExp; keyTokens: string[] }> = {
  sec_crypto: {
    name: 'SEC (Crypto)',
    region: 'US',
    pattern: /SEC.*(crypto|digital asset|token|exchange.*regist)|crypto.*(security|etf.*approv)/i,
    keyTokens: ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'COIN'],
  },
  cftc_crypto: {
    name: 'CFTC (Crypto Derivatives)',
    region: 'US',
    pattern: /CFTC.*(crypto|bitcoin|digital|derivative|commodity.*digital)/i,
    keyTokens: ['BTC', 'ETH', 'COIN', 'CME'],
  },
  mica_eu: {
    name: 'MiCA (EU)',
    region: 'EU',
    pattern: /MiCA|Markets in Crypto.?Assets|EU.*(crypto|digital asset)\s*(regulation|framework|law)/i,
    keyTokens: ['BTC', 'ETH', 'USDT', 'USDC', 'BNB'],
  },
  sfc_hk: {
    name: '香港证监会 (SFC)',
    region: 'HK',
    pattern: /香港.*(加密货币|虚拟资产|牌照|交易所).*监管|SFC.*(virtual asset|crypto.*licens)/i,
    keyTokens: ['BTC', 'ETH', '0700.HK', 'OSL', 'HashKey'],
  },
  vara_dubai: {
    name: 'VARA (Dubai)',
    region: 'AE',
    pattern: /VARA|Dubai.*(crypto|virtual asset).*authority/i,
    keyTokens: ['BTC', 'ETH', 'BNB'],
  },
  mas_sg: {
    name: 'MAS (Singapore)',
    region: 'SG',
    pattern: /MAS.*(digital payment|token|crypto.*licens)|Singapore.*crypto/i,
    keyTokens: ['BTC', 'ETH', 'SOL', 'USDC'],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// Commodity Exchange Configuration
// ═════════════════════════════════════════════════════════════════════════════

const COMMODITY_EXCHANGES: Record<CommodityExchange, { name: string; region: string; pattern: RegExp; commodities: string[]; symbols: string[] }> = {
  cftc: {
    name: 'CFTC (美国商品期货)',
    region: 'US',
    pattern: /CFTC.*(position limit|speculative.*limit|commitments.*traders|COT report)/i,
    commodities: ['原油', '天然气', '黄金', '白银', '铜', '农产品'],
    symbols: ['CL=F', 'NG=F', 'GC=F', 'SI=F', 'HG=F', 'ZC=F'],
  },
  lme: {
    name: 'LME (伦敦金属交易所)',
    region: 'UK',
    pattern: /LME|London Metal Exchange|nickel.*(squeeze|limit|margin)/i,
    commodities: ['铜', '铝', '锌', '镍', '铅', '锡'],
    symbols: ['HG=F', 'ALI=F', 'ZNC=F'],
  },
  comex: {
    name: 'COMEX (纽约商品交易所)',
    region: 'US',
    pattern: /COMEX|CME.*(gold|silver|copper|margin|delivery)/i,
    commodities: ['黄金', '白银', '铜', '铂金', '钯金'],
    symbols: ['GC=F', 'SI=F', 'HG=F', 'PL=F', 'PA=F'],
  },
  shfe: {
    name: '上期所 (SHFE)',
    region: 'CN',
    pattern: /上期所|SHFE|上海期货|保证金.*调整/i,
    commodities: ['铜', '铝', '锌', '螺纹钢', '原油', '黄金'],
    symbols: ['CU.SHF', 'AL.SHF', 'AU.SHF'],
  },
  ine: {
    name: '上海国际能源交易中心 (INE)',
    region: 'CN',
    pattern: /INE|上海国际能源|原油.*sc|原油期货/i,
    commodities: ['原油', '20号胶', '低硫燃料油'],
    symbols: ['SC.INE', 'LU.INE'],
  },
  ice: {
    name: 'ICE (洲际交易所)',
    region: 'US/EU',
    pattern: /ICE|Intercontinental Exchange|brent|sugar|cotton|coffee/i,
    commodities: ['布伦特原油', '白糖', '棉花', '咖啡', '可可'],
    symbols: ['BZ=F', 'SB=F', 'CT=F', 'KC=F'],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// RegulatoryTrackerV2
// ═════════════════════════════════════════════════════════════════════════════

export class RegulatoryTrackerV2 {
  private cnEvents: CNRegEvent[] = [];
  private cryptoEvents: CryptoRegEvent[] = [];
  private commodityEvents: CommodityRegEvent[] = [];
  private maxCache = 200;

  // ═══════════ CN Policy ═══════════

  /**
   * Process Chinese regulatory news.
   */
  processCN(news: { title: string; description?: string; publishedAt: number; url?: string }): CNRegEvent | null {
    const text = `${news.title} ${news.description || ''}`;

    const body = this.detectCNBody(text);
    if (!body) return null;

    const policyType = this.classifyCNPolicyType(text);
    const severity = this.classifyCNSeverity(text);
    const keywords = this.extractCNKeywords(text);
    const sectors = this.matchCNSectors(text, body);
    const symbols = this.matchCNSymbols(text, body);

    const event: CNRegEvent = {
      body,
      bodyName: CN_REG_BODIES[body].name,
      title: news.title,
      description: news.description,
      policyType,
      severity,
      keywords,
      affectedSectors: sectors,
      affectedSymbols: symbols,
      timestamp: news.publishedAt,
      url: news.url,
    };

    this.cnEvents.push(event);
    if (this.cnEvents.length > this.maxCache) this.cnEvents.shift();

    log.info(`[REG-CN] ${CN_REG_BODIES[body].name}: ${severity} ${policyType} → ${sectors.length} sectors`);
    return event;
  }

  private detectCNBody(text: string): CNRegBody | null {
    for (const [body, cfg] of Object.entries(CN_REG_BODIES)) {
      if (cfg.pattern.test(text)) return body as CNRegBody;
    }
    return null;
  }

  private classifyCNPolicyType(text: string): CNRegEvent['policyType'] {
    if (/新规|条例|办法|管理办法|规定|通知.*发布/i.test(text)) return 'new_regulation';
    if (/修订|修改|变更|调整|完善/i.test(text)) return 'amendment';
    if (/指导意见|指引|指南|规范/i.test(text)) return 'guidance';
    if (/通知|公告|通告/i.test(text)) return 'notice';
    if (/讲话|发言|表态|透露|表示/i.test(text)) return 'speech';
    return 'circular';
  }

  private classifyCNSeverity(text: string): CNRegEvent['severity'] {
    if (/立即|紧急|暂停|停止|取缔|禁止|关停|吊销/i.test(text)) return 'CRITICAL';
    if (/从严|严格|大幅|重拳|整顿|清理|查处/i.test(text)) return 'HIGH';
    if (/规范|完善|引导|指导|提醒|关注/i.test(text)) return 'MEDIUM';
    return 'LOW';
  }

  private extractCNKeywords(text: string): string[] {
    const kws = new Set<string>();
    const kwList = ['改革', '监管', '政策', '法规', '市场', '金融', '风险', '稳定', '创新', '开放', '准入门槛', '营商环境'];
    for (const kw of kwList) { if (text.includes(kw)) kws.add(kw); }
    return [...kws];
  }

  private matchCNSectors(text: string, body: CNRegBody): string[] {
    return CN_REG_BODIES[body].sectors;
  }

  private matchCNSymbols(text: string, body: CNRegBody): string[] {
    return CN_REG_BODIES[body].symbols;
  }

  // ═══════════ Crypto Regulation ═══════════

  /**
   * Process crypto regulatory news.
   */
  processCrypto(news: { title: string; description?: string; publishedAt: number; url?: string }): CryptoRegEvent | null {
    const text = `${news.title} ${news.description || ''}`;

    const jurisdiction = this.detectCryptoJurisdiction(text);
    if (!jurisdiction) return null;

    const cfg = CRYPTO_REG_BODIES[jurisdiction];
    const policyType = this.classifyCryptoPolicyType(text);
    const severity = this.classifyCryptoSeverity(text);
    const affectedTokens = this.matchCryptoAssets(text);
    const affectedExchanges = this.matchCryptoExchanges(text);
    const keyReqs = this.extractKeyRequirements(text);

    const event: CryptoRegEvent = {
      jurisdiction,
      jurisdictionName: cfg.name,
      title: news.title,
      description: news.description,
      policyType,
      severity,
      affectedTokens,
      affectedExchanges,
      keyRequirements: keyReqs,
      timestamp: news.publishedAt,
      url: news.url,
    };

    this.cryptoEvents.push(event);
    if (this.cryptoEvents.length > this.maxCache) this.cryptoEvents.shift();

    log.info(`[REG-CRYPTO] ${cfg.name}: ${severity} → ${affectedTokens.length} tokens`);
    return event;
  }

  private detectCryptoJurisdiction(text: string): CryptoRegBody | null {
    for (const [body, cfg] of Object.entries(CRYPTO_REG_BODIES)) {
      if (cfg.pattern.test(text)) return body as CryptoRegBody;
    }
    return null;
  }

  private classifyCryptoPolicyType(text: string): string {
    if (/ban|prohibit|illegal|banne/i.test(text)) return 'ban';
    if (/license|licens|regist|authorize/i.test(text)) return 'licensing';
    if (/approve|greenlight|authorize/i.test(text) && /ETF|exchange/i.test(text)) return 'approval';
    if (/fine|charge|sue|sanction|penalty/i.test(text)) return 'enforcement';
    if (/guidance|framework|propose/i.test(text)) return 'guidance';
    return 'other';
  }

  private classifyCryptoSeverity(text: string): CryptoRegEvent['severity'] {
    if (/ban|prohibit|illegal|delist|cease|halt.*trading/i.test(text)) return 'CRITICAL';
    if (/fine\$?[0-9]+M|sanction|enforcement.*action|investigation/i.test(text)) return 'HIGH';
    if (/propose|draft|guidance|considering/i.test(text)) return 'MEDIUM';
    return 'LOW';
  }

  private matchCryptoAssets(text: string): string[] {
    const tokens = new Set<string>();
    const tokenList = ['BTC', 'Bitcoin', 'ETH', 'Ethereum', 'SOL', 'Solana', 'XRP', 'ADA', 'BNB', 'USDT', 'USDC', 'DAI', 'LINK', 'DOT', 'MATIC', 'AVAX', 'ATOM', 'LDO', 'UNI', 'AAVE'];
    const lowerText = text.toLowerCase();
    for (const tok of tokenList) {
      if (lowerText.includes(tok.toLowerCase())) tokens.add(tok.toUpperCase());
    }
    return [...tokens];
  }

  private matchCryptoExchanges(text: string): string[] {
    const exchanges = new Set<string>();
    const exList = ['Coinbase', 'Binance', 'Kraken', 'Gemini', 'OKX', 'Bybit', 'Bitget', 'FTX', 'Huobi', 'Upbit', 'Gate', 'KuCoin', 'Bitstamp'];
    const lowerText = text.toLowerCase();
    for (const ex of exList) {
      if (lowerText.includes(ex.toLowerCase())) exchanges.add(ex);
    }
    return [...exchanges];
  }

  private extractKeyRequirements(text: string): string[] {
    const reqs: string[] = [];
    const sentences = text.split(/[.。;；!！]+/);
    for (const sent of sentences) {
      const s = sent.trim();
      if (s.length < 10 || s.length > 200) continue;
      if (/must|require|shall|mandatory|need to|obliged|须|必须|要求/i.test(s)) {
        reqs.push(s.slice(0, 150));
      }
      if (reqs.length >= 3) break;
    }
    return reqs.length > 0 ? reqs : ['详见原文'];
  }

  // ═══════════ Commodity Regulation ═══════════

  /**
   * Process commodity exchange regulatory events.
   */
  processCommodity(news: { title: string; description?: string; publishedAt: number; url?: string }): CommodityRegEvent | null {
    const text = `${news.title} ${news.description || ''}`;

    const exchange = this.detectExchange(text);
    if (!exchange) return null;

    const cfg = COMMODITY_EXCHANGES[exchange];
    const commodity = this.matchCommodityName(text, cfg.commodities);
    const symbol = this.matchCommoditySymbol(text, cfg.symbols);
    const eventType = this.classifyCommodityEventType(text);
    const severity = this.classifyCommoditySeverity(text, eventType);
    const impact = this.classifyCommodityImpact(text, eventType);
    const { oldVal, newVal } = this.extractValueChange(text);

    const event: CommodityRegEvent = {
      exchange,
      exchangeName: cfg.name,
      commodity: commodity || cfg.commodities[0],
      symbol: symbol || cfg.symbols[0],
      title: news.title,
      description: news.description,
      eventType,
      severity,
      impactDirection: impact,
      oldValue: oldVal,
      newValue: newVal,
      timestamp: news.publishedAt,
      url: news.url,
    };

    this.commodityEvents.push(event);
    if (this.commodityEvents.length > this.maxCache) this.commodityEvents.shift();

    log.info(`[REG-CMDTY] ${cfg.name}: ${severity} ${eventType} on ${event.commodity}`);
    return event;
  }

  private detectExchange(text: string): CommodityExchange | null {
    for (const [ex, cfg] of Object.entries(COMMODITY_EXCHANGES)) {
      if (cfg.pattern.test(text)) return ex as CommodityExchange;
    }
    return null;
  }

  private matchCommodityName(text: string, commodities: string[]): string {
    for (const c of commodities) {
      if (text.includes(c)) return c;
    }
    return commodities[0];
  }

  private matchCommoditySymbol(text: string, symbols: string[]): string {
    for (const s of symbols) {
      if (text.includes(s)) return s;
    }
    return symbols[0];
  }

  private classifyCommodityEventType(text: string): CommodityRegEvent['eventType'] {
    if (/position\s*(limit|cap)|持仓.*(限制|上限)/i.test(text)) return 'position_limit';
    if (/margin.*(increase|decrease|raise|cut|adjust)|保证金.*(上调|下调|调整)/i.test(text)) return 'margin_change';
    if (/delivery.*(rule|notice|warehouse)|交割.*(规则|通知|仓库)/i.test(text)) return 'delivery_rule';
    if (/emergency|紧急|force.*majeure|不可抗力/i.test(text)) return 'emergency_rule';
    if (/squeeze|逼仓|corner|position.*concentrate/i.test(text)) return 'squeeze_notice';
    if (/warehouse.*(report|receipt|stock)|仓单.*(报告|库存)/i.test(text)) return 'warehouse_report';
    return 'delivery_rule';
  }

  private classifyCommoditySeverity(text: string, eventType: CommodityRegEvent['eventType']): CommodityRegEvent['severity'] {
    if (eventType === 'emergency_rule' || /halt|suspend|停牌|暂停交易/i.test(text)) return 'CRITICAL';
    if (eventType === 'squeeze_notice' || /immediate|立即|大幅/i.test(text)) return 'HIGH';
    if (eventType === 'margin_change') return 'MEDIUM';
    return 'LOW';
  }

  private classifyCommodityImpact(text: string, eventType: CommodityRegEvent['eventType']): CommodityRegEvent['impactDirection'] {
    if (/increase|raise|上调|提高/i.test(text)) return eventType === 'margin_change' ? 'increasing_cost' : 'restrictive';
    if (/decrease|lower|cut|下调|降低/i.test(text)) return eventType === 'margin_change' ? 'decreasing_cost' : 'expansionary';
    return 'neutral';
  }

  private extractValueChange(text: string): { oldVal?: string; newVal?: string } {
    const match = text.match(/(?:from|从|由)\s*(\d+\.?\d*%?)\s*(?:to|调至|调整为)\s*(\d+\.?\d*%?)/i);
    if (match) return { oldVal: match[1], newVal: match[2] };
    return {};
  }

  // ═══════════ Queries ═══════════

  getCNEvents(options?: { body?: CNRegBody; severity?: string; since?: number; limit?: number }): CNRegEvent[] {
    let results = [...this.cnEvents];
    if (options?.body) results = results.filter(e => e.body === options.body);
    if (options?.severity) results = results.filter(e => e.severity === options.severity);
    if (options?.since) results = results.filter(e => e.timestamp >= options.since);
    results.sort((a, b) => b.timestamp - a.timestamp);
    if (options?.limit) results = results.slice(0, options.limit);
    return results;
  }

  getCryptoEvents(options?: { jurisdiction?: CryptoRegBody; severity?: string; since?: number; limit?: number }): CryptoRegEvent[] {
    let results = [...this.cryptoEvents];
    if (options?.jurisdiction) results = results.filter(e => e.jurisdiction === options.jurisdiction);
    if (options?.severity) results = results.filter(e => e.severity === options.severity);
    if (options?.since) results = results.filter(e => e.timestamp >= options.since);
    results.sort((a, b) => b.timestamp - a.timestamp);
    if (options?.limit) results = results.slice(0, options.limit);
    return results;
  }

  getCommodityEvents(options?: { exchange?: CommodityExchange; commodity?: string; severity?: string; since?: number; limit?: number }): CommodityRegEvent[] {
    let results = [...this.commodityEvents];
    if (options?.exchange) results = results.filter(e => e.exchange === options.exchange);
    if (options?.commodity) results = results.filter(e => e.commodity === options.commodity);
    if (options?.severity) results = results.filter(e => e.severity === options.severity);
    if (options?.since) results = results.filter(e => e.timestamp >= options.since);
    results.sort((a, b) => b.timestamp - a.timestamp);
    if (options?.limit) results = results.slice(0, options.limit);
    return results;
  }

  getCNStats(): Record<CNRegBody, number> {
    const stats: Record<string, number> = {};
    for (const e of this.cnEvents) stats[e.body] = (stats[e.body] || 0) + 1;
    return stats as Record<CNRegBody, number>;
  }

  getCryptoStats(): Record<CryptoRegBody, number> {
    const stats: Record<string, number> = {};
    for (const e of this.cryptoEvents) stats[e.jurisdiction] = (stats[e.jurisdiction] || 0) + 1;
    return stats as Record<CryptoRegBody, number>;
  }

  getCommodityStats(): Record<CommodityExchange, number> {
    const stats: Record<string, number> = {};
    for (const e of this.commodityEvents) stats[e.exchange] = (stats[e.exchange] || 0) + 1;
    return stats as Record<CommodityExchange, number>;
  }

  getTotalStats(): { cn: number; crypto: number; commodity: number; total: number } {
    return {
      cn: this.cnEvents.length, crypto: this.cryptoEvents.length,
      commodity: this.commodityEvents.length,
      total: this.cnEvents.length + this.cryptoEvents.length + this.commodityEvents.length,
    };
  }

  // ═══════════ Utility ═══════════

  processBatchCN(news: Array<{ title: string; description?: string; publishedAt: number; url?: string }>): CNRegEvent[] {
    return news.map(n => this.processCN(n)).filter(Boolean) as CNRegEvent[];
  }

  processBatchCrypto(news: Array<{ title: string; description?: string; publishedAt: number; url?: string }>): CryptoRegEvent[] {
    return news.map(n => this.processCrypto(n)).filter(Boolean) as CryptoRegEvent[];
  }

  processBatchCommodity(news: Array<{ title: string; description?: string; publishedAt: number; url?: string }>): CommodityRegEvent[] {
    return news.map(n => this.processCommodity(n)).filter(Boolean) as CommodityRegEvent[];
  }

  reset(): void {
    this.cnEvents = [];
    this.cryptoEvents = [];
    this.commodityEvents = [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Singleton
// ═════════════════════════════════════════════════════════════════════════════

let defaultRegV2: RegulatoryTrackerV2 | null = null;

export function getRegulatoryTrackerV2(): RegulatoryTrackerV2 {
  if (!defaultRegV2) defaultRegV2 = new RegulatoryTrackerV2();
  return defaultRegV2;
}

export function resetRegulatoryTrackerV2(): void {
  defaultRegV2 = null;
}
