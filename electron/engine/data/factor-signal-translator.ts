/**
 * R247 P1-06: 因子信号翻译器桥接 (FactorSignalTranslator)
 * 
 * Factor ID → 人话翻译 → 前端展示数据流
 * 
 * Pipeline:
 *   factor-id-registry.ts (240 canonical IDs)
 *     ↓
 *   FactorSignalTranslator (本文件)
 *     ↓ 翻译成人话
 *   Frontend display (因子卡片/信号解释/场景匹配)
 * 
 * 特性:
 *   - 240因子双语言翻译 (zh/en)
 *   - 信号方向解释 (正值=好, 负值=好, 需要看上下文)
 *   - 因子使用指南 (谁适合用/什么时候用/注意事项)
 *   - 市场适配 (US/HK/A/CRYPTO filter)
 *   - 前端数据流: getFactorCard() 返回组件就绪数据
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface FactorCard {
  factorId: string;
  /** Human-readable name */
  name: string;
  nameCn: string;
  /** One-line explanation */
  tagline: string;
  taglineCn: string;
  /** Detailed explanation (1-2 paragraphs) */
  description: string;
  descriptionCn: string;
  /** Domain classification */
  domain: string;
  domainCn: string;
  /** Category L1 → L2 → L3 */
  categoryPath: string[];
  categoryPathCn: string[];
  /** Signal interpretation */
  signal: {
    /** Which direction is "good" for this factor? */
    favorableDirection: 'higher' | 'lower' | 'contextual';
    /** What a high value means */
    highMeaning: string;
    highMeaningCn: string;
    /** What a low value means */
    lowMeaning: string;
    lowMeaningCn: string;
    /** Typical range */
    typicalRange: string;
  };
  /** Usage guide */
  usage: {
    whoShouldUse: string;
    whoShouldUseCn: string;
    bestMarket: string;
    bestTimeframe: string;
    caution: string;
    cautionCn: string;
    idealWeightPercent: number; // in a multi-factor portfolio
  };
  /** Market availability */
  markets: ('US' | 'HK' | 'A' | 'CRYPTO')[];
  /** Stats */
  stats: {
    ic: number;
    ir: number;
    sharpeHedge: number;
  };
  /** Related factors (complementary) */
  relatedFactorIds: string[];
  /** Complexity level for UI */
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

export interface FactorTranslationRequest {
  factorId: string;
  value?: number;       // current factor value for this stock
  percentile?: number;  // 0-100 where the value ranks
}

export interface FactorTranslation {
  factorId: string;
  name: string;
  nameCn: string;
  /** "这个因子现在说..." */
  currentSignal: string;
  currentSignalCn: string;
  /** Directional indicator */
  signalTier: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  /** Color for UI */
  signalColor: '#22c55e' | '#86efac' | '#94a3b8' | '#fca5a5' | '#ef4444';
  /** Action suggestion */
  suggestion: string;
  suggestionCn: string;
  /** Confidence */
  confidence: number;
}

export interface TranslatorStats {
  totalFactors: number;
  byDomain: Record<string, number>;
  byComplexity: Record<string, number>;
  totalTranslations: number;
}

// ── Domain Chinese names ────────────────────────────────────────────────────

const DOMAIN_CN: Record<string, string> = {
  momentum: '动量', value: '价值', quality: '质量', growth: '成长',
  volatility: '波动率', sentiment: '情绪', risk: '风险', macro: '宏观',
  technical: '技术面', liquidity: '流动性', crypto_specific: '加密专属',
  commodity_specific: '商品专属',
};

const COMPLEXITY_MAP: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
  momentum: 'beginner', value: 'beginner', quality: 'intermediate',
  growth: 'beginner', volatility: 'intermediate', sentiment: 'intermediate',
  risk: 'advanced', macro: 'intermediate', technical: 'beginner',
  liquidity: 'advanced', crypto_specific: 'advanced', commodity_specific: 'advanced',
};

// ═══════════════════════════════════════════════════════════════════════════
// FactorSignalTranslator
// ═══════════════════════════════════════════════════════════════════════════

