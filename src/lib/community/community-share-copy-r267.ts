// ══ R267 QClaw Task 3: 社区分享文案 (2h) ══
// P2-03: 社区分享 — 用户把画线/分析分享到社区，获得关注和互动
// 交付: 分享面板 + 分析卡片模板 + 互动文案 + 社区规范

// ═══════════════════════════════════════
// TYPE
// ═══════════════════════════════════════

export interface CommunityShareCopy {
  shareDialog: ShareDialogCopy;
  analysisCard: AnalysisCardCopy;
  engagement: EngagementCopy;
  feed: FeedCopy;
  communityRules: CommunityRule[];
}

interface ShareDialogCopy {
  title: string;
  subtitle: string;
  privacy: {
    label: string;
    public: { label: string; description: string };
    followersOnly: { label: string; description: string };
    private: { label: string; description: string };
  };
  content: {
    titleLabel: string;
    titlePlaceholder: string;
    bodyLabel: string;
    bodyPlaceholder: string;
    tagsLabel: string;
    tagsPlaceholder: string;
    tagsHint: string;
  };
  drawLayer: {
    label: string;
    includeLabel: string;
    includeDesc: string;
    excludeLabel: string;
    excludeDesc: string;
  };
  preview: {
    label: string;
    noImage: string;
  };
  buttons: {
    publish: string;
    draft: string;
    cancel: string;
  };
  success: {
    title: string;
    body: string;
    viewPost: string;
    close: string;
  };
}

interface AnalysisCardCopy {
  byLabel: string;             // "由 @{username} 分析"
  timestampFormat: string;     // "{relative}前" / "{date}"
  drawCount: string;           // "{n}根画线"
  indicatorCount: string;      // "{n}个指标"
  symbolTag: string;           // 股票代码标签
  strategyTag: string;         // "含策略"标签
  verifiedLabel: string;       // "已验证"标签(高准确率用户)
  verifiedTooltip: string;     // "该作者历史准确率{rate}%"
}

interface EngagementCopy {
  like: string;                // "赞"
  liked: string;               // "已赞"
  comment: string;             // "评论"
  share: string;               // "转发"
  save: string;                // "收藏"
  saved: string;               // "已收藏"
  report: string;              // "举报"
  viewCount: string;           // "{n}次查看"
  likeCount: string;           // "{n}个赞"
  commentCount: string;        // "{n}条评论"
  commentPlaceholder: string;  // "说点什么..."
  commentSubmit: string;       // "发送"
  noComments: string;          // "还没有评论——来说第一句"
  followLabel: string;         // "关注"
  followingLabel: string;      // "已关注"
  unfollowLabel: string;       // "取消关注"
}

interface FeedCopy {
  title: string;
  subtitle: string;
  tabs: {
    following: string;         // "关注"
    trending: string;          // "热门"
    latest: string;            // "最新"
    verified: string;          // "高准确率"
  };
  empty: {
    following: { title: string; body: string };
    trending: { title: string; body: string };
    latest: { title: string; body: string };
    verified: { title: string; body: string };
  };
  loadMore: string;
}

interface CommunityRule {
  title: string;
  description: string;
}

// ═══════════════════════════════════════
// 完整文案
// ═══════════════════════════════════════

