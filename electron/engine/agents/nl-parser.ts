// ── NL Parser — languagestrategy/policy v2 ──────────────────────────────────────
// rule： + ， 5 + 
// Phase 2: LLM API 
// Phase 3: + extension + LLMinterface/API

import log from 'electron-log';

import { spawn } from 'child_process';
import path from 'path';
import i18n from '../../../src/i18n';
import { EngineError } from '../core/engine-error';


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
// Phase 3: languagestrategy/policy

const SYNONYM_MAP: Record<string, string> = {
 // moving average / MA 
  [i18n.t('nlParser.k1')]: 'MA',
  [i18n.t('nlParser.k2')]: i18n.t('nlParser.k3'),
  [i18n.t('nlParser.k4')]: i18n.t('nlParser.k5'),
  [i18n.t('nlParser.k6')]: i18n.t('nlParser.k7'),
  [i18n.t('nlParser.k8')]: 'MA',
  [i18n.t('nlParser.k9')]: 'MA',
 // MACD 
  [i18n.t('nlParser.k10')]: i18n.t('nlParser.k11'),
  [i18n.t('nlParser.k12')]: i18n.t('nlParser.k13'),
  [i18n.t('nlParser.k14')]: i18n.t('nlParser.k15'),
  [i18n.t('nlParser.k16')]: i18n.t('nlParser.k17'),
  [i18n.t('nlParser.k18')]: i18n.t('nlParser.k19'),
  [i18n.t('nlParser.k20')]: i18n.t('nlParser.k21'),
 // RSI 
  [i18n.t('nlParser.k22')]: 'RSI',
  [i18n.t('nlParser.k23')]: 'RSI',
  [i18n.t('nlParser.k24')]: i18n.t('nlParser.k25'),
  [i18n.t('nlParser.k26')]: i18n.t('nlParser.k27'),
  [i18n.t('nlParser.k28')]: i18n.t('nlParser.k29'),
  [i18n.t('nlParser.k30')]: i18n.t('nlParser.k31'),
 // Bollinger Bands
  [i18n.t('nlParser.k32')]: i18n.t('nlParser.k33'),
  'boll': i18n.t('nlParser.k34'),
  'bollinger band': i18n.t('nlParser.k35'),
 // momentum
  [i18n.t('nlParser.k36')]: 'momentum',
  [i18n.t('nlParser.k37')]: 'momentum',
  [i18n.t('nlParser.k38')]: 'momentum',
  ' momentum ': ' momentum ',
 // stop losstake profit
  [i18n.t('nlParser.k39')]: 'stop loss',
  [i18n.t('nlParser.k40')]: 'take profit',
  [i18n.t('nlParser.k41')]: 'stop loss',
[i18n.t()]: 'take profit',
[i18n.t()]: 'stop loss',
[i18n.t()]: 'take profit',
 //
[i18n.t()]: 'trend following',
[i18n.t()]: 'trend following',
[i18n.t()]: 'trend following',
 //
[i18n.t()]: 'BUY',
[i18n.t()]: 'BUY',
[i18n.t()]: 'BUY',
[i18n.t()]: 'BUY',
[i18n.t()]: 'SELL',
[i18n.t()]: 'SELL',
[i18n.t()]: 'SELL',
[i18n.t()]: 'BUY',
[i18n.t()]: 'SELL',
[i18n.t()]: 'SELL',
[i18n.t()]: 'SELL',
};

/**
 * language：
 */
function normalizeInput(text: string): string {
  let normalized = text;
 //
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
// "ATR 14" / "14ATR" / "ATRstop loss" 

interface ATRConfig {
  period: number;   // ATR period，default14
  multiplier: number; // ATR 倍数（用于动态stop loss），default2
}

function extractATRConfig(text: string): ATRConfig | null {
 // "ATR 14" / "14ATR" / "ATRstop loss"
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
 // "MA5 MA20 " / "moving average MA10 MA30" / "5moving average20moving average"
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
          name: i18n.t('nlParser.k59'),
          description: i18n.t('nlParser.k60'),
          strategy: { type: 'ma_cross', params: { shortPeriod: short, longPeriod: long } },
        };
      }
    }
  }
  return null;
}

