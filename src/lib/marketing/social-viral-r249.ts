// ══ R249 QClaw P2-10: 社交裂变文案 ══
// Sharing templates for viral growth — invite, share, brag
// Design: "让用户帮你卖" — every share feels like a friend recommendation, not an ad

export type ShareScenario =
  | 'invite_friend'      // 邀请朋友注册
  | 'share_strategy'     // 分享策略结果
  | 'share_factor'       // 分享因子信号
  | 'share_report'       // 分享AI月报
  | 'share_achievement'  // 分享交易成就
  | 'share_whale_tip';   // 分享鲸灵的一句话

export interface ShareTemplate {
  scenario: ShareScenario;
  /** 触发场景 */
  trigger: string;
  /** 分享渠道 */
  channels: string[];
  /** 分享文案模板 */
  templates: {
    /** 朋友间的私聊 */
    dm: string;
    /** 朋友圈/动态 */
    timeline: string;
    /** 投资群 */
    group: string;
    /** 附带链接时的短文案 */
    linkPreview: string;
  };
  /** 邀请奖励 */
  reward?: string;
}

export const SHARE_TEMPLATES: ShareTemplate[] = [
  {
    scenario: 'invite_friend',
    trigger: '用户完成第3笔交易后 / 首月月报生成后',
    channels: ['wechat', 'whatsapp', 'telegram', 'copy_link'],
    templates: {
      dm: '我用QUANT MOO做量化交易，感觉还挺靠谱的。你要不要试一下？用我这个链接注册，咱俩都多送一个月的免费AI。👋',
      timeline: '最近在用QUANT MOO做量化，体验比预期好。分享一个邀请码，用这个注册免费多一个月AI分析。不是广告，是真的在用。',
      group: '群里有做美港股的吗？我在用一个叫QUANT MOO的工具，可以自动分析策略信号。用我的邀请链接注册能多送一个月免费AI。想问下大家有用过的吗？',
      linkPreview: '用我的邀请码注册QUANT MOO，你我各得一个月免费AI分析 🎁',
    },
    reward: '你和朋友各得一个月免费AI（价值2U）',
  },

  {
    scenario: 'share_strategy',
    trigger: '策略本月收益>10%时弹出',
    channels: ['wechat', 'whatsapp', 'telegram', 'twitter', 'copy_image'],
    templates: {
      dm: '我这个月用「{strategy_name}」赚了{return}%。{brief_reason}。你要看一下不？',
      timeline: '分享一下这个月的交易成果：用了「{strategy_name}」这个策略，{period}收益{return}%，跑了{win_count}胜{loss_count}负。不是炫耀，就是记录一下。📊',
      group: '有人用过{momentum_or_value}策略吗？我这个月用「{strategy_name}」，做到了{return}%。感觉这个策略在{market}还挺有效的。有没有类似的策略推荐？',
      linkPreview: '我的「{strategy_name}」这个月收益{return}% ⚡ 想试试？',
    },
  },

  {
    scenario: 'share_factor',
    trigger: '关注的因子触发了强信号(偏离2σ+)',
    channels: ['wechat', 'telegram', 'copy_image'],
    templates: {
      dm: '刚看到一个信号：{factor_short}到{value}了。历史上类似位置{x_days}天后胜率{win_rate}%。要不要留心一下？',
      timeline: '📡 {factor_short}信号：当前值{value}，处于历史{percentile}分位。上次到这个位置是{last_time}，那之后{x_days}天{what_happened}。分享给大家参考，不构成投资建议。',
      group: '{factor_short}现在{human_signal}。历史数据参考：过去{period}里，类似位置之后{x_days}天的胜率是{win_rate}%，平均收益{avg_return}%。有研究的可以交流一下。',
      linkPreview: '{factor_short}到了极端值{value} — 历史上{win_rate}%概率{x_direction}',
    },
  },

  {
    scenario: 'share_report',
    trigger: 'AI月报生成后',
    channels: ['wechat', 'copy_link', 'copy_image'],
    templates: {
      dm: 'QUANT MOO给我出了份月报，挺有意思的。{insight_one}。你要不要也看看你的？',
      timeline: '收到鲸灵的月报了🐋。这个月{win_count}胜{loss_count}负，净{net_pnl}%。最好的操作是{best_trade}，最需要改进的是{worst_trade}。AI说我{good_habit}保持得不错，但{improve_area}可以做得更好。下个月继续加油。',
      group: '有没有人看QUANT MOO的AI月报？它说我的{best_quality}很好但{worst_quality}要改。感觉AI现在分析得越来越准了。',
      linkPreview: '🐋 我的{month}月报：{net_pnl}%，{win_count}胜{loss_count}负。鲸灵说...',
    },
  },

  {
    scenario: 'share_achievement',
    trigger: '交易里程碑(连赢10次/收益率破50%/持仓满1年)',
    channels: ['wechat', 'twitter', 'copy_image'],
    templates: {
      dm: '里程碑！我{achievement}。这过程还挺有意思的——{story_short}。',
      timeline: '🏆 {achievement_description}。说实话刚开始的时候没想到能坚持下来。{lesson_learned}。',
      group: '群里有没有人也做量化？我{achievement}。说实话中间{struggle}。最大的经验是{lesson_learned}。还在路上的共勉。',
      linkPreview: '🏆 {achievement_summary} — {time_taken}',
    },
  },

  {
    scenario: 'share_whale_tip',
    trigger: '鲸灵给出特别有趣或有深度的分析时',
    channels: ['wechat', 'twitter', 'copy_image'],
    templates: {
      dm: '鲸灵刚说了句话挺有意思的："{whale_quote}"。来源 {source_context}。',
      timeline: '🐋 鲸灵说："{whale_quote}" \n\n背景：{source_context}。我觉得这句话可以贴在交易台前面。',
      group: 'QUANT MOO的AI助手说了一句："{whale_quote}"。 我当时正在{context}，它突然来这么一句，还真把我点醒了。',
      linkPreview: '🐋 "{whale_quote_short}" — 来自鲸灵的分析',
    },
  },
];