export const COMMUNITY_SHARE_COPY: CommunityShareCopy = {

  // ── 分享弹窗 ──
  shareDialog: {
    title: '分享到社区',
    subtitle: '你的画线分析会被其他交易者看到——他们可以点赞、评论、学习你的思路',

    privacy: {
      label: '谁能看到',
      public: { label: '所有人可见', description: '公开发布——获得最多曝光和互动' },
      followersOnly: { label: '仅粉丝可见', description: '只对你的关注者可见——更私密的讨论' },
      private: { label: '仅自己可见', description: '保存为私人笔记——不公开' },
    },

    content: {
      titleLabel: '标题',
      titlePlaceholder: '用一句话概括你的分析——"NVDA突破阻力后的走势判断"',
      bodyLabel: '分析说明',
      bodyPlaceholder: '说说你为什么画了这些线，你看到了什么信号。好的分析会获得更多互动。',
      tagsLabel: '标签',
      tagsPlaceholder: '添加标签——回车确认',
      tagsHint: '添加2-5个标签帮助别人找到你的分析。如"趋势分析"、"科技股"、"短线"',
    },

    drawLayer: {
      label: '画线图层',
      includeLabel: '附带我的画线',
      includeDesc: '别人可以看到你画的趋势线、支撑/阻力。你画的越多、越清楚——分析越有价值。',
      excludeLabel: '不附带画线',
      excludeDesc: '只发布文字分析，不在K线图上显示画线。对纯文字讨论适合。',
    },

    preview: {
      label: '预览',
      noImage: 'K线图预览加载中…',
    },

    buttons: {
      publish: '发布',
      draft: '存为草稿',
      cancel: '取消',
    },

    success: {
      title: '✅ 发布成功',
      body: '你的分析已发布到社区。获得5个赞以上会出现在"热门"列表。',
      viewPost: '查看我的帖子',
      close: '继续看行情',
    },
  },

  // ── 分析卡片模板 ──
  analysisCard: {
    byLabel: '@{username}',
    timestampFormat: '{relative}前',
    drawCount: '{n}根画线',
    indicatorCount: '{n}个指标',
    symbolTag: '{symbol}',
    strategyTag: '含策略',
    verifiedLabel: '已验证',
    verifiedTooltip: '历史分析准确率 {rate}%',
  },

  // ── 互动文案 ──
  engagement: {
    like: '赞',
    liked: '已赞',
    comment: '评论',
    share: '转发',
    save: '收藏',
    saved: '已收藏',
    report: '举报',
    viewCount: '{n}次查看',
    likeCount: '{n}个赞',
    commentCount: '{n}条评论',
    commentPlaceholder: '说说你的看法…',
    commentSubmit: '发送',
    noComments: '还没有人评论——来说第一句',
    followLabel: '关注',
    followingLabel: '已关注',
    unfollowLabel: '取消关注',
  },

  // ── 信息流 ──
  feed: {
    title: '信号广场',
    subtitle: '其他交易者的画线分析——学习他们看到了什么',

    tabs: {
      following: '关注',
      trending: '热门',
      latest: '最新',
      verified: '高准确率',
    },

    empty: {
      following: {
        title: '还没有关注任何人',
        body: '去"热门"看看——找到分析风格吸引你的交易者，关注他们。',
      },
      trending: {
        title: '还没有热门分析',
        body: '做第一个发布的人——你的分析可能是第一个热帖。',
      },
      latest: {
        title: '还没有人发布分析',
        body: '成为第一个分享分析的人——点击图表上的画线→右键→分享到社区。',
      },
      verified: {
        title: '高准确率用户暂未发布',
        body: '返回"热门"看看其他人的分析。',
      },
    },

    loadMore: '加载更多',
  },

  // ── 社区规范 ──
  communityRules: [
    {
      title: '分享你的思路，不只是结论',
      description: '"我看涨"不是分析——"MA5上穿MA20 + 放量 + 布林收窄待突破，所以我看涨"才是。别人来这里是学思路的。',
    },
    {
      title: '画线就是你的论据',
      description: '每一根线都应该有理由——你为什么画在这里而不是那里。好的画线=好的分析=更多的赞。',
    },
    {
      title: '接受质疑',
      description: '别人可能会指出你画线的漏洞——这不是针对你，是为了让分析更准。最好的分析往往是在争论中产生的。',
    },
    {
      title: '准确率比粉丝数重要',
      description: '在QUANT MOO——你的等级按准确率排，不按粉丝数。准确率=你的分析被市场验证的次数。',
    },
    {
      title: '不喊单、不拉群、不承诺收益',
      description: '"这个币马上翻倍"、"加我VX带你飞"——这些内容会被删除，发布者会被降级。我们提供一个讨论的地方——不为任何人的盈亏负责。',
    },
  ],
};

// ═══════════════════════════════════════
// 评论模板 — AI辅助评论 (可选的Whaley功能)
// ═══════════════════════════════════════

export const COMMENT_TEMPLATES = {
  askAboutDraw: '你为什么把{drawType}画在这个位置？',
  askAboutSignal: '你看到了什么信号让你做这个判断？',
  counterPoint: '换个角度看——如果{condition}发生，这个分析还成立吗？',
  support: '同意——我也观察到了{indicator}的相同信号。',
  goodQuestion: '好问题！这种分析对刚学的人很有帮助。',
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天`;
  const weeks = Math.floor(days / 7);
  return `${weeks}周`;
}

export default COMMUNITY_SHARE_COPY;
