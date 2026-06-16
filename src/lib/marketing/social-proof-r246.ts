// ══ R246 QClaw P1-19: 社交证明嵌入文案 ══
// Copy templates for social proof elements throughout the app
// Design goal: "很多人已经在用了，你也可以" — build trust through social signals

export type ProofType = 'user_count' | 'leaderboard' | 'live_usage' | 'purchase' | 'creator' | 'performance' | 'trust_badge' | 'testimonial';

export interface SocialProofTemplate {
  type: ProofType;
  placement: string;
  trigger: string;
  templates: string[];
  animationHint: string;
}

export const SOCIAL_PROOF_TEMPLATES: SocialProofTemplate[] = [
  // ── 1. 使用人数徽章 ──
  {
    type: 'user_count',
    placement: '策略卡片右上角',
    trigger: '策略使用人数>10时展示',
    templates: [
      '🏷️ {count}人在用',
      '🔥 {count}人正在用这个策略',
      '👥 {count}位交易者已选择',
      '📊 {count}人已验证',
    ],
    animationHint: '数字跳动2秒到目标值',
  },

  // ── 2. 排行榜 ──
  {
    type: 'leaderboard',
    placement: '首页/策略市场顶部',
    trigger: '页面加载时',
    templates: [
      '🔥 本周最强策略',
      '🏆 {period} 收益率 Top 5',
      '📈 这个月大家都在买这些',
      '⭐ 最近7天销售额最高',
    ],
    animationHint: '前三名有奖牌动画(金/银/铜)',
  },

  // ── 3. 实时使用动态 ──
  {
    type: 'live_usage',
    placement: '策略详情页下方',
    trigger: '有人购买/跟单/回测时实时推送',
    templates: [
      '🟢 {name} {time}前购买了「{strategy}」',
      '🟢 {name} {time}前跑了一次回测',
      '🟢 {name} {time}前增加了跟单金额',
      '🟢 刚刚有人从{source}进来看了这个策略',
    ],
    animationHint: '淡入+2秒停留+自动消失',
  },

  // ── 4. 已购证明 ──
  {
    type: 'purchase',
    placement: '策略市场卡片/详情页',
    trigger: '策略销量>0时',
    templates: [
      '✅ 已售 {count} 份',
      '🛒 {count}人买过，评分 {rating}',
      '💰 最畅销：{market}市场排名 #{rank}',
      '📊 {conversion}%的浏览者最终购买了',
    ],
    animationHint: '静态展示，数字不动',
  },

  // ── 5. 创作者信誉 ──
  {
    type: 'creator',
    placement: '策略详情页顶部',
    trigger: '创作者信息展示区',
    templates: [
      '🎖️ {creator_name} · L{level}创作者 · 累计销售 {total}份',
      '⭐ 好评率 {rating}% · 连续{days}天在线',
      '🏅 {certifications}认证 · {years}年交易经验',
      '📝 {count}个策略 · {followers}人关注',
    ],
    animationHint: '等级徽章有光晕效果',
  },

  // ── 6. 表现证明 ──
  {
    type: 'performance',
    placement: '策略回测页面',
    trigger: '回测结果展示时',
    templates: [
      '📈 过去{period}跑赢大盘 {excess}%',
      '💰 如果你{time}前投入¥{amount}，现在是 ¥{result}',
      '🛡️ 胜率 {win_rate}% · 盈亏比 {profit_ratio}',
      '🎯 同期{benchmark}收益仅 {benchmark_return}%',
    ],
    animationHint: '资金曲线动画绘制',
  },

  // ── 7. 信任徽章 ──
  {
    type: 'trust_badge',
    placement: '购买按钮旁边',
    trigger: '用户准备购买时',
    templates: [
      '🔒 数据安全加密',
      '✅ 策略通过TradingEasy审核',
      '🛡️ {count}人购买后无差评',
      '💡 支持购买前免费回测1次',
      '📝 购买后30天内可退款(限1次)',
    ],
    animationHint: '静态徽章，绿色主题',
  },

  // ── 8. 用户评价摘录 ──
  {
    type: 'testimonial',
    placement: '策略详情页底部轮播',
    trigger: '有用户评价时',
    templates: [
      '"{quote}" — {user}，{time}前',
      '⭐ {stars} "{quote_short}" — {user}',
      '"{quote}" 这条评价有 {likes}人觉得有用',
    ],
    animationHint: '3秒轮播',
  },
];

// ═══════════════════════════════════════════
// 组合模板：策略市场完整社交证明包
// ═══════════════════════════════════════════

export interface StrategySocialPackage {
  strategyId: string;
  strategyName: string;
  userCount: number;
  rating: number;
  rank: number;
  creatorName: string;
  creatorLevel: number;
  creatorTotalSales: number;
  periodReturn: string;
  winRate: number;
}

export function generateSocialProofBar(pkg: StrategySocialPackage): string {
  if (pkg.userCount < 5) return '';
  const parts: string[] = [];
  if (pkg.userCount >= 5) parts.push(`🏷️ ${pkg.userCount}人在用`);
  if (pkg.rating >= 4) parts.push(`⭐ ${pkg.rating}`);
  if (pkg.rank <= 10) parts.push(`🏆 #${pkg.rank}`);
  if (parts.length === 0) return '';
  return parts.join(' · ');
}

export function generatePurchaseProof(pkg: StrategySocialPackage): string {
  return `✅ 已售${pkg.userCount}份 · ⭐${pkg.rating} · 🎖️ ${pkg.creatorName} L${pkg.creatorLevel}创作者`;
}

export function generateLeaderboardEntry(pkg: StrategySocialPackage, position: number): string {
  const medals = ['🥇', '🥈', '🥉'];
  const medal = position <= 3 ? medals[position - 1] : `${position}.`;
  return `${medal} ${pkg.strategyName} — ${pkg.periodReturn} · ${pkg.userCount}人在用`;
}

export function generateLiveToast(userName: string, action: string, strategyName: string): string {
  const actions: Record<string, string> = {
    buy: '购买了',
    backtest: '回测了',
    follow: '开始跟单',
    review: '评价了',
  };
  const verb = actions[action] || '查看了';
  return `🟢 ${userName} ${verb}「${strategyName}」`;
}

export default SOCIAL_PROOF_TEMPLATES;
