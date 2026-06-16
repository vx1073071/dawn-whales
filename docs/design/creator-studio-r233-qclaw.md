/* ════════════════════════════════════════════════════════════════════════════
 * R233-QClaw#1 — Creator Studio Full Design
 *           14h: 5 pages + user flows + interactive specs
 *
 * 设计范围:
 *   1. Creator Studio 概览 (用户流 + 创作等级 + 入口)
 *   2. Page 1: Strategy Manager — 上传/管理/上下架/版本
 *   3. Page 2: Strategy Editor — 参数编辑/因子组合/AI助手
 *   4. Page 3: Data Analytics — 实盘追踪/观众分析/转化漏斗
 *   5. Page 4: Revenue Dashboard — 收益明细/提现/对账单
 *   6. Page 5: Creator Profile — 个人页/徽章/信任元素
 *   7. 全页面空态/Loading/错误/边界状态
 *   8. 创作者全生命周期 (注册→L1新手→L2进阶→L3旗舰)
 *   9. i18n keys for all copy
 * ════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
// 0. CREATOR LIFECYCLE & LEVEL SYSTEM
// ═══════════════════════════════════════════════════════════

export const CREATOR_LIFECYCLE = {
  journey: [
    { stage: '注册用户', trigger: '注册账户', unlock: '浏览策略市场, 跟单交易' },
    { stage: 'L1 新手创作者', trigger: '上传第一个策略', unlock: 'Creator Studio入口, 30%平台抽成, 🥉铜徽章' },
    { stage: 'L2 进阶创作者', trigger: '累计销量≥100笔', unlock: '20%平台抽成, 🥈银徽章, 数据分析, 收益看板' },
    { stage: 'L3 旗舰创作者', trigger: '累计销量≥1000笔', unlock: '10%平台抽成, 🥇金徽章, 优先推荐, 专属支持' },
  ],
  levelBanner: {
    L1: { icon: '🥉', color: '#cd7f32', labelKey: 'creator_level_L1' },
    L2: { icon: '🥈', color: '#c0c0c0', labelKey: 'creator_level_L2' },
    L3: { icon: '🥇', color: '#d4a574', labelKey: 'creator_level_L3' },
  },
  entry: {
    from: ['顶部导航栏 "创作中心"', '用户头像下拉菜单', '策略市场→"成为创作者"CTA', 'onboarding完成页'],
    gate: '任何注册用户均可点击进入, 无门槛浏览, 上传策略后激活完整功能',
  },
};

// ═══════════════════════════════════════════════════════════
// 1. CREATOR STUDIO OVERVIEW (Shell Page)
// ═══════════════════════════════════════════════════════════

export const STUDIO_SHELL = {
  layout: 'Left sidebar navigation + right content area',
  sidebar: {
    logo: '创作者工作室 logo + "Creator Studio" title',
    sections: [
      {
        labelKey: 'studio_nav_main',
        items: [
          { id: 'overview', labelKey: 'studio_nav_overview', icon: '🏠', route: '/creator' },
          { id: 'strategies', labelKey: 'studio_nav_strategies', icon: '📋', route: '/creator/strategies', badge: '{count}' },
          { id: 'analytics', labelKey: 'studio_nav_analytics', icon: '📊', route: '/creator/analytics', requiresL2: true },
          { id: 'revenue', labelKey: 'studio_nav_revenue', icon: '💰', route: '/creator/revenue', requiresL2: true },
        ],
      },
      {
        labelKey: 'studio_nav_settings',
        items: [
          { id: 'profile', labelKey: 'studio_nav_profile', icon: '👤', route: '/creator/profile' },
          { id: 'payout', labelKey: 'studio_nav_payout', icon: '💳', route: '/creator/payout' },
        ],
      },
    ],
    footer: {
      levelDisplay: '当前等级徽章 + 下一级进度条 (如 L1 → L2: "已售78/100笔")',
      help: '创作者帮助中心链接',
    },
  },
  header: {
    breadcrumb: 'Creator Studio / {currentPage}',
    actions: ['通知中心', '快速操作: 上传新策略(+)'],
  },
};

// ═══════════════════════════════════════════════════════════
// 2. PAGE 1: STRATEGY MANAGER
// ═══════════════════════════════════════════════════════════

export const STRATEGY_MANAGER_PAGE = {
  route: '/creator/strategies',
  sections: [

    // ── Top Bar ──
    {
      id: 'topBar',
      components: [
        { type: 'search', placeholderKey: 'studio_search_strategies' },
        { type: 'filter', options: ['全部', '已发布', '审核中', '已下架', '草稿'] },
        { type: 'sort', options: ['最新', '销量', '评分', '收益'] },
        { type: 'button', labelKey: 'studio_upload_new', icon: '➕', primary: true },
      ],
    },

    // ── Strategy Card Grid (3-col desktop, 2-col tablet, 1-col mobile) ──
    {
      id: 'strategyGrid',
      empty: {
        illustration: '空画板插画',
        titleKey: 'studio_empty_strategies_title',
        bodyKey: 'studio_empty_strategies_body',
        ctaKey: 'studio_upload_first',
      },
      card: {
        header: {
          thumbnail: '策略类型图标 (趋势/均值回归/动量/...)',
          name: '策略名称 (可编辑)',
          status: '● Published  / ◌ Reviewing / ○ Draft / ⊖ Delisted',
          levelBadge: 'L1/L2/L3 创作等级徽章',
        },
        stats: {
          sales: '📦 累计销量',
          revenue: '💰 累计收益 USDT',
          rating: '⭐ 评分 (avg)',
          followers: '👥 跟单人数',
          lastUpdated: '🕐 最后更新',
        },
        quickActions: [
          { action: 'edit', labelKey: 'studio_action_edit', icon: '✏️' },
          { action: 'preview', labelKey: 'studio_action_preview', icon: '👁️' },
          { action: 'duplicate', labelKey: 'studio_action_duplicate', icon: '📋' },
          { action: 'more', labelKey: 'studio_action_more', icon: '⋯', dropdown: ['查看详情', '下架', '删除'] },
        ],
      },
      edgeCases: {
        draftUnpublished: '灰色边框 + "草稿" 标签 + 发布按钮突出',
        reviewing: '黄色边框 + "审核中" (预计1-2工作日)',
        delisted: '暗灰色 + "已下架" + 重新上架按钮',
        deleted: '不显示在列表 (软删除, 可恢复期内显示在回收站)',
      },
    },

    // ── Upload Strategy Modal (Multi-step) ──
    {
      id: 'uploadModal',
      steps: [
        {
          step: 1, titleKey: 'studio_upload_step1_title',
          fields: [
            { name: 'name', type: 'text', maxLen: 40, required: true, placeholderKey: 'studio_field_name' },
            { name: 'description', type: 'textarea', maxLen: 200, required: true, placeholderKey: 'studio_field_desc' },
            { name: 'market', type: 'multi-select', options: '11 MarketTags', required: true },
            { name: 'category', type: 'select', options: ['Trend','Mean Reversion','Momentum','Value','Multi-Factor','Options','Crypto'], required: true },
            { name: 'riskLevel', type: 'select', options: ['Conservative','Moderate','Aggressive'], required: true },
            { name: 'price', type: 'number', unit: 'USDT', min: 9.9, step: 0.1, required: true, helperKey: 'studio_price_helper' },
          ],
        },
        {
          step: 2, titleKey: 'studio_upload_step2_title',
          descKey: 'studio_upload_step2_desc',
          fields: [
            { name: 'factors', type: 'factor-picker', desc: '从因子库选择, min 3, max 12' },
            { name: 'weights', type: 'weight-sliders', desc: '权重总和=100%' },
            { name: 'params', type: 'param-list', desc: '可调参数 (如 stopLoss, takeProfit, positionSize)' },
            { name: 'holdingDays', type: 'range', desc: '建议持有天数范围' },
          ],
          aiHelper: {
            titleKey: 'studio_upload_ai_helper',
            descKey: 'studio_upload_ai_helper_desc',
            cost: '1 USDT',
            action: 'AI一键填充因子和权重',
          },
        },
        {
          step: 3, titleKey: 'studio_upload_step3_title',
          descKey: 'studio_upload_step3_desc',
          fields: [
            { name: 'backtest', type: 'backtest-upload', desc: '上传回测截图或让系统自动跑 (免费)', format: 'PNG/JPG, max 2MB' },
            { name: 'disclaimer', type: 'disclaimer', desc: '回测不代表未来收益, 需勾选同意' },
          ],
          autoBacktest: {
            labelKey: 'studio_auto_backtest',
            descKey: 'studio_auto_backtest_desc',
            free: true,
          },
        },
        {
          step: 4, titleKey: 'studio_upload_step4_title',
          desc: 'Preview & Submit — 完整预览策略在市场中展示的样子',
          preview: '策略卡片预览 (从买家视角)', 
          checklist: ['市场正确', '因子权重=100%', '名称≤40字', '说明书≤200字', '价格≥9.9 USDT', '回测已附', '免责声明已勾选'],
          submit: { labelKey: 'studio_upload_submit', noteKey: 'studio_upload_review_note' },
        },
      ],
    },

    // ── Strategy Detail/Edit Page ──
    {
      id: 'strategyDetail',
      tabs: ['概述', '参数与因子', '回测与实盘', '销售数据', '评论'],
      overview: {
        header: '策略名称 (可编辑) + 状态 + 等级徽章',
        metrics: ['总销量', '总收益', '⭐评分', '跟单人数', '创建时间', '最后更新'],
        quickEdit: '一键编辑名称/描述',
      },
      params: {
        factorTable: '因子名称 | 权重 | IC | IR | 状态 (📈/📉)',
        weightEditor: '拖拽滑块调整权重 → 自动归一化到100%',
        paramEditor: '每个参数: 名称/默认值/范围/描述',
      },
      backtest: {
        metricsCard: '回测指标: 年化收益/夏普/最大回撤/胜率/Calmar',
        equityChart: '权益曲线 (蓝色=策略, 灰色=基准)',
        liveGap: '实盘vs回测偏差 — 追踪信号 (如果已有人在跟单)',
      },
      sales: {
        chart: '日销量/周销量折线图',
        breakdown: '按市场/按套餐 (如果有套餐)',
        conversion: '浏览次数 → 购买次数 → 转化率',
      },
      reviews: {
        list: '用户评论列表 (⭐+文字)',
        response: '创作者可回复每条评论',
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════
// 3. PAGE 2: STRATEGY EDITOR (Deep Editor)
// ═══════════════════════════════════════════════════════════

export const STRATEGY_EDITOR_PAGE = {
  route: '/creator/strategies/:id/edit',
  layout: 'Split: left=editor, right=live preview (策略在市场中展示的样子)',

  sections: {
    // ── Factor Composer ──
    factorComposer: {
      titleKey: 'studio_editor_factors',
      source: 'Factor Library (188因子, 按等级解锁: L1→入门35, L2→进阶68, L3→全部188)',
      picker: '搜索+按市场/类型筛选 → 拖入组合区',
      comboArea: {
        maxFactors: 12, minFactors: 3,
        eachFactor: '名称 | 权重滑块 | IC值 | 移除按钮',
        weightValidator: '总和必须=100%, 否则红色提示 + 禁用保存',
        empty: '拖入因子到此区域或搜索添加',
      },
      aiSuggest: {
        labelKey: 'studio_editor_ai_suggest',
        cost: '1 USDT',
        desc: 'AI根据目标市场和风险偏好推荐因子组合',
      },
    },

    // ── Parameter Tuner ──
    parameterTuner: {
      titleKey: 'studio_editor_params',
      params: [
        { key: 'stopLoss', labelKey: 'editor_param_stoploss', type: 'percent', default: 5, range: [1, 20] },
        { key: 'takeProfit', labelKey: 'editor_param_takeprofit', type: 'percent', default: 10, range: [2, 50] },
        { key: 'positionSize', labelKey: 'editor_param_position', type: 'percent', default: 20, range: [5, 100] },
        { key: 'maxPositions', labelKey: 'editor_param_maxpos', type: 'number', default: 5, range: [1, 20] },
        { key: 'holdingDaysMin', labelKey: 'editor_param_holdmin', type: 'days', default: 3, range: [1, 30] },
        { key: 'holdingDaysMax', labelKey: 'editor_param_holdmax', type: 'days', default: 14, range: [1, 90] },
        { key: 'rebalanceFreq', labelKey: 'editor_param_rebalance', type: 'select', options: ['daily','weekly','monthly'] },
      ],
      eachParam: 'humanLabel + 滑块 + 当前值 + 单位 + 影响预览',
    },

    // ── Trigger Rules ──
    triggerRules: {
      titleKey: 'studio_editor_triggers',
      descKey: 'studio_editor_triggers_desc',
      rules: [
        { key: 'entryRule', type: 'condition-builder', labelKey: 'editor_rule_entry' },
        { key: 'exitRule', type: 'condition-builder', labelKey: 'editor_rule_exit' },
        { key: 'stopRule', type: 'condition-builder', labelKey: 'editor_rule_stop' },
      ],
      conditionBuilder: 'IF {factor} {operator} {value} THEN {action} (AND/OR 逻辑)',
    },

    // ── Backtest Runner ──
    backtestRunner: {
      titleKey: 'studio_editor_backtest',
      config: '选择市场 + 时间范围 (1年/3年/5年) + 初始资金',
      run: '免费运行 (≤30秒)',
      results: '4指标卡 + 权益曲线 + 月收益热力图 + 最大回撤图',
      satisfaction: '满意 → "发布" / 不满意 → "继续调整"',
    },

    // ── Live Preview Panel ──
    livePreview: {
      titleKey: 'studio_editor_preview',
      mode: '买家视角 (策略在市场中的样子)',
      shows: '策略卡片 + 因子列表(锁) + 回测摘要(锁) + CTA按钮',
      toggle: '切换: 桌面/平板/手机视图',
    },
  },

  saveFlow: {
    draft: '自动保存草稿到本地 (IndexedDB)',
    publish: '发布 → 审核中 → 审核通过/拒绝 → 通知',
    update: '已发布策略: 修改→审核中(策略暂时仍可售, 通过后自动更新)',
    version: '每次发布/更新创建新版本, 旧版本保留30天可回滚',
  },
};

// ═══════════════════════════════════════════════════════════
// 4. PAGE 3: DATA ANALYTICS (L2+ only)
// ═══════════════════════════════════════════════════════════

export const ANALYTICS_PAGE = {
  route: '/creator/analytics',
  gate: '需要L2+等级。L1看到的是升级引导页。',
  period: '时间筛选: 7天/30天/90天/自定义',

  sections: [

    // ── Overview Cards ──
    {
      id: 'overview',
      cards: [
        { metric: 'totalImpressions', labelKey: 'analytics_impressions', icon: '👁️' },
        { metric: 'totalClicks', labelKey: 'analytics_clicks', icon: '👆' },
        { metric: 'conversionRate', labelKey: 'analytics_conversion', icon: '📈', format: '百分比' },
        { metric: 'totalRevenue', labelKey: 'analytics_revenue', icon: '💰', format: 'USDT' },
        { metric: 'avgRating', labelKey: 'analytics_rating', icon: '⭐' },
        { metric: 'activeFollowers', labelKey: 'analytics_followers', icon: '👥' },
      ],
    },

    // ── Performance Charts ──
    {
      id: 'performance',
      charts: [
        {
          type: 'line',
          titleKey: 'analytics_revenue_trend',
          data: '日收益曲线 × 策略 (多条线, 可切换)',
        },
        {
          type: 'bar',
          titleKey: 'analytics_sales_by_market',
          data: '按市场/按策略 分组柱状图',
        },
        {
          type: 'funnel',
          titleKey: 'analytics_conversion_funnel',
          stages: ['曝光 → 点击 → 详情 → 加购 → 购买'],
        },
        {
          type: 'heatmap',
          titleKey: 'analytics_weekly_heatmap',
          data: '星期×小时 热力图 (什么时候用户最活跃)',
        },
      ],
    },

    // ── Strategy Comparison ──
    {
      id: 'strategyComparison',
      table: {
        columns: ['策略名', '曝光', '点击率', '转化率', '销量', '收益', '评分', '跟单数', '退款率'],
        sortable: true,
        filter: '可多选策略对比',
        export: '导出CSV',
      },
    },

    // ── Audience Insights ──
    {
      id: 'audience',
      sections: [
        { titleKey: 'analytics_audience_geo', type: 'map', desc: '用户地理分布' },
        { titleKey: 'analytics_audience_lang', type: 'pie', desc: '用户语言分布' },
        { titleKey: 'analytics_audience_risk', type: 'pie', desc: '用户风险偏好分布' },
        { titleKey: 'analytics_audience_exp', type: 'bar', desc: '用户经验水平' },
      ],
    },

    // ── AI Insights (L3 only) ──
    {
      id: 'aiInsights',
      gate: 'L3 only',
      cost: '1 USDT/次',
      cards: [
        '哪个因子导致了转化率下降?',
        '建议调价区间 (基于同品类对比)',
        '预测下个月收益 (ARIMA 预测)',
        '高价值用户画像 (RFM 分析)',
        '策略建议: 下一个该做什么市场?',
      ],
    },
  ],

  empty: {
    L1: {
      titleKey: 'analytics_locked_L1',
      bodyKey: 'analytics_locked_L1_body',
      progress: '当前销量: {count}/100, 解锁L2后开启数据分析',
      ctaKey: 'analytics_boost_sales',
    },
    noData: {
      titleKey: 'analytics_no_data',
      bodyKey: 'analytics_no_data_body',
    },
  },
};

// ═══════════════════════════════════════════════════════════
// 5. PAGE 4: REVENUE DASHBOARD (L2+ only)
// ═══════════════════════════════════════════════════════════

export const REVENUE_PAGE = {
  route: '/creator/revenue',
  gate: '需要L2+等级。',

  sections: [

    // ── Balance Card ──
    {
      id: 'balance',
      components: [
        { type: 'bigNumber', labelKey: 'revenue_available', value: '{balance} USDT', primary: true },
        { type: 'smallNumber', labelKey: 'revenue_pending', value: '{pending} USDT', descKey: 'revenue_pending_desc' },
        { type: 'smallNumber', labelKey: 'revenue_lifetime', value: '{lifetime} USDT' },
        { type: 'button', labelKey: 'revenue_withdraw', primary: true, route: '/creator/payout' },
      ],
    },

    // ── Revenue Breakdown ──
    {
      id: 'breakdown',
      charts: [
        {
          type: 'stacked-bar',
          titleKey: 'revenue_by_strategy',
          data: '按策略分组的收益堆叠图',
        },
        {
          type: 'pie',
          titleKey: 'revenue_breakdown',
          segments: ['策略销售', '信号订阅', '打赏收入'],
        },
      ],
    },

    // ── Transaction History ──
    {
      id: 'transactions',
      table: {
        columns: ['时间', '类型', '策略', '金额', '平台抽成', '到手', '状态'],
        types: ['sale (销售)', 'subscription (订阅)', 'tip (打赏)', 'withdraw (提现)', 'refund (退款)'],
        filter: '按类型/时间/策略筛选',
        export: '导出CSV 用于记账',
      },
      summary: '时间段总收益 / 平台抽成 / 净收入',
    },

    // ── Level Progress ──
    {
      id: 'levelProgress',
      current: '当前等级 (L1/L2/L3) 徽章',
      progress: '进度条: 已售 {current}/{target} 笔 → 下一级',
      benefitComparison: '卡片对比: L1 vs L2 vs L3 权益',
      perks: {
        L1: ['30%平台抽成', '🥉铜徽章', '基础曝光'],
        L2: ['20%平台抽成', '🥈银徽章', '优先曝光', '数据分析', '收益看板'],
        L3: ['10%平台抽成', '🥇金徽章', '首页推荐', 'AI洞察', '专属客服', '自定义徽章'],
      },
    },
  ],

  empty: {
    L1: {
      titleKey: 'revenue_locked_title',
      bodyKey: 'revenue_locked_body',
      progressKey: 'revenue_locked_progress',
    },
  },
};

// ═══════════════════════════════════════════════════════════
// 6. PAGE 5: CREATOR PROFILE & SETTINGS
// ═══════════════════════════════════════════════════════════

export const CREATOR_PROFILE_PAGE = {
  route: '/creator/profile',
  sections: [

    // ── Public Profile Preview ──
    {
      id: 'publicProfile',
      description: '用户市场中看到的样子',
      components: {
        avatar: '头像 + 封面图',
        name: '创作者名称 (可编辑)',
        bio: '简介 (max 120字)',
        level: '等级徽章 (🥇🥈🥉) + 3个信任元素徽章',
        stats: '策略数 | 总销量 | 跟单数 | ⭐评分',
        featured: '置顶展示策略 (最多3个)',
      },
    },

    // ── Trust Badges ──
    {
      id: 'trustBadges',
      description: '信任元素管理 (见R228 CreatorTrustSystem)',
      badges: [
        { type: 'level', nameKey: 'badge_level_L1', icon: '🥉', unlocked: true },
        { type: 'level', nameKey: 'badge_level_L2', icon: '🥈', unlocked: false },
        { type: 'level', nameKey: 'badge_level_L3', icon: '🥇', unlocked: false },
        { type: 'special', nameKey: 'badge_verified_backtest', icon: '📊', requirement: '回测结果通过验证' },
        { type: 'special', nameKey: 'badge_low_refund', icon: '🛡️', requirement: '退款率<5%' },
        { type: 'special', nameKey: 'badge_high_rating', icon: '⭐', requirement: '评分≥4.5' },
        { type: 'special', nameKey: 'badge_consistent', icon: '📅', requirement: '连续3月有销售' },
        { type: 'special', nameKey: 'badge_whale', icon: '🐋', requirement: '单策略销售额≥1000 USDT' },
      ],
    },

    // ── Payout Settings ──
    {
      id: 'payout',
      route: '/creator/payout',
      walletBalance: '{balance} USDT (可提现)',
      pendingBalance: '{pending} USDT (T+3 结算中)',
      withdrawForm: {
        amount: '输入提现金额 (USDT)',
        network: '选择网络 (TRC-20 / ERC-20)',
        address: '输入/粘贴钱包地址',
        fee: '提现手续费 0.1%, 最低 2 USDT',
        limits: '单笔≤100,000 USDT, 日累计≤1,000,000 USDT',
        submit: { labelKey: 'payout_submit', confirmation: '确认提现信息' },
        history: '提现记录列表 (时间/金额/状态/交易哈希)',
      },
      settlementRules: {
        schedule: 'T+3 自动结算 (交易完成后第3天到账)',
        minimumWithdraw: '最低提现 10 USDT',
        holdPeriod: '退款期内 (30天) 的金额暂不可提',
      },
    },

    // ── Notification Settings (Creator-specific) ──
    {
      id: 'creatorNotifications',
      toggles: [
        { key: 'notify_new_sale', labelKey: 'creator_notif_sale', default: true },
        { key: 'notify_new_review', labelKey: 'creator_notif_review', default: true },
        { key: 'notify_level_up', labelKey: 'creator_notif_level', default: true },
        { key: 'notify_market_insight', labelKey: 'creator_notif_insight', default: false },
        { key: 'notify_weekly_report', labelKey: 'creator_notif_weekly', default: true },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════
// 7. GLOBAL STATES (all pages)
// ═══════════════════════════════════════════════════════════

export const STUDIO_STATES = {
  loading: {
    skeleton: 'Sidebar: 灰色骨架 + Content: 卡片骨架 6个',
    spinner: '全局loading遮罩 (仅首次加载)',
  },
  empty: {
    strategies: '还没有策略 → 上传第一个',
    analytics: 'L1升级引导 或 "数据不足" 提示',
    revenue: 'L1升级引导 或 "暂无收益" 提示',
  },
  error: {
    generic: '❌ 加载失败 → 重试按钮',
    network: '📡 网络错误 → 重试 + 离线提示',
    permission: '🔒 权限不足 → 升级等级引导',
    validation: '⚠️ 表单验证错误 → 字段红色高亮 + 错误提示',
  },
  edge: {
    rateLimited: '⏳ 操作太频繁, 请{x}秒后重试',
    concurrent: '⚠️ 已有草稿正在编辑, 是否覆盖?',
    unsaved: '⚠️ 有未保存的更改, 确定离开吗?',
    deletedStrategy: '该策略已删除/下架 → 404友好页面',
    maxStrategies: 'L1最多10个策略, 升级L2可上传30个',
  },
};

// ═══════════════════════════════════════════════════════════
// 8. RESPONSIVE & ACCESSIBILITY
// ═══════════════════════════════════════════════════════════

export const STUDIO_RESPONSIVE = {
  desktop: 'Sidebar (240px) + Content (fill). 策略网格3列。编辑器左边编辑器+右边预览。',
  tablet: 'Sidebar折叠为Icon栏 (60px)。策略网格2列。编辑器上下布局。',
  mobile: 'Sidebar变成Bottom Tab。策略网格1列。编辑器单页面, 无预览。',

  a11y: {
    keyboard: 'Tab焦点顺序: Sidebar → 搜索 → 内容 → 操作按钮',
    aria: '所有按钮/输入有aria-label, 图标有aria-hidden=true + 文本替代',
    colorBlind: '状态不单靠颜色: 绿色✓+文字 "Published", 黄色⏳+文字 "Reviewing"',
    reduceMotion: '所有动画在 prefers-reduced-motion 时禁用',
    screenReader: '策略卡片: "策略{name}, 状态{status}, 销量{sales}, 评分{rating}"',
  },
};

// ═══════════════════════════════════════════════════════════
// 9. IMPLEMENTATION FILE MAP
// ═══════════════════════════════════════════════════════════

export const IMPLEMENTATION_MAP = {
  shell: 'src/pages/creator/CreatorStudio.tsx',
  sidebar: 'src/pages/creator/components/CreatorSidebar.tsx',
  pages: {
    overview: 'src/pages/creator/Overview.tsx',
    strategyManager: 'src/pages/creator/StrategyManager.tsx',
    strategyEditor: 'src/pages/creator/StrategyEditor.tsx',
    analytics: 'src/pages/creator/Analytics.tsx',
    revenue: 'src/pages/creator/Revenue.tsx',
    profile: 'src/pages/creator/Profile.tsx',
    payout: 'src/pages/creator/Payout.tsx',
  },
  modals: {
    upload: 'src/pages/creator/modals/UploadStrategyModal.tsx',
    delete: 'src/pages/creator/modals/DeleteConfirmModal.tsx',
    withdraw: 'src/pages/creator/modals/WithdrawModal.tsx',
  },
  ipc: {
    'creator:strategy:list': 'Get my strategies',
    'creator:strategy:create': 'Create new strategy',
    'creator:strategy:update': 'Update strategy',
    'creator:strategy:delete': 'Soft-delete strategy',
    'creator:strategy:toggle': 'Publish/unpublish strategy',
    'creator:analytics:get': 'Get analytics data',
    'creator:revenue:get': 'Get revenue data',
    'creator:payout:history': 'Get payout history',
    'creator:profile:get': 'Get profile',
    'creator:profile:update': 'Update profile',
  },
  stores: {
    creatorStore: 'src/stores/creatorStore.ts (zustand)',
    uploadDraftStore: 'src/stores/uploadDraftStore.ts (zustand + IndexedDB auto-save)',
  },
};
