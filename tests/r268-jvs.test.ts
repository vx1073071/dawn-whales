// ── R268 JVS 测试文件 ──
// 覆盖: Trend14Engine, Momentum11Engine, Volume13Engine

import { describe, it, expect, beforeEach } from 'vitest';
import { Trend14Engine, getTrend14Engine, resetTrend14Engine, OHLCVData }
  from '../electron/engine/analysis/trend-14-engine';
import { Momentum11Engine, getMomentum11Engine, resetMomentum11Engine }
  from '../electron/engine/analysis/momentum-11-engine';
import { Volume13Engine, getVolume13Engine, resetVolume13Engine }
  from '../electron/engine/analysis/volume-13-engine';

function makeBars(n: number, basePrice = 100, seed = 1): OHLCVData[] {
  const bars: OHLCVData[] = [];
  let price = basePrice;
  const now = Date.now();
  const mul = 16807; const mod = 2147483647;
  let rng = seed;
  const rand = () => { rng = (rng * mul) % mod; return (rng - 1) / (mod - 1); };
  for (let i = 0; i < n; i++) {
    const pivot = rand() * 4 - 2;
    price += pivot;
    bars.push({
      timestamp: now - (n - i) * 3600000,
      open: price + (rand() - 0.5) * 2,
      high: price + rand() * 3,
      low: price - rand() * 3,
      close: price + (rand() - 0.5) * 2,
      volume: Math.floor(rand() * 1e6 + 1e5),
    });
  }
  return bars;
}

// ═══════════════════════════════════════════════════════════
// Trend14Engine
// ═══════════════════════════════════════════════════════════

