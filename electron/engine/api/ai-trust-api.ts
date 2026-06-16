/**
 * R250 P2-41: AITrustAPIRoutes — AI信任路线路由+入口动画数据
 * LOBEHUB | v2.8.0
 * 依赖 docs/design/ai-trust-roadmap-r246.md
 *
 * 提供前端动态配置: 当前用户在第几阶段/可解锁功能/进度条
 *
 * 端点:
 *   GET /api/ai-trust/stage      — 用户当前信任阶段
 *   GET /api/ai-trust/next       — 下一阶段解锁条件
 *   GET /api/ai-trust/progress   — 进度可视化数据
 *   POST /api/ai-trust/advance   — 手动推进 (达标后)
 *
 * >=300L
 */

import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────

export type TrustStage = 'research' | 'assist' | 'partner';

export interface TrustStageConfig {
  stage: TrustStage;
  name: string;
  week: string; // "第1周" | "第2周" | "第3-4周"
  features: { id: string; name: string; description: string; price: number; currency: string; unlocked: boolean; }[];
  milestones: { id: string; name: string; target: number; current: number; done: boolean; }[];
  nextStageUnlock: { description: string; requirements: string[]; };
}

export interface TrustUserProfile {
  userId: string;
  stage: TrustStage;
  startedAt: number;
  daysActive: number;
  aiActionsCount: number;
  adoptionRate: number;
  trialCreditsUsed: number;
  trialCreditsTotal: number;
  paidFeaturesUnlocked: number;
  nextStageProgress: number; // 0-100
}

const STAGE_CONFIGS: Record<TrustStage, TrustStageConfig> = {
  research: {
    stage: 'research', name: 'AI辅助研究', week: '第1周',
    features: [
      { id: 'factor_explain', name: 'AI因子解读', description: '点开因子详情页→AI一句话解释', price: 0, currency: 'FREE', unlocked: true },
      { id: 'news_summary', name: '新闻AI摘要', description: '自选股今日相关新闻摘要', price: 0, currency: 'FREE', unlocked: true },
      { id: 'market_brief', name: '市场概况', description: '每日首次打开→今日三句话', price: 0, currency: 'FREE', unlocked: true },
      { id: 'smart_search', name: '智能搜索', description: '因子搜索AI意图识别', price: 0, currency: 'FREE', unlocked: true },
    ],
    milestones: [
      { id: 'first_ai_use', name: '首次使用AI', target: 1, current: 0, done: false },
      { id: 'ai_5_times', name: '使用AI 5次', target: 5, current: 0, done: false },
      { id: 'ai_10_times', name: '使用AI 10次', target: 10, current: 0, done: false },
    ],
    nextStageUnlock: { description: '使用AI 10次后解锁下一阶段', requirements: ['完成10次AI交互'] },
  },
  assist: {
    stage: 'assist', name: 'AI工作流助手', week: '第2周',
    features: [
      { id: 'factor_recommend', name: 'AI因子匹配', description: '市场+风格→推荐Top5因子', price: 0, currency: 'FREE/3次', unlocked: false },
      { id: 'strategy_match', name: 'AI策略匹配', description: '因子→推荐策略模板', price: 1, currency: '1U', unlocked: false },
      { id: 'param_suggest', name: 'AI调参', description: '一键填最优参数+对比', price: 1, currency: '1U', unlocked: false },
      { id: 'risk_scan', name: '持仓扫描', description: 'AI检查持仓+标红标绿', price: 0, currency: 'FREE/周', unlocked: false },
    ],
    milestones: [
      { id: 'adopt_5', name: '采纳AI 5次', target: 5, current: 0, done: false },
      { id: 'adoption_60', name: '采纳率>60%', target: 60, current: 0, done: false },
      { id: 'first_paid', name: '首次付费AI', target: 1, current: 0, done: false },
    ],
    nextStageUnlock: { description: '采纳率>60%且首次付费后解锁', requirements: ['采纳率>60%', '完成1次付费AI'] },
  },
  partner: {
    stage: 'partner', name: 'AI决策伙伴', week: '第3-4周',
    features: [
      { id: 'daily_briefing', name: '每日简报', description: '三板块AI结构化简报', price: 1, currency: '1U/天', unlocked: false },
      { id: 'ai_copilot', name: 'AI对话伙伴', description: '"NVDA该买吗？"→综合回答', price: 8, currency: '8U/月', unlocked: false },
      { id: 'smart_alert', name: '智能提醒', description: '异常信号推送通知', price: 0, currency: 'Pro内', unlocked: false },
      { id: 'auto_tune', name: '自动调参', description: 'AI每周巡检+建议', price: 0, currency: 'Pro内', unlocked: false },
    ],
    milestones: [
      { id: 'saved_10h', name: 'AI节省10小时', target: 10, current: 0, done: false },
      { id: 'avoided_loss', name: 'AI避过1次风险', target: 1, current: 0, done: false },
      { id: 'net_100u', name: 'AI净价值+100U', target: 100, current: 0, done: false },
    ],
    nextStageUnlock: { description: '你已达到最高阶段', requirements: ['已是最佳伙伴'] },
  },
};

