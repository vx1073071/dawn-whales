/**
 * Humanize Metrics — 因子指标人话翻译工具
 *
 * 将技术指标数值转换为人类可读的中文解释，支持3层披露级别。
 * 每指标提供: 一句话(≤30字) + 大白话(≤100字) + 速判标准(绿/黄/红) + 人类比喻
 *
 * 使用: import { humanize, getMetricEducation } from '@/lib/factor/humanize-metrics';
 *
 * @module humanize-metrics
 * @author QClaw(设计虾)
 * @task R172 B3
 */

// ─── 类型定义 ────────────────────────────────────────────

/** 速判颜色 */
export type JudgeColor = 'green' | 'yellow' | 'red';

/** 指标L1-L3教育文案 */
export interface MetricEducation {
  /** 指标内部ID */
  id: string;
  /** 指标技术名 */
  technicalName: string;
  /** 中文名 */
  chineseName: string;
  /** L1: 一句话解释 (≤30字，用于卡片hover) */
  oneLiner: string;
  /** L2: 大白话解释 (≤100字，用于详情面板) */
  plainChinese: string;
  /** L3: 人类比喻 (用于新手引导) */
  analogy: string;
  /** 速判区间定义 */
  ranges: {
    green?: { condition: string; message: string };
    yellow?: { condition: string; message: string };
    red?: { condition: string; message: string };
  };
  /** 单位 */
  unit: string;
  /** 值越大越好? */
  higherIsBetter: boolean;
}

/** 人化结果 */
export interface HumanizedResult {
  /** 指标ID */
  metricId: string;
  /** 实际值 */
  value: number;
  /** 格式化显示文本 ("10.8%") */
  displayValue: string;
  /** L1一句话 */
  oneLiner: string;
  /** 速判颜色 */
  color: JudgeColor;
  /** 速判消息 */
  judgeMessage: string;
  /** 速判标签 (用于badge) */
  judgeLabel: string;
}

/** 披露级别 */
export type DisclosureLevel = 1 | 2 | 3;

// ─── 15个核心指标教育文案 ────────────────────────────────

