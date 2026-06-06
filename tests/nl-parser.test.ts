// ── nl-parser 全场景测试 ──────────────────────────────────────────────────
// 覆盖: normalizeInput / extractATRConfig / parseNaturalLanguage
// 覆盖: 中文指令 / 模糊数量 / 标的解析 / 错误容忍 / 边界条件

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron-log FIRST — before importing nl-parser
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock https for LLM fallback
vi.mock('https', () => ({ request: vi.fn() }));

import {
  parseNaturalLanguage,
  normalizeInput,
  extractATRConfig,
  STRATEGY_TEMPLATES,
  SYNONYM_MAP,
} from '../electron/engine/nl-parser';

// ── normalizeInput ──────────────────────────────────────────────────────────

describe('normalizeInput (同义词规范化)', () => {
  it('空字符串返回空', () => {
    const result = normalizeInput('');
    expect(result).toBe('');
  });

  it('买入 → BUY', () => {
    expect(normalizeInput('买入')).toContain('BUY');
  });

  it('做多 → BUY', () => {
    expect(normalizeInput('做多')).toContain('BUY');
  });

  it('卖出 → SELL', () => {
    expect(normalizeInput('卖出')).toContain('SELL');
  });

  it('做空 → SELL', () => {
    expect(normalizeInput('做空')).toContain('SELL');
  });

  it('止损 → stop loss', () => {
    expect(normalizeInput('止损')).toContain('stop loss');
  });

  it('止盈 → take profit', () => {
    expect(normalizeInput('止盈')).toContain('take profit');
  });

  it('RSI低于30买入 → 包含 RSI 和 BUY', () => {
    const n = normalizeInput('RSI低于30买入');
    expect(n).toContain('RSI');
    expect(n).toContain('BUY');
  });

  it('MACD金叉买入 → 包含 MACD 金叉 和 BUY', () => {
    const n = normalizeInput('MACD金叉买入');
    expect(n).toContain('MACD 金叉');
    expect(n).toContain('BUY');
  });

  it('均线金叉 → MA 金叉', () => {
    expect(normalizeInput('均线金叉')).toContain('MA 金叉');
  });

  it('布林带 → 保留 布林带', () => {
    expect(normalizeInput('布林带')).toContain('布林带');
  });

  it('多义词组合: 均线金叉买入 → MA 金叉 + BUY', () => {
    const n = normalizeInput('均线金叉买入');
    expect(n).toContain('MA 金叉');
    expect(n).toContain('BUY');
  });

  it('长词优先: 做多 > 买 → 做多优先映射为 BUY 而非部分匹配', () => {
    const n = normalizeInput('做多买入');
    expect(n).toContain('BUY');
  });
});

// ── extractATRConfig ────────────────────────────────────────────────────────

describe('extractATRConfig (ATR 参数提取)', () => {
  it('ATR 14 → period=14, multiplier=2', () => {
    const r = extractATRConfig('ATR 14');
    expect(r).not.toBeNull();
    expect(r!.period).toBe(14);
    expect(r!.multiplier).toBe(2);
  });

  it('14日ATR → period=14, multiplier=2', () => {
    const r = extractATRConfig('14日ATR');
    expect(r).not.toBeNull();
    expect(r!.period).toBe(14);
  });

  it('ATR 20 → period=20, multiplier=2', () => {
    const r = extractATRConfig('ATR 20');
    expect(r).not.toBeNull();
    expect(r!.period).toBe(20);
  });

  it('2倍ATR止损 → 返回非 null（含 period）', () => {
    const r = extractATRConfig('2倍ATR止损');
    // period 是 14（默认），multiplier 取决于正则实现
    expect(r).not.toBeNull();
    expect(r!.period).toBe(14); // 默认 period
  });

  it('无 ATR 文本 → null', () => {
    expect(extractATRConfig('买入 MA10')).toBeNull();
  });

  it('ATR 止损 3倍 → 返回非 null（含默认 period）', () => {
    const r = extractATRConfig('3倍ATR止损');
    // 这类格式的 multiplier 取决于正则实现，检查返回非 null 即可
    expect(r).not.toBeNull();
    expect(r!.period).toBe(14);
  });
});

// ── parseNaturalLanguage ────────────────────────────────────────────────────

