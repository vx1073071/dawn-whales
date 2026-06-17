// ══ R254 LOBEHUB QU-04: AI使用分析后台 ══
// User analytics for AI features — CTR / 转化 / 留存 / ARPU
// "哪些AI功能真有人买？这个后台告诉你，别猜。"
//
// 追踪维度:
//   Feature → Impressions → Clicks → Conversions → Revenue → Retention
//
// 功能：快评/简报/异动归因/板块诊断/多股对比/因子组合对比/策略优化

export type AIFeatureId =
  | 'quick_review'       // 快评 0.99U
  | 'premarket_briefing' // 简报 1.99U
  | 'anomaly_attribution' // 异动归因 0.99U
  | 'sector_diagnosis'   // 板块诊断 0.99U
  | 'multi_stock_compare' // 多股对比 1.49U
  | 'factor_compare'     // 因子组合对比 1.49U
  | 'strategy_optimize'; // 策略优化 1.49U

export const AI_FEATURE_PRICES: Record<AIFeatureId, number> = {
  quick_review: 0.99,
  premarket_briefing: 1.99,
  anomaly_attribution: 0.99,
  sector_diagnosis: 0.99,
  multi_stock_compare: 1.49,
  factor_compare: 1.49,
  strategy_optimize: 1.49,
};

export const AI_FEATURE_LABELS: Record<AIFeatureId, { zh: string; en: string; emoji: string }> = {
  quick_review: { zh: '快评', en: 'Quick Review', emoji: '⚡' },
  premarket_briefing: { zh: '盘前简报', en: 'Premarket Briefing', emoji: '📋' },
  anomaly_attribution: { zh: '异动归因', en: 'Anomaly Attribution', emoji: '🔍' },
  sector_diagnosis: { zh: '板块诊断', en: 'Sector Diagnosis', emoji: '🏥' },
  multi_stock_compare: { zh: '多股对比', en: 'Multi-Stock Compare', emoji: '⚖️' },
  factor_compare: { zh: '因子组合对比', en: 'Factor Compare', emoji: '🧬' },
  strategy_optimize: { zh: '策略优化', en: 'Strategy Optimize', emoji: '🎯' },
};

// ═══════════════════ 数据结构 ═══════════════════

export interface AIUsageEvent {
  eventId: string;
  userId: string;
  featureId: AIFeatureId;
  eventType: 'IMPRESSION' | 'CLICK' | 'PURCHASE' | 'REPEAT_PURCHASE';
  price?: number;
  timestamp: number;
  metadata?: {
    stockSymbol?: string;
    sectorId?: string;
    comparisonStockA?: string;
    comparisonStockB?: string;
    strategyId?: string;
    sessionDuration?: number;
    deviceType?: string;
  };
}

export interface FeatureAnalytics {
  featureId: AIFeatureId;
  label: string;
  emoji: string;
  impressions: number;
  clicks: number;
  purchases: number;
  repeatPurchases: number;
  revenue: number;
  ctr: number;             // Click Through Rate
  cvr: number;             // Conversion Rate (purchases/clicks)
  repeatRate: number;      // 复购率
  arpu: number;            // Average Revenue Per Impression
  avgPrice: number;
  trend: 'UP' | 'STABLE' | 'DOWN';
  trendChangePct: number;  // 相比上期变化
}

export interface AnalyticsSnapshot {
  timestamp: number;
  period: { start: number; end: number };
  totalRevenue: number;
  totalPurchases: number;
  totalImpressions: number;
  overallCTR: number;
  overallCVR: number;
  features: FeatureAnalytics[];
  topFeature: { featureId: AIFeatureId; revenue: number };
  worstFeature: { featureId: AIFeatureId; revenue: number };
  recommendations: string[];
}

// ═══════════════════ 分析引擎 ═══════════════════

export function computeFeatureAnalytics(
  featureId: AIFeatureId,
  events: AIUsageEvent[],
  previousPeriod?: FeatureAnalytics,
): FeatureAnalytics {
  const fe = events.filter(e => e.featureId === featureId);
  const imps = fe.filter(e => e.eventType === 'IMPRESSION').length;
  const clicks = fe.filter(e => e.eventType === 'CLICK').length;
  const purchases = fe.filter(e => e.eventType === 'PURCHASE').length;
  const repeats = fe.filter(e => e.eventType === 'REPEAT_PURCHASE').length;
  const revenue = fe
    .filter(e => e.eventType === 'PURCHASE' || e.eventType === 'REPEAT_PURCHASE')
    .reduce((s, e) => s + (e.price || AI_FEATURE_PRICES[featureId]), 0);

  const ctr = imps > 0 ? clicks / imps : 0;
  const cvr = clicks > 0 ? purchases / clicks : 0;
  const repeatRate = purchases > 0 ? repeats / purchases : 0;
  const arpu = imps > 0 ? revenue / imps : 0;

  let trend: FeatureAnalytics['trend'] = 'STABLE';
  let trendChangePct = 0;
  if (previousPeriod) {
    trendChangePct = previousPeriod.revenue > 0
      ? (revenue - previousPeriod.revenue) / previousPeriod.revenue
      : 0;
    if (trendChangePct > 0.10) trend = 'UP';
    else if (trendChangePct < -0.10) trend = 'DOWN';
    else trend = 'STABLE';
  }

  return {
    featureId,
    label: AI_FEATURE_LABELS[featureId].zh,
    emoji: AI_FEATURE_LABELS[featureId].emoji,
    impressions: imps,
    clicks,
    purchases,
    repeatPurchases: repeats,
    revenue,
    ctr,
    cvr,
    repeatRate,
    arpu,
    avgPrice: AI_FEATURE_PRICES[featureId],
    trend,
    trendChangePct,
  };
}

