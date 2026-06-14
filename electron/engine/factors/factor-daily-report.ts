// ── R175 G3: Factor Daily Report Engine ──────────────────────────────────
// Generates daily/weekly factor health reports with rankings, alerts, and
// push delivery via SignalPipeline.
//
// Architecture:
//   generateDailyReport() → Top5/Bottom5 + anomalies + decay alerts + crowding
//   generateWeeklyReport() → 7-day trend + rolling IC charts + market contrast
//   publish() → sends via SignalPipeline subscribe mechanism
//
// Usage:
//   const rpt = await getDailyReport('US');
//   await rpt.publish(userIds);  // push to subscribers

import log from 'electron-log';

// ── Push State Types (R177 G3-G4续) ────────────────────────────────────────

interface PushState {
  lastPushDate: string;    // YYYY-MM-DD
  lastPushType: 'daily' | 'weekly' | 'none';
  pushCount: number;       // push count for current day
}

interface UserSubscription {
  factorIds: string[];     // factors user follows
  style: string;           // user's investment style
  market: string;          // primary market
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface FactorDaySnapshot {
  factorId: string;
  nameCN: string;
  rank: number;          // 1=best
  dailyIC: number;
  rollingIC_5d: number;
  rollingIC_20d: number;
  decayRate: number;     // IC decay rate per day
  crowdingScore: number; // 0-1 (1=most crowded)
  isAnomaly: boolean;    // 2σ+ IC deviation from 20d mean
  trend: 'up' | 'down' | 'flat';
  changePct: number;     // daily change %
}

export interface FactorAlert {
  factorId: string;
  nameCN: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'decay' | 'crowding' | 'anomaly' | 'failure' | 'breakout';
  message: string;
  metric: number;
  threshold: number;
}

export interface DailyReport {
  reportId: string;
  generatedAt: string;      // ISO datetime
  market: string;
  type: 'daily' | 'weekly';
  summary: string;          // 1-2 sentence executive summary
  top5: FactorDaySnapshot[];
  bottom5: FactorDaySnapshot[];
  anomalies: FactorDaySnapshot[];
  alerts: FactorAlert[];
  decayAlerts: FactorAlert[];
  crowdingAlerts: FactorAlert[];
  marketContext: string;    // macro backdrop
  recommendations: string[]; // actionable suggestions
}

export interface WeeklyReport extends DailyReport {
  type: 'weekly';
  weeklyTrend: Array<{ factorId: string; nameCN: string; icByDay: number[]; trendSlope: number }>;
  bestDay: string;
  worstDay: string;
  consistencyScore: number; // 0-1 across 7 days
}

// ── Factor Daily Report Engine ─────────────────────────────────────────────

export class FactorDailyReport {
  private static instance: FactorDailyReport;
  private pushStates: Map<string, PushState> = new Map(); // userId → push state
  private readonly MAX_DAILY_PUSHES = 1;                  // 每天最多1次推送

  private constructor() {
    log.info('[FactorDailyReport] Initialized with push frequency control');
  }

  static getInstance(): FactorDailyReport {
    if (!FactorDailyReport.instance) {
      FactorDailyReport.instance = new FactorDailyReport();
    }
    return FactorDailyReport.instance;
  }

  /**
   * Generate daily factor health report.
   */
  async generateDailyReport(market: string, factorSnapshots?: FactorDaySnapshot[]): Promise<DailyReport> {
    const snaps = factorSnapshots || this.defaultSnapshots(market);
    const sorted = [...snaps].sort((a, b) => b.dailyIC - a.dailyIC);

    const top5 = sorted.slice(0, 5).map((s, i) => ({ ...s, rank: i + 1 }));
    const bottom5 = sorted.slice(-5).reverse().map((s, i) => ({ ...s, rank: sorted.length - i }));

    const anomalies = snaps.filter(s => s.isAnomaly);
    const alerts = this.buildAlerts(snaps);
    const decayAlerts = alerts.filter(a => a.type === 'decay');
    const crowdingAlerts = alerts.filter(a => a.type === 'crowding');

    const summary = this.buildSummary(top5, bottom5, anomalies, market);
    const marketContext = this.getMarketContext(market);
    const recommendations = this.buildRecommendations(snaps, market);

    const now = new Date();
    return {
      reportId: `rpt-${market}-${now.toISOString().split('T')[0]}`,
      generatedAt: now.toISOString(),
      market,
      type: 'daily',
      summary,
      top5,
      bottom5,
      anomalies,
      alerts,
      decayAlerts,
      crowdingAlerts,
      marketContext,
      recommendations,
    };
  }

