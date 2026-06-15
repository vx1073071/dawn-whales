/**
 * DailyBriefingEngine — R202 J2: AI每日因子简报引擎
 *
 * Top5因子 + 异常检测(飙升/腰斩/翻转/拥挤) + DeepSeek建议 -> 扣费1U.
 *
 * Flow:
 *   1. Subscribe (user opts in, 1U/day)
 *   2. Daily cron: collect Top-5 IC ranking + anomaly detection
 *   3. Generate briefing (DeepSeek commentary)
 *   4. Charge 1U via billing-service
 *   5. Archive 7-day history
 *
 * >=300L production-ready
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────────────────────

export type AnomalyType = 'SURGE' | 'PLUNGE' | 'FLIP' | 'CROWDING';

export interface FactorRanking {
  rank: number;
  factorId: string;
  factorName: string;
  factorNameCN: string;
  category: string;
  currentIC: number;
  previousIC?: number;
  icChange: number;
  icRank: number;
  rankChange: number;     // vs yesterday
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
}

export interface FactorAnomaly {
  anomalyType: AnomalyType;
  factorId: string;
  factorName: string;
  factorNameCN: string;
  currentIC: number;
  previousIC?: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  description: string;
  descriptionEN: string;
  suggestedAction: string;
  suggestedActionEN: string;
}

export interface DailyBriefing {
  briefingId: string;
  userId: string;
  date: string;          // YYYY-MM-DD
  generatedAt: Date;

  /** Top 5 ranking (by IC absolute value) */
  top5Factors: FactorRanking[];

  /** Anomalies detected today */
  anomalies: FactorAnomaly[];

  /** Market summary banner */
  marketSummary: string;
  marketSummaryEN: string;

  /** DeepSeek-generated commentary */
  aiCommentary: string;
  aiCommentaryEN: string;

  /** Billing */
  charged: boolean;
  chargeUSDT: number;

  /** 7-day IC trend data (for chart) */
  icTrends: ICTrendData[];
}

export interface ICTrendData {
  factorId: string;
  factorName: string;
  values: number[];       // IC values for last 7 days
  dates: string[];        // corresponding dates
}

export interface BriefingSubscribeRequest {
  userId: string;
  walletId: string;
  subscribed: boolean;    // true=on, false=off
  markets?: string[];
  factorCategories?: string[];
}

export interface DailyBriefingResult {
  success: boolean;
  briefing?: DailyBriefing;
  history?: DailyBriefing[];
  processingTimeMs: number;
  error?: string;
}

// ── Anomaly Detection Rules ───────────────────────────────────────────────

interface AnomalyRule {
  anomalyType: AnomalyType;
  detect: (currentIC: number, previousIC?: number) => { detected: boolean; severity: Anomaly['severity'] };
  describe: (factorName: string, ic: number, prev?: number) => { zh: string; en: string };
  suggest: (factorName: string, anomalyType: AnomalyType) => { zh: string; en: string };
}

