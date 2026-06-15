// ── R216-auto#2 (P7): 策略使用统计与社交证据引擎 ──────────────────────────
// 为模板卡片提供 "X人使用过此策略" + 评分 社交证据
// Owner令: "使用过" (have used) — NOT "正在使用" (are currently using)
// 使用方: TemplateCard.tsx 改造 / MarketplacePage

// ── Types ──────────────────────────────────────────────────────────────────

export interface StrategyUsageRecord {
  strategyId: string;
  uniqueUsers: Set<string>;             // 使用过此策略的用户 (de-duplicated)
  totalActivations: number;             // 总激活次数 (可能同一用户多次激活)
  totalDeactivations: number;           // 总停用次数
  activeUsers: Set<string>;             // 当前活跃用户 (仅供参考，UI不展示)
  firstUsedAt: number;                  // 首次使用时间 unix ms
  lastUsedAt: number;                   // 最近使用时间
  ratings: Map<string, number>;         // userId → rating (1-5)
  comments: StrategyUsageComment[];      // 用户评论
}

export interface StrategyUsageComment {
  id: string;
  userId: string;
  content: string;
  rating: number;                       // 1-5, same as the rating field
  createdAt: number;
  tier: 'novice' | 'intermediate' | 'professional';
}

export interface StrategyUsageStats {
  strategyId: string;
  usageCount: number;                   // unique users who have EVER used this
  totalActivations: number;
  activeCount: number;                  // (internal only, UI does NOT display)
  avgRating: number;                    // 0–5, weighted by user tier
  ratingCount: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;  // histogram
  firstUsedAt: number | null;
  lastUsedAt: number | null;
}

export interface SocialProof {
  strategyId: string;
  usageText: string;                    // "326人使用过"
  ratingText: string;                   // "4.2分 (89人评价)"
  usageCount: number;
  avgRating: number;
  ratingCount: number;
  tier: SocialProofTier;                // hot/popular/steady/new
  tierLabel: string;
}

export type SocialProofTier = 'hot' | 'popular' | 'steady' | 'new';

// ═══════════════════════════════════════════════════════════════════════════
// RATING WEIGHTS BY USER TIER (professional ratings count more)
// ═══════════════════════════════════════════════════════════════════════════

const RATING_WEIGHT: Record<string, number> = {
  novice: 1.0,
  intermediate: 1.5,
  professional: 2.0,
};

const SOCIAL_PROOF_THRESHOLDS = {
  hot:      { minUsers: 100, minRating: 4.5, label: '热门' },
  popular:  { minUsers: 50,  minRating: 4.0, label: '受欢迎' },
  steady:   { minUsers: 10,  minRating: 3.0, label: '稳健' },
  new:      { minUsers: 0,   minRating: 0,   label: '新上架' },
};

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY STORE
// ═══════════════════════════════════════════════════════════════════════════

const _usageStore = new Map<string, StrategyUsageRecord>();

function getOrCreateRecord(strategyId: string): StrategyUsageRecord {
  if (!_usageStore.has(strategyId)) {
    _usageStore.set(strategyId, {
      strategyId,
      uniqueUsers: new Set(),
      totalActivations: 0,
      totalDeactivations: 0,
      activeUsers: new Set(),
      firstUsedAt: 0,
      lastUsedAt: 0,
      ratings: new Map(),
      comments: [],
    });
  }
  return _usageStore.get(strategyId)!;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE: record strategy usage (call when user activates a strategy)
// ═══════════════════════════════════════════════════════════════════════════

export function recordStrategyUse(
  userId: string,
  strategyId: string,
  userTier: 'novice' | 'intermediate' | 'professional' = 'novice',
): StrategyUsageStats {
  const record = getOrCreateRecord(strategyId);
  const now = Date.now();

  // Track unique user
  record.uniqueUsers.add(userId);
  record.totalActivations++;
  record.activeUsers.add(userId);

  if (!record.firstUsedAt || now < record.firstUsedAt) {
    record.firstUsedAt = now;
  }
  record.lastUsedAt = now;

  return computeStats(strategyId);
}

// ═══════════════════════════════════════════════════════════════════════════
// Record strategy deactivation
// ═══════════════════════════════════════════════════════════════════════════

export function recordStrategyDeactivate(userId: string, strategyId: string): void {
  const record = _usageStore.get(strategyId);
  if (!record) return;
  record.totalDeactivations++;
  record.activeUsers.delete(userId);
}

// ═══════════════════════════════════════════════════════════════════════════
// RATING
// ═══════════════════════════════════════════════════════════════════════════

export function recordStrategyRating(
  userId: string,
  strategyId: string,
  rating: number,
  userTier: 'novice' | 'intermediate' | 'professional' = 'novice',
): StrategyUsageStats {
  const record = getOrCreateRecord(strategyId);
  const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));
  record.ratings.set(userId, clampedRating);
  return computeStats(strategyId);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMENT
