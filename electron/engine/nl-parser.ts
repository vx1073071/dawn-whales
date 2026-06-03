// ── NL Parser — 自然语言策略解析器 v1 ──────────────────────────────────────
// 规则引擎：正则 + 关键词匹配，支持 8 种模式
// Phase 2: 接入 LLM API 做更复杂的解析

import log from 'electron-log';

interface ParsedStrategy {
  success: boolean;
  name: string;
  description: string;
  strategy: {
    type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'combined';
    params: Record<string, number>;
    stopLoss?: number;
    takeProfit?: number;
  };
  symbol?: string;
  error?: string;
}

// ── Symbol Extraction ──────────────────────────────────────────────────────

const KNOWN_SYMBOLS = [
  'TQQQ', 'SQQQ', 'QQQ', 'SPY', 'SOXL', 'SOXS', 'AAPL', 'NVDA',
  'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'AVGO', 'PLTR',
  'ARKK', 'IWM', 'DIA', 'GLD', 'SLV', 'TLT', 'VIX', 'UVXY',
  'BABA', 'PDD', 'JD', 'NIO', 'LI', 'BIDU', 'TCEHY',
  'BTC', 'ETH', 'SOL', 'DOGE',
];

function extractSymbol(text: string): string | undefined {
  const upper = text.toUpperCase();
  for (const sym of KNOWN_SYMBOLS) {
    if (upper.includes(sym)) {
      return `US.${sym}`;
    }
  }
  // Try to find US.XXXX pattern
  const match = text.match(/US\.\w+/i);
  return match ? match[0].toUpperCase() : undefined;
}

// ── Number Extraction ──────────────────────────────────────────────────────

function extractNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

// ── Strategy Pattern Matchers ──────────────────────────────────────────────

type MatcherResult = Omit<ParsedStrategy, 'success' | 'symbol'> & { symbol?: string };

function matchMACross(text: string): MatcherResult | null {
  // "MA5 上穿 MA20 买入" / "均线 MA10 交叉 MA30" / "5日均线上穿20日均线"
  const patterns = [
    /MA(\d+)\s*(?:上穿|金叉|cross.*up|crosses\s*above)\s*MA(\d+)/i,
    /均线?\s*(\d+)\s*(?:日)?\s*(?:上穿|金叉|交叉)\s*(?:均线?\s*)?(\d+)/i,
    /(\d+)\s*日均线.*?上穿.*?(\d+)\s*日均线/i,
    /MA(\d+)\s*.*(?:cross|交叉|金叉).*MA(\d+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const short = parseInt(m[1]);
      const long = parseInt(m[2]);
      if (short > 0 && long > 0 && short < long) {
        return {
          name: `MA${short}/MA${long} 均线交叉`,
          description: `当 MA${short} 上穿 MA${long} 时买入，下穿时卖出`,
          strategy: { type: 'ma_cross', params: { shortPeriod: short, longPeriod: long } },
        };
      }
    }
  }
  return null;
}

function matchRSI(text: string): MatcherResult | null {
  // "RSI 低于 30 买入" / "RSI < 30 买入, RSI > 70 卖出" / "RSI超卖买入"
  const buyMatch = text.match(/RSI\s*(?:低于|小于|<|<=|below)\s*(\d+)/i);
  const sellMatch = text.match(/RSI\s*(?:高于|大于|>|>=|above)\s*(\d+)/i);

  if (buyMatch) {
    const oversold = parseInt(buyMatch[1]);
    const overbought = sellMatch ? parseInt(sellMatch[1]) : 70;
    return {
      name: `RSI 超买超卖`,
      description: `RSI < ${oversold} 买入，RSI > ${overbought} 卖出`,
      strategy: { type: 'rsi', params: { oversold, overbought, rsiPeriod: 14 } },
    };
  }

  // "RSI 超卖" shorthand
  if (/RSI\s*超卖/i.test(text)) {
    return {
      name: `RSI 超卖反弹`,
      description: `RSI < 30 买入，RSI > 70 卖出`,
      strategy: { type: 'rsi', params: { oversold: 30, overbought: 70, rsiPeriod: 14 } },
    };
  }

  return null;
}