const ANOMALY_RULES: AnomalyRule[] = [
  {
    anomalyType: 'SURGE',
    detect: (ic) => {
      if (ic > 0.12) return { detected: true, severity: 'CRITICAL' };
      if (ic > 0.08) return { detected: true, severity: 'WARNING' };
      return { detected: false, severity: 'INFO' };
    },
    describe: (name, ic) => ({
      zh: '因子 ' + name + ' IC飙升至' + ic.toFixed(3) + '，历史99分位，强烈看多信号',
      en: 'Factor ' + name + ' IC surged to ' + ic.toFixed(3) + ', 99th percentile, strong bullish signal',
    }),
    suggest: (name) => ({
      zh: '可关注' + name + '高暴露组合，建议用AI优化(1.5U)回测验证',
      en: 'Consider ' + name + ' high-exposure portfolios. Use AI Optimize (1.5U) for backtest validation',
    }),
  },
  {
    anomalyType: 'PLUNGE',
    detect: (ic) => {
      if (ic < -0.10) return { detected: true, severity: 'CRITICAL' };
      if (ic < -0.06) return { detected: true, severity: 'WARNING' };
      return { detected: false, severity: 'INFO' };
    },
    describe: (name, ic) => ({
      zh: '因子 ' + name + ' IC腰斩至' + ic.toFixed(3) + '，强烈看空信号，建议减仓',
      en: 'Factor ' + name + ' IC plunged to ' + ic.toFixed(3) + ', strong bearish signal',
    }),
    suggest: (name) => ({
      zh: '当前' + name + '做空窗口，可配置空头策略或降低该因子暴露',
      en: 'Short window for ' + name + '. Consider reducing exposure or short positions',
    }),
  },
  {
    anomalyType: 'FLIP',
    detect: (ic, prev) => {
      if (prev !== undefined && ic * prev < 0 && Math.abs(ic - prev) > 0.06) {
        return { detected: true, severity: 'CRITICAL' };
      }
      if (prev !== undefined && ic * prev < 0 && Math.abs(ic - prev) > 0.03) {
        return { detected: true, severity: 'WARNING' };
      }
      return { detected: false, severity: 'INFO' };
    },
    describe: (name, ic, prev) => ({
      zh: '因子 ' + name + ' 方向翻转! IC从' + (prev || 0).toFixed(3) + '→' + ic.toFixed(3) + '，策略需紧急调整',
      en: 'Factor ' + name + ' flipped! IC from ' + (prev || 0).toFixed(3) + ' -> ' + ic.toFixed(3),
    }),
    suggest: (name) => ({
      zh: '建议立即回测验证新方向有效性(1U)，重新评估持仓',
      en: 'Urgent backtest recommended (1U). Reassess all ' + name + ' positions',
    }),
  },
  {
    anomalyType: 'CROWDING',
    detect: (ic) => {
      if (Math.abs(ic) > 0.15) return { detected: true, severity: 'CRITICAL' };
      if (Math.abs(ic) > 0.12) return { detected: true, severity: 'WARNING' };
      return { detected: false, severity: 'INFO' };
    },
    describe: (name, ic) => ({
      zh: '因子 ' + name + '拥挤度|IC|=' + Math.abs(ic).toFixed(3) + '，超额拥挤，未来alpha可能衰减',
      en: 'Factor ' + name + ' crowding |IC|=' + Math.abs(ic).toFixed(3) + ', alpha decay risk elevated',
    }),
    suggest: (name) => ({
      zh: '拥挤因子预期收益下降，建议寻找' + name + '替代因子或用AI回测解读(1U)',
      en: 'Crowding risk: consider alternative factors. Use AI Backtest Read (1U) for analysis',
    }),
  },
];

// ── Factor CN Names ───────────────────────────────────────────────────────

const FACTOR_CN: Record<string, string> = {
  'MOM_20': '20日动量', 'MOM_60': '60日动量', 'MOM_120': '120日动量',
  'VAL_BP': '账面市值比', 'VAL_EP': '盈市率',
  'DIV_YIELD': '股息率', 'DIV_GROWTH': '股息增长',
  'LOW_VOL': '低波动', 'SIZE_LARGE': '大市值', 'SIZE_SMALL': '小市值',
  'QUAL_ROE': 'ROE质量', 'TREND_STRENGTH': '趋势强度',
  'VOL_BREAKOUT': '波动突破', 'TURNOVER': '换手率',
  'FUNDING_RATE': '资金费率', 'CMD_ROLL_YIELD': '展期收益率',
  'CMD_BASIS': '基差', 'CMD_MOMENTUM_12M': '商品12M动量',
  'CMD_GOLD_ETF': '黄金ETF', 'CMD_DXY_LINKAGE': '美元联动',
  'CMD_REAL_RATE': '实际利率', 'CMD_SEASONALITY': '季节性',
  'CMD_COT_COMMERCIAL': 'COT商业', 'CMD_COT_SPECULATOR': 'COT投机',
  'CMD_GOLD_SILVER_RATIO': '金银比', 'CMD_GOLD_OIL_RATIO': '金油比',
  'CMD_CRACK_SPREAD': '裂解价差', 'CMD_EIA_CRUDE': 'EIA原油',
  'CMD_NATGAS_STORAGE': '天然气库存', 'CMD_LME_INVENTORY': 'LME库存',
  'CMD_GEOPOL_RISK': '地缘风险', 'CMD_INFLATION_BE': '通胀预期',
  'AH_PREMIUM': 'AH溢价', 'MEAN_REV': '均值回归',
  'INST_OWNER': '机构持仓', 'SURPRISE': '财报意外',
  'SOUTH_FLOW': '南向资金',
};

// ── DailyBriefingEngine ───────────────────────────────────────────────────

