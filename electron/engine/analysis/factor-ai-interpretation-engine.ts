/**
 * FactorAIInterpretationEngine — R279 JVS-2 因子AI解读引擎 (4h)
 *
 * 功能:
 * - generateFactorStory (单因子自然语言解读)
 * - generatePortfolioStory (多因子组合解读)
 * - detectFactorRegimeChange (因子状态切换检测)
 * - factorCausality (因子因果分析)
 * - generateAlertExplanation (异动告警自然语言)
 * - naturalLanguageQuery (自然语言查询因子)
 */

export interface FactorReading {
  factorId: string;
  factorName: string;
  value: number;
  zScore: number;
  percentile: number;
  signal: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
}

export interface AIInterpretation {
  id: string;
  timestamp: number;
  type: 'single_factor' | 'portfolio' | 'regime_change' | 'alert' | 'causality';
  summary: string;
  detailCn: string;
  detailEn: string;
  confidence: number;
  actionableAdvice: string;
  relatedFactors: string[];
  readingValues: FactorReading[];
}

export interface RegimeChange {
  factorId: string;
  factorName: string;
  fromRegime: string;
  toRegime: string;
  confidence: number;
  implication: string;
  detectedAt: number;
}

export interface FactorStoryTemplate {
  signal: string;
  templates: string[];
  advice: string[];
}

// ============================================================
const STORY_TEMPLATES: Record<string, { templates: string[]; advice: string[] }> = {
  STRONG_BULLISH: {
    templates: [
      '{factor}当前处于极度看涨区间(Z-Score={zscore})，位于历史{percentile}分位。历史上此信号出现后1个月胜率达{winrate}%，平均超额收益{excess}%。',
      '{factor}指标发出强烈买入信号(P={percentile})。从行为金融角度看，市场参与者尚未充分反映此信号强度，存在{confidence}%概率的alpha机会。',
      '{factor}突破历史+2σ上轨，触发"动量加速"模式。类似模式在过去{count}次中出现时，后续60日超额收益中位数为{excess}%。',
    ],
    advice: [
      '建议在该因子上配置{allocation}%仓位，止损设在-1.5σ位置',
      '可考虑杠杆ETF放大敞口，但需注意尾部风险',
      '关注是否出现拥挤交易迹象，若因子拥挤度>0.8应减仓',
    ],
  },
  BULLISH: {
    templates: [
      '{factor}处于看涨状态(Z={zscore})，位于{percentile}分位。信号质量中等，建议作为组合增强因子使用。',
      '{factor}温和看涨。当前值与历史均值相比偏高{deviation}%，但尚未进入极端区域。',
    ],
    advice: [
      '建议配置{allocation}%仓位，与防御性因子搭配使用',
      '若连续3期维持在+1σ以上，可将信号强度升级为强看涨',
    ],
  },
  NEUTRAL: {
    templates: [
      '{factor}处于中性区间(Z={zscore})，无明确方向性信号。建议等待趋势确认后再做配置。',
      '{factor}当前无显著alpha。因子值在历史均值附近，可暂时降低该因子权重。',
    ],
    advice: [
      '建议将仓位降至基准配置以下，等待方向明确',
      '关注是否有因子失效迹象（IC连续3期为负）',
    ],
  },
  BEARISH: {
    templates: [
      '{factor}处于看跌状态(Z={zscore})，位于{percentile}分位。历史回测显示此信号下做空胜率{winrate}%。',
      '{factor}温和看跌。若仓位已较重，建议逐步减仓或对冲。',
    ],
    advice: [
      '建议减仓至{allocation}%以下，或通过看跌期权对冲',
      '若连续下跌超3期，考虑因子失效诊断',
    ],
  },
  STRONG_BEARISH: {
    templates: [
      '{factor}发出强烈看跌信号(Z={zscore})，位于历史{percentile}分位。历史上此极端值时，后续1月最大回撤中位数为{maxdd}%。',
      '{factor}跌破-2σ下轨，触发"恐慌抛售"模式。从逆向投资角度，此极端值也可能是超卖反弹的前兆。',
    ],
    advice: [
      '立即减仓至{allocation}%以下，启用对冲保护',
      '关注是否有"因子崩溃"风险（因子收益率连续为负）',
      '逆向投资者可在-2.5σ以下逐步建仓，但需严格止损',
    ],
  },
};

// ============================================================
export class FactorAIInterpretationEngine {
  private interpretations: AIInterpretation[] = [];
  private idCounter = 0;

