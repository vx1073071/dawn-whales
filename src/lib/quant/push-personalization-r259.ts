// ══ R259 LOBEHUB P1: 推送个性化算法引擎 ══
// Push Personalization Engine — "给每个人推不一样的，因为每个人的持仓不一样"
//
// 个性化维度:
//   1. 持仓关联 > 自选关联 > 市场异动 > 社区热门
//   2. 用户画像(追涨/价值/量化) → 推送风格匹配
//   3. 活跃时段学习 → 不在用户睡觉时推送
//   4. 点击历史 → 喜欢看涨还是看跌？
//   5. 沉默期保护 → 7天不活跃→特别召回

export type UserPersona = 'MOMENTUM' | 'VALUE' | 'QUANT' | 'NEWBIE' | 'WHALE';
export type ContentType = 'PRICE_SURGE' | 'PRICE_PLUMMET' | 'VOLUME_SPIKE' | 'EARNINGS' | 'MACRO' | 'SECTOR' | 'STRATEGY' | 'COMMUNITY';

export interface PushCandidate {
  id: string;
  type: ContentType;
  symbol?: string;
  title: string;
  body: string;
  hasChart: boolean;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  revenuePotential: number;     // 预估点击收入
  targetPersonas: UserPersona[];
  cooldownMinutes: number;
}

export interface UserPushProfile {
  userId: string;
  persona: UserPersona;
  holdings: string[];           // 持仓股票
  watchlist: string[];          // 自选
  activeHours: number[];        // 活跃时段(0-23小时)
  clickHistory: {
    clickedTypes: Record<ContentType, number>;  // 各类型点击次数
    clickedDirections: { up: number; down: number };  // 喜欢看涨还是看跌
    avgCtr: number;
  };
  lastPushAt: number;
  pushFatigue: number;          // 0-1, 越高=越疲劳
  silenceDays: number;          // 连续沉默天数
}

export interface PersonalizedPush {
  userId: string;
  candidates: PushCandidate[];
  selected: PushCandidate | null;
  score: number;                // 0-100 匹配度
  reason: string;               // "持仓BTC异动" / "自选TSLA财报" / "沉默召回" 
  scheduledHour: number;        // 最佳推送时间
}

// ═══════════════════ 画像学习 ═══════════════════

export function learnUserPersona(profile: UserPushProfile): UserPersona {
  // 从持仓风格推断
  if (profile.holdings.length >= 10) return 'WHALE';
  if (profile.clickHistory.clickedDirections.up > profile.clickHistory.clickedDirections.down * 3) return 'MOMENTUM';
  if (profile.clickHistory.avgCtr > 0.08) return 'QUANT';
  if (profile.holdings.length <= 3 && profile.watchlist.length <= 5) return 'NEWBIE';
  return 'VALUE';
}

export function learnActiveHours(pushHistory: Array<{ clicked: boolean; hour: number }>): number[] {
  const hourCounts = new Map<number, { total: number; clicks: number }>();
  for (const h of pushHistory) {
    const entry = hourCounts.get(h.hour) || { total: 0, clicks: 0 };
    entry.total++;
    if (h.clicked) entry.clicks++;
    hourCounts.set(h.hour, entry);
  }
  return Array.from(hourCounts.entries())
    .filter(([_, v]) => v.clicks / Math.max(1, v.total) > 0.04)
    .map(([h]) => h)
    .sort((a, b) => a - b);
}

// ═══════════════════ 推送评分引擎 ═══════════════════

export function scorePushCandidate(
  candidate: PushCandidate,
  profile: UserPushProfile,
  now: Date,
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // 1. 持仓关联 (最高权重)
  if (candidate.symbol && profile.holdings.includes(candidate.symbol)) {
    score += 35;
    reasons.push(`持仓${candidate.symbol}异动`);
  } else if (candidate.symbol && profile.watchlist.includes(candidate.symbol)) {
    score += 25;
    reasons.push(`自选${candidate.symbol}异动`);
  } else if (candidate.type === 'PRICE_SURGE' || candidate.type === 'PRICE_PLUMMET') {
    score += 10;
    reasons.push('市场异动');
  }

  // 2. 用户画像匹配
  const personaMatch: Record<UserPersona, ContentType[]> = {
    MOMENTUM: ['PRICE_SURGE', 'PRICE_PLUMMET', 'VOLUME_SPIKE'],
    VALUE: ['EARNINGS', 'MACRO', 'SECTOR'],
    QUANT: ['STRATEGY', 'SECTOR'],
    NEWBIE: ['PRICE_SURGE', 'EARNINGS', 'COMMUNITY'],
    WHALE: ['MACRO', 'STRATEGY'],
  };
  if (personaMatch[profile.persona]?.includes(candidate.type)) {
    score += 15;
  }

  // 3. 方向偏好
  if (candidate.type === 'PRICE_SURGE' && profile.clickHistory.clickedDirections.up > profile.clickHistory.clickedDirections.down) {
    score += 8;
  }
  if (candidate.type === 'PRICE_PLUMMET' && profile.clickHistory.clickedDirections.down > profile.clickHistory.clickedDirections.up) {
    score += 8;
  }

  // 4. 历史点击偏好
  if ((profile.clickHistory.clickedTypes[candidate.type] || 0) > 0) {
    score += 5;
  }

  // 5. 紧迫性
  if (candidate.urgency === 'CRITICAL') score += 10;
  else if (candidate.urgency === 'HIGH') score += 5;

  // 6. 沉默召回
  if (profile.silenceDays >= 7) score += 20;

  // 7. 疲劳惩罚
  score *= (1 - profile.pushFatigue * 0.3);

  // 8. 夜间不应推送
  const hour = now.getHours();
  const isActiveHour = profile.activeHours.includes(hour);
  if (!isActiveHour && (hour < 7 || hour > 22)) score *= 0.5;

  return { score: Math.round(score), reason: reasons.join('+') };
}

// ═══════════════════ 个性化推送引擎 ═══════════════════

export function personalizePush(
  userId: string,
  candidates: PushCandidate[],
  profile: UserPushProfile,
  now: Date = new Date(),
): PersonalizedPush {
  const scored = candidates
    .map(c => ({ candidate: c, ...scorePushCandidate(c, profile, now) }))
    .filter(s => {
      // 冷却检查
      const cooldown = s.candidate.cooldownMinutes * 60 * 1000;
      return (now.getTime() - profile.lastPushAt) > cooldown;
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored.length > 0 ? scored[0].candidate : null;
  const bestHour = profile.activeHours.length > 0
    ? profile.activeHours[0]
    : now.getHours();

  return {
    userId,
    candidates,
    selected,
    score: scored[0]?.score || 0,
    reason: scored[0]?.reason || '无匹配',
    scheduledHour: bestHour,
  };
}

// ═══════════════════ A/B分流 ═══════════════════

export interface PushABTest {
  variant: 'A' | 'B';
  variantADesc: string;  // "通用推送"
  variantBDesc: string;  // "个性化推送"
  active: boolean;
}

export function pushABDecide(userId: string, test: PushABTest): 'A' | 'B' {
  if (!test.active) return 'B'; // 默认个性化
  const hash = simpleHash(userId + 'push-ab');
  return (hash % 100) < 50 ? 'A' : 'B';
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
  return Math.abs(hash);
}

export default PersonalizedPush;