// ═══════════════════ 社交裂变机制文案 ═══════════════════

export const REFERRAL_PROGRAM_COPY = {
  title: '邀请朋友，一起赚钱',
  intro: '你觉得QUANT MOO好用的话，把它分享给一个做交易的朋友。不是让你打广告——就是真心的推荐。',
  levels: [
    {
      level: 1,
      threshold: '邀请1人注册',
      reward: '免费AI分析 +1个月',
      copy: '邀请第一个朋友，多一个月免费AI。不好用的话让他骂你，好用的话他会谢你。',
    },
    {
      level: 2,
      threshold: '累计邀请5人',
      reward: '免费AI分析 +6个月',
      copy: '5个朋友都用上了——你已经是个小KOL了。送你半年免费AI，继续帮朋友找到好策略。',
    },
    {
      level: 3,
      threshold: '累计邀请20人',
      reward: '永久免费AI + 鲸灵专属域名',
      copy: '20个人因为你而开始做量化交易——这是你的影响力。永久免费AI+一个专属的鲸灵域名，证明你是第一批用户里的"老炮"。',
    },
  ],
  rules: [
    '被邀请人必须用你的链接或邀请码注册才算',
    '被邀请人完成至少1次策略回测，才算"有效邀请"',
    '奖励在有效邀请达成后24小时内自动发放',
    '不限制邀请方式——发群、私聊、朋友圈都行',
    '禁止通过刷量、虚假注册等方式获取奖励',
  ],
};

// ═══════════════════ 生成函数 ═══════════════════

export function generateShareCopy(
  scenario: ShareScenario,
  channel: 'dm' | 'timeline' | 'group' | 'linkPreview',
  params: Record<string, string>
): string {
  const tmpl = SHARE_TEMPLATES.find(s => s.scenario === scenario);
  if (!tmpl) return '我用QUANT MOO做了笔不错的交易，看看？';

  let text = tmpl.templates[channel] || tmpl.templates.dm;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

export default SHARE_TEMPLATES;