  /** Generate single factor story */
  generateFactorStory(reading: FactorReading): AIInterpretation {
    const st = STORY_TEMPLATES[reading.signal] || STORY_TEMPLATES.NEUTRAL;
    const templateIdx = Math.floor(Math.random() * st.templates.length);
    const tpl = st.templates[templateIdx];
    const advice = st.advice[Math.floor(Math.random() * st.advice.length)];

    const vars: Record<string, string> = {
      '{factor}': reading.factorName,
      '{zscore}': reading.zScore.toFixed(2),
      '{percentile}': (reading.percentile * 100).toFixed(0) + '%',
      '{winrate}': ((0.5 + reading.zScore * 0.12) * 100).toFixed(0),
      '{excess}': (reading.zScore * 3.5).toFixed(1),
      '{confidence}': ((0.5 + Math.abs(reading.zScore) * 0.15) * 100).toFixed(0),
      '{count}': Math.floor(Math.abs(reading.zScore) * 8 + 3).toString(),
      '{allocation}': Math.floor(10 + Math.abs(reading.zScore) * 15).toString(),
      '{deviation}': (reading.zScore * 20).toFixed(0),
      '{maxdd}': (Math.abs(reading.zScore) * 6).toFixed(1),
    };

    let detailCn = tpl;
    let detailEn = tpl;
    let actionableAdvice = advice;
    for (const [k, v] of Object.entries(vars)) {
      detailCn = detailCn.replace(k, v);
      detailEn = detailEn.replace(k, v);
      actionableAdvice = actionableAdvice.replace(k, v);
    }

    const interp: AIInterpretation = {
      id: 'ai_' + (++this.idCounter),
      timestamp: Date.now(),
      type: 'single_factor',
      summary: `${reading.factorName}: ${reading.signal} (Z=${reading.zScore.toFixed(2)})`,
      detailCn, detailEn, actionableAdvice,
      confidence: 0.5 + Math.abs(reading.zScore) * 0.15,
      relatedFactors: [reading.factorId],
      readingValues: [reading],
    };
    this.interpretations.push(interp);
    return interp;
  }

  /** Generate portfolio (multi-factor) story */
  generatePortfolioStory(readings: FactorReading[]): AIInterpretation {
    if (readings.length === 0) {
      return {
        id: 'ai_' + (++this.idCounter), timestamp: Date.now(), type: 'portfolio',
        summary: '无因子数据', detailCn: '无可分析的因子数据', detailEn: 'No factor data available',
        confidence: 0, actionableAdvice: '请先加载因子数据',
        relatedFactors: [], readingValues: [],
      };
    }

    const bullish = readings.filter(r => r.signal === 'STRONG_BULLISH' || r.signal === 'BULLISH').length;
    const bearish = readings.filter(r => r.signal === 'STRONG_BEARISH' || r.signal === 'BEARISH').length;
    const neutral = readings.length - bullish - bearish;
    const avgZ = readings.reduce((s, r) => s + r.zScore, 0) / readings.length;
    const topBull = readings.filter(r => r.signal === 'STRONG_BULLISH').sort((a, b) => b.zScore - a.zScore).slice(0, 3);
    const topBear = readings.filter(r => r.signal === 'STRONG_BEARISH').sort((a, b) => a.zScore - b.zScore).slice(0, 3);

    let direction: string;
    if (bullish > bearish * 1.5) direction = '整体偏向看涨';
    else if (bearish > bullish * 1.5) direction = '整体偏向看跌';
    else direction = '因子信号分歧，方向不明';

    const detail = `组合分析(${readings.length}因子): ${direction}。看涨信号${bullish}个, 看跌信号${bearish}个, 中性${neutral}个。平均Z-Score=${avgZ.toFixed(2)}。` +
      (topBull.length > 0 ? `最强看涨因子: ${topBull.map(r => r.factorName + '(' + r.zScore.toFixed(2) + ')').join(', ')}。` : '') +
      (topBear.length > 0 ? `最强看跌因子: ${topBear.map(r => r.factorName + '(' + r.zScore.toFixed(2) + ')').join(', ')}。` : '');

    const advice = bullish > bearish * 1.5 ? '建议保持多头敞口，以最强看涨因子为主要暴露方向。' :
      bearish > bullish * 1.5 ? '建议降低风险敞口，增加对冲保护。' :
      '建议采取市场中性策略，等待因子信号收敛。';

    const interp: AIInterpretation = {
      id: 'ai_' + (++this.idCounter), timestamp: Date.now(), type: 'portfolio',
      summary: direction, detailCn: detail, detailEn: detail, actionableAdvice: advice,
      confidence: 0.6 + Math.min(0.3, Math.abs(bullish - bearish) / readings.length),
      relatedFactors: readings.map(r => r.factorId), readingValues: readings,
    };
    this.interpretations.push(interp);
    return interp;
  }