const METRICS: Record<string, MetricEducation> = {
  IC: {
    id: 'IC',
    technicalName: 'Information Coefficient',
    chineseName: '信息系数',
    oneLiner: '因子预测方向有多准。越接近1越准',
    plainChinese:
      'IC衡量的是：按照这个因子排序买股票，实际能赚到钱的概率有多高。比如动量因子IC=0.05，意味着你按动量排名买入的股票，大概率跑赢平均。IC>0.03算有效，IC>0.05是优秀，IC<0.01基本是随机猜。',
    analogy: 'IC像天气预报准确率——IC=0.8说明预报几乎全对，IC=0.01说明跟瞎猜差不多',
    ranges: {
      green: { condition: 'IC ≥ 0.05', message: '强有效——历史上经常预测对' },
      yellow: { condition: '0.02 ≤ IC < 0.05', message: '中等有效——方向大体对，但有不确定性' },
      red: { condition: 'IC < 0.02', message: '弱有效——预测能力接近随机，需搭配其他因子' },
    },
    unit: '',
    higherIsBetter: true,
  },

  IR: {
    id: 'IR',
    technicalName: 'Information Ratio',
    chineseName: '信息比率',
    oneLiner: '因子预测稳定性。越大越稳定',
    plainChinese:
      'IR告诉你这个因子是不是"稳定的准"。有些因子偶尔很准（高IC）、大部分时候瞎蒙（高波动），IR会很低。有些因子每次都准一点点，IR会很高。IR>0.5算稳定因子，IR>1.0是非常可靠的因子。',
    analogy: 'IC是考试平均分，IR是成绩稳不稳定。学霸每科都考80分（低波动，高IR）；偏科生一科100一科60（高波动，低IR）',
    ranges: {
      green: { condition: 'IR ≥ 1.0', message: '非常稳定——不靠运气' },
      yellow: { condition: '0.3 ≤ IR < 1.0', message: '较稳定——大部分时候有效' },
      red: { condition: 'IR < 0.3', message: '不稳定——时灵时不灵，需择时使用' },
    },
    unit: '',
    higherIsBetter: true,
  },

  SHARPE: {
    id: 'SHARPE',
    technicalName: 'Sharpe Ratio',
    chineseName: '夏普比率',
    oneLiner: '每承担1块钱风险，能赚多少钱',
    plainChinese:
      '夏普衡量的是性价比：冒了多大风险换来了多少收益。夏普=1.0意思是每承受1块钱的波动，赚到1块钱超额收益。夏普=2.0意思是冒1块钱风险赚2块钱，性价比很高。夏普<0.5意思是波动大收益小，策略风险收益不匹配。',
    analogy: '夏普像网购评分——5星但价格贵（收益高波动大）可能夏普一般；3星但超便宜（收益稳波动小）可能夏普更高',
    ranges: {
      green: { condition: '夏普 ≥ 1.5', message: '优秀——风险收益比非常好，值得加大仓位' },
      yellow: { condition: '0.5 ≤ 夏普 < 1.5', message: '合格——正常的风险收益比' },
      red: { condition: '夏普 < 0.5', message: '差——冒的风险比赚的钱多，需要优化' },
    },
    unit: '',
    higherIsBetter: true,
  },

  MAX_DRAWDOWN: {
    id: 'MAX_DRAWDOWN',
    technicalName: 'Max Drawdown',
    chineseName: '最大回撤',
    oneLiner: '历史上亏最惨的一次，跌了多少',
    plainChinese:
      '最大回撤告诉你最糟情况有多糟。你的策略从最高点到最低点最多亏过多少钱。如果最大回撤=20%，意味着你要赚25%才能回本（因为本金少了）。回撤<15%是保守策略，回撤<30%是正常水平，回撤>50%说明策略有巨大风险。',
    analogy: '最大回撤像开车的最糟事故记录——哪怕平时开得再好，只要出过一次大事故就要警惕',
    ranges: {
      green: { condition: '回撤 < 15%', message: '低风险——最糟情况也没有大幅亏损' },
      yellow: { condition: '15% ≤ 回撤 < 30%', message: '中等风险——可以接受的亏损范围' },
      red: { condition: '回撤 ≥ 30%', message: '高风险——历史最大亏损很严重，心理压力大' },
    },
    unit: '%',
    higherIsBetter: false,
  },

  WIN_RATE: {
    id: 'WIN_RATE',
    technicalName: 'Win Rate',
    chineseName: '胜率',
    oneLiner: '历史上的交易或月份，赚钱的占多少',
    plainChinese:
      '胜率只是概率，不代表赚钱。50%胜率+每次赚100每次亏50=稳定盈利。80%胜率+每次赚10每次亏100=最终还是亏。所以胜率要结合盈亏比一起看。胜率>55%就算好，但低胜率+高盈亏比也可以很赚。',
    analogy: '胜率像婚姻幸福率——不是不吵架就好，是吵完架后收获大于损失',
    ranges: {
      green: { condition: '胜率 ≥ 60%', message: '高胜率——多数交易是盈利的，心理体验好' },
      yellow: { condition: '40% ≤ 胜率 < 60%', message: '中等——需要盈亏比配合' },
      red: { condition: '—', message: '不要单看胜率下定论，低胜率可以是好策略' },
    },
    unit: '%',
    higherIsBetter: true,
  },

  ANNUAL_RETURN: {
    id: 'ANNUAL_RETURN',
    technicalName: 'Annualized Return',
    chineseName: '年化收益率',
    oneLiner: '平均每年收益多少（复利计算）',
    plainChinese:
      '年化收益率把你所有年份的收益折合成"平均每年赚多少"。10%年化=每年资产平均增长10%，7年翻倍（72法则）。但年化不代表每年都赚这么多——可能今年+30%、明年-10%，平均+10%。要结合最大回撤看：年化20%回撤50%不如年化10%回撤5%。',
    analogy: '年化像跑步的平均速度——全程加速减速不一样，但最终算出一个平均配速',
    ranges: {
      green: { condition: '年化 ≥ 15%', message: '优秀——长期复利效果显著' },
      yellow: { condition: '8% ≤ 年化 < 15%', message: '不错——跑赢通胀，稳健增值' },
      red: { condition: '年化 < 5%', message: '偏弱——需考虑是否跑赢大盘和无风险利率' },
    },
    unit: '%',
    higherIsBetter: true,
  },

  VOLATILITY: {
    id: 'VOLATILITY',
    technicalName: 'Volatility',
    chineseName: '波动率',
    oneLiner: '收益的"颠簸程度"。越大越颠簸',
    plainChinese:
      '波动率衡量你的收益有多"跳"。波动率=10%的意思是，你的月收益大概在平均值±10%的范围内跳动。高波动率意味着坐过山车——有时大赚有时大亏。低波动率意味着平稳——赚钱不多但稳定。波动率本身没有好坏，看你的承受能力。',
    analogy: '波动率像公路的平整度——高速路（低波动）舒服但没风景，山路（高波动）刺激但容易晕车',
    ranges: {
      green: { condition: '年化波动 < 15%', message: '低波动——平稳，适合保守型投资者' },
      yellow: { condition: '15% ≤ 波动 < 30%', message: '中等波动——有起伏，需要一定承受力' },
      red: { condition: '波动 ≥ 30%', message: '高波动——像坐过山车，小心心脏' },
    },
    unit: '%',
    higherIsBetter: false,
  },

  BETA: {
    id: 'BETA',
    technicalName: 'Beta',
    chineseName: '贝塔(β)',
    oneLiner: '你的策略跟大盘多同步。β=1跟大盘一样',
    plainChinese:
      'Beta衡量你的策略多"像"大盘。β=1.0=大盘涨1%你涨1%。β=1.5=大盘涨1%你涨1.5%（涨跌都放大）。β=0.5=大盘涨1%你涨0.5%（涨跌都温和）。β<0=大盘涨你跌（反向策略，做空型）。',
    analogy: 'Beta像跟班指数——β=1是紧紧跟着老板走，β=2是老板走一步你跑两步',
    ranges: {
      green: { condition: '0.5 < β < 1.5', message: '正常范围——跟大盘基本同步' },
      yellow: { condition: 'β > 2.0', message: '杠杆型高波动——比大盘波动大一倍' },
      red: { condition: 'β < 0', message: '反向型——大盘涨你亏，做空/对冲属性' },
    },
    unit: '',
    higherIsBetter: undefined as unknown as boolean, // neutral
  },

  ALPHA: {
    id: 'ALPHA',
    technicalName: 'Alpha',
    chineseName: '阿尔法(α)',
    oneLiner: '去掉大盘的影响后，你的策略多赚了多少钱',
    plainChinese:
      'Alpha是策略的"真本事"——去掉大盘涨跌（β收益）后剩下的纯能力。α=5%意味着你的策略每年比"跟着大盘走"多赚5%。α>0说明有真正的选股/择时能力。α<0说明不如直接买指数基金。',
    analogy: 'β是大盘给你免费的午餐，α是你自己赚来的外卖',
    ranges: {
      green: { condition: 'α > 5%', message: '超额能力明显——去掉大盘还有余' },
      yellow: { condition: '0 < α ≤ 5%', message: '有超额但不多——基本跟大盘走' },
      red: { condition: 'α < 0', message: '不如买指数——策略没有提供额外价值' },
    },
    unit: '%',
    higherIsBetter: true,
  },

  R_SQUARED: {
    id: 'R_SQUARED',
    technicalName: 'R²',
    chineseName: '决定系数',
    oneLiner: '策略收益有多少是跟着大盘走的。越高越依赖大盘',
    plainChinese:
      'R²告诉你策略的独立性。R²=0.8→策略80%涨跌是因为大盘涨跌，只有20%是你自己的选股能力。R²=0.2→策略跟大盘关系不大，靠的是自己的判断。过高R²说明你在"假装择股"（其实只是买大盘）；过低R²说明你很有独立想法。',
    analogy: 'R²像考试答案跟学霸的相似度——太高说明你在抄作业，太低说明你路子很野',
    ranges: {
      green: { condition: 'R² ≈ 0.5', message: '一半大盘一半自身——常见配置' },
      yellow: { condition: 'R² > 0.8', message: '策略几乎就是买大盘，没有发挥主动管理价值' },
      red: { condition: '—', message: '没有绝对好坏，主动型想要低R²，指数型想要高R²' },
    },
    unit: '',
    higherIsBetter: undefined as unknown as boolean, // neutral
  },

  T_STAT: {
    id: 'T_STAT',
    technicalName: 't-Statistic',
    chineseName: 't统计量',
    oneLiner: '这个因子的预测能力不是巧合。>2.0才可靠',
    plainChinese:
      't统计量回答："你的IC不是凭运气吧？"样本越小、波动越大，t越小→越可能是碰巧。|t|>2.0意味着只有5%的概率是巧合（统计学上算"显著"）。|t|>3.0意味着只有0.3%的概率是巧合。',
    analogy: 't统计量像药的效果验证——100个人吃好了可能是碰巧，10000个人吃好了一定是药有用',
    ranges: {
      green: { condition: '|t| ≥ 2.0', message: '统计显著——因子效果是真实的，不是巧合' },
      yellow: { condition: '1.6 ≤ |t| < 2.0', message: '边缘显著——接近可靠，需更多数据验证' },
      red: { condition: '|t| < 1.6', message: '不显著——该因子效果可能是碰巧' },
    },
    unit: '',
    higherIsBetter: true,
  },

  P_VALUE: {
    id: 'P_VALUE',
    technicalName: 'p-Value',
    chineseName: 'p值',
    oneLiner: '纯凭运气得到这个结果的概率。越小越好',
    plainChinese:
      'p值告诉你：如果这个因子完全没用（纯随机），你看到这个结果的可能性有多大。p=0.05=只有5%概率是撞大运→95%概率是真的有用。p=0.01=只有1%概率是撞大运→99%概率是真的有用。p=0.5=50%概率是撞大运→可能没用。',
    analogy: 'p值像中彩票概率——p=0.0001说明几乎不可能凭运气，p=0.5说明跟抛硬币一样',
    ranges: {
      green: { condition: 'p < 0.01', message: '非常显著——几乎不可能凭运气' },
      yellow: { condition: '0.01 ≤ p < 0.05', message: '显著——有统计学意义' },
      red: { condition: 'p ≥ 0.05', message: '不显著——不能排除碰巧的可能' },
    },
    unit: '',
    higherIsBetter: false,
  },

  FACTOR_EXPOSURE: {
    id: 'FACTOR_EXPOSURE',
    technicalName: 'Factor Exposure',
    chineseName: '因子暴露',
    oneLiner: '你的策略对这个因子的依赖程度。绝对值越大越依赖',
    plainChinese:
      '因子暴露告诉你：你的策略本质上是"买了什么"。动量暴露0.45→你策略收益的45%来自动量因子。价值暴露-0.20→你的策略偏成长股，不喜欢便宜股。暴露太高=对这个因子的押注太重，风险集中。',
    analogy: '因子暴露像营养配比——蛋白质太高（因子暴露高）只长肌肉，碳水太高只长胖，均衡才好',
    ranges: {
      green: { condition: '|暴露| < 0.3', message: '轻度依赖——该因子对策略影响不大' },
      yellow: { condition: '0.3 ≤ |暴露| < 0.6', message: '中度依赖——策略明显受该因子影响' },
      red: { condition: '|暴露| ≥ 0.6', message: '重度依赖——策略几乎就是赌这个因子' },
    },
    unit: '',
    higherIsBetter: undefined as unknown as boolean, // neutral
  },

  CORRELATION: {
    id: 'CORRELATION',
    technicalName: 'Correlation',
    chineseName: '相关性',
    oneLiner: '两个因子或策略的涨跌有多同步。1=完全同步，0=不相关',
    plainChinese:
      '相关性衡量两个东西有多像。ρ=0.8=两个因子几乎一起涨跌，同时用并不能分散风险。ρ=-0.3=一个涨另一个跌，组合在一起可以降低风险。ρ≈0=两个因子互不影响，组合在一起可以分散风险。理想的多因子组合：选相关性低的因子互相补充。',
    analogy: '相关性像两个人的性格——太像了容易一起犯错，互补的搭在一起更稳定',
    ranges: {
      green: { condition: '|ρ| < 0.3', message: '低相关——这两个可以一起用，互相补充' },
      yellow: { condition: '0.3 ≤ |ρ| < 0.7', message: '中等相关——有一定同步性' },
      red: { condition: '|ρ| ≥ 0.7', message: '高相关——高度重叠，没必要两个都选' },
    },
    unit: '',
    higherIsBetter: false,
  },

  CALMAR: {
    id: 'CALMAR',
    technicalName: 'Calmar Ratio',
    chineseName: '卡尔玛比率',
    oneLiner: '每亏1块钱，能赚多少。衡量赚钱效率',
    plainChinese:
      'Calmar比率是收益÷最大回撤。Calmar=1.0=每承受1块钱亏损赚1块钱→盈亏平衡。Calmar=2.0=每承受1块钱亏损赚2块钱→效率不错。Calmar=3.0=每承受1块钱亏损赚3块钱→效率很高。这个指标很直观：关注最糟情况下的赚钱效率。',
    analogy: 'Calmar像投资回报率——开店投入100万一年只赚10万（Calmar=0.1）不值得；投入100万赚200万（Calmar=2.0）很棒',
    ranges: {
      green: { condition: 'Calmar ≥ 1.5', message: '承受亏损的效率高，策略更值得投入' },
      yellow: { condition: '0.5 ≤ Calmar < 1.5', message: '正常水平' },
      red: { condition: 'Calmar < 0.5', message: '最大回撤远超收益，风险收益不匹配' },
    },
    unit: '',
    higherIsBetter: true,
  },
};