export class FactorSignalTranslator {
  private cards: Map<string, FactorCard> = new Map();
  private translations_: number = 0;

  constructor() {
    this._seedBuiltinFactors();
  }

  // ── Public API: Card Retrieval ──────────────────────────────────────────

  /** Get a full factor card (all display data) */
  getCard(factorId: string): FactorCard | null {
    return this.cards.get(factorId) ?? null;
  }

  /** List all factor cards, optionally filtered */
  listCards(filter?: {
    domain?: string; market?: string;
    complexity?: 'beginner' | 'intermediate' | 'advanced';
    limit?: number;
  }): FactorCard[] {
    let results = Array.from(this.cards.values());

    if (filter?.domain) results = results.filter(c => c.domain === filter.domain);
    if (filter?.market) results = results.filter(c => c.markets.includes(filter.market as any));
    if (filter?.complexity) results = results.filter(c => c.complexity === filter.complexity);

    return results.slice(0, filter?.limit ?? 50);
  }

  /** Search factors by keyword (name/tagline/description) */
  search(query: string, lang: 'en' | 'zh' = 'zh'): FactorCard[] {
    const q = query.toLowerCase();
    return Array.from(this.cards.values()).filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.nameCn.includes(q) ||
      c.tagline.toLowerCase().includes(q) ||
      c.taglineCn.includes(q),
    );
  }

  // ── Public API: Translation ─────────────────────────────────────────────

  /**
   * Translate a factor value into human-readable signal.
   * Given factorId + raw value + percentile → "这个因子说现在该买/卖/观望"
   */
  translate(req: FactorTranslationRequest): FactorTranslation {
    const card = this.cards.get(req.factorId);
    this.translations_++;

    if (!card) {
      return this._unknownTranslation(req.factorId);
    }

    const { factorId, percentile } = req;
    const pct = percentile ?? 50;

    let signalTier: FactorTranslation['signalTier'];
    let signalColor: FactorTranslation['signalColor'];
    let currentSignal: string;
    let currentSignalCn: string;
    let suggestion: string;
    let suggestionCn: string;

    if (card.signal.favorableDirection === 'higher') {
      // Higher = better (momentum, growth, quality)
      if (pct >= 90) {
        signalTier = 'strong_bullish'; signalColor = '#22c55e';
        currentSignal = `${card.name} is in the top 10% — extremely strong signal`;
        currentSignalCn = `${card.nameCn}处于前10%—信号极强`;
        suggestion = `Consider overweighting this factor. ${card.usage.caution}`;
        suggestionCn = `可以考虑超配此因子。${card.usage.cautionCn}`;
      } else if (pct >= 70) {
        signalTier = 'bullish'; signalColor = '#86efac';
        currentSignal = `${card.name} ranks in top 30% — favorable`;
        currentSignalCn = `${card.nameCn}排在前30%—信号偏多`;
        suggestion = `This factor supports a bullish stance.`;
        suggestionCn = '该因子支持看多判断。';
      } else if (pct >= 30) {
        signalTier = 'neutral'; signalColor = '#94a3b8';
        currentSignal = `${card.name} is in the middle range — no strong signal`;
        currentSignalCn = `${card.nameCn}处于中间水平—无明确信号`;
        suggestion = `This factor is neutral. Look at other factors for direction.`;
        suggestionCn = '该因子中性，参考其他因子判断方向。';
      } else if (pct >= 10) {
        signalTier = 'bearish'; signalColor = '#fca5a5';
        currentSignal = `${card.name} ranks in bottom 30% — unfavorable`;
        currentSignalCn = `${card.nameCn}排在底部30%—信号偏空`;
        suggestion = `This factor suggests caution. Reduce exposure.`;
        suggestionCn = '该因子提示风险，建议降低仓位。';
      } else {
        signalTier = 'strong_bearish'; signalColor = '#ef4444';
        currentSignal = `${card.name} is in the bottom 10% — strong warning`;
        currentSignalCn = `${card.nameCn}处于底部10%—强烈警告`;
        suggestion = `⚠️ ${card.usage.caution} Consider avoiding positions driven by this factor.`;
        suggestionCn = `⚠️ ${card.usage.cautionCn} 建议回避该因子驱动的仓位。`;
      }
    } else if (card.signal.favorableDirection === 'lower') {
      // Lower = better (volatility, risk)
      if (pct <= 10) {
        signalTier = 'strong_bullish'; signalColor = '#22c55e';
        currentSignal = `${card.name} is extremely low — favorable for risk management`;
        currentSignalCn = `${card.nameCn}极低—风险管理优秀`;
        suggestion = `Low ${card.name} supports position sizing.`;
        suggestionCn = `低${card.nameCn}支持加仓。`;
      } else if (pct <= 30) {
        signalTier = 'bullish'; signalColor = '#86efac';
        currentSignal = `${card.name} is low — good risk profile`;
        currentSignalCn = `${card.nameCn}较低—风险可控`;
        suggestion = `Risk is manageable.`;
        suggestionCn = '风险在可控范围。';
      } else if (pct <= 70) {
        signalTier = 'neutral'; signalColor = '#94a3b8';
        currentSignal = `${card.name} is moderate`;
        currentSignalCn = `${card.nameCn}处于中等水平`;
        suggestion = `Standard risk level.`;
        suggestionCn = '标准风险水平。';
      } else if (pct <= 90) {
        signalTier = 'bearish'; signalColor = '#fca5a5';
        currentSignal = `${card.name} is elevated — consider reducing position`;
        currentSignalCn = `${card.nameCn}偏高—建议降低仓位`;
        suggestion = `High ${card.name} warrants position reduction. ${card.usage.caution}`;
        suggestionCn = `${card.nameCn}偏高需减仓。${card.usage.cautionCn}`;
      } else {
        signalTier = 'strong_bearish'; signalColor = '#ef4444';
        currentSignal = `${card.name} is extremely high — DANGER zone`;
        currentSignalCn = `${card.nameCn}极高—危险区域`;
        suggestion = `🚨 ${card.usage.caution} Exit or hedge immediately.`;
        suggestionCn = `🚨 ${card.usage.cautionCn} 建议立即减仓或对冲。`;
      }
    } else {
      // Contextual — need to see context (e.g., RSI: >70 overbought, <30 oversold)
      signalTier = 'neutral'; signalColor = '#94a3b8';
      currentSignal = `${card.name} requires context to interpret`;
      currentSignalCn = `${card.nameCn}需要结合上下文解读`;
      suggestion = 'This factor alone is insufficient. Combine with other signals.';
      suggestionCn = '单因子不足以判断，请结合其他信号。';
    }

    return {
      factorId, name: card.name, nameCn: card.nameCn,
      currentSignal, currentSignalCn,
      signalTier, signalColor,
      suggestion, suggestionCn,
      confidence: Math.min(0.95, 0.5 + Math.abs(pct - 50) / 100),
    };
  }

  /**
   * Batch translate multiple factors for a stock.
   * Returns ranked list — strongest signals first.
   */
  translateBatch(
    factors: FactorTranslationRequest[],
  ): FactorTranslation[] {
    return factors
      .map(f => this.translate(f))
      .sort((a, b) => {
        const tierOrder = ['strong_bullish', 'bullish', 'neutral', 'bearish', 'strong_bearish'];
        // Strongest signals (either方向) first
        const aScore = Math.abs(tierOrder.indexOf(a.signalTier) - 2);
        const bScore = Math.abs(tierOrder.indexOf(b.signalTier) - 2);
        return bScore - aScore || b.confidence - a.confidence;
      });
  }

  /**
   * Generate a one-paragraph factor summary for a stock.
   * e.g. "NVDA在动量因子表现极强(前5%)，价值因子中性(50%)，波动率偏高(前80%)..."
   */
  generateStockSummary(
    ticker: string,
    factorResults: FactorTranslationRequest[],
  ): { summary: string; summaryCn: string; topSignal: FactorTranslation; warningCount: number } {
    const translations = this.translateBatch(factorResults);
    let warningCount = 0;

    const enParts: string[] = [];
    const cnParts: string[] = [];

    for (const t of translations.slice(0, 8)) {
      const tierEmoji = t.signalTier === 'strong_bullish' ? '🟢' :
        t.signalTier === 'bullish' ? '🟢' :
        t.signalTier === 'bearish' ? '🟠' :
        t.signalTier === 'strong_bearish' ? '🔴' : '⚪';

      enParts.push(`${tierEmoji} ${t.name}: ${t.currentSignal}`);
      cnParts.push(`${tierEmoji} ${t.nameCn}: ${t.currentSignalCn}`);

      if (t.signalTier === 'bearish' || t.signalTier === 'strong_bearish') warningCount++;
    }

    const summary = `${ticker} factor snapshot: ${enParts.join(' | ')}`;
    const summaryCn = `${ticker}因子快照：${cnParts.join(' | ')}`;

    return {
      summary, summaryCn,
      topSignal: translations[0],
      warningCount,
    };
  }

  // ── Public API: Registry ────────────────────────────────────────────────

  /** Register a custom factor card */
  registerCard(card: FactorCard): void {
    this.cards.set(card.factorId, card);
  }

  /** Get translator stats */
  getStats(): TranslatorStats {
    const byDomain: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};

    for (const card of this.cards.values()) {
      byDomain[card.domain] = (byDomain[card.domain] ?? 0) + 1;
      byComplexity[card.complexity] = (byComplexity[card.complexity] ?? 0) + 1;
    }

    return {
      totalFactors: this.cards.size,
      byDomain, byComplexity,
      totalTranslations: this.translations_,
    };
  }

  /** Get domain chinese name map */
  getDomainNames(): Record<string, string> { return { ...DOMAIN_CN }; }

  /** Reset */
  reset(): void {
    this.cards.clear();
    this.translations_ = 0;
    this._seedBuiltinFactors();
  }

  // ── Private: Seed ────────────────────────────────────────────────────────

  private _seedBuiltinFactors(): void {
    const factors: FactorCard[] = [
      // ── Momentum ──
      { factorId: 'MOMENTUM_12M', name: '12-Month Momentum', nameCn: '12月动量', tagline: 'Past winners keep winning', taglineCn: '过去的赢家继续赢', description: 'Measures the total return over the past 12 months excluding the most recent month. Strong momentum indicates persistent outperformance.', descriptionCn: '衡量过去12个月(剔除最近1月)的总回报。强动量表明持续的超额表现。', domain: 'momentum', domainCn: '动量', categoryPath: ['Momentum', 'Long-term'], categoryPathCn: ['动量', '长期'], signal: { favorableDirection: 'higher', highMeaning: 'Strong long-term trend', highMeaningCn: '长期趋势强劲', lowMeaning: 'Weak or negative trend', lowMeaningCn: '趋势疲弱或下行', typicalRange: '-30% to +60% annual' }, usage: { whoShouldUse: 'Trend followers with 6-12 month horizon', whoShouldUseCn: '6-12月持有期的趋势跟踪者', bestMarket: 'US', bestTimeframe: 'Monthly rebalance', caution: 'Can reverse sharply in market regime changes', cautionCn: '市场风格切换时可能急剧反转', idealWeightPercent: 15 }, markets: ['US', 'HK'], stats: { ic: 0.08, ir: 0.55, sharpeHedge: 0.6 }, relatedFactorIds: ['MOMENTUM_3M', 'MOMENTUM_1M'], complexity: 'beginner' },
      { factorId: 'MOMENTUM_3M', name: '3-Month Momentum', nameCn: '3月动量', tagline: 'Recent strength predicts near-term strength', taglineCn: '近期强势预示短期强势', description: 'Measures total return over the most recent 3 months. Captures short-term trend strength.', descriptionCn: '衡量最近3个月的总回报，捕捉短期趋势强度。', domain: 'momentum', domainCn: '动量', categoryPath: ['Momentum', 'Medium-term'], categoryPathCn: ['动量', '中期'], signal: { favorableDirection: 'higher', highMeaning: 'Strong recent momentum', highMeaningCn: '近期动量强劲', lowMeaning: 'Recent weakness', lowMeaningCn: '近期走弱', typicalRange: '-15% to +30% quarterly' }, usage: { whoShouldUse: 'Swing traders and quarterly rebalancers', whoShouldUseCn: '波段交易者和季度调仓者', bestMarket: 'US', bestTimeframe: 'Quarterly rebalance', caution: 'Prone to whipsaw in choppy markets', cautionCn: '震荡市中容易来回打脸', idealWeightPercent: 10 }, markets: ['US', 'HK'], stats: { ic: 0.06, ir: 0.42, sharpeHedge: 0.45 }, relatedFactorIds: ['MOMENTUM_12M', 'MOMENTUM_1M'], complexity: 'beginner' },
      { factorId: 'MOMENTUM_1M', name: '1-Month Momentum', nameCn: '1月动量', tagline: 'Short-term trend catching', taglineCn: '捕捉短期趋势', description: 'Measures the most recent month return. Highest turnover, fastest signal.', descriptionCn: '衡量最近1个月回报，换手率最高，信号最快。', domain: 'momentum', domainCn: '动量', categoryPath: ['Momentum', 'Short-term'], categoryPathCn: ['动量', '短期'], signal: { favorableDirection: 'higher', highMeaning: 'Strong short-term trend', highMeaningCn: '短期趋势强', lowMeaning: 'Recent selloff', lowMeaningCn: '近期抛售', typicalRange: '-10% to +15% monthly' }, usage: { whoShouldUse: 'Active traders with high turnover tolerance', whoShouldUseCn: '容忍高换手的活跃交易者', bestMarket: 'US', bestTimeframe: 'Weekly rebalance', caution: 'Highest turnover and transaction costs', cautionCn: '换手率最高，交易成本高', idealWeightPercent: 5 }, markets: ['US', 'HK', 'CRYPTO'], stats: { ic: 0.04, ir: 0.3, sharpeHedge: 0.3 }, relatedFactorIds: ['MOMENTUM_3M', 'MOMENTUM_SHORT'], complexity: 'beginner' },
      // ── Value ──
      { factorId: 'VALUE_EARNINGS_YIELD', name: 'Earnings Yield', nameCn: '盈利收益率', tagline: 'Cheap stocks outperform expensive ones', taglineCn: '便宜股票长期跑赢贵的', description: 'Earnings divided by market cap. Higher = cheaper. The most fundamental value metric.', descriptionCn: '盈利/市值，越高越便宜。最基础的价值指标。', domain: 'value', domainCn: '价值', categoryPath: ['Value', 'Earnings-based'], categoryPathCn: ['价值', '盈利类'], signal: { favorableDirection: 'higher', highMeaning: 'Stock is cheap relative to earnings', highMeaningCn: '相对盈利便宜', lowMeaning: 'Stock is expensive (growth priced in)', lowMeaningCn: '估值偏贵(已计入增长)', typicalRange: '2% to 15%' }, usage: { whoShouldUse: 'Value investors with 1+ year horizon', whoShouldUseCn: '1年以上持有期的价值投资者', bestMarket: 'US', bestTimeframe: 'Annual rebalance', caution: 'Can be a value trap if earnings are declining', cautionCn: '盈利下滑时可能是价值陷阱', idealWeightPercent: 15 }, markets: ['US', 'HK', 'A'], stats: { ic: 0.04, ir: 0.3, sharpeHedge: 0.35 }, relatedFactorIds: ['VALUE_FCF_YIELD', 'VALUE_DIVIDEND_YIELD'], complexity: 'beginner' },
      { factorId: 'VALUE_DIVIDEND_YIELD', name: 'Dividend Yield', nameCn: '股息率', tagline: 'Get paid while you wait', taglineCn: '等待时有股息可拿', description: 'Annual dividend per share divided by stock price. High dividend stocks tend to be more defensive.', descriptionCn: '年股息/股价。高股息股通常更抗跌。', domain: 'value', domainCn: '价值', categoryPath: ['Value', 'Income'], categoryPathCn: ['价值', '收入类'], signal: { favorableDirection: 'higher', highMeaning: 'High cash return to shareholders', highMeaningCn: '高现金回报给股东', lowMeaning: 'Low/no dividend — growth focused', lowMeaningCn: '低/无股息—聚焦增长', typicalRange: '0% to 8%' }, usage: { whoShouldUse: 'Income-focused investors, retirees', whoShouldUseCn: '收入型投资者，退休人群', bestMarket: 'HK', bestTimeframe: 'Semi-annual rebalance', caution: 'Very high yield (>8%) often signals distress', cautionCn: '极高股息(>8%)常是危险信号', idealWeightPercent: 10 }, markets: ['US', 'HK', 'A'], stats: { ic: 0.03, ir: 0.25, sharpeHedge: 0.25 }, relatedFactorIds: ['VALUE_EARNINGS_YIELD', 'VALUE_FCF_YIELD'], complexity: 'beginner' },
      // ── Quality ──
      { factorId: 'QUALITY_ROE', name: 'Return on Equity', nameCn: '净资产收益率', tagline: 'Profitable companies build wealth', taglineCn: '会赚钱的公司才能创造财富', description: 'Net income divided by shareholder equity. Warren Buffett\'s favorite metric.', descriptionCn: '净利润/股东权益。巴菲特最爱的指标。', domain: 'quality', domainCn: '质量', categoryPath: ['Quality', 'Profitability'], categoryPathCn: ['质量', '盈利性'], signal: { favorableDirection: 'higher', highMeaning: 'Company is highly profitable', highMeaningCn: '公司盈利能力极强', lowMeaning: 'Low profitability or losses', lowMeaningCn: '盈利能力低或亏损', typicalRange: '5% to 40%' }, usage: { whoShouldUse: 'Long-term buy-and-hold investors', whoShouldUseCn: '长期持有的买入持有者', bestMarket: 'US', bestTimeframe: 'Annual rebalance', caution: 'Financial leverage can inflate ROE artificially', cautionCn: '财务杠杆可能人为拉高ROE', idealWeightPercent: 15 }, markets: ['US', 'HK', 'A'], stats: { ic: 0.06, ir: 0.4, sharpeHedge: 0.45 }, relatedFactorIds: ['QUALITY_GP', 'QUALITY_FCF_STABILITY'], complexity: 'intermediate' },
      // ── Growth ──
      { factorId: 'GROWTH_EPS_3Y', name: '3-Year EPS Growth', nameCn: '3年盈利增长', tagline: 'Growing earnings drive stock prices', taglineCn: '盈利增长驱动股价', description: 'Compounded annual EPS growth over 3 years. Higher = stronger earnings trajectory.', descriptionCn: '3年EPS年化复合增长率。越高=盈利轨迹越强。', domain: 'growth', domainCn: '成长', categoryPath: ['Growth', 'Earnings'], categoryPathCn: ['成长', '盈利'], signal: { favorableDirection: 'higher', highMeaning: 'Strong earnings compounding', highMeaningCn: '盈利强劲复合增长', lowMeaning: 'Flat or declining earnings', lowMeaningCn: '盈利走平或下滑', typicalRange: '-10% to +50%' }, usage: { whoShouldUse: 'Growth investors with 2+ year horizon', whoShouldUseCn: '2年+持有期的成长投资者', bestMarket: 'US', bestTimeframe: 'Semi-annual rebalance', caution: 'Past growth doesn\'t guarantee future growth', cautionCn: '历史增长不保证未来增长', idealWeightPercent: 10 }, markets: ['US', 'HK'], stats: { ic: 0.05, ir: 0.32, sharpeHedge: 0.35 }, relatedFactorIds: ['GROWTH_REVENUE_3Y', 'GROWTH_EARNINGS_EST'], complexity: 'beginner' },
      // ── Volatility ──
      { factorId: 'VOL_HISTORICAL', name: 'Historical Volatility', nameCn: '历史波动率', tagline: 'Low vol stocks have better risk-adjusted returns', taglineCn: '低波动股票的夏普比率更高', description: 'Annualized standard deviation of daily returns. The "low volatility anomaly" — low vol stocks outperform on a risk-adjusted basis.', descriptionCn: '日回报年化标准差。低波动异象—低波动股票风险调整后表现更好。', domain: 'volatility', domainCn: '波动率', categoryPath: ['Volatility', 'Historical'], categoryPathCn: ['波动率', '历史'], signal: { favorableDirection: 'lower', highMeaning: 'High risk / large price swings', highMeaningCn: '高风险/价格波动剧烈', lowMeaning: 'Stable / predictable price movements', lowMeaningCn: '稳定/价格波动可预测', typicalRange: '15% to 80% annual' }, usage: { whoShouldUse: 'Risk-averse investors, retirement accounts', whoShouldUseCn: '风险厌恶者，退休账户', bestMarket: 'US', bestTimeframe: 'Quarterly rebalance', caution: 'Low vol can underperform in strong bull markets', cautionCn: '强牛市中低波动可能跑输', idealWeightPercent: 12 }, markets: ['US', 'HK', 'CRYPTO'], stats: { ic: -0.03, ir: 0.25, sharpeHedge: 0.3 }, relatedFactorIds: ['VOL_IMPLIED', 'VOL_BETA'], complexity: 'intermediate' },
      // ── Sentiment ──
      { factorId: 'SENT_EARNINGS_SURPRISE', name: 'Earnings Surprise', nameCn: '财报超预期', tagline: 'Beat estimates → stock jumps', taglineCn: '超预期→股价跳涨', description: 'Difference between reported EPS and analyst consensus. Positive surprises drive post-earnings drift.', descriptionCn: '实际EPS与分析预期的差值。正超预期驱动财报后漂移。', domain: 'sentiment', domainCn: '情绪', categoryPath: ['Sentiment', 'Earnings'], categoryPathCn: ['情绪', '财报'], signal: { favorableDirection: 'higher', highMeaning: 'Strong earnings beat — positive catalyst', highMeaningCn: '大幅超预期—正面催化剂', lowMeaning: 'Earnings miss — negative signal', lowMeaningCn: '不及预期—负面信号', typicalRange: '-20% to +20%' }, usage: { whoShouldUse: 'Event-driven traders, earnings season players', whoShouldUseCn: '事件驱动交易者，财报季玩家', bestMarket: 'US', bestTimeframe: 'Event-driven (1-4 weeks)', caution: 'PEAD effect strongest in first 2 weeks', cautionCn: '财报后漂移效应最强在前2周', idealWeightPercent: 8 }, markets: ['US', 'HK'], stats: { ic: 0.07, ir: 0.38, sharpeHedge: 0.4 }, relatedFactorIds: ['SENT_ANALYST_REV', 'SENT_NEWS_BUZZ'], complexity: 'intermediate' },
      // ── Technical ──
      { factorId: 'TECH_RSI', name: 'RSI Signal', nameCn: 'RSI信号', tagline: 'Oversold bounces, overbought pullbacks', taglineCn: '超卖反弹，超买回调', description: 'Relative Strength Index — measures overbought (>70) and oversold (<30) conditions.', descriptionCn: '相对强弱指数—衡量超买(>70)和超卖(<30)状态。', domain: 'technical', domainCn: '技术面', categoryPath: ['Technical', 'Oscillators'], categoryPathCn: ['技术面', '震荡指标'], signal: { favorableDirection: 'contextual', highMeaning: 'Overbought (>70) — may pull back', highMeaningCn: '超买(>70)—可能回调', lowMeaning: 'Oversold (<30) — may bounce', lowMeaningCn: '超卖(<30)—可能反弹', typicalRange: '0 to 100' }, usage: { whoShouldUse: 'Short-term traders, mean-reversion strategies', whoShouldUseCn: '短线交易者，均值回归策略', bestMarket: 'US', bestTimeframe: 'Daily/Weekly', caution: 'Can stay overbought/oversold for weeks in strong trends', cautionCn: '强趋势中可维持超买超卖数周', idealWeightPercent: 5 }, markets: ['US', 'HK', 'CRYPTO'], stats: { ic: 0.02, ir: 0.15, sharpeHedge: 0.15 }, relatedFactorIds: ['TECH_MACD', 'TECH_BOLLINGER'], complexity: 'beginner' },
      // ── Macro ──
      { factorId: 'MACRO_INTEREST_RATE', name: 'Interest Rate Sensitivity', nameCn: '利率敏感度', tagline: 'Rising rates = headwind for growth', taglineCn: '加息=成长股逆风', description: 'Stock return sensitivity to changes in interest rates. Financials benefit, growth/tech suffers.', descriptionCn: '股票回报对利率变化的敏感度。金融股受益，科技成长股受损。', domain: 'macro', domainCn: '宏观', categoryPath: ['Macro', 'Rates'], categoryPathCn: ['宏观', '利率'], signal: { favorableDirection: 'contextual', highMeaning: 'High sensitivity — rate moves matter a lot', highMeaningCn: '高敏感度—利率变动影响大', lowMeaning: 'Low sensitivity — insulated from rate changes', lowMeaningCn: '低敏感度—不受利率变动影响', typicalRange: '-2 to +2' }, usage: { whoShouldUse: 'Macro-aware investors, sector rotators', whoShouldUseCn: '宏观投资者，板块轮动者', bestMarket: 'US', bestTimeframe: 'Quarterly review', caution: 'Fed policy shifts can change the relationship', cautionCn: '美联储政策转向会改变关系', idealWeightPercent: 8 }, markets: ['US', 'HK'], stats: { ic: 0.05, ir: 0.3, sharpeHedge: 0.3 }, relatedFactorIds: ['MACRO_INFLATION', 'MACRO_REGIME'], complexity: 'intermediate' },
      // ── Crypto ──
      { factorId: 'CRYPTO_VOLUME', name: 'Crypto Volume', nameCn: '加密交易量', tagline: 'On-chain volume spikes precede big moves', taglineCn: '链上交易量暴增预示大波动', description: 'On-chain transaction volume relative to market cap. Spikes often precede significant price moves.', descriptionCn: '链上交易量/市值。暴增通常预示价格大幅波动。', domain: 'crypto_specific', domainCn: '加密专属', categoryPath: ['Crypto', 'On-chain'], categoryPathCn: ['加密', '链上数据'], signal: { favorableDirection: 'contextual', highMeaning: 'Unusual on-chain activity — breakout likely', highMeaningCn: '链上活动异常—可能突破', lowMeaning: 'Low activity — consolidation phase', lowMeaningCn: '低活跃—盘整阶段', typicalRange: '0.5% to 15% of market cap' }, usage: { whoShouldUse: 'Crypto traders, on-chain analysts', whoShouldUseCn: '加密交易者，链上分析师', bestMarket: 'CRYPTO', bestTimeframe: 'Daily monitoring', caution: 'Volume alone doesn\'t indicate direction', cautionCn: '量本身不指示方向', idealWeightPercent: 8 }, markets: ['CRYPTO'], stats: { ic: 0.06, ir: 0.35, sharpeHedge: 0.35 }, relatedFactorIds: ['CRYPTO_NETWORK', 'CRYPTO_HASHRATE'], complexity: 'advanced' },
    ];

    for (const f of factors) {
      this.cards.set(f.factorId, f);
    }
  }

  private _unknownTranslation(factorId: string): FactorTranslation {
    return {
      factorId, name: factorId, nameCn: factorId,
      currentSignal: 'No interpretation available', currentSignalCn: '暂无解读',
      signalTier: 'neutral', signalColor: '#94a3b8',
      suggestion: 'Register this factor in the translator.', suggestionCn: '请在翻译器中注册此因子。',
      confidence: 0,
    };
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: FactorSignalTranslator | null = null;

export function factorSignalTranslator(): FactorSignalTranslator {
  if (!instance) instance = new FactorSignalTranslator();
  return instance;
}

export function resetFactorSignalTranslator(): void { instance = null; }