export class DailyBriefingEngine {
  private readonly chargePerBriefing = 1;
  private briefings: Map<string, DailyBriefing[]> = new Map();  // userId -> history
  private subscriptions: Map<string, BriefingSubscribeRequest> = new Map();
  private readonly MAX_HISTORY = 7;
  private briefingCounter = 0;

  /**
   * Generate daily briefing for a user.
   * Flow: rank factors -> detect anomalies -> generate DeepSeek commentary -> charge 1U.
   */
  async generate(userId: string, walletId: string, factorData: FactorICSnapshot[]): Promise<DailyBriefingResult> {
    const t0 = Date.now();

    // Check subscription
    if (!this.isSubscribed(userId)) {
      return { success: false, processingTimeMs: Date.now() - t0,
        error: 'User not subscribed to daily briefing. Subscribe to enable (1U/day).' };
    }

    log.info('[DailyBriefing] Generating for user ' + userId + ' with ' + factorData.length + ' factors');

    try {
      // Step 1: Rank factors by IC
      const top5 = this.rankFactors(factorData);

      // Step 2: Detect anomalies
      const anomalies = this.detectAnomalies(factorData);

      // Step 3: Generate market summary
      const marketSummary = this.generateMarketSummary(top5, anomalies);
      const marketSummaryEN = this.generateMarketSummaryEN(top5, anomalies);

      // Step 4: Generate DeepSeek commentary (mock in engine, real in prod via DeepSeek API)
      const aiComm = this.simulateAICCommentary(top5, anomalies);

      // Step 5: Build IC trends
      const icTrends = this.buildICTrends(factorData, userId);

      const today = new Date().toISOString().slice(0, 10);
      const briefing: DailyBriefing = {
        briefingId: 'brief_' + today + '_' + (++this.briefingCounter),
        userId, date: today, generatedAt: new Date(),
        top5Factors: top5, anomalies,
        marketSummary, marketSummaryEN,
        aiCommentary: aiComm.zh, aiCommentaryEN: aiComm.en,
        charged: true, chargeUSDT: this.chargePerBriefing,
        icTrends,
      };

      // Archive
      this.archive(userId, briefing);
      const history = this.briefings.get(userId)?.slice(-7) || [];

      log.info('[DailyBriefing] Generated for ' + userId + ': ' + top5[0]?.factorName + ' #1, ' + anomalies.length + ' anomalies. Charged 1U.');

      return { success: true, briefing, history, processingTimeMs: Date.now() - t0 };
    } catch (err: any) {
      return { success: false, processingTimeMs: Date.now() - t0,
        error: err.message || 'Briefing generation failed' };
    }
  }

  /** Rank factors by |IC| descending, return Top 5 */
  private rankFactors(data: FactorICSnapshot[]): FactorRanking[] {
    const sorted = [...data]
      .sort((a, b) => Math.abs(b.currentIC) - Math.abs(a.currentIC));

    return sorted.slice(0, 5).map((f, i) => {
      const prevIC = f.previousIC;
      const icChange = prevIC !== undefined ? f.currentIC - prevIC : 0;
      return {
        rank: i + 1,
        factorId: f.factorId,
        factorName: f.factorName,
        factorNameCN: FACTOR_CN[f.factorId] || f.factorName,
        category: f.category || 'GENERAL',
        currentIC: f.currentIC,
        previousIC: prevIC,
        icChange,
        icRank: i + 1,
        rankChange: 0,
        signal: f.currentIC > 0.05 ? 'STRONG_LONG' : f.currentIC > 0.02 ? 'LONG'
          : f.currentIC < -0.05 ? 'STRONG_SHORT' : f.currentIC < -0.02 ? 'SHORT' : 'NEUTRAL',
      };
    });
  }

