// ── R216-auto#1 (P4): 用户能力分层引擎 (User Tier Engine) ────────────────
// 自动评估用户能力等级，驱动渐进式信息披露
// 依赖: 无外部依赖，纯评分引擎
// 使用方: ML#3 渐进式模板浏览 / 策略推荐 / AI互动深度

// ── Types ──────────────────────────────────────────────────────────────────

export type UserTier = 'novice' | 'intermediate' | 'professional';

export interface UserBehaviorProfile {
  userId: string;
  // 核心行为数据
  totalTrades: number;
  accountCreatedAt: number;       // unix ms
  activatedStrategies: string[];  // strategy IDs
  aiFeatureUsage: number;         // total AI touchpoint calls
  backtestRuns: number;
  totalVolumeUSDT: number;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: number;
  firstTradeAt?: number;
  lastActiveAt?: number;

  // 学习行为
  strategyDetailsViewed: string[];
  strategyCompareUsed: boolean;
  riskDisclosureSigned: boolean;
  // 社交互动
  commentsPosted: number;
  ratingsGiven: number;
}

export interface UserTierResult {
  tier: UserTier;
  score: number;           // 0–1000
  nextTier: UserTier | null;
  nextTierName: string;
  scoreToNextTier: number; // points needed to reach next tier
  progressPercent: number; // 0–100 within current tier
  signals: UserBehaviorSignal[];
  recommendedTemplateCount: number;
  recommendedTemplateIds: string[];
  perks: string[];         // unlocked features at this tier
}