function matchRSI(text: string): MatcherResult | null {
 // "RSI 30 " / "RSI < 30 , RSI > 70 " / "RSI"
  const buyMatch = text.match(/RSI\s*(?:低于|小于|<|<=|below)\s*(\d+)/i);
  const sellMatch = text.match(/RSI\s*(?:高于|大于|>|>=|above)\s*(\d+)/i);

  if (buyMatch) {
    const oversold = parseInt(buyMatch[1]);
    const overbought = sellMatch ? parseInt(sellMatch[1]) : 70;
    return {
      name: i18n.t('nlParser.k61'),
      description: i18n.t('nlParser.k62'),
      strategy: { type: 'rsi', params: { oversold, overbought, rsiPeriod: 14 } },
    };
  }

 // "RSI " shorthand
  if (/RSI\s*超卖/i.test(text)) {
    return {
      name: i18n.t('nlParser.k63'),
      description: i18n.t('nlParser.k64'),
      strategy: { type: 'rsi', params: { oversold: 30, overbought: 70, rsiPeriod: 14 } },
    };
  }

  return null;
}

function matchMACD(text: string): MatcherResult | null {
 // "MACD " / "MACD " / "MACD cross"
  if (/MACD\s*(?:金叉|cross\s*up|bullish)/i.test(text)) {
    const fast = extractNumber(text, /快线\s*(\d+)/i) ?? 12;
    const slow = extractNumber(text, /慢线\s*(\d+)/i) ?? 26;
    return {
      name: i18n.t('nlParser.k65'),
      description: i18n.t('nlParser.k66'),
      strategy: { type: 'macd', params: { macdFast: fast, macdSlow: slow, macdSignal: 9 } },
    };
  }
  return null;
}

function matchMomentum(text: string): MatcherResult | null {
 // " 5% " / "20new high" / "momentumbreakout" / "Nbreakout"
  const lookback = extractNumber(text, /(\d+)\s*日/i) ?? 20;
  const threshold = extractNumber(text, /(?:涨|跌|突破|涨幅|变化)\s*(\d+)\s*%/i) ?? 5;

  if (/\d+\s*日?\s*(?:新高|突破|高点)/i.test(text) || /momentum|动量/i.test(text)) {
    return {
      name: i18n.t('nlParser.k67'),
      description: i18n.t('nlParser.k68'),
      strategy: { type: 'momentum', params: { lookback, threshold } },
    };
  }
  return null;
}

function matchBollinger(text: string): MatcherResult | null {
 // "Bollinger Bands" / "Bollinger lower band buy" / ""
  if (/布林|bollinger|boll/i.test(text) && /(下轨|lower|底部|支撑)/i.test(text)) {
    return {
      name: i18n.t('nlParser.k69'),
      description: i18n.t('nlParser.k70'),
      strategy: { type: 'bollinger', params: { bbPeriod: 20, bbStdDev: 2 } },
    };
  }
  return null;
}

