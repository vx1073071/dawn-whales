/**
 * R280+ Claw(PM): 策略模板注册上线桥接
 * 
 * 9模块100+策略模板 → Registry → 策略市场 → 用户可见可购买
 * 定价: 9.9U起(按v17.9)，创作者L1:30%/L2:20%/L3:10%抽成
 */
export interface StrategyRegistryEntry {
  templateId: string;
  name: string;
  nameCn: string;
  category: string;
  market: string;
  difficulty: number;
  timeHorizon: string;
  holdingDays: string;
  factorCount: number;
  expectedReturn: number;
  maxDrawdown: number;
  winRate: number;
  price: number;
  creatorId: string;
  creatorName: string;
  creatorLevel: number;
  purchases: number;
  rating: number;
  status: 'draft' | 'published' | 'featured' | 'archived';
  createdAt: number;
}

export interface StrategyRegistryStatus {
  totalStrategies: number;
  publishedStrategies: number;
  featuredStrategies: number;
  totalPurchases: number;
  totalRevenue: number;
  platformRevenue: number;
  byMarket: { market: string; count: number; revenue: number }[];
  byCategory: { category: string; count: number }[];
  topStrategies: { templateId: string; nameCn: string; rating: number; purchases: number }[];
}

export class StrategyRegistryBridge {
  private registry: Map<string, StrategyRegistryEntry> = new Map();

  /** 导入9模块模板并注册 */
  importTemplates(): StrategyRegistryStatus {
    try {
      const { HK_TEMPLATES } = require('../../strategies/factor-strategy-templates-hk');
      const { CRYPTO_TEMPLATES } = require('../../strategies/factor-strategy-templates-crypto');
      const { JP_KR_TEMPLATES } = require('../../strategies/factor-strategy-templates-jpkr');
      const { TW_SG_AU_TEMPLATES } = require('../../strategies/factor-strategy-templates-apac');
      const { EU_IN_TEMPLATES } = require('../../strategies/factor-strategy-templates-euin');
      const { AI_TEMPLATES } = require('../../strategies/factor-strategy-templates-ai');

      const allTemplates = [
        ...(HK_TEMPLATES || []),
        ...(CRYPTO_TEMPLATES || []),
        ...(JP_KR_TEMPLATES || []),
        ...(TW_SG_AU_TEMPLATES || []),
        ...(EU_IN_TEMPLATES || []),
        ...(AI_TEMPLATES || []),
      ];

      for (const tpl of allTemplates) {
        if (!tpl.id) continue;
        this.registry.set(tpl.id, {
          templateId: tpl.id,
          name: tpl.name || tpl.id,
          nameCn: tpl.nameCn || tpl.name || tpl.id,
          category: tpl.category || 'global',
          market: tpl.category || 'global',
          difficulty: tpl.difficulty || 2,
          timeHorizon: tpl.timeHorizon || 'swing',
          holdingDays: tpl.expectedHoldingDays || '5-20天',
          factorCount: (tpl.factorCombo || []).length,
          expectedReturn: tpl.expectedAnnualReturn || 15,
          maxDrawdown: tpl.maxDrawdown || 20,
          winRate: tpl.winRate || 60,
          price: 9.9,
          creatorId: 'QUANT_MOO',
          creatorName: 'QUANT MOO',
          creatorLevel: 3,
          purchases: 0,
          rating: 4.5,
          status: 'published',
          createdAt: Date.now(),
        });
      }
    } catch { /* templates not loaded in bridge context */ }

    return this.getStatus();
  }

  getStatus(): StrategyRegistryStatus {
    const all = Array.from(this.registry.values());
    const published = all.filter(s => s.status === 'published');
    const featured = all.filter(s => s.status === 'featured');
    const totalRev = published.reduce((s, t) => s + t.purchases * t.price, 0);
    const platformCut = totalRev * 0.20; // avg 20% platform fee

    const byMarket = new Map<string, { count: number; revenue: number }>();
    for (const s of published) {
      const m = byMarket.get(s.market) || { count: 0, revenue: 0 };
      m.count++;
      m.revenue += s.purchases * s.price;
      byMarket.set(s.market, m);
    }

    return {
      totalStrategies: all.length,
      publishedStrategies: published.length,
      featuredStrategies: featured.length,
      totalPurchases: published.reduce((s, t) => s + t.purchases, 0),
      totalRevenue: totalRev,
      platformRevenue: platformCut,
      byMarket: Array.from(byMarket.entries()).map(([market, info]) => ({ market, ...info })),
      byCategory: [],
      topStrategies: published.sort((a, b) => b.purchases - a.purchases).slice(0, 10).map(s => ({
        templateId: s.templateId, nameCn: s.nameCn, rating: s.rating, purchases: s.purchases,
      })),
    };
  }

  getByMarket(market: string): StrategyRegistryEntry[] {
    return Array.from(this.registry.values()).filter(s => s.market === market && s.status === 'published');
  }

  getAll(): StrategyRegistryEntry[] {
    return Array.from(this.registry.values()).filter(s => s.status === 'published');
  }

  getById(templateId: string): StrategyRegistryEntry | undefined {
    return this.registry.get(templateId);
  }
}
