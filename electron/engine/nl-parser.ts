// ── NL Parser — 自然语言策略解析器 v2 ──────────────────────────────────────
// 规则引擎：正则 + 关键词匹配，支持 5 种模式 + 同义词映射
// Phase 2: 接入 LLM API 做更复杂的解析
// Phase 3: 同义词映射 + 语义扩展 + LLM接口预留

import log from 'electron-log';
import { spawn } from 'child_process';
import path from 'path';

export interface PriceConditionOutput {
  type: 'price';
  operator: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  targetPrice: number;
  reference?: string;
}

interface ParsedStrategy {
  success: boolean;
  name: string;
  description: string;
  strategy: {
    type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'combined' | 'price_condition';
    params: Record<string, number>;
    stopLoss?: number;
    takeProfit?: number;
  };
  condition?: PriceConditionOutput;
  symbol?: string;
  error?: string;
}

// ── Synonym Mapping ─────────────────────────────────────────────────────
// Phase 3: 将自然语言同义词映射到标准策略关键词

const SYNONYM_MAP: Record<string, string> = {
  // 均线 / MA 同义词
  '均线': 'MA',
  '均线交叉': 'MA 交叉',
  '均线金叉': 'MA 金叉',
  '均线死叉': 'MA 死叉',
  '平均线': 'MA',
  '移动平均线': 'MA',
  // MACD 同义词
  'macd金叉': 'MACD 金叉',
  'macd死叉': 'MACD 死叉',
  'macd看涨': 'MACD 金叉',
  'macd看跌': 'MACD 死叉',
  'dif线上穿dea线': 'MACD 金叉',
  'dif线下穿dea线': 'MACD 死叉',
  // RSI 同义词
  '相对强弱指标': 'RSI',
  '相对强弱': 'RSI',
  '超卖买入': 'RSI 超卖',
  '超买卖出': 'RSI 超买',
  'rsi低位': 'RSI 低于 30',
  'rsi高位': 'RSI 高于 70',
  // 布林带同义词
  '布林轨道': '布林带',
  'boll': '布林带',
  'bollinger band': '布林带',
  // 动量同义词
  '动量策略': 'momentum',
  '动量指标': 'momentum',
  '动能': 'momentum',
  ' momentum ': ' momentum ',
  // 止损止盈同义词
  '止损': 'stop loss',
  '止盈': 'take profit',
  '亏损': 'stop loss',
  '盈利': 'take profit',
  '赔': 'stop loss',
  '赚': 'take profit',
  // 趋势同义词
  '趋势跟踪': 'trend following',
  '趋势追踪': 'trend following',
  '顺势': 'trend following',
  // 其他常见词
  '买入': 'BUY',
  '买进': 'BUY',
  '做多': 'BUY',
  '买入开多': 'BUY',
  '卖出': 'SELL',
  '卖空': 'SELL',
  '做空': 'SELL',
  '多头': 'BUY',
  '空头': 'SELL',
  '平仓': 'SELL',
  '止损平仓': 'SELL',
};

/**
 * 将自然语言输入规范化：用同义词映射替换口语化表达
 */
