// ── R219-auto#1 (L15): 因子结果人话翻译引擎 ──────────────────────────────
// 将技术指标(IC/IR/Sharpe/MaxDD等)翻译为中文自然语言
// 示例: "IC=0.05" → "该因子对收益有轻微预测力，月度IC为0.05"
//        "MaxDD=15%" → "最大回撤15%，属于中等风险，历史上从峰到谷最大跌幅"

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FactorHumanInput {
  factorName: string;
  factorId: string;
  ic?: number;             // Information Coefficient
  icRank?: number;         // IC percentile rank among peers
  ir?: number;             // Information Ratio
  sharpe?: number;
  maxDrawdown?: number;
  annualReturn?: number;
  volatility?: number;
  correlation?: { withFactor: string; value: number }[];
  winRate?: number;
  confidence?: number;     // 0-1
  backtestYears?: number;
  factorWeight?: number;   // in portfolio
  signalStrength?: 'strong' | 'moderate' | 'weak';
  direction?: 'long' | 'short' | 'neutral';
  market?: string;
  sampleCount?: number;
}

export interface FactorHumanResult {
  /** Main one-line summary */
  summary: string;
  /** Detailed paragraph */
  detail: string;
  /** Individual component translations */
  components: FactorHumanComponent[];
  /** Overall verdict */
  verdict: '优秀' | '良好' | '一般' | '较差' | '无效';
  verdictEmoji: string;
  /** Risk level */
  riskLevel: '低' | '中等' | '高' | '极高';
  riskEmoji: string;
  /** Suggested action */
  suggestion: string;
}

