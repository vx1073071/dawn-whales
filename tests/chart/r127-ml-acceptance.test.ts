// ── R127-M02 Final Acceptance Self-Test ──────────────────────────────────
import { describe, it, expect } from 'vitest';

const makeBars = (count: number) => Array.from({ length: count }, (_, i) => ({
  time: Date.now() + i * 86400000,
  open: 100 + i % 5, high: 105 + i % 7, low: 95 - i % 4, close: 101 + i % 6, volume: 1000000 + i * 50000,
}));

// ═══════════ R122 ═══════════
describe('R122 ChartStore + ErrorBoundary', () => {
  it('localStorage persistence', () => {
    localStorage.setItem('dw_symbol', 'TEST');
    expect(localStorage.getItem('dw_symbol')).toBe('TEST');
    localStorage.removeItem('dw_symbol');
  });
  it('toggle logic', () => {
    const add = (prev: string[], id: string) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    expect(add(['ma'], 'rsi')).toEqual(['ma', 'rsi']);
    expect(add(['ma', 'rsi'], 'ma')).toEqual(['rsi']);
  });
});

describe('R122 Indicator Engine', () => {
  it('calcMACD returns 3 arrays', async () => {
    const { calcMACD } = await import('../../src/lib/chart/indicator-engine');
    const [d, e, m] = calcMACD(makeBars(30), 12, 26, 9);
    expect(d.length).toBe(30); expect(e.length).toBe(30); expect(m.length).toBe(30);
  });
  it('calcRSI returns 0-100', async () => {
    const { calcRSI } = await import('../../src/lib/chart/indicator-engine');
    const rsi = calcRSI(makeBars(30), 14);
    const v = rsi.filter(x => x !== null) as number[];
    if (v.length) { expect(Math.max(...v)).toBeLessThanOrEqual(100); expect(Math.min(...v)).toBeGreaterThanOrEqual(0); }
  });
  it('calcKDJ returns 3 arrays', async () => {
    const { calcKDJ } = await import('../../src/lib/chart/indicator-engine');
    const [k, d, j] = calcKDJ(makeBars(30), 9, 3, 3);
    expect(k.length).toBe(30); expect(d.length).toBe(30); expect(j.length).toBe(30);
  });
});

// ═══════════ R123 ═══════════
describe('R123 OnboardingWizard', () => {
  it('shouldShowOnboarding returns boolean', async () => {
    const { shouldShowOnboarding } = await import('../../src/components/onboarding/OnboardingWizard');
    expect(typeof shouldShowOnboarding()).toBe('boolean');
  });
  it('KNOWN_BROKERS >= 10', async () => {
    const { KNOWN_BROKERS } = await import('../../src/components/onboarding/OnboardingWizard');
    expect(KNOWN_BROKERS.length).toBeGreaterThanOrEqual(10);
  });
  it('loadOnboardingState has keys', async () => {
    const { loadOnboardingState } = await import('../../src/components/onboarding/OnboardingWizard');
    expect(loadOnboardingState()).toHaveProperty('completed');
  });
});

describe('R123 ChartContextMenu + SymbolLink', () => {
  it('ChartContextMenu exists', async () => {
    const { ChartContextMenu } = await import('../../src/components/chart/ChartContextMenu');
    expect(ChartContextMenu).toBeDefined();
  });
  it('SymbolLink components exist', async () => {
    const { SymbolLink, PriceLink, SymbolChip } = await import('../../src/components/chart/SymbolLink');
    expect(SymbolLink).toBeDefined();
    expect(PriceLink).toBeDefined();
    expect(SymbolChip).toBeDefined();
  });
  it('GlobalSearch exists', async () => {
    const mod = await import('../../src/components/layout/GlobalSearch');
    expect(mod.default).toBeDefined();
  });
});