// ─── 格式化 ──────────────────────────────────────────────

/** 格式化指标值 (自动添加百分号、小数位等) */
function formatValue(value: number, metricId: string): string {
  const pctMetrics = new Set([
    'MAX_DRAWDOWN', 'WIN_RATE', 'ANNUAL_RETURN', 'VOLATILITY', 'ALPHA',
  ]);
  if (pctMetrics.has(metricId)) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }
  return value.toFixed(2);
}

// ─── 核心API ─────────────────────────────────────────────

/**
 * 获取指标的教育文案
 * @param metricId 指标ID (如 'IC', 'SHARPE', 'MAX_DRAWDOWN')
 * @returns MetricEducation 或 null
 */
export function getMetricEducation(metricId: string): MetricEducation | null {
  return METRICS[metricId] ?? null;
}

/**
 * 获取所有15个指标的ID列表
 */
export function getAllMetricIds(): string[] {
  return Object.keys(METRICS);
}

/**
 * 获取所有15个指标的教育文案
 */
export function getAllMetrics(): MetricEducation[] {
  return Object.values(METRICS);
}

/**
 * 对指标值进行人化评定
 *
 * @param value 指标的实际数值
 * @param metricId 指标ID
 * @param level 披露级别 (1=一句话, 2=大白话+速判, 3=全部+比喻)
 * @returns HumanizedResult
 *
 * @example
 * ```ts
 * const result = humanize(1.42, 'SHARPE');
 * // => { color: 'green', judgeMessage: '优秀——风险收益比非常好', ... }
 * ```
 */