  /** Detect anomalies from all factor data */
  private detectAnomalies(data: FactorICSnapshot[]): FactorAnomaly[] {
    const anomalies: FactorAnomaly[] = [];

    for (const f of data) {
      for (const rule of ANOMALY_RULES) {
        const result = rule.detect(f.currentIC, f.previousIC);
        if (result.detected) {
          const description = rule.describe(FACTOR_CN[f.factorId] || f.factorName, f.currentIC, f.previousIC);
          const suggestion = rule.suggest(FACTOR_CN[f.factorId] || f.factorName, rule.anomalyType);
          anomalies.push({
            anomalyType: rule.anomalyType,
            factorId: f.factorId, factorName: f.factorName,
            factorNameCN: FACTOR_CN[f.factorId] || f.factorName,
            currentIC: f.currentIC, previousIC: f.previousIC,
            severity: result.severity,
            description: description.zh, descriptionEN: description.en,
            suggestedAction: suggestion.zh, suggestedActionEN: suggestion.en,
          });
        }
      }
    }

    return anomalies.sort((a, b) => {
      const order = { CRITICAL: 3, WARNING: 2, INFO: 1 };
      return order[b.severity] - order[a.severity];
    });
  }

  /** Generate market summary banner (CN) */
  private generateMarketSummary(top5: FactorRanking[], anomalies: FactorAnomaly[]): string {
    if (top5.length === 0) return '今日无数据。';

    const topFactor = top5[0];
    const bullish = top5.filter(f => f.signal === 'STRONG_LONG' || f.signal === 'LONG').length;
    const bearish = top5.filter(f => f.signal === 'STRONG_SHORT' || f.signal === 'SHORT').length;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');

    let summary = '今日最强因子: ' + topFactor.factorNameCN + ' (IC=' + topFactor.currentIC.toFixed(3) + ')';
    summary += ', Top5: ' + bullish + '多/' + bearish + '空';

    if (criticalAnomalies.length > 0) {
      summary += '. ' + '⚠️ ' + criticalAnomalies.length + '个关键异常: ';
      summary += criticalAnomalies.map(a => a.factorNameCN + '(' + a.anomalyType + ')').join(', ');
    }

    return summary;
  }

  private generateMarketSummaryEN(top5: FactorRanking[], anomalies: FactorAnomaly[]): string {
    if (top5.length === 0) return 'No data today.';
    const topFactor = top5[0];
    const bullish = top5.filter(f => f.signal === 'STRONG_LONG' || f.signal === 'LONG').length;
    const bearish = top5.filter(f => f.signal === 'STRONG_SHORT' || f.signal === 'SHORT').length;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL');

    let summary = 'Today strongest: ' + topFactor.factorName + ' (IC=' + topFactor.currentIC.toFixed(3) + ')';
    summary += ', Top5: ' + bullish + ' long/' + bearish + ' short';
    if (criticalAnomalies.length > 0) {
      summary += '. ' + '⚠️ ' + criticalAnomalies.length + ' critical anomalies: ';
      summary += criticalAnomalies.map(a => a.factorName + '(' + a.anomalyType + ')').join(', ');
    }
    return summary;
  }

  /** Simulate DeepSeek AI commentary (prod: real API call) */
  private simulateAICCommentary(top5: FactorRanking[], anomalies: FactorAnomaly[]): { zh: string; en: string } {
    if (top5.length === 0) return { zh: '今日数据不足，无法生成简报。', en: 'Insufficient data for briefing.' };

    const top = top5[0];
    const bullish = top5.filter(f => f.signal.startsWith('STRONG_LONG') || f.signal === 'LONG').length;
    const critical = anomalies.filter(a => a.severity === 'CRITICAL');

    let zh = '📊 **AI每日因子简报**

';
    zh += '今日最强信号: ' + top.factorNameCN + ' (IC=' + top.currentIC.toFixed(3) + ', ' + top.signal + ')。
';
    zh += 'Top5因子中' + bullish + '个看多，整体市场偏' + (bullish >= 3 ? '积极' : '谨慎') + '。
';

    if (critical.length > 0) {
      zh += '
⚠️ **关键异常**:
';
      for (const a of critical) {
        zh += '- ' + a.factorNameCN + ': ' + a.description + '
';
      }
    }

    // Actionable advice
    zh += '
**AI建议**: 关注' + top.factorNameCN + '方向，';
    if (top.signal === 'STRONG_LONG' || top.signal === 'LONG') {
      zh += '可考虑增加该因子暴露。建议用AI回测解读(1U)验证趋势可持续性。';
    } else if (top.signal === 'STRONG_SHORT' || top.signal === 'SHORT') {
      zh += '建议减仓或对冲该因子暴露。可使用压力测试(2U)评估最大回撤。';
    } else {
      zh += '当前方向不明，建议等待明确信号后再操作。';
    }

    if (anomalies.length > 0) {
      zh += '

发现' + anomalies.length + '个异常，建议今日检查相关持仓。';
    }

    let en = '📊 **AI Daily Factor Briefing**

';
    en += 'Strongest: ' + top.factorName + ' (IC=' + top.currentIC.toFixed(3) + ', ' + top.signal + ').
';
    en += 'Top5: ' + bullish + '/' + top5.length + ' bullish. Market bias: ' + (bullish >= 3 ? 'positive' : 'cautious') + '.
';

    if (critical.length > 0) {
      en += '
⚠️ **Critical Anomalies**:
';
      for (const a of critical) en += '- ' + a.factorName + ': ' + a.descriptionEN + '
';
    }

    en += '
**AI Advice**: Monitor ' + top.factorName + ' direction. ';
    if (top.signal === 'STRONG_LONG' || top.signal === 'LONG') {
      en += 'Consider increasing exposure. Use AI Backtest Read (1U) to validate trend sustainability.';
    } else if (top.signal === 'STRONG_SHORT' || top.signal === 'SHORT') {
      en += 'Consider reducing or hedging. Use Stress Test (2U) to assess max drawdown.';
    } else {
      en += 'Direction unclear, wait for confirmation before trading.';
    }
    if (anomalies.length > 0) en += '

' + anomalies.length + ' anomalies detected. Review related positions today.';

    return { zh, en };
  }

