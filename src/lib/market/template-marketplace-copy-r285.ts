// ══ R285 QClaw Task 1: 模板市场文案 (3h) ══
// JVS模板市场引擎 + ML付费UI —— 策略模板/指标组合/信号订阅的市场化交易
// 覆盖: 市场主页/模板卡片/购买流程/创作者中心/搜索筛选/评价系统/上架引导/质量徽章/价格引导
// 交付: TS常量 —— IndicatorMarketplace + TemplateMarketplaceUI 直接import

// ═══════════════════════════════════════
// SECTION 1: 市场主页
// ═══════════════════════════════════════

export const MARKETPLACE_HERO = {
  title: '模板市场',
  subtitle: '策略模板、指标组合、信号订阅 —— 高手分享，你直接用',
  description: '从社区创作者手中购买经过实战验证的模板，不用自己从零搭。买到就能用，一键加载到你的图表上。',
  statsLabel: '已有 {templateCount} 个模板 · {creatorCount} 位创作者 · {totalDownloads} 次下载',
  // CTA
  ctaBrowse: '浏览模板',
  ctaCreate: '成为创作者',
  // 二级入口
  tabs: {
    discover: { label: '发现', tooltip: '精选热门的模板 —— 编辑推荐' },
    trending: { label: '热门', tooltip: '下载量最高的模板 —— 群众的眼光' },
    newest: { label: '最新', tooltip: '刚上架的新模板 —— 第一时间体验' },
    free: { label: '免费', tooltip: '不花钱也能用的好模板' },
    myLibrary: { label: '我的库', tooltip: '已购买的模板都在这里' },
  },
} as const;

// ═══════════════════════════════════════
// SECTION 2: 模板分类
// ═══════════════════════════════════════

export const TEMPLATE_CATEGORIES = {
  trend: { label: '趋势跟踪', icon: '↗️', description: '追趋势 —— 均线排列、通道突破、超级趋势' },
  momentum: { label: '动量震荡', icon: '⚡', description: '抓拐点 —— MACD组合、RSI多周期、KD金叉' },
  volume: { label: '量价分析', icon: '📊', description: '看资金 —— OBV组合、量价背离、主力追踪' },
  volatility: { label: '波动突破', icon: '🌊', description: '捕爆发 —— 布林挤压、ATR突破、肯特纳通道' },
  combo: { label: '综合套装', icon: '🎯', description: '多维度 —— 趋势+动量+量价三合一方案' },
  custom: { label: '个人定制', icon: '🛠️', description: '独创方案 —— 创作者自己调出来的独特组合' },
  signal: { label: '信号订阅', icon: '🔔', description: '按月订阅 —— 每天推送买卖信号到你的图表' },
  aStock: { label: 'A股专属', icon: '🇨🇳', description: 'A股特色 —— 主力控盘、龙虎榜、北向资金' },
} as const;

// ═══════════════════════════════════════
// SECTION 3: 模板卡片
// ═══════════════════════════════════════

export const TEMPLATE_CARD = {
  // 卡片字段标签
  labels: {
    price: '{price} USDT',
    free: '免费',
    downloads: '{count}次下载',
    rating: '{rating}分 ({count}评)',
    indicators: '{count}个指标',
    strategy: '{count}个策略',
    author: '作者 {name}',
    bestselling: '畅销',
    newArrival: '新品',
    verified: '已验证',
    editorPick: '编辑精选',
  },
  // 悬停提示
  previewTooltip: '点击预览模板效果',
  buyTooltip: '立即购买并添加到我的库',
  detailTooltip: '查看模板详情和评价',
  // 操作按钮
  preview: '预览',
  buyNow: '立即购买',
  viewDetails: '查看详情',
  alreadyOwned: '已拥有',
  addToWishlist: '收藏',
  removeFromWishlist: '取消收藏',
} as const;

// ═══════════════════════════════════════
// SECTION 4: 模板详情页
// ═══════════════════════════════════════