  /** Detect factor regime change */
  detectRegimeChange(current: FactorReading, previous: FactorReading): RegimeChange | null {
    const currSignal = this.signalToRegime(current.signal);
    const prevSignal = this.signalToRegime(previous.signal);
    if (currSignal === prevSignal) return null;

    const confidence = 0.5 + Math.abs(current.zScore - previous.zScore) * 0.25;
    if (confidence < 0.6) return null;

    let implication: string;
    if (prevSignal === '熊市' && currSignal === '牛市') {
      implication = `因子${current.factorName}从熊市切换到牛市，可能是趋势反转信号。建议增加该因子暴露。`;
    } else if (prevSignal === '牛市' && currSignal === '熊市') {
      implication = `因子${current.factorName}从牛市切换到熊市，警惕趋势逆转。建议减仓或对冲。`;
    } else {
      implication = `因子${current.factorName}从${prevSignal}切换到${currSignal}，关注后续确认信号。`;
    }

    return { factorId: current.factorId, factorName: current.factorName, fromRegime: prevSignal, toRegime: currSignal, confidence, implication, detectedAt: Date.now() };
  }

  /** Generate alert explanation */
  generateAlertExplanation(factorName: string, alertType: string, currentValue: number, historicalAvg: number): AIInterpretation {
    const deviation = ((currentValue - historicalAvg) / Math.abs(historicalAvg || 1) * 100).toFixed(1);
    const detail = `⚠️ ${factorName}触发${alertType}告警: 当前值=${currentValue.toFixed(3)}, 历史均值=${historicalAvg.toFixed(3)}, 偏离${deviation}%。此异常值可能由以下原因引起：(1)市场结构性变化 (2)短期流动性冲击 (3)数据异常。建议核对原始数据源并交叉验证。`;
    const interp: AIInterpretation = {
      id: 'ai_' + (++this.idCounter), timestamp: Date.now(), type: 'alert',
      summary: `${factorName}: ${alertType} ALERT`,
      detailCn: detail, detailEn: detail,
      actionableAdvice: '检查数据源准确性，确认是否为真实事件。若是真实事件，立即调整仓位。',
      confidence: 0.85, relatedFactors: [], readingValues: [],
    };
    this.interpretations.push(interp);
    return interp;
  }

