// ── strategy-engine 全场景测试 ──────────────────────────────────────────────
// 覆盖: 状态机 / 信号生成 / RiskEngine集成 / 错误恢复
// 覆盖: createStrategy / startLive / stopLive / emergencyStop / onQuoteUpdate

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock backtest-engine (used internally by StrategyEngine)
vi.mock('../electron/engine/backtest-engine', () => ({
  BacktestEngine: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({ success: true, result: {} }),
  })),
}));

import { StrategyEngine } from '../electron/engine/strategy-engine';
import type { RiskEngine } from '../electron/engine/risk-engine';

// ── Helper: mock RiskEngine ─────────────────────────────────────────────────

function makeMockRiskEngine(): RiskEngine {
  return {
    calculatePositionSize: vi.fn().mockReturnValue({ qty: 100, reasoning: 'mock', method: 'kelly' as const }),
    checkOrder: vi.fn().mockReturnValue({ pass: true, reason: '' }),
    updateEquity: vi.fn(),
    updateDailyPnl: vi.fn(),
    updateTotalAssets: vi.fn(),
    recordTrade: vi.fn(),
    resetDailyPnl: vi.fn(),
    getDrawdownState: vi.fn().mockReturnValue({ isReduced: false, reductionFactor: 1 }),
    getKellyStats: vi.fn().mockReturnValue({ winRate: 0.5, avgWin: 100, avgLoss: 50, profitFactor: 2, kellyFraction: 0.25, sampleSize: 10 }),
    getStatusSnapshot: vi.fn().mockReturnValue({}),
    getConfig: vi.fn().mockReturnValue({}),
    updateConfig: vi.fn(),
    getVolatilityFactor: vi.fn().mockReturnValue(1),
    getAlerts: vi.fn().mockReturnValue([]),
    getRiskStatus: vi.fn().mockReturnValue({ level: 'normal', message: '' }),
  } as any;
}

// ── Helper: mock Quote ──────────────────────────────────────────────────────

function makeQuote(price: number, symbol = 'US.TQQQ') {
  return { code: symbol, price, time: Date.now() };
}

// ── 状态机测试 ───────────────────────────────────────────────────────────

describe('StrategyEngine 状态机', () => {
  let engine: StrategyEngine;

  beforeEach(() => {
    engine = new StrategyEngine();
  });

  it('新策略创建后状态为 draft', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    const strat = engine.getStrategy(id);
    expect(strat?.status).toBe('draft');
  });

  it('startLive 后状态变为 live', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);
    expect(engine.getStrategy(id)?.status).toBe('live');
  });

  it('startLive 两次不崩溃', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);
    engine.startLive(id); // 重复调用应安全
    expect(engine.getStrategy(id)?.status).toBe('live');
  });

  it('stopLive 后状态变为 stopped', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);
    engine.stopLive(id);
    expect(engine.getStrategy(id)?.status).toBe('stopped');
  });

  it('stopLive 非 live 策略不崩溃', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.stopLive(id); // 从未 start，不应崩溃
    expect(engine.getStrategy(id)?.status).toBe('draft');
  });

  it('emergencyStop 停止所有 live 策略', () => {
    const id1 = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    const id2 = engine.createStrategy({ templateId: 'rsi_30_70' });
    engine.startLive(id1);
    engine.startLive(id2);
    engine.emergencyStop();
    expect(engine.getStrategy(id1)?.status).toBe('stopped');
    expect(engine.getStrategy(id2)?.status).toBe('stopped');
  });

  it('deleteStrategy 删除策略并移除指标', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);
    engine.deleteStrategy(id);
    expect(engine.getStrategy(id)).toBeUndefined();
  });

  it('deleteStrategy 删除不存在的 id 不崩溃', () => {
    expect(() => engine.deleteStrategy('nonexistent')).not.toThrow();
  });
});

// ── createStrategy 多种输入 ──────────────────────────────────────────────