  /**
   * Generate weekly factor health report.
   */
  async generateWeeklyReport(
    market: string,
    dailyReports?: DailyReport[],
    factorSnapshots?: FactorDaySnapshot[],
  ): Promise<WeeklyReport> {
    const baseReport = await this.generateDailyReport(market, factorSnapshots);
    const reports = dailyReports || [baseReport]; // in production these come from DB

    // Build weekly trend per factor from daily IC data
    const weeklyTrend = this.buildWeeklyTrend(reports);
    const bestDay = reports.reduce((best, r) =>
      r.top5.length > 0 && r.top5[0].dailyIC > best.top5[0]?.dailyIC ? r : best, reports[0]);
    const worstDay = reports.reduce((worst, r) =>
      r.bottom5.length > 0 && r.bottom5[0].dailyIC < worst.bottom5[0]?.dailyIC ? r : worst, reports[0]);

    // Consistency: how stable are ICs across the week
    const allICs = reports.flatMap(r => [...r.top5, ...r.bottom5].map(s => s.dailyIC));
    const avgIC = allICs.reduce((a, b) => a + b, 0) / (allICs.length || 1);
    const variance = allICs.reduce((s, ic) => s + (ic - avgIC) ** 2, 0) / (allICs.length || 1);
    const consistencyScore = Math.max(0, 1 - Math.sqrt(variance) / (Math.abs(avgIC) + 0.001));

    return {
      ...baseReport,
      type: 'weekly',
      weeklyTrend,
      bestDay: bestDay.generatedAt.split('T')[0],
      worstDay: worstDay.generatedAt.split('T')[0],
      consistencyScore,
    };
  }

