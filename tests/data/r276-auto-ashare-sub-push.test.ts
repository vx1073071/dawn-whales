/**
 * R276 autoclaw test — AShare Factor Bridge + Factor Subscription Push Bridge
 * 
 * Coverage:
 *   auto#1: AShareFactorBridge (20 tests)
 *     - ingestSnapshot / ingestSnapshots / getSnapshot
 *     - ingestSmartMoney / getSmartMoney / DDX signal detection
 *     - ingestNorthbound / getNorthboundStatus / streak / single-day spike
 *     - ingestDragonGate / getDragonGateHistory / whale signal
 *     - ingestMargin / getMarginStatus / leverage signals
 *     - ingestSectorFlow / getTopSectorFlows / rotation signals
 *     - ingestLimitAnalysis / getLimitAnalysis / sentiment signals
 *     - getSignals / getSignalsForStock / getSignals by category filter
 *     - computeCompositeSentiment / computeStockScore
 *     - onSignal / handler subscription / config update
 *     - reset / stats / getConfig
 * 
 *   auto#2: FactorSubscriptionPushBridge (16 tests)
 *     - subscribe / listSubscriptions / getSubscription
 *     - unsubscribe / toggleSubscription
 *     - free tier limit enforcement
 *     - dispatchSignal / matching / delivery
 *     - minSeverity filtering / threshold filtering
 *     - cooldown enforcement
 *     - global rate limit
 *     - quota tracking / quota warning
 *     - digest mode / flushDigest
 *     - updateChannels / updateThreshold / upgradeTier
 *     - dispatchSignals batch
 *     - getDeliveries / getStats / canSubscribe
 *     - onDelivery / onDigest handler subscriptions
 *     - reset / config update
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AShareFactorBridge, getAShareBridge, resetAShareBridge } from '../../electron/engine/data/ashare-factor-bridge';
import { FactorSubscriptionPushBridge, getFactorSubPushBridge, resetFactorSubPushBridge } from '../../electron/engine/data/factor-subscription-push-bridge';

// ═══════════════════════════════════════════════════════════════════════════
// auto#1: AShareFactorBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R276-auto#1 AShareFactorBridge', () => {
  let bridge: AShareFactorBridge;

  beforeEach(() => {
    resetAShareBridge();
    bridge = getAShareBridge();
  });

  // ── Snapshot ingestion ─────────────────────────────────────────────────────

  describe('snapshot ingestion', () => {
    it('should ingest a single snapshot', () => {
      bridge.ingestSnapshot({
        symbol: '600519',
        name: '贵州茅台',
        exchange: 'SH',
        board: '主板',
        price: 1800,
        changePercent: 2.5,
        volume: 5000000,
        amount: 9000000000,
        turnover: 0.8,
        pe: 35,
        pb: 12,
        marketCap: 22600,
        timestamp: Date.now(),
      });

      const snap = bridge.getSnapshot('600519');
      expect(snap).not.toBeNull();
      expect(snap!.name).toBe('贵州茅台');
      expect(snap!.price).toBe(1800);
      expect(snap!.exchange).toBe('SH');
    });

    it('should batch ingest snapshots', () => {
      bridge.ingestSnapshots([
        { symbol: '000001', name: '平安银行', exchange: 'SZ', board: '主板', price: 12, changePercent: 1.2, volume: 10000000, amount: 120000000, turnover: 1.5, pe: 8, pb: 0.9, marketCap: 2400, timestamp: Date.now() },
        { symbol: '600036', name: '招商银行', exchange: 'SH', board: '主板', price: 38, changePercent: -0.5, volume: 8000000, amount: 304000000, turnover: 0.6, pe: 7, pb: 1.1, marketCap: 9800, timestamp: Date.now() },
      ]);

      expect(bridge.getSnapshot('000001')?.name).toBe('平安银行');
      expect(bridge.getSnapshot('600036')?.name).toBe('招商银行');
      expect(bridge.getStats().totalSnapshots).toBe(2);
    });

    it('should update snapshot on re-ingest', () => {
      bridge.ingestSnapshot({ symbol: '000001', name: '平安银行', exchange: 'SZ', board: '主板', price: 12, changePercent: 1.2, volume: 10000000, amount: 120000000, turnover: 1.5, pe: 8, pb: 0.9, marketCap: 2400, timestamp: Date.now() });
      bridge.ingestSnapshot({ symbol: '000001', name: '平安银行', exchange: 'SZ', board: '主板', price: 12.5, changePercent: 2.0, volume: 12000000, amount: 150000000, turnover: 1.8, pe: 8.2, pb: 0.95, marketCap: 2450, timestamp: Date.now() });

      const snap = bridge.getSnapshot('000001');
      expect(snap!.price).toBe(12.5);
      expect(snap!.changePercent).toBe(2.0);
      expect(bridge.getStats().activeStocks).toBe(1);
    });
  });

  // ── Smart Money (DDX/DDY/DDZ) ─────────────────────────────────────────────

  describe('smart money signals', () => {
    it('should ingest smart money data', () => {
      bridge.ingestSnapshot({ symbol: '600519', name: '贵州茅台', exchange: 'SH', board: '主板', price: 1800, changePercent: 2.5, volume: 5000000, amount: 9000000000, turnover: 5, pe: 35, pb: 12, marketCap: 22600, timestamp: Date.now() });

      bridge.ingestSmartMoney({
        symbol: '600519',
        name: '贵州茅台',
        ddx: 0.8,
        ddy: 0.4,
        ddz: 0.3,
        bigOrderNet: 50000,
        mainForceDirection: 'inflow',
        mainForceStrength: 72,
        timestamp: Date.now(),
      });

      const sm = bridge.getSmartMoney('600519');
      expect(sm).not.toBeNull();
      expect(sm!.ddx).toBeCloseTo(0.8, 2);
      expect(sm!.mainForceDirection).toBe('inflow');
    });

    it('should detect bullish DDX signal', () => {
      bridge.ingestSnapshot({ symbol: '000858', name: '五粮液', exchange: 'SZ', board: '主板', price: 160, changePercent: 3.5, volume: 3000000, amount: 480000000, turnover: 8, pe: 28, pb: 9, marketCap: 6200, timestamp: Date.now() });

      bridge.ingestSmartMoney({
        symbol: '000858', name: '五粮液', ddx: 1.2, ddy: 0.1, ddz: 0.1, bigOrderNet: 80000, mainForceDirection: 'inflow', mainForceStrength: 85, timestamp: Date.now(),
      });

      const signals = bridge.getSignals('smart_money');
      expect(signals.length).toBeGreaterThanOrEqual(1);
      const ddxSig = signals.find(s => s.factorId === 'CN_DDX');
      expect(ddxSig).toBeDefined();
      expect(ddxSig!.direction).toBe('bullish');
      expect(ddxSig!.severity).toBe('critical');
      expect(ddxSig!.confidence).toBeGreaterThan(70);
    });

    it('should detect bearish DDX signal', () => {
      bridge.ingestSnapshot({ symbol: '300750', name: '宁德时代', exchange: 'SZ', board: '创业板', price: 200, changePercent: -4, volume: 8000000, amount: 1600000000, turnover: 12, pe: 25, pb: 6, marketCap: 8800, timestamp: Date.now() });

      bridge.ingestSmartMoney({
        symbol: '300750', name: '宁德时代', ddx: -1.5, ddy: -0.6, ddz: -0.4, bigOrderNet: -120000, mainForceDirection: 'outflow', mainForceStrength: 90, timestamp: Date.now(),
      });

      const signals = bridge.getSignals('smart_money');
      const ddxSig = signals.find(s => s.factorId === 'CN_DDX');
      expect(ddxSig).toBeDefined();
      expect(ddxSig!.direction).toBe('bearish');
    });

    it('should detect DDY order imbalance signal', () => {
      bridge.ingestSnapshot({ symbol: '002415', name: '海康威视', exchange: 'SZ', board: '主板', price: 35, changePercent: 1.0, volume: 5000000, amount: 175000000, turnover: 2, pe: 22, pb: 5, marketCap: 3200, timestamp: Date.now() });

      bridge.ingestSmartMoney({
        symbol: '002415', name: '海康威视', ddx: 0.2, ddy: 0.6, ddz: 0.1, bigOrderNet: 30000, mainForceDirection: 'inflow', mainForceStrength: 60, timestamp: Date.now(),
      });

      const ddySig = bridge.getSignals('smart_money').find(s => s.factorId === 'CN_DDY');
      expect(ddySig).toBeDefined();
      expect(ddySig!.direction).toBe('bullish');
    });

    it('should detect turnover alert', () => {
      bridge.ingestSnapshot({ symbol: '601012', name: '隆基绿能', exchange: 'SH', board: '主板', price: 22, changePercent: 8, volume: 50000000, amount: 1100000000, turnover: 22, pe: 15, pb: 3, marketCap: 1700, timestamp: Date.now() });

      bridge.ingestSmartMoney({
        symbol: '601012', name: '隆基绿能', ddx: 0.05, ddy: 0.01, ddz: 0.01, bigOrderNet: 1000, mainForceDirection: 'neutral', mainForceStrength: 10, timestamp: Date.now(),
      });

      const turnoverSig = bridge.getSignals().find(s => s.factorId === 'CN_TURNOVER');
      expect(turnoverSig).toBeDefined();
      expect(turnoverSig!.severity).toBe('warning');
    });
  });

  // ── Northbound Flow ───────────────────────────────────────────────────────

  describe('northbound flow signals', () => {
    it('should detect northbound streak signal', () => {
      bridge.ingestNorthbound({
        date: '2026-06-18',
        northboundNet: 85,
        shanghaiNet: 45,
        shenzhenNet: 40,
        northboundStrength: 82,
        consecutiveDays: 5,  // 5 days of net inflow
        topFlowStocks: [{ symbol: '600519', name: '贵州茅台', netFlow: 12 }],
        timestamp: Date.now(),
      });

      const signals = bridge.getSignals('northbound');
      const streakSig = signals.find(s => s.factorId === 'CN_NORTHBOUND');
      expect(streakSig).toBeDefined();
      expect(streakSig!.direction).toBe('bullish');
      expect(['warning', 'critical']).toContain(streakSig!.severity);
    });

    it('should detect large single-day northbound flow', () => {
      bridge.ingestNorthbound({
        date: '2026-06-18',
        northboundNet: 150,
        shanghaiNet: 80,
        shenzhenNet: 70,
        northboundStrength: 95,
        consecutiveDays: 1,
        topFlowStocks: [],
        timestamp: Date.now(),
      });

      const spikeSig = bridge.getSignals('northbound').find(s => s.factorId === 'CN_NORTHBOUND_SPIKE');
      expect(spikeSig).toBeDefined();
      expect(spikeSig!.direction).toBe('bullish');
    });

    it('should return northbound status', () => {
      bridge.ingestNorthbound({
        date: '2026-06-18', northboundNet: -30, shanghaiNet: -20, shenzhenNet: -10, northboundStrength: 30, consecutiveDays: -2,
        topFlowStocks: [], timestamp: Date.now(),
      });

      const status = bridge.getNorthboundStatus();
      expect(status).not.toBeNull();
      expect(status!.northboundNet).toBe(-30);
      expect(status!.consecutiveDays).toBe(-2);
    });
  });

  // ── Dragon Gate ───────────────────────────────────────────────────────────

  describe('dragon gate signals', () => {
    it('should detect whale institutional buy', () => {
      bridge.ingestDragonGate({
        symbol: '000858',
        name: '五粮液',
        reason: '日涨幅偏离值达7%',
        buyAmount: 35000,
        sellAmount: 15000,
        netAmount: 20000,
        institutionBuy: 25000,
        institutionSell: 5000,
        whaleSignal: 'strong_buy',
        impactScore: 92,
        timestamp: Date.now(),
      });

      const sigs = bridge.getSignals('whale_trade');
      const buySig = sigs.find(s => s.factorId === 'CN_DRAGON_GATE');
      expect(buySig).toBeDefined();
      expect(buySig!.direction).toBe('bullish');
      expect(buySig!.severity).toBe('critical');
    });

    it('should detect whale distribution', () => {
      bridge.ingestDragonGate({
        symbol: '002594', name: '比亚迪', reason: '日跌幅偏离值达7%',
        buyAmount: 8000, sellAmount: 25000, netAmount: -17000,
        institutionBuy: 3000, institutionSell: 20000,
        whaleSignal: 'strong_sell', impactScore: 88, timestamp: Date.now(),
      });

      const sellSig = bridge.getSignals('whale_trade').find(s => s.factorId === 'CN_DRAGON_GATE_SELL');
      expect(sellSig).toBeDefined();
      expect(sellSig!.direction).toBe('bearish');
    });

    it('should return dragon gate history', () => {
      bridge.ingestDragonGate({ symbol: '600519', name: '茅台', reason: '连续三个交易日内涨幅偏离值累计达20%', buyAmount: 50000, sellAmount: 20000, netAmount: 30000, institutionBuy: 35000, institutionSell: 10000, whaleSignal: 'strong_buy', impactScore: 95, timestamp: Date.now() });
      bridge.ingestDragonGate({ symbol: '600519', name: '茅台', reason: '日涨幅偏离值达7%', buyAmount: 20000, sellAmount: 15000, netAmount: 5000, institutionBuy: 8000, institutionSell: 6000, whaleSignal: 'buy', impactScore: 70, timestamp: Date.now() + 86400000 });

      const history = bridge.getDragonGateHistory('600519');
      expect(history.length).toBe(2);
    });
  });

  // ── Margin ─────────────────────────────────────────────────────────────────

  describe('margin signals', () => {
    it('should detect leverage surge', () => {
      bridge.ingestMargin({
        date: '2026-06-18', shMarginBalance: 9000, szMarginBalance: 7000,
        totalMarginBalance: 16000, shShortBalance: 300, szShortBalance: 200,
        marginRatio: 9.5, marginSignal: 'leverage_surge', timestamp: Date.now(),
      });

      const sig = bridge.getSignals('margin_report').find(s => s.factorId === 'CN_MARGIN');
      expect(sig).toBeDefined();
      expect(sig!.direction).toBe('bullish');
      expect(sig!.severity).toBe('critical');
    });

    it('should detect de-leveraging', () => {
      bridge.ingestMargin({
        date: '2026-06-18', shMarginBalance: 4000, szMarginBalance: 3000,
        totalMarginBalance: 7000, shShortBalance: 500, szShortBalance: 400,
        marginRatio: 4.5, marginSignal: 'deleveraging', timestamp: Date.now(),
      });

      const sig = bridge.getSignals('margin_report').find(s => s.factorId === 'CN_MARGIN_DEL');
      expect(sig).toBeDefined();
      expect(sig!.direction).toBe('bearish');
    });

    it('should return margin status', () => {
      bridge.ingestMargin({ date: '2026-06-18', shMarginBalance: 6000, szMarginBalance: 5000, totalMarginBalance: 11000, shShortBalance: 400, szShortBalance: 300, marginRatio: 7.0, marginSignal: 'leverage_normal', timestamp: Date.now() });

      const status = bridge.getMarginStatus();
      expect(status).not.toBeNull();
      expect(status!.totalMarginBalance).toBe(11000);
    });
  });

  // ── Sector Flow ───────────────────────────────────────────────────────────

  describe('sector flow signals', () => {
    it('should detect sector inflow rotation', () => {
      bridge.ingestSectorFlow({
        sectorName: 'electronics', sectorNameCn: '电子', netFlow: 45,
        mainNetFlow: 30, topStock: '000725', changePercent: 3.2,
        direction: 'strong_inflow', sectorScore: 85, timestamp: Date.now(),
      });

      const sig = bridge.getSignals('sector_rotation').find(s => s.factorId === 'CN_SECTOR_FLOW');
      expect(sig).toBeDefined();
      expect(sig!.direction).toBe('bullish');
    });

    it('should detect sector outflow rotation', () => {
      bridge.ingestSectorFlow({
        sectorName: 'real_estate', sectorNameCn: '房地产', netFlow: -30,
        mainNetFlow: -20, topStock: '000002', changePercent: -2.5,
        direction: 'strong_outflow', sectorScore: 15, timestamp: Date.now(),
      });

      const sig = bridge.getSignals('sector_rotation').find(s => s.factorId === 'CN_SECTOR_OUTFLOW');
      expect(sig).toBeDefined();
      expect(sig!.direction).toBe('bearish');
    });

    it('should return top sector flows', () => {
      bridge.ingestSectorFlow({ sectorName: 'a', sectorNameCn: '电子', netFlow: 50, mainNetFlow: 30, topStock: 'x', changePercent: 3, direction: 'strong_inflow', sectorScore: 85, timestamp: Date.now() });
      bridge.ingestSectorFlow({ sectorName: 'b', sectorNameCn: '医药', netFlow: 30, mainNetFlow: 20, topStock: 'y', changePercent: 2, direction: 'inflow', sectorScore: 70, timestamp: Date.now() });
      bridge.ingestSectorFlow({ sectorName: 'c', sectorNameCn: '地产', netFlow: -10, mainNetFlow: -8, topStock: 'z', changePercent: -1, direction: 'outflow', sectorScore: 30, timestamp: Date.now() });

      const top = bridge.getTopSectorFlows(2);
      expect(top.length).toBe(2);
      expect(top[0].netFlow).toBeGreaterThanOrEqual(top[1].netFlow);
    });
  });

  // ── Limit Breadth ─────────────────────────────────────────────────────────

  describe('limit breadth signals', () => {
    it('should detect hot market with many limit-ups', () => {
      bridge.ingestLimitAnalysis({
        date: '2026-06-18', upLimitCount: 100, downLimitCount: 5,
        continuousUpLimit: 20, firstUpLimit: 45, blowBoard: 8,
        limitRatio: 0.85, sentimentLevel: 'hot', breadthScore: 90, timestamp: Date.now(),
      });

      const sig = bridge.getSignals('limit_breadth').find(s => s.factorId === 'CN_LIMIT_HOT');
      expect(sig).toBeDefined();
      expect(sig!.direction).toBe('bullish');
    });

    it('should detect freezing market sentiment', () => {
      bridge.ingestLimitAnalysis({
        date: '2026-06-18', upLimitCount: 10, downLimitCount: 60,
        continuousUpLimit: 2, firstUpLimit: 5, blowBoard: 15,
        limitRatio: 0.2, sentimentLevel: 'freezing', breadthScore: 10, timestamp: Date.now(),
      });

      const sig = bridge.getSignals('limit_breadth').find(s => s.factorId === 'CN_LIMIT_COLD');
      expect(sig).toBeDefined();
      expect(sig!.direction).toBe('bearish');
      expect(sig!.severity).toBe('critical');
    });

    it('should detect high blow-board rate', () => {
      bridge.ingestLimitAnalysis({
        date: '2026-06-18', upLimitCount: 30, downLimitCount: 20,
        continuousUpLimit: 5, firstUpLimit: 12, blowBoard: 18,
        limitRatio: 0.35, sentimentLevel: 'neutral', breadthScore: 40, timestamp: Date.now(),
      });

      const sig = bridge.getSignals('limit_breadth').find(s => s.factorId === 'CN_BLOW_BOARD');
      expect(sig).toBeDefined();
      expect(sig!.direction).toBe('bearish');
    });
  });

  // ── Composite scoring ─────────────────────────────────────────────────────

  describe('composite scoring', () => {
    it('should compute composite sentiment score', () => {
      bridge.ingestNorthbound({ date: '2026-06-18', northboundNet: 80, shanghaiNet: 50, shenzhenNet: 30, northboundStrength: 80, consecutiveDays: 4, topFlowStocks: [], timestamp: Date.now() });
      bridge.ingestMargin({ date: '2026-06-18', shMarginBalance: 7000, szMarginBalance: 5000, totalMarginBalance: 12000, shShortBalance: 300, szShortBalance: 200, marginRatio: 8, marginSignal: 'leverage_normal', timestamp: Date.now() });
      bridge.ingestLimitAnalysis({ date: '2026-06-18', upLimitCount: 70, downLimitCount: 10, continuousUpLimit: 12, firstUpLimit: 30, blowBoard: 5, limitRatio: 0.75, sentimentLevel: 'warm', breadthScore: 70, timestamp: Date.now() });

      const score = bridge.computeCompositeSentiment();
      expect(score).toBeGreaterThan(0); // should be bullish
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(-100);
    });

    it('should compute per-stock score', () => {
      bridge.ingestSnapshot({ symbol: '600519', name: '茅台', exchange: 'SH', board: '主板', price: 1800, changePercent: 3.0, volume: 5000000, amount: 9000000000, turnover: 8, pe: 35, pb: 12, marketCap: 22600, timestamp: Date.now() });
      bridge.ingestSmartMoney({ symbol: '600519', name: '茅台', ddx: 0.9, ddy: 0.3, ddz: 0.2, bigOrderNet: 60000, mainForceDirection: 'inflow', mainForceStrength: 78, timestamp: Date.now() });
      bridge.ingestDragonGate({ symbol: '600519', name: '茅台', reason: '日涨幅偏离值达7%', buyAmount: 25000, sellAmount: 10000, netAmount: 15000, institutionBuy: 18000, institutionSell: 5000, whaleSignal: 'strong_buy', impactScore: 90, timestamp: Date.now() });

      const score = bridge.computeStockScore('600519');
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return neutral 50 for unknown stock', () => {
      expect(bridge.computeStockScore('UNKNOWN')).toBe(50);
    });
  });

  // ── Signal streaming & config ─────────────────────────────────────────────

  describe('signal streaming', () => {
    it('should notify signal handlers', () => {
      const received: string[] = [];
      const unsub = bridge.onSignal(sig => received.push(sig.factorId));

      bridge.ingestNorthbound({ date: '2026-06-18', northboundNet: 120, shanghaiNet: 70, shenzhenNet: 50, northboundStrength: 90, consecutiveDays: 6, topFlowStocks: [], timestamp: Date.now() });

      expect(received.length).toBeGreaterThan(0);

      unsub();
      const countBefore = received.length;
      bridge.ingestNorthbound({ date: '2026-06-18', northboundNet: 110, shanghaiNet: 60, shenzhenNet: 50, northboundStrength: 88, consecutiveDays: 7, topFlowStocks: [], timestamp: Date.now() });
      expect(received.length).toBe(countBefore); // unsubscribed, no new events
    });
  });

  describe('config & reset', () => {
    it('should update and retrieve config', () => {
      bridge.updateConfig({ ddxThreshold: { inflow: 1.0, outflow: -1.0 }, signalExpiryMs: 3600_000 });
      const cfg = bridge.getConfig();
      expect(cfg.ddxThreshold.inflow).toBe(1.0);
      expect(cfg.signalExpiryMs).toBe(3600_000);
    });

    it('should reset all state', () => {
      bridge.ingestSnapshot({ symbol: '600519', name: '茅台', exchange: 'SH', board: '主板', price: 1800, changePercent: 2.5, volume: 5000000, amount: 9000000000, turnover: 5, pe: 35, pb: 12, marketCap: 22600, timestamp: Date.now() });
      bridge.ingestNorthbound({ date: '2026-06-18', northboundNet: 80, shanghaiNet: 50, shenzhenNet: 30, northboundStrength: 80, consecutiveDays: 5, topFlowStocks: [], timestamp: Date.now() });

      expect(bridge.getSignals().length).toBeGreaterThan(0);

      bridge.reset();
      expect(bridge.getSignals().length).toBe(0);
      expect(bridge.getSnapshot('600519')).toBeNull();
      expect(bridge.getNorthboundStatus()).toBeNull();
      expect(bridge.getStats().totalSignals).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auto#2: FactorSubscriptionPushBridge
// ═══════════════════════════════════════════════════════════════════════════

describe('R276-auto#2 FactorSubscriptionPushBridge', () => {
  let psBridge: FactorSubscriptionPushBridge;

  beforeEach(() => {
    resetFactorSubPushBridge();
    psBridge = getFactorSubPushBridge();
  });

  // ── Subscription management ──────────────────────────────────────────────

  describe('subscription management', () => {
    it('should subscribe to a factor', () => {
      const result = psBridge.subscribe({
        factorId: 'MOM_12M', factorName: 'Momentum 12M', factorNameCn: '12月动量', userId: 'user1',
      });

      expect(result.success).toBe(true);
      expect(result.subscriptionId).toBeDefined();
    });

    it('should list subscriptions for a user', () => {
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'Momentum', factorNameCn: '动量', userId: 'user1' });
      psBridge.subscribe({ factorId: 'SIZE', factorName: 'Size', factorNameCn: '规模', userId: 'user1' });

      const subs = psBridge.listSubscriptions('user1');
      expect(subs.length).toBe(2);
    });

    it('should get a specific subscription', () => {
      const result = psBridge.subscribe({ factorId: 'HML', factorName: 'Value', factorNameCn: '价值', userId: 'user1' });
      const sub = psBridge.getSubscription(result.subscriptionId!);
      expect(sub).not.toBeNull();
      expect(sub!.factorId).toBe('HML');
    });

    it('should unsubscribe from a factor', () => {
      const result = psBridge.subscribe({ factorId: 'MKT', factorName: 'Market Beta', factorNameCn: '市场Beta', userId: 'user1' });
      expect(psBridge.listSubscriptions('user1').length).toBe(1);

      const removed = psBridge.unsubscribe(result.subscriptionId!);
      expect(removed).toBe(true);
      expect(psBridge.listSubscriptions('user1').length).toBe(0);
    });

    it('should toggle subscription enabled state', () => {
      const result = psBridge.subscribe({ factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量', userId: 'user1' });

      psBridge.toggleSubscription(result.subscriptionId!, false);
      let sub = psBridge.getSubscription(result.subscriptionId!);
      expect(sub!.enabled).toBe(false);

      psBridge.toggleSubscription(result.subscriptionId!, true);
      sub = psBridge.getSubscription(result.subscriptionId!);
      expect(sub!.enabled).toBe(true);
    });

    it('should enforce free tier subscription limit', () => {
      // Subscribe to 3 factors (max for free)
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: 'M', userId: 'user1' });
      psBridge.subscribe({ factorId: 'SIZE', factorName: 'S', factorNameCn: 'S', userId: 'user1' });
      psBridge.subscribe({ factorId: 'HML', factorName: 'V', factorNameCn: 'V', userId: 'user1' });

      const result4 = psBridge.subscribe({ factorId: 'QUAL', factorName: 'Q', factorNameCn: 'Q', userId: 'user1' });
      expect(result4.success).toBe(false);
      expect(result4.error).toBe('MAX_FREE_LIMIT');
    });

    it('should allow premium tier unlimited subscriptions', () => {
      for (let i = 0; i < 10; i++) {
        const result = psBridge.subscribe({
          factorId: `FACTOR_${i}`, factorName: `Factor ${i}`, factorNameCn: `因子${i}`, userId: 'premium_user', tier: 'premium',
        });
        expect(result.success).toBe(true);
      }
      expect(psBridge.listSubscriptions('premium_user').length).toBe(10);
    });
  });

  // ── Push delivery ────────────────────────────────────────────────────────

  describe('dispatch signal', () => {
    it('should dispatch signal to matching subscription', () => {
      const deliveries: any[] = [];
      psBridge.onDelivery(d => deliveries.push(d));

      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'Momentum', factorNameCn: '动量', userId: 'user1' });
      const result = psBridge.dispatchSignal({
        signalId: 'sig_001', factorId: 'MOM_12M', factorName: 'Momentum',
        title: '动量因子突破', body: 'IC升至0.06', bodyCn: '动量因子IC跃升至0.06', severity: 'warning', value: 0.06,
      });

      expect(result.deliveries).toBeGreaterThanOrEqual(1);
      expect(deliveries.length).toBeGreaterThanOrEqual(1);
      expect(deliveries[0].factorId).toBe('MOM_12M');
    });

    it('should not dispatch to disabled subscriptions', () => {
      const deliveries: any[] = [];
      psBridge.onDelivery(d => deliveries.push(d));

      const result = psBridge.subscribe({ factorId: 'MKT', factorName: 'Beta', factorNameCn: 'Beta', userId: 'user1' });
      psBridge.toggleSubscription(result.subscriptionId!, false);

      const dr = psBridge.dispatchSignal({
        signalId: 'sig_002', factorId: 'MKT', factorName: 'Beta',
        title: 'T', body: 'B', severity: 'info',
      });

      expect(dr.deliveries).toBe(0);
      expect(deliveries.length).toBe(0);
    });

    it('should filter by minSeverity', () => {
      const deliveries: any[] = [];
      psBridge.onDelivery(d => deliveries.push(d));

      psBridge.subscribe({
        factorId: 'HML', factorName: 'Value', factorNameCn: '价值', userId: 'user1', minSeverity: 'warning',
      });

      // Send info signal — should be filtered
      psBridge.dispatchSignal({ signalId: 'sig_low', factorId: 'HML', factorName: 'Value', title: 'T', body: 'B', severity: 'info' });
      expect(deliveries.length).toBe(0);

      // Send warning signal — should pass
      psBridge.dispatchSignal({ signalId: 'sig_med', factorId: 'HML', factorName: 'Value', title: 'T', body: 'B', severity: 'warning' });
      expect(deliveries.length).toBeGreaterThan(0);
    });

    it('should filter by threshold', () => {
      const deliveries: any[] = [];
      psBridge.onDelivery(d => deliveries.push(d));

      psBridge.subscribe({
        factorId: 'MOM_12M', factorName: 'Momentum', factorNameCn: '动量', userId: 'user1',
        threshold: { field: 'ic', operator: 'gt', value: 0.05 },
      });

      // Below threshold — should be filtered
      psBridge.dispatchSignal({ signalId: 'sig_below', factorId: 'MOM_12M', factorName: 'Momentum', title: 'T', body: 'B', severity: 'warning', value: 0.03 });
      expect(deliveries.length).toBe(0);

      // Above threshold — should pass
      psBridge.dispatchSignal({ signalId: 'sig_above', factorId: 'MOM_12M', factorName: 'Momentum', title: 'T', body: 'B', severity: 'warning', value: 0.07 });
      expect(deliveries.length).toBeGreaterThan(0);
    });

    it('should enforce cooldown', () => {
      const deliveries: any[] = [];
      psBridge.onDelivery(d => deliveries.push(d));

      psBridge.subscribe({ factorId: 'SIZE', factorName: 'Size', factorNameCn: '规模', userId: 'user1', cooldownMs: 60000 });

      psBridge.dispatchSignal({ signalId: 'sig_a', factorId: 'SIZE', factorName: 'Size', title: 'T1', body: 'B1', severity: 'info' });
      expect(deliveries.length).toBeGreaterThan(0);

      const countAfter1 = deliveries.length;
      // Same factor again within cooldown — should be suppressed
      psBridge.dispatchSignal({ signalId: 'sig_b', factorId: 'SIZE', factorName: 'Size', title: 'T2', body: 'B2', severity: 'info' });
      expect(deliveries.length).toBe(countAfter1);
    });
  });

  // ── Batch dispatch ────────────────────────────────────────────────────────

  describe('batch dispatch', () => {
    it('should dispatch multiple signals', () => {
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1' });
      psBridge.subscribe({ factorId: 'SIZE', factorName: 'S', factorNameCn: '规模', userId: 'u1' });

      const result = psBridge.dispatchSignals([
        { signalId: 's1', factorId: 'MOM_12M', factorName: 'M', title: 'T1', body: 'B1', severity: 'info' },
        { signalId: 's2', factorId: 'SIZE', factorName: 'S', title: 'T2', body: 'B2', severity: 'warning' },
      ]);

      expect(result.totalDeliveries).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Quota tracking ────────────────────────────────────────────────────────

  describe('quota tracking', () => {
    it('should track signal quota for free tier', () => {
      const result = psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'user1', tier: 'free', cooldownMs: 0 });
      const subBefore = psBridge.getSubscription(result.subscriptionId!);
      expect(subBefore!.signalsRemaining).toBe(30); // free quota

      // Dispatch 10 signals (cooldown=0 so all should be delivered)
      for (let i = 0; i < 10; i++) {
        psBridge.dispatchSignal({ signalId: `s_${i}`, factorId: 'MOM_12M', factorName: 'M', title: 'T', body: 'B', severity: 'info' });
      }

      const subAfter = psBridge.getSubscription(result.subscriptionId!);
      expect(subAfter!.signalsReceived).toBe(10);
      expect(subAfter!.signalsRemaining).toBe(20); // 30 - 10 = 20
    });

    it('should not limit premium quota', () => {
      const result = psBridge.subscribe({ factorId: 'QUAL', factorName: 'Q', factorNameCn: '质量', userId: 'premium', tier: 'premium' });
      const sub = psBridge.getSubscription(result.subscriptionId!);
      expect(sub!.signalsRemaining).toBe(-1); // unlimited
    });
  });

  // ── Digest mode ───────────────────────────────────────────────────────────

  describe('digest mode', () => {
    it('should queue signals in digest mode', () => {
      psBridge.updateConfig({ digestMode: true, digestIntervalMs: 1000 });
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1' });

      const result = psBridge.dispatchSignal({ signalId: 's1', factorId: 'MOM_12M', factorName: 'M', title: 'T1', body: 'B1', severity: 'info' });
      expect(result.digestQueued).toBe(true);
      expect(result.deliveries).toBe(0);
    });

    it('should flush digest and notify handlers', async () => {
      psBridge.updateConfig({ digestMode: true, digestIntervalMs: 500 });
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1' });

      psBridge.dispatchSignal({ signalId: 's1', factorId: 'MOM_12M', factorName: 'M', title: 'T1', body: 'B1', severity: 'info' });
      psBridge.dispatchSignal({ signalId: 's2', factorId: 'MOM_12M', factorName: 'M', title: 'T2', body: 'B2', severity: 'warning' });

      const digest = psBridge.flushDigest();
      expect(digest).not.toBeNull();
      expect(digest!).toContain('📊');
      expect(digest!).toContain('MOM_12M:');
      expect(digest!).toContain('🟡');
    });

    it('should return null on empty digest flush', () => {
      psBridge.updateConfig({ digestMode: true });
      const digest = psBridge.flushDigest();
      expect(digest).toBeNull();
    });
  });

  // ── Channel & threshold updates ───────────────────────────────────────────

  describe('subscription updates', () => {
    it('should update channels', () => {
      const result = psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1' });
      psBridge.updateChannels(result.subscriptionId!, ['system', 'toast', 'tray']);

      const sub = psBridge.getSubscription(result.subscriptionId!);
      expect(sub!.channels).toEqual(['system', 'toast', 'tray']);
    });

    it('should update threshold', () => {
      const result = psBridge.subscribe({ factorId: 'HML', factorName: 'V', factorNameCn: '价值', userId: 'u1' });
      psBridge.updateThreshold(result.subscriptionId!, { field: 'ic', operator: 'gte', value: 0.08 });

      const sub = psBridge.getSubscription(result.subscriptionId!);
      expect(sub!.threshold).toEqual({ field: 'ic', operator: 'gte', value: 0.08 });
    });

    it('should upgrade tier', () => {
      const result = psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1', tier: 'free' });
      const upgrade = psBridge.upgradeTier(result.subscriptionId!, 'basic');
      expect(upgrade.success).toBe(true);

      const sub = psBridge.getSubscription(result.subscriptionId!);
      expect(sub!.tier).toBe('basic');
      expect(sub!.expiresAt).toBeNull();
    });

    it('should reject downgrade', () => {
      const result = psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1', tier: 'premium' });
      const downgrade = psBridge.upgradeTier(result.subscriptionId!, 'free');
      expect(downgrade.success).toBe(false);
      expect(downgrade.error).toBeDefined();
    });
  });

  // ── Stats & helpers ───────────────────────────────────────────────────────

  describe('stats and helpers', () => {
    it('should return accurate stats', () => {
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1', tier: 'free' });
      psBridge.subscribe({ factorId: 'SIZE', factorName: 'S', factorNameCn: '规模', userId: 'u1', tier: 'basic' });
      psBridge.subscribe({ factorId: 'HML', factorName: 'V', factorNameCn: '价值', userId: 'u1', tier: 'premium' });

      const stats = psBridge.getStats();
      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.freeTrialsActive).toBe(1);
      expect(stats.paidSubscriptions).toBe(2);
    });

    it('should get deliveries for a subscription', () => {
      const result = psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1' });
      psBridge.dispatchSignal({ signalId: 's1', factorId: 'MOM_12M', factorName: 'M', title: 'T1', body: 'B1', severity: 'info' });
      psBridge.dispatchSignal({ signalId: 's2', factorId: 'MOM_12M', factorName: 'M', title: 'T2', body: 'B2', severity: 'warning' });

      const dels = psBridge.getDeliveries(result.subscriptionId!);
      expect(dels.length).toBeGreaterThanOrEqual(1);
    });

    it('should check subscription availability', () => {
      // Free user can subscribe up to 3
      const can1 = psBridge.canSubscribe('new_user', 'free');
      expect(can1.canSubscribe).toBe(true);
      expect(can1.remaining).toBe(3);

      // Premium always unlimited
      const can2 = psBridge.canSubscribe('prem_user', 'premium');
      expect(can2.canSubscribe).toBe(true);
      expect(can2.remaining).toBe(Infinity);
    });
  });

  // ── Digest handler ────────────────────────────────────────────────────────

  describe('digest handler', () => {
    it('should notify digest handlers on flush', () => {
      psBridge.updateConfig({ digestMode: true });
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1' });

      let digestResult = '';
      psBridge.onDigest(d => { digestResult = d; });

      psBridge.dispatchSignal({ signalId: 's1', factorId: 'MOM_12M', factorName: 'M', title: 'T1', body: 'B1', severity: 'info' });
      psBridge.flushDigest();

      expect(digestResult).not.toBe('');
      expect(digestResult).toContain('Factor Digest');
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should reset all state', () => {
      psBridge.subscribe({ factorId: 'MOM_12M', factorName: 'M', factorNameCn: '动量', userId: 'u1' });
      psBridge.dispatchSignal({ signalId: 's1', factorId: 'MOM_12M', factorName: 'M', title: 'T', body: 'B', severity: 'info' });

      expect(psBridge.listSubscriptions('u1').length).toBeGreaterThan(0);
      expect(psBridge.getStats().totalDeliveries).toBeGreaterThan(0);

      psBridge.reset();
      expect(psBridge.listSubscriptions('u1').length).toBe(0);
      expect(psBridge.getStats().totalDeliveries).toBe(0);
    });
  });
});
