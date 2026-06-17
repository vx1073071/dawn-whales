// ══ R255 QClaw AI-05: 对比分析文案 — 多维度对比 ══
// Multi-stock comparison copy: side-by-side analysis templates
// Design: "不是两张报告表——是一次对话，帮你看到'这两个到底差在哪'"

export interface ComparisonDimension {
  id: string;
  label: string;
  emoji: string;
  question: string;
  description: string;
  format: 'number' | 'percentage' | 'rating' | 'text' | 'direction';
  higherIsBetter: boolean;
}

export const COMPARISON_DIMENSIONS: ComparisonDimension[] = [
  { id: 'pe', label: '市盈率', emoji: '📊', question: '谁更便宜？',
    description: '你花多少钱买一块钱利润。低=便宜，但便宜可能有原因。', format: 'number', higherIsBetter: false },
  { id: 'roe', label: 'ROE', emoji: '🏆', question: '谁更会赚钱？',
    description: '股东的钱被用得多有效率。>15%=优秀。', format: 'percentage', higherIsBetter: true },
  { id: 'revenueGrowth', label: '营收增速', emoji: '📈', question: '谁增长更快？',
    description: '收入增长速度。>10%=快速增长。', format: 'percentage', higherIsBetter: true },
  { id: 'epsGrowth', label: '利润增速', emoji: '💰', question: '谁的利润增长更快？',
    description: '赚的钱越涨越多=好。但也要看利润质量(是不是一次性收益)。', format: 'percentage', higherIsBetter: true },
  { id: 'debtToEquity', label: '负债率', emoji: '🏋️', question: '谁负债更重？',
    description: '负债÷净资产。<50%=健康；>100%=高风险。', format: 'percentage', higherIsBetter: false },
  { id: 'dividendYield', label: '股息率', emoji: '💵', question: '谁分红更多？',
    description: '每年分红÷股价。但注意：高股息可能是"股息陷阱"(不可持续)。', format: 'percentage', higherIsBetter: true },
  { id: 'beta', label: '波动性', emoji: '🎢', question: '谁波动更大？',
    description: '>1=比大盘波动大；<1=比大盘稳。高波动=高风险+高回报潜力。', format: 'number', higherIsBetter: false },
  { id: 'marketCap', label: '市值', emoji: '🏢', question: '谁体量更大？',
    description: '公司整体值多少钱。大=稳健；小=成长空间更大但风险更高。', format: 'number', higherIsBetter: true },
  { id: 'peg', label: 'PEG', emoji: '🎯', question: '性价比如何？',
    description: 'PE÷利润增速。<1=可能低估；>2=可能高估。', format: 'number', higherIsBetter: false },
  { id: 'profitMargin', label: '利润率', emoji: '💎', question: '谁利润更厚？',
    description: '利润÷收入。越高说明每块钱收入留下的利润越多——生意模式更好。', format: 'percentage', higherIsBetter: true },
  { id: 'momentum', label: '动量', emoji: '🚀', question: '谁近期更强？',
    description: '近6个月涨幅。正=有动量；负=在下跌。动量策略追涨杀跌。', format: 'percentage', higherIsBetter: true },
  { id: 'rsi', label: 'RSI', emoji: '🌡️', question: '谁超买/超卖了？',
    description: '>70=最近涨太多(可能回调)；<30=最近跌太多(可能反弹)。', format: 'number', higherIsBetter: false },
];

// ═══════════════════ 对比结果文案 ═══════════════════

export interface ComparisonResult {
  stockA: string;
  stockB: string;
  dimension: string;
  valueA: number | string;
  valueB: number | string;
  winner: 'A' | 'B' | 'TIE';
  insight: string;
}

export const COMPARISON_TEMPLATES = {
  header: (a: string, b: string) => `# ${a} vs ${b}\n> 不是"谁更好"——是"谁更适合你的策略"`,

  overallSummary: (_a: string, _b: string, winsA: number, winsB: number, total: number) => {
    const ratio = winsA / total;
    if (ratio > 0.6) return `${_a}在${winsA}/${total}个维度上领先——表现更全面。但别急着下结论，看下文中的"冠军维度"——${_b}可能在某个关键指标上碾压${_a}。`;
    if (ratio < 0.4) return `${_b}在${winsB}/${total}个维度上领先——表现更全面。但这不意味着${_a}没有价值——看下文中的"冠军维度"——${_a}可能在某个领域是绝对的王者。`;
    return `势均力敌——${_a}赢${winsA}项，${_b}赢${winsB}项。胜负取决于你在意什么维度。`;
  },

  aDominates: (_stock: string, _dimLabel: string, _value: string | number) =>
    `🥇 **冠军维度**：${_stock}在 **${_dimLabel}** 上碾压——${_value}。这是它在这次对比中最大的亮点。如果你的策略最看重这个维度，${_stock}是你的答案。`,

  allTie: '两只有很多相似之处——这可能意味着它们处于同一赛道、受相同因素驱动。如果是这样，同时持有它们不算"分散投资"。',

  advice: (_a: string, _b: string) => `### 🐋 鲸灵的想法
比较完这些数字后，有几点值得注意：
1. 不要只看"赢了多少项"——要看"赢了什么"。在你看重的维度上赢比在所有维度上赢更重要。
2. 两只股票可能在同一个行业、受同样的宏观因素驱动——这意味着同时持有它们不能有效分散风险。
3. 有些最好的投资机会不在"对比胜出的那一边"——而在"输的那一边但便宜得离谱"。
4. 对比分析是帮你缩小"值得深挖的候选"，不是帮你"选出最终答案"。最终答案取决于你的策略规则。`,
};

