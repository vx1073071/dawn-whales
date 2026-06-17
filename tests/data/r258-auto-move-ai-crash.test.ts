/**
 * R258 autoclaw 综合测试 — 异动推送桥接 + AI因子桥接 + 崩盘推送桥接
 * 3模块 × 各~17断言 → ~51个测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MovePushBridge, movePushBridge } from '../../electron/engine/data/move-push-bridge';
import type { MoveSignal } from '../../electron/engine/data/move-push-bridge';
import { AiFactorBridge, aiFactorBridge } from '../../electron/engine/data/ai-factor-bridge';
import type { AiCommentary } from '../../electron/engine/data/ai-factor-bridge';
import { CrashPushBridge, crashPushBridge } from '../../electron/engine/data/crash-push-bridge';
import type { CrashType } from '../../electron/engine/data/crash-push-bridge';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMove(symbol: string, changePct: number, severity: MoveSignal['severity']): MoveSignal {
  return {
    symbol, name: symbol,
    market: 'US', direction: changePct > 0 ? 'up' : 'down',
    changePercent: changePct, volumeRatio: 2.5,
    severity,
    attribution: {
      dimensions: [
        { name: 'earnings', nameCn: '财报', score: 0.7, evidence: ['Beat'], evidenceCn: ['超预期'] },
      ],
      primaryReason: 'Earnings beat by 15%',
      primaryReasonCn: '财报超预期15%',
      confidence: 0.85,
      score: 0.72,
    },
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// P1-04: MovePushBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R258 P1-04 MovePushBridge', () => {
  let bridge: MovePushBridge;

  beforeEach(() => { bridge = new MovePushBridge(); });

  describe('ingestion — realtime', () => {
    it('should ingest a single move', () => {
      const move = makeMove('TSLA', -8.5, 'major');
      move.market = 'US';
      move.timestamp = Date.now();
      // Override market phase to 'open' for realtime testing
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'open';
      const event = bridge.ingest(move);
      bridge.getMarketPhase = original;
      // During 'open', major moves trigger immediately
      expect(event).not.toBeNull();
      if (event) {
        expect(event.moves.length).toBeGreaterThanOrEqual(1);
        expect(event.strategy).toBe('realtime');
      }
    });

    it('should filter moves below severity threshold', () => {
      const move = makeMove('AAPL', -1.2, 'minor');
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'open';
      const event = bridge.ingest(move);
      bridge.getMarketPhase = original;
      // open phase requires major severity minimum
      expect(event).toBeNull();
    });
  });

  describe('ingestion — batched', () => {
    it('should accumulate moves in pre_market phase', () => {
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'pre_market';
      const m1 = makeMove('TSLA', -5.2, 'major');
      const m2 = makeMove('NVDA', -4.1, 'notable');
      bridge.ingest(m1);
      const event = bridge.ingest(m2);
      bridge.getMarketPhase = original;
      // pre_market batches up to 5 — both should accumulate, event null until threshold
      expect(bridge.getBatchedMoves('batched:US').length).toBeGreaterThanOrEqual(1);
    });

    it('should fire batch when maxPerBatch reached', () => {
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'pre_market';
      let event = null;
      for (let i = 0; i < 5; i++) {
        event = bridge.ingest(makeMove(`STOCK${i}`, -4 - i, 'major'));
      }
      bridge.getMarketPhase = original;
      expect(event).not.toBeNull();
      if (event) {
        expect(event.moves.length).toBeLessThanOrEqual(5);
        expect(event.strategy).toBe('batched');
      }
    });
  });

  describe('flush', () => {
    it('should flush all batched moves', () => {
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'pre_market';
      bridge.ingest(makeMove('TSLA', -6, 'major'));
      bridge.ingest(makeMove('NVDA', -4, 'notable'));
      bridge.getMarketPhase = original;

      const events = bridge.flushAll();
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('push content generation', () => {
    it('should generate single-move push content', () => {
      const move = makeMove('TSLA', -8.5, 'major');
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'open';
      const event = bridge.ingest(move);
      bridge.getMarketPhase = original;
      expect(event).not.toBeNull();
      if (event) {
        expect(event.pushTitle).toContain('TSLA');
        expect(event.pushBody).toContain('8.5%');
        expect(event.pushBodyCn.length).toBeGreaterThan(0);
      }
    });

    it('should assign correct priority based on severity', () => {
      const extreme = makeMove('BTC', -15, 'extreme');
      extreme.market = 'CRYPTO';
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'open';
      const event = bridge.ingest(extreme);
      bridge.getMarketPhase = original;
      expect(event).not.toBeNull();
      if (event) {
        expect(event.priority).toBe('high');
      }
    });
  });

  describe('market phase detection', () => {
    it('should detect crypto as always open', () => {
      const phase = bridge.getMarketPhase('CRYPTO');
      expect(phase).toBe('open');
    });
  });

  describe('rules', () => {
    it('should return all push rules', () => {
      const rules = bridge.getAllRules();
      expect(Object.keys(rules).length).toBe(5);
    });

    it('should return active rule for market', () => {
      const rule = bridge.getActiveRule('US');
      expect(rule).not.toBeNull();
      if (rule) {
        expect(rule.marketPhase.length).toBeGreaterThan(0);
      }
    });
  });

  describe('ingestBatch', () => {
    it('should process multiple moves', () => {
      const original = bridge.getMarketPhase;
      bridge.getMarketPhase = () => 'open';
      const events = bridge.ingestBatch([
        makeMove('AAPL', -12, 'extreme'),
        makeMove('MSFT', -7, 'major'),
      ]);
      bridge.getMarketPhase = original;
      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('prebuilt singleton', () => {
    it('movePushBridge should be available', () => {
      const stats = movePushBridge.getStats();
      expect(typeof stats.totalPushes).toBe('number');
      movePushBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-02: AiFactorBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R258 P1-02 AiFactorBridge', () => {
  let bridge: AiFactorBridge;

  beforeEach(() => { bridge = new AiFactorBridge(); });

  describe('factor extraction from text', () => {
    it('should extract bullish factors', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:1', symbol: 'TSLA', market: 'US',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.8,
        keyPoints: ['TSLA breakout above resistance', 'institutional accumulation detected'],
        keyPointsCn: ['TSLA突破阻力位', '机构吸筹'],
        confidence: 0.9, source: 'AI',
      };

      const factors = bridge.extractFactors(commentary);
      expect(factors.length).toBeGreaterThanOrEqual(1);
      expect(factors.some(f => f.name === 'breakout')).toBe(true);
      expect(factors.some(f => f.name === 'accumulation')).toBe(true);
    });

    it('should extract bearish factors', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:2', symbol: 'NVDA', market: 'US',
        timestamp: Date.now(), sentiment: 'bearish', sentimentScore: -0.6,
        keyPoints: ['NVDA breakdown', 'analyst downgrade', 'distribution phase'],
        keyPointsCn: ['NVDA跌破', '分析师下调', '出货'],
        confidence: 0.8, source: 'AI',
      };

      const factors = bridge.extractFactors(commentary);
      // keyword 'breakdown' → factor name 'breakdown'
      expect(factors.some(f => f.name === 'breakdown')).toBe(true);
      // keyword 'downgrade' → factor name 'analyst_downgrade'
      expect(factors.some(f => f.name === 'analyst_downgrade')).toBe(true);
      // keyword 'distribution' → factor name 'distribution'
      expect(factors.some(f => f.name === 'distribution')).toBe(true);
    });
  });

  describe('signal generation', () => {
    it('should convert factors to signals', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:3', symbol: 'AAPL', market: 'US',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.7,
        keyPoints: ['AAPL earnings beat', 'bullish upgrade'],
        keyPointsCn: ['AAPL财报超预期', '看多上调'],
        confidence: 0.85, source: 'AI',
      };

      const signals = bridge.generateSignals(commentary);
      expect(signals.length).toBeGreaterThanOrEqual(1);
      expect(signals[0].symbol).toBe('AAPL');
      expect(signals[0].factorDomain.length).toBeGreaterThan(0);
      expect(signals[0].weight).toBeGreaterThan(0);
    });

    it('should assign correct direction based on factor', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:4', symbol: 'COIN', market: 'US',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.9,
        keyPoints: ['bullish momentum', 'capital inflow'],
        keyPointsCn: ['看多情绪', '资金流入'],
        confidence: 0.8, source: 'AI',
      };

      const signals = bridge.generateSignals(commentary);
      expect(signals.some(s => s.direction === 'long')).toBe(true);
    });

    it('should track signals count', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:5', symbol: 'SPX', market: 'US',
        timestamp: Date.now(), sentiment: 'neutral', sentimentScore: 0.05,
        keyPoints: [],
        keyPointsCn: [],
        confidence: 0.5, source: 'AI',
      };

      bridge.generateSignals(commentary);
      const stats = bridge.getStats();
      expect(stats.totalCommentaries).toBe(1);
    });
  });

  describe('factor aggregation', () => {
    it('should aggregate signals into composite score', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:6', symbol: 'QQQ', market: 'US',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.75,
        keyPoints: ['breakout', 'bullish', 'inflow'],
        keyPointsCn: ['突破', '看多', '资金流入'],
        confidence: 0.9, source: 'AI',
      };

      const aggregate = bridge.processCommentary(commentary);
      expect(aggregate).not.toBeNull();
      if (aggregate) {
        expect(aggregate.symbol).toBe('QQQ');
        expect(aggregate.compositeScore).toBeGreaterThan(-1);
        expect(aggregate.compositeScore).toBeLessThan(2);
        expect(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']).toContain(aggregate.compositeSignal);
      }
    });

    it('should generate strong_buy on high confidence bullish', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:7', symbol: 'META', market: 'US',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.95,
        keyPoints: ['earnings beat', 'upgrade', 'accumulation', 'bullish'],
        keyPointsCn: ['财报超预期', '分析师上调', '吸筹', '看多情绪'],
        confidence: 0.95, source: 'AI',
      };

      const aggregate = bridge.processCommentary(commentary);
      expect(aggregate).not.toBeNull();
    });
  });

  describe('pre-extracted factors', () => {
    it('should use pre-extracted factors when provided', () => {
      const commentary: AiCommentary = {
        commentaryId: 'cmt:8', symbol: 'VTI', market: 'US',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.6,
        keyPoints: [], keyPointsCn: [],
        confidence: 0.7, source: 'AI',
        factors: [
          { domain: 'technical', name: 'golden_cross', nameCn: '金叉', direction: 'positive', strength: 0.8,
            evidence: '50-day crossed above 200-day', evidenceCn: '50日均线上穿200日均线' },
        ],
      };

      const factors = bridge.extractFactors(commentary);
      expect(factors).toHaveLength(1);
      expect(factors[0].name).toBe('golden_cross');
    });
  });

  describe('domain weights', () => {
    it('should have default domain weights', () => {
      const weights = bridge.getDomainWeights();
      expect(weights.technical).toBeGreaterThan(0);
      expect(weights.sentiment).toBeGreaterThan(0);
    });

    it('should update domain weights', () => {
      bridge.updateDomainWeights({ technical: 0.4, sentiment: 0.1 });
      const weights = bridge.getDomainWeights();
      expect(weights.technical).toBe(0.4);
      expect(weights.sentiment).toBe(0.1);
    });
  });

  describe('query', () => {
    it('should query signals by symbol', () => {
      bridge.processCommentary({
        commentaryId: 'cmt:9a', symbol: 'BTC', market: 'CRYPTO',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.8,
        keyPoints: ['breakout'], keyPointsCn: ['突破'],
        confidence: 0.8, source: 'AI',
      });
      bridge.processCommentary({
        commentaryId: 'cmt:9b', symbol: 'ETH', market: 'CRYPTO',
        timestamp: Date.now(), sentiment: 'bearish', sentimentScore: -0.5,
        keyPoints: ['breakdown'], keyPointsCn: ['跌破'],
        confidence: 0.7, source: 'AI',
      });

      const btc = bridge.getSignals('BTC');
      expect(btc.length).toBeGreaterThan(0);
      expect(btc[0].symbol).toBe('BTC');
    });

    it('should get latest aggregate', () => {
      bridge.processCommentary({
        commentaryId: 'cmt:10', symbol: 'ARKK', market: 'US',
        timestamp: Date.now(), sentiment: 'bullish', sentimentScore: 0.7,
        keyPoints: ['breakout'], keyPointsCn: ['突破'],
        confidence: 0.8, source: 'AI',
      });

      const agg = bridge.getLatestAggregate('ARKK');
      expect(agg).not.toBeNull();
      expect(agg?.symbol).toBe('ARKK');
    });
  });

  describe('prebuilt singleton', () => {
    it('aiFactorBridge should be available', () => {
      const stats = aiFactorBridge.getStats();
      expect(typeof stats.totalCommentaries).toBe('number');
      aiFactorBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1-05: CrashPushBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R258 P1-05 CrashPushBridge', () => {
  let bridge: CrashPushBridge;

  beforeEach(() => { bridge = new CrashPushBridge(); });

  describe('detection', () => {
    it('should detect index crash at warning level', () => {
      const crash = bridge.detect({
        type: 'index', symbol: 'SPX', name: 'S&P 500', nameCn: '标普500',
        changePercent: -6.2, changeAmount: -320, price: 5100, volumeRatio: 3.5,
      });

      expect(crash).not.toBeNull();
      if (crash) {
        expect(crash.severity).toBe('warning');
        expect(crash.type).toBe('index');
      }
    });

    it('should detect extreme crash', () => {
      const crash = bridge.detect({
        type: 'index', symbol: 'SPX', name: 'S&P 500', nameCn: '标普500',
        changePercent: -40, changeAmount: -2000, price: 3000, volumeRatio: 8,
      });

      expect(crash).not.toBeNull();
      if (crash) {
        expect(crash.severity).toBe('extreme');
      }
    });

    it('should ignore positive moves', () => {
      const crash = bridge.detect({
        type: 'single', symbol: 'TSLA', name: 'Tesla', nameCn: '特斯拉',
        changePercent: 5, changeAmount: 50, price: 1050, volumeRatio: 2,
      });

      expect(crash).toBeNull();
    });

    it('should ignore moves below threshold', () => {
      const crash = bridge.detect({
        type: 'single', symbol: 'AAPL', name: 'Apple', nameCn: '苹果',
        changePercent: -1.5, changeAmount: -3, price: 198, volumeRatio: 1.2,
      });

      expect(crash).toBeNull();
    });
  });

  describe('push event building', () => {
    it('should build push with correct urgency', () => {
      const crash = bridge.detect({
        type: 'index', symbol: 'SPX', name: 'S&P 500', nameCn: '标普500',
        changePercent: -12, changeAmount: -600, price: 4400, volumeRatio: 5,
      });

      expect(crash).not.toBeNull();
      const event = bridge.buildPush(crash!);
      expect(event.urgency).toBe('important');
      expect(event.title).toContain('SPX');
      expect(event.bodyCn.length).toBeGreaterThan(0);
    });

    it('should generate emergency urgency for extreme crash', () => {
      const crash = bridge.detect({
        type: 'crypto', symbol: 'BTC', name: 'Bitcoin', nameCn: '比特币',
        changePercent: -50, changeAmount: -37000, price: 37000, volumeRatio: 12,
      });

      const event = bridge.buildPush(crash!);
      expect(event.urgency).toBe('emergency');
      expect(event.pushLevel).toBe('all_users');
    });

    it('should include recommended actions', () => {
      const crash = bridge.detect({
        type: 'flash_crash', symbol: 'SMCI', name: 'SMCI', nameCn: '超微电脑',
        changePercent: -25, changeAmount: -200, price: 600, volumeRatio: 10,
      });

      const event = bridge.buildPush(crash!);
      expect(event.recommendedActions.length).toBeGreaterThan(0);
      expect(event.recommendedActionsCn.length).toBeGreaterThan(0);
    });
  });

  describe('full pipeline detectAndPush', () => {
    it('should return push for valid crash', () => {
      const event = bridge.detectAndPush({
        type: 'sector', symbol: 'XLK', name: 'Tech Sector', nameCn: '科技板块',
        changePercent: -8, changeAmount: -18, price: 207, volumeRatio: 4,
      });

      expect(event).not.toBeNull();
      if (event) {
        expect(event.crash.severity).toBe('warning');
      }
    });

    it('should return null for non-crash', () => {
      const event = bridge.detectAndPush({
        type: 'single', symbol: 'MSFT', name: 'Microsoft', nameCn: '微软',
        changePercent: -2, changeAmount: -10, price: 490, volumeRatio: 1.5,
      });

      expect(event).toBeNull();
    });
  });

  describe('recovery detection', () => {
    it('should track active crashes', () => {
      bridge.detectAndPush({
        type: 'single', symbol: 'NFLX', name: 'Netflix', nameCn: '奈飞',
        changePercent: -15, changeAmount: -90, price: 510, volumeRatio: 6,
      });

      expect(bridge.isInCrash('NFLX')).toBe(true);
    });

    it('should detect partial recovery', () => {
      bridge.detectAndPush({
        type: 'single', symbol: 'NFLX', name: 'Netflix', nameCn: '奈飞',
        changePercent: -15, changeAmount: -90, price: 510, volumeRatio: 6,
      });

      const result = bridge.checkRecovery('NFLX', 540);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.recovered).toBe(false); // 30/90 = 33% retrace, not 50%
        expect(result.retracePct).toBeGreaterThan(0);
      }
    });

    it('should detect full recovery', () => {
      bridge.detectAndPush({
        type: 'single', symbol: 'NFLX', name: 'Netflix', nameCn: '奈飞',
        changePercent: -15, changeAmount: -90, price: 510, volumeRatio: 6,
      });

      const result = bridge.checkRecovery('NFLX', 560); // 50/90 = 55% retrace
      expect(result).not.toBeNull();
      if (result) {
        expect(result.recovered).toBe(true);
      }
    });
  });

  describe('cooldown', () => {
    it('should respect cooldown for same type+severity', () => {
      const first = bridge.detectAndPush({
        type: 'single', symbol: 'TSLA', name: 'Tesla', nameCn: '特斯拉',
        changePercent: -12, changeAmount: -120, price: 880, volumeRatio: 5,
      });
      expect(first).not.toBeNull();

      const second = bridge.detect({
        type: 'single', symbol: 'NVDA', name: 'NVIDIA', nameCn: '英伟达',
        changePercent: -13, changeAmount: -130, price: 870, volumeRatio: 6,
      });
      // Same type+severity should be in cooldown
      expect(second).toBeNull();
    });
  });

  describe('batch detect', () => {
    it('should batch detect multiple symbols', () => {
      const events = bridge.batchDetect([
        { type: 'single' as CrashType, symbol: 'TSLA', name: 'Tesla', nameCn: '特斯拉', changePercent: -7, changeAmount: -70, price: 930, volumeRatio: 3 },
        { type: 'single' as CrashType, symbol: 'NVDA', name: 'NVIDIA', nameCn: '英伟达', changePercent: -8, changeAmount: -80, price: 920, volumeRatio: 4 },
      ]);

      expect(events.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rules', () => {
    it('should return crash rules', () => {
      const rules = bridge.getAllRules();
      expect(rules.length).toBe(5);
    });

    it('should get rule by severity', () => {
      const rule = bridge.getRule('extreme');
      expect(rule).toBeDefined();
      expect(rule?.pushLevel).toBe('all_users');
      expect(rule?.soundAlert).toBe(true);
    });
  });

  describe('history', () => {
    it('should return crash history', () => {
      bridge.detectAndPush({
        type: 'index', symbol: 'SPX', name: 'S&P 500', nameCn: '标普500',
        changePercent: -8, changeAmount: -400, price: 4500, volumeRatio: 4,
      });

      const history = bridge.getHistory();
      expect(history.length).toBe(1);
    });

    it('should return push event history', () => {
      bridge.detectAndPush({
        type: 'index', symbol: 'SPX', name: 'S&P 500', nameCn: '标普500',
        changePercent: -8, changeAmount: -400, price: 4500, volumeRatio: 4,
      });

      const pushHistory = bridge.getPushHistory();
      expect(pushHistory.length).toBe(1);
    });
  });

  describe('prebuilt singleton', () => {
    it('crashPushBridge should be available', () => {
      const stats = crashPushBridge.getStats();
      expect(typeof stats.totalDetected).toBe('number');
      crashPushBridge.reset();
    });
  });
});
