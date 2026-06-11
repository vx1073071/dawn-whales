/**
 * Tests for StockAnomalyDetector — real-time anomaly detection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StockAnomalyDetector,
  getStockAnomalyDetector,
  type StockQuote,
  type AnomalyAlert,
  type AnomalyConfig,
} from '../../../../electron/engine/data/stock-anomaly-detector';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQuote(overrides: Partial<StockQuote> = {}): StockQuote {
  return {
    code: '600000',
    name: '浦发银行',
    price: 10.0,
    changePct: 1.5,
    volume: 1_000_000,
    highPrice: 10.5,
    lowPrice: 9.5,
    openPrice: 9.8,
    prevClose: 9.85,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── Constructor & Singleton ──────────────────────────────────────────────────

describe('StockAnomalyDetector — construction', () => {
  it('creates instance with default config', () => {
    const det = new StockAnomalyDetector();
    expect(det).toBeInstanceOf(StockAnomalyDetector);
  });

  it('accepts partial config override', () => {
    const det = new StockAnomalyDetector({ volumeSurgeMultiplier: 5.0 });
    expect(det).toBeInstanceOf(StockAnomalyDetector);
  });

  it('getStockAnomalyDetector returns singleton', () => {
    const a = getStockAnomalyDetector();
    const b = getStockAnomalyDetector();
    expect(a).toBe(b);
  });
});

// ── initialize (no DB) ──────────────────────────────────────────────────────

describe('StockAnomalyDetector — initialize without DB', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector();
    det.initialize(null);
  });

  it('initialize with null db does not throw', () => {
    expect(() => det.initialize(null)).not.toThrow();
  });

  it('processQuotes returns empty for normal quotes', () => {
    const quotes = [makeQuote()];
    const alerts = det.processQuotes(quotes);
    expect(Array.isArray(alerts)).toBe(true);
  });
});

// ── Limit Up Detection ───────────────────────────────────────────────────────

describe('StockAnomalyDetector — limit_up', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      limitUpPct: 9.8,
      enabledTypes: ['limit_up'],
    });
    det.initialize(null);
  });

  it('detects limit up for main board stock (>=9.8% change)', () => {
    const q = makeQuote({
      code: '600000',
      changePct: 10.0,
      price: 10.84,
      prevClose: 9.85,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].type).toBe('limit_up');
    expect(alerts[0].level).toBe('critical');
  });

  it('does not trigger for small change', () => {
    const q = makeQuote({ changePct: 2.0 });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });

  it('detects limit up for ChiNext (30x) stock with 20% limit', () => {
    const q = makeQuote({
      code: '300001',
      changePct: 20.0,
      price: 23.64,
      prevClose: 19.7,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('detects limit up for STAR (68x) stock with 20% limit', () => {
    const q = makeQuote({
      code: '688001',
      changePct: 20.0,
      price: 23.64,
      prevClose: 19.7,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Limit Down Detection ─────────────────────────────────────────────────────

describe('StockAnomalyDetector — limit_down', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      limitDownPct: -9.8,
      enabledTypes: ['limit_down'],
    });
    det.initialize(null);
  });

  it('detects limit down for main board stock', () => {
    const q = makeQuote({
      code: '600000',
      changePct: -10.0,
      price: 8.87,
      prevClose: 9.85,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].type).toBe('limit_down');
    expect(alerts[0].level).toBe('critical');
  });

  it('does not trigger for moderate decline', () => {
    const q = makeQuote({ changePct: -3.0 });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });
});

// ── Volume Surge Detection ───────────────────────────────────────────────────

describe('StockAnomalyDetector — volume_surge', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      volumeSurgeMultiplier: 3.0,
      enabledTypes: ['volume_surge'],
    });
    det.initialize(null);
    // Set average volumes
    det.updateAverageVolumes(new Map([['600000', 1_000_000]]));
  });

  it('detects volume surge > 3x average', () => {
    const q = makeQuote({ volume: 5_000_000 }); // 5x
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].type).toBe('volume_surge');
  });

  it('does not trigger for volume below threshold', () => {
    const q = makeQuote({ volume: 2_000_000 }); // 2x < 3x
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });

  it('critical level for ratio > 5x', () => {
    const q = makeQuote({ volume: 6_000_000 }); // 6x
    const alerts = det.processQuotes([q]);
    expect(alerts[0].level).toBe('critical');
  });

  it('no alert when avg volume not set', () => {
    const q = makeQuote({ code: '999999', volume: 99_000_000 });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });

  it('suppresses duplicate alert within 10 min', () => {
    const q = makeQuote({ volume: 5_000_000 });
    const a1 = det.processQuotes([q]);
    expect(a1.length).toBe(1);
    // Process same stock again immediately
    const a2 = det.processQuotes([q]);
    expect(a2.length).toBe(0);
  });
});

// ── Rapid Change Detection ───────────────────────────────────────────────────

describe('StockAnomalyDetector — rapid_change', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      rapidChangeThreshold: 3.0,
      rapidChangeWindowMs: 5 * 60 * 1000,
      enabledTypes: ['rapid_change'],
    });
    det.initialize(null);
  });

  it('detects rapid price rise', () => {
    const now = Date.now();
    // Seed history with older quote
    det.processQuotes([makeQuote({ code: '600000', price: 10.0, timestamp: now - 60000 })]);
    // Current quote 4% higher within 1 minute
    const alerts = det.processQuotes([
      makeQuote({ code: '600000', price: 10.4, timestamp: now }),
    ]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].type).toBe('rapid_change');
  });

  it('does not trigger for small change', () => {
    const now = Date.now();
    det.processQuotes([makeQuote({ code: '600000', price: 10.0, timestamp: now - 60000 })]);
    const alerts = det.processQuotes([
      makeQuote({ code: '600000', price: 10.1, timestamp: now }), // 1%
    ]);
    expect(alerts.length).toBe(0);
  });

  it('needs at least 2 quotes in history', () => {
    const alerts = det.processQuotes([makeQuote({ code: '600000', price: 10.0 })]);
    // First call seeds history, no detection yet
    expect(alerts.length).toBe(0);
  });
});

// ── Gap Detection ────────────────────────────────────────────────────────────

describe('StockAnomalyDetector — gap_up / gap_down', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      gapThreshold: 3.0,
      enabledTypes: ['gap_up', 'gap_down'],
    });
    det.initialize(null);
  });

  it('detects gap up (open > prevClose + 3%)', () => {
    const q = makeQuote({
      openPrice: 10.5,
      prevClose: 10.0,
      changePct: 5.0,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts.some(a => a.type === 'gap_up')).toBe(true);
  });

  it('detects gap down (open < prevClose - 3%)', () => {
    const q = makeQuote({
      openPrice: 9.5,
      prevClose: 10.0,
      changePct: -5.0,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts.some(a => a.type === 'gap_down')).toBe(true);
  });

  it('no gap alert for small gap', () => {
    const q = makeQuote({
      openPrice: 10.1,
      prevClose: 10.0,
      changePct: 1.0,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });

  it('no gap alert when openPrice is 0', () => {
    const q = makeQuote({ openPrice: 0, prevClose: 10.0 });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });
});

// ── Price Breakout Detection ─────────────────────────────────────────────────

describe('StockAnomalyDetector — price_breakout', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      enabledTypes: ['price_breakout'],
    });
    det.initialize(null);
  });

  it('detects breakout above recent high', () => {
    const now = Date.now();
    // Seed 12 historical quotes with highs around 10-11
    for (let i = 0; i < 12; i++) {
      det.processQuotes([
        makeQuote({
          code: '600000',
          price: 10 + Math.sin(i) * 0.5,
          highPrice: 11,
          lowPrice: 9.5,
          timestamp: now - (12 - i) * 60000,
        }),
      ]);
    }
    // Current quote breaks above 11
    const alerts = det.processQuotes([
      makeQuote({
        code: '600000',
        price: 12.0,
        highPrice: 12.0,
        lowPrice: 11.5,
        timestamp: now,
      }),
    ]);
    expect(alerts.some(a => a.type === 'price_breakout')).toBe(true);
  });

  it('no breakout with < 10 history points', () => {
    for (let i = 0; i < 5; i++) {
      det.processQuotes([makeQuote({ code: '600000', timestamp: Date.now() - (5 - i) * 60000 })]);
    }
    const alerts = det.processQuotes([
      makeQuote({ code: '600000', price: 100, timestamp: Date.now() }),
    ]);
    expect(alerts.length).toBe(0);
  });
});

// ── Turnover Spike Detection ─────────────────────────────────────────────────

describe('StockAnomalyDetector — turnover_spike', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      enabledTypes: ['turnover_spike'],
    });
    det.initialize(null);
    det.updateAverageVolumes(new Map([['600000', 1_000_000]]));
  });

  it('detects extreme turnover (>= 5x)', () => {
    const q = makeQuote({ volume: 6_000_000 }); // 6x
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].type).toBe('turnover_spike');
  });

  it('no turnover spike below 5x', () => {
    const q = makeQuote({ volume: 4_000_000 }); // 4x
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });
});

// ── Alert Management ─────────────────────────────────────────────────────────

describe('StockAnomalyDetector — alert management', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({
      enabledTypes: ['limit_up'],
      limitUpPct: 9.8,
    });
    det.initialize(null);
  });

  it('getSummary returns correct structure', () => {
    det.processQuotes([
      makeQuote({ changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    const summary = det.getSummary();
    expect(summary).toHaveProperty('totalAlerts');
    expect(summary).toHaveProperty('critical');
    expect(summary).toHaveProperty('warning');
    expect(summary).toHaveProperty('info');
    expect(summary).toHaveProperty('topMovers');
    expect(summary).toHaveProperty('byType');
    expect(summary).toHaveProperty('lastScanTime');
    expect(summary.totalAlerts).toBeGreaterThanOrEqual(1);
  });

  it('getAlerts filters by level', () => {
    det.processQuotes([
      makeQuote({ changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    const critical = det.getAlerts({ level: 'critical' });
    expect(critical.length).toBeGreaterThanOrEqual(1);
    const info = det.getAlerts({ level: 'info' });
    expect(info.length).toBe(0);
  });

  it('getAlerts filters by type', () => {
    det.processQuotes([
      makeQuote({ changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    const alerts = det.getAlerts({ type: 'limit_up' });
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const none = det.getAlerts({ type: 'gap_up' });
    expect(none.length).toBe(0);
  });

  it('getAlerts filters by code', () => {
    det.processQuotes([
      makeQuote({ code: '600000', changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    expect(det.getAlerts({ code: '600000' }).length).toBeGreaterThanOrEqual(1);
    expect(det.getAlerts({ code: '999999' }).length).toBe(0);
  });

  it('getAlerts respects limit', () => {
    for (let i = 0; i < 5; i++) {
      det.processQuotes([
        makeQuote({
          code: `60000${i}`,
          changePct: 10,
          price: 10.84,
          prevClose: 9.85,
        }),
      ]);
    }
    const limited = det.getAlerts({ limit: 2 });
    expect(limited.length).toBeLessThanOrEqual(2);
  });

  it('getAlerts unacknowledgedOnly filters', () => {
    det.processQuotes([
      makeQuote({ changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    const all = det.getAlerts();
    expect(all.length).toBeGreaterThanOrEqual(1);
    // Acknowledge the first alert
    det.acknowledgeAlert(all[0].id);
    const unack = det.getAlerts({ unacknowledgedOnly: true });
    expect(unack.length).toBe(all.length - 1);
  });

  it('acknowledgeAlert returns false for unknown id', () => {
    expect(det.acknowledgeAlert('nonexistent')).toBe(false);
  });

  it('acknowledgeAlert sets acknowledged=true', () => {
    det.processQuotes([
      makeQuote({ changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    const alerts = det.getAlerts();
    expect(alerts[0].acknowledged).toBe(false);
    det.acknowledgeAlert(alerts[0].id);
    const updated = det.getAlerts();
    expect(updated[0].acknowledged).toBe(true);
  });

  it('clearOldAlerts removes alerts older than cutoff', () => {
    det.processQuotes([
      makeQuote({ changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    const before = det.getAlerts().length;
    // Clear with 0 days back (clears everything)
    const removed = det.clearOldAlerts(0);
    expect(removed).toBe(before);
    expect(det.getAlerts().length).toBe(0);
  });

  it('clearOldAlerts with large daysBack removes nothing recent', () => {
    det.processQuotes([
      makeQuote({ changePct: 10, price: 10.84, prevClose: 9.85 }),
    ]);
    const removed = det.clearOldAlerts(365);
    expect(removed).toBe(0);
  });
});

// ── updateAverageVolumes ─────────────────────────────────────────────────────

describe('StockAnomalyDetector — updateAverageVolumes', () => {
  let det: StockAnomalyDetector;

  beforeEach(() => {
    det = new StockAnomalyDetector({ enabledTypes: ['volume_surge'] });
    det.initialize(null);
  });

  it('sets average volumes for detection', () => {
    det.updateAverageVolumes(new Map([['600000', 500_000]]));
    const q = makeQuote({ volume: 3_000_000 }); // 6x
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('overwrites previous average', () => {
    det.updateAverageVolumes(new Map([['600000', 100]]));
    det.updateAverageVolumes(new Map([['600000', 10_000_000]]));
    const q = makeQuote({ volume: 1_000_000 }); // Now 0.1x
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });
});

// ── Max Alerts Cap ───────────────────────────────────────────────────────────

describe('StockAnomalyDetector — max alerts cap', () => {
  it('truncates alerts at maxAlerts (500)', () => {
    const det = new StockAnomalyDetector({
      enabledTypes: ['limit_up'],
      limitUpPct: 9.8,
    });
    det.initialize(null);

    // Generate many alerts
    for (let i = 0; i < 520; i++) {
      det.processQuotes([
        makeQuote({
          code: `60${String(i).padStart(4, '0')}`,
          changePct: 10,
          price: 10.84,
          prevClose: 9.85,
        }),
      ]);
    }
    const all = det.getAlerts({ limit: 1000 });
    expect(all.length).toBeLessThanOrEqual(500);
  });
});

// ── Disabled Types ───────────────────────────────────────────────────────────

describe('StockAnomalyDetector — disabled types', () => {
  it('does not detect types not in enabledTypes', () => {
    const det = new StockAnomalyDetector({ enabledTypes: [] });
    det.initialize(null);
    det.updateAverageVolumes(new Map([['600000', 100]]));

    const q = makeQuote({
      changePct: 10,
      volume: 999_999_999,
      price: 10.84,
      prevClose: 9.85,
    });
    const alerts = det.processQuotes([q]);
    expect(alerts.length).toBe(0);
  });
});

// ── Unknown Type ─────────────────────────────────────────────────────────────

describe('StockAnomalyDetector — unknown type', () => {
  it('detect method returns null for unhandled type', () => {
    const det = new StockAnomalyDetector({
      enabledTypes: ['large_order' as any, 'capital_inflow' as any, 'capital_outflow' as any, 'technical_breakout' as any, 'derivatives_anomaly' as any],
    });
    det.initialize(null);
    const q = makeQuote();
    const alerts = det.processQuotes([q]);
    // These types fall through to default: return null
    expect(alerts.length).toBe(0);
  });
});