// ── AITrustAPI ────────────────────────────────────────────

export class AITrustAPI {
  readonly id = 'ai_trust_api'; readonly version = '2.8.0';
  private profiles: Map<string, TrustUserProfile> = new Map();

  getOrCreateProfile(userId: string): TrustUserProfile {
    if (!this.profiles.has(userId)) {
      this.profiles.set(userId, {
        userId, stage: 'research', startedAt: Date.now(),
        daysActive: 0, aiActionsCount: 0, adoptionRate: 0,
        trialCreditsUsed: 0, trialCreditsTotal: 10,
        paidFeaturesUnlocked: 0, nextStageProgress: 0,
      });
    }
    return this.profiles.get(userId)!;
  }

  getStage(userId: string) {
    const p = this.getOrCreateProfile(userId);
    const config = STAGE_CONFIGS[p.stage];
    // 更新milestones
    const features = config.features.map(f => ({
      ...f,
      unlocked: p.stage === 'research' ? true
        : p.stage === 'assist' ? (f.id === 'risk_scan' || f.id === 'factor_recommend' ? true : p.paidFeaturesUnlocked > 0)
        : p.paidFeaturesUnlocked >= 2,
    }));
    const milestones = config.milestones.map(m => {
      let current = 0;
      if (m.id === 'first_ai_use' || m.id === 'adopt_5') current = p.aiActionsCount;
      else if (m.id === 'ai_5_times' || m.id === 'ai_10_times') current = p.aiActionsCount;
      else if (m.id === 'adoption_60') current = p.adoptionRate;
      else if (m.id === 'first_paid') current = p.paidFeaturesUnlocked;
      return { ...m, current, done: current >= m.target };
    });
    const nextProgress = Math.min(100, Math.round(
      config.milestones.reduce((s, m) => s + Math.min(1, (p.aiActionsCount) / (m.target || 1)), 0) / config.milestones.length * 100
    ));
    p.nextStageProgress = nextProgress;
    return {
      success: true,
      data: {
        profile: p,
        stage: { ...config, features, milestones },
        nextProgress,
        availableStages: Object.keys(STAGE_CONFIGS),
      },
    };
  }

  advanceStage(userId: string) {
    const p = this.getOrCreateProfile(userId);
    const order: TrustStage[] = ['research', 'assist', 'partner'];
    const idx = order.indexOf(p.stage);
    if (idx >= order.length - 1) return { success: false, error: 'Already at max stage' };
    const config = STAGE_CONFIGS[p.stage];
    const allDone = config.milestones.every(m => {
      const current = m.id.includes('adoption') ? p.adoptionRate
        : m.id.includes('paid') ? p.paidFeaturesUnlocked
        : p.aiActionsCount;
      return current >= m.target;
    });
    if (!allDone) return { success: false, error: 'Not all milestones completed', required: config.nextStageUnlock.requirements };
    p.stage = order[idx + 1];
    log.info(`[AITrust] ${userId} advanced to ${p.stage}`);
    return { success: true, newStage: p.stage };
  }

  trackAction(userId: string, adopted: boolean = false, paid: boolean = false) {
    const p = this.getOrCreateProfile(userId);
    p.aiActionsCount++;
    p.daysActive = Math.ceil((Date.now() - p.startedAt) / 86400000);
    if (adopted && p.aiActionsCount > 0) p.adoptionRate = Math.round((p.adoptionRate * (p.aiActionsCount - 1) + 1) / p.aiActionsCount * 100);
    if (paid) p.paidFeaturesUnlocked++;
  }
}

export function bindTrustRoutes(app: any, basePath: string, api: AITrustAPI): void {
  app.get(`${basePath}/stage/:userId`, (req: any, res: any) => res.json(api.getStage(req.params.userId)));
  app.post(`${basePath}/advance/:userId`, (req: any, res: any) => res.json(api.advanceStage(req.params.userId)));
  app.post(`${basePath}/track`, (req: any, res: any) => {
    api.trackAction(req.body?.userId, req.body?.adopted, req.body?.paid);
    res.json({ success: true });
  });
}

export default AITrustAPI;