function matchMACD(text: string): MatcherResult | null {
  // "MACD 金叉买入" / "MACD 死叉卖出" / "MACD cross"
  if (/MACD\s*(?:金叉|cross\s*up|bullish)/i.test(text)) {
    const fast = extractNumber(text, /快线\s*(\d+)/i) ?? 12;
    const slow = extractNumber(text, /慢线\s*(\d+)/i) ?? 26;
    return {
      name: `MACD 金叉`,
      description: `MACD 柱状图由负转正时买入，由正转负时卖出`,
      strategy: { type: 'macd', params: { macdFast: fast, macdSlow: slow, macdSignal: 9 } },
    };
  }
  return null;
}

function matchMomentum(text: string): MatcherResult | null {
  // "涨 5% 卖出" / "20日新高买入" / "动量突破" / "N日突破"
  const lookback = extractNumber(text, /(\d+)\s*日/i) ?? 20;
  const threshold = extractNumber(text, /(?:涨|跌|突破|涨幅|变化)\s*(\d+)\s*%/i) ?? 5;

  if (/\d+\s*日?\s*(?:新高|突破|高点)/i.test(text) || /momentum|动量/i.test(text)) {
    return {
      name: `动量突破 (${lookback}日)`,
      description: `过去${lookback}日涨幅超过 ${threshold}% 时买入`,
      strategy: { type: 'momentum', params: { lookback, threshold } },
    };
  }
  return null;
}

function matchBollinger(text: string): MatcherResult | null {
  // "布林带下轨买入" / "Bollinger lower band buy" / "触及布林下轨"
  if (/布林|bollinger|boll/i.test(text) && /(下轨|lower|底部|支撑)/i.test(text)) {
    return {
      name: `布林带突破`,
      description: `价格触及布林带下轨买入，触及上轨卖出`,
      strategy: { type: 'bollinger', params: { bbPeriod: 20, bbStdDev: 2 } },
    };
  }
  return null;
}

// ── Stop Loss / Take Profit Extraction ─────────────────────────────────────

function extractRiskManagement(text: string, strategy: ParsedStrategy['strategy']): void {
  // "止损 3%" / "stop loss 3%" / "亏 3% 止损"
  const slMatch = text.match(/(?:止损|stop\s*loss|亏(?:损)?)\s*(\d+(?:\.\d+)?)\s*%/i);
  if (slMatch) strategy.stopLoss = parseFloat(slMatch[1]);

  // "止盈 5%" / "涨 5% 卖出" / "take profit 5%" / "目标 5%"
  const tpMatch = text.match(/(?:止盈|take\s*profit|目标|涨)\s*(\d+(?:\.\d+)?)\s*%\s*(?:卖出|平仓|exit)?/i);
  if (tpMatch && !/卖\s*出/.test(text.match(/MA|RSI|MACD|布林|bollinger/i)?.[0] ?? '')) {
    strategy.takeProfit = parseFloat(tpMatch[1]);
  }

  // "涨 X% 卖出" as take-profit (only if no other SELL signal)
  if (!strategy.takeProfit) {
    const sellPctMatch = text.match(/涨\s*(\d+(?:\.\d+)?)\s*%\s*卖出/i);
    if (sellPctMatch) {
      strategy.takeProfit = parseFloat(sellPctMatch[1]);
    }
  }
}

// ── Main Parser ────────────────────────────────────────────────────────────

