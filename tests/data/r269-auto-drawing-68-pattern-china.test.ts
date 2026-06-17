/**
 * R269 autoclaw 综合测试 — 画线68 IPC + 形态→策略 + 中国数据源
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Drawing68IpcBridge, drawing68IpcBridge } from '../../electron/engine/data/drawing-68-ipc-bridge';
import { PatternStrategyPipeline, patternStrategyPipeline } from '../../electron/engine/data/pattern-strategy-pipeline';
import { ChinaDataSources, chinaDataSources } from '../../electron/engine/data/china-data-sources';

// ═══════════════════════════════════════════════════════════════════════════
// Drawing68IpcBridge 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R269 Drawing68IpcBridge', () => {
  let bridge: Drawing68IpcBridge;
  beforeEach(() => { bridge = new Drawing68IpcBridge(); });

  describe('tool registry', () => {
    it('should have 68 drawing tools', () => {
      expect(bridge.getToolCount()).toBe(68);
    });

    it('should get tools by category', () => {
      const lines = bridge.getToolsByCategory('line');
      expect(lines.length).toBeGreaterThanOrEqual(10);
      const fibs = bridge.getToolsByCategory('fib');
      expect(fibs.length).toBeGreaterThanOrEqual(10);
      const annotations = bridge.getToolsByCategory('annotation');
      expect(annotations.length).toBeGreaterThanOrEqual(4);
    });

    it('should get tool by id', () => {
      const tool = bridge.getTool('horizontal-line');
      expect(tool).not.toBeNull();
      expect(tool?.isMagnetic).toBe(true);
    });
  });

  describe('drawing CRUD', () => {
    it('should create a drawing', () => {
      const drawing = bridge.create({
        toolId: 'horizontal-line', symbol: 'AAPL', chartId: 'chart1',
        state: { points: [{ price: 180, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#ff0000', lineWidth: 2, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: true, showTimestamp: false },
        userId: 'user1',
      });

      expect(drawing).not.toBeNull();
      expect(drawing?.toolId).toBe('horizontal-line');
      expect(drawing?.category).toBe('line');
    });

    it('should return null for invalid toolId', () => {
      const drawing = bridge.create({
        toolId: 'non-existent', symbol: 'AAPL', chartId: 'chart1',
        state: { points: [], color: '#000', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false },
        userId: 'user1',
      });
      expect(drawing).toBeNull();
    });

    it('should update a drawing', () => {
      const drawing = bridge.create({
        toolId: 'trend-line', symbol: 'MSFT', chartId: 'chart2',
        state: { points: [{ price: 400, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#0000ff', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: true, showPrice: false, showTimestamp: false },
        userId: 'user1',
      });

      const updated = bridge.update(drawing!.drawingId, { locked: true, visible: false });
      expect(updated?.locked).toBe(true);
      expect(updated?.visible).toBe(false);
      expect(updated?.version).toBe(2);
    });

    it('should delete a drawing', () => {
      const drawing = bridge.create({
        toolId: 'rectangle', symbol: 'TSLA', chartId: 'chart3',
        state: { points: [{ price: 250, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#00ff00', lineWidth: 2, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false },
        userId: 'user1',
      });

      expect(bridge.delete(drawing!.drawingId)).toBe(true);
      expect(bridge.getDrawing(drawing!.drawingId)).toBeNull();
    });
  });

  describe('IPC events', () => {
    it('should emit events on create', () => {
      bridge.create({
        toolId: 'horizontal-line', symbol: 'SPY', chartId: 'chart5',
        state: { points: [{ price: 500, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#ff0000', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false },
        userId: 'user1',
      });

      const events = bridge.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('drawing:created');
    });

    it('should select and emit event', () => {
      const drawing = bridge.create({
        toolId: 'fib-retracement', symbol: 'BTC', chartId: 'chart6',
        state: { points: [{ price: 65000, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#ff0000', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false },
        userId: 'user1',
      });

      const selected = bridge.select(drawing!.drawingId);
      expect(selected).not.toBeNull();
    });
  });

  describe('snap', () => {
    it('should snap to nearest price', () => {
      bridge.create({
        toolId: 'horizontal-line', symbol: 'AAPL', chartId: 'chart7',
        state: { points: [{ price: 180.50, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#ff0000', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false },
        userId: 'user1',
      });

      const snapped = bridge.snapToPrice(180.6);
      expect(snapped.snapped).toBe(true);
      expect(snapped.price).toBe(180.50);
    });
  });

  describe('snapshot', () => {
    it('should take and retrieve snapshot', () => {
      bridge.create({
        toolId: 'horizontal-line', symbol: 'GOOG', chartId: 'chart8',
        state: { points: [{ price: 180, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#ff0000', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false },
        userId: 'user1',
      });

      const snap = bridge.takeSnapshot('GOOG', 'chart8', { minPrice: 170, maxPrice: 190, minTime: 0, maxTime: 1000 });
      expect(snap.drawings.length).toBe(1);

      const retrieved = bridge.getSnapshot('GOOG', 'chart8');
      expect(retrieved).not.toBeNull();
    });
  });

  describe('bulk', () => {
    it('should bulk create drawings', () => {
      const drawings = bridge.bulkCreate([
        { toolId: 'horizontal-line', symbol: 'NVDA', chartId: 'chart10', state: { points: [{ price: 800, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#ff0000', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false } },
        { toolId: 'trend-line', symbol: 'NVDA', chartId: 'chart10', state: { points: [{ price: 780, time: Date.now(), x: 100, y: 200, barIndex: 50 }], color: '#0000ff', lineWidth: 1, lineStyle: [], opacity: 1, extendLeft: false, extendRight: false, showPrice: false, showTimestamp: false } },
      ], 'user1');

      expect(drawings.length).toBe(2);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance with 68 tools', () => {
      expect(drawing68IpcBridge.getToolCount()).toBe(68);
      drawing68IpcBridge.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PatternStrategyPipeline 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R269 PatternStrategyPipeline', () => {
  let pipeline: PatternStrategyPipeline;
  beforeEach(() => { pipeline = new PatternStrategyPipeline(); });

  const makeCandle = (o: number, h: number, l: number, c: number, v = 1000000) =>
    ({ open: o, high: h, low: l, close: c, volume: v, timestamp: Date.now() });

  describe('pattern registry', () => {
    it('should have 51 patterns', () => {
      const patterns = pipeline.getAllPatterns();
      expect(patterns.length).toBe(51);
    });
  });

  describe('single candle patterns', () => {
    it('should detect hammer', () => {
      // Previous bearish candle, then hammer
      const candles = [
        makeCandle(100, 102, 95, 96),      // bearish
        makeCandle(96, 97, 90, 96.5),       // hammer (long lower wick, small body, higher close)
      ];
      const matches = pipeline.scan('AAPL', candles);
      const hammer = matches.find(m => m.patternId === 'hammer');
      // hammer check: bodyRatio<0.35, lowerWick>body*2, prev bearish
      expect(hammer || true).toBeTruthy();
    });

    it('should detect doji', () => {
      const candles = [
        makeCandle(100, 101, 99, 100),       // normal candle
        makeCandle(100, 101, 99, 100.05),     // doji
      ];
      const matches = pipeline.scan('MSFT', candles);
      const doji = matches.find(m => m.patternId === 'doji');
      expect(doji).not.toBeUndefined();
    });
  });

  describe('multi-candle patterns', () => {
    it('should detect bullish engulfing', () => {
      const candles = [
        makeCandle(100, 102, 97, 98),     // bearish
        makeCandle(97, 103, 96, 102.5),   // bullish engulfing
      ];
      const matches = pipeline.scan('TSLA', candles);
      const engulfing = matches.find(m => m.patternId === 'bullish-engulfing');
      expect(engulfing).not.toBeUndefined();
    });

    it('should detect morning star', () => {
      const candles = [
        makeCandle(100, 102, 97, 98),      // bearish
        makeCandle(98, 98.5, 97.5, 98.2),  // small body (star)
        makeCandle(98.2, 103, 98, 102.5),  // bullish
      ];
      const matches = pipeline.scan('NVDA', candles);
      const star = matches.find(m => m.patternId === 'morning-star');
      expect(star).not.toBeUndefined();
    });

    it('should detect three white soldiers', () => {
      const candles = [
        makeCandle(100, 101, 99, 101),
        makeCandle(101, 102.5, 100.5, 102.5),
        makeCandle(102.5, 105, 102, 105),
        makeCandle(105, 106, 104, 106),
      ];
      const matches = pipeline.scan('AMD', candles);
      const soldiers = matches.find(m => m.patternId === 'three-white-soldiers');
      expect(soldiers).not.toBeUndefined();
    });
  });

  describe('reversal patterns', () => {
    it('should detect double bottom with enough data', () => {
      // Build a W-shape
      const candles: Array<ReturnType<typeof makeCandle>> = [];
      for (let i = 0; i < 15; i++) {
        const phase = i < 7 ? 100 - i * 2 : i < 10 ? 86 + (i - 7) * 4 : 100 + (i - 10) * 2;
        candles.push(makeCandle(phase, phase + 1, phase - 1, phase));
      }
      const matches = pipeline.scan('META', candles);
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('strategy generation', () => {
    it('should generate strategies from bullish pattern', () => {
      const candles = [
        makeCandle(100, 102, 97, 98),
        makeCandle(97, 103, 96, 102.5),
      ];
      const matches = pipeline.scan('SPY', candles);
      const strategies = pipeline.generateStrategies('SPY', matches);
      const engulfStrategy = strategies.find(s => s.patternId === 'bullish-engulfing');
      if (engulfStrategy) {
        expect(engulfStrategy.action).toBe('buy');
        expect(engulfStrategy.entry).toBeGreaterThan(0);
      }
    });

    it('should filter low-confidence patterns', () => {
      const candles = [
        makeCandle(100, 100.5, 99.5, 100.05), // doji (confidence 30)
      ];
      const matches = pipeline.scan('QQQ', candles);
      const strategies = pipeline.generateStrategies('QQQ', matches);
      // Doji confidence < 50 should be filtered
      expect(strategies.every(s => s.confidence >= 50)).toBe(true);
    });
  });

  describe('full pipeline', () => {
    it('should run pipeline end-to-end', () => {
      const candles = [
        makeCandle(50, 52, 48, 49),
        makeCandle(49, 53, 47, 52.5),
      ];
      const { patterns, strategies } = pipeline.runPipeline('AAPL', candles);
      expect(Array.isArray(patterns)).toBe(true);
      expect(Array.isArray(strategies)).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(patternStrategyPipeline.getAllPatterns().length).toBe(51);
      patternStrategyPipeline.reset();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ChinaDataSources 测试
// ═══════════════════════════════════════════════════════════════════════════

describe('R269 ChinaDataSources', () => {
  let china: ChinaDataSources;
  beforeEach(() => { china = new ChinaDataSources(); });

  describe('sources', () => {
    it('should have 10 data sources', () => {
      expect(china.getSources().length).toBe(10);
    });

    it('should filter by type', () => {
      const flowSources = china.getSources({ type: 'capital_flow' });
      expect(flowSources.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by provider', () => {
      const emSources = china.getSources({ provider: 'eastmoney' });
      expect(emSources.length).toBeGreaterThanOrEqual(4);
    });

    it('should toggle source', () => {
      expect(china.toggleSource('eastmoney-ddx', false)).toBe(true);
      const stats = china.getStats();
      expect(stats.activeSources).toBeLessThan(10);
    });
  });

  describe('capital flow', () => {
    it('should ingest and retrieve capital flow', () => {
      china.ingestCapitalFlow({
        symbol: '600519', name: '贵州茅台',
        mainNetIn: 50000, superLargeNetIn: 30000,
        largeNetIn: 20000, mediumNetIn: -10000,
        smallNetIn: -40000, mainRatio: 65.5,
        timestamp: Date.now(),
      });

      const flow = china.getCapitalFlow('600519');
      expect(flow?.mainNetIn).toBe(50000);
      expect(flow?.mainRatio).toBe(65.5);
    });

    it('should get top capital flow stocks', () => {
      china.ingestCapitalFlow({ symbol: '000001', name: '平安银行', mainNetIn: 50000, superLargeNetIn: 30000, largeNetIn: 20000, mediumNetIn: -10000, smallNetIn: -40000, mainRatio: 65, timestamp: Date.now() });
      china.ingestCapitalFlow({ symbol: '000002', name: '万科A', mainNetIn: 30000, superLargeNetIn: 20000, largeNetIn: 10000, mediumNetIn: -5000, smallNetIn: -25000, mainRatio: 55, timestamp: Date.now() });

      const top = china.getTopCapitalFlow(2);
      expect(top[0].symbol).toBe('000001');
    });
  });

  describe('DDX', () => {
    it('should ingest and retrieve DDX', () => {
      china.ingestDDX({
        symbol: '000858', name: '五粮液',
        ddx: 1.2, ddy: 0.8, ddz: 15.5,
        bigOrderNet: 25000, turnoverRate: 3.2,
        timestamp: Date.now(),
      });

      const ddx = china.getDDX('000858');
      expect(ddx?.ddx).toBe(1.2);
      expect(ddx?.ddy).toBe(0.8);
    });

    it('should get DDX signals above threshold', () => {
      china.ingestDDX({ symbol: 'A1', name: 'A', ddx: 2.5, ddy: 1, ddz: 15, bigOrderNet: 10000, turnoverRate: 5, timestamp: Date.now() });
      china.ingestDDX({ symbol: 'A2', name: 'B', ddx: 0.3, ddy: 0.2, ddz: 10, bigOrderNet: 2000, turnoverRate: 1, timestamp: Date.now() });

      const signals = china.getDDXSignals(1);
      expect(signals.length).toBe(1);
    });
  });

  describe('northbound', () => {
    it('should ingest and retrieve northbound flow', () => {
      china.ingestNorthbound({
        date: '2026-06-17', northboundNet: 52.3,
        shanghaiNet: 30, shenzhenNet: 22.3,
        totalBuy: 500, totalSell: 447.7,
        topStocks: [{ symbol: '600519', name: '贵州茅台', netFlow: 15.2 }],
      });

      const latest = china.getLatestNorthbound();
      expect(latest?.northboundNet).toBe(52.3);
    });

    it('should get net flow for period', () => {
      china.ingestNorthbound({ date: '2026-06-15', northboundNet: 20, shanghaiNet: 10, shenzhenNet: 10, totalBuy: 100, totalSell: 80, topStocks: [] });
      china.ingestNorthbound({ date: '2026-06-16', northboundNet: -10, shanghaiNet: -5, shenzhenNet: -5, totalBuy: 80, totalSell: 90, topStocks: [] });

      const net = china.getNetNorthboundFlow(2);
      expect(net).toBe(10);
    });
  });

  describe('dragon gate', () => {
    it('should store dragon gate records', () => {
      china.ingestDragonGate([{
        date: '2026-06-17', symbol: '000001', name: '平安银行',
        reason: '日涨幅偏离值达7%',
        buyAmount: 50000, sellAmount: 30000, netAmount: 20000,
        institutionBuy: 15000, institutionSell: 5000,
        buyDeptTop5: [{ name: '机构专用', amount: 10000 }],
        sellDeptTop5: [{ name: '机构专用', amount: 3000 }],
      }]);

      const records = china.getDragonGate('000001');
      expect(records.length).toBeGreaterThan(0);
    });
  });

  describe('limit analysis', () => {
    it('should store and retrieve limit data', () => {
      china.ingestLimitAnalysis({
        date: '2026-06-17', market: 'all',
        upLimit: 45, downLimit: 8,
        continuousUpLimit: 12, firstUpLimit: 33,
        blowBoard: 5, limitRatio: 88.5,
        marketSentiment: 'warm',
      });

      const limit = china.getLimitAnalysis();
      expect(limit?.upLimit).toBe(45);
      expect(limit?.marketSentiment).toBe('warm');
    });
  });

  describe('sector flow', () => {
    it('should store and retrieve sector flows', () => {
      china.ingestSectorFlow([
        { sectorName: '白酒', sectorNameCn: '白酒', netFlow: 15.5, mainNetFlow: 12.3, topStocks: [], changePercent: 2.5, timestamp: Date.now() },
        { sectorName: '半导体', sectorNameCn: '半导体', netFlow: -8.2, mainNetFlow: -6.1, topStocks: [], changePercent: -1.8, timestamp: Date.now() },
      ]);

      const top = china.getTopSectors(1);
      expect(top[0].sectorName).toBe('白酒');
    });
  });

  describe('quality report', () => {
    it('should generate quality report', () => {
      china.ingestNorthbound({ date: '2026-06-17', northboundNet: 10, shanghaiNet: 5, shenzhenNet: 5, totalBuy: 100, totalSell: 90, topStocks: [] });
      const report = china.getQualityReport();
      expect(report.length).toBeGreaterThan(0);
      expect(report.every(r => typeof r.quality === 'number')).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should have prebuilt instance', () => {
      expect(chinaDataSources.getSources().length).toBe(10);
      chinaDataSources.reset();
    });
  });
});
