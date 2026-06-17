// ══ R267 QClaw Task 2: 画线→策略文案 (2h) ══
// P2-01: 画线→策略 — 把用户画的线变成自动化交易策略
// 核心: 画了一根线 → 右键"转成策略" → 选条件/方向 → 策略生成
// 交付: 5步向导文案 + 策略命名模板 + 条件选择 + 完成确认

// ═══════════════════════════════════════
// TYPE: 向导
// ═══════════════════════════════════════

export interface DrawingToStrategyWizard {
  trigger: {                          // 右键菜单触发项
    label: string;                    // "转成策略"
    tooltip: string;                  // "用这根画线自动生成交易策略"
    disabled: string;                 // 不可用时的提示
  };
  steps: WizardStep[];
  success: WizardSuccess;
  validation: WizardValidation;
}

interface WizardStep {
  step: number;
  title: string;                      // "选择触发条件"
  subtitle: string;
  description: string;
  options?: WizardOption[];
  labels?: Record<string, string>;
  inputHint?: string;
}

interface WizardOption {
  id: string;
  label: string;
  description: string;                // 人话解释
  drawingMatch: string;               // 什么类型的画线适合这个选项
}

interface WizardSuccess {
  title: string;
  body: string;
  actions: {
    backtest: string;
    deploy: string;
    edit: string;
    close: string;
  };
}

interface WizardValidation {
  tooShort: string;                   // 线太短
  noDirection: string;                // 无法判断方向
  needsMoreLines: string;             // 需要更多画线
  frequencyLimit: string;             // 频繁转换提示
}

// ═══════════════════════════════════════
// 完整向导文案
// ═══════════════════════════════════════

export const DRAWING_TO_STRATEGY_WIZARD: DrawingToStrategyWizard = {

  trigger: {
    label: '🎯 转成策略',
    tooltip: '用这根线自动生成交易策略——价格到达画线时执行买卖',
    disabled: '需要先选中一根画线才能转成策略',
  },

  steps: [
    // Step 1: 选择条件 — "价格碰到这根线时要做什么"
    {
      step: 1,
      title: '价格碰到这根线时',
      subtitle: '选择触发条件',
      description: '你画的这根{drawingType}线是关键的支撑/阻力位。当价格碰到它时——你想做什么？',
      options: [
        {
          id: 'break-above',
          label: '向上突破',
          description: '价格从下方突破这根线——"阻力被打破，可能继续涨"',
          drawingMatch: '阻力线 / 下降趋势线 / 斐波那契阻力位',
        },
        {
          id: 'break-below',
          label: '向下突破',
          description: '价格从上方跌破这根线——"支撑破了，可能继续跌"',
          drawingMatch: '支撑线 / 上升趋势线 / 斐波那契支撑位',
        },
        {
          id: 'bounce-from',
          label: '触碰反弹',
          description: '价格碰到这根线后弹回去——"支撑/阻力有效"',
          drawingMatch: '支撑线 / 阻力线 / 通道线 / 斐波那契水平',
        },
        {
          id: 'approach-from',
          label: '靠近这根线',
          description: '价格靠近这根线（在{threshold}%范围内）——提前埋伏',
          drawingMatch: '所有类型的画线',
        },
      ],
      inputHint: '',
    },

    // Step 2: 选择方向 — 买还是卖
    {
      step: 2,
      title: '你想在触发时',
      subtitle: '选择买卖方向',
      description: '当"{conditionName}"条件被触发时——你想买还是卖？',
      options: [
        {
          id: 'buy',
          label: '买入 (做多)',
          description: '触发条件时买入——你预期价格会涨',
          drawingMatch: '',
        },
        {
          id: 'sell',
          label: '卖出 (做空/平仓)',
          description: '触发条件时卖出——你预期价格会跌，或需要止盈/止损',
          drawingMatch: '',
        },
      ],
      inputHint: '',
    },

    // Step 3: 设止损止盈
    {
      step: 3,
      title: '止损和止盈',
      subtitle: '设置保护线和盈利目标',
      description: '策略需要知道"错了怎么办(止损)"和"对了赚多少(止盈)"。Whaley会根据你的画线自动建议——你可以调整。',
      labels: {
        stopLossLabel: '止损价',
        stopLossHint: '价格到这里=这笔交易是错的。认输离场。',
        stopLossAuto: '自动 — 基于你的画线位置自动计算',
        takeProfitLabel: '止盈价',
        takeProfitHint: '价格到这里=赚够了。落袋为安。',
        takeProfitAuto: '自动 — 基于下一根画线/斐波那契目标位',
        riskRewardLabel: '风险收益比',
        riskRewardGood: '风险收益比 {ratio}:1 —— 不错',
        riskRewardBad: '风险收益比 {ratio}:1 —— 偏低，建议调整止盈或止损',
      },
    },

    // Step 4: 给策略起名
    {
      step: 4,
      title: '给这个策略起个名字',
      subtitle: '方便以后找到它',
      description: '一个好名字让你半年后还能看懂这个策略在做什么。',
      inputHint: '例如: "{symbol}日线——突破{price}阻力买入"',
      labels: {
        nameLabel: '策略名称',
        namePlaceholder: '{symbol} {action} @ {price}',
        tagLabel: '标签',
        tagHint: '添加标签方便分类——如"日线"、"趋势跟随"、"短线"',
        autoGenerate: '自动生成名字',
      },
    },

    // Step 5: 确认
    {
      step: 5,
      title: '确认策略',
      subtitle: '最后确认一遍——然后策略就开始运行了',
      description: '策略创建后会出现在你的策略列表中。Whaley会持续监控——条件触发时自动执行。',
      labels: {
        strategySummary: '策略概览',
        symbolLabel: '股票',
        conditionLabel: '触发条件',
        directionLabel: '方向',
        entryPrice: '入场价',
        stopLoss: '止损',
        takeProfit: '止盈',
        riskReward: '风险收益比',
        timeframe: '周期',
        drawingRef: '基于画线',
      },
    },
  ],

  success: {
    title: '🎯 策略已就绪',
    body: '"{strategyName}" 现在开始监控 {symbol}。当价格{condition}时——自动{action}。',
    actions: {
      backtest: '先回测看看',
      deploy: '启用策略',
      edit: '再调整一下',
      close: '关闭',
    },
  },

  validation: {
    tooShort: '这根线太短——画线长度不足{min}根K线。请画更长的线再转成策略。',
    noDirection: '无法从这根画线中确定方向。试试画趋势线或水平支撑/阻力线。',
    needsMoreLines: '创建完整的交易策略至少需要一根画线作为入场条件。请先在图表上画线。',
    frequencyLimit: '你今天已经创建了{count}个策略。建议先回测已有策略再创建新的。',
  },
};

