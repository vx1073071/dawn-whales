// ══ R266 QClaw Task 1: 指标AI解读文案 (3h) ══
// P1-02: 指标组合AI解读 — 不是"MACD金叉"而是"MACD+RSI+布林带一起在说什么"
// 交付: AI解读面板全部文案结构——摘要/技术/风险/建议/置信度/历史参照/空状态

// ═══════════════════════════════════════
// TYPE: AI解读输出结构
// ═══════════════════════════════════════

export interface AIInterpretationSections {
  // 固定面板标签
  panel: {
    title: string;              // "AI指标解读"
    subtitle: string;           // "Whaley 综合{indicatorCount}个指标分析"
    analyzing: string;          // 分析中的loading文案
    analyzingDetail: string;    // "Whaley正在: 检查MACD→比对RSI→验证布林带→交叉确认..."
    costBanner: string;         // "1 USDT/次 · 静默扣款 · 失败不收费"
    retry: string;              // "重新分析"
    share: string;              // "分享分析"
    timestamp: string;          // "分析于 {time}"
    dataSource: string;         // "数据来源: {broker} 实时行情"
  };

  // 摘要段 — 第一眼就看到
  summary: {
    title: string;              // "一句话结论"
    template: string;           // "{状态} — {一句话}"
    // Example: "偏多看多 — MACD金叉+RSI未超买+布林带收窄待突破"
    verdictLabels: {            // 综合判断标签
      strongBuy: string;       // "强烈看多"
      buy: string;             // "偏多看多"
      neutral: string;         // "方向待定"
      sell: string;            // "偏空看空"
      strongSell: string;      // "强烈看空"
    };
  };

  // 技术面 — 每个指标说了什么
  technical: {
    title: string;              // "各指标在说什么"
    perIndicator: {
      signalLabel: string;     // "信号"
      valueLabel: string;      // "数值"
      statusLabel: string;     // "状态"
    };
    statusDescriptions: Record<string, string>; // 状态人话对照表
    agreementLabel: string;    // "指标一致性"
    agreementHigh: string;     // "{pct}%的指标指向同一方向 — 高置信度"
    agreementMixed: string;    // "{bullCount}个看涨 {bearCount}个看跌 — 信号分歧，谨慎"
    agreementLow: string;      // "指标信号混乱 — 此时任何单指标都不可靠"
  };

  // 风险段 — 有什么可能出错
  risk: {
    title: string;              // "Whaley的风险提醒"
    vignette: string;           // "AI不是预言机 — 以下是你需要知道的风险"
    traps: {                    // 每个陷阱一行
      title: string;            // "震荡市陷阱" / "滞后信号" / "假突破"
      body: string;             // 人话说明
    }[];
    disclaimer: string;         // "以上为AI分析，不构成投资建议。你为自己的每一笔交易负责。"
  };

  // 建议段 — 给参考不给命令
  recommendation: {
    title: string;              // "参考建议"
    notice: string;             // "Whaley不替你做决定 — 但它帮你攒够了信息"
    confidenceLabel: string;   // "置信度"
    confidenceDescription: string; // "{pct}% — 基于{signalCount}个信号的交叉验证"
    targetPrice: string;        // "参考目标价"
    stopLossHint: string;       // "止损参考: {price} (跌破上一个支撑位)"
    actionTemplate: string;     // "根据你的策略——当前信号建议{action}"
    scenarioNote: string;       // "在{scenario}场景下适用此建议"
  };

  // 历史参照段 — "上次出现类似信号的时候..."
  historical: {
    title: string;              // "历史上类似的情况"
    noMatch: string;            // "在过去{lookback}根K线内未找到足够相似的指标组合。Whaley仍在学习更多模式。"
    found: string;              // "在过去{lookback}根K线内找到{count}次类似信号组合"
    winRate: string;            // "其中{winCount}次价格往预测方向移动 — 历史胜率{rate}%"
    bestCase: string;           // "最好的一次: +{pct}% ({days}天)"
    worstCase: string;          // "最差的一次: {pct}% ({days}天)"
    disclaimer: string;         // "⚠️ 历史胜率≠未来保证。市场可能有你不知道的新信息。"
  };
}

// ═══════════════════════════════════════
// 完整文案实现
// ═══════════════════════════════════════