export function humanize(
  value: number,
  metricId: string,
  _level: DisclosureLevel = 2,
): HumanizedResult | null {
  const metric = METRICS[metricId];
  if (!metric) return null;

  const { ranges } = metric;
  const higherIsBetter = metric.higherIsBetter === true;
  const lowerIsBetter = metric.higherIsBetter === false;

  let color: JudgeColor = 'yellow';
  let judgeMessage = '—';

  // 按优先级判断: green → red → yellow (default)
  if (ranges.green) {
    color = 'green';
    judgeMessage = ranges.green.message;
  } else if (ranges.red) {
    color = 'red';
    judgeMessage = ranges.red.message;
  }

  // 对于有具体判断逻辑的指标，用数值判断
  // (简化实现；生产环境可用eval或手动判断条件)
  const conditionMap: Record<
    string,
    (v: number) => JudgeColor | null
  > = {
    IC: (v) => (v >= 0.05 ? 'green' : v >= 0.02 ? 'yellow' : 'red'),
    IR: (v) => (v >= 1.0 ? 'green' : v >= 0.3 ? 'yellow' : 'red'),
    SHARPE: (v) => (v >= 1.5 ? 'green' : v >= 0.5 ? 'yellow' : 'red'),
    MAX_DRAWDOWN: (v) => (v < 15 ? 'green' : v < 30 ? 'yellow' : 'red'),
    WIN_RATE: (v) => (v >= 60 ? 'green' : v >= 40 ? 'yellow' : 'yellow'),
    ANNUAL_RETURN: (v) => (v >= 15 ? 'green' : v >= 8 ? 'yellow' : 'red'),
    VOLATILITY: (v) => (v < 15 ? 'green' : v < 30 ? 'yellow' : 'red'),
    BETA: (v) => (v < 0 ? 'red' : v > 2 ? 'yellow' : 'green'),
    ALPHA: (v) => (v > 5 ? 'green' : v > 0 ? 'yellow' : 'red'),
    R_SQUARED: (v) => (v > 0.8 ? 'yellow' : 'green'),
    T_STAT: (v) => (Math.abs(v) >= 2 ? 'green' : Math.abs(v) >= 1.6 ? 'yellow' : 'red'),
    P_VALUE: (v) => (v < 0.01 ? 'green' : v < 0.05 ? 'yellow' : 'red'),
    FACTOR_EXPOSURE: (v) => (Math.abs(v) < 0.3 ? 'green' : Math.abs(v) < 0.6 ? 'yellow' : 'red'),
    CORRELATION: (v) => (Math.abs(v) < 0.3 ? 'green' : Math.abs(v) < 0.7 ? 'yellow' : 'red'),
    CALMAR: (v) => (v >= 1.5 ? 'green' : v >= 0.5 ? 'yellow' : 'red'),
  };

  const judge = conditionMap[metricId];
  if (judge) {
    const judged = judge(value);
    if (judged) {
      color = judged;
      const range = ranges[judged];
      if (range) judgeMessage = range.message;
    }
  }

  const labels: Record<JudgeColor, string> = {
    green: higherIsBetter ? '优秀' : '低风险',
    yellow: '合格',
    red: lowerIsBetter ? '偏高' : '需关注',
  };

  // 针对部分指标定制标签
  const labelOverrides: Record<string, Record<JudgeColor, string>> = {
    MAX_DRAWDOWN: { green: '低风险', yellow: '中等风险', red: '高风险' },
    VOLATILITY: { green: '低波动', yellow: '中等波动', red: '高波动' },
    WIN_RATE: { green: '高胜率', yellow: '中等', red: '仅供参考' },
    BETA: { green: '正常', yellow: '高杠杆', red: '反向' },
    ALPHA: { green: '超额显著', yellow: '略有超额', red: '不及大盘' },
    R_SQUARED: { green: '独立', yellow: '跟随大盘', red: '—' },
    P_VALUE: { green: '非常显著', yellow: '显著', red: '不显著' },
  };

  const override = labelOverrides[metricId];
  const label = override?.[color] ?? labels[color];

  return {
    metricId,
    value,
    displayValue: formatValue(value, metricId),
    oneLiner: metric.oneLiner,
    color,
    judgeMessage,
    judgeLabel: label,
  };
}