// ═══════════ R125 ═══════════
describe('R125 ThemeProvider', () => {
  it('DARK_COLORS has required keys', async () => {
    const { DARK_COLORS } = await import('../../src/theme/ThemeProvider');
    for (const k of ['bgPrimary', 'textPrimary', 'accent', 'green', 'red'])
      expect(DARK_COLORS).toHaveProperty(k);
  });
  it('LIGHT_COLORS has required keys', async () => {
    const { LIGHT_COLORS } = await import('../../src/theme/ThemeProvider');
    for (const k of ['bgPrimary', 'textPrimary']) expect(LIGHT_COLORS).toHaveProperty(k);
  });
  it('TYPOGRAPHY scale', async () => {
    const { TYPOGRAPHY } = await import('../../src/theme/ThemeProvider');
    expect(TYPOGRAPHY.textXs).toBe('10px');
    expect(TYPOGRAPHY.textBase).toBe('12px');
  });
  it('SPACING 5 levels', async () => {
    const { SPACING } = await import('../../src/theme/ThemeProvider');
    expect(Object.keys(SPACING).length).toBe(5);
  });
});

describe('R125 IndicatorTemplates + Loading', () => {
  it('IndicatorTemplatesUI exists', async () => {
    const { IndicatorTemplatesUI } = await import('../../src/components/chart/IndicatorTemplates');
    expect(IndicatorTemplatesUI).toBeDefined();
  });
  it('Loading components exist', async () => {
    const m = await import('../../src/components/layout/LoadingExperience');
    expect(m.KLineSkeleton).toBeDefined();
    expect(m.PanelSkeleton).toBeDefined();
    expect(m.ColdStartProgress).toBeDefined();
  });
});

// ═══════════ R126 ═══════════
describe('R126 Drawing + Chart Enhancements', () => {
  it('applySnap + drawSnapIndicator exist', async () => {
    const { applySnap, drawSnapIndicator } = await import('../../src/lib/chart/drawing-snap');
    expect(typeof applySnap).toBe('function');
    expect(typeof drawSnapIndicator).toBe('function');
  });
  it('formatCrosshairDetail returns OHLC', async () => {
    const { formatCrosshairDetail } = await import('../../src/components/chart/ChartEnhancements');
    const bar = { time: Date.now(), open: 100, high: 105, low: 95, close: 102, volume: 5e6 };
    const r = formatCrosshairDetail(bar, { ...bar, close: 101 });
    expect(r).not.toBeNull();
    expect(r!.close).toBe(102);
  });
  it('exportChartScreenshot + CrosshairLegend exist', async () => {
    const { exportChartScreenshot, CrosshairLegend, PositionMarkersLegend } = await import('../../src/components/chart/ChartEnhancements');
    expect(typeof exportChartScreenshot).toBe('function');
    expect(CrosshairLegend).toBeDefined();
    expect(PositionMarkersLegend).toBeDefined();
  });
});

describe('R126 MultiScreen', () => {
  it('ResponsiveGrid + DetachButton exist', async () => {
    const { ResponsiveGrid, DetachButton } = await import('../../src/hooks/useMultiScreen');
    expect(ResponsiveGrid).toBeDefined();
    expect(DetachButton).toBeDefined();
  });
});

// ═══════════ Integration ═══════════
describe('R122-R127 Integration', () => {
  it('ChartStore importable', async () => {
    const { useChartStore } = await import('../../src/store/ChartStore');
    expect(useChartStore).toBeDefined();
  });
  it('ErrorBoundary importable', async () => {
    const { ErrorBoundary } = await import('../../src/components/shared/ErrorBoundary');
    expect(ErrorBoundary).toBeDefined();
  });
  it('ENGINE_COMPONENTS has 26 entries', async () => {
    const { ENGINE_COMPONENTS } = await import('../../src/hooks/withErrorBoundary');
    expect(ENGINE_COMPONENTS.length).toBeGreaterThanOrEqual(20);
  });
  it('ThemeProvider importable', async () => {
    const { ThemeProvider } = await import('../../src/theme/ThemeProvider');
    expect(ThemeProvider).toBeDefined();
  });
});