export const AI_INTERPRETATION_COPY: AIInterpretationSections = {

  panel: {
    title: 'AI指标解读',
    subtitle: 'Whaley 综合 {indicatorCount} 个指标交叉验证',
    analyzing: 'AI正在综合分析…',
    analyzingDetail: '正在: 比对MACD信号 → 验证RSI超买超卖 → 检查布林带位置 → 交叉确认 → 生成结论',
    costBanner: '1 USDT/次 · 静默扣款 · 失败不收费',
    retry: '重新分析',
    share: '分享',
    timestamp: '分析于 {time}',
    dataSource: '数据来源: 实时行情',
  },

  summary: {
    title: '一句话结论',
    template: '{verdict} — {oneliner}',
    verdictLabels: {
      strongBuy: '强烈看多',
      buy: '偏多看多',
      neutral: '方向待定',
      sell: '偏空看空',
      strongSell: '强烈看空',
    },
  },

  technical: {
    title: '各指标在说什么',
    perIndicator: {
      signalLabel: '信号',
      valueLabel: '数值',
      statusLabel: '状态',
    },
    statusDescriptions: {
      overbought: '超买',
      oversold: '超卖',
      bullish: '看涨',
      bearish: '看跌',
      neutral: '中性',
      goldenCross: '金叉↑',
      deadCross: '死叉↓',
      aboveUpper: '突破上轨',
      belowLower: '跌破下轨',
      strongTrend: '强趋势',
      weakTrend: '弱趋势',
      divergence: '背离⚠️',
    },
    agreementLabel: '指标一致性',
    agreementHigh: '{pct}% 的指标指向同一方向 — 高置信度',
    agreementMixed: '{bullCount}个看涨 / {bearCount}个看跌 — 信号分歧，谨慎',
    agreementLow: '指标信号分散 — 此时任何单个指标都不可靠',
  },

  risk: {
    title: 'Whaley 的风险提醒',
    vignette: '以下是你需要知道的风险——AI不是预言机',
    traps: [
      {
        title: '震荡市陷阱',
        body: 'ADX<20说明当前是震荡市。震荡市中趋势类指标(MACD/均线)的"买入信号"极大概率是假信号。',
      },
      {
        title: '滞后信号',
        body: 'MACD和均线都是滞后指标——它们告诉你"已经发生什么"，不是"即将发生什么"。所有信号都来自过去的价格。',
      },
      {
        title: '单指标噪音',
        body: '如果只有一个指标在"报警"而其他沉默——这个信号大概率是噪声。真正的变盘通常3个以上指标同时确认。',
      },
      {
        title: '历史不代表未来',
        body: '历史参照中的胜率是"过去发生了多少次"——不是"这次发生的概率"。市场每天都有新信息。',
      },
    ],
    disclaimer: '以上为AI分析，不构成投资建议。你为自己的每一笔交易负责。',
  },

  recommendation: {
    title: '参考建议',
    notice: 'Whaley不替你决定 —— 但它帮你攒够了信息',
    confidenceLabel: '置信度',
    confidenceDescription: '{pct}% — 基于 {signalCount} 个信号的交叉验证',
    targetPrice: '参考目标价',
    stopLossHint: '止损参考: {price}（跌破上一个支撑位）',
    actionTemplate: '根据你的策略——当前信号建议 {action}',
    scenarioNote: '在 {scenario} 场景下适用此建议',
  },

  historical: {
    title: '历史上类似的情况',
    noMatch: '在过去 {lookback} 根K线内未找到足够相似的指标组合。Whaley仍在学习更多模式。',
    found: '在过去 {lookback} 根K线内找到 {count} 次类似信号组合',
    winRate: '其中 {winCount} 次价格往预测方向移动 —— 历史胜率 {rate}%',
    bestCase: '最好的一次: +{pct}%（{days}天）',
    worstCase: '最差的一次: -{pct}%（{days}天）',
    disclaimer: '⚠️ 历史胜率 ≠ 未来保证。市场可能有你不知道的新信息。',
  },
};

// ═══════════════════════════════════════
// 指标组合常见模式文案
// ═══════════════════════════════════════

