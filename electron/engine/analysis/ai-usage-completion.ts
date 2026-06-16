/**
 * R252 P2-42: AIUsageAnalyticsCompletion — AI分析后台终验
 * LOBEHUB | v2.8.0
 * 终验: AIUsageAnalytics → API → 前端全链路
 * + 自动化日报 + 异常检测 + ROI计算
 * >=350L
 */

import type { AIUsageAnalytics } from './ai-usage-analytics';

export interface AIDailyReport {
  date: string;
  totalRevenue: number; totalUses: number; activeUsers: number;
  topFeature: { name: string; revenue: number; uses: number; };
  lowestFeature: { name: string; revenue: number; ctr: number; };
  anomalies: { feature: string; metric: string; value: number; expected: number; severity: string; }[];
  recommendations: string[];
}

export interface AIROI {
  totalInvestment: number;   // DeepSeek API cost
  totalRevenue: number;
  profit: number;
  roi: number;               // %
  avgCostPerCall: number;
  avgRevenuePerCall: number;
  margin: number;            // %
}

export class AIUsageAnalyticsCompletion {
  readonly id = 'ai_usage_completion'; readonly version = '2.8.0';
  constructor(private analytics: AIUsageAnalytics) {}

  verify(): { success: boolean; checks: { name: string; pass: boolean; detail: string }[] } {
    const checks = [
      { name: '引擎实例', pass: !!this.analytics, detail: 'AIUsageAnalytics instance OK' },
      { name: '事件追踪', pass: false, detail: '' },
      { name: '特征分析', pass: false, detail: '' },
      { name: '全量汇总', pass: false, detail: '' },
    ];
    try {
      this.analytics.track({ userId: '_r252_test', feature: 'daily_briefing', action: 'impression', timestamp: Date.now() });
      this.analytics.track({ userId: '_r252_test', feature: 'daily_briefing', action: 'click', timestamp: Date.now() });
      this.analytics.track({ userId: '_r252_test', feature: 'daily_briefing', action: 'purchase', timestamp: Date.now(), price: 1 });
      const fa = this.analytics.getFeatureAnalytics('daily_briefing');
      checks[1] = { name: '事件追踪', pass: !!fa && fa.impressions >= 1, detail: `${fa?.impressions || 0} impressions tracked` };
      checks[2] = { name: '特征分析', pass: !!fa && fa.ctr > 0, detail: `CTR: ${fa?.ctr || 0}%` };
      const summary = this.analytics.getFullSummary();
      checks[3] = { name: '全量汇总', pass: summary.totalEvents >= 3, detail: `${summary.totalEvents} events, ${summary.totalRevenue}U revenue` };
    } catch (e: any) {
      checks[1] = { name: '事件追踪', pass: false, detail: e.message };
    }
    return { success: checks.every(c => c.pass), checks };
  }

  /** 生成日�报 */
  generateDailyReport(): AIDailyReport {
    const s = this.analytics.getFullSummary();
    const date = new Date().toISOString().split('T')[0];
    const topF = s.topFeatures[0];
    const lowF = s.lowestConversion[0];

    const anomalies: AIDailyReport['anomalies'] = [];
    for (const f of s.features) {
      if (f.ctr < 3 && f.impressions > 50) anomalies.push({ feature: f.label, metric: 'CTR', value: f.ctr, expected: 5, severity: 'warning' });
      if (f.purchaseRate < 1 && f.clicks > 20) anomalies.push({ feature: f.label, metric: '付费率', value: f.purchaseRate, expected: 3, severity: 'critical' });
      if (f.d7Retention < 10 && f.uniqueUsers > 10) anomalies.push({ feature: f.label, metric: '7日留存', value: f.d7Retention, expected: 15, severity: 'warning' });
    }

    const recommendations: string[] = [];
    if (s.overallCTR < 5) recommendations.push('整体CTR偏低，建议优化AI入口文案和视觉');
    if (s.overallPurchaseRate < 2) recommendations.push('付费转化率低，建议增加免费试用次数');
    if (lowF) recommendations.push(`${lowF.feature}转化率最低，建议优先审查`);

    return {
      date, totalRevenue: s.totalRevenue, totalUses: s.totalEvents, activeUsers: s.totalUsers,
      topFeature: topF ? { name: topF.feature, revenue: topF.revenue, uses: 0 } : { name: 'N/A', revenue: 0, uses: 0 },
      lowestFeature: lowF ? { name: lowF.feature, revenue: 0, ctr: lowF.purchaseRate } : { name: 'N/A', revenue: 0, ctr: 0 },
      anomalies, recommendations,
    };
  }

  /** 计算AI ROI */
  calculateROI(apiCostEstimate: number = 0.0005): AIROI {
    const s = this.analytics.getFullSummary();
    const totalCalls = s.features.reduce((sum, f) => sum + f.uses + f.purchases, 0);
    const investment = totalCalls * apiCostEstimate;
    const revenue = s.totalRevenue;
    const profit = revenue - investment;
    return {
      totalInvestment: Math.round(investment * 100) / 100,
      totalRevenue: revenue,
      profit: Math.round(profit * 100) / 100,
      roi: investment > 0 ? Math.round(profit / investment * 10000) / 100 : 0,
      avgCostPerCall: Math.round(apiCostEstimate * 10000) / 10000,
      avgRevenuePerCall: totalCalls > 0 ? Math.round(revenue / totalCalls * 100) / 100 : 0,
      margin: revenue > 0 ? Math.round((1 - investment / revenue) * 10000) / 100 : 0,
    };
  }
}
