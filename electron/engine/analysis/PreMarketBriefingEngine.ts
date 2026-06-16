/**
 * AI-02 PreMarketBriefingEngine — R254 QUANT MOO
 * 
 * 盘前简报引擎。每日开市前综合多项数据源，生成结构化盘前简报。
 * 涵盖全球市场隔夜表现、宏观经济日历、个股异动、技术指标预警、
 * 风险因子评估及策略建议，输出面向个人投资者的可读性强的市场概览。
 *
 * Capabilities:
 * - 7 种市场状态自动识别 (Bull Charging / Bear Spreading / Sideways Chop / 
 *   VIX Panic / Fed Day / Earnings Storm / Quiet Drift)
 * - Overnight global market summary (US futures, Asia close, Europe open)
 * - Economic calendar integration (today + this week highlights)
 * - Major stock movers (top gainers/losers, unusual volume)
 * - Technical alerts (support/resistance breaks, golden/death crosses)
 * - Factor risk assessment (volatility, correlation, sector rotation)
 * - Actionable strategy suggestions (3-5 bullet points)
 * - Briefing rating (confidence: high/medium/low)
 * - Output formats: JSON structured, markdown, plain text
 *
 * Architecture:
 * - Singleton with reset() for testability
 * - MarketStateClassifier: 7-state auto-detection from market data
 * - BriefingSection: overnight, calendar, movers, technical, risk, strategy
 * - AI-like analysis engine (rule-based, simulated for dev)
 *
 * @author JVS
 * @round R254
 * @since 2026-06-17
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────

export type MarketState =
  | 'bull_charging'
  | 'bear_spreading'
  | 'sideways_chop'
  | 'vix_panic'
  | 'fed_day'
  | 'earnings_storm'
  | 'quiet_drift';

export interface MarketSnapshot {
  spx: { price: number; changePct: number; futuresFlag: boolean };
  ndx: { price: number; changePct: number; futuresFlag: boolean };
  dji: { price: number; changePct: number; futuresFlag: boolean };
  vix: number;
  hsi: { price: number; changePct: number; closed: boolean };
  n225: { price: number; changePct: number; closed: boolean };
  btc: { price: number; changePct: number };
  dxy: number;
  us10y: number;
  oil: number;               // WTI crude
  gold: number;
  timestamp: number;
}

export interface EconomicEvent {
  title: string;
  time: string;              // HH:MM in market time
  importance: 'low' | 'medium' | 'high';
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  category: string;          // Fed, Employment, Inflation, Housing, etc
}

export interface StockMover {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  avgVolumeRatio: number;    // vs 20-day average
  direction: 'up' | 'down';
  reason: string;            // e.g., earnings_beat, guidance_up, analyst_upgrade
  category: 'large_cap' | 'mid_cap' | 'small_cap' | 'crypto' | 'etf';
}

export interface TechnicalAlert {
  symbol: string;
  alertType: 'support_break' | 'resistance_break' | 'golden_cross' | 'death_cross'
    | 'rsi_oversold' | 'rsi_overbought' | 'macd_cross_up' | 'macd_cross_down'
    | 'volume_spike' | 'bollinger_squeeze';
  level: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
}

export interface FactorRisk {
  factor: string;
  currentZScore: number;
  percentile: number;
  signal: 'risk_on' | 'risk_off' | 'neutral';
  description: string;
}

export interface StrategySuggestion {
  action: string;
  target: string;            // asset class or specific symbol
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
  timeHorizon: 'intraday' | 'swing' | 'position' | 'hedge';
}

export interface BriefingSection {
  id: string;
  title: string;
  content: string;
  data: Record<string, unknown>;
  importance: 'critical' | 'high' | 'medium' | 'low';
  generatedAt: number;
}

export interface PreMarketBriefing {
  id: string;
  date: string;              // YYYY-MM-DD
  state: MarketState;
  stateLabel: string;
  stateDescription: string;
  confidence: 'high' | 'medium' | 'low';
  overtone: string;          // One-sentence summary
  snapshot: MarketSnapshot;
  economicEvents: EconomicEvent[];
  movers: StockMover[];
  technicalAlerts: TechnicalAlert[];
  factorRisks: FactorRisk[];
  strategySuggestions: StrategySuggestion[];
  sections: BriefingSection[];
  generatedAt: number;
  validUntil: number;        // Re-evaluate after this timestamp
}

export interface BriefingInput {
  snapshot: MarketSnapshot;
  economicEvents?: EconomicEvent[];
  movers?: StockMover[];
  technicalAlerts?: TechnicalAlert[];
  factorRisks?: FactorRisk[];
}

export interface BriefingOptions {
  maxMovers: number;          // default 10
  maxAlerts: number;          // default 10
  maxSuggestions: number;     // default 5
  includeRawData: boolean;     // default false
  verbose: boolean;            // default false (concise mode)
}

// ─── State Classifier ────────────────────────────────────

const STATE_CONFIG: Array<{
  state: MarketState;
  label: string;
  description: string;
  check: (s: MarketSnapshot, events: EconomicEvent[]) => boolean;
}> = [
  {
    state: 'vix_panic',
    label: 'VIX 恐慌',
    description: 'VIX急速飙升，市场处于避险模式。现金为王，避免追涨杀跌。',
    check: s => s.vix >= 30,
  },
  {
    state: 'fed_day',
    label: '联储日',
    description: '今日 FOMC 决议。利率决策可能引发剧烈波动，建议观望或对冲。',
    check: (_, events) => events.some(e =>
      e.category === 'Fed' && e.importance === 'high'
    ),
  },
  {
    state: 'earnings_storm',
    label: '财报风暴',
    description: '多家大型企业公布财报。个股层面波动显著，分散化是关键。',
    check: (_, events) => events.filter(e =>
      e.category === 'Earnings' && e.importance === 'high'
    ).length >= 3,
  },
  {
    state: 'bull_charging',
    label: '多头冲锋',
    description: '主要指数同步上涨，VIX低位，市场情绪偏乐观。可适度加仓。',
    check: s =>
      s.spx.changePct > 0.5 &&
      s.ndx.changePct > 0.5 &&
      s.vix < 20,
  },
  {
    state: 'bear_spreading',
    label: '空头蔓延',
    description: '主要指数同步下跌，避险情绪升温。防御为主，关注黄金/债券。',
    check: s =>
      s.spx.changePct < -0.5 &&
      s.ndx.changePct < -0.5 &&
      s.vix > 23,
  },
  {
    state: 'sideways_chop',
    label: '横盘震荡',
    description: '指数在狭小区间内震荡，方向不明。适宜短线交易，不宜重仓。',
    check: s =>
      Math.abs(s.spx.changePct) < 0.3 &&
      Math.abs(s.ndx.changePct) < 0.3,
  },
  {
    state: 'quiet_drift',
    label: '平静漂移',
    description: '市场交投清淡，无重大驱动事件。可关注个股题材与行业轮动。',
    check: () => true,   // Fallback
  },
];

// ─── Engine ──────────────────────────────────────────────

export class PreMarketBriefingEngine extends EventEmitter {
  private static instance: PreMarketBriefingEngine;

  private options: BriefingOptions = {
    maxMovers: 10,
    maxAlerts: 10,
    maxSuggestions: 5,
    includeRawData: false,
    verbose: false,
  };

  private lastBriefing: PreMarketBriefing | null = null;
  private briefingCount = 0;

  private constructor() {
    super();
  }

  static getInstance(): PreMarketBriefingEngine {
    if (!PreMarketBriefingEngine.instance) {
      PreMarketBriefingEngine.instance = new PreMarketBriefingEngine();
    }
    return PreMarketBriefingEngine.instance;
  }

  reset(): void {
    this.lastBriefing = null;
    this.briefingCount = 0;
    this.options = {
      maxMovers: 10,
      maxAlerts: 10,
      maxSuggestions: 5,
      includeRawData: false,
      verbose: false,
    };
    this.removeAllListeners();
  }

  // ─── Configuration ─────────────────────────────────

  configure(partial: Partial<BriefingOptions>): void {
    Object.assign(this.options, partial);
  }

  getOptions(): Readonly<BriefingOptions> {
    return { ...this.options };
  }

  // ─── State Classification ──────────────────────────

  classifyState(snapshot: MarketSnapshot, events: EconomicEvent[] = []): {
    state: MarketState;
    label: string;
    description: string;
  } {
    for (const cfg of STATE_CONFIG) {
      if (cfg.check(snapshot, events)) {
        return {
          state: cfg.state,
          label: cfg.label,
          description: cfg.description,
        };
      }
    }
    // Fallback — should never reach here due to quiet_drift catchall
    return {
      state: 'quiet_drift',
      label: '平静漂移',
      description: '市场交投清淡，无重大驱动事件。',
    };
  }

  getAllStates(): Array<{ state: MarketState; label: string; description: string }> {
    return STATE_CONFIG.map(s => ({
      state: s.state,
      label: s.label,
      description: s.description,
    }));
  }

  // ─── Overtone Generator ────────────────────────────

  generateOvertone(snapshot: MarketSnapshot, classification: { state: MarketState }): string {
    const tones: Record<MarketState, string[]> = {
      bull_charging: [
        '市场全面上涨，多头动能强劲。',
        '牛市氛围浓厚，成长股表现突出。',
      ],
      bear_spreading: [
        '全球市场承压，避险情绪上升。',
        '空头主导，防御性资产受追捧。',
      ],
      sideways_chop: [
        '指数窄幅整理，短线机会有限。',
        '市场缺乏方向，等待催化剂出现。',
      ],
      vix_panic: [
        '恐慌指标飙升，现金为王。',
        '市场深度回调，耐心等待企稳信号。',
      ],
      fed_day: [
        '聚焦FOMC决议，市场处于观望模式。',
        '利率决议前后波动率可能显著升高。',
      ],
      earnings_storm: [
        '财报密集发布期，个股波动加剧。',
        '业绩分化明显，选股比选时更重要。',
      ],
      quiet_drift: [
        '市场交投清淡，等待新的驱动因素。',
        '投资者观望情绪浓厚，流动性偏低。',
      ],
    };

    const pool = tones[classification.state] ?? tones['quiet_drift'];
    return pool[this.briefingCount % pool.length];
  }

  // ─── Section Generators ────────────────────────────

  private buildOvernightSection(snapshot: MarketSnapshot): BriefingSection {
    const lines: string[] = [];

    lines.push(`S&P 500 期货 ${snapshot.spx.changePct >= 0 ? '+' : ''}${snapshot.spx.changePct.toFixed(2)}%`);
    lines.push(`NASDAQ 100 期货 ${snapshot.ndx.changePct >= 0 ? '+' : ''}${snapshot.ndx.changePct.toFixed(2)}%`);
    lines.push(`道指 期货 ${snapshot.dji.changePct >= 0 ? '+' : ''}${snapshot.dji.changePct.toFixed(2)}%`);

    if (snapshot.hsi.closed) {
      lines.push(`恒指 收 ${snapshot.hsi.changePct >= 0 ? '+' : ''}${snapshot.hsi.changePct.toFixed(2)}%（已收市）`);
    }
    lines.push(`日经225 ${snapshot.n225.changePct >= 0 ? '+' : ''}${snapshot.n225.changePct.toFixed(2)}%（${snapshot.n225.closed ? '已收市' : '交易中'}）`);

    lines.push(`VIX: ${snapshot.vix.toFixed(1)} | DXY: ${snapshot.dxy.toFixed(2)} | 10Y: ${snapshot.us10y.toFixed(2)}%`);
    lines.push(`WTI原油: $${snapshot.oil.toFixed(2)} | 黄金: $${snapshot.gold.toFixed(1)} | BTC: $${snapshot.btc.price.toFixed(0)}`);

    let bias = '中性';
    if (snapshot.spx.changePct > 0.5 && snapshot.vix < 20) bias = '偏多';
    if (snapshot.spx.changePct < -0.5 && snapshot.vix > 25) bias = '偏空';

    return {
      id: 'overnight',
      title: '🌍 隔夜全球市场',
      content: lines.join('\n'),
      data: { bias, snapshot: snapshot as unknown as Record<string, unknown> },
      importance: 'high',
      generatedAt: Date.now(),
    };
  }

  private buildCalendarSection(events: EconomicEvent[]): BriefingSection {
    const today = events.filter(e => e.importance !== 'low');
    const high = events.filter(e => e.importance === 'high');

    let content: string;
    if (today.length === 0) {
      content = '今日无重要经济数据发布。';
    } else {
      content = today.map(e => {
        const star = e.importance === 'high' ? '⭐⭐⭐' : '⭐⭐';
        let line = `${star} ${e.time} ${e.title}`;
        if (e.forecast) line += ` | 预期: ${e.forecast}`;
        if (e.previous) line += ` | 前值: ${e.previous}`;
        return line;
      }).join('\n');
    }

    return {
      id: 'calendar',
      title: '📅 今日经济日历',
      content,
      data: { total: events.length, high: high.length, today: today.length },
      importance: high.length > 0 ? 'high' : 'medium',
      generatedAt: Date.now(),
    };
  }

  private buildMoversSection(movers: StockMover[]): BriefingSection {
    const limited = movers.slice(0, this.options.maxMovers);
    const gainers = limited.filter(m => m.direction === 'up');
    const losers = limited.filter(m => m.direction === 'down');

    const content = [
      `📈 涨幅领先 (${gainers.length}):`,
      ...gainers.map(m =>
        `  ${m.symbol} +${m.changePct.toFixed(1)}% — ${m.reason}`
      ),
      `📉 跌幅领先 (${losers.length}):`,
      ...losers.map(m =>
        `  ${m.symbol} ${m.changePct.toFixed(1)}% — ${m.reason}`
      ),
    ].join('\n');

    return {
      id: 'movers',
      title: '📊 异动个股',
      content,
      data: { total: movers.length, gainers: gainers.length, losers: losers.length },
      importance: 'high',
      generatedAt: Date.now(),
    };
  }

  private buildTechnicalSection(alerts: TechnicalAlert[]): BriefingSection {
    const limited = alerts.slice(0, this.options.maxAlerts);
    const critical = limited.filter(a => a.severity === 'critical');

    const content = limited.length === 0
      ? '无关键技术警报。'
      : limited.map(a => {
          const icon = a.severity === 'critical' ? '🔴'
            : a.severity === 'warning' ? '🟡' : '🔵';
          return `${icon} ${a.symbol} ${a.alertType.replace(/_/g, ' ')} @ ${a.level}`;
        }).join('\n');

    return {
      id: 'technical',
      title: '🔧 技术警报',
      content,
      data: { total: alerts.length, critical: critical.length },
      importance: critical.length > 0 ? 'critical' : 'medium',
      generatedAt: Date.now(),
    };
  }

  private buildFactorSection(factors: FactorRisk[]): BriefingSection {
    const riskOn = factors.filter(f => f.signal === 'risk_on');
    const riskOff = factors.filter(f => f.signal === 'risk_off');
    const neutral = factors.filter(f => f.signal === 'neutral');

    const content = [
      `🟢 风险偏好 (${riskOn.length}): ${riskOn.map(f => f.factor).join(', ') || '无'}`,
      `🔴 风险规避 (${riskOff.length}): ${riskOff.map(f => f.factor).join(', ') || '无'}`,
      `⚪ 中性 (${neutral.length}): ${neutral.map(f => f.factor).join(', ') || '无'}`,
    ].join('\n');

    const overallSignal = riskOn.length > riskOff.length ? 'risk_on'
      : riskOff.length > riskOn.length ? 'risk_off' : 'neutral';

    return {
      id: 'factor',
      title: '📈 因子风险评估',
      content,
      data: { overallSignal, riskOn: riskOn.length, riskOff: riskOff.length, neutral: neutral.length },
      importance: 'high',
      generatedAt: Date.now(),
    };
  }

  private buildStrategySection(
    state: MarketState,
    factors: FactorRisk[],
    suggestions: StrategySuggestion[]
  ): BriefingSection {
    const limited = suggestions.slice(0, this.options.maxSuggestions);
    const confidenceMap: Record<string, string> = {
      high: '✅', medium: '⚡', low: '⚠️',
    };

    const stateActions: Record<MarketState, string> = {
      bull_charging: '加仓成长股，关注突破信号',
      bear_spreading: '减仓风险资产，增加对冲',
      sideways_chop: '降低仓位，专注短线',
      vix_panic: '现金为王，等待VIX回落',
      fed_day: '观望为主，决议后行动',
      earnings_storm: '分散持仓，降低个股集中度',
      quiet_drift: '关注行业轮动，提前布局',
    };

    const lines = [
      `📋 市场状态建议: ${stateActions[state]}`,
      '',
      limited.map(s =>
        `${confidenceMap[s.confidence] ?? ''} **${s.action}** (${s.timeHorizon})\n   ${s.rationale}`
      ).join('\n\n'),
    ];

    return {
      id: 'strategy',
      title: '💡 策略建议',
      content: lines.join('\n'),
      data: { state, suggestions: limited.length, action: stateActions[state] },
      importance: 'critical',
      generatedAt: Date.now(),
    };
  }

  // ─── Main Briefing Pipeline ────────────────────────

  async generateBriefing(
    input: BriefingInput,
    externalSuggestions: StrategySuggestion[] = []
  ): Promise<PreMarketBriefing> {
    const start = Date.now();

    // Classify market state
    const classification = this.classifyState(input.snapshot, input.economicEvents ?? []);

    // Build sections
    const sections: BriefingSection[] = [];

    // 1. Overnight global
    sections.push(this.buildOvernightSection(input.snapshot));

    // 2. Economic calendar
    sections.push(this.buildCalendarSection(input.economicEvents ?? []));

    // 3. Stock movers
    if ((input.movers ?? []).length > 0) {
      sections.push(this.buildMoversSection(input.movers!));
    }

    // 4. Technical alerts
    if ((input.technicalAlerts ?? []).length > 0) {
      sections.push(this.buildTechnicalSection(input.technicalAlerts!));
    }

    // 5. Factor risk
    sections.push(this.buildFactorSection(input.factorRisks ?? []));

    // 6. Strategy suggestions
    const suggestions = externalSuggestions.length > 0
      ? externalSuggestions
      : this.generateDefaultSuggestions(classification.state, input.factorRisks ?? []);
    sections.push(this.buildStrategySection(classification.state, input.factorRisks ?? [], suggestions));

    // Determine confidence
    const confidence = this.calculateConfidence(input, sections);

    const overtone = this.generateOvertone(input.snapshot, classification);

    const today = new Date().toISOString().slice(0, 10);

    this.briefingCount++;

    const briefing: PreMarketBriefing = {
      id: `briefing-${today}-${this.briefingCount}`,
      date: today,
      state: classification.state,
      stateLabel: classification.label,
      stateDescription: classification.description,
      confidence,
      overtone,
      snapshot: input.snapshot,
      economicEvents: input.economicEvents ?? [],
      movers: (input.movers ?? []).slice(0, this.options.maxMovers),
      technicalAlerts: (input.technicalAlerts ?? []).slice(0, this.options.maxAlerts),
      factorRisks: input.factorRisks ?? [],
      strategySuggestions: suggestions,
      sections: this.options.includeRawData ? sections : sections,
      generatedAt: Date.now(),
      validUntil: Date.now() + 3600000,   // 1 hour default
    };

    this.lastBriefing = briefing;
    this.emit('briefing', briefing);

    return briefing;
  }

  // ─── Default Strategy Generation ────────────────────

  generateDefaultSuggestions(state: MarketState, factors: FactorRisk[]): StrategySuggestion[] {
    const suggestions: StrategySuggestion[] = [];
    const riskOffCount = factors.filter(f => f.signal === 'risk_off').length;

    switch (state) {
      case 'bull_charging':
        suggestions.push(
          { action: '做多QQQ/SPY', target: 'equity', rationale: '多头趋势明确，顺势做多', confidence: 'high', timeHorizon: 'swing' },
          { action: '减仓VIX产品', target: 'volatility', rationale: 'VIX低位，做空波动率', confidence: 'medium', timeHorizon: 'swing' },
          { action: '关注科技龙头突破', target: 'AAPL/MSFT/NVDA', rationale: '牛市旗手率先突破', confidence: 'medium', timeHorizon: 'swing' },
        );
        break;
      case 'bear_spreading':
        suggestions.push(
          { action: '增持防御板块', target: 'XLP/XLU/XLV', rationale: '市场下行，防御板块相对抗跌', confidence: 'high', timeHorizon: 'position' },
          { action: '做空或购买PUT对冲', target: 'SPY', rationale: '保护下行风险', confidence: 'medium', timeHorizon: 'hedge' },
          { action: '关注黄金机会', target: 'GLD', rationale: '避险需求推动金价', confidence: 'medium', timeHorizon: 'swing' },
        );
        break;
      case 'vix_panic':
        suggestions.push(
          { action: '大幅降低仓位', target: 'all', rationale: 'VIX>30，现金为王', confidence: 'high', timeHorizon: 'intraday' },
          { action: '不做空（禁止追空）', target: 'all', rationale: '恐慌中空头收益有限，反弹风险极高', confidence: 'high', timeHorizon: 'intraday' },
          { action: '观望与学习', target: 'watchlist', rationale: '记录当前强势股，等待企稳布局', confidence: 'high', timeHorizon: 'position' },
        );
        break;
      case 'fed_day':
        suggestions.push(
          { action: '持仓对冲或减仓', target: 'portfolio', rationale: '决议前后波动率飙升', confidence: 'high', timeHorizon: 'intraday' },
          { action: '决议后评估方向', target: 'SPY/QQQ', rationale: '等待明确的突破信号再入场', confidence: 'high', timeHorizon: 'swing' },
        );
        break;
      case 'earnings_storm':
        suggestions.push(
          { action: '分散个股风险', target: 'portfolio', rationale: '财报暴雷概率较高', confidence: 'high', timeHorizon: 'swing' },
          { action: '期权跨式策略', target: 'volatility', rationale: '利用财报前后IV飙升获取收益', confidence: 'medium', timeHorizon: 'intraday' },
        );
        break;
      case 'sideways_chop':
        suggestions.push(
          { action: '短线网格交易', target: 'range-bound stocks', rationale: '区间震荡中高低买卖', confidence: 'medium', timeHorizon: 'intraday' },
          { action: '轻仓等待突破', target: 'breakout watchlist', rationale: '突破后再加仓', confidence: 'medium', timeHorizon: 'swing' },
        );
        break;
      case 'quiet_drift':
        suggestions.push(
          { action: '研究行业轮动', target: 'sectors', rationale: '提前布局下一轮热点', confidence: 'medium', timeHorizon: 'position' },
          { action: '关注成交量异动', target: 'unusual volume', rationale: '静默期资金动向蕴含信息', confidence: 'low', timeHorizon: 'swing' },
        );
        break;
    }

    // Add general risk-based suggestions
    if (riskOffCount >= 3) {
      suggestions.push({
        action: '提高现金比例至40%+',
        target: 'portfolio',
        rationale: '多项风险因子发出警示信号',
        confidence: 'high',
        timeHorizon: 'position',
      });
    }

    return suggestions.slice(0, this.options.maxSuggestions);
  }

  // ─── Confidence Calculation ────────────────────────

  private calculateConfidence(
    input: BriefingInput,
    sections: BriefingSection[]
  ): 'high' | 'medium' | 'low' {
    let score = 0;
    const maxScore = 10;

    // Market data completeness
    if (input.snapshot.spx.price > 0) score++;
    if (input.snapshot.vix > 0) score++;
    if (input.snapshot.us10y > 0) score++;

    // Data freshness
    const maxAge = 3600000; // 1h
    const age = Date.now() - input.snapshot.timestamp;
    if (age < maxAge) score += 2;
    else if (age < maxAge * 2) score++;

    // Factor risk data
    if ((input.factorRisks ?? []).length >= 3) score += 2;
    else if ((input.factorRisks ?? []).length >= 1) score++;

    // Economic calendar
    if ((input.economicEvents ?? []).length >= 2) score++;

    // Movers
    if ((input.movers ?? []).length >= 3) score++;

    const ratio = score / maxScore;
    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.4) return 'medium';
    return 'low';
  }

  // ─── Output Formatting ──────────────────────────────

  formatAsMarkdown(briefing: PreMarketBriefing): string {
    const lines: string[] = [];

    lines.push(`# 📈 盘前简报 — ${briefing.date}`);
    lines.push('');
    lines.push(`**市场状态**: ${briefing.stateLabel} (${briefing.confidence === 'high' ? '高置信度' : briefing.confidence === 'medium' ? '中置信度' : '低置信度'})`);
    lines.push('');
    lines.push(`> ${briefing.overtone}`);
    lines.push('');

    for (const section of briefing.sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');
    }

    lines.push('---');
    lines.push(`*简报生成于 ${new Date(briefing.generatedAt).toISOString()} | 有效期 1 小时*`);

    return lines.join('\n');
  }

  formatAsText(briefing: PreMarketBriefing): string {
    return this.formatAsMarkdown(briefing);
  }

  formatAsJSON(briefing: PreMarketBriefing): object {
    return {
      ...briefing,
      generatedAtISO: new Date(briefing.generatedAt).toISOString(),
      validUntilISO: new Date(briefing.validUntil).toISOString(),
    };
  }

  // ─── Accessors ──────────────────────────────────────

  getLastBriefing(): PreMarketBriefing | null {
    return this.lastBriefing;
  }

  getBriefingCount(): number {
    return this.briefingCount;
  }

  // ─── Mock Helpers ──────────────────────────────────

  createMockSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
    return {
      spx: { price: 5600, changePct: 0.35, futuresFlag: true },
      ndx: { price: 19500, changePct: 0.52, futuresFlag: true },
      dji: { price: 42000, changePct: 0.21, futuresFlag: true },
      vix: 15.5,
      hsi: { price: 18500, changePct: 1.2, closed: true },
      n225: { price: 38500, changePct: -0.3, closed: true },
      btc: { price: 67000, changePct: 1.5 },
      dxy: 103.5,
      us10y: 4.25,
      oil: 78.5,
      gold: 2350,
      timestamp: Date.now(),
      ...overrides,
    };
  }

  createMockEvents(): EconomicEvent[] {
    return [
      {
        title: '美国核心CPI环比 (月率)',
        time: '08:30',
        importance: 'high',
        forecast: '0.3%',
        previous: '0.4%',
        actual: null,
        category: 'Inflation',
      },
      {
        title: '初请失业金人数',
        time: '08:30',
        importance: 'medium',
        forecast: '215K',
        previous: '212K',
        actual: null,
        category: 'Employment',
      },
    ];
  }

  createMockMovers(): StockMover[] {
    return [
      { symbol: 'AAPL', name: 'Apple', price: 185, changePct: 2.1, volume: 72e6, avgVolumeRatio: 1.5, direction: 'up', reason: '新产品发布', category: 'large_cap' },
      { symbol: 'TSLA', name: 'Tesla', price: 245, changePct: -3.2, volume: 105e6, avgVolumeRatio: 2.1, direction: 'down', reason: '交付量不及预期', category: 'large_cap' },
    ];
  }

  createMockFactorRisks(): FactorRisk[] {
    return [
      { factor: 'Volatility', currentZScore: -1.2, percentile: 15, signal: 'risk_on', description: '波动率处于历史低位' },
      { factor: 'Correlation', currentZScore: 0.3, percentile: 55, signal: 'neutral', description: '资产间相关性正常' },
      { factor: 'Momentum', currentZScore: 1.8, percentile: 85, signal: 'risk_on', description: '动量因子强势' },
      { factor: 'Liquidity', currentZScore: 0.5, percentile: 60, signal: 'neutral', description: '流动性中性' },
      { factor: 'Credit', currentZScore: -0.8, percentile: 25, signal: 'risk_on', description: '信用利差收窄' },
    ];
  }
}
