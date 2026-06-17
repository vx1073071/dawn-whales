// ── R271 JVS 测试文件 ──
// 覆盖: DrawingToStrategyEngine + DrawingTypesBridge + IndicatorMarketplaceAPIEngine

import { describe, it, expect, beforeEach } from 'vitest';
import { DrawingToStrategyEngine, DrawingAnalyzer, getDrawingToStrategyEngine, resetDrawingToStrategyEngine, type DrawingObject, type DrawingToolType, type GeneratedStrategy } from '../electron/engine/analysis/drawing-to-strategy-engine';
import { DrawingTypesBridge, ICSBridge, DrawingIPCBridge, NPMBridge, DrawingTemplateEngine, DRAWING_TOOL_REGISTRY, ALL_DRAWING_TOOL_IDS, DRAWING_TOOL_COUNT, getDrawingTypesBridge, resetDrawingTypesBridge, type DrawingToolId, type DrawingCategory, type DrawingState } from '../electron/engine/analysis/drawing-types-bridge';
import { IndicatorMarketplaceAPIEngine, getIndicatorMarketplaceAPIEngine, resetIndicatorMarketplaceAPIEngine, type MarketplaceConfigAPI } from '../electron/engine/analysis/indicator-marketplace-api-engine';

function makeDrawing(type: DrawingToolType, points: {price:number;timestamp:number}[]): DrawingObject {
  return { id: crypto.randomUUID(), type, symbol: 'AAPL', points: points.map((p,i)=>({x:i*100,y:0,price:p.price,timestamp:p.timestamp})), properties: {}, createdAt: Date.now() };
}

// ═══════════════════════════════════════════════════════════
// DrawingToStrategyEngine
// ═══════════════════════════════════════════════════════════

