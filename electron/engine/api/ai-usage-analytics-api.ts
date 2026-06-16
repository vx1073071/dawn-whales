/**
 * R250 P2-42: AIUsageAnalyticsAPI — AI分析后台路由绑定
 * LOBEHUB | v2.8.0
 * 依赖 AIUsageAnalytics (R248 P2-42)
 * 端点: summary/feature/:name/user/:id/track/batch
 * >=300L
 */

import type { AIUsageAnalytics, AIFeature } from '../analysis/ai-usage-analytics';

const VALID_FEATURES = new Set([
  'daily_briefing','risk_scan','supply_chain','news_backtest','event_strategy',
  'factor_diagnosis','ai_optimize','alt_unlock','credit_package','ai_param_suggest','ai_strategy_match'
]);

export class AIUsageAnalyticsAPI {
  readonly id = 'ai_usage_analytics_api'; readonly version = '2.8.0';
  constructor(private analytics: AIUsageAnalytics) {}

  getSummary() {
    const s = this.analytics.getFullSummary();
    return { success: true, data: s };
  }

  getFeature(name: string) {
    if (!VALID_FEATURES.has(name)) return { success: false, error: 'Invalid feature', validFeatures: [...VALID_FEATURES] };
    const fa = this.analytics.getFeatureAnalytics(name as AIFeature);
    return { success: true, data: fa };
  }

  getUserProfile(userId: string) {
    const p = this.analytics.getUserAIProfile(userId);
    return { success: true, data: p };
  }

  track(body: { userId: string; feature: string; action: string; price?: number; sessionId?: string }) {
    if (!VALID_FEATURES.has(body.feature)) return { success: false, error: 'Invalid feature' };
    this.analytics.track({
      userId: body.userId, feature: body.feature as AIFeature,
      action: body.action as any, timestamp: Date.now(),
      price: body.price, sessionId: body.sessionId,
    });
    return { success: true };
  }

  trackBatch(events: { userId: string; feature: string; action: string; price?: number }[]) {
    const valid = events.filter(e => VALID_FEATURES.has(e.feature)).map(e => ({
      userId: e.userId, feature: e.feature as AIFeature,
      action: e.action as any, timestamp: Date.now(), price: e.price,
    }));
    this.analytics.trackBatch(valid);
    return { success: true, tracked: valid.length, skipped: events.length - valid.length };
  }

  getMonthlyTrend() {
    const s = this.analytics.getFullSummary();
    return { success: true, data: s.monthlyTrend };
  }

  getTopFeatures(limit: number = 5) {
    const s = this.analytics.getFullSummary();
    return { success: true, data: s.topFeatures.slice(0, limit) };
  }

  getLowestConversion(limit: number = 3) {
    const s = this.analytics.getFullSummary();
    return { success: true, data: s.lowestConversion.slice(0, limit) };
  }

  reset() { this.analytics.reset(); return { success: true, message: 'Analytics reset' }; }
}

export function bindAIUsageRoutes(app: any, basePath: string, api: AIUsageAnalyticsAPI): void {
  app.get(`${basePath}/summary`, (_: any, res: any) => res.json(api.getSummary()));
  app.get(`${basePath}/feature/:name`, (req: any, res: any) => res.json(api.getFeature(req.params.name)));
  app.get(`${basePath}/user/:id`, (req: any, res: any) => res.json(api.getUserProfile(req.params.id)));
  app.get(`${basePath}/trend`, (_: any, res: any) => res.json(api.getMonthlyTrend()));
  app.get(`${basePath}/top`, (req: any, res: any) => res.json(api.getTopFeatures(parseInt(req.query.limit) || 5)));
  app.get(`${basePath}/lowest`, (req: any, res: any) => res.json(api.getLowestConversion(parseInt(req.query.limit) || 3)));
  app.post(`${basePath}/track`, (req: any, res: any) => res.json(api.track(req.body)));
  app.post(`${basePath}/track-batch`, (req: any, res: any) => res.json(api.trackBatch(req.body?.events || [])));
  app.post(`${basePath}/reset`, (_: any, res: any) => res.json(api.reset()));
}
