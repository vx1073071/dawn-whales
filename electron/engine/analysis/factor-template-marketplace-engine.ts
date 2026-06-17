/**
 * FactorTemplateMarketplaceEngine — R279 JVS-1 因子模板市场引擎 (6h)
 *
 * 功能:
 * - publishTemplate / unpublishTemplate (创作者发布因子模板)
 * - browseTemplates (按分类/标签/热度筛选)
 * - installTemplate / rateTemplate
 * - template versioning + fork + history
 * - creator revenue share tracking
 * - institutional templates vs community templates
 * - featured / trending / new / top-rated sections
 */

export interface FactorTemplate {
  id: string;
  name: string;
  nameCn: string;
  author: string;
  authorId: string;
  authorLevel: 'L1' | 'L2' | 'L3';
  category: 'multi-factor' | 'single-factor' | 'sector-rotation' | 'market-timing' | 'risk-parity' | 'trend-following' | 'mean-reversion' | 'arbitrage';
  description: string;
  descriptionCn: string;
  tags: string[];
  factors: string[]; // factor IDs composing this template
  weights: number[]; // corresponding weights (sum=1)
  markets: string[]; // applicable markets
  timeframe: 'intraday' | 'daily' | 'weekly' | 'monthly';
  backtest: { sharpe: number; maxDD: number; annualReturn: number; winRate: number; calmar: number; years: number };
  version: string;
  downloads: number;
  installs: number;
  rating: number; // 0-5
  ratingCount: number;
  price: number; // USDT (0=free)
  isVerified: boolean;
  isFeatured: boolean;
  isInstitutional: boolean;
  createdAt: number;
  updatedAt: number;
  status: 'published' | 'draft' | 'archived';
  revenueShare: number; // 0-1 percentage
  forkFrom?: string; // parent template id if forked
}

export interface TemplateFilter {
  category?: string;
  tags?: string[];
  markets?: string[];
  timeframe?: string;
  minRating?: number;
  maxPrice?: number;
  isVerified?: boolean;
  isInstitutional?: boolean;
  authorLevel?: string;
  sortBy?: 'downloads' | 'rating' | 'newest' | 'revenue';
  search?: string;
}

export interface TemplateMetrics {
  totalTemplates: number;
  totalInstalls: number;
  totalRevenue: number;
  activeCreators: number;
  avgRating: number;
  institutionalCount: number;
  communityCount: number;
}

// ============================================================
export class FactorTemplateMarketplaceEngine {
  private templates = new Map<string, FactorTemplate>();
  private installs = new Map<string, Set<string>>(); // templateId → userIds
  private ratings = new Map<string, Map<string, number>>(); // templateId → userId→rating
  private creatorRevenue = new Map<string, number>(); // authorId → revenue

  /** Publish a new template */
  publishTemplate(tmpl: Omit<FactorTemplate, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'installs' | 'rating' | 'ratingCount' | 'status'>): FactorTemplate {
    const id = 'tmpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = Date.now();
    const t: FactorTemplate = {
      ...tmpl, id, createdAt: now, updatedAt: now,
      downloads: 0, installs: 0, rating: 0, ratingCount: 0, status: 'published',
    };
    this.templates.set(id, t);
    return t;
  }