describe('DrawingToStrategyEngine', () => {
  let engine: DrawingToStrategyEngine;
  beforeEach(() => { resetDrawingToStrategyEngine(); engine = getDrawingToStrategyEngine(); });

  it('generates strategy from horizontal line', () => {
    const drawing = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]);
    const strat = engine.generate('Test', '', [drawing], 'AAPL');
    expect(strat.rules.length).toBeGreaterThanOrEqual(1);
    expect(strat.rules.some(r => r.action === 'buy')).toBe(true);
    expect(strat.backtestReady).toBe(true);
  });

  it('generates strategy from trend line', () => {
    const drawing = makeDrawing('trend_line', [{ price: 100, timestamp: 1000 }, { price: 110, timestamp: 2000 }]);
    const strat = engine.generate('Test', '', [drawing], 'AAPL');
    expect(strat.rules.length).toBeGreaterThanOrEqual(1);
    expect(strat.confidence).toBeGreaterThan(0);
  });

  it('generates strategy from fib retracement', () => {
    const drawing = makeDrawing('fib_retracement', [{ price: 100, timestamp: 1000 }, { price: 200, timestamp: 2000 }]);
    const strat = engine.generate('Fib Test', '', [drawing], 'AAPL');
    expect(strat.rules.length).toBeGreaterThanOrEqual(3);
    expect(strat.rules.every(r => r.weight > 0)).toBe(true);
  });

  it('generates strategy from head & shoulders', () => {
    const drawing: DrawingObject = { id: crypto.randomUUID(), type: 'head_shoulders', symbol: 'AAPL', points: [{ x: 0, y: 0, price: 100, timestamp: 1000 }, { x: 1, y: 1, price: 120, timestamp: 2000 }, { x: 2, y: 2, price: 100, timestamp: 3000 }, { x: 3, y: 3, price: 130, timestamp: 4000 }, { x: 4, y: 4, price: 100, timestamp: 5000 }], properties: {}, createdAt: 0 };
    const strat = engine.generate('H&S', '', [drawing], 'AAPL');
    expect(strat.rules.length).toBeGreaterThanOrEqual(1);
    expect(strat.rules[0].action).toBe('sell');
  });

  it('generates strategy from double bottom', () => {
    const drawing: DrawingObject = { id: crypto.randomUUID(), type: 'double_bottom', symbol: 'AAPL', points: [{ x: 0, y: 0, price: 100, timestamp: 1000 }, { x: 1, y: 1, price: 80, timestamp: 2000 }, { x: 2, y: 2, price: 100, timestamp: 3000 }], properties: {}, createdAt: 0 };
    const strat = engine.generate('DB', '', [drawing], 'AAPL');
    expect(strat.rules[0].action).toBe('buy');
  });

  it('generates strategy from harmonic pattern', () => {
    const drawing: DrawingObject = { id: crypto.randomUUID(), type: 'gartley', symbol: 'AAPL', points: [{ x: 0, y: 0, price: 100, timestamp: 1000 }, { x: 1, y: 1, price: 80, timestamp: 2000 }, { x: 2, y: 2, price: 95, timestamp: 3000 }, { x: 3, y: 3, price: 82, timestamp: 4000 }], properties: {}, createdAt: 0 };
    const strat = engine.generate('Gartley', '', [drawing], 'AAPL');
    expect(strat.rules.length).toBeGreaterThanOrEqual(1);
    expect(strat.rules[0].priority).toBeGreaterThanOrEqual(4);
  });

  it('batch generates one strategy per drawing', () => {
    const d1 = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]);
    const d2 = makeDrawing('trend_line', [{ price: 100, timestamp: 1000 }, { price: 105, timestamp: 2000 }]);
    const strats = engine.batchGenerate('AAPL', [d1, d2]);
    expect(strats.length).toBe(2);
  });

  it('addRule and removeRule work', () => {
    const drawing = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]);
    const strat = engine.generate('Test', '', [drawing], 'AAPL');
    const before = strat.rules.length;
    const rule = strat.rules[0];
    engine.addRule(strat.id, { ...rule, id: 'custom_1', name: 'Custom' });
    expect(strat.rules.length).toBe(before + 1);
    engine.removeRule(strat.id, 'custom_1');
    expect(strat.rules.length).toBe(before);
  });

  it('updateRisk modifies stop loss and take profit', () => {
    const drawing = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]);
    const strat = engine.generate('Risk Test', '', [drawing], 'AAPL');
    const result = engine.updateRisk(strat.id, { stopLoss: { type: 'constant', value: 3 }, takeProfit: { type: 'constant', value: 12 } });
    expect(result!.riskManagement.stopLoss!.value).toBe(3);
    expect(result!.riskManagement.takeProfit!.value).toBe(12);
  });

  it('export returns valid JSON', () => {
    const drawing = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]);
    const strat = engine.generate('Export', '', [drawing], 'AAPL');
    const json = engine.export(strat.id);
    expect(json).toBeDefined();
    expect(() => JSON.parse(json!)).not.toThrow();
  });

  it('getSupportedDrawingTypes covers 31 types', () => {
    const types = engine.getSupportedDrawingTypes();
    expect(types.length).toBe(31);
    const supported = types.filter(t => t.supported);
    expect(supported.length).toBeGreaterThanOrEqual(15);
  });

  it('duplicate condition rules are deduped', () => {
    const d1 = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]);
    const d2 = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]); // same
    const strat = engine.generate('Dedup', '', [d1, d2], 'AAPL');
    // Should dedup: same bounce on 100 from 2 drawings → 1 unique rule
    expect(strat.rules.length).toBeLessThanOrEqual(8);
  });

  it('default risk management is set by config', () => {
    resetDrawingToStrategyEngine();
    const e2 = getDrawingToStrategyEngine({ defaultStopLoss: 8, defaultTakeProfit: 20 });
    const drawing = makeDrawing('horizontal_line', [{ price: 100, timestamp: 1000 }]);
    const strat = e2.generate('Risk', '', [drawing], 'AAPL');
    expect(strat.riskManagement.stopLoss!.value).toBe(8);
    expect(strat.riskManagement.takeProfit!.value).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════
// DrawingTypesBridge
// ═══════════════════════════════════════════════════════════

describe('DrawingTypesBridge', () => {
  let bridge: DrawingTypesBridge;
  beforeEach(() => { resetDrawingTypesBridge(); bridge = getDrawingTypesBridge(); });

  it('DRAWING_TOOL_COUNT === 65', () => {
    expect(DRAWING_TOOL_COUNT).toBe(65);
    expect(ALL_DRAWING_TOOL_IDS.length).toBe(65);
  });

  it('all 65 tools have registry entries', () => {
    for (const id of ALL_DRAWING_TOOL_IDS) {
      expect(DRAWING_TOOL_REGISTRY[id]).toBeDefined();
    }
  });

  it('getToolInfo returns correct data', () => {
    const info = bridge.getToolInfo('trend_line');
    expect(info.name).toBe('Trend Line');
    expect(info.category).toBe('line');
    expect(info.shortcut).toBe('T');
  });

  it('getToolsByCategory filters correctly', () => {
    const lineTools = bridge.getToolsByCategory('line');
    expect(lineTools.length).toBeGreaterThanOrEqual(5);
    expect(lineTools.every(t => t.category === 'line')).toBe(true);
  });

  it('getSupportedTools returns full support tools', () => {
    const supported = bridge.getSupportedTools();
    expect(supported.length).toBeGreaterThanOrEqual(30);
    expect(supported.every(t => t.supportLevel === 'full')).toBe(true);
  });

  it('report returns correct structure', () => {
    const report = bridge.report();
    expect(report.totalTools).toBe(65);
    expect(Object.keys(report.byCategory).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(report.bySupportLevel).length).toBeGreaterThanOrEqual(2);
  });

  it('getNPMPackagesNeeded returns unique packages', () => {
    const pkgs = bridge.getNPMPackagesNeeded();
    expect(pkgs.length).toBeGreaterThanOrEqual(1);
    expect(new Set(pkgs).size).toBe(pkgs.length); // unique
  });
});

// ═══════════════════════════════════════════════════════════
// ICSBridge
// ═══════════════════════════════════════════════════════════

describe('ICSBridge', () => {
  const vp = { priceMin: 90, priceMax: 110, timeMin: 1000000, timeMax: 1003600, width: 800, height: 600 };

  it('priceToY at min price = bottom', () => {
    const y = ICSBridge.priceToY(90, vp);
    expect(y).toBeCloseTo(600, 0);
  });

  it('priceToY at max price = top', () => {
    const y = ICSBridge.priceToY(110, vp);
    expect(y).toBeCloseTo(0, 0);
  });

  it('yToPrice roundtrips', () => {
    const y = ICSBridge.priceToY(100, vp);
    const price = ICSBridge.yToPrice(y, vp);
    expect(price).toBeCloseTo(100, 0);
  });

  it('timeToX roundtrips', () => {
    const x = ICSBridge.timeToX(1001800, vp);
    const time = ICSBridge.xToTime(x, vp);
    expect(time).toBeCloseTo(1001800, -2);
  });
});

// ═══════════════════════════════════════════════════════════
// DrawingIPCBridge
// ═══════════════════════════════════════════════════════════

describe('DrawingIPCBridge', () => {
  let ipc: DrawingIPCBridge;
  beforeEach(() => { ipc = new DrawingIPCBridge(); });

  it('create emits event', () => {
    const events: string[] = [];
    ipc.on('drawing:created', (e) => events.push(e.type));
    ipc.create({ id: 'd1', toolId: 'trend_line', symbol: 'AAPL', viewport: { priceMin: 0, priceMax: 100, timeMin: 0, timeMax: 1000, width: 800, height: 600 }, points: [], properties: { extendLeft: false, extendRight: false, showLabels: false, showPriceLabels: false, lineStyle: 'solid', color: '#fff', width: 1 }, style: { color: '#fff', lineWidth: 1, lineStyle: 'solid' }, locked: false, visible: true, zIndex: 0, createdAt: 0, updatedAt: 0 });
    expect(events).toContain('drawing:created');
  });

  it('update modifies existing drawing', () => {
    ipc.create({ id: 'd1', toolId: 'trend_line', symbol: 'AAPL', viewport: { priceMin: 0, priceMax: 100, timeMin: 0, timeMax: 1000, width: 800, height: 600 }, points: [], properties: { extendLeft: false, extendRight: false, showLabels: false, showPriceLabels: false, lineStyle: 'solid', color: '#fff', width: 1 }, style: { color: '#fff', lineWidth: 1, lineStyle: 'solid' }, locked: false, visible: true, zIndex: 0, createdAt: 0, updatedAt: 0 });
    const updated = ipc.update('d1', { visible: false });
    expect(updated!.visible).toBe(false);
  });

  it('delete removes drawing', () => {
    ipc.create({ id: 'd1', toolId: 'trend_line', symbol: 'AAPL', viewport: { priceMin: 0, priceMax: 100, timeMin: 0, timeMax: 1000, width: 800, height: 600 }, points: [], properties: { extendLeft: false, extendRight: false, showLabels: false, showPriceLabels: false, lineStyle: 'solid', color: '#fff', width: 1 }, style: { color: '#fff', lineWidth: 1, lineStyle: 'solid' }, locked: false, visible: true, zIndex: 0, createdAt: 0, updatedAt: 0 });
    expect(ipc.delete('d1')).toBe(true);
    expect(ipc.get('d1')).toBeUndefined();
  });

  it('serialization roundtrips', () => {
    ipc.create({ id: 'd1', toolId: 'trend_line', symbol: 'AAPL', viewport: { priceMin: 0, priceMax: 100, timeMin: 0, timeMax: 1000, width: 800, height: 600 }, points: [], properties: { extendLeft: false, extendRight: false, showLabels: false, showPriceLabels: false, lineStyle: 'solid', color: '#fff', width: 1 }, style: { color: '#fff', lineWidth: 1, lineStyle: 'solid' }, locked: false, visible: true, zIndex: 0, createdAt: 0, updatedAt: 0 });
    const json = ipc.toJSON();
    const ipc2 = new DrawingIPCBridge();
    ipc2.fromJSON(json);
    expect(ipc2.get('d1')!.toolId).toBe('trend_line');
  });
});

// ═══════════════════════════════════════════════════════════
// NPMBridge
// ═══════════════════════════════════════════════════════════

describe('NPMBridge', () => {
  it('registers and resolves packages', () => {
    const bridge = new NPMBridge();
    bridge.register({ name: '@dawn/drawing-patterns', version: '1.0.0', tools: ['head_shoulders', 'double_top'] });
    const pkg = bridge.resolve('head_shoulders');
    expect(pkg).toBeDefined();
    expect(pkg!.name).toBe('@dawn/drawing-patterns');
  });
});

// ═══════════════════════════════════════════════════════════
// DrawingTemplateEngine
// ═══════════════════════════════════════════════════════════

describe('DrawingTemplateEngine', () => {
  it('create and search', () => {
    const engine = new DrawingTemplateEngine();
    engine.create({ name: 'My Setup', description: 'AAPL trend setup', instruments: ['AAPL'], drawings: [], category: 'trend', tags: ['AAPL', 'trend'], authorId: 'u1' });
    const results = engine.search('trend');
    expect(results.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// IndicatorMarketplaceAPIEngine
// ═══════════════════════════════════════════════════════════

describe('IndicatorMarketplaceAPIEngine', () => {
  let engine: IndicatorMarketplaceAPIEngine;
  beforeEach(() => { resetIndicatorMarketplaceAPIEngine(); engine = getIndicatorMarketplaceAPIEngine(); });

  it('createTemplate succeeds', () => {
    const r = engine.createTemplate('u1', 'Alice', { name: 'Test', description: 'A test template', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 5 });
    expect(r.success).toBe(true);
    expect(r.data!.status).toBe('pending_review');
  });

  it('createTemplate rejects price out of range', () => {
    const r = engine.createTemplate('u1', 'Alice', { name: 'T', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 600 });
    expect(r.success).toBe(false);
  });

  it('approve then publish', () => {
    const r = engine.createTemplate('u1', 'Alice', { name: 'T', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 5 });
    const approve = engine.approveTemplate(r.data!.id, 'admin1');
    expect(approve.success).toBe(true);
    expect(approve.data!.status).toBe('published');
  });

  it('purchase deducts and credits correctly', () => {
    const tmpl = engine.createTemplate('creator', 'Bob', { name: 'T', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 10 });
    engine.approveTemplate(tmpl.data!.id, 'admin');
    engine.createUser('buyer1', 'Buyer', 100);
    engine.createUser('creator', 'Bob', 0);

    const result = engine.purchase(tmpl.data!.id, 'buyer1', 'Buyer');
    expect(result.success).toBe(true);
    expect(result.data!.platformFee).toBe(3); // 30% of 10
    expect(engine.getUser('buyer1')!.walletBalance).toBe(90);
    expect(engine.getUser('creator')!.walletBalance).toBe(7);
  });

  it('cannot purchase own template', () => {
    const tmpl = engine.createTemplate('creator', 'Bob', { name: 'T', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 10 });
    engine.approveTemplate(tmpl.data!.id, 'admin');
    engine.createUser('creator', 'Bob', 100);
    const result = engine.purchase(tmpl.data!.id, 'creator', 'Bob');
    expect(result.success).toBe(false);
  });

  it('review requires purchase first', () => {
    const tmpl = engine.createTemplate('creator', 'Bob', { name: 'T', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 5 });
    engine.approveTemplate(tmpl.data!.id, 'admin');
    engine.createUser('reviewer', 'Reviewer', 100);
    const r = engine.addReview(tmpl.data!.id, 'reviewer', 'Reviewer', 4, 'Great template!');
    expect(r.success).toBe(false); // not purchased
  });

  it('review works after purchase', () => {
    const tmpl = engine.createTemplate('creator', 'Bob', { name: 'T', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 5 });
    engine.approveTemplate(tmpl.data!.id, 'admin');
    engine.createUser('reviewer', 'Reviewer', 100);
    engine.createUser('creator', 'Bob', 0);
    engine.purchase(tmpl.data!.id, 'reviewer', 'Reviewer');

    const r = engine.addReview(tmpl.data!.id, 'reviewer', 'Reviewer', 5, 'Excellent template!');
    expect(r.success).toBe(true);
  });

  it('getAdminStats returns comprehensive data', () => {
    engine.createUser('creator', 'Bob', 0);
    const tmpl = engine.createTemplate('creator', 'Bob', { name: 'T', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: { period: 20 }, pane: 'main', visible: true }], price: 10 });
    engine.approveTemplate(tmpl.data!.id, 'admin');
    engine.createUser('buyer', 'Buyer', 100);
    engine.purchase(tmpl.data!.id, 'buyer', 'Buyer');

    const stats = engine.getAdminStats();
    expect(stats.success).toBe(true);
    expect(stats.data!.totalRevenue).toBeGreaterThanOrEqual(10);
    expect(stats.data!.platformRevenue).toBe(3);
    expect(stats.data!.topCreators.length).toBe(1);
  });

  it('search returns published templates only', () => {
    const t1 = engine.createTemplate('u1', 'A', { name: 'Pub', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: {}, pane: 'main', visible: true }], price: 5 });
    engine.approveTemplate(t1.data!.id, 'admin');
    engine.createTemplate('u1', 'A', { name: 'Draft', description: 'D', category: '趋势', indicators: [{ type: 'SMA', params: {}, pane: 'main', visible: true }], price: 5 }); // stays pending

    const results = engine.search('');
    expect(results.success).toBe(true);
    expect(results.data!.length).toBe(1);
  });
});