function normalizeInput(text: string): string {
  let normalized = text;
  // 按长度降序排列（优先匹配最长词）
  const sorted = Object.keys(SYNONYM_MAP).sort((a, b) => b.length - a.length);
  for (const synonym of sorted) {
    const regex = new RegExp(synonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    normalized = normalized.replace(regex, SYNONYM_MAP[synonym]);
  }
  return normalized;
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

// ── ATR Parameter Extraction (Phase 3) ──────────────────────────────────────
// 支持 "ATR 14" / "14日ATR" / "ATR止损" 等语义

interface ATRConfig {
  period: number;   // ATR 周期，默认14
  multiplier: number; // ATR 倍数（用于动态止损），默认2
}

function extractATRConfig(text: string): ATRConfig | null {
  // "ATR 14" / "14日ATR" / "ATR止损"
  const periodMatch = text.match(/ATR\s*(\d+)|(\d+)\s*日\s*ATR/i);
  const period = periodMatch
    ? parseInt(periodMatch[1] || periodMatch[2])
    : 14;

  const multMatch = text.match(/(?:ATR?\s*(?:止损|倍|×|x)|止损\s*(?:ATR?|\d+))(?:\s*(?:ATR?|\d+)\s*[倍×xX])?\s*(\d+(?:\.\d+)?)/i)
    || text.match(/(?:\d+(?:\.\d+)?)\s*(?:倍|×|x)\s*ATR/i);
  const multiplier = multMatch ? parseFloat(multMatch[1]) : 2;

  if (/ATR|日\s*ATR/i.test(text) && period > 0) {
    return { period, multiplier };
  }
  return null;
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

// ── PriceCondition Parser (Phase 4.2) ──────────────────────────────────────────
// "AAPL 涨破 200" → above
// "AAPL 跌破 200" → crosses_below (下穿)
// "AAPL 上穿 200" → crosses_above
// "AAPL 下穿 200" → crosses_below
// "AAPL 超过 200" / "AAPL 涨到 200" → above
// "AAPL 低于 200" → below
// "AAPL 价格 > 200" / "AAPL > 200" → above
// "AAPL 价格 < 200" / "AAPL < 200" → below
// "AAPL 突破 200" → crosses_above (默认下穿为 above，歧义处理)

interface PriceConditionResult extends MatcherResult {
  condition: {
    type: 'price';
    operator: 'above' | 'below' | 'crosses_above' | 'crosses_below';
    targetPrice: number;
    reference?: string;
    symbol?: string;
  };
}

function matchPriceCondition(text: string): PriceConditionResult | null {
  const symbol = extractSymbol(text);

  // Extract the last reasonable price number from text
  const numbers = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map(m => parseFloat(m[1]));
  const price = numbers.find(n => n >= 10 && n <= 999999);
  if (!price) return null;

  // ── Operator priority (most specific first) ──────────────────────

  // 1. crosses_above: crossing UP through the price level
  if (/上穿|涨破|突破|升穿|crosses?\s*above|cross.*up/i.test(text)) {
    return {
      name: `${symbol || ''} 上穿 ${price}`,
      description: `当${symbol || '标的'}价格上穿 ${price} 时触发`,
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'crosses_above', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 2. crosses_below: crossing DOWN through the price level
  if (/下穿|跌破|跌穿|降穿|crosses?\s*below|cross.*down/i.test(text)) {
    return {
      name: `${symbol || ''} 下穿 ${price}`,
      description: `当${symbol || '标的'}价格下穿 ${price} 时触发`,
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'crosses_below', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 3. steady above: price is already above the target
  if (/超过|高于|涨到|升到|价格超过|价格高于|above\b|\+\s*\$/i.test(text)) {
    return {
      name: `${symbol || ''} 高于 ${price}`,
      description: `当${symbol || '标的'}价格高于 ${price} 时触发`,
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'above', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 4. steady below: price is already below the target
  if (/低于|价格低于|价格\s*<|price\s*<|\s<\s|below\b/i.test(text)) {
    return {
      name: `${symbol || ''} 低于 ${price}`,
      description: `当${symbol || '标的'}价格低于 ${price} 时触发`,
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'below', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 5. Generic fallback: any number present but no clear operator → treat as 'above'
  return {
    name: `${symbol || ''} 超过 ${price}`,
    description: `当${symbol || '标的'}价格超过 ${price} 时触发`,
    strategy: { type: 'ma_cross', params: {} },
    condition: { type: 'price', operator: 'above', targetPrice: price, reference: 'close', symbol },
  };
}

/*
 * TEMPORARY STUB to replace the old (now duplicate) function below.
 * The real implementation is above. Remove this stub after verifying all tests pass.
 */
function _stubMatchPriceCondition(_text: string): PriceConditionResult | null { return null; }

// ── Stop Loss / Take Profit Extraction (Phase 3 增强) ─────────────────────
// 支持：止损N%、亏N%止损、跌N%止损、N倍ATR止损、跟踪止损

function extractRiskManagement(text: string, strategy: ParsedStrategy['strategy']): void {
  // "止损 3%" / "stop loss 3%" / "亏 3% 止损" / "赔 3%"
  const slMatch = text.match(/(?:止损|stop\s*loss|亏(?:损)?|赔)\s*(\d+(?:\.\d+)?)\s*%/i);
  if (slMatch) strategy.stopLoss = parseFloat(slMatch[1]);

  // "止盈 5%" / "涨 5% 卖出" / "take profit 5%" / "目标 5%" / "赚 5%"
  const tpMatch = text.match(/(?:止盈|take\s*profit|目标|涨|赚)\s*(\d+(?:\.\d+)?)\s*%\s*(?:卖出|平仓|exit)?/i);
  if (tpMatch) {
    strategy.takeProfit = parseFloat(tpMatch[1]);
  }

  // "涨 X% 卖出" as take-profit (only if no other SELL signal)
  if (!strategy.takeProfit) {
    const sellPctMatch = text.match(/涨\s*(\d+(?:\.\d+)?)\s*%\s*卖出/i);
    if (sellPctMatch) {
      strategy.takeProfit = parseFloat(sellPctMatch[1]);
    }
  }

  // "N倍ATR止损" / "ATR止损" — 标记为 ATR-based stop loss（由 risk-engine.ts 实现）
  const atrMatch = text.match(/(\d+(?:\.\d+)?)\s*[倍×xX]?\s*ATR\s*(?:止损|止损平仓)/i)
    || text.match(/ATR\s*(?:止损)\s*(?:\d+(?:\.\d+)?)?\s*[倍×xX]?/i);
  if (atrMatch) {
    // 标记：strategy.stopLoss = -1 表示使用 ATR 动态止损
    strategy.stopLoss = -1; // -1 表示由 ATR 引擎决定
  }
}

// ── LLM Fallback Interface (Phase 3 预留) ──────────────────────────────────
// 当规则引擎无法解析时，调用 DeepSeek 或 Qwen API

interface LLMParseResult {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'combined';
  params: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
  symbol?: string;
  reason: string;
}

const LLM_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const LLM_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const LLM_PROMPT_TEMPLATE = `你是一个量化交易策略解析器。请从用户输入中提取策略参数，返回 JSON：
{
  "type": "ma_cross|rsi|macd|momentum|bollinger|combined",
  "params": { /* 指标参数 */ },
  "stopLoss": 数字（百分比），无则null,
  "takeProfit": 数字（百分比），无则null,
  "symbol": "US.XXX"格式，无则null,
  "reason": "信号理由"
}

用户输入：{{INPUT}}

只返回 JSON，不要其他文字。`;

function callLLM(input: string, apiKey: string): Promise<LLMParseResult | null> {
  return new Promise((resolve) => {
    if (!apiKey) {
      resolve(null);
      return;
    }

    const prompt = LLM_PROMPT_TEMPLATE.replace('{{INPUT}}', input);
    const body = JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
    });


    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    };

    try {
      const req = require('https').request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.message?.content || '{}';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.write(body);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

// ── Main Parser ────────────────────────────────────────────────────────────

export function parseNaturalLanguage(input: string): ParsedStrategy {
  const text = input.trim();
  if (!text) {
    return { success: false, name: '', description: '', strategy: { type: 'ma_cross', params: {} }, error: '输入为空' };
  }

  // Phase 3: 同义词规范化
  const normalized = normalizeInput(text);
  log.info('[NLParser] Original:', text);
  log.info('[NLParser] Normalized:', normalized);

  // Phase 4.2: Try PriceCondition matcher.
  // Skip if text contains "MA" followed by a number (indicator pattern like MA5/MA20)
  // or "EMA" / "SMA" — these are strategy indicators, not price triggers.
  if (!/\bMA\s*\d|\bEMA\s*\d|\bSMA\s*\d/i.test(normalized)) {
    const priceResult = matchPriceCondition(normalized);
    if (priceResult) {
      // Extract symbol separately — matchers don't return it
      const symbol = extractSymbol(normalized) || undefined;
      log.info('[NLParser] PriceCondition matched:', priceResult.condition);
      return {
        success: true,
        name: priceResult.name,
        description: priceResult.description,
        strategy: { type: 'price_condition', params: {} },
        condition: { ...priceResult.condition, symbol },
        symbol,
      };
    }
  }

  // Try each pattern matcher
  const matchers = [matchMACross, matchRSI, matchMACD, matchMomentum, matchBollinger];

  for (const matcher of matchers) {
    const result = matcher(normalized) as MatcherResult | null;
    if (result) {
      const symbol = result.symbol || extractSymbol(normalized);
      extractRiskManagement(normalized, result.strategy);

      // Append risk info to description
      if (result.strategy.stopLoss !== undefined && result.strategy.stopLoss !== -1) {
        result.description += `，止损 ${result.strategy.stopLoss}%`;
      } else if (result.strategy.stopLoss === -1) {
        result.description += `，ATR 动态止损`;
      }
      if (result.strategy.takeProfit) {
        result.description += `，止盈 ${result.strategy.takeProfit}%`;
      }
      if (symbol) {
        result.description += `，标的 ${symbol}`;
      }

      log.info('[NLParser] Matched (rule-based):', result.strategy.type, result.name);
      return { success: true, ...result, symbol };
    }
  }

  // Phase 3: 规则引擎失败，尝试 LLM 兜底
  log.info('[NLParser] Rule engine failed, trying LLM fallback...');
  callLLM(text, process.env.DEEPSEEK_API_KEY || '').then((llmResult) => {
    if (llmResult) {
      log.info('[NLParser] LLM matched:', llmResult.type, llmResult.reason);
    }
  }).catch(() => {});

  // Fallback: try to detect any indicator mention
  const hasIndicator = /RSI|MACD|MA|均线|布林|bollinger|动量|momentum/i.test(text);
  if (hasIndicator) {
    log.warn('[NLParser] Indicator detected but no pattern matched:', text);
    return {
      success: false,
      name: '',
      description: '',
      strategy: { type: 'ma_cross', params: {} },
      error: `检测到指标但无法解析具体模式。请尝试更明确的表达，如：
• "MA5 上穿 MA20 买入 TQQQ"
• "RSI 低于 30 买入，止损 3%"
• "MACD 金叉买入，2倍ATR止损"
• "布林带下轨买入"`,
    };
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
  {
    id: 'ma_cross_20_50',
    name: 'MA20/MA50 慢速交叉',
    description: '中长期均线交叉，信号少但可靠。适合大资金趋势跟踪。',
    category: '趋势跟踪',
    risk: '低',
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 20, longPeriod: 50 } },
  },
  {
    id: 'rsi_40_60_tight',
    name: 'RSI 窄幅波段',
    description: 'RSI < 40 买入，RSI > 60 卖出。适合震荡市高频交易。',
    category: '均值回归',
    risk: '高',
    strategy: { type: 'rsi' as const, params: { oversold: 40, overbought: 60, rsiPeriod: 14 } },
  },
  {
    id: 'macd_fast',
    name: 'MACD 快速信号',
    description: '快线6/慢线13/信号线5，更灵敏的MACD变体。',
    category: '趋势跟踪',
    risk: '高',
    strategy: { type: 'macd' as const, params: { macdFast: 6, macdSlow: 13, macdSignal: 5 } },
  },
  {
    id: 'momentum_5d_short',
    name: '5日短线动量',
    description: '5日内涨幅超3%买入，跌超3%卖出。超短线动量策略。',
    category: '动量',
    risk: '高',
    strategy: { type: 'momentum' as const, params: { lookback: 5, threshold: 3 } },
  },
  {
    id: 'bollinger_narrow',
    name: '布林带收窄 (1.5σ)',
    description: '1.5倍标准差布林带，信号更频繁。适合波动较小的标的。',
    category: '均值回归',
    risk: '中',
    strategy: { type: 'bollinger' as const, params: { bbPeriod: 20, bbStdDev: 1.5 } },
  },
  {
    id: 'spy_conservative',
    name: 'SPY 稳健趋势',
    description: 'MA20/MA50 均线交叉 + 3% 止损 + 10% 止盈，为 SPY 优化。',
    category: '趋势跟踪',
    risk: '低',
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 20, longPeriod: 50 }, stopLoss: 3, takeProfit: 10 },
    symbol: 'US.SPY',
  },
  {
    id: 'soxl_aggressive',
    name: 'SOXL 激进跟踪',
    description: 'MA5/MA20 快速交叉 + 8% 止损，适合半导体3x杠杆ETF。',
    category: '趋势跟踪',
    risk: '高',
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 5, longPeriod: 20 }, stopLoss: 8 },
    symbol: 'US.SOXL',
  },
];

// ── Exports ───────────────────────────────────────────────────────────────

export { normalizeInput, SYNONYM_MAP, extractATRConfig };
export type { ATRConfig };