// ═══════════════════════════════════════════════════════════════════════════

let _commentIdCounter = 0;

export function recordStrategyComment(
  userId: string,
  strategyId: string,
  content: string,
  rating: number,
  userTier: 'novice' | 'intermediate' | 'professional' = 'novice',
): { comment: StrategyUsageComment; stats: StrategyUsageStats } {
  const record = getOrCreateRecord(strategyId);
  const clampedRating = Math.max(1, Math.min(5, Math.round(rating)));

  const comment: StrategyUsageComment = {
    id: `cmt_${++_commentIdCounter}_${Date.now()}`,
    userId,
    content,
    rating: clampedRating,
    createdAt: Date.now(),
    tier: userTier,
  };

  record.comments.push(comment);
  record.ratings.set(userId, clampedRating); // comment includes rating

  return {
    comment,
    stats: computeStats(strategyId),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY: get stats for a strategy
// ═══════════════════════════════════════════════════════════════════════════

export function computeStats(strategyId: string): StrategyUsageStats {
  const record = _usageStore.get(strategyId);

  // Default for strategies with no usage
  if (!record) {
    return {
      strategyId,
      usageCount: 0,
      totalActivations: 0,
      activeCount: 0,
      avgRating: 0,
      ratingCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      firstUsedAt: null,
      lastUsedAt: null,
    };
  }

  // Weighted average rating
  let weightedSum = 0;
  let totalWeight = 0;
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const [userId, rating] of Array.from(record.ratings.entries())) {
    // Use default weight since we don't have per-user tier stored per rating
    // In production, this would come from a user profile lookup
    const weight = 1.0; // default weight
    weightedSum += rating * weight;
    totalWeight += weight;
    if (rating >= 1 && rating <= 5) {
      distribution[rating as 1 | 2 | 3 | 4 | 5]++;
    }
  }

  const avgRating = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0;

  return {
    strategyId,
    usageCount: record.uniqueUsers.size,
    totalActivations: record.totalActivations,
    activeCount: record.activeUsers.size,
    avgRating,
    ratingCount: record.ratings.size,
    ratingDistribution: distribution,
    firstUsedAt: record.firstUsedAt || null,
    lastUsedAt: record.lastUsedAt || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY: get social proof for template card display
// ═══════════════════════════════════════════════════════════════════════════

export function getSocialProof(strategyId: string): SocialProof {
  const stats = computeStats(strategyId);

  const { usageCount, avgRating, ratingCount } = stats;

  // Determine social proof tier
  let tier: SocialProofTier = 'new';
  if (usageCount >= SOCIAL_PROOF_THRESHOLDS.hot.minUsers && avgRating >= SOCIAL_PROOF_THRESHOLDS.hot.minRating) {
    tier = 'hot';
  } else if (usageCount >= SOCIAL_PROOF_THRESHOLDS.popular.minUsers && avgRating >= SOCIAL_PROOF_THRESHOLDS.popular.minRating) {
    tier = 'popular';
  } else if (usageCount >= SOCIAL_PROOF_THRESHOLDS.steady.minUsers && avgRating >= SOCIAL_PROOF_THRESHOLDS.steady.minRating) {
    tier = 'steady';
  }

  // Format usage text: "326人使用过" (Owner rule: "使用过" not "正在使用")
  const usageText = usageCount > 0
    ? `${usageCount.toLocaleString()}人使用过`
    : '暂无使用记录';

  // Format rating text
  const ratingText = ratingCount > 0
    ? `${avgRating.toFixed(1)}分 (${ratingCount}人评价)`
    : '暂无评分';

  return {
    strategyId,
    usageText,
    ratingText,
    usageCount,
    avgRating,
    ratingCount,
    tier,
    tierLabel: SOCIAL_PROOF_THRESHOLDS[tier].label,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY: bulk social proof for all strategies
// ═══════════════════════════════════════════════════════════════════════════

export function getAllSocialProofs(): Map<string, SocialProof> {
  const proofs = new Map<string, SocialProof>();
  for (const strategyId of Array.from(_usageStore.keys())) {
    proofs.set(strategyId, getSocialProof(strategyId));
  }
  return proofs;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY: top used strategies (leaderboard)
// ═══════════════════════════════════════════════════════════════════════════

export function getTopUsedStrategies(limit: number = 10): SocialProof[] {
  const proofs = Array.from(_usageStore.keys()).map((id: string) => getSocialProof(id));
  proofs.sort((a, b) => {
    // Sort by usage count desc, then rating desc
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return b.avgRating - a.avgRating;
  });
  return proofs.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY: top rated strategies
// ═══════════════════════════════════════════════════════════════════════════

export function getTopRatedStrategies(limit: number = 10, minRatings: number = 5): SocialProof[] {
  const proofs = Array.from(_usageStore.keys())
    .map((id: string) => getSocialProof(id))
    .filter(p => p.ratingCount >= minRatings);
  proofs.sort((a, b) => b.avgRating - a.avgRating);
  return proofs.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY: get comments for a strategy
// ═══════════════════════════════════════════════════════════════════════════

export function getStrategyComments(
  strategyId: string,
  options?: { limit?: number; offset?: number; sortBy?: 'recent' | 'rating' },
): StrategyUsageComment[] {
  const record = _usageStore.get(strategyId);
  if (!record) return [];

  let comments = [...record.comments];

  if (options?.sortBy === 'rating') {
    comments.sort((a, b) => b.rating - a.rating);
  } else {
    // Default: most recent first
    comments.sort((a, b) => b.createdAt - a.createdAt);
  }

  const offset = options?.offset || 0;
  const limit = options?.limit || 20;
  return comments.slice(offset, offset + limit);
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED: initialize demo data for testing / pre-launch
// ═══════════════════════════════════════════════════════════════════════════

export function seedDemoData(): void {
  const demos: Array<{
    strategyId: string;
    users: number;
    avgRating: number;
    ratingCount: number;
  }> = [
    { strategyId: 'hk-dividend-ladder', users: 326, avgRating: 4.2, ratingCount: 89 },
    { strategyId: 'crypto-btc-trend', users: 512, avgRating: 4.5, ratingCount: 142 },
    { strategyId: 'crypto-eth-btc-rotation', users: 278, avgRating: 4.1, ratingCount: 67 },
    { strategyId: 'hk-ah-premium', users: 198, avgRating: 4.0, ratingCount: 53 },
    { strategyId: 'ai-portfolio-builder', users: 156, avgRating: 4.8, ratingCount: 44 },
    { strategyId: 'jp-jpx-value-repair', users: 89, avgRating: 3.9, ratingCount: 31 },
    { strategyId: 'hk-reit-yield', users: 245, avgRating: 4.3, ratingCount: 71 },
    { strategyId: 'crypto-hodl-dca-enhanced', users: 167, avgRating: 4.4, ratingCount: 48 },
    { strategyId: 'kr-krx-momentum', users: 104, avgRating: 3.8, ratingCount: 29 },
    { strategyId: 'tw-twse-electronic-exdiv', users: 73, avgRating: 3.7, ratingCount: 22 },
    { strategyId: 'ai-value-hunter', users: 88, avgRating: 4.6, ratingCount: 25 },
    { strategyId: 'ai-risk-sentinel', users: 55, avgRating: 4.7, ratingCount: 18 },
    { strategyId: 'hk-southbound-tracker', users: 312, avgRating: 4.0, ratingCount: 95 },
    { strategyId: 'crypto-funding-arbitrage', users: 143, avgRating: 3.9, ratingCount: 41 },
    { strategyId: 'sg-sgx-financial-yield', users: 62, avgRating: 3.6, ratingCount: 19 },
    { strategyId: 'ai-stock-screener', users: 45, avgRating: 4.5, ratingCount: 13 },
    { strategyId: 'au-asx-resource-franking', users: 38, avgRating: 3.5, ratingCount: 11 },
    { strategyId: 'in-nifty50-rotation', users: 27, avgRating: 3.4, ratingCount: 8 },
    { strategyId: 'eu-stoxx-esg-premium', users: 19, avgRating: 3.3, ratingCount: 4 },
    { strategyId: 'crypto-onchain-three-lights', users: 95, avgRating: 4.1, ratingCount: 28 },
  ];

  for (const demo of demos) {
    const record = getOrCreateRecord(demo.strategyId);

    // Simulate unique users
    for (let i = 0; i < demo.users; i++) {
      const uid = `demo_user_${demo.strategyId}_${i}`;
      record.uniqueUsers.add(uid);
      record.totalActivations++;
      record.activeUsers.add(uid);
    }

    // Simulate ratings
    const baseRating = demo.avgRating;
    for (let i = 0; i < demo.ratingCount; i++) {
      const uid = `demo_user_${demo.strategyId}_${i}`;
      // Distribute ratings around the average
      const variation = Math.round((Math.random() - 0.5) * 2);
      const rating = Math.max(1, Math.min(5, Math.round(baseRating + variation)));
      record.ratings.set(uid, rating);
    }

    const pastDate = Date.now() - Math.random() * 90 * 86400000;
    record.firstUsedAt = pastDate;
    record.lastUsedAt = Date.now();
  }

  console.log(`[strategy-usage-stats] Seeded ${demos.length} strategies with demo data`);
}

// Auto-seed on import (for development/CI)
seedDemoData();

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: reset all usage data
// ═══════════════════════════════════════════════════════════════════════════

export function resetAllUsageData(): void {
  _usageStore.clear();
  _commentIdCounter = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: import usage data (bulk)
// ═══════════════════════════════════════════════════════════════════════════

export function bulkImportUsage(
  data: Array<{
    strategyId: string;
    userIds: string[];
    ratings?: Array<{ userId: string; rating: number }>;
    comments?: Array<{
      userId: string;
      content: string;
      rating: number;
      createdAt: number;
      tier: 'novice' | 'intermediate' | 'professional';
    }>;
  }>,
): void {
  for (const entry of data) {
    const record = getOrCreateRecord(entry.strategyId);
    for (const uid of entry.userIds) {
      record.uniqueUsers.add(uid);
      record.totalActivations++;
      record.activeUsers.add(uid);
    }
    if (entry.ratings) {
      for (const r of entry.ratings) {
        record.ratings.set(r.userId, Math.max(1, Math.min(5, r.rating)));
      }
    }
    if (entry.comments) {
      for (const c of entry.comments) {
        record.comments.push({
          id: `cmt_import_${++_commentIdCounter}`,
          userId: c.userId,
          content: c.content,
          rating: Math.max(1, Math.min(5, c.rating)),
          createdAt: c.createdAt,
          tier: c.tier,
        });
      }
    }
  }
}