  /**
   * Publish report via push mechanism.
   * Subscribers receive report through SignalPipeline.
   */
  publish(report: DailyReport | WeeklyReport, channels?: string[]): void {
    const title = report.type === 'daily'
      ? `[${report.market}] 因子日报 ${report.generatedAt.split('T')[0]}`
      : `[${report.market}] 因子周报 ${report.generatedAt.split('T')[0]}`;

    const top5Str = report.top5.map((s, i) =>
      `${i + 1}. ${s.nameCN} | IC:${s.dailyIC.toFixed(3)} | 衰减:${(s.decayRate * 100).toFixed(1)}%/d | 拥挤:${(s.crowdingScore * 100).toFixed(0)}%`
    ).join('\n');

    const alertStr = report.alerts.length > 0
      ? `\n⚠️ 告警 (${report.alerts.length}):\n${report.alerts.map(a => `  • ${a.message}`).join('\n')}`
      : '';

    const content = `${title}\n\n${report.summary}\n\n📈 Top5:\n${top5Str}${alertStr}\n\n💡 建议:\n${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;

    log.info(`[FactorDailyReport] Published ${report.type}: ${report.reportId}`);

    // Integrate with SignalPipeline for push delivery
    if (channels && channels.length > 0) {
      try {
        const { getSignalPipeline } = require('./signal-pipeline');
        const pipeline = getSignalPipeline();
        pipeline.broadcast(report.reportId, {
          title,
          content,
          report,
          channels,
        });
        log.info(`[FactorDailyReport] Pushed to ${channels.length} channels`);
      } catch (e: any) {
        log.warn('[FactorDailyReport] SignalPipeline push skipped:', e?.message);
      }
    }
  }

  /**
   * [R177 G3续] Push with frequency control.
   * Enforces: max 1 push per day per user. Returns whether push was sent.
   */
  publishWithRateLimit(
    report: DailyReport | WeeklyReport,
    userId: string,
    channels?: string[],
  ): { sent: boolean; reason?: string } {
    const today = new Date().toISOString().split('T')[0];
    const state = this.pushStates.get(userId);

    // Check rate limit: only 1 push per day
    if (state && state.lastPushDate === today && state.pushCount >= this.MAX_DAILY_PUSHES) {
      const reason = `每日推送已达上限 (${this.MAX_DAILY_PUSHES}次), 上次推送: ${state.lastPushDate}`;
      log.info(`[FactorDailyReport] Rate limited for user ${userId}: ${reason}`);
      return { sent: false, reason };
    }

    // Update state
    this.pushStates.set(userId, {
      lastPushDate: today,
      lastPushType: report.type,
      pushCount: (state?.lastPushDate === today ? state.pushCount : 0) + 1,
    });

    // Deliver
    this.publish(report, channels);
    return { sent: true };
  }

  /**
   * [R177 G4续] Personalize report by user's followed factors.
   * Filters snapshots to user's factor watchlist and adjusts recommendations.
   */
  personalizeReport(report: DailyReport, subscription: UserSubscription): DailyReport {
    const followedIds = new Set(subscription.factorIds);

    // Filter to user's factors
    const top5 = report.top5.filter(s => followedIds.has(s.factorId));
    const bottom5 = report.bottom5.filter(s => followedIds.has(s.factorId));
    const anomalies = report.anomalies.filter(s => followedIds.has(s.factorId));
    const alerts = report.alerts.filter(a => followedIds.has(a.factorId));
    const decayAlerts = report.decayAlerts.filter(a => followedIds.has(a.factorId));
    const crowdingAlerts = report.crowdingAlerts.filter(a => followedIds.has(a.factorId));

    // Personalized recommendations
    const recs: string[] = [];
    const topIc = top5.length > 0 ? top5[0].dailyIC : 0;
    const hasDecay = decayAlerts.length > 0;
    const hasCrowding = crowdingAlerts.length > 0;
    const styleMap: Record<string, string> = {
      momentum: '动量策略', value: '价值投资', quality: '质量选股',
      growth: '成长投资', defensive: '防御配置', crypto: '加密投资',
    };
    const styleLabel = styleMap[subscription.style] || '当前策略';

    if (topIc > 0.04) {
      recs.push(`你的关注因子表现强劲，${styleLabel}方向持续有效`);
    }
    if (hasDecay) {
      recs.push(`${decayAlerts[0].nameCN}因子IC衰减加速，建议关注是否需要调仓`);
    }
    if (hasCrowding) {
      recs.push(`${crowdingAlerts[0].nameCN}因子拥挤度升高，新资金谨慎入场`);
    }
    if (alerts.length === 0 && topIc > 0) {
      recs.push('你关注的因子整体健康，按现有配置持有即可');
    }
    if (subscription.factorIds.length < 3) {
      recs.push('关注因子较少，建议添加互补因子以分散风险');
    }

    // Personalized summary
    const summary = top5.length > 0
      ? `你的${top5.length}个关注因子中，${top5[0].nameCN}表现最佳 (IC=${top5[0].dailyIC.toFixed(3)})，${hasDecay ? '部分因子出现衰减，需关注' : '整体表现稳定'}.`
      : `今日你关注的因子暂无突出表现，${report.summary}`;

    return {
      ...report,
      top5,
      bottom5,
      anomalies,
      alerts,
      decayAlerts,
      crowdingAlerts,
      recommendations: recs.length > 0 ? recs : report.recommendations,
      summary,
    };
  }

  /**
   * [R177 G3-G4续] Full pipeline: check rate limit → personalize → push.
   */
  async generateAndPush(
    market: string,
    userId: string,
    subscription: UserSubscription,
    factorSnapshots?: FactorDaySnapshot[],
    channels?: string[],
  ): Promise<{ report: DailyReport; pushResult: { sent: boolean; reason?: string } }> {
    const rawReport = await this.generateDailyReport(market, factorSnapshots);
    const personalized = subscription.factorIds.length > 0
      ? this.personalizeReport(rawReport, subscription)
      : rawReport;

    const pushResult = this.publishWithRateLimit(personalized, userId, channels);
    return { report: personalized, pushResult };
  }

  /**
   * [R177 G3续] Get push state for a user (for debugging/admin).
   */
  getPushState(userId: string): PushState | null {
    return this.pushStates.get(userId) || null;
  }

  /**
   * [R177 G3续] Reset push state (admin override or testing).
   */
  resetPushState(userId: string): void {
    this.pushStates.delete(userId);
    log.info(`[FactorDailyReport] Reset push state for user ${userId}`);
  }

  /**
   * [R177 G3续] Reset ALL push states (daily cron).
   */
  resetDailyLimits(): void {
    this.pushStates.clear();
    log.info('[FactorDailyReport] Daily push limits reset');
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  private defaultSnapshots(market: string): FactorDaySnapshot[] {
    const baseIC = market === 'CRYPTO' ? 0.035 : 0.025;
    const factors = [
      { id: 'MOM_12M', cn: '12月动量', ic: 0.045 }, { id: 'QUAL', cn: '质量', ic: 0.035 },
      { id: 'HML', cn: '价值', ic: 0.038 }, { id: 'VOL_60D', cn: '60日波动率', ic: 0.042 },
      { id: 'GROWTH', cn: '成长性', ic: 0.028 }, { id: 'SIZE', cn: '规模', ic: 0.025 },
      { id: 'YIELD', cn: '股息率', ic: 0.018 }, { id: 'RMW', cn: '盈利能力', ic: 0.030 },
      { id: 'LIQ', cn: '流动性', ic: 0.038 }, { id: 'RSI_14', cn: 'RSI 14', ic: 0.028 },
      { id: 'MOM_1M', cn: '1月动量', ic: 0.032 }, { id: 'CMA', cn: '投资风格', ic: 0.022 },
      { id: 'CRYPTO_FUNDING', cn: '资金费率', ic: 0.055 },
      { id: 'CRYPTO_EXCHANGE_FLOW', cn: '交易所净流量', ic: 0.048 },
    ];

    // Deterministic daily IC variation (using factor index + day-of-year)
    const dayOfYear = Math.floor((Date.now() / 86400000) % 365);
    return factors.map((f, i) => {
      const noise = Math.sin((dayOfYear + i) * 0.5) * 0.01 + Math.cos(dayOfYear * 0.3 + i) * 0.005;
      const dailyIC = f.ic + noise;
      const rollingIC_5d = dailyIC + (Math.random() - 0.5) * 0.01;
      const rollingIC_20d = f.ic + (Math.random() - 0.5) * 0.008;
      const decayRate = Math.max(0, (rollingIC_20d - rollingIC_5d) / 15);
      const crowdingScore = Math.min(1, Math.max(0, 0.3 + (f.ic - baseIC) * 15 + Math.sin((dayOfYear + i) * 0.6) * 0.2));
      const isAnomaly = Math.abs(dailyIC - rollingIC_20d) > 0.015;

      return {
        factorId: f.id,
        nameCN: f.cn,
        rank: 0,
        dailyIC: Number(dailyIC.toFixed(4)),
        rollingIC_5d: Number(rollingIC_5d.toFixed(4)),
        rollingIC_20d: Number(rollingIC_20d.toFixed(4)),
        decayRate: Number(decayRate.toFixed(4)),
        crowdingScore: Number(crowdingScore.toFixed(3)),
        isAnomaly,
        trend: dailyIC > rollingIC_5d ? 'up' : dailyIC < rollingIC_20d ? 'down' : 'flat',
        changePct: Number((((dailyIC - rollingIC_5d) / (Math.abs(rollingIC_5d) + 0.001)) * 100).toFixed(1)),
      };
    });
  }

  private buildAlerts(snaps: FactorDaySnapshot[]): FactorAlert[] {
    const alerts: FactorAlert[] = [];

    for (const s of snaps) {
      // Decay alert
      if (s.decayRate > 0.003) {
        alerts.push({
          factorId: s.factorId,
          nameCN: s.nameCN,
          severity: s.decayRate > 0.005 ? 'critical' : 'warning',
          type: 'decay',
          message: `${s.nameCN}因子IC快速衰减: ${(s.decayRate * 1000).toFixed(1)}bp/天`,
          metric: s.decayRate,
          threshold: 0.003,
        });
      }

      // Crowding alert
      if (s.crowdingScore > 0.8) {
        alerts.push({
          factorId: s.factorId,
          nameCN: s.nameCN,
          severity: s.crowdingScore > 0.9 ? 'critical' : 'warning',
          type: 'crowding',
          message: `${s.nameCN}因子拥挤度${(s.crowdingScore * 100).toFixed(0)}% — 可能存在拥挤交易风险`,
          metric: s.crowdingScore,
          threshold: 0.8,
        });
      }

      // Anomaly alert
      if (s.isAnomaly) {
        alerts.push({
          factorId: s.factorId,
          nameCN: s.nameCN,
          severity: Math.abs(s.dailyIC - s.rollingIC_20d) > 0.025 ? 'warning' : 'info',
          type: 'anomaly',
          message: `${s.nameCN}因子IC异常偏离: ${s.dailyIC.toFixed(3)} vs 20日均值 ${s.rollingIC_20d.toFixed(3)}`,
          metric: Math.abs(s.dailyIC - s.rollingIC_20d),
          threshold: 0.015,
        });
      }
    }

    return alerts.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }

  private buildSummary(top5: FactorDaySnapshot[], bottom5: FactorDaySnapshot[], anomalies: FactorDaySnapshot[], market: string): string {
    const bestName = top5[0]?.nameCN || 'N/A';
    const bestIC = top5[0]?.dailyIC.toFixed(3) || '0';
    const worstName = bottom5[0]?.nameCN || 'N/A';

    let summary = `${market}市场因子今日表现：${bestName}因子领涨(IC=${bestIC})，${worstName}因子表现最弱。`;
    if (anomalies.length > 0) {
      summary += ` 共${anomalies.length}个因子出现异常信号，需关注。`;
    }
    summary += ` 整体因子有效性${bestIC > '0.02' ? '良好' : '一般'}`;
    return summary;
  }

  private getMarketContext(market: string): string {
    const contexts: Record<string, string> = {
      US: '美股当前处于财报季后期，市场关注通胀数据和美联储政策路径。',
      HK: '港股近期受流动性波动影响，南向资金持续流入。关注政策催化。',
      CRYPTO: '加密货币市场波动加大，资金费率呈中性偏多。关注ETF资金流。',
    };
    return contexts[market] || '市场数据尚在收集中。';
  }

  private buildRecommendations(snaps: FactorDaySnapshot[], market: string): string[] {
    const recs: string[] = [];

    // Top performer
    if (snaps[0]?.dailyIC > 0.03) {
      recs.push(`${snaps[0].nameCN}因子当前IC强劲，可考虑增配`);
    }

    // Decay warning
    const decaying = snaps.filter(s => s.decayRate > 0.003);
    if (decaying.length > 0) {
      recs.push(`${decaying[0].nameCN}因子衰减加速，建议关注并评估是否需要减配`);
    }

    // Crowding alert
    const crowded = snaps.filter(s => s.crowdingScore > 0.8);
    if (crowded.length > 0) {
      recs.push(`${crowded[0].nameCN}因子拥挤度高，新入场需谨慎`);
    }

    // Market-specific
    if (market === 'US') {
      recs.push('建议分散至少4-5个因子，降低单因子集中风险');
    } else if (market === 'CRYPTO') {
      recs.push('加密因子波动大，建议设置严格的止损机制');
    }

    if (recs.length === 0) {
      recs.push('当前各因子运行正常，按现有配置持有即可');
    }

    return recs;
  }

  private buildWeeklyTrend(reports: DailyReport[]): WeeklyReport['weeklyTrend'] {
    if (reports.length === 0) return [];

    const factorMap = new Map<string, { nameCN: string; icByDay: number[] }>();

    for (const r of reports) {
      for (const s of [...r.top5, ...r.bottom5]) {
        if (!factorMap.has(s.factorId)) {
          factorMap.set(s.factorId, { nameCN: s.nameCN, icByDay: [] });
        }
        factorMap.get(s.factorId)!.icByDay.push(s.dailyIC);
      }
    }

    return Array.from(factorMap.entries()).map(([factorId, data]) => {
      const ics = data.icByDay;
      let trendSlope = 0;
      if (ics.length >= 2) {
        const n = ics.length;
        const xSum = (n - 1) * n / 2;
        const ySum = ics.reduce((a, b) => a + b, 0);
        const xySum = ics.reduce((s, y, i) => s + y * i, 0);
        const x2Sum = ics.reduce((s, _, i) => s + i * i, 0);
        const denom = n * x2Sum - xSum * xSum;
        trendSlope = denom !== 0 ? (n * xySum - xSum * ySum) / denom : 0;
      }
      return { factorId, nameCN: data.nameCN, icByDay: ics, trendSlope: Number(trendSlope.toFixed(6)) };
    }).sort((a, b) => b.trendSlope - a.trendSlope);
  }
}

// ── Singleton accessors ─────────────────────────────────────────────────────

export function getFactorDailyReport(): FactorDailyReport {
  return FactorDailyReport.getInstance();
}

export default FactorDailyReport;