/**
 * 批量人化多个指标
 *
 * @example
 * ```ts
 * const results = humanizeBatch([
 *   { metricId: 'SHARPE', value: 1.42 },
 *   { metricId: 'MAX_DRAWDOWN', value: -8.3 },
 *   { metricId: 'WIN_RATE', value: 62.3 },
 * ]);
 * ```
 */
export function humanizeBatch(
  entries: Array<{ metricId: string; value: number }>,
  level: DisclosureLevel = 2,
): HumanizedResult[] {
  return entries
    .map((e) => humanize(e.value, e.metricId, level))
    .filter((r): r is HumanizedResult => r !== null);
}

/**
 * 获取所有指标排序后的摘要 (用于FactorCompareDashboard)
 *
 * 返回: { green: HumanizedResult[], yellow: HumanizedResult[], red: HumanizedResult[] }
 */
export function humanizeSummary(
  entries: Array<{ metricId: string; value: number }>,
): {
  green: HumanizedResult[];
  yellow: HumanizedResult[];
  red: HumanizedResult[];
} {
  const results = humanizeBatch(entries);
  return {
    green: results.filter((r) => r.color === 'green'),
    yellow: results.filter((r) => r.color === 'yellow'),
    red: results.filter((r) => r.color === 'red'),
  };
}

// ─── 快捷函数 ─────────────────────────────────────────────

/**
 * 获取指标的L1一句话 (≤30字)
 */
export function getOneLiner(metricId: string): string {
  return METRICS[metricId]?.oneLiner ?? metricId;
}

/**
 * 获取指标的中文名
 */
export function getChineseName(metricId: string): string {
  return METRICS[metricId]?.chineseName ?? metricId;
}

/**
 * 获取指标的人类比喻
 */
export function getAnalogy(metricId: string): string {
  return METRICS[metricId]?.analogy ?? '';
}

// ─── 速判颜色常量 ─────────────────────────────────────────

/** 速判颜色 → CSS颜色值映射 */
export const JUDGE_COLORS: Record<JudgeColor, string> = {
  green: '#4CAF50',
  yellow: '#FF9800',
  red: '#F44336',
};

/** 速判颜色 → Emoji映射 (用于纯文本场景) */
export const JUDGE_EMOJI: Record<JudgeColor, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
};

/** 速判颜色 → 标签文本映射 */
export const JUDGE_LABELS: Record<JudgeColor, string> = {
  green: '优秀',
  yellow: '合格',
  red: '需关注',
};