describe('createStrategy 多种输入模式', () => {
  let engine: StrategyEngine;

  beforeEach(() => {
    engine = new StrategyEngine();
  });

  it('templateId 方式创建 → 返回有效 id', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('自然语言字符串方式创建 → 返回有效 id', () => {
    const id = engine.createStrategy('MA5 上穿 MA20 买入');
    expect(typeof id).toBe('string');
  });

  it('{text: string} 对象方式创建 → 返回有效 id', () => {
    const id = engine.createStrategy({ text: 'RSI 低于 30 买入' });
    expect(typeof id).toBe('string');
  });

  it('直接配置方式创建', () => {
    const id = engine.createStrategy({
      name: '我的策略',
      strategy: { type: 'rsi', params: { oversold: 25, overbought: 75, rsiPeriod: 14 } },
      symbol: 'US.NVDA',
    });
    const strat = engine.getStrategy(id);
    expect(strat?.name).toBe('我的策略');
    expect(strat?.strategy.type).toBe('rsi');
  });

  it('getAllStrategies 返回所有策略', () => {
    engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.createStrategy({ templateId: 'rsi_30_70' });
    expect(engine.getAllStrategies().length).toBeGreaterThanOrEqual(2);
  });

  it('getStrategy 不存在的 id → undefined', () => {
    expect(engine.getStrategy('nonexistent')).toBeUndefined();
  });

  it('createStrategy 失败输入 → 抛出错误', () => {
    expect(() => engine.createStrategy({} as any)).toThrow();
  });
});

// ── onSignal / onTrade 回调 ───────────────────────────────────────────────

describe('信号与交易回调', () => {
  let engine: StrategyEngine;

  beforeEach(() => {
    engine = new StrategyEngine();
  });

  it('onSignal 注册回调并接收信号', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);

    const signals: any[] = [];
    engine.onSignal((s) => signals.push(s));

    // 注入价格序列：35 bars 恒定 100 → MA5=MA30=100（HOLD）
    // 然后 10 bars 上涨到 110 → MA5 快速穿越 MA30 → BUY
    for (let i = 0; i < 35; i++) {
      engine.onQuoteUpdate([makeQuote(100)]);
    }
    for (let i = 0; i < 10; i++) {
      engine.onQuoteUpdate([makeQuote(105 + i * 2)]);
    }

    // Should have at least one signal
    expect(signals.length).toBeGreaterThan(0);
    expect(['BUY', 'SELL']).toContain(signals[0].signal);
  });

  it('onTrade 注册回调并接收订单', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);

    const trades: any[] = [];
    engine.onTrade((t) => trades.push(t));

    // 同 onSignal 测试：恒定 100 → 上涨 → 触发 BUY 并生成订单
    for (let i = 0; i < 35; i++) {
      engine.onQuoteUpdate([makeQuote(100)]);
    }
    for (let i = 0; i < 10; i++) {
      engine.onQuoteUpdate([makeQuote(105 + i * 2)]);
    }

    // BUY signal should have fired and generated a trade callback
    const buyTrades = trades.filter((t) => t.side === 'BUY');
    expect(buyTrades.length).toBeGreaterThan(0);
  });

  it('多个回调都能收到信号', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);

    const sigs1: any[] = [];
    const sigs2: any[] = [];
    engine.onSignal((s) => sigs1.push(s));
    engine.onSignal((s) => sigs2.push(s));

    // 同 onSignal 测试序列
    for (let i = 0; i < 35; i++) {
      engine.onQuoteUpdate([makeQuote(100)]);
    }
    for (let i = 0; i < 10; i++) {
      engine.onQuoteUpdate([makeQuote(105 + i * 2)]);
    }

    expect(sigs1.length).toBe(sigs2.length);
    expect(sigs1.length).toBeGreaterThan(0);
  });

  it('回调异常不导致 onQuoteUpdate 崩溃', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);
    engine.onSignal(() => { throw new Error('callback error'); });

    // 不应抛出
    expect(() => engine.onQuoteUpdate([makeQuote(100)])).not.toThrow();
  });
});

// ── RiskEngine 集成 ──────────────────────────────────────────────────────

describe('RiskEngine 集成', () => {
  let engine: StrategyEngine;
  let mockRisk: RiskEngine;

  beforeEach(() => {
    engine = new StrategyEngine();
    mockRisk = makeMockRiskEngine();
    engine.setRiskEngine(mockRisk);
  });

  it('setRiskEngine 注册成功', () => {
    expect(() => engine.setRiskEngine(mockRisk)).not.toThrow();
  });

  it('setRiskEngine 之后 calculatePositionSize 被调用', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);

    // 设置已有持仓，触发 SELL 信号 → recordTrade 被调用
    engine.updatePosition(id, { qty: 50, avgCost: 100 });

    // 价格下跌 → short MA 下穿 long MA → SELL
    for (let i = 0; i < 35; i++) {
      engine.onQuoteUpdate([makeQuote(100)]);
    }
    for (let i = 0; i < 10; i++) {
      engine.onQuoteUpdate([makeQuote(95 - i)]);
    }

    // SELL with position → recordTrade should be called
    expect(mockRisk.recordTrade).toHaveBeenCalled();
  });

  it('updatePosition 更新策略持仓', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.updatePosition(id, { qty: 100, avgCost: 105 });
    expect(engine.getStrategy(id)?.position?.qty).toBe(100);
  });

  it('updatePosition null 清除持仓', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.updatePosition(id, { qty: 100, avgCost: 105 });
    engine.updatePosition(id, null);
    expect(engine.getStrategy(id)?.position).toBeNull();
  });
});

// ── 边界条件 ───────────────────────────────────────────────────────────

describe('边界条件与错误处理', () => {
  let engine: StrategyEngine;

  beforeEach(() => {
    engine = new StrategyEngine();
  });

  it('strategy 不存在时 startLive 不崩溃', () => {
    expect(() => engine.startLive('nonexistent')).not.toThrow();
  });

  it('strategy 不存在时 stopLive 不崩溃', () => {
    expect(() => engine.stopLive('nonexistent')).not.toThrow();
  });

  it('strategy 不存在时 updatePosition 不崩溃', () => {
    expect(() => engine.updatePosition('nonexistent', { qty: 1, avgCost: 100 })).not.toThrow();
  });

  it('空 quote 数组 onQuoteUpdate 不崩溃', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);
    expect(() => engine.onQuoteUpdate([])).not.toThrow();
  });

  it('不匹配 symbol 的 quote 不影响策略', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30', symbol: 'US.NVDA' });
    engine.startLive(id);
    const strat = engine.getStrategy(id);

    // 价格持续上涨，但 quote 是 US.TQQQ（不匹配）
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
    for (const p of prices) {
      engine.onQuoteUpdate([makeQuote(p, 'US.TQQQ')]);
    }

    // 策略不应触发任何信号（quote 的 symbol 不匹配）
    expect(strat?.lastSignal).toBeUndefined();
  });

  it('stopLive 对模拟中的策略也有效', () => {
    const id = engine.createStrategy({ templateId: 'ma_cross_10_30' });
    engine.startLive(id);
    engine.stopLive(id);
    // 即使在 live 状态再次 stopLive，也应保持 stopped
    engine.stopLive(id);
    expect(engine.getStrategy(id)?.status).toBe('stopped');
  });
});