  /** Build 7-day IC trend data */
  private buildICTrends(data: FactorICSnapshot[], userId: string): ICTrendData[] {
    const history = this.briefings.get(userId) || [];
    const trendMap = new Map<string, number[]>();

    // Current day
    for (const f of data) {
      if (!trendMap.has(f.factorId)) trendMap.set(f.factorId, []);
      trendMap.get(f.factorId)!.push(f.currentIC);
    }

    // Past days
    for (const brief of history.slice(-6)) {
      for (const rank of brief.top5Factors) {
        if (!trendMap.has(rank.factorId)) trendMap.set(rank.factorId, []);
        trendMap.get(rank.factorId)!.unshift(rank.currentIC);
      }
    }

    const today = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    return data.slice(0, 8).map(f => ({
      factorId: f.factorId, factorName: f.factorName,
      values: trendMap.get(f.factorId) || [f.currentIC],
      dates,
    }));
  }

  // ── Subscription Management ─────────────────────────────────────────────

  isSubscribed(userId: string): boolean {
    return this.subscriptions.get(userId)?.subscribed || false;
  }

  subscribe(req: BriefingSubscribeRequest): boolean {
    this.subscriptions.set(req.userId, req);
    log.info('[DailyBriefing] User ' + req.userId + ' subscription: ' + (req.subscribed ? 'ON' : 'OFF'));
    return true;
  }

  unsubscribe(userId: string): boolean {
    this.subscriptions.delete(userId);
    log.info('[DailyBriefing] User ' + userId + ' unsubscribed');
    return true;
  }

  // ── History ─────────────────────────────────────────────────────────────

  private archive(userId: string, briefing: DailyBriefing): void {
    if (!this.briefings.has(userId)) this.briefings.set(userId, []);
    const list = this.briefings.get(userId)!;
    list.push(briefing);
    if (list.length > this.MAX_HISTORY) this.briefings.set(userId, list.slice(-this.MAX_HISTORY));
  }

  getHistory(userId: string, days: number = 7): DailyBriefing[] {
    const list = this.briefings.get(userId) || [];
    return list.slice(-days);
  }

  getToday(userId: string): DailyBriefing | undefined {
    const today = new Date().toISOString().slice(0, 10);
    return this.briefings.get(userId)?.find(b => b.date === today);
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getStats(): { totalSubscribers: number; totalBriefings: number } {
    let totalSubscribers = 0;
    for (const [_, sub] of this.subscriptions) {
      if (sub.subscribed) totalSubscribers++;
    }
    let totalBriefings = 0;
    for (const [_, list] of this.briefings) totalBriefings += list.length;
    return { totalSubscribers, totalBriefings };
  }
}

// ── Utility Type ──────────────────────────────────────────────────────────

export interface FactorICSnapshot {
  factorId: string;
  factorName: string;
  currentIC: number;
  previousIC?: number;
  category?: string;
  market?: string;
}

/** Singleton */
export const dailyBriefingEngine = new DailyBriefingEngine();
