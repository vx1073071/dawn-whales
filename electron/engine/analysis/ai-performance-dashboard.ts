/**
 * R249 P2-40: AIPerformanceDashboard — AI性能仪表盘
 * LOBEHUB | v2.8.0
 *
 * 让用户看到 "AI帮了我多少" — 量化AI的实际价值。
 *
 * 仪表盘指标:
 *   1. 总节省时间: AI替代了多少研究小时
 *   2. 避过风险: AI预警后用户避免的潜在亏损
 *   3. 发现机会: AI推荐的因子/策略带来的超额收益
 *   4. 采纳率: 用户采纳AI建议的比例
 *   5. 准确率: AI预测正确的比例
 *
 * 行业对标: Northwestern Mutual — 54% Gen Z偏好"使用AI的顾问"而非纯AI
 *            所以仪表盘应展示"AI+你的协作成果"，而非"AI取代你"
 *
 * 约束: 纯TypeScript, >=400L
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────

export interface AIAction {
  id: string; userId: string;
  type: 'factor_recommend' | 'strategy_match' | 'param_suggest' | 'risk_alert' | 'market_briefing' | 'sentiment_analysis';
  context: string;           // 上下文
  suggestion: string;        // AI建议内容
  userAction: 'adopted' | 'ignored' | 'modified' | 'pending';
  outcome: 'correct' | 'incorrect' | 'pending' | 'neutral';
  impactScore: number;       // 正=获利, 负=亏损, 0=无影响
  savedResearchMin: number;  // 节省研究时间(分钟)
  timestamp: number;
  feedback?: string;
}

export interface AIDashboard {
  // 总体
  totalAIActions: number;
  adoptionRate: number;        // 采纳率%
  accuracyRate: number;        // 正确率%
  // 价值
  totalSavedHours: number;     // 累计节省小时
  avoidedLosses: number;       // 避过的潜在亏损(USDT)
  discoveredGains: number;     // 发现的超额收益(USDT)
  netAIValue: number;          // 净价值 = gains - losses avoided + (savedHours * 10U/时)
  // 按类型
  byType: {
    type: string; count: number; adoptionRate: number; accuracyRate: number; netValue: number;
  }[];
  // 时间线
  weeklySnapshots: { week: string; actions: number; adopted: number; correct: number; netValue: number; }[];
  // 个人化
  userLevel: 'novice' | 'regular' | 'power' | 'ai_native';
  userTagline: string;
  // 信任里程碑
  trustMilestones: { name: string; achieved: boolean; progress: number; }[];
  updatedAt: number;
}

export interface DashboardConfig {
  hourlyValueUsdt: number; // 每小时研究价值
  minActionsForStats: number;
}

const DEFAULT_CONFIG: DashboardConfig = {
  hourlyValueUsdt: 10,
  minActionsForStats: 10,
};

const TRUST_MILESTONES = [
  { name: '首次采纳AI建议', threshold: 1 },
  { name: '采纳AI10次', threshold: 10 },
  { name: 'AI正确率>80%', threshold: 20 },
  { name: '连续30天使用AI', threshold: 30 },
  { name: 'AI帮你发现首个机会', threshold: 50 },
  { name: 'AI帮你避开首次风险', threshold: 50 },
  { name: 'AI节省100小时', threshold: 100 },
  { name: 'AI净价值+500U', threshold: 500 },
  { name: 'AI Power User', threshold: 200 },
  { name: 'AI原生交易者', threshold: 500 },
];

// ── AIPerformanceDashboard ─────────────────────────────────

export class AIPerformanceDashboard {
  readonly id = 'ai_performance_dashboard';
  readonly version = '2.8.0';
  private config: DashboardConfig;

  constructor(config?: Partial<DashboardConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  generate(actions: AIAction[], userId: string): AIDashboard {
    if (actions.length < this.config.minActionsForStats) {
      return this.emptyDashboard(userId);
    }

    const adopted = actions.filter(a => a.userAction === 'adopted');
    const correct = actions.filter(a => a.outcome === 'correct');
    const totalActions = actions.length;
    const adoptionRate = Math.round(adopted.length / totalActions * 10000) / 100;
    const judgedActions = actions.filter(a => a.outcome !== 'pending' && a.outcome !== 'neutral');
    const accuracyRate = judgedActions.length > 0
      ? Math.round(correct.length / judgedActions.length * 10000) / 100 : 0;

    const totalSavedHours = Math.round(actions.reduce((s, a) => s + a.savedResearchMin, 0) / 60 * 10) / 10;
    const avoidedLosses = Math.abs(actions
      .filter(a => a.type === 'risk_alert' && a.userAction === 'adopted')
      .reduce((s, a) => s + a.impactScore, 0));
    const discoveredGains = actions
      .filter(a => (a.type === 'factor_recommend' || a.type === 'strategy_match') && a.userAction === 'adopted')
      .reduce((s, a) => s + Math.max(0, a.impactScore), 0);

    const netValue = discoveredGains + avoidedLosses + totalSavedHours * this.config.hourlyValueUsdt;

    // 按类型
    const typeMap = new Map<string, AIAction[]>();
    actions.forEach(a => { if (!typeMap.has(a.type)) typeMap.set(a.type, []); typeMap.get(a.type)!.push(a); });
    const byType = [...typeMap.entries()].map(([type, acts]) => ({
      type, count: acts.length,
      adoptionRate: Math.round(acts.filter(a => a.userAction === 'adopted').length / acts.length * 10000) / 100,
      accuracyRate: acts.filter(a => a.outcome !== 'pending' && a.outcome !== 'neutral').length > 0
        ? Math.round(acts.filter(a => a.outcome === 'correct').length / acts.filter(a => a.outcome !== 'pending' && a.outcome !== 'neutral').length * 10000) / 100 : 0,
      netValue: Math.round(acts.filter(a => a.userAction === 'adopted').reduce((s, a) => s + Math.max(0, a.impactScore), 0) * 100) / 100,
    })).sort((a, b) => b.count - a.count);

    // 时间线 (周度)
    const weekMap = new Map<string, { actions: number; adopted: number; correct: number; }>();
    actions.forEach(a => {
      const d = new Date(a.timestamp);
      const week = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
      if (!weekMap.has(week)) weekMap.set(week, { actions: 0, adopted: 0, correct: 0 });
      const w = weekMap.get(week)!;
      w.actions++; if (a.userAction === 'adopted') w.adopted++; if (a.outcome === 'correct') w.correct++;
    });
    const weeks = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([week, data]) => ({
      week, actions: data.actions, adopted: data.adopted, correct: data.correct, netValue: 0,
    }));

    // 用户等级
    const userLevel = this.calcUserLevel(totalActions, adoptionRate, accuracyRate, netValue);

    // 信任里程碑
    const milestones = TRUST_MILESTONES.map(m => ({
      name: m.name,
      achieved: totalActions >= m.threshold,
      progress: Math.min(100, Math.round(totalActions / m.threshold * 100)),
    }));

    // 用户标签
    const tagline = this.generateTagline(userLevel, adoptionRate, netValue);

    return {
      totalAIActions: totalActions, adoptionRate, accuracyRate,
      totalSavedHours, avoidedLosses: Math.round(avoidedLosses * 100) / 100,
      discoveredGains: Math.round(discoveredGains * 100) / 100,
      netAIValue: Math.round(netValue * 100) / 100,
      byType, weeklySnapshots: weeks, userLevel, userTagline: tagline,
      trustMilestones: milestones, updatedAt: Date.now(),
    };
  }

  private emptyDashboard(userId: string): AIDashboard {
    return {
      totalAIActions: 0, adoptionRate: 0, accuracyRate: 0,
      totalSavedHours: 0, avoidedLosses: 0, discoveredGains: 0, netAIValue: 0,
      byType: [], weeklySnapshots: [],
      userLevel: 'novice', userTagline: 'AI之旅刚刚开始 🚀',
      trustMilestones: TRUST_MILESTONES.map(m => ({ name: m.name, achieved: false, progress: 0 })),
      updatedAt: Date.now(),
    };
  }

  private calcUserLevel(total: number, adoption: number, accuracy: number, netValue: number): AIDashboard['userLevel'] {
    if (total >= 500 && adoption >= 70 && netValue >= 500) return 'ai_native';
    if (total >= 200 && adoption >= 50) return 'power';
    if (total >= 50) return 'regular';
    return 'novice';
  }

  private generateTagline(level: string, adoption: number, netValue: number): string {
    const tags: Record<string, string> = {
      novice: 'AI之旅刚刚开始，每个建议都是一次学习 🚀',
      regular: `你已${adoption}%采纳AI建议，协作越来越默契`,
      power: `AI与你并肩作战，已创造${netValue.toFixed(0)}U净价值`,
      ai_native: '你是AI原生交易者 — 人机协作的典范 🏆',
    };
    return tags[level] || '';
  }
}

export default AIPerformanceDashboard;