export interface FactorHumanComponent {
  category: string;
  key: string;
  rawValue: string;
  humanText: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export type Language = 'zh-CN' | 'zh-TW' | 'en';

export interface HumanizerConfig {
  language: Language;
  /** Tone: professional / conversational / educational */
  tone: 'professional' | 'conversational' | 'educational';
}

const DEFAULT_CONFIG: HumanizerConfig = {
  language: 'zh-CN',
  tone: 'conversational',
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSLATION TABLES
// ═══════════════════════════════════════════════════════════════════════════

const IC_TRANSLATIONS: Record<string, Record<string, { range: [number, number?]; text: string; sentiment: 'positive'|'neutral'|'negative' }>> = {
  'zh-CN': {
    excellent: { range: [0.08], text: '预测能力很强', sentiment: 'positive' },
    good:      { range: [0.05, 0.08], text: '预测能力良好', sentiment: 'positive' },
    moderate:  { range: [0.03, 0.05], text: '有轻微预测力', sentiment: 'neutral' },
    weak:      { range: [0.01, 0.03], text: '预测力较弱', sentiment: 'negative' },
    none:      { range: [-Infinity, 0.01], text: '几乎没有预测力', sentiment: 'negative' },
  },
  'en': {
    excellent: { range: [0.08], text: 'strong predictive power', sentiment: 'positive' },
    good:      { range: [0.05, 0.08], text: 'good predictive power', sentiment: 'positive' },
    moderate:  { range: [0.03, 0.05], text: 'moderate predictive power', sentiment: 'neutral' },
    weak:      { range: [0.01, 0.03], text: 'weak predictive power', sentiment: 'negative' },
    none:      { range: [-Infinity, 0.01], text: 'almost no predictive power', sentiment: 'negative' },
  },
};

const SHARPE_TRANSLATIONS: Record<string, Record<string, { range: [number, number?]; text: string; sentiment: 'positive'|'neutral'|'negative' }>> = {
  'zh-CN': {
    excellent: { range: [2], text: '风险调整后收益极佳', sentiment: 'positive' },
    good:      { range: [1, 2], text: '风险调整后收益良好', sentiment: 'positive' },
    moderate:  { range: [0.5, 1], text: '风险调整后收益一般', sentiment: 'neutral' },
    weak:      { range: [0, 0.5], text: '风险调整后收益较差', sentiment: 'negative' },
    none:      { range: [-Infinity, 0], text: '风险调整后收益为负', sentiment: 'negative' },
  },
  'en': {
    excellent: { range: [2], text: 'excellent risk-adjusted return', sentiment: 'positive' },
    good:      { range: [1, 2], text: 'good risk-adjusted return', sentiment: 'positive' },
    moderate:  { range: [0.5, 1], text: 'moderate risk-adjusted return', sentiment: 'neutral' },
    weak:      { range: [0, 0.5], text: 'poor risk-adjusted return', sentiment: 'negative' },
    none:      { range: [-Infinity, 0], text: 'negative risk-adjusted return', sentiment: 'negative' },
  },
};

const MAXDD_TRANSLATIONS: Record<string, Record<string, { range: [number, number?]; text: string; risk: string; emoji: string }>> = {
  'zh-CN': {
    low:    { range: [0, 0.1], text: '很低，历史上最大回撤不到10%', risk: '低', emoji: '🟢' },
    medium: { range: [0.1, 0.2], text: '中等，历史上从峰到谷最大跌幅在10-20%', risk: '中等', emoji: '🟡' },
    high:   { range: [0.2, 0.35], text: '较高，最大回撤在20-35%，需要较强的心理承受力', risk: '高', emoji: '🟠' },
    extreme:{ range: [0.35], text: '很高，最大回撤超过35%，属于高风险策略', risk: '极高', emoji: '🔴' },
  },
  'en': {
    low:    { range: [0, 0.1], text: 'very low, max historical drawdown under 10%', risk: 'Low', emoji: '🟢' },
    medium: { range: [0.1, 0.2], text: 'moderate, peak-to-trough decline of 10-20%', risk: 'Medium', emoji: '🟡' },
    high:   { range: [0.2, 0.35], text: 'high, drawdown of 20-35%, requires strong risk tolerance', risk: 'High', emoji: '🟠' },
    extreme:{ range: [0.35], text: 'very high, drawdown exceeds 35%, high-risk strategy', risk: 'Extreme', emoji: '🔴' },
  },
};

const VOLATILITY_TRANSLATIONS: Record<string, Record<string, { range: [number, number?]; text: string }>> = {
  'zh-CN': {
    low:    { range: [0, 0.15], text: '波动较低，价格相对平稳' },
    medium: { range: [0.15, 0.30], text: '波动中等，价格有一定起伏' },
    high:   { range: [0.30, 0.50], text: '波动较高，价格起伏明显' },
    extreme:{ range: [0.50], text: '波动极高，价格如过山车' },
  },
  'en': {
    low:    { range: [0, 0.15], text: 'low volatility, relatively stable prices' },
    medium: { range: [0.15, 0.30], text: 'moderate volatility with some price swings' },
    high:   { range: [0.30, 0.50], text: 'high volatility with notable price swings' },
    extreme:{ range: [0.50], text: 'extreme volatility, rollercoaster-like prices' },
  },
};

const CORRELATION_TRANSLATIONS: Record<string, Record<string, { range: [number, number?]; text: string }>> = {
  'zh-CN': {
    strong_pos:  { range: [0.7, 1], text: '高度正相关，走势趋同' },
    moderate_pos:{ range: [0.3, 0.7], text: '中度正相关，有一定同向性' },
    weak:        { range: [-0.3, 0.3], text: '相关性很弱，走势独立' },
    moderate_neg:{ range: [-0.7, -0.3], text: '中度负相关，有一定反向性' },
    strong_neg:  { range: [-1, -0.7], text: '高度负相关，走势相反' },
  },
  'en': {
    strong_pos:  { range: [0.7, 1], text: 'strongly positively correlated, move together' },
    moderate_pos:{ range: [0.3, 0.7], text: 'moderately positively correlated' },
    weak:        { range: [-0.3, 0.3], text: 'weakly correlated, moves independently' },
    moderate_neg:{ range: [-0.7, -0.3], text: 'moderately negatively correlated' },
    strong_neg:  { range: [-1, -0.7], text: 'strongly negatively correlated, move opposite' },
  },
};

const CONFIDENCE_TRANSLATIONS: Record<string, Record<string, { range: [number, number?]; text: string }>> = {
  'zh-CN': {
    high:    { range: [0.8], text: '数据质量高，结果可信' },
    moderate:{ range: [0.5, 0.8], text: '数据质量中等，结果可作为参考' },
    low:     { range: [0], text: '数据质量较低，结果仅供参考' },
  },
  'en': {
    high:    { range: [0.8], text: 'high data quality, results are reliable' },
    moderate:{ range: [0.5, 0.8], text: 'moderate data quality, results are indicative' },
    low:     { range: [0], text: 'low data quality, results are suggestive only' },
  },
};

const SIGNAL_STRENGTH: Record<string, string> = {
  'zh-CN': 'strong:强烈买入信号|moderate:中等信号|weak:弱信号',
  'en': 'strong:Strong buy signal|moderate:Moderate signal|weak:Weak signal',
};

const DIRECTION: Record<string, string> = {
  'zh-CN': 'long:看多，适合做多|short:看空，适合做空或减仓|neutral:中性，观望为主',
  'en': 'long:Bullish, suitable for long position|short:Bearish, suitable for short or reduce|neutral:Neutral, prefer wait-and-see',
};

// ═══════════════════════════════════════════════════════════════════════════
// FACTOR HUMANIZER
// ═══════════════════════════════════════════════════════════════════════════

export class FactorHumanizer {
  private config: HumanizerConfig;

  constructor(config?: Partial<HumanizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  humanize(input: FactorHumanInput): FactorHumanResult {
    const lang = this.config.language;
    const components: FactorHumanComponent[] = [];

    // ── IC ──
    if (input.ic !== undefined) {
      const bracket = this.findBracket(IC_TRANSLATIONS[lang], input.ic);
      const rawIc = input.ic.toFixed(3);
      const icText = lang === 'zh-CN'
        ? `${bracket.text}，月度IC为${rawIc}`
        : `${bracket.text} (monthly IC = ${rawIc})`;
      components.push({ category: '预测力', key: 'ic', rawValue: rawIc, humanText: icText, sentiment: bracket.sentiment });
    }

    // ── IC Rank ──
    if (input.icRank !== undefined) {
      const pct = (input.icRank * 100).toFixed(0);
      const text = lang === 'zh-CN'
        ? `在同类因子中排名前${pct}%`
        : `ranks in the top ${pct}% among peer factors`;
      const sent = input.icRank <= 0.3 ? 'positive' : input.icRank <= 0.7 ? 'neutral' : 'negative';
      components.push({ category: '排名', key: 'icRank', rawValue: `${pct}%`, humanText: text, sentiment: sent });
    }

    // ── IR ──
    if (input.ir !== undefined) {
      const ir = input.ir;
      let text: string, sentiment: 'positive'|'neutral'|'negative';
      if (ir >= 0.5) {
        text = lang === 'zh-CN' ? '信息比优秀，因子稳定性强' : 'excellent information ratio, factor is stable';
        sentiment = 'positive';
      } else if (ir >= 0.3) {
        text = lang === 'zh-CN' ? '信息比良好' : 'good information ratio';
        sentiment = 'positive';
      } else if (ir >= 0.1) {
        text = lang === 'zh-CN' ? '信息比一般' : 'moderate information ratio';
        sentiment = 'neutral';
      } else {
        text = lang === 'zh-CN' ? '信息比较低，因子不够稳定' : 'low information ratio, factor lacks stability';
        sentiment = 'negative';
      }
      components.push({ category: '稳定性', key: 'ir', rawValue: ir.toFixed(3), humanText: text, sentiment });
    }

    // ── Sharpe ──
    if (input.sharpe !== undefined) {
      const bracket = this.findBracket(SHARPE_TRANSLATIONS[lang], input.sharpe);
      const raw = input.sharpe.toFixed(2);
      const text = lang === 'zh-CN'
        ? `${bracket.text} (Sharpe=${raw})`
        : `${bracket.text} (Sharpe = ${raw})`;
      components.push({ category: '风险调整收益', key: 'sharpe', rawValue: raw, humanText: text, sentiment: bracket.sentiment });
    }

    // ── MaxDD ──
    let riskLevel: FactorHumanResult['riskLevel'] = '低';
    let riskEmoji = '🟢';
    if (input.maxDrawdown !== undefined) {
      const bracket = this.findBracket(MAXDD_TRANSLATIONS[lang], Math.abs(input.maxDrawdown));
      const ddPct = (input.maxDrawdown * 100).toFixed(1) + '%';
      components.push({ category: '最大回撤', key: 'maxDrawdown', rawValue: ddPct, humanText: bracket.text, sentiment: 'neutral' });
      if (lang === 'zh-CN') {
        riskLevel = bracket.risk as FactorHumanResult['riskLevel'];
        riskEmoji = bracket.emoji;
      } else {
        const riskMap: Record<string, FactorHumanResult['riskLevel']> = { Low: '低', Medium: '中等', High: '高', Extreme: '极高' };
        riskLevel = riskMap[bracket.risk] ?? '中等';
        riskEmoji = bracket.emoji;
      }
    }

    // ── Volatility ──
    if (input.volatility !== undefined) {
      const bracket = this.findBracket(VOLATILITY_TRANSLATIONS[lang], input.volatility);
      const volPct = (input.volatility * 100).toFixed(1) + '%';
      components.push({ category: '波动率', key: 'volatility', rawValue: volPct, humanText: bracket.text, sentiment: 'neutral' });
    }

    // ── Annual Return ──
    if (input.annualReturn !== undefined) {
      const arPct = (input.annualReturn * 100).toFixed(1) + '%';
      let text: string, sentiment: 'positive'|'neutral'|'negative';
      if (input.annualReturn >= 0.2) {
        text = lang === 'zh-CN' ? `年化收益${arPct}，表现优秀` : `annualized return ${arPct}, excellent`;
        sentiment = 'positive';
      } else if (input.annualReturn >= 0.05) {
        text = lang === 'zh-CN' ? `年化收益${arPct}，表现尚可` : `annualized return ${arPct}, decent`;
        sentiment = 'neutral';
      } else if (input.annualReturn >= 0) {
        text = lang === 'zh-CN' ? `年化收益仅${arPct}，勉强正收益` : `annualized return only ${arPct}, barely positive`;
        sentiment = 'negative';
      } else {
        text = lang === 'zh-CN' ? `年化亏损${arPct}，策略表现不佳` : `annualized loss ${arPct}, poor performance`;
        sentiment = 'negative';
      }
      components.push({ category: '年化收益', key: 'annualReturn', rawValue: arPct, humanText: text, sentiment });
    }

    // ── Correlation ──
    if (input.correlation) {
      for (const corr of input.correlation) {
        const bracket = this.findBracket(CORRELATION_TRANSLATIONS[lang], corr.value);
        const text = lang === 'zh-CN'
          ? `与${corr.withFactor}${bracket.text} (r=${corr.value.toFixed(2)})`
          : `with ${corr.withFactor}: ${bracket.text} (r=${corr.value.toFixed(2)})`;
        const sent = Math.abs(corr.value) < 0.3 ? 'positive' : Math.abs(corr.value) < 0.7 ? 'neutral' : 'negative';
        components.push({ category: '相关性', key: `correlation_${corr.withFactor}`, rawValue: corr.value.toFixed(2), humanText: text, sentiment: sent });
      }
    }

    // ── Win Rate ──
    if (input.winRate !== undefined) {
      const wrPct = (input.winRate * 100).toFixed(1) + '%';
      const text = lang === 'zh-CN'
        ? `胜率${wrPct}，${input.winRate >= 0.55 ? '高于市场平均' : input.winRate >= 0.45 ? '与市场持平' : '低于市场平均'}`
        : `win rate ${wrPct}, ${input.winRate >= 0.55 ? 'above market average' : input.winRate >= 0.45 ? 'around market average' : 'below market average'}`;
      const sent = input.winRate >= 0.55 ? 'positive' : input.winRate >= 0.45 ? 'neutral' : 'negative';
      components.push({ category: '胜率', key: 'winRate', rawValue: wrPct, humanText: text, sentiment: sent });
    }

    // ── Confidence ──
    if (input.confidence !== undefined) {
      const bracket = this.findBracket(CONFIDENCE_TRANSLATIONS[lang], input.confidence);
      components.push({ category: '数据质量', key: 'confidence', rawValue: (input.confidence * 100).toFixed(0) + '%', humanText: bracket.text, sentiment: 'neutral' });
    }

    // ── Backtest Years ──
    if (input.backtestYears !== undefined) {
      const text = lang === 'zh-CN'
        ? `基于${input.backtestYears}年历史数据回测，${input.backtestYears >= 5 ? '覆盖多种市场环境' : '样本可能不够全面'}`
        : `backtested over ${input.backtestYears} years, ${input.backtestYears >= 5 ? 'covering various market regimes' : 'sample may be limited'}`;
      const sent = input.backtestYears >= 5 ? 'positive' : 'neutral';
      components.push({ category: '回测覆盖面', key: 'backtestYears', rawValue: `${input.backtestYears}年`, humanText: text, sentiment: sent });
    }

    // ── Factor Weight ──
    if (input.factorWeight !== undefined) {
      const text = lang === 'zh-CN'
        ? `在组合中权重${input.factorWeight}%，${input.factorWeight >= 20 ? '属于核心因子' : input.factorWeight >= 10 ? '辅助因子' : '次要因子'}`
        : `portfolio weight ${input.factorWeight}%, ${input.factorWeight >= 20 ? 'a core factor' : input.factorWeight >= 10 ? 'a supporting factor' : 'a minor factor'}`;
      components.push({ category: '组合权重', key: 'factorWeight', rawValue: input.factorWeight + '%', humanText: text, sentiment: 'neutral' });
    }

    // ── Signal Strength + Direction ──
    if (input.signalStrength === 'strong') {
      components.push({ category: '信号强度', key: 'signal', rawValue: 'strong', humanText: lang === 'zh-CN' ? '当前信号强烈' : 'signal is strong', sentiment: 'positive' });
    } else if (input.signalStrength === 'moderate') {
      components.push({ category: '信号强度', key: 'signal', rawValue: 'moderate', humanText: lang === 'zh-CN' ? '当前信号中等' : 'signal is moderate', sentiment: 'neutral' });
    }
    if (input.direction === 'long') {
      components.push({ category: '方向', key: 'direction', rawValue: 'long', humanText: lang === 'zh-CN' ? '建议做多' : 'recommend long', sentiment: 'positive' });
    } else if (input.direction === 'short') {
      components.push({ category: '方向', key: 'direction', rawValue: 'short', humanText: lang === 'zh-CN' ? '建议做空或减仓' : 'recommend short or reduce', sentiment: 'negative' });
    }

    // ── Compute overall verdict ──
    const posCount = components.filter(c => c.sentiment === 'positive').length;
    const negCount = components.filter(c => c.sentiment === 'negative').length;
    const total = components.length || 1;
    const score = (posCount - negCount) / total;
    let verdict: FactorHumanResult['verdict'], verdictEmoji: string;
    if (score >= 0.5) { verdict = '优秀'; verdictEmoji = '🌟'; }
    else if (score >= 0.2) { verdict = '良好'; verdictEmoji = '👍'; }
    else if (score >= -0.2) { verdict = '一般'; verdictEmoji = '➖'; }
    else if (score >= -0.5) { verdict = '较差'; verdictEmoji = '⚠️'; }
    else { verdict = '无效'; verdictEmoji = '🚫'; }

    // ── Summary ──
    const summary = this.buildSummary(input, lang, verdict);

    // ── Detail ──
    const detail = this.buildDetail(input, components, lang);

    // ── Suggestion ──
    const suggestion = this.buildSuggestion(input, verdict, riskLevel, lang);

    return { summary, detail, components, verdict, verdictEmoji, riskLevel, riskEmoji, suggestion };
  }

  /** Batch humanize multiple factors */
  humanizeBatch(inputs: FactorHumanInput[]): FactorHumanResult[] {
    return inputs.map(i => this.humanize(i));
  }

  /** Update config */
  setConfig(updates: Partial<HumanizerConfig>): void {
    Object.assign(this.config, updates);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════

  private findBracket<T>(table: Record<string, T & { range: [number, number?] }>, value: number): T & { range: [number, number?] } {
    for (const key of Object.keys(table)) {
      const entry = table[key];
      const [min, max] = entry.range;
      if (max === undefined) {
        if (value >= min) return entry;
      } else {
        if (value >= min && value < max) return entry;
      }
    }
    return table[Object.keys(table)[Object.keys(table).length - 1]];
  }

  private buildSummary(input: FactorHumanInput, lang: string, verdict: string): string {
    if (lang === 'zh-CN') {
      const name = input.factorName || input.factorId;
      let s = `「${name}」综合评级: ${verdict}。`;
      if (input.maxDrawdown !== undefined) {
        const ddPct = (Math.abs(input.maxDrawdown) * 100).toFixed(0) + '%';
        s += `最大回撤${ddPct}。`;
      }
      if (input.sharpe !== undefined && input.sharpe > 0) {
        s += `夏普比${input.sharpe.toFixed(2)}。`;
      }
      return s;
    }
    const name = input.factorName || input.factorId;
    let s = `"${name}" overall rating: ${verdict}. `;
    if (input.maxDrawdown !== undefined) s += `Max DD ${(Math.abs(input.maxDrawdown)*100).toFixed(0)}%. `;
    if (input.sharpe !== undefined && input.sharpe > 0) s += `Sharpe ${input.sharpe.toFixed(2)}.`;
    return s;
  }

  private buildDetail(input: FactorHumanInput, components: FactorHumanComponent[], lang: string): string {
    const name = input.factorName || input.factorId;
    const prefix = lang === 'zh-CN'
      ? `因子「${name}」的详细分析如下:\n`
      : `Detailed analysis for factor "${name}":\n`;

    const lines = components.map(c => {
      const icon = c.sentiment === 'positive' ? '✅' : c.sentiment === 'negative' ? '⚠️' : 'ℹ️';
      return `  ${icon} **${c.category}**: ${c.humanText}`;
    });

    return prefix + lines.join('\n');
  }

  private buildSuggestion(
    input: FactorHumanInput,
    verdict: FactorHumanResult['verdict'],
    riskLevel: FactorHumanResult['riskLevel'],
    lang: string,
  ): string {
    if (lang === 'zh-CN') {
      if (verdict === '优秀' || verdict === '良好') {
        if (riskLevel === '高' || riskLevel === '极高') {
          return '策略表现好但风险较高，建议控制仓位，不超过总资金的10%';
        }
        return '该因子可作为核心组合的一部分，建议持续跟踪';
      } else if (verdict === '一般') {
        return '因子表现中规中矩，可作为辅助因子，不建议重仓';
      } else {
        return '该因子暂时不适合使用，建议关注其他替代因子';
      }
    }
    if (verdict === '优秀' || verdict === '良好') {
      return riskLevel === '高' || riskLevel === '极高'
        ? 'Good performance but high risk. Consider limiting to 10% allocation.'
        : 'This factor can serve as a core portfolio component. Monitor regularly.';
    } else if (verdict === '一般') {
      return 'Decent but not outstanding. Use as a supporting factor, not a core holding.';
    }
    return 'This factor is not recommended at this time. Consider alternative factors.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON + QUICK HELPERS
// ═══════════════════════════════════════════════════════════════════════════

let _instance: FactorHumanizer | null = null;

export function getFactorHumanizer(config?: Partial<HumanizerConfig>): FactorHumanizer {
  if (!_instance) _instance = new FactorHumanizer(config);
  return _instance;
}

export function humanizeFactor(input: FactorHumanInput, config?: Partial<HumanizerConfig>): FactorHumanResult {
  return getFactorHumanizer(config).humanize(input);
}

export function humanizeFactors(inputs: FactorHumanInput[], config?: Partial<HumanizerConfig>): FactorHumanResult[] {
  return getFactorHumanizer(config).humanizeBatch(inputs);
}

export default { FactorHumanizer, getFactorHumanizer, humanizeFactor, humanizeFactors };
