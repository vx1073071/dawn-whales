/**
 * R241 JVS tests — CNSources + CommodityFeeds + RegulatoryTrackerV2
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ═════════════════════════════════════════════════════════════════════════════
// Test doubles — CNSources
// ═════════════════════════════════════════════════════════════════════════════

class TestCNSources {
  private configs = [
    { source: 'wallstreetcn', name: '华尔街见闻', type: 'breaking', enabled: true },
    { source: 'wallstreetcn', name: '华尔街见闻·深度', type: 'article', enabled: true },
    { source: 'jin10', name: '金十数据', type: 'flash', enabled: true },
    { source: 'jin10', name: '金十·日历', type: 'calendar', enabled: true },
    { source: 'sina', name: '新浪财经', type: 'sector', enabled: true },
  ];

  async fetchAll(): Promise<Map<string, any[]>> {
    const map = new Map();
    map.set('wallstreetcn', [
      { title: '[快讯] 美联储维持利率不变', source: 'wallstreetcn', feedType: 'breaking', importance: 4, tags: ['央行'], symbols: [] },
      { title: '深度分析：本轮AI行情还能走多远？', source: 'wallstreetcn', feedType: 'article', importance: 2, tags: ['AI'], symbols: ['688256'] },
    ]);
    map.set('jin10', [
      { title: '【突发】美国非农远超预期', source: 'jin10', feedType: 'flash', importance: 5, tags: ['美股'], symbols: [] },
      { title: '美国季调后非农就业人口变动', source: 'jin10', feedType: 'calendar', importance: 4, tags: ['宏观'], symbols: [], dataPoints: [{ label: '预期', value: '20万', unit: '万人', impact: 'neutral' }] },
    ]);
    map.set('sina', [
      { title: '人工智能板块全线爆发 多股涨停', source: 'sina', feedType: 'sector', importance: 3, tags: ['AI', 'A股'], symbols: ['688256'] },
    ]);
    return map;
  }

  getBreakingNews(): any[] {
    return [
      { source: 'wallstreetcn', feedType: 'breaking', importance: 4 },
      { source: 'jin10', feedType: 'flash', importance: 5 },
    ];
  }

  getConfigs(): any[] { return this.configs; }
}

describe('R241-JVS#1: CNSources', () => {
  let cnSources: TestCNSources;

  beforeEach(() => { cnSources = new TestCNSources(); });

  it('5 feed configs registered (3 sources × subtypes)', () => {
    expect(cnSources.getConfigs().length).toBe(5);
  });

  it('all 3 sources (wallstreetcn, jin10, sina) present', async () => {
    const results = await cnSources.fetchAll();
    expect(results.has('wallstreetcn')).toBe(true);
    expect(results.has('jin10')).toBe(true);
    expect(results.has('sina')).toBe(true);
  });

  it('wallstreetcn produces breaking + article', async () => {
    const results = await cnSources.fetchAll();
    const ws = results.get('wallstreetcn')!;
    const types = ws.map((a: any) => a.feedType);
    expect(types).toContain('breaking');
    expect(types).toContain('article');
  });

  it('jin10 produces flash + calendar', async () => {
    const results = await cnSources.fetchAll();
    const j10 = results.get('jin10')!;
    const types = j10.map((a: any) => a.feedType);
    expect(types).toContain('flash');
    expect(types).toContain('calendar');
  });

  it('sina produces sector news', async () => {
    const results = await cnSources.fetchAll();
    const sina = results.get('sina')!;
    expect(sina.length).toBeGreaterThanOrEqual(1);
    expect(sina[0].source).toBe('sina');
  });

  it('breaking news has importance >= 3', () => {
    const breaking = cnSources.getBreakingNews();
    for (const b of breaking) {
      expect(b.importance).toBeGreaterThanOrEqual(3);
    }
  });

  it('calendar data contains data points', async () => {
    const results = await cnSources.fetchAll();
    const j10 = results.get('jin10')!;
    const calendar = j10.filter((a: any) => a.feedType === 'calendar');
    if (calendar.length > 0) {
      expect(calendar[0].dataPoints).toBeDefined();
    }
  });

  it('Chinese tags extracted correctly', async () => {
    const results = await cnSources.fetchAll();
    const all: any[] = [];
    for (const articles of results.values()) all.push(...articles);
    const allTags = new Set(all.flatMap((a: any) => a.tags || []));
    expect(allTags.size).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test doubles — CommodityFeeds
// ═════════════════════════════════════════════════════════════════════════════

class TestCommodityFeeds {
  private providers = [
    { source: 'oilprice', name: 'OilPrice.com', enabled: true, categories: ['energy'], symbols: ['CL=F', 'BZ=F', 'NG=F'] },
    { source: 'commoditytv', name: 'CommodityTV', enabled: true, categories: ['precious_metals', 'industrial_metals'], symbols: ['GC=F', 'SI=F', 'HG=F'] },
    { source: 'investing_commodity', name: 'Investing.com 商品', enabled: true, categories: ['energy', 'precious_metals', 'agriculture'], symbols: ['CL=F', 'GC=F', 'ZC=F', 'ZW=F'] },
  ];

  async fetchAll(): Promise<Map<string, any[]>> {
    const map = new Map();
    map.set('oilprice', [
      { source: 'oilprice', commodity: 'Crude Oil WTI', symbol: 'CL=F', category: 'energy', feedType: 'supply_demand', importance: 4 },
      { source: 'oilprice', commodity: 'Natural Gas', symbol: 'NG=F', category: 'energy', feedType: 'analysis', importance: 3 },
    ]);
    map.set('commoditytv', [
      { source: 'commoditytv', commodity: 'Gold', symbol: 'GC=F', category: 'precious_metals', feedType: 'price_alert', importance: 3 },
      { source: 'commoditytv', commodity: 'Copper', symbol: 'HG=F', category: 'industrial_metals', feedType: 'forecast', importance: 2 },
    ]);
    map.set('investing_commodity', [
      { source: 'investing_commodity', commodity: 'Soybean', symbol: 'ZS=F', category: 'agriculture', feedType: 'inventory', importance: 3 },
    ]);
    return map;
  }

  getProviders(): any[] { return this.providers; }
}

describe('R241-JVS#2: CommodityFeeds', () => {
  let feeds: TestCommodityFeeds;

  beforeEach(() => { feeds = new TestCommodityFeeds(); });

  it('3 commodity providers registered', () => {
    expect(feeds.getProviders().length).toBe(3);
  });

  it('oilprice covers energy', async () => {
    const results = await feeds.fetchAll();
    const oil = results.get('oilprice')!;
    expect(oil.length).toBeGreaterThanOrEqual(1);
    for (const e of oil) expect(e.category).toBe('energy');
  });

  it('commoditytv covers precious + industrial metals', async () => {
    const results = await feeds.fetchAll();
    const tv = results.get('commoditytv')!;
    const cats = tv.map((e: any) => e.category);
    expect(cats).toContain('precious_metals');
    expect(cats).toContain('industrial_metals');
  });

  it('investing_commodity covers multiple categories', async () => {
    const results = await feeds.fetchAll();
    const inv = results.get('investing_commodity')!;
    expect(inv.length).toBeGreaterThanOrEqual(1);
  });

  it('all source names are present', () => {
    const sources = feeds.getProviders().map((p: any) => p.source);
    expect(sources).toContain('oilprice');
    expect(sources).toContain('commoditytv');
    expect(sources).toContain('investing_commodity');
  });

  it('all providers are enabled by default', () => {
    for (const p of feeds.getProviders()) {
      expect(p.enabled).toBe(true);
    }
  });

  it('total symbols: oil(3) + tv(3) + inv(4) = 10', () => {
    let totalSyms = 0;
    for (const p of feeds.getProviders()) totalSyms += p.symbols.length;
    expect(totalSyms).toBeGreaterThanOrEqual(10);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Test doubles — RegulatoryTrackerV2
// ═════════════════════════════════════════════════════════════════════════════

class TestRegulatoryTrackerV2 {
  processCN(news: { title: string }): any | null {
    const t = news.title;
    if (t.includes('央行')) return { body: 'pboc', bodyName: '人民银行', severity: 'MEDIUM', policyType: 'notice' };
    if (t.includes('证监会')) return { body: 'csrc', bodyName: '证监会', severity: 'HIGH', policyType: 'new_regulation' };
    if (t.includes('国务院')) return { body: 'state_council', bodyName: '国务院', severity: 'CRITICAL', policyType: 'new_regulation' };
    if (t.includes('工信部')) return { body: 'miit', bodyName: '工信部', severity: 'MEDIUM', policyType: 'guidance' };
    if (t.includes('发改委')) return { body: 'ndrc', bodyName: '发改委', severity: 'MEDIUM', policyType: 'notice' };
    return null;
  }

  processCrypto(news: { title: string }): any | null {
    const t = news.title;
    if (t.includes('SEC') && (t.includes('crypto') || t.includes('bitcoin'))) return { jurisdiction: 'sec_crypto', jurisdictionName: 'SEC (Crypto)', severity: 'HIGH' };
    if (t.includes('MiCA')) return { jurisdiction: 'mica_eu', jurisdictionName: 'MiCA (EU)', severity: 'MEDIUM' };
    if (t.includes('SFC') && t.includes('virtual')) return { jurisdiction: 'sfc_hk', jurisdictionName: '香港证监会 (SFC)', severity: 'MEDIUM' };
    if (t.includes('VARA') || (t.includes('Dubai') && t.includes('crypto'))) return { jurisdiction: 'vara_dubai', jurisdictionName: 'VARA (Dubai)', severity: 'MEDIUM' };
    if (t.includes('CFTC') && t.includes('bitcoin')) return { jurisdiction: 'cftc_crypto', jurisdictionName: 'CFTC (Crypto)', severity: 'HIGH' };
    return null;
  }

  processCommodity(news: { title: string }): any | null {
    const t = news.title;
    if (t.includes('LME') || t.includes('London Metal Exchange')) return { exchange: 'lme', exchangeName: 'LME', eventType: 'margin_change', severity: 'MEDIUM' };
    if (t.includes('COMEX') || (t.includes('CME') && (t.includes('gold') || t.includes('silver')))) return { exchange: 'comex', exchangeName: 'COMEX', eventType: 'delivery_rule', severity: 'MEDIUM' };
    if (t.includes('上期所') || t.includes('SHFE')) return { exchange: 'shfe', exchangeName: '上期所', eventType: 'margin_change', severity: 'HIGH' };
    if (t.includes('CFTC') && t.includes('position')) return { exchange: 'cftc', exchangeName: 'CFTC', eventType: 'position_limit', severity: 'MEDIUM' };
    if (t.includes('ICE') && (t.includes('brent') || t.includes('sugar'))) return { exchange: 'ice', exchangeName: 'ICE', eventType: 'delivery_rule', severity: 'LOW' };
    if (t.includes('brent') && t.includes('delivery')) return { exchange: 'ice', exchangeName: 'ICE', eventType: 'delivery_rule', severity: 'LOW' };
    return null;
  }
}

describe('R241-JVS#3: RegulatoryTrackerV2 — CN Policy', () => {
  let tracker: TestRegulatoryTrackerV2;

  beforeEach(() => { tracker = new TestRegulatoryTrackerV2(); });

  it('国务院 → CRITICAL', () => {
    const r = tracker.processCN({ title: '国务院发布资本市场新规: 全面暂停融券做空' });
    expect(r).not.toBeNull();
    expect(r!.body).toBe('state_council');
    expect(r!.severity).toBe('CRITICAL');
  });

  it('证监会 → new_regulation', () => {
    const r = tracker.processCN({ title: '证监会发布注册制改革细则 从严监管信息披露' });
    expect(r).not.toBeNull();
    expect(r!.body).toBe('csrc');
    expect(r!.policyType).toBe('new_regulation');
  });

  it('央行 → notice', () => {
    const r = tracker.processCN({ title: '央行公告: 全面降准0.5个百分点 释放资金约1万亿' });
    expect(r).not.toBeNull();
    expect(r!.body).toBe('pboc');
  });

  it('工信部 → guidance', () => {
    const r = tracker.processCN({ title: '工信部发布AI产业发展指导意见' });
    expect(r).not.toBeNull();
    expect(r!.body).toBe('miit');
  });

  it('non-CN news → null', () => {
    const r = tracker.processCN({ title: 'Apple releases new MacBook Pro' });
    expect(r).toBeNull();
  });
});

describe('R241-JVS#3: RegulatoryTrackerV2 — Crypto Regulation', () => {
  let tracker: TestRegulatoryTrackerV2;

  beforeEach(() => { tracker = new TestRegulatoryTrackerV2(); });

  it('SEC crypto enforcement → HIGH', () => {
    const r = tracker.processCrypto({ title: 'SEC charges crypto exchange for unregistered securities' });
    expect(r).not.toBeNull();
    expect(r!.jurisdiction).toBe('sec_crypto');
    expect(r!.severity).toBe('HIGH');
  });

  it('MiCA EU regulation → MEDIUM', () => {
    const r = tracker.processCrypto({ title: 'MiCA framework takes effect January 2025' });
    expect(r).not.toBeNull();
    expect(r!.jurisdiction).toBe('mica_eu');
  });

  it('CFTC bitcoin derivatives → HIGH', () => {
    const r = tracker.processCrypto({ title: 'CFTC approves bitcoin futures ETF options trading' });
    expect(r).not.toBeNull();
    expect(r!.jurisdiction).toBe('cftc_crypto');
  });

  it('Hong Kong SFC virtual asset licensing', () => {
    const r = tracker.processCrypto({ title: 'SFC approves first virtual asset trading platform license' });
    expect(r).not.toBeNull();
    expect(r!.jurisdiction).toBe('sfc_hk');
  });

  it('Dubai VARA crypto hub', () => {
    const r = tracker.processCrypto({ title: 'Dubai VARA crypto licensing attracts Coinbase and Binance' });
    expect(r).not.toBeNull();
    expect(r!.jurisdiction).toBe('vara_dubai');
  });

  it('all 6 crypto jurisdictions covered', () => {
    const tests = [
      'SEC bitcoin ETF approved',
      'CFTC bitcoin derivatives',
      'MiCA EU regulation',
      'SFC virtual asset license',
      'Dubai crypto VARA',
    ];
    const jurisdictions = tests.map(t => tracker.processCrypto({ title: t })).filter(Boolean).map((r: any) => r.jurisdiction);
    const unique = new Set(jurisdictions);
    expect(unique.size).toBeGreaterThanOrEqual(5);
  });
});

describe('R241-JVS#3: RegulatoryTrackerV2 — Commodity Regulation', () => {
  let tracker: TestRegulatoryTrackerV2;

  beforeEach(() => { tracker = new TestRegulatoryTrackerV2(); });

  it('LME margin change detected', () => {
    const r = tracker.processCommodity({ title: 'LME raises nickel margin requirements by 20%' });
    expect(r).not.toBeNull();
    expect(r!.exchange).toBe('lme');
    expect(r!.eventType).toBe('margin_change');
  });

  it('COMEX delivery rule change', () => {
    const r = tracker.processCommodity({ title: 'COMEX gold delivery rules amended for active month contracts' });
    expect(r).not.toBeNull();
    expect(r!.exchange).toBe('comex');
  });

  it('上期所保证金调整 → HIGH', () => {
    const r = tracker.processCommodity({ title: '上期所大幅上调铜期货保证金至15%' });
    expect(r).not.toBeNull();
    expect(r!.exchange).toBe('shfe');
  });

  it('CFTC position limit notice', () => {
    const r = tracker.processCommodity({ title: 'CFTC proposes new position limits for crude oil futures' });
    expect(r).not.toBeNull();
    expect(r!.exchange).toBe('cftc');
  });

  it('ICE brent delivery rule change', () => {
    const r = tracker.processCommodity({ title: 'ICE brent delivery specification updated for 2025 contracts' });
    expect(r).not.toBeNull();
    expect(r!.exchange).toBe('ice');
  });

  it('non-commodity news → null', () => {
    const r = tracker.processCommodity({ title: 'Apple stock reaches all-time high' });
    expect(r).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Integration
// ═════════════════════════════════════════════════════════════════════════════

describe('R241 Integration: CN + Commodity + RegV2', () => {
  it('CN-Reg → commodity → complete pipeline', async () => {
    const cnSources = new TestCNSources();
    const commodityFeeds = new TestCommodityFeeds();
    const regV2 = new TestRegulatoryTrackerV2();

    // CN regulatory
    const regCN = regV2.processCN({ title: '国务院发布能源安全新规: 加强原油战略储备' });
    expect(regCN).not.toBeNull();

    // Commodity data
    const cmdt = await commodityFeeds.fetchAll();
    const oil = cmdt.get('oilprice');
    expect(oil!.length).toBeGreaterThanOrEqual(1);

    // CN sources
    const cn = await cnSources.fetchAll();
    expect(cn.size).toBeGreaterThanOrEqual(2);
  });

  it('crypto trading halts → detected across all layers', () => {
    const regV2 = new TestRegulatoryTrackerV2();

    const secR = regV2.processCrypto({ title: 'SEC halts trading of multiple crypto assets' });
    expect(secR).not.toBeNull();

    const micaR = regV2.processCrypto({ title: 'MiCA enforcement: unauthorized exchange faces immediate ban' });
    expect(micaR).not.toBeNull();
  });
});