  /** Browse with filters */
  browse(filter?: TemplateFilter): FactorTemplate[] {
    let results = Array.from(Array.from(this.templates.values()).filter(t => t.status === 'published');

    if (filter?.category) results = results.filter(t => t.category === filter.category);
    if (filter?.tags?.length) results = results.filter(t => filter.tags!.some(tag => t.tags.includes(tag)));
    if (filter?.markets?.length) results = results.filter(t => filter.markets!.some(m => t.markets.includes(m)));
    if (filter?.timeframe) results = results.filter(t => t.timeframe === filter.timeframe);
    if (filter?.minRating) results = results.filter(t => t.rating >= filter.minRating!);
    if (filter?.maxPrice !== undefined) results = results.filter(t => t.price <= filter.maxPrice!);
    if (filter?.isVerified !== undefined) results = results.filter(t => t.isVerified === filter.isVerified);
    if (filter?.isInstitutional !== undefined) results = results.filter(t => t.isInstitutional === filter.isInstitutional);
    if (filter?.authorLevel) results = results.filter(t => t.authorLevel === filter.authorLevel);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(t => t.name.toLowerCase().includes(q) || t.nameCn.includes(q) || t.descriptionCn.includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q)));
    }

    switch (filter?.sortBy) {
      case 'downloads': results.sort((a, b) => b.downloads - a.downloads); break;
      case 'rating': results.sort((a, b) => b.rating - a.rating); break;
      case 'newest': results.sort((a, b) => b.createdAt - a.createdAt); break;
      case 'revenue': results.sort((a, b) => (b.downloads * b.price) - (a.downloads * a.price)); break;
      default: results.sort((a, b) => b.downloads - a.downloads);
    }
    return results;
  }

  /** Get sections */
  getFeatured(n = 10): FactorTemplate[] { return Array.from(Array.from(this.templates.values()).filter(t => t.isFeatured && t.status === 'published').sort((a, b) => b.rating - a.rating).slice(0, n); }
  getTrending(n = 10): FactorTemplate[] { return Array.from(Array.from(this.templates.values()).filter(t => t.status === 'published').sort((a, b) => b.downloads - a.downloads).slice(0, n); }
  getNewest(n = 10): FactorTemplate[] { return Array.from(Array.from(this.templates.values()).filter(t => t.status === 'published').sort((a, b) => b.createdAt - a.createdAt).slice(0, n); }
  getTopRated(n = 10): FactorTemplate[] { return Array.from(Array.from(this.templates.values()).filter(t => t.status === 'published' && t.ratingCount >= 5).sort((a, b) => b.rating - a.rating).slice(0, n); }
  getFreeTemplates(n = 10): FactorTemplate[] { return Array.from(Array.from(this.templates.values()).filter(t => t.status === 'published' && t.price === 0).sort((a, b) => b.downloads - a.downloads).slice(0, n); }
  getByCreator(authorId: string): FactorTemplate[] { return Array.from(Array.from(this.templates.values()).filter(t => t.authorId === authorId); }
  getById(id: string): FactorTemplate | undefined { return this.templates.get(id); }

  /** Install template */
  install(id: string, userId: string): boolean {
    const t = this.templates.get(id);
    if (!t || t.status !== 'published') return false;
    if (!this.installs.has(id)) this.installs.set(id, new Set());
    if (this.installs.get(id)!.has(userId)) return false;
    this.installs.get(id)!.add(userId);
    t.installs = this.installs.get(id)!.size;
    t.downloads++;
    // Revenue for paid templates
    if (t.price > 0) {
      const rev = t.price * (1 - t.revenueShare);
      this.creatorRevenue.set(t.authorId, (this.creatorRevenue.get(t.authorId) || 0) + rev);
    }
    return true;
  }

  /** Rate template */
  rate(id: string, userId: string, rating: number): boolean {
    const t = this.templates.get(id);
    if (!t || rating < 0 || rating > 5) return false;
    if (!this.ratings.has(id)) this.ratings.set(id, new Map());
    this.ratings.get(id)!.set(userId, rating);
    const all = Array.from(this.ratings.get(id)!.values());
    t.rating = +(all.reduce((s, r) => s + r, 0) / all.length).toFixed(1);
    t.ratingCount = all.length;
    return true;
  }

  /** Fork a template */
  fork(id: string, newAuthor: { id: string; name: string; level: 'L1'|'L2'|'L3' }, overrides?: Partial<FactorTemplate>): FactorTemplate | null {
    const orig = this.templates.get(id);
    if (!orig) return null;
    const forked = this.publishTemplate({
      name: overrides?.name || (orig.name + ' (fork)'),
      nameCn: overrides?.nameCn || (orig.nameCn + ' (fork)'),
      author: newAuthor.name,
      authorId: newAuthor.id,
      authorLevel: newAuthor.level,
      category: orig.category,
      description: overrides?.description || orig.description,
      descriptionCn: overrides?.descriptionCn || orig.descriptionCn,
      tags: overrides?.tags || [...orig.tags],
      factors: overrides?.factors || [...orig.factors],
      weights: overrides?.weights || [...orig.weights],
      markets: overrides?.markets || [...orig.markets],
      timeframe: overrides?.timeframe || orig.timeframe,
      backtest: overrides?.backtest || { ...orig.backtest },
      version: '1.0.0-fork',
      price: overrides?.price ?? orig.price,
      isVerified: false,
      isFeatured: false,
      isInstitutional: false,
      revenueShare: 0.3,
      forkFrom: id,
    });
    return forked;
  }

  /** Update template version */
  updateVersion(id: string, changes: Partial<FactorTemplate>): FactorTemplate | null {
    const t = this.templates.get(id);
    if (!t) return null;
    Object.assign(t, changes, { updatedAt: Date.now() });
    const ver = t.version.split('.');
    ver[2] = String(Number(ver[2]) + 1);
    t.version = ver.join('.');
    return t;
  }

  /** Creator revenue */
  getCreatorRevenue(authorId: string): number { return this.creatorRevenue.get(authorId) || 0; }
  getTopCreators(n = 10): Array<{ authorId: string; revenue: number }> {
    return Array.from(this.creatorRevenue.entries()).map(([authorId, revenue]) => ({ authorId, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, n);
  }

  /** Marketplace metrics */
  getMetrics(): TemplateMetrics {
    const all = Array.from(Array.from(this.templates.values()).filter(t => t.status === 'published');
    return {
      totalTemplates: all.length,
      totalInstalls: all.reduce((s, t) => s + t.installs, 0),
      totalRevenue: Array.from(this.creatorRevenue.values()).reduce((s, r) => s + r, 0),
      activeCreators: new Set(all.map(t => t.authorId)).size,
      avgRating: all.length > 0 ? +(all.reduce((s, t) => s + t.rating, 0) / all.length).toFixed(1) : 0,
      institutionalCount: all.filter(t => t.isInstitutional).length,
      communityCount: all.filter(t => !t.isInstitutional).length,
    };
  }

  /** Category distribution */
  getCategoryDistribution(): Array<{ category: string; count: number; avgRating: number }> {
    const cats = new Map<string, { count: number; ratingSum: number; ratingCount: number }>();
    for (const t of Array.from(Array.from(this.templates.values())) {
      if (t.status !== 'published') continue;
      if (!cats.has(t.category)) cats.set(t.category, { count: 0, ratingSum: 0, ratingCount: 0 });
      const c = cats.get(t.category)!;
      c.count++; c.ratingSum += t.rating; c.ratingCount += t.ratingCount;
    }
    return Array.from(cats.entries()).map(([category, d]) => ({
      category,
      count: d.count,
      avgRating: d.ratingCount > 0 ? +(d.ratingSum / d.ratingCount).toFixed(1) : 0,
    })).sort((a, b) => b.count - a.count);
  }

  /** Search by factor ID */
  searchByFactor(factorId: string): FactorTemplate[] {
    return Array.from(Array.from(this.templates.values()).filter(t => t.status === 'published' && t.factors.includes(factorId));
  }

  /** Compatibility check */
  compatibility(templateId: string, userMarkets: string[]): { compatible: boolean; missingMarkets: string[] } {
    const t = this.templates.get(templateId);
    if (!t) return { compatible: false, missingMarkets: [] };
    const missing = t.markets.filter(m => !userMarkets.includes(m));
    return { compatible: missing.length === 0, missingMarkets: missing };
  }

  getInstalls(templateId: string): string[] { return Array.from(this.installs.get(templateId) || []); }
  getRating(templateId: string, userId: string): number | undefined { return this.ratings.get(templateId)?.get(userId); }

  seed(): void {
undefined' ? `  /**
   * 🚫 [R284 MockDataGuard] Production mode → seed() skipped.
   * Replace mock data with real API sources before enabling production.
   * Real sources: KR=KOSTAT/BOK, TW=MOEA, EU=Eurostat/ECB, SA=SAMA/OPEC
   */
  if (getMockDataGuard().isProduction()) {
    console.warn('[R284] seed() skipped in production mode. Use load methods with real data.');
    return;
  }
    const categories: FactorTemplate['category'][] = ['multi-factor', 'single-factor', 'sector-rotation', 'market-timing', 'risk-parity', 'trend-following', 'mean-reversion', 'arbitrage'];
    const creators = [
      { id: 'creator_001', name: 'QuantMaster', level: 'L3' as const },
      { id: 'creator_002', name: 'AlphaSeeker', level: 'L2' as const },
      { id: 'creator_003', name: 'BetaHunter', level: 'L2' as const },
      { id: 'creator_004', name: 'GammaTrader', level: 'L1' as const },
      { id: 'institution_01', name: 'Goldman Quant', level: 'L3' as const },
    ];

    const templateNames = [
      { name: 'Value+Momentum Blend', cn: '价值动量混合', cat: 'multi-factor' as const, factors: ['pe_ttm', 'pb_lf', 'roe_ttm', 'momentum_6m', 'momentum_12m'], mkts: ['US', 'HK'], price: 5, isInst: true, isVer: true, isFeat: true, tf: 'monthly' as const },
      { name: 'Quality Minus Junk', cn: '优质减垃圾', cat: 'multi-factor' as const, factors: ['roe_ttm', 'dividend_yield', 'market_cap', 'beta_60d', 'volatility_20d'], mkts: ['US'], price: 3, isInst: false, isVer: true, isFeat: false, tf: 'monthly' as const },
      { name: 'Sector Rotation Pro', cn: '板块轮动专业版', cat: 'sector-rotation' as const, factors: ['momentum_3m', 'pmi_sens', 'major_flow_5d'], mkts: ['US', 'HK', 'CN'], price: 8, isInst: true, isVer: true, isFeat: true, tf: 'weekly' as const },
      { name: 'Mean Reversion Daily', cn: '日内均值回归', cat: 'mean-reversion' as const, factors: ['volatility_20d', 'amplitude_5d', 'amihud'], mkts: ['US'], price: 0, isInst: false, isVer: false, isFeat: false, tf: 'intraday' as const },
      { name: 'Trend Following Global', cn: '全球趋势跟随', cat: 'trend-following' as const, factors: ['momentum_3m', 'momentum_6m', 'momentum_12m', 'northbound', 'institution'], mkts: ['US', 'HK', 'JP', 'EU', 'UK'], price: 10, isInst: true, isVer: true, isFeat: true, tf: 'weekly' as const },
      { name: 'Risk Parity 5 Asset', cn: '五资产风险平价', cat: 'risk-parity' as const, factors: ['volatility_20d', 'beta_60d', 'market_cap', 'dividend_yield'], mkts: ['US', 'HK', 'CN', 'JP', 'EU'], price: 6, isInst: true, isVer: true, isFeat: false, tf: 'monthly' as const },
      { name: 'Arbitrage Scanner', cn: '套利扫描仪', cat: 'arbitrage' as const, factors: ['pe_ttm', 'pb_lf', 'turnover_rate'], mkts: ['US', 'HK'], price: 0, isInst: false, isVer: false, isFeat: false, tf: 'intraday' as const },
      { name: 'Dividend Growth Strategy', cn: '红利增长策略', cat: 'single-factor' as const, factors: ['dividend_yield', 'roe_ttm', 'pe_ttm'], mkts: ['US', 'HK', 'UK', 'SG'], price: 2, isInst: false, isVer: true, isFeat: false, tf: 'monthly' as const },
      { name: 'Market Timing VIX', cn: 'VIX择时', cat: 'market-timing' as const, factors: ['volatility_20d', 'momentum_1m', 'amplitude_5d'], mkts: ['US'], price: 4, isInst: true, isVer: true, isFeat: false, tf: 'daily' as const },
      { name: 'EM Small Cap Value', cn: '新兴小盘价值', cat: 'multi-factor' as const, factors: ['pb_lf', 'pe_ttm', 'momentum_3m', 'revenue_yoy'], mkts: ['CN', 'IN', 'BR', 'VN', 'TW'], price: 7, isInst: false, isVer: false, isFeat: false, tf: 'monthly' as const },
      { name: 'Growth at Reasonable Price', cn: '合理价格成长', cat: 'multi-factor' as const, factors: ['revenue_yoy', 'earnings_yoy', 'pe_ttm', 'roe_ttm', 'market_cap'], mkts: ['US', 'HK', 'JP'], price: 3, isInst: false, isVer: true, isFeat: true, tf: 'monthly' as const },
      { name: 'Low Vol Anomaly', cn: '低波动异象', cat: 'single-factor' as const, factors: ['volatility_20d', 'beta_60d', 'amplitude_5d'], mkts: ['US', 'UK', 'EU'], price: 0, isInst: false, isVer: false, isFeat: false, tf: 'monthly' as const },
      { name: 'Momentum Crash Protection', cn: '动量崩溃保护', cat: 'trend-following' as const, factors: ['momentum_6m', 'momentum_12m', 'volatility_20d', 'turnover_rate'], mkts: ['US'], price: 5, isInst: true, isVer: true, isFeat: false, tf: 'daily' as const },
      { name: 'Supply Chain Alpha', cn: '供应链Alpha', cat: 'multi-factor' as const, factors: ['revenue_yoy', 'market_cap', 'institution', 'turnover_rate'], mkts: ['US', 'HK', 'CN', 'TW', 'KR'], price: 8, isInst: true, isVer: true, isFeat: true, tf: 'weekly' as const },
      { name: 'AI Sentiment Mix', cn: 'AI情绪混合', cat: 'multi-factor' as const, factors: ['momentum_1m', 'major_flow_5d', 'northbound', 'pmi_sens'], mkts: ['US', 'CN'], price: 4, isInst: false, isVer: false, isFeat: false, tf: 'daily' as const },
    ];

    for (let i = 0; i < templateNames.length; i++) {
      const tn = templateNames[i];
      const creator = i < 3 ? creators[i] : creators[Math.floor(Math.random() * creators.length)];
      const backtest = {
        sharpe: +(0.8 + Math.random() * 2).toFixed(2),
        maxDD: +(-5 - Math.random() * 25).toFixed(1),
        annualReturn: +(3 + Math.random() * 25).toFixed(1),
        winRate: +(0.45 + Math.random() * 0.25).toFixed(2),
        calmar: +(0.3 + Math.random() * 1.5).toFixed(2),
        years: Math.floor(1 + Math.random() * 8),
      };
      this.publishTemplate({
        name: tn.name, nameCn: tn.cn, author: creator.name, authorId: creator.id, authorLevel: creator.level,
        category: tn.cat, description: 'Academic-backed factor combination', descriptionCn: '学术验证因子组合',
        tags: tn.cat === 'multi-factor' ? ['因子组合', '多因子', 'factor-combo'] : tn.cat === 'arbitrage' ? ['套利', 'arbitrage', '对冲'] : ['因子', 'factor', tn.cat],
        factors: tn.factors, weights: tn.factors.map((_, j) => 1 / tn.factors.length),
        markets: tn.mkts, timeframe: tn.tf, backtest,
        version: '1.0.0', price: tn.price,
        isVerified: tn.isVer, isFeatured: tn.isFeat, isInstitutional: tn.isInst,
        revenueShare: tn.isInst ? 0.1 : 0.3,
      });
    }
  }

  reset(): void {
    this.templates.clear();
    this.installs.clear();
    this.ratings.clear();
    this.creatorRevenue.clear();
  }
}

let _ftme: FactorTemplateMarketplaceEngine | undefined;
export function getFactorTemplateMarketplaceEngine(): FactorTemplateMarketplaceEngine {
  if (!_ftme) _ftme = new FactorTemplateMarketplaceEngine();
  return _ftme;
}
export function resetFactorTemplateMarketplaceEngine(): void { _ftme?.reset(); _ftme = undefined; }
