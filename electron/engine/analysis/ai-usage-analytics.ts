/**
 * R248 P2-42: AIUsageAnalytics — AI使用分析后台
 * LOBEHUB | v2.8.0
 *
 * 为每个AI功能的CTR/转化/留存/ARPU提供数据追踪。
 *
 * 追踪指标:
 *   - CTR: 展示→点击转化
 *   - Conversion: 点击→付费转化
 *   - Retention: 首次使用→7日/30日留存
 *   - ARPU: 每用户平均收入
 *   - Funnel: 每步转化率
 *
 * 支持的AI功能:
 *   早报/风险扫描/供应链/回测/事件策略/因子诊断/优化/替代解锁/信用包
 *
 * 约束: 纯TypeScript, >=400L
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────

export type AIFeature =
  | 'daily_briefing' | 'risk_scan' | 'supply_chain' | 'news_backtest'
  | 'event_strategy' | 'factor_diagnosis' | 'ai_optimize' | 'alt_unlock'
  | 'credit_package' | 'ai_param_suggest' | 'ai_strategy_match';

export interface AIUsageEvent {
  userId: string; feature: AIFeature; action: 'impression' | 'click' | 'purchase' | 'use';
  timestamp: number; price?: number; sessionId?: string;
}

export interface AIFunnelStep {
  step: string; count: number; conversionRate: number; dropOff: number;
}

export interface AIFeatureAnalytics {
  feature: AIFeature; label: string; price: number;
  impressions: number; clicks: number; purchases: number; uses: number;
  ctr: number;           // clicks/impressions
  purchaseRate: number;  // purchases/clicks
  useRate: number;       // uses/purchases
  revenue: number;
  arpu: number;          // revenue/uniqueUsers
  uniqueUsers: number;
  d7Retention: number;
  d30Retention: number;
  funnel: AIFunnelStep[];
}

export interface AIUsageSummary {
  totalRevenue: number; totalUsers: number; totalEvents: number;
  overallCTR: number; overallPurchaseRate: number;
  topFeatures: { feature: string; revenue: number; }[];
  lowestConversion: { feature: string; purchaseRate: number; }[];
  monthlyTrend: { month: string; revenue: number; users: number; }[];
  features: AIFeatureAnalytics[];
  updatedAt: number;
}

export interface AnalyticsConfig {
  retentionDays: number; maxEventsPerUser: number;
}

const DEFAULT_CONFIG: AnalyticsConfig = {
  retentionDays: 30, maxEventsPerUser: 10000,
};

const FEATURE_LABELS: Record<AIFeature, { label: string; price: number; }> = {
  daily_briefing: { label: 'AI每日早报', price: 1 },
  risk_scan: { label: '持仓风险扫描', price: 1 },
  supply_chain: { label: '供应链传导', price: 1 },
  news_backtest: { label: '新闻回测', price: 1.5 },
  event_strategy: { label: '事件驱动策略', price: 1.5 },
  factor_diagnosis: { label: '因子深度诊断', price: 1 },
  ai_optimize: { label: 'AI参数优化', price: 1.5 },
  alt_unlock: { label: '替代数据解锁', price: 2 },
  credit_package: { label: '信用包购买', price: 0 },
  ai_param_suggest: { label: 'AI参数建议', price: 1 },
  ai_strategy_match: { label: 'AI策略匹配', price: 1 },
};

// ── AIUsageAnalytics ──────────────────────────────────────

export class AIUsageAnalytics {
  readonly id = 'ai_usage_analytics';
  readonly version = '2.8.0';

  private config: AnalyticsConfig;
  private events: AIUsageEvent[] = [];

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── 事件追踪 ──────────────────────────────────────────

  track(event: AIUsageEvent): void {
    this.events.push(event);
    if (this.events.length > this.config.maxEventsPerUser * 100) {
      this.events = this.events.slice(-this.config.maxEventsPerUser * 50);
    }
  }

  trackBatch(events: AIUsageEvent[]): void {
    this.events.push(...events);
  }

  // ── 分析计算 ──────────────────────────────────────────

  getFeatureAnalytics(feature: AIFeature): AIFeatureAnalytics | null {
    const label = FEATURE_LABELS[feature];
    if (!label) return null;

    const fe = this.events.filter(e => e.feature === feature);
    const impressions = fe.filter(e => e.action === 'impression').length;
    const clicks = fe.filter(e => e.action === 'click').length;
    const purchases = fe.filter(e => e.action === 'purchase').length;
    const uses = fe.filter(e => e.action === 'use').length;
    const uniqueUsers = new Set(fe.map(e => e.userId)).size;
    const revenue = fe.filter(e => e.action === 'purchase').reduce((s, e) => s + (e.price || label.price), 0);

    const ctr = impressions > 0 ? Math.round(clicks / impressions * 10000) / 100 : 0;
    const purchaseRate = clicks > 0 ? Math.round(purchases / clicks * 10000) / 100 : 0;
    const useRate = purchases > 0 ? Math.round(uses / purchases * 10000) / 100 : 0;
    const arpu = uniqueUsers > 0 ? Math.round(revenue / uniqueUsers * 100) / 100 : 0;

    // 留存
    const purchaseUsers = [...new Set(fe.filter(e => e.action === 'purchase').map(e => e.userId))];
    let d7Ret = 0, d30Ret = 0;
    if (purchaseUsers.length > 0) {
      const now = Date.now();
      const d7ago = now - 7 * 86400000;
      const d30ago = now - 30 * 86400000;
      const retained7 = purchaseUsers.filter(uid => fe.some(e => e.userId === uid && e.timestamp >= d7ago && e.action === 'use')).length;
      const retained30 = purchaseUsers.filter(uid => fe.some(e => e.userId === uid && e.timestamp >= d30ago && e.action === 'use')).length;
      d7Ret = Math.round(retained7 / purchaseUsers.length * 10000) / 100;
      d30Ret = Math.round(retained30 / purchaseUsers.length * 10000) / 100;
    }

    // 漏斗
    const funnel: AIFunnelStep[] = [
      { step: '曝光', count: impressions, conversionRate: 100, dropOff: 0 },
      { step: '点击', count: clicks, conversionRate: ctr, dropOff: impressions - clicks },
      { step: '付费', count: purchases, conversionRate: purchaseRate, dropOff: clicks - purchases },
      { step: '使用', count: uses, conversionRate: useRate, dropOff: purchases - uses },
    ];

    return {
      feature, label: label.label, price: label.price,
      impressions, clicks, purchases, uses, ctr, purchaseRate, useRate,
      revenue, arpu, uniqueUsers, d7Retention: d7Ret, d30Retention: d30Ret, funnel,
    };
  }

  getFullSummary(): AIUsageSummary {
    const features: AIFeatureAnalytics[] = [];
    const allFeatures = Object.keys(FEATURE_LABELS) as AIFeature[];

    let totalRevenue = 0;
    const allUsers = new Set<string>();

    for (const f of allFeatures) {
      const fa = this.getFeatureAnalytics(f);
      if (fa && fa.impressions > 0) {
        features.push(fa);
        totalRevenue += fa.revenue;
        this.events.filter(e => e.feature === f).forEach(e => allUsers.add(e.userId));
      }
    }

    const totalEvents = this.events.length;
    const totalImpressions = features.reduce((s, f) => s + f.impressions, 0);
    const totalClicks = features.reduce((s, f) => s + f.clicks, 0);
    const totalPurchases = features.reduce((s, f) => s + f.purchases, 0);

    const overallCTR = totalImpressions > 0 ? Math.round(totalClicks / totalImpressions * 10000) / 100 : 0;
    const overallPR = totalClicks > 0 ? Math.round(totalPurchases / totalClicks * 10000) / 100 : 0;

    // Top features
    const sortedByRevenue = [...features].sort((a, b) => b.revenue - a.revenue);
    const sortedByConversion = [...features].sort((a, b) => a.purchaseRate - b.purchaseRate);

    // 月度趋势
    const monthlyMap = new Map<string, { revenue: number; users: Set<string>; }>();
    for (const e of this.events) {
      const month = new Date(e.timestamp).toISOString().substring(0, 7);
      if (!monthlyMap.has(month)) monthlyMap.set(month, { revenue: 0, users: new Set() });
      const m = monthlyMap.get(month)!;
      if (e.action === 'purchase') m.revenue += e.price || 0;
      m.users.add(e.userId);
    }
    const monthlyTrend = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, revenue: Math.round(data.revenue * 100) / 100, users: data.users.size }));

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalUsers: allUsers.size, totalEvents,
      overallCTR, overallPurchaseRate: overallPR,
      topFeatures: sortedByRevenue.slice(0, 5).map(f => ({ feature: f.label, revenue: f.revenue })),
      lowestConversion: sortedByConversion.slice(0, 3).map(f => ({ feature: f.label, purchaseRate: f.purchaseRate })),
      monthlyTrend,
      features: features.sort((a, b) => b.revenue - a.revenue),
      updatedAt: Date.now(),
    };
  }

  // ── 用户级分析 ────────────────────────────────────────

  getUserAIProfile(userId: string): {
    totalSpent: number; favoriteFeature: string; featuresUsed: number;
    lastUsed: number | null; totalUses: number;
  } {
    const ue = this.events.filter(e => e.userId === userId);
    const spent = ue.filter(e => e.action === 'purchase').reduce((s, e) => s + (e.price || 0), 0);
    const featureCounts = new Map<string, number>();
    ue.forEach(e => featureCounts.set(e.feature, (featureCounts.get(e.feature) || 0) + 1));
    const favorite = [...featureCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const lastUsed = ue.length > 0 ? Math.max(...ue.map(e => e.timestamp)) : null;

    return {
      totalSpent: Math.round(spent * 100) / 100,
      favoriteFeature: favorite ? FEATURE_LABELS[favorite[0] as AIFeature]?.label || favorite[0] : 'none',
      featuresUsed: featureCounts.size,
      lastUsed,
      totalUses: ue.filter(e => e.action === 'use').length,
    };
  }

  reset(): void { this.events = []; }
}

export default AIUsageAnalytics;