// ── PriceCondition Parser (Phase 4.2) ──────────────────────────────────────────
// "AAPL 200" → above
// "AAPL 200" → crosses_below ()
// "AAPL 200" → crosses_above
// "AAPL 200" → crosses_below
// "AAPL 200" / "AAPL 200" → above
// "AAPL 200" → below
// "AAPL > 200" / "AAPL > 200" → above
// "AAPL < 200" / "AAPL < 200" → below
// "AAPL breakout 200" → crosses_above (default above，)

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
      name: i18n.t('nlParser.k71'),
      description: i18n.t('nlParser.k73'),
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'crosses_above', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 2. crosses_below: crossing DOWN through the price level
  if (/下穿|跌破|跌穿|降穿|crosses?\s*below|cross.*down/i.test(text)) {
    return {
      name: i18n.t('nlParser.k74'),
      description: i18n.t('nlParser.k76'),
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'crosses_below', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 3. steady above: price is already above the target
  if (/超过|高于|涨到|升到|价格超过|价格高于|above\b|\+\s*\$/i.test(text)) {
    return {
      name: i18n.t('nlParser.k77'),
      description: i18n.t('nlParser.k79'),
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'above', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 4. steady below: price is already below the target
  if (/低于|价格低于|价格\s*<|price\s*<|\s<\s|below\b/i.test(text)) {
    return {
      name: i18n.t('nlParser.k80'),
      description: i18n.t('nlParser.k82'),
      strategy: { type: 'ma_cross', params: {} },
      condition: { type: 'price', operator: 'below', targetPrice: price, reference: 'close', symbol },
    };
  }

  // 5. Generic fallback: any number present but no clear operator → treat as 'above'
  return {
    name: i18n.t('nlParser.k83'),
    description: i18n.t('nlParser.k85'),
    strategy: { type: 'ma_cross', params: {} },
    condition: { type: 'price', operator: 'above', targetPrice: price, reference: 'close', symbol },
  };
}

/*
 * TEMPORARY STUB to replace the old (now duplicate) function below.
 * The real implementation is above. Remove this stub after verifying all tests pass.
 */
function _stubMatchPriceCondition(_text: string): PriceConditionResult | null { return null; }

// ── Stop Loss / Take Profit Extraction (Phase 3 ) ─────────────────────
// ：stop lossN%、N%stop loss、N%stop loss、NATRstop loss、stop loss

function extractRiskManagement(text: string, strategy: ParsedStrategy['strategy']): void {
 // "stop loss 3%" / "stop loss 3%" / " 3% stop loss" / " 3%"
  const slMatch = text.match(/(?:止损|stop\s*loss|亏(?:损)?|赔)\s*(\d+(?:\.\d+)?)\s*%/i);
  if (slMatch) strategy.stopLoss = parseFloat(slMatch[1]);

 // "take profit 5%" / " 5% " / "take profit 5%" / " 5%" / " 5%"
  const tpMatch = text.match(/(?:止盈|take\s*profit|目标|涨|赚)\s*(\d+(?:\.\d+)?)\s*%\s*(?:卖出|平仓|exit)?/i);
  if (tpMatch) {
    strategy.takeProfit = parseFloat(tpMatch[1]);
  }

 // " X% " as take-profit (only if no other SELL signal)
  if (!strategy.takeProfit) {
    const sellPctMatch = text.match(/涨\s*(\d+(?:\.\d+)?)\s*%\s*卖出/i);
    if (sellPctMatch) {
      strategy.takeProfit = parseFloat(sellPctMatch[1]);
    }
  }

 // "NATRstop loss" / "ATRstop loss" — ATR-based stop loss（ risk-engine.ts ）
  const atrMatch = text.match(/(\d+(?:\.\d+)?)\s*[倍×xX]?\s*ATR\s*(?:止损|止损平仓)/i)
    || text.match(/ATR\s*(?:止损)\s*(?:\d+(?:\.\d+)?)?\s*[倍×xX]?/i);
  if (atrMatch) {
 // ：strategy.stopLoss = -1 ATR stop loss
    strategy.stopLoss = -1; // -1 表示由 ATR 引擎决定
  }
}

// ── LLM Fallback Interface (Phase 3 ) ──────────────────────────────────
// rule， DeepSeek Qwen API

interface LLMParseResult {
  type: 'ma_cross' | 'rsi' | 'macd' | 'momentum' | 'bollinger' | 'combined';
  params: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
  symbol?: string;
  reason: string;
}

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:3001/api/ai/gateway';
const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN || '';

const LLM_PROMPT_TEMPLATE = `${i18n.t('NlParser.k0')}
{
  "type": "ma_cross|rsi|macd|momentum|bollinger|combined",
  ${i18n.t('NlParser.k1')}
  ${i18n.t('NlParser.k2')}
  ${i18n.t('NlParser.k3')}
  ${i18n.t('NlParser.k4')}
  "reason": i18n.t('nlParser.k86')
}

${i18n.t('NlParser.k5')}

${i18n.t('NlParser.k6')}`;

function callLLM(input: string): Promise<LLMParseResult | null> {
  return new Promise((resolve) => {
    const gatewayUrl = new URL(AI_GATEWAY_URL);
    const prompt = LLM_PROMPT_TEMPLATE.replace('{{INPUT}}', input);
    const body = JSON.stringify({
      provider: 'deepseek',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
    });

    const options = {
      hostname: gatewayUrl.hostname,
      port: gatewayUrl.port,
      path: gatewayUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_GATEWAY_TOKEN}`,
      },
    };

    try {
      const req = require('https').request(options, (res: unknown) => {
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
          } catch (_e: unknown) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.write(body);
      req.end();
    } catch (_e: unknown) {
      resolve(null);
    }
  });
}

// ── Main Parser ────────────────────────────────────────────────────────────

export function parseNaturalLanguage(input: string): ParsedStrategy {
  const text = input.trim();
  if (!text) {
    return { success: false, name: '', description: '', strategy: { type: 'ma_cross', params: {} }, error: i18n.t('nlParser.k87') };
  }

 // Phase 3: 
  const normalized = normalizeInput(text);
  log.info('[NLParser] Original:', text);
  log.info('[NLParser] Normalized:', normalized);

  // Phase 4.2: Try PriceCondition matcher.
  // Only match when an explicit stock symbol is present AND no risk-management keywords.
 // This prevents false matches on: "RSI 20", "stop loss 3%", "MA5MA20TQQQstop loss5%".
  const hasRiskMgmt = /止损|止盈|stop\s*loss|take\s*profit/i.test(normalized);
  if (extractSymbol(normalized) && !hasRiskMgmt) {
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
        result.description += i18n.t('nlParser.k88');
      } else if (result.strategy.stopLoss === -1) {
        result.description += i18n.t('nlParser.k89');
      }
      if (result.strategy.takeProfit) {
        result.description += i18n.t('nlParser.k90');
      }
      if (symbol) {
        result.description += i18n.t('nlParser.k91');
      }

      log.info('[NLParser] Matched (rule-based):', result.strategy.type, result.name);
      return { success: true, ...result, symbol };
    }
  }

 // Phase 3: rulefailed， LLM 
  log.info('[NLParser] Rule engine failed, trying LLM fallback...');
  callLLM(text).then((llmResult) => {
    if (llmResult) {
      log.info('[NLParser] LLM matched:', llmResult.type, llmResult.reason);
    }
  }).catch((_: unknown) => {});

  // Fallback: try to detect any indicator mention
  const hasIndicator = /RSI|MACD|MA|均线|布林|bollinger|动量|momentum/i.test(text);
  if (hasIndicator) {
    log.warn('[NLParser] Indicator detected but no pattern matched:', text);
    return {
      success: false,
      name: '',
      description: '',
      strategy: { type: 'ma_cross', params: {} },
      error: `${i18n.t('NlParser.k7')}
• i18n.t('nlParser.k92')
• i18n.t('nlParser.k93')
• i18n.t('nlParser.k94')
• i18n.t('nlParser.k95')`,
    };
  }

  return {
    success: false,
    name: '',
    description: '',
    strategy: { type: 'ma_cross', params: {} },
    error: `${i18n.t('NlParser.k8')} ${i18n.t('nlParser.k96')}\n• ${i18n.t('nlParser.k97')}\n• ${i18n.t('nlParser.k98')}\n• ${i18n.t('nlParser.k99')}`,
  };
}

// ── Strategy Templates ─────────────────────────────────────────────────────

export const STRATEGY_TEMPLATES = [
  {
    id: 'ma_cross_10_30',
    name: i18n.t('nlParser.k100'),
    description: i18n.t('nlParser.k101'),
    category: i18n.t('nlParser.k102'),
    risk: i18n.t('nlParser.k103'),
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 10, longPeriod: 30 } },
  },
  {
    id: 'ma_cross_5_20',
    name: i18n.t('nlParser.k104'),
    description: i18n.t('nlParser.k105'),
    category: i18n.t('nlParser.k106'),
    risk: i18n.t('nlParser.k107'),
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 5, longPeriod: 20 } },
  },
  {
    id: 'rsi_30_70',
    name: i18n.t('nlParser.k108'),
    description: i18n.t('nlParser.k109'),
    category: i18n.t('nlParser.k110'),
    risk: i18n.t('nlParser.k111'),
    strategy: { type: 'rsi' as const, params: { oversold: 30, overbought: 70, rsiPeriod: 14 } },
  },
  {
    id: 'rsi_20_80',
    name: i18n.t('nlParser.k112'),
    description: i18n.t('nlParser.k113'),
    category: i18n.t('nlParser.k114'),
    risk: i18n.t('nlParser.k115'),
    strategy: { type: 'rsi' as const, params: { oversold: 20, overbought: 80, rsiPeriod: 14 } },
  },
  {
    id: 'macd_cross',
    name: i18n.t('nlParser.k116'),
    description: i18n.t('nlParser.k117'),
    category: i18n.t('nlParser.k118'),
    risk: i18n.t('nlParser.k119'),
    strategy: { type: 'macd' as const, params: { macdFast: 12, macdSlow: 26, macdSignal: 9 } },
  },
  {
    id: 'momentum_20d',
    name: i18n.t('nlParser.k120'),
    description: i18n.t('nlParser.k121'),
    category: i18n.t('nlParser.k122'),
    risk: i18n.t('nlParser.k123'),
    strategy: { type: 'momentum' as const, params: { lookback: 20, threshold: 5 } },
  },
  {
    id: 'bollinger_lower',
    name: i18n.t('nlParser.k124'),
    description: i18n.t('nlParser.k125'),
    category: i18n.t('nlParser.k126'),
    risk: i18n.t('nlParser.k127'),
    strategy: { type: 'bollinger' as const, params: { bbPeriod: 20, bbStdDev: 2 } },
  },
  {
    id: 'tqqq_momentum',
    name: i18n.t('nlParser.k128'),
    description: i18n.t('nlParser.k129'),
    category: i18n.t('nlParser.k130'),
    risk: i18n.t('nlParser.k131'),
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 10, longPeriod: 30 }, stopLoss: 5 },
    symbol: 'US.TQQQ',
  },
  {
    id: 'ma_cross_20_50',
    name: i18n.t('nlParser.k132'),
    description: i18n.t('nlParser.k133'),
    category: i18n.t('nlParser.k134'),
    risk: i18n.t('nlParser.k135'),
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 20, longPeriod: 50 } },
  },
  {
    id: 'rsi_40_60_tight',
    name: i18n.t('nlParser.k136'),
    description: i18n.t('nlParser.k137'),
    category: i18n.t('nlParser.k138'),
    risk: i18n.t('nlParser.k139'),
    strategy: { type: 'rsi' as const, params: { oversold: 40, overbought: 60, rsiPeriod: 14 } },
  },
  {
    id: 'macd_fast',
    name: i18n.t('nlParser.k140'),
    description: i18n.t('nlParser.k141'),
    category: i18n.t('nlParser.k142'),
    risk: i18n.t('nlParser.k143'),
    strategy: { type: 'macd' as const, params: { macdFast: 6, macdSlow: 13, macdSignal: 5 } },
  },
  {
    id: 'momentum_5d_short',
    name: i18n.t('nlParser.k144'),
    description: i18n.t('nlParser.k145'),
    category: i18n.t('nlParser.k146'),
    risk: i18n.t('nlParser.k147'),
    strategy: { type: 'momentum' as const, params: { lookback: 5, threshold: 3 } },
  },
  {
    id: 'bollinger_narrow',
    name: i18n.t('nlParser.k148'),
    description: i18n.t('nlParser.k149'),
    category: i18n.t('nlParser.k150'),
    risk: i18n.t('nlParser.k151'),
    strategy: { type: 'bollinger' as const, params: { bbPeriod: 20, bbStdDev: 1.5 } },
  },
  {
    id: 'spy_conservative',
    name: i18n.t('nlParser.k152'),
    description: i18n.t('nlParser.k153'),
    category: i18n.t('nlParser.k154'),
    risk: i18n.t('nlParser.k155'),
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 20, longPeriod: 50 }, stopLoss: 3, takeProfit: 10 },
    symbol: 'US.SPY',
  },
  {
    id: 'soxl_aggressive',
    name: i18n.t('nlParser.k156'),
    description: i18n.t('nlParser.k157'),
    category: i18n.t('nlParser.k158'),
    risk: i18n.t('nlParser.k159'),
    strategy: { type: 'ma_cross' as const, params: { shortPeriod: 5, longPeriod: 20 }, stopLoss: 8 },
    symbol: 'US.SOXL',
  },
];

// ── Exports ───────────────────────────────────────────────────────────────

export { normalizeInput, SYNONYM_MAP, extractATRConfig };
export type { ATRConfig };
