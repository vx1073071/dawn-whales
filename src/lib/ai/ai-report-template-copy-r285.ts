// ══ R285 QClaw Task 2: AI报告模板文案 (3h) ══
// JVS AI报告导出引擎 —— 一键生成专业分析报告，支持技术面/基本面/回测/异动/对比/周月总结
// 覆盖: 报告类型/模板结构/AI提示词/导出格式/报告卡片/调度文案/分享/存档
// 交付: TS常量 —— AIReportExportEngine + ReportExportUI 直接import

// ═══════════════════════════════════════
// SECTION 1: 报告类型选择
// ═══════════════════════════════════════

export const REPORT_TYPES = {
  technical: {
    id: 'technical',
    name: '技术面分析',
    icon: '📈',
    description: 'K线形态、指标信号、支撑阻力 —— AI一键解读当前技术面',
    suitableFor: '短线交易员、技术分析派',
    generationTime: '约30秒',
    price: '1 USDT/次',
  },
  fundamental: {
    id: 'fundamental',
    name: '基本面概要',
    icon: '🏢',
    description: '估值、营收、PE/PB、行业对比 —— 看透公司真面目',
    suitableFor: '价值投资者、中长线持有者',
    generationTime: '约45秒',
    price: '1 USDT/次',
  },
  backtest: {
    id: 'backtest',
    name: '回测解读',
    icon: '⏮️',
    description: '回测结果深度分析 —— 胜率/回撤/夏普比率/改进建议',
    suitableFor: '策略开发者、量化交易员',
    generationTime: '约60秒',
    price: '1.5 USDT/次',
  },
  anomaly: {
    id: 'anomaly',
    name: '异动分析',
    icon: '🚨',
    description: '突发价格异动 —— AI分析放量原因、资金动向、后续走势',
    suitableFor: '事件驱动交易员、消息面交易者',
    generationTime: '约20秒',
    price: '1 USDT/次',
  },
  comparison: {
    id: 'comparison',
    name: '多股对比',
    icon: '⚖️',
    description: '最多6只股票横向对比 —— 技术面+基本面+资金面全面PK',
    suitableFor: '选股决策、板块内横向比较',
    generationTime: '约90秒',
    price: '2 USDT/次',
  },
  weekly: {
    id: 'weekly',
    name: '周度复盘',
    icon: '📅',
    description: '一周行情总结 —— 你的持仓表现+市场大事+下周关注',
    suitableFor: '所有交易者，每周复盘习惯',
    generationTime: '约60秒',
    price: '1 USDT/次 (支持自动每周生成)',
  },
  monthly: {
    id: 'monthly',
    name: '月度总结',
    icon: '🗓️',
    description: '月度全面回顾 —— 策略表现/风险指标/下月展望',
    suitableFor: '中长线投资者、基金经理',
    generationTime: '约90秒',
    price: '1.5 USDT/次 (支持自动每月生成)',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 2: 报告模板结构
// ═══════════════════════════════════════

export const REPORT_TEMPLATES = {
  // 每个报告类型的默认章节结构
  technical: {
    sections: [
      { id: 'header', label: '报告头', required: true, hint: '股票名称、代码、报告时间' },
      { id: 'overview', label: '总览', required: true, hint: '一句话总结当前技术面状态' },
      { id: 'trend', label: '趋势分析', required: true, hint: '多周期趋势判断——短期/中期/长期' },
      { id: 'indicators', label: '指标信号', required: true, hint: '主要指标（MACD/RSI/布林/KDJ）当前信号解读' },
      { id: 'support_resistance', label: '支撑阻力', required: false, hint: '关键价位——前高前低/均线/筹码密集区' },
      { id: 'patterns', label: '形态识别', required: false, hint: 'K线形态/图表形态——头肩/W底/三角等' },
      { id: 'volume', label: '成交量分析', required: false, hint: '量价关系——放量/缩量/对倒嫌疑' },
      { id: 'multi_timeframe', label: '多周期共振', required: false, hint: '周线→日线→4H→1H 多周期方向一致性' },
      { id: 'risk_warning', label: '风险提示', required: true, hint: '当前需注意的风险因素和盲区' },
      { id: 'scenarios', label: '情景推演', required: false, hint: '乐观/中性/悲观三种情景的走势预估' },
      { id: 'footer', label: '免责声明', required: true, hint: '标准免责声明和法律信息' },
    ],
  },
  fundamental: {
    sections: [
      { id: 'header', label: '报告头', required: true },
      { id: 'overview', label: '公司概览', required: true, hint: '主营业务/行业地位/市值的简要介绍' },
      { id: 'valuation', label: '估值分析', required: true, hint: 'PE/PB/PS/EV-EBITDA 与历史/行业对比' },
      { id: 'financials', label: '财务健康', required: true, hint: '营收/利润/现金流/负债率趋势' },
      { id: 'growth', label: '成长性', required: false, hint: '营收增速/利润增速/研发投入' },
      { id: 'dividend', label: '股息分析', required: false, hint: '股息率/股息支付率/分红稳定性' },
      { id: 'peers', label: '同行对比', required: false, hint: '与同行业公司的关键指标对比' },
      { id: 'catalyst', label: '催化剂与风险', required: false, hint: '近期可能影响股价的事件' },
      { id: 'footer', label: '免责声明', required: true },
    ],
  },
  backtest: {
    sections: [
      { id: 'header', label: '报告头', required: true },
      { id: 'summary', label: '回测概览', required: true, hint: '策略名称/回测区间/关键指标一览' },
      { id: 'performance', label: '收益分析', required: true, hint: '总收益/年化收益/月度收益分布' },
      { id: 'risk', label: '风险评估', required: true, hint: '最大回撤/夏普比率/索提诺比率/VaR' },
      { id: 'trade_analysis', label: '交易分析', required: true, hint: '胜率/盈亏比/平均持仓时间/连续亏损' },
      { id: 'market_condition', label: '市场适应性', required: false, hint: '牛/熊/震荡市中的表现差异' },
      { id: 'optimization', label: '优化建议', required: true, hint: 'AI给出的参数优化和策略改进建议' },
      { id: 'overfit_check', label: '过拟合检查', required: false, hint: '样本外测试/蒙特卡洛/参数敏感性' },
      { id: 'footer', label: '免责声明', required: true },
    ],
  },
  anomaly: {
    sections: [
      { id: 'header', label: '报告头', required: true },
      { id: 'event', label: '异动描述', required: true, hint: '什么时间发生了什么样的异动' },
      { id: 'magnitude', label: '异动幅度', required: true, hint: '涨跌幅/成交量倍数/与历史对比的异常程度' },
      { id: 'cause', label: '可能原因', required: true, hint: 'AI搜索相关新闻/公告/事件——可能触发异动的原因' },
      { id: 'fund_flow', label: '资金动向', required: false, hint: '主力/散户/北向资金的异动期间流向' },
      { id: 'aftermath', label: '历史类似异动', required: false, hint: '过去一年中类似异动后的走势统计' },
      { id: 'outlook', label: '后市研判', required: true, hint: '基于历史数据和当前环境的后续走势判断' },
      { id: 'footer', label: '免责声明', required: true },
    ],
  },
  comparison: {
    sections: [
      { id: 'header', label: '报告头', required: true },
      { id: 'stocks', label: '对比标的', required: true, hint: '参与对比的股票列表和基本信息' },
      { id: 'performance', label: '收益对比', required: true, hint: '各股票的近期/中期/长期涨跌幅对比' },
      { id: 'technical', label: '技术面对比', required: true, hint: '各股票的技术面评分和排名' },
      { id: 'fundamental', label: '基本面对比', required: false, hint: '各股票的估值和财务指标对比' },
      { id: 'capital', label: '资金面对比', required: false, hint: '各股票的资金流向和机构持仓对比' },
      { id: 'ranking', label: '综合排名', required: true, hint: '加权评分后的综合排名和推荐' },
      { id: 'correlation', label: '相关性分析', required: false, hint: '股票之间的涨跌相关性' },
      { id: 'footer', label: '免责声明', required: true },
    ],
  },
  weekly: {
    sections: [
      { id: 'header', label: '报告头', required: true },
      { id: 'market_review', label: '市场回顾', required: true, hint: '本周大盘和板块表现总结' },
      { id: 'portfolio', label: '我的持仓', required: true, hint: '持仓股票本周表现和关键变化' },
      { id: 'signals', label: '本周信号', required: true, hint: '本周触发的买卖信号汇总' },
      { id: 'big_events', label: '本周大事', required: true, hint: '影响市场的重大新闻/政策/数据' },
      { id: 'lessons', label: '教训与反思', required: false, hint: '本周的交易做得好的和需要改进的地方' },
      { id: 'next_week', label: '下周关注', required: true, hint: '下周的财报/数据/事件日历和操作计划' },
      { id: 'footer', label: '免责声明', required: true },
    ],
  },
  monthly: {
    sections: [
      { id: 'header', label: '报告头', required: true },
      { id: 'summary', label: '月度概览', required: true, hint: '本月收益、关键指标、一句话总结' },
      { id: 'performance_detail', label: '收益明细', required: true, hint: '月度收益率/每笔交易盈亏/月度曲线' },
      { id: 'risk_metrics', label: '风险指标', required: true, hint: '最大回撤/夏普比率/波动率/仓位变化' },
      { id: 'strategy_review', label: '策略复盘', required: true, hint: '各策略在本月的表现和有效性评估' },
      { id: 'sector_rotation', label: '板块轮动', required: false, hint: '本月板块轮动趋势和你的持仓适配度' },
      { id: 'next_month', label: '下月展望', required: true, hint: '市场前瞻/策略调整建议/关键日期提醒' },
      { id: 'footer', label: '免责声明', required: true },
    ],
  },
} as const;

// ═══════════════════════════════════════
// SECTION 3: AI提示词模板 (Prompt Templates)
// ═══════════════════════════════════════

export const AI_PROMPT_TEMPLATES = {
  technical: {
    systemPrompt: '你是一位拥有20年经验的量化技术分析师。你的分析基于客观数据和概率,不提供投资建议,只提供基于统计的分析。用简洁的中文,避免行话,让普通投资者也能看懂。',
    userPromptTemplate: `请分析 {stockName} ({code}) 在当前技术面的状态。

当前数据:
- 最新价: {currentPrice}
- 周期: {timeframe}
- 涨跌幅: {changePercent}%

指标状态:
{indicatorStatus}

请按以下结构输出分析:
1. 总览: 一句话(<20字)总结当前技术面状态
2. 趋势: 短期/中期/长期的趋势方向和强度
3. 指标: 主要指标的当前信号和解读(≤3个核心指标)
4. 关键价位: 上方阻力和下方支撑(≤4个)
5. 风险: 当前最需要注意的风险点(≤2个)
6. 情景: 三种情景(继续/反转/震荡)的概率估计

请用数据说话,不要模棱两可。每个判断都要有具体的指标读数作为依据。`,
  },
  fundamental: {
    systemPrompt: '你是一位资深的价值投资分析师,熟悉全球主要市场的估值体系。你的分析基于公开财务数据,客观、克制,不制造恐慌也不盲目乐观。用数据说话。',
    userPromptTemplate: `请分析 {stockName} ({code}) 的基本面状况。

当前数据:
- 市值: {marketCap}
- PE(TTM): {pe}, 行业均值: {peIndustry}
- PB: {pb}, 行业均值: {pbIndustry}
- ROE: {roe}%
- 营收增速(YoY): {revenueGrowth}%
- 负债率: {debtRatio}%

请按以下结构输出:
1. 公司概览: 一句话介绍这家公司
2. 估值: PE/PB在历史和行业中的位置——是被低估、合理、还是高估
3. 财务: 营收/利润/现金流的趋势健康度
4. 亮点: 1-2个值得关注的优势
5. 风险: 1-2个需要警惕的隐患
6. 总结: "低估/合理/高估"的判断及理由`,
  },
  backtest: {
    systemPrompt: '你是一位量化策略分析师,擅长解读回测结果并给出建设性的优化建议。你了解过拟合的陷阱,在建议优化时会强调稳健性。',
    userPromptTemplate: `请分析以下回测结果并给出优化建议。

策略: {strategyName}
回测区间: {startDate} ~ {endDate}
关键指标:
- 总收益: {totalReturn}% (年化: {annualReturn}%)
- 最大回撤: {maxDrawdown}%
- 夏普比率: {sharpe}
- 胜率: {winRate}%
- 盈亏比: {profitLossRatio}
- 总交易笔数: {totalTrades}笔

请按以下结构输出:
1. 概览: 一句话评价这个策略的表现
2. 收益: 收益是否跑赢基准?收益稳定性如何?
3. 风险: 最大回撤是否可接受?是否需要改进风控?
4. 交易: 胜率和盈亏比是否合理?交易频率是否过高?
5. 市场环境: 策略在牛市/熊市/震荡市中的表现差异
6. 优化建议: 2-3个具体的、可执行的参数优化建议(含调整后的预期效果)
7. 过拟合警告: 如果样本量不足或参数过多,警告过拟合风险`,
  },
  anomaly: {
    systemPrompt: '你是一位市场异动分析专家,能快速关联新闻、数据、资金流来解读突然的价格异动。你了解"异动不等于方向"——放量下跌和放量上涨需要不同的解读框架。',
    userPromptTemplate: `{stockName} ({code}) 发生了异动,请分析。

异动数据:
- 时间: {time}
- 涨幅/跌幅: {changePercent}%
- 当前价: {currentPrice}
- 成交量: {volume}(是20日均量的 {volumeMultiple}倍)
- 同时段大盘: {marketChange}%

近期相关消息:
{recentNews}

请按以下结构输出:
1. 异动描述: 什么时间发生了什么 (≤20字)
2. 幅度评估: 和该股历史比较,这次异动有多大
3. 可能原因: 最可能的原因(排序,最多3个,标注置信度)
4. 资金: 主力/散户资金流向(如有数据)
5. 历史参照: 过去一年中类似异动后1天/3天/5天的平均走势
6. 后市: 当前判断——是"消化中"、"值得追"还是"该减仓"(附理由)`,
  },
  comparison: {
    systemPrompt: '你是一位多资产对比分析专家,擅长跨股票/跨行业的横向比较。你使用加权评分体系,给每只股票打分排名。你的分析客观,不偏好某一个股。',
    userPromptTemplate: `请对比以下股票的综合表现: {stocksList}

对比维度: {dimensions}

请按以下结构输出:
1. 标的概览: 列表展示各股票的基本信息
2. 收益对比: 近期/中期/长期的涨跌幅排名
3. 技术面打分: 每只股票的技术面评分(1-10分)和理由
4. 基本面打分: 每只股票的基本面评分(1-10分)和理由
5. 综合排名: 加权总分的排名(技术面权重{techWeight}%,基本面权重{fundWeight}%)
6. 推荐: 排名第一的股票的分析,和排名最后股票的风险提示`,
  },
  weekly: {
    systemPrompt: '你是用户的专属交易复盘助手,像一面诚实的镜子——客观回顾本周的交易,总结得失,展望下周。你的语气温暖但直接,不拐弯抹角。',
    userPromptTemplate: `请帮用户复盘本周的交易和持仓表现。

本周数据:
- 持仓股票: {holdingsSummary}
- 本周收益: {weeklyReturn}%
- 本周交易: {tradeCount}笔 ({winCount}盈 {lossCount}亏)
- 大盘: {marketReturn}%
- 本周大事: {majorEvents}

请按以下结构输出:
1. 市场回顾: 本周大盘和板块的一句话总结
2. 持仓表现: 每只持仓的表现和关键变化(≤2句/只)
3. 交易复盘: 做得好的和需要改进的(各1-2点)
4. 本周教训: 值得记住的一件事(如果有)
5. 下周关注: 财报日历/经济数据/重要的日子`,
  },
  monthly: {
    systemPrompt: '你是一位专业的月度策略复盘分析师,善于从月度数据中发现规律和偏差。你注重数据的完整性和趋势性,帮助用户建立长期积累的思维。',
    userPromptTemplate: `请帮用户复盘本月的全面表现。

本月数据:
- 月度收益: {monthlyReturn}%
- 年至今收益: {ytdReturn}%
- 总交易: {totalTrades}笔,胜率{winRate}%
- 最大回撤: {maxDrawdown}%
- 夏普比率: {sharpe}
- 仓位变化: 月初{startPosition}% → 月末{endPosition}%

请按以下结构输出:
1. 月度概览: 一句话总结本月(≤20字)
2. 收益分析: 收益来源(哪笔交易贡献最大/哪笔拖累最大)
3. 风险管理: 仓位/回撤/波动率是否在合理范围
4. 策略表现: 各策略本月效果对比
5. 进步vs退步: 和上月对比,哪些方面进步了,哪些需要关注
6. 下月展望: 基于当前市场的下月策略调整建议`,
  },
} as const;

// ═══════════════════════════════════════
// SECTION 4: 报告操作UI文案
// ═══════════════════════════════════════

export const REPORT_ACTIONS = {
  // 生成前
  generationPanel: {
    title: '生成AI报告',
    selectType: '选择报告类型',
    selectStock: '选择股票 (可选,留空分析当前图表)',
    selectTimeframe: '报告周期',
    customizeSections: '自定义章节',
    includeCharts: '包含图表截图',
    generationButton: '生成报告 · {price} USDT',
    generatingState: 'AI正在分析... ({elapsed}秒)',
    generationComplete: '报告生成完成！',
  },
  // 报告查看
  reportViewer: {
    title: '{reportType} - {stockName}',
    generatedAt: '生成时间: {datetime}',
    aiDisclaimer: '🤖 本报告由QUANT MOO AI自动生成,仅供参考,不构成投资建议。AI分析存在局限性,请结合自己的判断使用。',
    tableOfContents: '目录',
    expandAll: '展开全部',
    collapseAll: '收起全部',
  },
  // 导出选项
  export: {
    title: '导出报告',
    formatPDF: 'PDF 文档',
    formatPDFDesc: '专业排版,适合打印和存档',
    formatMD: 'Markdown',
    formatMDDesc: '纯文本,适合粘贴到笔记软件',
    formatHTML: 'HTML 网页',
    formatHTMLDesc: '可分享的链接,在浏览器中查看',
    formatImage: '长图',
    formatImageDesc: '适合手机分享、发朋友圈',
    exportButton: '导出为 {format}',
    exportingState: '正在导出...',
    exportComplete: '导出完成！',
    openFile: '打开文件',
    copyLink: '复制分享链接',
  },
  // 定时生成
  schedule: {
    title: '定时自动生成',
    frequency: {
      daily: '每日',
      weekly: '每周 (周一早8点)',
      biweekly: '每两周',
      monthly: '每月 (1号早8点)',
    },
    deliveryMethod: {
      inApp: '应用内通知',
      email: '邮件发送',
      push: '推送通知',
    },
    saveButton: '保存定时设置',
    savedMessage: '已保存！下次报告将于 {nextTime} 自动生成。',
    manageButton: '管理定时报告',
    cancelButton: '取消定时',
  },
  // 历史报告
  history: {
    title: '我的报告',
    empty: '还没有生成过报告。生成你的第一份AI分析报告 →',
    searchPlaceholder: '搜索报告——股票名、报告类型...',
    sortByDate: '按日期',
    sortByType: '按类型',
    sortByStock: '按股票',
    deleteConfirm: '确认删除这份报告? 删除后不可恢复。',
    deleteSuccess: '报告已删除。',
    filterByType: '筛选类型',
    filterByStock: '筛选股票',
    selectAll: '全选',
    deleteSelected: '删除选中 ({count})',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 5: 报告卡片/列表文案
// ═══════════════════════════════════════

export const REPORT_CARD = {
  // 报告列表卡片
  labels: {
    generatedTime: '生成于 {time}',
    reportFor: '标的: {name}',
    wordCount: '{count}字',
    readTime: '阅读约{minutes}分钟',
    unread: '未读',
  },
  actions: {
    view: '查看',
    export: '导出',
    share: '分享',
    delete: '删除',
    regenerate: '重新生成',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 6: 分享文案
// ═══════════════════════════════════════

export const REPORT_SHARING = {
  // 分享到社区
  shareToCommunity: {
    title: '分享到社区',
    body: '将这份报告分享到QUANT MOO社区,和其他交易者交流看法。',
    addComment: '说点什么... (可选)',
    includeChart: '附上图表截图',
    anonymous: '匿名分享',
    submit: '发布',
    success: '报告已分享到社区！',
    link: '查看帖子 →',
  },
  // 分享生成文案
  shareTexts: {
    technical: '我刚用QUANT MOO生成了 {stockName} 的技术分析报告 —— {oneLiner}。来看看AI怎么看？',
    fundamental: '{stockName} 的基本面分析报告 —— 当前估值是{valuation}。快来一起研究！',
    backtest: '策略"{strategyName}"的回测深度解读出来了 —— 年化{annualReturn}%,最大回撤{maxDrawdown}%。来看看AI的优化建议！',
    weekly: '本周复盘报告已出 —— {weeklyReturn}%。来看看AI怎么分析这周的操作。',
    default: '刚用QUANT MOO生成了 {stockName} 的{reportType}报告,来看看AI的分析！',
  },
} as const;

// ═══════════════════════════════════════
// SECTION 7: 通用文案
// ═══════════════════════════════════════

export const REPORT_COMMON = {
  disclaimer: '⚠️ 本报告由AI自动生成,仅供参考,不构成任何投资建议。投资有风险,入市需谨慎。AI分析基于历史数据和统计模型,不能预测未来走势。请结合自身情况独立判断。',
  privacy: '🔒 你的报告数据仅你自己可见。定时报告发送到你的应用内通知和邮箱,不会公开。',
  cost: {
    label: '费用: {price} USDT/次 (从钱包余额扣除,生成失败全额退款)',
    generationFailed: '生成失败 —— 费用已退回你的钱包。',
  },
  accessibility: {
    // 无障碍/备用格式
    plainText: '纯文本版 (适合屏幕阅读器)',
    highContrast: '高对比度版',
    largeFont: '大字版',
  },
} as const;

// ═══════════════════════════════════════
// 全部导出
// ═══════════════════════════════════════

export const AI_REPORT_COPY = {
  types: REPORT_TYPES,
  templates: REPORT_TEMPLATES,
  prompts: AI_PROMPT_TEMPLATES,
  actions: REPORT_ACTIONS,
  card: REPORT_CARD,
  sharing: REPORT_SHARING,
  common: REPORT_COMMON,
} as const;

export default AI_REPORT_COPY;