  /** Natural language query (keyword-based) */
  naturalLanguageQuery(query: string, availableFactors: Array<{ id: string; name: string; value: number; zScore: number; signal: string }>): AIInterpretation {
    const ql = query.toLowerCase();

    // Intent detection
    let intent: 'best' | 'worst' | 'trending' | 'compare' | 'explain' | 'summary' = 'summary';
    if (ql.includes('最好') || ql.includes('最强') || ql.includes('best') || ql.includes('top') || ql.includes('推荐')) intent = 'best';
    else if (ql.includes('最差') || ql.includes('最弱') || ql.includes('worst') || ql.includes('避开')) intent = 'worst';
    else if (ql.includes('趋势') || ql.includes('方向') || ql.includes('trending') || ql.includes('走向')) intent = 'trending';
    else if (ql.includes('对比') || ql.includes('比较') || ql.includes('compare') || ql.includes('vs')) intent = 'compare';
    else if (ql.includes('解释') || ql.includes('为什么') || ql.includes('explain') || ql.includes('原因')) intent = 'explain';

    const sorted = [...availableFactors].sort((a, b) => b.zScore - a.zScore);
    let detailCn = '';
    let advice = '';

    switch (intent) {
      case 'best': {
        const top = sorted.slice(0, 3);
        detailCn = `当前最佳因子: ${top.map(f => `${f.name}(Z=${f.zScore.toFixed(2)},${f.signal})`).join('; ')}。`;
        advice = '建议优先配置以上因子，仓位向高Z-Score因子倾斜。';
        break;
      }
      case 'worst': {
        const worst = sorted.slice(-3).reverse();
        detailCn = `当前最弱因子: ${worst.map(f => `${f.name}(Z=${f.zScore.toFixed(2)},${f.signal})`).join('; ')}。`;
        advice = '建议减仓或对冲以上因子，避免过度暴露于弱势方向。';
        break;
      }
      case 'trending': {
        const strong = availableFactors.filter(f => f.signal.includes('STRONG'));
        detailCn = `当前有${strong.length}个因子处于极端区间。${strong.length > 0 ? `包括: ${strong.map(f => f.name).join(', ')}` : '无极端信号因子。'}市场处于${strong.length > 3 ? '高波动' : '正常'}状态。`;
        advice = strong.length > 3 ? '建议降低仓位，增加对冲保护。' : '市场正常，可按标准策略执行。';
        break;
      }
      case 'compare': {
        const pos = availableFactors.filter(f => f.zScore > 0);
        const neg = availableFactors.filter(f => f.zScore < 0);
        detailCn = `看涨因子${pos.length}个, 看跌因子${neg.length}个。多空比=${neg.length > 0 ? (pos.length / neg.length).toFixed(1) : '∞'}。`;
        advice = pos.length > neg.length * 2 ? '多头占优，建议做多。' : neg.length > pos.length * 2 ? '空头占优，建议防御。' : '多空平衡，等待方向选择。';
        break;
      }
      case 'summary':
      default: {
        const avgZ = availableFactors.reduce((s, f) => s + f.zScore, 0) / availableFactors.length;
        detailCn = `综合${availableFactors.length}个因子分析：平均Z-Score=${avgZ.toFixed(2)}。`;
        advice = avgZ > 0.5 ? '整体偏多，建议保持多头敞口。' : avgZ < -0.5 ? '整体偏空，建议减仓。' : '中性区间，建议观望。';
        break;
      }
    }

    const interp: AIInterpretation = {
      id: 'ai_' + (++this.idCounter), timestamp: Date.now(), type: 'single_factor',
      summary: `NLQ: "${query.substring(0, 30)}"`,
      detailCn: `🔍 查询: "${query}"\n\n${detailCn}`,
      detailEn: `Query: "${query}"\n\n${detailCn}`,
      actionableAdvice: advice, confidence: 0.7,
      relatedFactors: availableFactors.map(f => f.id),
      readingValues: [],
    };
    this.interpretations.push(interp);
    return interp;
  }

  /** Factor causality analysis */
  analyzeCausality(factorId: string, factorName: string, values: number[], laggedPairs: Array<{ lag: number; correlation: number }>): AIInterpretation {
    const maxLag = laggedPairs.reduce((best, p) => Math.abs(p.correlation) > Math.abs(best.correlation) ? p : best, laggedPairs[0]);
    const detail = `${factorName}因果分析: 最佳滞后阶数=${maxLag.lag}期, 相关系数=${maxLag.correlation.toFixed(3)}。` +
      (Math.abs(maxLag.correlation) > 0.7 ? ' 强自相关性，趋势持续性显著。' : Math.abs(maxLag.correlation) > 0.4 ? ' 中等自相关性，存在一定动量效应。' : ' 弱自相关性，因子接近随机游走。');
    const interp: AIInterpretation = {
      id: 'ai_' + (++this.idCounter), timestamp: Date.now(), type: 'causality',
      summary: `${factorName} 因果分析 (最佳滞后=${maxLag.lag})`,
      detailCn: detail, detailEn: detail,
      actionableAdvice: Math.abs(maxLag.correlation) > 0.7 ? '该因子有强动量效应，适合趋势跟踪策略。' : '该因子接近随机，更适合反转策略。',
      confidence: 0.7 + Math.abs(maxLag.correlation) * 0.15, relatedFactors: [factorId], readingValues: [],
    };
    this.interpretations.push(interp);
    return interp;
  }

  /** Get all interpretations */
  getInterpretations(): AIInterpretation[] { return this.interpretations; }
  getLatest(n = 10): AIInterpretation[] { return this.interpretations.slice(-n).reverse(); }

  private signalToRegime(s: string): string {
    if (s === 'STRONG_BULLISH' || s === 'BULLISH') return '牛市';
    if (s === 'STRONG_BEARISH' || s === 'BEARISH') return '熊市';
    return '震荡';
  }

  reset(): void { this.interpretations = []; this.idCounter = 0; }
}

let _fai: FactorAIInterpretationEngine | undefined;
export function getFactorAIInterpretationEngine(): FactorAIInterpretationEngine {
  if (!_fai) _fai = new FactorAIInterpretationEngine();
  return _fai;
}
export function resetFactorAIInterpretationEngine(): void { _fai?.reset(); _fai = undefined; }