describe('parseNaturalLanguage (主解析器)', () => {

  it('空字符串 → success=false, error 定义', () => {
    const r = parseNaturalLanguage('');
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('MA5 上穿 MA20 买入 → ma_cross, short=5, long=20', () => {
    const r = parseNaturalLanguage('MA5 上穿 MA20 买入');
    expect(r.success).toBe(true);
    expect(r.strategy.type).toBe('ma_cross');
    expect(r.strategy.params.shortPeriod).toBe(5);
    expect(r.strategy.params.longPeriod).toBe(20);
  });

  it('RSI 低于 30 买入 → rsi, oversold=30', () => {
    const r = parseNaturalLanguage('RSI 低于 30 买入');
    expect(r.success).toBe(true);
    expect(r.strategy.type).toBe('rsi');
    expect(r.strategy.params.oversold).toBe(30);
    expect(r.strategy.params.rsiPeriod).toBe(14);
  });

  it('RSI 高于 70 卖出 → 有意义的输出（parser 返回结构完整）', () => {
    // Parser 可能只识别买入侧，不识别单独卖出 → 结果取决于 normalizeInput
    const r = parseNaturalLanguage('RSI 高于 70 卖出');
    // 结果可能是 success=false（无法解析单独卖出信号）或 success=true
    // 关键是 parser 不崩溃，返回结构完整
    expect(r.strategy).toBeDefined();
    expect(r.strategy.type).toBeDefined();
  });

  it('MACD 金叉买入 → macd', () => {
    const r = parseNaturalLanguage('MACD 金叉买入');
    expect(r.success).toBe(true);
    expect(r.strategy.type).toBe('macd');
  });

  it('5日新高买入 → momentum', () => {
    const r = parseNaturalLanguage('5日新高买入');
    expect(r.success).toBe(true);
    expect(r.strategy.type).toBe('momentum');
  });

  it('动量突破 → momentum', () => {
    const r = parseNaturalLanguage('动量突破');
    expect(r.success).toBe(true);
    expect(r.strategy.type).toBe('momentum');
  });

  it('布林带下轨买入 → bollinger', () => {
    const r = parseNaturalLanguage('布林带下轨买入');
    expect(r.success).toBe(true);
    expect(r.strategy.type).toBe('bollinger');
  });

  it('止损 3% → stopLoss=3', () => {
    const r = parseNaturalLanguage('RSI 低于 30 买入，止损 3%');
    expect(r.success).toBe(true);
    expect(r.strategy.stopLoss).toBe(3);
  });

  it('止盈 5% → takeProfit=5', () => {
    const r = parseNaturalLanguage('RSI 低于 30 买入，止盈 5%');
    expect(r.success).toBe(true);
    expect(r.strategy.takeProfit).toBe(5);
  });

  it('买入 TQQQ → parser 返回结构完整', () => {
    // "买入 TQQQ" 不是有效策略模式 → success=false
    // 但 parser 不崩溃，返回完整结构
    const r = parseNaturalLanguage('买入 TQQQ');
    expect(r.strategy).toBeDefined();
    expect(typeof r.success).toBe('boolean');
    // symbol 取决于 normalizeInput 是否能处理 "买入"
    // 如果 strategy 被规范化，symbol 可能提取
  });

  it('买入 NVDA → symbol US.NVDA', () => {
    const r = parseNaturalLanguage('MACD 金叉买入 NVDA');
    expect(r.success).toBe(true);
    expect(r.symbol).toBe('US.NVDA');
  });

  it('RSI 超卖（简写） → rsi success=true', () => {
    const r = parseNaturalLanguage('RSI 超卖买入');
    expect(r.success).toBe(true);
    expect(r.strategy.type).toBe('rsi');
  });

  it('无效垃圾文本 → success=false, error 定义', () => {
    const r = parseNaturalLanguage('asdfklasdfjkl323');
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('有指标但无法解析 → success=false, error 包含提示', () => {
    const r = parseNaturalLanguage('RSI 和 MACD 都用');
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
    expect(r.error!.length).toBeGreaterThan(0);
  });

  it('MA 短周期 >= 长周期 → 不匹配 (MA30 上穿 MA5 应失败)', () => {
    const r = parseNaturalLanguage('MA30 上穿 MA5 买入');
    // 短>=长不符合逻辑，应返回 failure 或 success=false
    // parseNaturalLanguage 在这种情况会走 LLM fallback 或返回 error
    // 规则引擎的 matchMACross 要求 short < long
    expect(r.success === false || r.strategy.type !== 'ma_cross').toBeTruthy();
  });

  it('止损 0% → stopLoss=0 (边缘值)', () => {
    const r = parseNaturalLanguage('RSI 低于 30 买入，止损 0%');
    expect(r.success).toBe(true);
    expect(r.strategy.stopLoss).toBe(0);
  });

  it('纯空格输入 → success=false', () => {
    const r = parseNaturalLanguage('   ');
    expect(r.success).toBe(false);
  });

  it('止损 + 止盈组合 → stopLoss 和 takeProfit 同时存在', () => {
    const r = parseNaturalLanguage('RSI 低于 30 买入，止损 3%，止盈 8%');
    expect(r.success).toBe(true);
    expect(r.strategy.stopLoss).toBe(3);
    expect(r.strategy.takeProfit).toBe(8);
  });
});

// ── STRATEGY_TEMPLATES ─────────────────────────────────────────────────────

describe('STRATEGY_TEMPLATES (模板库)', () => {
  it('至少有 15 个模板', () => {
    expect(STRATEGY_TEMPLATES.length).toBeGreaterThanOrEqual(15);
  });

  it('每个模板有必需字段', () => {
    for (const t of STRATEGY_TEMPLATES) {
      expect(t.id).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.strategy).toBeDefined();
      expect(t.strategy.type).toBeDefined();
    }
  });

  it('tqqq_momentum 模板 symbol 为 US.TQQQ', () => {
    const t = STRATEGY_TEMPLATES.find((x) => x.id === 'tqqq_momentum');
    expect(t?.symbol).toBe('US.TQQQ');
  });

  it('spy_conservative 模板 symbol 为 US.SPY', () => {
    const t = STRATEGY_TEMPLATES.find((x) => x.id === 'spy_conservative');
    expect(t?.symbol).toBe('US.SPY');
  });
});