export interface UserBehaviorSignal {
  name: string;
  value: number | boolean | string;
  contribution: number;    // points contributed to score
  maxContribution: number; // max possible points from this signal
  label: string;           // human-readable Chinese label
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING SYSTEM (0–1000 points)
// ═══════════════════════════════════════════════════════════════════════════

const SCORING = {
  ONBOARDING_COMPLETED: 100,
  FIRST_TRADE: 50,
  PER_ADDITIONAL_TRADE: 5,         // max 250 (50 trades total)
  PER_ACTIVATED_STRATEGY: 30,     // max 300 (10 strategies)
  PER_AI_FEATURE: 20,             // max 200 (10 AI calls)
  PER_BACKTEST: 15,               // max 150 (10 backtests)
  ACCOUNT_AGE_7D: 25,
  ACCOUNT_AGE_30D: 50,
  ACCOUNT_AGE_90D: 100,
  RISK_DISCLOSURE_SIGNED: 40,
  STRATEGY_COMPARE_USED: 30,
  PER_COMMENT: 5,                 // max 50 (10 comments)
  PER_RATING: 5,                  // max 25 (5 ratings)
  VOLUME_100: 15,
  VOLUME_1000: 30,
  VOLUME_10000: 60,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TIER THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

const TIER_THRESHOLDS: Record<UserTier, { min: number; max: number; label: string; emoji: string }> = {
  novice:       { min: 0,   max: 249, label: '小白',   emoji: '🟢' },
  intermediate: { min: 250, max: 599, label: '进阶',   emoji: '🟡' },
  professional: { min: 600, max: 1000, label: '专业',  emoji: '🔴' },
};

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE VISIBILITY BY TIER
// ═══════════════════════════════════════════════════════════════════════════

// All 44 template IDs (must match factor-strategy-templates.ts)
const ALL_TEMPLATE_IDS = [
  // HK (10)
  'hk-ah-premium', 'hk-dividend-ladder', 'hk-southbound-tracker',
  'hk-redchip-homecoming', 'hk-warrant-direction', 'hk-reit-yield',
  'hk-ipo-flip', 'hk-short-squeeze',
  // Cross: hk-us/cn-hk
  'xm-ah-premium-plus', 'xm-southbound-plus',
  // Crypto (8)
  'crypto-btc-trend', 'crypto-eth-btc-rotation', 'crypto-funding-arbitrage',
  'crypto-liquidation-hunt', 'crypto-onchain-three-lights',
  'crypto-futures-spot-arb', 'crypto-hodl-dca-enhanced', 'crypto-whale-tracker',
  // JP (2)
  'jp-jpx-value-repair', 'jp-nisa-dca-enhanced',
  // KR (2)
  'kr-krx-momentum', 'kr-krx-export-cycle',
  // TW (1)
  'tw-twse-electronic-exdiv',
  // SG (2)
  'sg-sgx-financial-yield', 'sg-sgx-reit-enhanced',
  // AU (1)
  'au-asx-resource-franking',
  // IN (3)
  'in-nse-it-outsourcing', 'in-nifty50-rotation', 'in-nse-inflation-hedge',
  // EU (1)
  'eu-stoxx-esg-premium',
  // AI (14 total)
  'ai-value-hunter', 'ai-momentum-chaser', 'ai-arbitrage-engine',
  'ai-timing-oracle', 'ai-risk-sentinel', 'ai-portfolio-builder',
  'ai-stock-screener', 'ai-sector-rotator', 'ai-event-catalyst',
  'ai-rebalance-optimizer', 'ai-factor-rotation',
  'ai-timing-enhanced', 'ai-hedge-enhanced', 'ai-long-term-growth',
];

// Novice templates: low-risk, easy-to-understand, widely applicable
const NOVICE_TEMPLATES = [
  'hk-dividend-ladder',       // 收股息 — 最直观的策略
  'crypto-btc-trend',          // BTC趋势 — 单一品种
  'crypto-hodl-dca-enhanced',  // DCA定投 — 无需择时
  'ai-portfolio-builder',      // AI帮你配 — 零门槛
  'hk-reit-yield',             // REIT收租 — 稳定收益
];

// Intermediate adds moderate complexity + multi-market
const INTERMEDIATE_ADDITIONS = [
  'hk-ah-premium', 'hk-southbound-tracker', 'hk-redchip-homecoming',
  'hk-warrant-direction',
  'crypto-eth-btc-rotation', 'crypto-funding-arbitrage',
  'crypto-futures-spot-arb', 'crypto-onchain-three-lights',
  'jp-jpx-value-repair', 'jp-nisa-dca-enhanced',
  'kr-krx-momentum', 'kr-krx-export-cycle',
  'tw-twse-electronic-exdiv',
  'sg-sgx-financial-yield', 'sg-sgx-reit-enhanced',
  'au-asx-resource-franking',
  'in-nifty50-rotation',
  'eu-stoxx-esg-premium',
  'ai-value-hunter', 'ai-stock-screener', 'ai-momentum-chaser',
  'ai-risk-sentinel', 'ai-rebalance-optimizer',
];

// Professional templates: high-risk, complex, niche
const PROFESSIONAL_TEMPLATES = [
  'hk-short-squeeze', 'hk-ipo-flip',
  'xm-ah-premium-plus', 'xm-southbound-plus',
  'crypto-liquidation-hunt', 'crypto-whale-tracker',
  'in-nse-it-outsourcing', 'in-nse-inflation-hedge',
  'ai-arbitrage-engine', 'ai-timing-oracle', 'ai-sector-rotator',
  'ai-event-catalyst', 'ai-factor-rotation',
  'ai-timing-enhanced', 'ai-hedge-enhanced', 'ai-long-term-growth',
];

function getVisibleTemplateIds(tier: UserTier): string[] {
  switch (tier) {
    case 'novice':
      return NOVICE_TEMPLATES;
    case 'intermediate':
      return [...NOVICE_TEMPLATES, ...INTERMEDIATE_ADDITIONS];
    case 'professional':
      return ALL_TEMPLATE_IDS;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER PERKS
// ═══════════════════════════════════════════════════════════════════════════

const TIER_PERKS: Record<UserTier, string[]> = {
  novice: [
    '浏览入门策略 (5个)',
    '基础AI分析 (回测解读)',
    '模拟交易 (沙盒30天)',
    '新手引导 (3问推荐)',
  ],
  intermediate: [
    '浏览进阶策略 (25个)',
    '多市场策略 (JP/KR/TW/SG/AU/IN/EU)',
    '完整AI分析 (深度诊断+参数优化+替代数据)',
    '策略对比工具',
    '跟单交易 (L1跟随)',
    '信号推送 (市场异动通知)',
  ],
  professional: [
    '浏览全部策略 (44个)',
    '高级策略 (沽空挤压/IPO打新/套利)',
    '完整AI分析+策略健康检查',
    '盲盒因子组合 (3风格)',
    '创作者发布权限',
    '跟单交易 (L3全部级别)',
    '全量信号推送 (35个模板)',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE REQUIREMENTS (what the user needs to reach next tier)
// ═══════════════════════════════════════════════════════════════════════════

interface UpgradeRequirement {
  name: string;
  description: string;
  completed: boolean;
  points: number;
}

function getUpgradeRequirements(
  profile: UserBehaviorProfile,
  currentScore: number,
  targetTier: UserTier | null,
): UpgradeRequirement[] {
  if (!targetTier) return [];

  const tierMin = TIER_THRESHOLDS[targetTier].min;
  const gap = Math.max(0, tierMin - currentScore);

  const requirements: UpgradeRequirement[] = [];

  if (!profile.onboardingCompleted) {
    requirements.push({
      name: '完成新手引导',
      description: '回答3个问题，获得个性化策略推荐',
      completed: false,
      points: SCORING.ONBOARDING_COMPLETED,
    });
  }

  if (!profile.firstTradeAt) {
    requirements.push({
      name: '完成首次交易',
      description: '使用任一策略进行首次交易（沙盒模拟也算）',
      completed: false,
      points: SCORING.FIRST_TRADE,
    });
  }

  if (profile.activatedStrategies.length < 2) {
    requirements.push({
      name: '激活更多策略',
      description: `已激活 ${profile.activatedStrategies.length} 个策略，建议至少2个`,
      completed: false,
      points: SCORING.PER_ACTIVATED_STRATEGY,
    });
  }

  if (profile.totalTrades < 5) {
    requirements.push({
      name: '积累交易经验',
      description: `已完成 ${profile.totalTrades} 笔交易，建议达到5笔`,
      completed: false,
      points: SCORING.PER_ADDITIONAL_TRADE * (5 - profile.totalTrades),
    });
  }

  if (profile.aiFeatureUsage < 3) {
    requirements.push({
      name: '体验AI功能',
      description: `已使用 ${profile.aiFeatureUsage} 次AI分析，建议尝试3次`,
      completed: false,
      points: SCORING.PER_AI_FEATURE,
    });
  }

  if (!profile.riskDisclosureSigned) {
    requirements.push({
      name: '签署风险揭示书',
      description: '实盘前必须签署风险揭示书',
      completed: false,
      points: SCORING.RISK_DISCLOSURE_SIGNED,
    });
  }

  return requirements;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE: assess user tier
// ═══════════════════════════════════════════════════════════════════════════

export function assessTier(profile: UserBehaviorProfile): UserTierResult {
  const signals: UserBehaviorSignal[] = [];
  let score = 0;

  // ── Onboarding ──
  const obValue = profile.onboardingCompleted ? 1 : 0;
  const obContribution = obValue * SCORING.ONBOARDING_COMPLETED;
  score += obContribution;
  signals.push({
    name: 'onboardingCompleted',
    value: profile.onboardingCompleted,
    contribution: obContribution,
    maxContribution: SCORING.ONBOARDING_COMPLETED,
    label: '新手引导',
  });

  // ── Trade count ──
  const tradeContribution = profile.firstTradeAt
    ? SCORING.FIRST_TRADE + Math.min(profile.totalTrades - 1, 49) * SCORING.PER_ADDITIONAL_TRADE
    : 0;
  score += tradeContribution;
  signals.push({
    name: 'totalTrades',
    value: profile.totalTrades,
    contribution: Math.min(tradeContribution, SCORING.FIRST_TRADE + 49 * SCORING.PER_ADDITIONAL_TRADE),
    maxContribution: SCORING.FIRST_TRADE + 49 * SCORING.PER_ADDITIONAL_TRADE,
    label: '交易笔数',
  });

  // ── Activated strategies ──
  const stratContribution = Math.min(profile.activatedStrategies.length, 10) * SCORING.PER_ACTIVATED_STRATEGY;
  score += stratContribution;
  signals.push({
    name: 'activatedStrategies',
    value: profile.activatedStrategies.length,
    contribution: stratContribution,
    maxContribution: 10 * SCORING.PER_ACTIVATED_STRATEGY,
    label: '已激活策略',
  });

  // ── AI feature usage ──
  const aiContribution = Math.min(profile.aiFeatureUsage, 10) * SCORING.PER_AI_FEATURE;
  score += aiContribution;
  signals.push({
    name: 'aiFeatureUsage',
    value: profile.aiFeatureUsage,
    contribution: aiContribution,
    maxContribution: 10 * SCORING.PER_AI_FEATURE,
    label: 'AI功能使用',
  });

  // ── Backtest runs ──
  const btContribution = Math.min(profile.backtestRuns, 10) * SCORING.PER_BACKTEST;
  score += btContribution;
  signals.push({
    name: 'backtestRuns',
    value: profile.backtestRuns,
    contribution: btContribution,
    maxContribution: 10 * SCORING.PER_BACKTEST,
    label: '回测次数',
  });

  // ── Account age ──
  const now = Date.now();
  const accountAgeDays = Math.floor((now - profile.accountCreatedAt) / 86400000);
  let ageContribution = 0;
  if (accountAgeDays >= 90) ageContribution = SCORING.ACCOUNT_AGE_90D;
  else if (accountAgeDays >= 30) ageContribution = SCORING.ACCOUNT_AGE_30D;
  else if (accountAgeDays >= 7) ageContribution = SCORING.ACCOUNT_AGE_7D;
  score += ageContribution;
  signals.push({
    name: 'accountAge',
    value: accountAgeDays,
    contribution: ageContribution,
    maxContribution: SCORING.ACCOUNT_AGE_90D,
    label: '账户时长',
  });

  // ── Risk disclosure ──
  const rdContribution = profile.riskDisclosureSigned ? SCORING.RISK_DISCLOSURE_SIGNED : 0;
  score += rdContribution;
  signals.push({
    name: 'riskDisclosureSigned',
    value: profile.riskDisclosureSigned,
    contribution: rdContribution,
    maxContribution: SCORING.RISK_DISCLOSURE_SIGNED,
    label: '风险揭示书',
  });

  // ── Strategy compare ──
  const scContribution = profile.strategyCompareUsed ? SCORING.STRATEGY_COMPARE_USED : 0;
  score += scContribution;
  signals.push({
    name: 'strategyCompareUsed',
    value: profile.strategyCompareUsed,
    contribution: scContribution,
    maxContribution: SCORING.STRATEGY_COMPARE_USED,
    label: '策略对比',
  });

  // ── Comments ──
  const cmtContribution = Math.min(profile.commentsPosted, 10) * SCORING.PER_COMMENT;
  score += cmtContribution;
  signals.push({
    name: 'commentsPosted',
    value: profile.commentsPosted,
    contribution: cmtContribution,
    maxContribution: 10 * SCORING.PER_COMMENT,
    label: '评论互动',
  });

  // ── Ratings ──
  const ratContribution = Math.min(profile.ratingsGiven, 5) * SCORING.PER_RATING;
  score += ratContribution;
  signals.push({
    name: 'ratingsGiven',
    value: profile.ratingsGiven,
    contribution: ratContribution,
    maxContribution: 5 * SCORING.PER_RATING,
    label: '策略评分',
  });

  // ── Volume ──
  let volContribution = 0;
  if (profile.totalVolumeUSDT >= 10000) volContribution = SCORING.VOLUME_10000;
  else if (profile.totalVolumeUSDT >= 1000) volContribution = SCORING.VOLUME_1000;
  else if (profile.totalVolumeUSDT >= 100) volContribution = SCORING.VOLUME_100;
  score += volContribution;
  signals.push({
    name: 'totalVolume',
    value: profile.totalVolumeUSDT,
    contribution: volContribution,
    maxContribution: SCORING.VOLUME_10000,
    label: '交易量(USDT)',
  });

  // Clamp score
  score = Math.min(1000, Math.max(0, score));

  // ── Determine tier ──
  let tier: UserTier = 'novice';
  if (score >= TIER_THRESHOLDS.professional.min) tier = 'professional';
  else if (score >= TIER_THRESHOLDS.intermediate.min) tier = 'intermediate';

  // ── Next tier info ──
  const tierOrder: UserTier[] = ['novice', 'intermediate', 'professional'];
  const currentIdx = tierOrder.indexOf(tier);
  const nextTier = currentIdx < 2 ? tierOrder[currentIdx + 1] : null;
  const nextTierThreshold = nextTier ? TIER_THRESHOLDS[nextTier].min : 0;
  const scoreToNextTier = nextTier ? Math.max(0, nextTierThreshold - score) : 0;

  // progress within current tier band
  const currentBand = TIER_THRESHOLDS[tier];
  const bandWidth = currentBand.max - currentBand.min;
  const progressInBand = bandWidth > 0 ? ((score - currentBand.min) / bandWidth) * 100 : 0;

  const tierInfo = TIER_THRESHOLDS[tier];
  const nextTierInfo = nextTier ? TIER_THRESHOLDS[nextTier] : null;

  return {
    tier,
    score,
    nextTier,
    nextTierName: nextTierInfo ? `${nextTierInfo.emoji} ${nextTierInfo.label}` : '已达最高等级',
    scoreToNextTier,
    progressPercent: Math.round(Math.min(100, Math.max(0, progressInBand))),
    signals,
    recommendedTemplateCount: getVisibleTemplateIds(tier).length,
    recommendedTemplateIds: getVisibleTemplateIds(tier),
    perks: TIER_PERKS[tier],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: upgrade requirements list
// ═══════════════════════════════════════════════════════════════════════════

export function getTierProgress(profile: UserBehaviorProfile): {
  tier: UserTier;
  score: number;
  nextTier: UserTier | null;
  scoreToNextTier: number;
  progressPercent: number;
  requirements: UpgradeRequirement[];
  tierLabel: string;
  tierEmoji: string;
} {
  const result = assessTier(profile);
  const requirements = getUpgradeRequirements(
    profile,
    result.score,
    result.nextTier,
  );

  return {
    tier: result.tier,
    score: result.score,
    nextTier: result.nextTier,
    scoreToNextTier: result.scoreToNextTier,
    progressPercent: result.progressPercent,
    requirements,
    tierLabel: TIER_THRESHOLDS[result.tier].label,
    tierEmoji: TIER_THRESHOLDS[result.tier].emoji,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: get visible templates for a tier
// ═══════════════════════════════════════════════════════════════════════════

export function getTierVisibleTemplates(tier: UserTier): string[] {
  return getVisibleTemplateIds(tier);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: check if user can access specific template
// ═══════════════════════════════════════════════════════════════════════════

export function canAccessTemplate(
  profile: UserBehaviorProfile,
  templateId: string,
): { allowed: boolean; reason?: string } {
  const { tier } = assessTier(profile);
  const visible = getVisibleTemplateIds(tier);

  if (visible.includes(templateId)) return { allowed: true };

  const nextTierInfo = tier === 'novice' ? TIER_THRESHOLDS.intermediate : TIER_THRESHOLDS.professional;
  return {
    allowed: false,
    reason: `此策略需要 ${nextTierInfo.emoji} ${nextTierInfo.label} 等级才能访问。继续使用平台即可自动升级。`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HOOKS — call these when user performs key actions
// ═══════════════════════════════════════════════════════════════════════════

export interface TierChangeEvent {
  userId: string;
  previousTier: UserTier;
  newTier: UserTier;
  previousScore: number;
  newScore: number;
  signal: string;            // what triggered the change
  upgraded: boolean;
}

// Simple in-memory store (in production, persist to DB)
const _profileStore: Map<string, UserBehaviorProfile> = new Map();

export function createDefaultProfile(userId: string, createdAt?: number): UserBehaviorProfile {
  return {
    userId,
    totalTrades: 0,
    accountCreatedAt: createdAt || Date.now(),
    activatedStrategies: [],
    aiFeatureUsage: 0,
    backtestRuns: 0,
    totalVolumeUSDT: 0,
    onboardingCompleted: false,
    strategyDetailsViewed: [],
    strategyCompareUsed: false,
    riskDisclosureSigned: false,
    commentsPosted: 0,
    ratingsGiven: 0,
  };
}

export function getOrCreateProfile(userId: string): UserBehaviorProfile {
  if (!_profileStore.has(userId)) {
    _profileStore.set(userId, createDefaultProfile(userId));
  }
  return _profileStore.get(userId)!;
}

export function updateProfile(userId: string, updates: Partial<UserBehaviorProfile>): UserBehaviorProfile {
  const profile = getOrCreateProfile(userId);
  Object.assign(profile, updates);
  return profile;
}

export function recordOnboardingComplete(userId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.onboardingCompleted = true;
    p.onboardingCompletedAt = Date.now();
  }, 'onboardingCompleted');
}

export function recordTrade(userId: string, volumeUSDT: number): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.totalTrades++;
    p.totalVolumeUSDT += volumeUSDT;
    if (!p.firstTradeAt) p.firstTradeAt = Date.now();
  }, `trade_${volumeUSDT}USDT`);
}

export function recordStrategyActivated(userId: string, strategyId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    if (!p.activatedStrategies.includes(strategyId)) {
      p.activatedStrategies.push(strategyId);
    }
  }, `strategy_${strategyId}`);
}

export function recordAIUsed(userId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.aiFeatureUsage++;
  }, 'aiUsed');
}

export function recordBacktest(userId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.backtestRuns++;
  }, 'backtest');
}

export function recordRiskSigned(userId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.riskDisclosureSigned = true;
  }, 'riskDisclosureSigned');
}

export function recordCompareUsed(userId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.strategyCompareUsed = true;
  }, 'strategyCompareUsed');
}