// ═══════════════════════════════════════
// 画线类型 → 默认策略条件 映射
// ═══════════════════════════════════════

export const DRAWING_TYPE_DEFAULTS: Record<string, {
  recommendedCondition: string;
  defaultDirection: string;
  description: string;
}> = {
  trendline: {
    recommendedCondition: 'break-above',
    defaultDirection: 'buy',
    description: '趋势线——突破=趋势确认或反转',
  },
  support: {
    recommendedCondition: 'bounce-from',
    defaultDirection: 'buy',
    description: '支撑线——价格到这里容易反弹',
  },
  resistance: {
    recommendedCondition: 'break-above',
    defaultDirection: 'buy',
    description: '阻力线——突破=打开上涨空间',
  },
  horizontal: {
    recommendedCondition: 'bounce-from',
    defaultDirection: 'buy',
    description: '水平线——关键的整数关口或前高前低',
  },
  fib_retracement: {
    recommendedCondition: 'bounce-from',
    defaultDirection: 'buy',
    description: '斐波那契回调——0.618是黄金回调位',
  },
  fib_extension: {
    recommendedCondition: 'approach-from',
    defaultDirection: 'sell',
    description: '斐波那契扩展——目标价位，容易成为阻力',
  },
  channel_upper: {
    recommendedCondition: 'break-above',
    defaultDirection: 'buy',
    description: '通道上轨——突破=加速上涨',
  },
  channel_lower: {
    recommendedCondition: 'break-below',
    defaultDirection: 'sell',
    description: '通道下轨——跌破=趋势转弱',
  },
  pitchfork: {
    recommendedCondition: 'bounce-from',
    defaultDirection: 'buy',
    description: '安德鲁叉——中线是最重要的支撑/阻力',
  },
};

// ═══════════════════════════════════════
// 策略命名模板
// ═══════════════════════════════════════

export function generateStrategyName(params: {
  symbol: string;
  action: string;       // "买入"/"卖出"
  condition: string;    // "突破"/"跌破"/"反弹"/"靠近"
  price: number;
  drawingType: string;  // "趋势线"/"支撑线"/"阻力线"
}): string {
  const { symbol, action, condition, price, drawingType } = params;
  return `${symbol} ${action}@${condition}${drawingType} ${price}`;
}

export const STRATEGY_NAME_EXAMPLES = [
  'NVDA 买入@突破趋势线 142.3',
  'TSLA 卖出@跌破支撑线 180.5',
  'AAPL 买入@反弹斐波那契0.618 195.0',
  'BTC 买入@靠近通道下轨 65000',
  '600519 卖出@突破阻力线 1680',
];

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getStepOptions(step: number) {
  return DRAWING_TO_STRATEGY_WIZARD.steps[step - 1]?.options || [];
}

export function getDrawingDefault(drawingType: string) {
  const key = drawingType.toLowerCase().replace(/\s+/g, '_');
  return DRAWING_TYPE_DEFAULTS[key] || DRAWING_TYPE_DEFAULTS.horizontal;
}

export default DRAWING_TO_STRATEGY_WIZARD;