export function parseNaturalLanguage(input: string): ParsedStrategy {
  const text = input.trim();
  if (!text) {
    return { success: false, name: '', description: '', strategy: { type: 'ma_cross', params: {} }, error: '输入为空' };
  }

  log.info('[NLParser] Parsing:', text);

  // Try each pattern matcher
  const matchers = [matchMACross, matchRSI, matchMACD, matchMomentum, matchBollinger];

  for (const matcher of matchers) {
    const result = matcher(text);
    if (result) {
      const symbol = result.symbol || extractSymbol(text);
      extractRiskManagement(text, result.strategy);

      // Append risk info to description
      if (result.strategy.stopLoss) {
        result.description += `，止损 ${result.strategy.stopLoss}%`;
      }
      if (result.strategy.takeProfit) {
        result.description += `，止盈 ${result.strategy.takeProfit}%`;
      }
      if (symbol) {
        result.description += `，标的 ${symbol}`;
      }

      log.info('[NLParser] Matched:', result.strategy.type, result.name);
      return { success: true, ...result, symbol };
    }
  }

  // Fallback: try to detect any indicator mention
  const hasIndicator = /RSI|MACD|MA|均线|布林|bollinger|动量|momentum/i.test(text);
  if (hasIndicator) {
    log.warn('[NLParser] Indicator detected but no pattern matched:', text);
  }

  return {
    success: false,
    name: '',
    description: '',
    strategy: { type: 'ma_cross', params: {} },
    error: '无法识别策略模式。试试：\n• "MA5 上穿 MA20 买入 TQQQ"\n• "RSI 低于 30 买入"\n• "MACD 金叉买入"\n• "布林带下轨买入"',
  };
}

// ── Strategy Templates ─────────────────────────────────────────────────────

export const STRATEGY_TEMPLATES = [
  {
    id: 'ma_cross_10_30',
    name: 'MA10/MA30 均线交叉',
    description: '短期均线上穿长期均线时买入，下穿时卖出。经典趋势跟踪策略。',
    category: '趋势跟踪',
    risk: '中',
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 10, longPeriod: 30 } },
  },
  {
    id: 'ma_cross_5_20',
    name: 'MA5/MA20 均线交叉',
    description: '快速均线交叉，适合短线交易，信号更频繁但假信号更多。',
    category: '趋势跟踪',
    risk: '高',
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 5, longPeriod: 20 } },
  },
  {
    id: 'rsi_30_70',
    name: 'RSI 超买超卖',
    description: 'RSI < 30 买入，RSI > 70 卖出。经典均值回归策略。',
    category: '均值回归',
    risk: '中',
    strategy: { type: 'rsi' as const, params: { oversold: 30, overbought: 70, rsiPeriod: 14 } },
  },
  {
    id: 'rsi_20_80',
    name: 'RSI 极端反转',
    description: 'RSI < 20 买入，RSI > 80 卖出。更保守的均值回归。',
    category: '均值回归',
    risk: '低',
    strategy: { type: 'rsi' as const, params: { oversold: 20, overbought: 80, rsiPeriod: 14 } },
  },
  {
    id: 'macd_cross',
    name: 'MACD 金叉/死叉',
    description: 'MACD 柱状图由负转正买入，由正转负卖出。中长期趋势策略。',
    category: '趋势跟踪',
    risk: '中',
    strategy: { type: 'macd' as const, params: { macdFast: 12, macdSlow: 26, macdSignal: 9 } },
  },
  {
    id: 'momentum_20d',
    name: '20日动量突破',
    description: '过去20日涨幅超过5%时买入，跌超5%时卖出。',
    category: '动量',
    risk: '高',
    strategy: { type: 'momentum' as const, params: { lookback: 20, threshold: 5 } },
  },
  {
    id: 'bollinger_lower',
    name: '布林带突破',
    description: '价格触及布林带下轨买入，触及上轨卖出。',
    category: '均值回归',
    risk: '中',
    strategy: { type: 'bollinger' as const, params: { bbPeriod: 20, bbStdDev: 2 } },
  },
  {
    id: 'tqqq_momentum',
    name: 'TQQQ 趋势跟踪',
    description: 'MA10/MA30 均线交叉 + 5% 止损，专为 TQQQ 设计。',
    category: '趋势跟踪',
    risk: '高',
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 10, longPeriod: 30 }, stopLoss: 5 },
    symbol: 'US.TQQQ',
  },
];