export function recordComment(userId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.commentsPosted++;
  }, 'comment');
}

export function recordRating(userId: string): TierChangeEvent | null {
  return recordEvent(userId, (p) => {
    p.ratingsGiven++;
  }, 'rating');
}

// ── Internal: record event and check for tier change ──────────────────────

function recordEvent(
  userId: string,
  mutate: (p: UserBehaviorProfile) => void,
  signal: string,
): TierChangeEvent | null {
  const profile = getOrCreateProfile(userId);
  const before = assessTier(profile);
  const previousScore = before.score;
  const previousTier = before.tier;

  mutate(profile);

  const after = assessTier(profile);
  const upgraded = after.tier !== previousTier;

  if (upgraded) {
    return {
      userId,
      previousTier,
      newTier: after.tier,
      previousScore,
      newScore: after.score,
      signal,
      upgraded: true,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS: aggregate tier distribution
// ═══════════════════════════════════════════════════════════════════════════

export function getTierDistribution(): Record<UserTier, number> {
  const dist: Record<UserTier, number> = { novice: 0, intermediate: 0, professional: 0 };
  for (const profile of Array.from(_profileStore.values())) {
    const { tier } = assessTier(profile);
    dist[tier]++;
  }
  return dist;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getTierLabel(tier: UserTier): string {
  return TIER_THRESHOLDS[tier].label;
}

export function getTierEmoji(tier: UserTier): string {
  return TIER_THRESHOLDS[tier].emoji;
}

export function getAllTemplateIds(): string[] {
  return [...ALL_TEMPLATE_IDS];
}