// ═══════════════════ 场景化对比标题 ═══════════════════

export interface ComparisonScenario {
  id: string;
  title: string;
  icon: string;
  description: string;
  recommendedDimensions: string[];
  startingQuestion: string;
  templateHint: string;
}

export const COMPARISON_SCENARIOS: ComparisonScenario[] = [
  {
    id: 'same_sector',
    title: '同赛道对决',
    icon: '🥊',
    description: '两只同行业股票——选龙头还是老二？',
    recommendedDimensions: ['pe', 'revenueGrowth', 'profitMargin', 'roe', 'debtToEquity'],
    startingQuestion: '这两只是直接竞争对手。它们在同一行业，面对同一个市场——但它们赚钱的方式可能完全不同。让我们看看谁跑在前面。',
    templateHint: '同行业对比中，利润率比PE更能说明问题——同样的行业PE低可能只是因为它增长慢，但利润率高说明它的生意模式更好。',
  },
  {
    id: 'growth_vs_value',
    title: '成长 vs 价值',
    icon: '🐇🐢',
    description: '高增长但贵 vs 有利润但便宜——选乌龟还是兔子？',
    recommendedDimensions: ['peg', 'revenueGrowth', 'pe', 'profitMargin', 'dividendYield'],
    startingQuestion: '这是成长投资者vs价值投资者的经典对决。一只可能增长很快但很贵；一只可能增长慢但很便宜。你要判断的是：便宜的那只是"被低估"还是"本来就应该便宜"？',
    templateHint: '成长vs价值没有对错——只有适合不适合你的策略。如果你的策略是"长期持有高质量"→价值；如果是"抓趋势赚动量"→成长。',
  },
  {
    id: 'dividend_battle',
    title: '股息大战',
    icon: '💸',
    description: '两只高息股——谁的股息更安全、更能涨？',
    recommendedDimensions: ['dividendYield', 'payoutRatio', 'debtToEquity', 'epsGrowth', 'beta'],
    startingQuestion: '两只都在发股息。但股息率高的那只可能是个"陷阱"——它的股价在跌，所以股息率看起来高。我们一起看看谁的股息是真的稳。',
    templateHint: '股息对比最重要的数字不是"股息率"——是"派息率"(利润的百分之多少在分红)。派息率>80%=危险——公司几乎把所有利润都分了，没有留钱投资或防风险。',
  },
  {
    id: 'momentum_check',
    title: '动量PK',
    icon: '🌊',
    description: '近期谁跑得猛？动量对比——趋势跟踪者专用',
    recommendedDimensions: ['momentum', 'rsi', 'beta', 'revenueGrowth', 'epsGrowth'],
    startingQuestion: '这两只最近的走势很不一样。一只在涨，另一只在跌(或走平)。动量的胜负不取决于"哪家公司更好"——取决于"哪个趋势还在继续"。',
    templateHint: '动量对比是最"市场时机敏感"的对比。今天的胜者可能是明天的败者——因为这些全是短期趋势信号。只适用于短期(1-3个月)判断。',
  },
  {
    id: 'portfolio_compare',
    title: '持仓二选一',
    icon: '⚖️',
    description: '你已经在持有——现在要考虑"换不换"',
    recommendedDimensions: ['pe', 'peg', 'epsGrowth', 'roe', 'momentum'],
    startingQuestion: '你手里已经有其中一只，正在考虑换到另一只。这不是"谁更好"的问题——是"换值不值得"。注意换仓有手续费和税务影响。',
    templateHint: '持仓对比的关键问：换过去之后，新的那只能不能在接下来6-12个月内显著跑赢旧的那只？如果没有明显的优势→不如不动。交易成本可能吃掉你所有的"优化"收益。',
  },
];

// ═══════════════════ 对比分析生成器 ═══════════════════

export function generateComparison(
  stockA: string, stockB: string, scenario: ComparisonScenario, results: ComparisonResult[],
): string {
  const winsA = results.filter(r => r.winner === 'A').length;
  const winsB = results.filter(r => r.winner === 'B').length;
  const total = results.length;

  const parts = [
    COMPARISON_TEMPLATES.header(stockA, stockB),
    '',
    `*${scenario.icon} ${scenario.title}：${scenario.description}*`,
    '',
    scenario.startingQuestion,
    '',
    '---',
    '',
    '## 📊 逐维度对比',
    '',
    ...results.map(r =>
      `### ${COMPARISON_DIMENSIONS.find(d => d.id === r.dimension)?.emoji || ''} ${r.dimension}\n${r.insight}\n`
    ),
    '---',
    '',
    `## 🏁 总结：${COMPARISON_TEMPLATES.overallSummary(stockA, stockB, winsA, winsB, total)}`,
    '',
  ];

  // Champion dimension
  const bestForA = results.filter(r => r.winner === 'A');
  const bestForB = results.filter(r => r.winner === 'B');
  if (bestForA.length > 0) {
    const best = bestForA[0];
    parts.push(COMPARISON_TEMPLATES.aDominates(stockA, best.dimension, `${best.valueA}`));
  }
  if (bestForB.length > 0) {
    const best = bestForB[0];
    parts.push(COMPARISON_TEMPLATES.aDominates(stockB, best.dimension, `${best.valueB}`));
  }

  // If close to tie
  if (Math.abs(winsA - winsB) <= 2) {
    parts.push('');
    parts.push(COMPARISON_TEMPLATES.allTie);
  }

  parts.push('');
  parts.push(scenario.templateHint);
  parts.push('');
  parts.push(COMPARISON_TEMPLATES.advice(stockA, stockB));

  return parts.join('\n');
}

export default COMPARISON_SCENARIOS;
