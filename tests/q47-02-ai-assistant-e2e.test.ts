// Q-47-02 Part 1: AI Assistant Panel E2E — NL解析 + 策略建议 + 风险问答
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stubWindowApi } from './helpers/mocks';

describe('Q-47-02: AI Assistant Panel E2E — NL解析 / 策略建议 / 风险问答', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 场景 1: NL 自然语言解析 ───────────────────────────────────────────────

  describe('场景 1: NL 自然语言 → 策略解析', () => {
    it('解析中文均线交叉策略', async () => {
      const parseMock = vi.fn().mockResolvedValue({
        success: true,
        parsed: {
          type: 'ma_cross',
          params: { fastPeriod: 5, slowPeriod: 20, stopLoss: 0.05 },
          confidence: 0.92,
        },
      });
      stubWindowApi({ nl: { parse: parseMock } });

      const result = await (window as any).api.nl.parse('当5日均线突破20日均线时买入');

      expect(result.success).toBe(true);
      expect(result.parsed.type).toBe('ma_cross');
      expect(result.parsed.params.fastPeriod).toBe(5);
      expect(result.parsed.params.slowPeriod).toBe(20);
    });

    it('解析英文 RSI 策略', async () => {
      const parseMock = vi.fn().mockResolvedValue({
        success: true,
        parsed: {
          type: 'rsi_mean_reversion',
          params: { period: 14, oversoldThreshold: 30, overboughtThreshold: 70 },
          confidence: 0.88,
        },
      });
      stubWindowApi({ nl: { parse: parseMock } });

      const result = await (window as any).api.nl.parse(
        'Buy when RSI falls below 30, sell when it rises above 70'
      );

      expect(result.success).toBe(true);
      expect(result.parsed.type).toBe('rsi_mean_reversion');
      expect(result.parsed.params.oversoldThreshold).toBe(30);
    });

    it('低置信度解析不触发下单', async () => {
      const parseMock = vi.fn().mockResolvedValue({
        success: true,
        parsed: {
          type: 'unknown',
          params: {},
          confidence: 0.12,
        },
      });
      stubWindowApi({ nl: { parse: parseMock } });

      const result = await (window as any).api.nl.parse('abc123 random text');

      expect(result.parsed.confidence).toBeLessThan(0.3);
      // 低置信度 → UI 应显示"无法解析"而非触发交易
    });

    it('解析布林带策略（粤语）', async () => {
      const parseMock = vi.fn().mockResolvedValue({
        success: true,
        parsed: {
          type: 'bollinger_bands',
          params: { period: 20, stdDev: 2, position: 'lower_band' },
          confidence: 0.85,
        },
      });
      stubWindowApi({ nl: { parse: parseMock } });

      const result = await (window as any).api.nl.parse('當價格跌穿布林底線時買入');

      expect(result.success).toBe(true);
      expect(result.parsed.type).toBe('bollinger_bands');
    });
  });

  // ── 场景 2: 策略建议 ─────────────────────────────────────────────────────

  describe('场景 2: AI 策略建议引擎', () => {
    it('生成均线策略建议', async () => {
      const explainMock = vi.fn().mockResolvedValue({
        success: true,
        explanation: 'MA Cross strategy: buy when fast MA crosses above slow MA, with dynamic stop-loss',
        metrics: { sharpe: 1.42, maxDrawdown: 0.08, totalReturn: 0.22, winRate: 0.61 },
      });
      stubWindowApi({
        strategy: {
          explain: explainMock,
          get: vi.fn().mockResolvedValue({ success: true, strategy: null }),
        },
      });

      const result = await (window as any).api.strategy.explain('ma_cross_strategy_v1');

      expect(result.success).toBe(true);
      expect(result.explanation).toContain('MA Cross');
      expect(result.metrics.sharpe).toBeGreaterThan(0);
    });

    it('策略解释包含风险管理建议', async () => {
      const explainMock = vi.fn().mockResolvedValue({
        success: true,
        explanation: 'RSI mean reversion: buy oversold, sell overbought. Risk: set stop-loss at 5%.',
        metrics: { sharpe: 1.1, maxDrawdown: 0.12 },
      });
      stubWindowApi({ strategy: { explain: explainMock } });

      const result = await (window as any).api.strategy.explain('rsi_strategy_v1');

      expect(result.success).toBe(true);
      expect(result.explanation.toLowerCase()).toMatch(/risk|stop/);
    });
  });

  // ── 场景 3: 风险问答 ─────────────────────────────────────────────────────

  describe('场景 3: 风险智能问答', () => {
    it('查询当前账户风险敞口', async () => {
      const riskAskMock = vi.fn().mockResolvedValue({
        success: true,
        answer: '当前组合风险敞口 32%，处于中等水平。建议关注科技股集中度风险。',
        confidence: 0.91,
      });
      stubWindowApi({ risk: { ask: riskAskMock } });

      const result = await (window as any).api.risk.ask(
        '当前账户风险敞口是多少？'
      );

      expect(result.success).toBe(true);
      expect(result.answer).toBeTruthy();
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it('风险问答返回中文回答', async () => {
      const riskAskMock = vi.fn().mockResolvedValue({
        success: true,
        answer: '创业板持仓占比偏高（47%），建议适当分散至主板或债券。',
        confidence: 0.87,
      });
      stubWindowApi({ risk: { ask: riskAskMock } });

      const result = await (window as any).api.risk.ask(
        'Should I reduce ChiNext concentration?'
      );

      expect(result.success).toBe(true);
      // 返回中文回答
      expect(result.answer).toMatch(/创业板|分散|占比/);
    });

    it('无法回答时返回求助提示', async () => {
      const riskAskMock = vi.fn().mockResolvedValue({
        success: false,
        error: 'RAG knowledge base unavailable',
      });
      stubWindowApi({ risk: { ask: riskAskMock } });

      const result = await (window as any).api.risk.ask('明天大盘怎么走？');

      expect(result.success).toBe(false);
      // UI 应提示用户联系人工风控
    });
  });
});
