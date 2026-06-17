/**
 * R275+ Claw(PM): 指标模板市场 — 收费上线桥接
 * 集成 indicator-template-marketplace-engine → IPC → 前端
 * 创作者提交指标模板→审核→上架→用户购买→平台抽成
 * 抽成: L1 30% / L2 20% / L3 10%
 */

import { EventEmitter } from 'events';

export interface IndicatorTemplate {
  templateId: string;
  name: string;
  nameCn: string;
  authorId: string;
  authorName: string;
  indicators: { name: string; params: Record<string, number>; color: string }[];
  timeframe: string;
  description: string;
  descriptionCn: string;
  price: number; // USDT, 最低 1.99
  rating: number;
  purchases: number;
  category: 'trend' | 'momentum' | 'volume' | 'volatility' | 'custom';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface TemplateMarketStatus {
  totalTemplates: number;
  approvedTemplates: number;
  totalPurchases: number;
  totalRevenue: number;
  platformRevenue: number;
  topCreators: { name: string; revenue: number; templates: number }[];
}

const PLATFORM_CUT: Record<number, number> = {
  1: 0.30, 2: 0.20, 3: 0.10, // L1/L2/L3
};

export class IndicatorTemplateMarketBridge extends EventEmitter {
  private templates: Map<string, IndicatorTemplate> = new Map();
  private purchases: Map<string, { userId: string; templateId: string; timestamp: number }[]> = new Map();

  addTemplate(template: IndicatorTemplate): void {
    template.templateId = `IT-${Date.now()}`;
    template.status = 'pending';
    template.createdAt = Date.now();
    this.templates.set(template.templateId, template);
    this.emit('template:submitted', template);
  }

  approveTemplate(templateId: string): void {
    const t = this.templates.get(templateId);
    if (t) { t.status = 'approved'; this.emit('template:approved', t); }
  }

  getMarketplace(category?: string, sortBy: 'rating' | 'purchases' | 'newest' = 'purchases'): IndicatorTemplate[] {
    let list = Array.from(this.templates.values()).filter(t => t.status === 'approved');
    if (category) list = list.filter(t => t.category === category);
    return list.sort((a, b) => sortBy === 'rating' ? b.rating - a.rating : sortBy === 'purchases' ? b.purchases - a.purchases : b.createdAt - a.createdAt);
  }

  getStatus(): TemplateMarketStatus {
    const approved = Array.from(this.templates.values()).filter(t => t.status === 'approved');
    const totalRev = approved.reduce((s, t) => s + t.purchases * t.price, 0);
    const platformRev = this.calculatePlatformRevenue(approved);
    const creators = new Map<string, { name: string; revenue: number; templates: number }>();
    for (const t of approved) {
      const c = creators.get(t.authorId) || { name: t.authorName, revenue: 0, templates: 0 };
      c.revenue += t.purchases * t.price * (1 - 0.30);
      c.templates++;
      creators.set(t.authorId, c);
    }

    return {
      totalTemplates: this.templates.size,
      approvedTemplates: approved.length,
      totalPurchases: approved.reduce((s, t) => s + t.purchases, 0),
      totalRevenue: totalRev,
      platformRevenue: platformRev,
      topCreators: Array.from(creators.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
  }

  private calculatePlatformRevenue(templates: IndicatorTemplate[]): number {
    let total = 0;
    for (const t of templates) {
      const level = t.purchases >= 1000 ? 3 : t.purchases >= 100 ? 2 : 1;
      total += t.purchases * t.price * PLATFORM_CUT[level];
    }
    return total;
  }
}