export const TEMPLATE_DETAIL = {
  // 头部信息
  header: {
    byAuthor: '作者 {name}',
    updated: '更新于 {date}',
    version: 'v{version}',
    category: '分类: {category}',
    tags: '标签: {tags}',
  },
  // Tab导航
  tabs: {
    overview: '概览',
    indicators: '指标详情',
    reviews: '评价 ({count})',
    performance: '历史表现',
    changelog: '更新日志',
  },
  // 概览区块
  overview: {
    description: '模板说明',
    whatItDoes: '这个模板做什么',
    whoItIsFor: '适合谁用',
    whenToUse: '什么时候用',
    whenNotToUse: '什么时候别用',
    indicatorsList: '包含的指标',
    defaultParams: '默认参数',
    compatibleTimeframes: '适用周期',
    compatibleMarkets: '适用市场',
  },
  // 历史表现（信号订阅类模板）
  performance: {
    title: '历史信号表现',
    disclaimer: '⚠️ 过去表现不代表未来收益。以下数据基于历史回测，实盘结果可能不同。',
    winRate: '信号胜率',
    totalSignals: '总信号数',
    avgReturn: '平均收益',
    maxDrawdown: '最大回撤',
    sharpeRatio: '夏普比率',
    period: '回测周期: {start} ~ {end}',
    benchmark: '基准: {name}',
  },
  // 操作区
  actions: {
    buyNow: '立即购买 · {price} USDT',
    tryFirst: '先试用再购买',
    freeDownload: '免费下载',
    share: '分享',
    report: '举报',
    wishlist: '收藏到心愿单',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 5: 购买流程
// ═══════════════════════════════════════

export const PURCHASE_FLOW = {
  // 购买确认弹窗
  confirmTitle: '确认购买',
  confirmBody: '你将购买 "{templateName}"，价格 {price} USDT。购买后可永久使用，包括未来更新。',
  balance: '你的余额: {balance} USDT',
  insufficientBalance: '余额不足！需要 {shortfall} USDT。去充值 →',
  // 购买成功
  successTitle: '购买成功！',
  successBody: '"{templateName}" 已添加到你的库。现在就可以在图表中加载使用。',
  loadNow: '立即加载到图表',
  goToLibrary: '去我的库',
  // 购买失败
  failedTitle: '购买失败',
  failedBody: '付款时出了点问题 —— {error}。你的余额没有被扣，请重试。',
  retry: '重试',
  contactSupport: '联系客服',
  // 退款
  refundPolicy: '退款政策: 购买后7天内可申请退款，前提是你还没有下载或加载该模板。',
  refundButton: '申请退款',
  refundTitle: '申请退款',
  refundBody: '确认对 "{templateName}" ({price} USDT) 申请退款? 退款后模板将从你的库中移除。',
  refundSuccess: '退款成功! {price} USDT 已退回你的钱包。',
} as const;

// ═══════════════════════════════════════
// SECTION 6: 创作者中心
// ═══════════════════════════════════════

export const CREATOR_CENTER = {
  // 主页
  title: '创作者中心',
  subtitle: '分享你的策略模板，赚取USDT收入',
  statsOverview: {
    totalRevenue: '累计收入',
    totalTemplates: '上架模板数',
    totalDownloads: '累计下载',
    totalRatings: '平均评分',
    currentTier: '创作者等级',
  },
  // 创作者等级
  tiers: {
    l1: {
      name: '新手创作者',
      condition: '注册即可上架',
      platformFee: '平台抽成 30%',
      youGet: '你拿 70%',
      benefits: ['可上架模板', '基础数据看板'],
      upgradeHint: '累计卖出100个模板 → 升级进阶创作者（平台抽成降到20%）',
    },
    l2: {
      name: '进阶创作者',
      condition: '累计售出 ≥100笔',
      platformFee: '平台抽成 20%',
      youGet: '你拿 80%',
      benefits: ['优先展示', '详细数据看板', '用户反馈直达'],
      upgradeHint: '累计卖出1,000个模板 → 升级旗舰创作者（平台抽成仅10%）',
    },
    l3: {
      name: '旗舰创作者',
      condition: '累计售出 ≥1,000笔',
      platformFee: '平台抽成 10%',
      youGet: '你拿 90%',
      benefits: ['首页推荐位', '专属徽章', '更高分成', '数据导出', '优先客服'],
      upgradeHint: '你已是最高等级！专注品质，保持口碑。',
    },
  },
  // 上架新模板
  createNew: {
    title: '上架新模板',
    stepLabels: ['基本信息', '指标配置', '定价设置', '预览与发布'],
    steps: {
      basic: {
        title: '基本信息',
        nameLabel: '模板名称',
        namePlaceholder: '给模板起个好名字——如"MACD三重确认套装"',
        nameHint: '≤20字。名字要让人一眼看出这个模板做什么。',
        descriptionLabel: '模板说明',
        descriptionPlaceholder: '这个模板适合什么行情？怎么用？不适合什么时候？',
        descriptionHint: '≥50字。写得越详细，买家越信任。',
        categoryLabel: '模板分类',
        tagsLabel: '标签 (最多5个)',
        tagsPlaceholder: '输入标签后按回车 —— 如: 趋势,MACD,短线',
        timeframeLabel: '适用周期',
        marketLabel: '适用市场',
      },
      indicators: {
        title: '指标配置',
        addIndicatorLabel: '添加指标',
        indicatorCount: '已添加 {count}/12 个指标',
        hint: '从你的图表中挑选指标和参数，一键打包成模板。建议3-8个指标，太多反而乱。',
        removeHint: '点击×移除。模板至少需要1个指标。',
      },
      pricing: {
        title: '定价设置',
        priceLabel: '售价 (USDT)',
        priceHint: '最低 9.9 USDT。建议参考同类模板的定价。高质量模板可以定更高。',
        pricePlaceholder: '9.9',
        yourRevenue: '你到手: {revenue} USDT (平台抽成 {fee}%)',
        previewImage: '预览图 (可选)',
        previewHint: '上传一张模板加载在图表上的截图 —— 买家会看这个决定买不买。推荐尺寸 1200×800。',
      },
      publish: {
        title: '预览与发布',
        previewLabel: '模板效果预览',
        confirmChecklist: [
          '模板名称清晰易懂',
          '说明写了≥50字',
          '指标数量合理(建议≤8)',
          '定价≥9.9 USDT',
          '预览图已上传',
        ],
        publishButton: '提交审核',
        publishHint: '提交后1-2个工作日内审核。审核通过后模板上架市场。',
        saveDraft: '保存草稿',
      },
    },
    // 提交成功
    submitted: {
      title: '提交成功！',
      body: '你的模板 "{name}" 已提交审核。审核通常在1-2个工作日内完成，通过后将在模板市场上架。',
      action: '去看我的模板',
    },
  },
  // 我的模板管理
  myTemplates: {
    title: '我的模板',
    tabs: {
      published: '已上架 ({count})',
      pending: '审核中 ({count})',
      draft: '草稿 ({count})',
      rejected: '未通过 ({count})',
    },
    empty: {
      published: '还没有上架的模板。去创建一个 →',
      pending: '没有审核中的模板。',
      draft: '没有草稿。',
      rejected: '没有被驳回的模板。',
    },
    actions: {
      edit: '编辑',
      unpublish: '下架',
      delete: '删除',
      viewStats: '看数据',
    },
    stats: {
      title: '模板数据',
      revenue: '收入: {amount} USDT',
      sales: '售出: {count} 份',
      views: '浏览: {count} 次',
      conversionRate: '转化率: {rate}%',
      avgRating: '评分: {rating}',
      revenueChart: '收入趋势 (近30天)',
      topReferrer: '访客来源',
    },
  },
  // 收入提取
  withdrawal: {
    title: '提取收入',
    availableBalance: '可提余额: {balance} USDT',
    minimumHint: '最低提现 10 USDT',
    feeHint: '提现手续费 0.1%',
    withdrawButton: '提取到钱包',
    history: '提现记录',
    historyEmpty: '还没有提现记录。',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 7: 评价系统
// ═══════════════════════════════════════

export const REVIEW_SYSTEM = {
  // 评价列表
  title: '用户评价',
  average: '平均 {rating} 星 · {count} 条评价',
  distribution: '评分分布',
  // 写评价
  writeReview: {
    title: '写评价',
    ratingLabel: '你的评分',
    ratingHint: '1=不值 5=超值',
    commentLabel: '评价内容',
    commentPlaceholder: '分享你的使用体验——这个模板好用吗？帮到你了吗？有什么改进建议？',
    commentHint: '≥10字。有建设性的评价对其他买家很有帮助。',
    submit: '发表评价',
    submitted: '评价已发表！感谢你的反馈。',
  },
  // 评价卡片
  card: {
    verifiedPurchase: '已购买',
    helpful: '{count}人觉得有用',
    markHelpful: '有用',
    replyFromCreator: '作者回复',
  },
  // 空状态
  noReview: {
    title: '暂无评价',
    hint: '购买后记得回来写评价——你的体验对其他买家很重要。',
  },
  // 质量标签 (自动打标)
  qualityTags: {
    highWinRate: '高胜率',
    lowDrawdown: '低回撤',
    beginnerFriendly: '适合新手',
    proLevel: '专业级',
    popular: '热门',
    wellDocumented: '文档齐全',
    fastSetup: '开箱即用',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 8: 搜索与筛选
// ═══════════════════════════════════════

export const MARKETPLACE_SEARCH = {
  placeholder: '搜索模板——趋势、MACD、A股...',
  filters: {
    category: '分类',
    price: '价格',
    rating: '评分',
    sortBy: '排序',
  },
  priceRanges: {
    free: '免费',
    under10: '≤10 USDT',
    under20: '≤20 USDT',
    under50: '≤50 USDT',
    all: '全部价格',
  },
  ratingFilters: {
    above4: '4星以上',
    above3: '3星以上',
    all: '全部评分',
  },
  sortOptions: {
    trending: '最热门',
    newest: '最新上架',
    highestRated: '最高评分',
    mostDownloaded: '最多下载',
    priceLowToHigh: '价格从低到高',
    priceHighToLow: '价格从高到低',
    bestSelling: '最畅销',
  },
  noResults: {
    title: '没有找到匹配的模板',
    hint: '试试换个关键词，或者放宽筛选条件。',
    suggestion: '也许你想看:',
    clearFilters: '清除筛选',
  },
  // 搜索结果卡片上的标签
  resultTags: {
    exactMatch: '精确匹配',
    partialMatch: '部分匹配',
    popularInCategory: '本类热门',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 9: 订阅模式 (信号订阅)
// ═══════════════════════════════════════

export const SUBSCRIPTION_COPY = {
  title: '信号订阅',
  description: '按月订阅创作者的交易信号，每天推送买卖提醒到你的图表。',
  billing: {
    monthly: '每月',
    quarterly: '每季度 (省10%)',
    yearly: '每年 (省20%)',
  },
  cancel: {
    label: '取消订阅',
    confirm: '确认取消对 "{name}" 的订阅? 你仍可在当前周期内继续使用。',
    success: '订阅已取消。到期日: {endDate}',
  },
  autoRenew: '自动续费 —— 到期前3天提醒',
  signalPreview: {
    title: '最近信号',
    signalCount: '过去30天发出了 {count} 个信号',
    accuracy: '同期准确率: {accuracy}%',
    disclaimer: '⚠️ 信号仅供参考，不构成投资建议。',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 10: 通用UI文案
// ═══════════════════════════════════════

export const MARKETPLACE_COMMON = {
  loading: {
    templates: '正在加载模板市场...',
    detail: '正在加载模板详情...',
    reviews: '正在加载评价...',
    purchase: '正在处理购买...',
  },
  error: {
    loadFailed: '加载失败 —— 请检查网络后重试',
    loadFailedAction: '重试',
    purchaseFailed: '购买失败 —— {reason}',
    networkError: '网络连接异常 —— 请稍后再试',
  },
  trust: {
    verifiedBadge: '✅ 已审核',
    verifiedTooltip: '该模板已经QUANT MOO官方审核——内容真实、参数合法、无恶意代码',
    moneyBack: '💰 7天退款保证',
    moneyBackTooltip: '购买后7天内可无理由退款(未加载使用的前提)',
    securePayment: '🔒 安全支付',
    securePaymentTooltip: 'USDT支付——你的资金由智能合约托管,创作者无法直接收款',
  },
  sharing: {
    shareTitle: '在QUANT MOO发现了这个模板: {name}',
    shareText: '{name} —— {oneliner}。{price} USDT，{downloads}次下载，评分{rating}。来看看！',
    copiedLink: '链接已复制！分享给朋友一起用。',
  },
} as const;

// ═══════════════════════════════════════
// 全部导出
// ═══════════════════════════════════════

export const TEMPLATE_MARKETPLACE_COPY = {
  hero: MARKETPLACE_HERO,
  categories: TEMPLATE_CATEGORIES,
  card: TEMPLATE_CARD,
  detail: TEMPLATE_DETAIL,
  purchase: PURCHASE_FLOW,
  creator: CREATOR_CENTER,
  review: REVIEW_SYSTEM,
  search: MARKETPLACE_SEARCH,
  subscription: SUBSCRIPTION_COPY,
  common: MARKETPLACE_COMMON,
} as const;

export default TEMPLATE_MARKETPLACE_COPY;