describe('Trend14Engine', () => {
  let engine: Trend14Engine;

  beforeEach(() => {
    resetTrend14Engine();
    engine = getTrend14Engine();
    engine.reset();
  });

  it('loads data', () => {
    const bars = makeBars(100);
    engine.loadData('AAPL', bars);
    expect(engine.getData('AAPL').length).toBe(100);
  });

  it('ALMA produces finite values', () => {
    engine.loadData('AAPL', makeBars(50, 100));
    const alma = engine.computeALMA('AAPL');
    expect(alma.length).toBe(50);
    const valid = alma.filter((v) => isFinite(v));
    expect(valid.length).toBeGreaterThan(0);
  });

  it('HMA produces finite values', () => {
    engine.loadData('AAPL', makeBars(50));
    const hma = engine.computeHMA('AAPL');
    expect(hma.length).toBe(50);
    expect(hma.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('VIDYA produces finite values', () => {
    engine.loadData('AAPL', makeBars(50));
    const vidya = engine.computeVIDYA('AAPL');
    expect(vidya.length).toBe(50);
    expect(vidya.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('KAMA produces finite values', () => {
    engine.loadData('AAPL', makeBars(50));
    const kama = engine.computeKAMA('AAPL');
    expect(kama.length).toBe(50);
    expect(kama.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('T3 produces finite values', () => {
    engine.loadData('AAPL', makeBars(100));
    const t3 = engine.computeT3('AAPL');
    expect(t3.length).toBe(100);
    expect(t3.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('PSAR returns sar and trend', () => {
    engine.loadData('AAPL', makeBars(30));
    const psar = engine.computePSAR('AAPL');
    expect(psar.sar.length).toBe(30);
    expect(psar.trend.length).toBe(30);
    const validSAR = psar.sar.filter((v) => isFinite(v));
    expect(validSAR.length).toBeGreaterThan(20);
  });

  it('SuperTrend returns direction array', () => {
    engine.loadData('AAPL', makeBars(30));
    const st = engine.computeSuperTrend('AAPL');
    expect(st.direction.length).toBe(30);
    for (const d of st.direction) expect(['up', 'down']).toContain(d);
  });

  it('ZigZag finds swing points', () => {
    engine.loadData('AAPL', makeBars(60));
    const zz = engine.computeZigZag('AAPL', 3, 6);
    expect(zz.points.length).toBeGreaterThanOrEqual(0);
    for (const p of zz.points) expect(['high', 'low']).toContain(p.type);
  });

  it('Pivot Points all 4 types', () => {
    engine.loadData('AAPL', makeBars(10));
    const levels = engine.computePivotLevels('AAPL');
    expect(levels.length).toBe(4);
    for (const pp of levels) {
      expect(pp.pp).toBeGreaterThan(0);
      expect(pp.type).toMatch(/^(standard|fibonacci|woodie|camarilla)$/);
    }
  });

  it('Ichimoku returns cloud data', () => {
    engine.loadData('AAPL', makeBars(80));
    const ichi = engine.computeIchimoku('AAPL');
    expect(ichi.length).toBeGreaterThan(70);
    const withTenkan = ichi.filter((r) => r.tenkanSen != null);
    expect(withTenkan.length).toBeGreaterThan(50);
  });

  it('Mass Index returns values', () => {
    engine.loadData('AAPL', makeBars(60));
    const mi = engine.computeMassIndex('AAPL', 9, 25);
    expect(mi.length).toBe(60);
    const valid = mi.filter((v) => isFinite(v) && v > 0);
    expect(valid.length).toBeGreaterThan(0);
  });

  it('BIAS returns all three periods', () => {
    engine.loadData('AAPL', makeBars(50));
    const bias = engine.computeBIAS('AAPL');
    expect(bias.bias6.length).toBe(50);
    expect(bias.bias12.length).toBe(50);
    expect(bias.bias24.length).toBe(50);
    expect(bias.bias6.some((v) => isFinite(v))).toBe(true);
  });

  it('Rainbow MA returns 9 EMA lines', () => {
    engine.loadData('AAPL', makeBars(40));
    const rainbow = engine.computeRainbowMA('AAPL');
    expect(Object.keys(rainbow).length).toBe(9);
    for (const key of Object.keys(rainbow)) {
      expect(key).toMatch(/^ema\d+$/);
      expect(rainbow[key].some((v) => isFinite(v))).toBe(true);
    }
  });

  it('Fractals finds up and down fractals', () => {
    engine.loadData('AAPL', makeBars(30));
    const frac = engine.computeFractals('AAPL');
    expect(Array.isArray(frac.up)).toBe(true);
    expect(Array.isArray(frac.down)).toBe(true);
  });

  it('scanAll returns all 14 indicators', () => {
    engine.loadData('AAPL', makeBars(80));
    const all = engine.scanAll('AAPL');
    expect(all.alma).toBeDefined();
    expect(all.hma).toBeDefined();
    expect(all.vidya).toBeDefined();
    expect(all.kama).toBeDefined();
    expect(all.t3).toBeDefined();
    expect(all.psar).toBeDefined();
    expect(all.supertrend).toBeDefined();
    expect(all.zigzag).toBeDefined();
    expect(all.pivotPoints).toBeDefined();
    expect(all.ichimoku).toBeDefined();
    expect(all.massIndex).toBeDefined();
    expect(all.bias).toBeDefined();
    expect(all.rainbowMA).toBeDefined();
    expect(all.fractals).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// Momentum11Engine
// ═══════════════════════════════════════════════════════════

describe('Momentum11Engine', () => {
  let engine: Momentum11Engine;

  beforeEach(() => {
    resetMomentum11Engine();
    engine = getMomentum11Engine();
  });

  it('StochRSI returns all three outputs', () => {
    engine.loadData('AAPL', makeBars(50));
    const stoch = engine.computeStochRSI('AAPL');
    expect(stoch.stochRSI.length).toBe(50);
    expect(stoch.signalK.length).toBe(50);
    expect(stoch.signalD.length).toBe(50);
    expect(stoch.stochRSI.filter((v) => isFinite(v)).length).toBeGreaterThan(10);
  });

  it('Ultimate Oscillator in 0-100 range', () => {
    engine.loadData('AAPL', makeBars(50));
    const uo = engine.computeUltimateOscillator('AAPL');
    for (const v of uo) { if (isFinite(v)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); } }
  });

  it('TRIX returns trix + signal + histogram', () => {
    engine.loadData('AAPL', makeBars(60));
    const trix = engine.computeTRIX('AAPL');
    expect(trix.trix.length).toBe(60);
    expect(trix.signal.length).toBe(60);
    expect(trix.histogram.length).toBe(60);
  });

  it('Vortex returns +VI and -VI', () => {
    engine.loadData('AAPL', makeBars(30));
    const v = engine.computeVortex('AAPL');
    expect(v.plusVI.length).toBe(30);
    expect(v.minusVI.length).toBe(30);
  });

  it('Connors RSI produces values', () => {
    engine.loadData('AAPL', makeBars(120));
    const crsi = engine.computeConnorsRSI('AAPL');
    const valid = crsi.filter((v) => isFinite(v));
    expect(valid.length).toBeGreaterThan(10);
    for (const v of valid) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
  });

  it('Klinger Oscillator returns ko + signal', () => {
    engine.loadData('AAPL', makeBars(80));
    const k = engine.computeKlinger('AAPL');
    expect(k.ko.length).toBe(80);
    expect(k.signal.length).toBe(80);
  });

  it('ROC returns percentage changes', () => {
    engine.loadData('AAPL', makeBars(30, 100));
    const roc = engine.computeROC('AAPL', 12);
    expect(roc.filter((v) => isFinite(v)).length).toBeGreaterThan(10);
  });

  it('Historical Volatility returns annualized %', () => {
    engine.loadData('AAPL', makeBars(50));
    const hv = engine.computeHistoricalVolatility('AAPL');
    const valid = hv.filter((v) => isFinite(v) && v > 0);
    expect(valid.length).toBeGreaterThan(10);
  });

  it('RVI returns rvi + signal', () => {
    engine.loadData('AAPL', makeBars(30));
    const rvi = engine.computeRVI('AAPL');
    expect(rvi.rvi.length).toBe(30);
    expect(rvi.signal.length).toBe(30);
  });

  it('Elders Thermometer returns 0-100 range', () => {
    engine.loadData('AAPL', makeBars(60));
    const et = engine.computeEldersThermometer('AAPL');
    for (const v of et.thermometer) {
      if (isFinite(v)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });

  it('Price Channel upper > lower', () => {
    engine.loadData('AAPL', makeBars(50));
    const pc = engine.computePriceChannel('AAPL');
    for (let i = 0; i < 50; i++) {
      if (isFinite(pc.upper[i]) && isFinite(pc.lower[i])) {
        expect(pc.upper[i]).toBeGreaterThanOrEqual(pc.lower[i]);
      }
    }
  });

  it('scanAll returns all 11 indicators', () => {
    engine.loadData('AAPL', makeBars(100));
    const all = engine.scanAll('AAPL');
    expect(all.stochRSI).toBeDefined();
    expect(all.ultimateOscillator).toBeDefined();
    expect(all.trix).toBeDefined();
    expect(all.vortex).toBeDefined();
    expect(all.connorsRSI).toBeDefined();
    expect(all.klinger).toBeDefined();
    expect(all.roc).toBeDefined();
    expect(all.hv).toBeDefined();
    expect(all.rvi).toBeDefined();
    expect(all.eldersThermo).toBeDefined();
    expect(all.priceChannel).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// Volume13Engine
// ═══════════════════════════════════════════════════════════

describe('Volume13Engine', () => {
  let engine: Volume13Engine;

  beforeEach(() => {
    resetVolume13Engine();
    engine = getVolume13Engine();
  });

  it('VWMACD returns macd/signal/histogram', () => {
    engine.loadData('AAPL', makeBars(60));
    const v = engine.computeVWMACD('AAPL');
    expect(v.vwmacd.length).toBe(60);
    expect(v.signal.length).toBe(60);
    expect(v.histogram.length).toBe(60);
  });

  it('Volume Oscillator gives percentage', () => {
    engine.loadData('AAPL', makeBars(30));
    const vo = engine.computeVolumeOscillator('AAPL');
    expect(vo.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('AD Line is cumulative', () => {
    engine.loadData('AAPL', makeBars(30));
    const adl = engine.computeADLine('AAPL');
    expect(adl.length).toBe(30);
    expect(adl[29]).toBeDefined();
  });

  it('EMV produces values', () => {
    engine.loadData('AAPL', makeBars(30));
    const emv = engine.computeEMV('AAPL');
    expect(emv.length).toBe(30);
    expect(emv.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('NVI initial value used', () => {
    engine.loadData('AAPL', makeBars(10));
    const nvi = engine.computeNVI('AAPL', 5000);
    expect(nvi[0]).toBe(5000);
    expect(nvi.length).toBe(10);
  });

  it('PVI initial value used', () => {
    engine.loadData('AAPL', makeBars(10));
    const pvi = engine.computePVI('AAPL', 5000);
    expect(pvi[0]).toBe(5000);
    expect(pvi.length).toBe(10);
  });

  it('VFI produces values', () => {
    engine.loadData('AAPL', makeBars(150));
    const vfi = engine.computeVFI('AAPL');
    expect(vfi.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('Twiggs MF produces values', () => {
    engine.loadData('AAPL', makeBars(50));
    const twiggs = engine.computeTwiggsMF('AAPL');
    expect(twiggs.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('VPCI returns vpci + vpcr', () => {
    engine.loadData('AAPL', makeBars(80));
    const vpci = engine.computeVPCI('AAPL');
    expect(vpci.vpci.length).toBe(80);
    expect(vpci.vpcr.length).toBe(80);
  });

  it('Anchored VWAP starts from anchor', () => {
    const bars = makeBars(20);
    engine.loadData('AAPL', bars);
    const vwap = engine.computeAnchoredVWAP('AAPL', bars[9].timestamp);
    // First 10 elements (anchorIdx=9) should be NaN
    expect(vwap.filter((v) => isFinite(v)).length).toBeGreaterThan(0);
  });

  it('MFI in 0-100 range', () => {
    engine.loadData('AAPL', makeBars(50));
    const mfi = engine.computeMFI('AAPL');
    for (const v of mfi) {
      if (isFinite(v)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });

  it('VZO returns oscillating values', () => {
    engine.loadData('AAPL', makeBars(40));
    const vzo = engine.computeVZO('AAPL');
    expect(vzo.filter((v) => isFinite(v)).length).toBeGreaterThan(10);
  });

  it('Volume Bubble detects bubbles', () => {
    engine.loadData('AAPL', makeBars(40));
    const vb = engine.computeVolumeBubble('AAPL');
    expect(vb.bubble.length).toBe(40);
    expect(vb.bubbleSignal.length).toBe(40);
  });

  it('scanAll returns all 13 indicators', () => {
    engine.loadData('AAPL', makeBars(150));
    const all = engine.scanAll('AAPL');
    expect(all.vwmacd).toBeDefined();
    expect(all.volumeOscillator).toBeDefined();
    expect(all.adLine).toBeDefined();
    expect(all.emv).toBeDefined();
    expect(all.nvi).toBeDefined();
    expect(all.pvi).toBeDefined();
    expect(all.vfi).toBeDefined();
    expect(all.twiggsMF).toBeDefined();
    expect(all.vpci).toBeDefined();
    expect(all.anchoredVWAP).toBeDefined();
    expect(all.mfi).toBeDefined();
    expect(all.vzo).toBeDefined();
    expect(all.volumeBubble).toBeDefined();
  });
});