export interface IndicatorComboPattern {
  id: string;
  name: string;           // 模式名 ≤8字
  indicators: string[];   // 涉及指标
  aiTemplate: string;     // AI原话模板
  impliedAction: string;  // 隐含动作
  confidence: 'high' | 'medium' | 'low';
}

export const COMBO_PATTERNS: IndicatorComboPattern[] = [
  {
    id: 'golden-cross-confirmed',
    name: '金叉三重确认',
    indicators: ['MACD', 'MA', 'RSI'],
    aiTemplate: 'MACD在零轴上金叉 + MA5上穿MA20 + RSI在50-65之间未超买 → "趋势启动信号，非追高"',
    impliedAction: '考虑在回调时入场，不追当前价',
    confidence: 'high',
  },
  {
    id: 'bollinger-squeeze-break',
    name: '布林收窄变盘',
    indicators: ['BOLL', 'ADX', '%B'],
    aiTemplate: '布林带收窄+ADX<20+%B突破0.5 → "暴风雨前最后的宁静——变盘在即，方向看突破方向"',
    impliedAction: '等待方向确认后再动作',
    confidence: 'medium',
  },
  {
    id: 'oversold-bounce',
    name: '超卖反弹',
    indicators: ['KDJ', 'RSI', 'BOLL'],
    aiTemplate: 'K<20且D<20+RSI<30+价格在下轨 → "恐慌超卖——但超卖≠立刻反弹，等K线确认再动"',
    impliedAction: '观察等待K线确认再入场',
    confidence: 'medium',
  },
  {
    id: 'divergence-warning',
    name: '背离预警',
    indicators: ['MACD', 'RSI', '价格'],
    aiTemplate: '价格创新高但MACD创新低+RSI未新高 → "上涨动力正在衰竭——持仓者应考虑减仓，空仓者不要追"',
    impliedAction: '减仓观望',
    confidence: 'high',
  },
  {
    id: 'volume-confirmed-trend',
    name: '量价齐升',
    indicators: ['CMF', 'MA', 'MACD'],
    aiTemplate: 'CMF持续走强+MA多头排列+MACD零轴上 → "钱和技术都在说同一个故事——趋势有资金支撑"',
    impliedAction: '跟随趋势，设移动止损',
    confidence: 'high',
  },
  {
    id: 'supertrend-flip',
    name: '趋势翻转',
    indicators: ['Supertrend', 'ADX', 'MA20'],
    aiTemplate: 'Supertrend翻绿+ADX>25+价格在MA20上方 → "趋势从跌转涨——但不追第一次翻绿，等回调确认"',
    impliedAction: '等回调到Supertrend附近再入场',
    confidence: 'medium',
  },
];

// ═══════════════════════════════════════
// 面板空状态/异常文案
// ═══════════════════════════════════════

export const AI_EMPTY_STATES = {
  noIndicators: {
    title: '还没加载指标',
    body: '先加载至少2个指标——Whaley需要指标才能分析。按1-5加载模板或按I打开指标面板。',
    action: '加载模板',
  },
  insufficientData: {
    title: 'K线数据不足',
    body: '当前只有{count}根K线——至少需要{min}根才能做有意义的分析。切换更长的周期试试。',
    action: '切到日线',
  },
  allNeutral: {
    title: '所有指标都在"等等看"',
    body: '没有一个指标给出明确信号——这不是坏事。"什么都不做"本身就是一个决策。Whaley建议等待。',
    action: '设为提醒',
  },
  apiError: {
    title: '分析暂时不可用',
    body: 'AI服务暂时无响应。请稍后重试——不会扣费。',
    action: '重试',
  },
  rateLimited: {
    title: '请稍等片刻',
    body: '你刚刚做过一次分析。Whaley需要一小段冷却时间后再分析新的。',
    action: '知道了',
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getComboPattern(id: string): IndicatorComboPattern | undefined {
  return COMBO_PATTERNS.find(p => p.id === id);
}

export function getMatchedPatterns(indicatorIds: string[]): IndicatorComboPattern[] {
  const ids = new Set(indicatorIds.map(i => i.toLowerCase()));
  return COMBO_PATTERNS.filter(p =>
    p.indicators.some(pi => ids.has(pi.toLowerCase()))
  );
}

export default AI_INTERPRETATION_COPY;