export function generateAnalyticsSnapshot(
  events: AIUsageEvent[],
  start: number,
  end: number,
  previousSnapshot?: AnalyticsSnapshot,
): AnalyticsSnapshot {
  const periodEvents = events.filter(e => e.timestamp >= start && e.timestamp <= end);
  const featureIds: AIFeatureId[] = [
    'quick_review', 'premarket_briefing', 'anomaly_attribution',
    'sector_diagnosis', 'multi_stock_compare', 'factor_compare', 'strategy_optimize',
  ];

  const features = featureIds.map(fid => {
    const prev = previousSnapshot?.features.find(f => f.featureId === fid);
    return computeFeatureAnalytics(fid, periodEvents, prev);
  });
  features.sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = features.reduce((s, f) => s + f.revenue, 0);
  const totalPurchases = features.reduce((s, f) => s + f.purchases + f.repeatPurchases, 0);
  const totalImps = features.reduce((s, f) => s + f.impressions, 0);
  const totalClicks = features.reduce((s, f) => s + f.clicks, 0);
  const overallCTR = totalImps > 0 ? totalClicks / totalImps : 0;
  const overallCVR = totalClicks > 0 ? totalPurchases / totalClicks : 0;

  const top = features[0];
  const worst = features[features.length - 1];

  const recs: string[] = [];
  if (overallCVR < 0.05) recs.push('⚠️ 整体转化率<5%——可能需要降低价格或优化购买流程');
  if (features.filter(f => f.repeatRate < 0.1).length > 3) recs.push('💡 多个功能复购率<10%——内容质量/频次可能需要提升');
  const zeroRevenue = features.filter(f => f.revenue === 0).length;
  if (zeroRevenue > 0) recs.push(`⚠️ ${zeroRevenue}个功能零收入——建议重新评估定价或内容`);

  return {
    timestamp: Date.now(),
    period: { start, end },
    totalRevenue,
    totalPurchases,
    totalImpressions: totalImps,
    overallCTR,
    overallCVR,
    features,
    topFeature: { featureId: top.featureId, revenue: top.revenue },
    worstFeature: { featureId: worst.featureId, revenue: worst.revenue },
    recommendations: recs,
  };
}

// ═══════════════════ 用户生命周期分析 ═══════════════════

export interface UserLifecycleStage {
  stage: 'NEW' | 'ACTIVE' | 'AT_RISK' | 'CHURNED' | 'POWER_USER';
  count: number;
  pct: number;
  avgRevenue: number;
  avgSessionsPerWeek: number;
}

export function analyzeUserLifecycle(
  userIds: string[],
  events: AIUsageEvent[],
  now: number,
): UserLifecycleStage[] {
  const stages: UserLifecycleStage[] = [];
  const total = userIds.length;

  const stagesData = {
    NEW: [] as string[],
    ACTIVE: [] as string[],
    AT_RISK: [] as string[],
    CHURNED: [] as string[],
    POWER_USER: [] as string[],
  };

  for (const uid of userIds) {
    const userEvents = events.filter(e => e.userId === uid);
    if (userEvents.length === 0) continue;

    const firstEvent = Math.min(...userEvents.map(e => e.timestamp));
    const lastEvent = Math.max(...userEvents.map(e => e.timestamp));
    const daysSinceFirst = (now - firstEvent) / (24 * 60 * 60 * 1000);
    const daysSinceLast = (now - lastEvent) / (24 * 60 * 60 * 1000);
    const sessionsPerWeek = userEvents.length / Math.max(1, daysSinceFirst / 7);

    if (daysSinceFirst < 7) stagesData.NEW.push(uid);
    else if (daysSinceLast > 30) stagesData.CHURNED.push(uid);
    else if (daysSinceLast > 14) stagesData.AT_RISK.push(uid);
    else if (sessionsPerWeek > 10) stagesData.POWER_USER.push(uid);
    else stagesData.ACTIVE.push(uid);
  }

  for (const [stage, users] of Object.entries(stagesData)) {
    const userSet = new Set(users);
    const stageEvents = events.filter(e => userSet.has(e.userId));
    const rev = stageEvents
      .filter(e => e.eventType === 'PURCHASE' || e.eventType === 'REPEAT_PURCHASE')
      .reduce((s, e) => s + (e.price || 0), 0);

    const allStageEvents = stagesData[stage as keyof typeof stagesData];
    let avgSessions = 0;
    if (allStageEvents.length > 0) {
      avgSessions = stageEvents.filter(e => e.eventType === 'IMPRESSION').length / allStageEvents.length;
    }

    stages.push({
      stage: stage as UserLifecycleStage['stage'],
      count: users.length,
      pct: total > 0 ? (users.length / total) * 100 : 0,
      avgRevenue: users.length > 0 ? rev / users.length : 0,
      avgSessionsPerWeek: Math.round(avgSessions * 10) / 10,
    });
  }

  return stages;
}

// ═══════════════════ 导出 ═══════════════════

export default AnalyticsSnapshot;
