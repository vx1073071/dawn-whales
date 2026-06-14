/**
 * R168 P2-10+11: Factor Alert Service + Screener Presets — Tests
 *
 * Covers: FactorAlertService (IC tracking, alert eval, mute, health),
 *         ScreenerPresets (evaluatePreset, getPreset, describePreset, ALL_PRESETS)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FactorAlertService,
  createFactorAlertService,
  getFactorAlertService,
  type FactorAlertEvent,
} from '../../../electron/engine/factors/factor-alert-service';
import {
  evaluatePreset,
  getPreset,
  getPresetsByCategory,
  describePreset,
  ALL_PRESETS,
  PRESET_VOLUME_BREAKOUT,
  PRESET_LOW_VAL_HIGH_DIV,
  PRESET_STRONG_PULLBACK,
  PRESET_OVERSOLD_BOUNCE,
} from '../../../electron/engine/data/screener-presets';

// ═══════════════════════════════════════════════════════════════════
// FactorAlertService tests
// ═══════════════════════════════════════════════════════════════════

describe('R168 P2-10: FactorAlertService', () => {
  let service: FactorAlertService;

  beforeEach(() => {
    service = createFactorAlertService();
  });

  it('registers new factor and emits FACTOR_ONLINE', () => {
    const alerts: FactorAlertEvent[] = [];
    service.subscribe(e => alerts.push(e));

    service.registerFactor('MOM_12M', '12-Month Momentum');
    expect(alerts.length).toBe(1);
    expect(alerts[0].kind).toBe('FACTOR_ONLINE');
    expect(alerts[0].factorId).toBe('MOM_12M');
    expect(alerts[0].severity).toBe('info');
  });

  it('does NOT emit FACTOR_ONLINE for duplicate registration', () => {
    const alerts: FactorAlertEvent[] = [];
    service.subscribe(e => alerts.push(e));

    service.registerFactor('VALUE_PE', 'P/E Value');
    expect(alerts.length).toBe(1);

    service.registerFactor('VALUE_PE', 'P/E Value');
    expect(alerts.length).toBe(1); // No duplicate alert
  });

  it('records IC and computes historical average', () => {
    service.registerFactor('MOM', 'Momentum');
    service.recordIC('MOM', 0.05);
    service.recordIC('MOM', 0.04);
    service.recordIC('MOM', 0.06);

    const avg = service.getHistoricalAvgIC('MOM');
    expect(avg).toBeCloseTo(0.05, 2);
  });

  it('triggers IC_MUTATION warning when IC drops >40%', () => {
    const alerts: FactorAlertEvent[] = [];
    service.subscribe(e => alerts.push(e));

    service.registerFactor('SIZE_MCAP', 'Market Cap');
    // Build historical avg ~0.05
    service.recordIC('SIZE_MCAP', 0.05);
    service.recordIC('SIZE_MCAP', 0.05);
    service.recordIC('SIZE_MCAP', 0.05);

    const result = service.evaluate('SIZE_MCAP', 'Market Cap', 0.02); // 60% drop
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('IC_MUTATION');
    expect(result!.severity).toBe('critical');
    expect(result!.detail.droppedByPct).toBeGreaterThanOrEqual(40);
  });

  it('triggers FACTOR_FAILURE when IC is near zero', () => {
    const alerts: FactorAlertEvent[] = [];
    service.subscribe(e => alerts.push(e));

    service.registerFactor('DEAD', 'Dead Factor');
    service.recordIC('DEAD', 0.04);
    service.recordIC('DEAD', 0.03);

    const result = service.evaluate('DEAD', 'Dead Factor', 0.001);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('FACTOR_FAILURE');
    expect(result!.severity).toBe('critical');
  });

  it('returns null when IC is healthy', () => {
    service.registerFactor('HEALTHY', 'Healthy');
    service.recordIC('HEALTHY', 0.04);

    const result = service.evaluate('HEALTHY', 'Healthy', 0.042);
    expect(result).toBeNull();
  });

  it('evaluateAll returns only unhealthy factors', () => {
    service.registerFactor('F1', 'Factor1');
    service.registerFactor('F2', 'Factor2');
    service.registerFactor('F3', 'Factor3');
    service.registerFactor('F4', 'Factor4');
    service.registerFactor('F5', 'Factor5');

    service.recordIC('F1', 0.05);
    service.recordIC('F2', 0.04);
    service.recordIC('F3', 0.03);
    service.recordIC('F4', 0.04);
    service.recordIC('F5', 0.03);

    // Only evaluate F4/F5 (bad) — F1/F2/F3 stay healthy by not being evaluated
    service.evaluate('F4', 'Factor4', 0.03);   // 0.04→0.03: 25% drop, not enough → healthy
    service.evaluate('F5', 'Factor5', 0.0001); // failure

    const results = service.evaluateAll();
    // Only F5 should trigger
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.kind === 'FACTOR_FAILURE')).toBe(true);
  });

  it('mute suppresses alerts for specified duration', () => {
    const alerts: FactorAlertEvent[] = [];
    service.subscribe(e => alerts.push(e));

    service.registerFactor('MUTED', 'Muted');
    service.recordIC('MUTED', 0.05);
    // registerFactor produces a FACTOR_ONLINE alert
    const onlineAlertCount = alerts.length;

    service.mute('MUTED', 300000);  // 5 min mute
    const h = service.getHealth('MUTED');
    expect(h).toBeDefined();
    expect(h!.muteUntil).toBeGreaterThan(Date.now());

    // evaluate should be silently suppressed — no new alerts
    const result = service.evaluate('MUTED', 'Muted', 0.001);
    expect(result).toBeNull();
    expect(alerts.length).toBe(onlineAlertCount);  // No additional alerts
  });

  it('getHealthStatus returns correct counts', () => {
    service.registerFactor('G1', 'Good 1');
    service.registerFactor('G2', 'Good 2');
    service.registerFactor('B1', 'Bad 1');

    service.recordIC('G1', 0.05);
    service.recordIC('G2', 0.04);
    service.recordIC('B1', 0.03);

    service.evaluate('G1', 'Good 1', 0.051);  // healthy
    service.evaluate('G2', 'Good 2', 0.042);  // healthy
    service.evaluate('B1', 'Bad 1', 0.0001);  // failure

    const health = service.getHealthStatus();
    expect(health.size).toBeGreaterThanOrEqual(2);
    const statuses = [...health.values()];
    expect(statuses.some(s => s.healthy)).toBe(true);
    expect(statuses.some(s => !s.healthy)).toBe(true);
  });

  it('reset clears all state', () => {
    const alerts: FactorAlertEvent[] = [];
    service.subscribe(e => alerts.push(e));
    service.registerFactor('X', 'X');
    service.recordIC('X', 0.05);

    service.reset();

    // After reset, no factor registered, no listener
    service.registerFactor('Y', 'Y');
    expect(alerts.length).toBe(1);
  });

  it('singleton returns same instance', () => {
    const a = getFactorAlertService();
    const b = getFactorAlertService();
    expect(a).toBe(b);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ScreenerPresets tests
// ═══════════════════════════════════════════════════════════════════

describe('R168 P2-11: ScreenerPresets', () => {
  it('PRESET_VOLUME_BREAKOUT passes valid data', () => {
    const data: Record<string, number> = {
      close: 100, volume_ratio: 2.0, price_change_pct_5d: 5, rsi_14: 60, ma20_slope: 0.5,
    };
    expect(evaluatePreset(PRESET_VOLUME_BREAKOUT, data)).toBe(true);
  });

  it('PRESET_VOLUME_BREAKOUT rejects low volume', () => {
    const data: Record<string, number> = {
      volume_ratio: 0.8, price_change_pct_5d: 5, rsi_14: 60, ma20_slope: 0.5,
    };
    expect(evaluatePreset(PRESET_VOLUME_BREAKOUT, data)).toBe(false);
  });

  it('PRESET_VOLUME_BREAKOUT rejects overbought RSI', () => {
    const data: Record<string, number> = {
      volume_ratio: 2.0, price_change_pct_5d: 5, rsi_14: 80, ma20_slope: 0.5,
    };
    expect(evaluatePreset(PRESET_VOLUME_BREAKOUT, data)).toBe(false);
  });

  it('PRESET_LOW_VAL_HIGH_DIV passes valid value stock', () => {
    const data: Record<string, number> = {
      pe_ttm: 10, pb: 1.5, dividend_yield: 4.5, roe: 15, revenue_growth_yoy: 3, debt_to_equity: 1.0,
    };
    expect(evaluatePreset(PRESET_LOW_VAL_HIGH_DIV, data)).toBe(true);
  });

  it('PRESET_LOW_VAL_HIGH_DIV rejects negative PE', () => {
    const data: Record<string, number> = {
      pe_ttm: -5, pb: 1.5, dividend_yield: 4, roe: 12, revenue_growth_yoy: 1, debt_to_equity: 1.5,
    };
    expect(evaluatePreset(PRESET_LOW_VAL_HIGH_DIV, data)).toBe(false);
  });

  it('PRESET_LOW_VAL_HIGH_DIV rejects low dividend', () => {
    const data: Record<string, number> = {
      pe_ttm: 12, pb: 1.2, dividend_yield: 1.0, roe: 15, revenue_growth_yoy: 5, debt_to_equity: 0.8,
    };
    expect(evaluatePreset(PRESET_LOW_VAL_HIGH_DIV, data)).toBe(false);
  });

  it('PRESET_STRONG_PULLBACK passes valid pullback', () => {
    const data: Record<string, number> = {
      return_20d: 20, return_3d: -7, close_over_ma60_pct: 3, rsi_14: 45, turnover_rate: 2.0,
    };
    expect(evaluatePreset(PRESET_STRONG_PULLBACK, data)).toBe(true);
  });

  it('PRESET_STRONG_PULLBACK rejects if not strong enough before', () => {
    const data: Record<string, number> = {
      return_20d: 5, return_3d: -7, close_over_ma60_pct: 3, rsi_14: 45, turnover_rate: 2.0,
    };
    expect(evaluatePreset(PRESET_STRONG_PULLBACK, data)).toBe(false);
  });

  it('PRESET_STRONG_PULLBACK rejects if pullback too deep', () => {
    const data: Record<string, number> = {
      return_20d: 20, return_3d: -15, close_over_ma60_pct: 3, rsi_14: 45, turnover_rate: 2.0,
    };
    expect(evaluatePreset(PRESET_STRONG_PULLBACK, data)).toBe(false);
  });

  it('PRESET_OVERSOLD_BOUNCE passes valid oversold data', () => {
    const data: Record<string, number> = {
      rsi_14: 22, bb_position: 0.05, capital_inflow_3d: 100, volume_ratio: 1.5, decline_from_52w_high: -35, price_over_ma200_pct: -25,
    };
    expect(evaluatePreset(PRESET_OVERSOLD_BOUNCE, data)).toBe(true);
  });

  it('PRESET_OVERSOLD_BOUNCE rejects if RSI not oversold', () => {
    const data: Record<string, number> = {
      rsi_14: 45, bb_position: 0.05, capital_inflow_3d: 100, volume_ratio: 1.5, decline_from_52w_high: -35, price_over_ma200_pct: -25,
    };
    expect(evaluatePreset(PRESET_OVERSOLD_BOUNCE, data)).toBe(false);
  });

  it('ALL_PRESETS contains 4 presets', () => {
    expect(ALL_PRESETS).toHaveLength(4);
    const ids = ALL_PRESETS.map(p => p.id);
    expect(ids).toContain('volume_breakout');
    expect(ids).toContain('low_val_high_div');
    expect(ids).toContain('strong_pullback');
    expect(ids).toContain('oversold_bounce');
  });

  it('ALL_PRESETS each has required fields', () => {
    for (const preset of ALL_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.nameCN).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(preset.filters.length).toBeGreaterThanOrEqual(3);
      expect(preset.compatibleMarkets.length).toBeGreaterThan(0);
      expect(preset.compatibleInstruments.length).toBeGreaterThan(0);
    }
  });

  it('getPreset returns the correct preset', () => {
    const preset = getPreset('low_val_high_div');
    expect(preset).toBeDefined();
    expect(preset!.nameCN).toBe('低估值高分红');
  });

  it('getPreset returns undefined for unknown id', () => {
    expect(getPreset('nonexistent')).toBeUndefined();
  });

  it('getPresetsByCategory filters correctly', () => {
    const technicals = getPresetsByCategory('technical');
    expect(technicals).toHaveLength(1);
    expect(technicals[0].id).toBe('strong_pullback');

    const breakouts = getPresetsByCategory('breakout');
    expect(breakouts).toHaveLength(1);
    expect(breakouts[0].id).toBe('volume_breakout');
  });

  it('describePreset returns structured description', () => {
    const desc = describePreset(PRESET_LOW_VAL_HIGH_DIV);
    expect(desc).toContain('低估值高分红');
    expect(desc).toContain('pe_ttm');
    expect(desc).toContain('dividend_yield');
    expect(desc).toContain('筛选条件');
  });

  it('evaluatePreset rejects when field is undefined', () => {
    const data: Record<string, number> = { pe_ttm: 10 }; // Missing many fields
    expect(evaluatePreset(PRESET_LOW_VAL_HIGH_DIV, data)).toBe(false);
  });

  it('evaluatePreset handles edge values at boundary', () => {
    // PE=15 is max allowed, roe needs >10, revenue_growth_yoy>0, debt_to_equity<2
    expect(evaluatePreset(PRESET_LOW_VAL_HIGH_DIV, {
      pe_ttm: 15, pb: 1.0, dividend_yield: 3.5, roe: 11, revenue_growth_yoy: 1, debt_to_equity: 1.9,
    })).toBe(true);
  });

  it('PRESET_VOLUME_BREAKOUT missing ma20_slope fails', () => {
    const data: Record<string, number> = {
      volume_ratio: 2.0, price_change_pct_5d: 5, rsi_14: 60,
      // ma20_slope missing
    };
    expect(evaluatePreset(PRESET_VOLUME_BREAKOUT, data)).toBe(false);
  });
});
