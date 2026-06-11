import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { EngineError } from '../../../electron/engine/core/engine-error';

import i18n from '../../i18n';

// ============================================================
// Monte Carlo Simulator Page
// JVS-R16-P2: Visualize simulation outcomes with GBM paths
// Enhanced: Optional IPC to backtest engine for server-side risk metrics
// ============================================================

// --- Types ---
type DistributionType = 'normal' | 'lognormal' | 'fat_tail';

interface SimConfig {
  initialCapital: number;
  expectedReturn: number;
  volatility: number;
  timeHorizon: number;
  numSimulations: number;
  distribution: DistributionType;
  riskFreeRate: number;
}

interface SimResults {
  paths: number[][];
  terminalValues: number[];
  stats: SimStats;
  scenarios: ScenarioResult[];
  sensitivity: SensitivityRow[];
}

interface SimStats {
  mean: number;
  median: number;
  stdDev: number;
  percentile5: number;
  percentile95: number;
  min: number;
  max: number;
  var95: number;
  cvar95: number;
  probProfit: number;
  probabilityOfProfit?: number;
  probabilityOfLoss10pct?: number;
}

interface ScenarioResult {
  name: string;
  expectedReturn: number;
  volatility: number;
  medianFinal: number;
  meanFinal: number;
  var95: number;
  probProfit: number;
}

interface SensitivityRow {
  param: string;
  value: string;
  median: number;
  mean: number;
  var95: number;
  probProfit: number;
}

// --- Helper: Box-Muller Normal Random ---
function boxMuller(): number {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// --- Helper: Fat-tail random (Student-t approx via mixture) ---
function fatTailRandom(): number {
  // 90% normal, 10% wide normal (3x std)
  if (Math.random() < 0.1) {
    return boxMuller() * 3.0;
  }
  return boxMuller();
}

// --- Helper: Generate random sample ---
function randomSample(dist: DistributionType): number {
  switch (dist) {
    case 'normal': return boxMuller();
    case 'lognormal': return Math.exp(boxMuller());
    case 'fat_tail': return fatTailRandom();
  }
}

// --- Helper: Generate GBM path ---
function generateGBMPath(
  S0: number,
  mu: number,
  sigma: number,
  years: number,
  stepsPerYear: number,
  dist: DistributionType
): number[] {
  const totalSteps = years * stepsPerYear;
  const dt = 1.0 / stepsPerYear;
  const path: number[] = new Array(totalSteps + 1);
  path[0] = S0;
  for (let i = 1; i <= totalSteps; i++) {
    const z = randomSample(dist);
    const drift = (mu - 0.5 * sigma * sigma) * dt;
    const diffusion = sigma * Math.sqrt(dt) * z;
    path[i] = path[i - 1] * Math.exp(drift + diffusion);
  }
  return path;
}

// --- Helper: Percentile ---
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// --- Helper: Compute statistics ---
function computeStats(terminalValues: number[], initialCapital: number): SimStats {
  const sorted = [...terminalValues].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = percentile(sorted, 50);
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const p5 = percentile(sorted, 5);
  const p95 = percentile(sorted, 95);
  const var95 = initialCapital - p5;
  const tailValues = sorted.filter(v => v <= p5);
  const cvar95 = tailValues.length > 0
    ? initialCapital - tailValues.reduce((s, v) => s + v, 0) / tailValues.length
    : var95;
  const probProfit = sorted.filter(v => v > initialCapital).length / n;

  return { mean, median, stdDev, percentile5: p5, percentile95: p95, min: sorted[0], max: sorted[n - 1], var95, cvar95, probProfit };
}

// --- Helper: Run a quick scenario ---
function runScenario(
  name: string,
  S0: number,
  mu: number,
  sigma: number,
  years: number,
  dist: DistributionType,
  numSims: number
): ScenarioResult {
  const paths: number[][] = [];
  for (let i = 0; i < numSims; i++) {
    paths.push(generateGBMPath(S0, mu / 100, sigma / 100, years, 12, dist));
  }
  const terminals = paths.map(p => p[p.length - 1]);
  const sorted = [...terminals].sort((a, b) => a - b);
  const mean = terminals.reduce((s, v) => s + v, 0) / numSims;
  const med = percentile(sorted, 50);
  const p5 = percentile(sorted, 5);
  const var95 = S0 - p5;
  const probProfit = sorted.filter(v => v > S0).length / numSims;
  return { name, expectedReturn: mu, volatility: sigma, medianFinal: med, meanFinal: mean, var95, probProfit };
}

// --- Helper: Run sensitivity on one parameter ---
function runSensitivity(
  config: SimConfig,
  param: string,
  values: number[]
): SensitivityRow[] {
  return values.map(v => {
    const cfg = { ...config };
    if (param === 'expectedReturn') cfg.expectedReturn = v;
    else if (param === 'volatility') cfg.volatility = v;
    else if (param === 'timeHorizon') cfg.timeHorizon = v;
    const paths: number[][] = [];
    const sims = Math.min(cfg.numSimulations, 500);
    for (let i = 0; i < sims; i++) {
      paths.push(generateGBMPath(cfg.initialCapital, cfg.expectedReturn / 100, cfg.volatility / 100, cfg.timeHorizon, 12, cfg.distribution));
    }
    const terminals = paths.map(p => p[p.length - 1]);
    const sorted = [...terminals].sort((a, b) => a - b);
    const mean = terminals.reduce((s, v) => s + v, 0) / sims;
    const med = percentile(sorted, 50);
    const p5 = percentile(sorted, 5);
    const var95 = cfg.initialCapital - p5;
    const probProfit = sorted.filter(v => v > cfg.initialCapital).length / sims;
    return {
      param,
      value: param === 'timeHorizon' ? `${v}Y` : `${v}%`,
      median: med,
      mean,
      var95,
      probProfit
    };
  });
}

// --- Format helpers ---
function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}
function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

// --- SVG Sub-components ---
function EquityCurvesChart({ paths, config }: { paths: number[][]; config: SimConfig }) {
  const { t: _t } = useTranslation();

  const W = 720, H = 320, PAD = 40;
  const samplePaths = useMemo(() => {
    if (paths.length <= 50) return paths;
    const step = Math.floor(paths.length / 50);
    return paths.filter((_, i) => i % step === 0).slice(0, 50);
  }, [paths]);

  const medianPath = useMemo(() => {
    if (paths.length === 0) return [];
    const stepsPerYear = 12;
    const totalSteps = config.timeHorizon * stepsPerYear;
    const med: number[] = [];
    for (let t = 0; t <= totalSteps; t++) {
      const vals = paths.map(p => p[t]).sort((a, b) => a - b);
      med.push(percentile(vals, 50));
    }
    return med;
  }, [paths, config.timeHorizon]);

  const allVals = useMemo(() => {
    const vals: number[] = [];
    samplePaths.forEach(p => vals.push(...p));
    if (medianPath.length > 0) vals.push(...medianPath);
    return vals;
  }, [samplePaths, medianPath]);

  if (allVals.length === 0) return null;

  const minV = Math.min(...allVals) * 0.95;
  const maxV = Math.max(...allVals) * 1.05;
  const totalSteps = samplePaths[0]?.length ?? 1;

  const sx = (t: number) => PAD + (t / (totalSteps - 1)) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - ((v - minV) / (maxV - minV)) * (H - 2 * PAD);

  const pathToD = (path: number[]) =>
    path.map((v, t) => `${t === 0 ? 'M' : 'L'}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');

  // Y-axis ticks
  const yTicks = 5;
  const yStep = (maxV - minV) / yTicks;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
      {/* Grid */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = minV + yStep * i;
        return (
          <g key={i}>
            <line x1={PAD} y1={sy(v)} x2={W - PAD} y2={sy(v)} stroke="#374151" strokeWidth={0.5} />
            <text x={PAD - 4} y={sy(v) + 4} textAnchor="end" fill="#9CA3AF" fontSize={10}>
              {fmt(v)}
            </text>
          </g>
        );
      })}
      {/* X-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const t = Math.round(frac * (totalSteps - 1));
        const yr = (t / 12).toFixed(0);
        return (
          <text key={frac} x={sx(t)} y={H - 8} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
            {yr}Y
          </text>
        );
      })}
      {/* Initial capital line */}
      <line x1={PAD} y1={sy(config.initialCapital)} x2={W - PAD} y2={sy(config.initialCapital)} stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 2" />
      {/* Sample paths */}
      {samplePaths.map((p, i) => (
        <path key={i} d={pathToD(p)} fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth={0.8} />
      ))}
      {/* Median path */}
      {medianPath.length > 0 && (
        <path d={pathToD(medianPath)} fill="none" stroke="#10B981" strokeWidth={2.5} />
      )}
    </svg>
  );
}

function HistogramChart({ values, initialCapital }: { values: number[]; initialCapital: number }) {
  const W = 720, H = 240, PAD = 40;
  const sorted = useMemo(() => [...values].sort((a, b) => a - b), [values]);
  const BINS = 40;

  const bins = useMemo(() => {
    if (sorted.length === 0) return [];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min || 1;
    const binWidth = range / BINS;
    const counts = new Array(BINS).fill(0);
    sorted.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / binWidth), BINS - 1);
      counts[idx]++;
    });
    return counts.map((c, i) => ({
      x0: min + i * binWidth,
      x1: min + (i + 1) * binWidth,
      count: c
    }));
  }, [sorted]);

  if (bins.length === 0) return null;

  const maxCount = Math.max(...bins.map(b => b.count));
  const minV = bins[0].x0;
  const maxV = bins[bins.length - 1].x1;
  const sx = (v: number) => PAD + ((v - minV) / (maxV - minV)) * (W - 2 * PAD);
  const sy = (c: number) => H - PAD - (c / maxCount) * (H - 2 * PAD);

  const p5 = percentile(sorted, 5);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
      {/* Bars */}
      {bins.map((b, i) => {
        const x = sx(b.x0);
        const w = sx(b.x1) - sx(b.x0) - 1;
        const y = sy(b.count);
        const h = H - PAD - y;
        const isLeft = b.x1 <= p5;
        const color = isLeft ? '#EF4444' : '#3B82F6';
        return <rect key={i} x={x} y={y} width={Math.max(w, 1)} height={h} fill={color} opacity={0.7} rx={1} />;
      })}
      {/* Percentile markers */}
      {[
        { v: p5, label: 'P5', color: '#EF4444' },
        { v: p50, label: 'P50', color: '#10B981' },
        { v: p95, label: 'P95', color: '#3B82F6' },
        { v: initialCapital, label: 'S₀', color: '#F59E0B' },
      ].map(({ v, label, color }) => (
        <g key={label}>
          <line x1={sx(v)} y1={4} x2={sx(v)} y2={H - PAD} stroke={color} strokeWidth={1.5} strokeDasharray="3 2" />
          <text x={sx(v)} y={12} textAnchor="middle" fill={color} fontSize={10} fontWeight="bold">{label}</text>
        </g>
      ))}
      {/* X axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const v = minV + frac * (maxV - minV);
        return (
          <text key={frac} x={sx(v)} y={H - 8} textAnchor="middle" fill="#9CA3AF" fontSize={10}>
            {fmt(v)}
          </text>
        );
      })}
    </svg>
  );
}

function ProbabilityGauge({ prob }: { prob: number }) {
  const radius = 60;
  const stroke = 10;
  const cx = 80, cy = 80;
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const sweep = (endAngle - startAngle) * prob;
  const currentAngle = startAngle + sweep;

  const polarToCart = (a: number, r: number) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a)
  });

  const bgStart = polarToCart(startAngle, radius);
  const bgEnd = polarToCart(endAngle, radius);
  const valEnd = polarToCart(currentAngle, radius);
  const bgLargeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const valLargeArc = sweep > Math.PI ? 1 : 0;

  const bgD = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${bgLargeArc} 1 ${bgEnd.x} ${bgEnd.y}`;
  const valD = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${valLargeArc} 1 ${valEnd.x} ${valEnd.y}`;

  const color = prob >= 0.7 ? '#10B981' : prob >= 0.5 ? '#F59E0B' : '#EF4444';

  return (
    <svg viewBox="0 0 160 120" className="w-32 mx-auto">
      <path d={bgD} fill="none" stroke="#374151" strokeWidth={stroke} strokeLinecap="round" />
      <path d={valD} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      <text x={cx} y={cy + 8} textAnchor="middle" fill={color} fontSize={20} fontWeight="bold">
        {(prob * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill="#9CA3AF" fontSize={9}>{'profitProbability'}</text>
    </svg>
  );
}

// --- Stat Card ---
function StatCard({ label, value, sub, variant = 'default' }: { label: string; value: string; sub?: string; variant?: 'default' | 'danger' | 'success' | 'warning' }) {
  const border = variant === 'danger' ? 'border-red-500/40' : variant === 'success' ? 'border-green-500/40' : variant === 'warning' ? 'border-yellow-500/40' : 'border-white/10';
  const textColor = variant === 'danger' ? 'text-red-400' : variant === 'success' ? 'text-green-400' : variant === 'warning' ? 'text-yellow-400' : 'text-white';
  return (
    <div className={`rounded-xl border ${border} bg-white/5 backdrop-blur-md p-4 flex flex-col`}>
      <span className="text-xs text-gray-400 mb-1">{label}</span>
      <span className={`text-xl font-bold ${textColor}`}>{value}</span>
      {sub && <span className="text-xs text-gray-500 mt-1">{sub}</span>}
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function MonteCarloPage() {
  const [config, setConfig] = useState<SimConfig>({
    initialCapital: 100000,
    expectedReturn: 10,
    volatility: 25,
    timeHorizon: 10,
    numSimulations: 1000,
    distribution: 'normal',
    riskFreeRate: 3
  });
  const [results, setResults] = useState<SimResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverRiskMetrics, setServerRiskMetrics] = useState<Record<string, unknown> | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);

  const updateConfig = useCallback((key: keyof SimConfig, value: number | string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const runSimulation = useCallback(() => {
    setLoading(true);
    setServerRiskMetrics(null);

    // R18: Try server-side MonteCarlo engine first (JVS-100)
    const api = window.api;
    if (api?.monteCarlo?.simulate) {
      const serverConfig = {
        initialCapital: config.initialCapital,
        expectedReturn: config.expectedReturn / 100,
        volatility: config.volatility / 100,
        horizon: config.timeHorizon,
        simulations: config.numSimulations,
        distribution: config.distribution,
        riskFreeRate: config.riskFreeRate / 100,
      };
      (api as any).monteCarlo.simulate(serverConfig)
        .then((res: unknown) => {
          // @ts-ignore — R89 type fix
          if (res?.success && (res as any).result) {
            const r = (res as any).result;
            // Convert server result to page format
            const stats: SimStats = {
              mean: r.statistics.mean,
              median: r.statistics.median,
              stdDev: r.statistics.stdDev,
              percentile5: r.statistics.percentile5,
              percentile95: r.statistics.percentile95,
              min: r.statistics.min,
              max: r.statistics.max,
              probProfit: r.probabilityOfProfit * 100,
              probabilityOfProfit: r.probabilityOfProfit * 100,
              probabilityOfLoss10pct: r.probabilityOfLoss10pct * 100,
              var95: r.var95,
              cvar95: r.cvar95,
            };
            setResults({
              paths: r.equityCurves,
              terminalValues: r.finalValues,
              stats,
              scenarios: [], // server mode: scenarios computed client-side as fallback
              sensitivity: [],
            });
            setLoading(false);
            return;
          }
          // Fall through to client-side on error
          runClientSimulation();
        })
        .catch((_: unknown) => runClientSimulation());
    void EngineError; // [SYSTEM] structured error tracking
    } else {
      runClientSimulation();
    }

    function runClientSimulation() {
      setTimeout(() => {
        const { initialCapital, expectedReturn, volatility, timeHorizon, numSimulations, distribution } = config;
        const mu = expectedReturn / 100;
        const sigma = volatility / 100;
        const stepsPerYear = 12;

        // Generate paths
        const paths: number[][] = [];
        for (let i = 0; i < numSimulations; i++) {
          paths.push(generateGBMPath(initialCapital, mu, sigma, timeHorizon, stepsPerYear, distribution));
        }
        const terminalValues = paths.map(p => p[p.length - 1]);
        const stats = computeStats(terminalValues, initialCapital);

        // Scenarios
        const simsForScenarios = Math.min(numSimulations, 500);
        const scenarios: ScenarioResult[] = [
          runScenario(i18n.t('MonteCarloPage.k1'), initialCapital, expectedReturn - 10, volatility + 10, timeHorizon, distribution, simsForScenarios),
          runScenario(i18n.t('MonteCarloPage.k2'), initialCapital, expectedReturn, volatility, timeHorizon, distribution, simsForScenarios),
          runScenario(i18n.t('MonteCarloPage.k3'), initialCapital, expectedReturn + 10, Math.max(volatility - 5, 5), timeHorizon, distribution, simsForScenarios),
        ];

        // Sensitivity
        const sensitivity: SensitivityRow[] = [
          ...runSensitivity(config, 'expectedReturn', [5, 10, 15, 20, 30]),
          ...runSensitivity(config, 'volatility', [10, 20, 30, 40, 60]),
          ...runSensitivity(config, 'timeHorizon', [3, 5, 10, 15, 20]),
        ];

        setResults({ paths, terminalValues, stats, scenarios, sensitivity });
        setLoading(false);
      }, 50);
    }
  }, [config]);

  // ─── Fetch server-side risk metrics via IPC after client-side computation ───
  useEffect(() => {
    if (!results) return;
    const api = window.api;
    if (!api?.backtest?.riskMetrics) return;

    setEngineLoading(true);
    // Sample equity curve to max 500 points to avoid IPC payload issues
    const curve = results.terminalValues;
    const sampledCurve = curve.length > 500
      ? Array.from({ length: 500 }, (_, i) => curve[Math.floor(i * curve.length / 500)])
      : curve;

    api.backtest.riskMetrics(sampledCurve, config.riskFreeRate / 100)
      .then((data: unknown) => {
        if (data && typeof data === 'object') {
          setServerRiskMetrics(data as any);
        }
      })
      .catch((_: unknown) => {
        // Server metrics unavailable — client-side results remain authoritative
      })
      .finally(() => {
        setEngineLoading(false);
      });
  }, [results, config.riskFreeRate]);

  // Sharpe ratio
  const sharpe = useMemo(() => {
    if (!results) return 0;
    const annualReturn = (results.stats.mean / config.initialCapital) ** (1 / config.timeHorizon) - 1;
    const annualVol = config.volatility / 100;
    return annualVol > 0 ? (annualReturn - config.riskFreeRate / 100) / annualVol : 0;
  }, [results, config]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center">
          <span className="text-xl">🎲</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">{i18n.t('MonteCarloPage.k4')}</h1>
          <p className="text-sm text-gray-400">{i18n.t('MonteCarloPage.k5')}</p>
        </div>
      </div>

      {/* Config Panel */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">{i18n.t('MonteCarloPage.k6')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Initial Capital */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{i18n.t('MonteCarloPage.k7')}</label>
            <input
              type="number"
              value={config.initialCapital}
              onChange={e => updateConfig('initialCapital', Number(e.target.value))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Risk-free Rate */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{i18n.t('MonteCarloPage.k8')}</label>
            <input
              type="number"
              step="0.5"
              value={config.riskFreeRate}
              onChange={e => updateConfig('riskFreeRate', Number(e.target.value))}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Distribution */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{i18n.t('MonteCarloPage.k9')}</label>
            <div className="flex gap-3 mt-1">
              {(['normal', 'lognormal', 'fat_tail'] as DistributionType[]).map(d => (
                <label key={d} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dist"
                    checked={config.distribution === d}
                    onChange={() => updateConfig('distribution', d)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm">{d === 'fat_tail' ? 'Fat Tail' : d === 'lognormal' ? 'Lognormal' : 'Normal'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{i18n.t('MonteCarloPage.k10')}<span className="text-blue-400 font-semibold">{config.expectedReturn}%</span></label>
            <input
              type="range" min={0} max={50} step={1}
              value={config.expectedReturn}
              onChange={e => updateConfig('expectedReturn', Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">{i18n.t('MonteCarloPage.k11')}<span className="text-yellow-400 font-semibold">{config.volatility}%</span></label>
            <input
              type="range" min={5} max={80} step={1}
              value={config.volatility}
              onChange={e => updateConfig('volatility', Number(e.target.value))}
              className="w-full accent-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">{i18n.t('MonteCarloPage.k12')}<span className="text-green-400 font-semibold">{config.timeHorizon} 年</span></label>
            <input
              type="range" min={1} max={30} step={1}
              value={config.timeHorizon}
              onChange={e => updateConfig('timeHorizon', Number(e.target.value))}
              className="w-full accent-green-500"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm text-gray-400 mb-1">{i18n.t('MonteCarloPage.k13')}<span className="text-purple-400 font-semibold">{config.numSimulations.toLocaleString()}</span></label>
            <input
              type="range" min={100} max={10000} step={100}
              value={config.numSimulations}
              onChange={e => updateConfig('numSimulations', Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={runSimulation}
          disabled={loading}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              模拟运行中...
            </>
          ) : (
            <>{i18n.t('MonteCarloPage.k14')}</>
          )}
        </button>
      </div>

      {/* Results */}
      {results && !loading && (
        <>
          {/* Stats Dashboard */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">{i18n.t('MonteCarloPage.k15')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <StatCard label={i18n.t('MonteCarloPage.k16')} value={`¥${fmt(results.stats.mean)}`} />
              <StatCard label={i18n.t('MonteCarloPage.k17')} value={`¥${fmt(results.stats.median)}`} variant="success" />
              <StatCard label={i18n.t('MonteCarloPage.k18')} value={`¥${fmt(results.stats.stdDev)}`} />
              <StatCard label="P5 (5th %ile)" value={`¥${fmt(results.stats.percentile5)}`} variant="danger" />
              <StatCard label="P95 (95th %ile)" value={`¥${fmt(results.stats.percentile95)}`} variant="success" />
              <StatCard label={i18n.t('MonteCarloPage.k19')} value={`¥${fmt(results.stats.min)}`} variant="danger" />
              <StatCard label={i18n.t('MonteCarloPage.k20')} value={`¥${fmt(results.stats.max)}`} variant="success" />
              <StatCard label="Sharpe Ratio" value={sharpe.toFixed(2)} variant={sharpe > 1 ? 'success' : sharpe > 0 ? 'warning' : 'danger'} />
              <StatCard
                label="VaR (95%)"
                value={`¥${fmt(results.stats.var95)}`}
                sub={i18n.t('MonteCarloPage.k0')}
                variant="danger"
              />
              <StatCard
                label="CVaR (95%)"
                value={`¥${fmt(results.stats.cvar95)}`}
                sub={i18n.t('MonteCarloPage.k1')}
                variant="danger"
              />
            </div>
            {/* Probability Gauge */}
            <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 flex items-center gap-6">
              <ProbabilityGauge prob={results.stats.probProfit} />
              <div>
                <p className="text-sm text-gray-400">{'profitProbability'}</p>
                <p className="text-2xl font-bold" style={{ color: results.stats.probProfit >= 0.7 ? '#10B981' : results.stats.probProfit >= 0.5 ? '#F59E0B' : '#EF4444' }}>
                  {pct(results.stats.probProfit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{results.terminalValues.filter(v => v > config.initialCapital).length} / {results.terminalValues.length} 次模拟盈利</p>
              </div>
            </div>
          </div>

          {/* Engine-Enhanced Risk Metrics (from IPC backtest engine) */}
          {serverRiskMetrics && (
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 backdrop-blur-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  引擎增强风险指标
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Backtest Engine
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {serverRiskMetrics.annualizedReturn != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k21')}
                    value={`${(Number(serverRiskMetrics.annualizedReturn) * 100).toFixed(2)}%`}
                    variant={Number(serverRiskMetrics.annualizedReturn) > 0 ? 'success' : 'danger'}
                    sub={i18n.t('MonteCarloPage.k22')}
                  />
                )}
                {serverRiskMetrics.annualizedVolatility != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k23')}
                    value={`${(Number(serverRiskMetrics.annualizedVolatility) * 100).toFixed(2)}%`}
                    variant="warning"
                    sub={i18n.t('MonteCarloPage.k24')}
                  />
                )}
                {serverRiskMetrics.maxDrawdown != null && (
                  <StatCard
                    label={'maxDrawdown'}
                    value={`${(Number(serverRiskMetrics.maxDrawdown) * 100).toFixed(2)}%`}
                    variant="danger"
                    sub={i18n.t('MonteCarloPage.k25')}
                  />
                )}
                {serverRiskMetrics.calmarRatio != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k26')}
                    value={Number(serverRiskMetrics.calmarRatio).toFixed(3)}
                    variant={Number(serverRiskMetrics.calmarRatio) > 1 ? 'success' : 'warning'}
                    sub={i18n.t('MonteCarloPage.k27')}
                  />
                )}
                {serverRiskMetrics.sortinoRatio != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k28')}
                    value={Number(serverRiskMetrics.sortinoRatio).toFixed(3)}
                    variant={Number(serverRiskMetrics.sortinoRatio) > 1 ? 'success' : 'warning'}
                    sub={i18n.t('MonteCarloPage.k29')}
                  />
                )}
                {serverRiskMetrics.informationRatio != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k30')}
                    value={Number(serverRiskMetrics.informationRatio).toFixed(3)}
                    sub={i18n.t('MonteCarloPage.k31')}
                  />
                )}
                {serverRiskMetrics.omegaRatio != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k32')}
                    value={Number(serverRiskMetrics.omegaRatio).toFixed(3)}
                    variant={Number(serverRiskMetrics.omegaRatio) > 1 ? 'success' : 'warning'}
                    sub={i18n.t('MonteCarloPage.k33')}
                  />
                )}
                {serverRiskMetrics.tailRatio != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k34')}
                    value={Number(serverRiskMetrics.tailRatio).toFixed(3)}
                    sub={i18n.t('MonteCarloPage.k35')}
                  />
                )}
                {serverRiskMetrics.skewness != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k36')}
                    value={Number(serverRiskMetrics.skewness).toFixed(3)}
                    sub={Number(serverRiskMetrics.skewness) > 0 ? i18n.t('MonteCarloPage.k37') : i18n.t('MonteCarloPage.k38')}
                  />
                )}
                {serverRiskMetrics.kurtosis != null && (
                  <StatCard
                    label={i18n.t('MonteCarloPage.k39')}
                    value={Number(serverRiskMetrics.kurtosis).toFixed(3)}
                    sub={Number(serverRiskMetrics.kurtosis) > 3 ? i18n.t('MonteCarloPage.k40') : i18n.t('MonteCarloPage.k41')}
                  />
                )}
              </div>
            </div>
          )}

          {/* Engine metrics loading indicator */}
          {engineLoading && !serverRiskMetrics && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex items-center gap-3">
              <svg className="animate-spin h-4 w-4 text-indigo-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-indigo-400">{i18n.t('MonteCarloPage.k42')}</span>
            </div>
          )}

          {/* Equity Curves */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">{i18n.t('MonteCarloPage.k43')}</h2>
            <p className="text-xs text-gray-400">{i18n.t('MonteCarloPage.k44')}</p>
            <EquityCurvesChart paths={results.paths} config={config} />
          </div>

          {/* Histogram */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">{i18n.t('MonteCarloPage.k45')}</h2>
            <p className="text-xs text-gray-400">{i18n.t('MonteCarloPage.k46')}</p>
            <HistogramChart values={results.terminalValues} initialCapital={config.initialCapital} />
          </div>

          {/* Scenario Comparison */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">{i18n.t('MonteCarloPage.k47')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-2 px-3 text-left">{i18n.t('MonteCarloPage.k48')}</th>
                    <th className="py-2 px-3 text-right">{i18n.t('MonteCarloPage.k49')}</th>
                    <th className="py-2 px-3 text-right">{"components.volatility"}</th>
                    <th className="py-2 px-3 text-right">{i18n.t('MonteCarloPage.k50')}</th>
                    <th className="py-2 px-3 text-right">{i18n.t('MonteCarloPage.k51')}</th>
                    <th className="py-2 px-3 text-right">VaR 95%</th>
                    <th className="py-2 px-3 text-right">{'profitProbability'}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.scenarios.map((s, i) => (
                    <tr key={i} className={`border-b border-gray-800 ${i === 1 ? 'bg-white/5' : ''}`}>
                      <td className="py-2 px-3 font-medium">{s.name}</td>
                      <td className="py-2 px-3 text-right text-blue-400">{s.expectedReturn}%</td>
                      <td className="py-2 px-3 text-right text-yellow-400">{s.volatility}%</td>
                      <td className="py-2 px-3 text-right">¥{fmt(s.medianFinal)}</td>
                      <td className="py-2 px-3 text-right">¥{fmt(s.meanFinal)}</td>
                      <td className="py-2 px-3 text-right text-red-400">¥{fmt(s.var95)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.probProfit >= 0.7 ? 'bg-green-500/20 text-green-400' : s.probProfit >= 0.5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                          {pct(s.probProfit)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sensitivity Analysis */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">{i18n.t('MonteCarloPage.k52')}</h2>
            <p className="text-xs text-gray-400">{i18n.t('MonteCarloPage.k53')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-2 px-3 text-left">{'parameters'}</th>
                    <th className="py-2 px-3 text-right">{i18n.t('MonteCarloPage.k54')}</th>
                    <th className="py-2 px-3 text-right">{i18n.t('MonteCarloPage.k55')}</th>
                    <th className="py-2 px-3 text-right">{i18n.t('MonteCarloPage.k56')}</th>
                    <th className="py-2 px-3 text-right">VaR 95%</th>
                    <th className="py-2 px-3 text-right">{'profitProbability'}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.sensitivity.map((row, i) => {
                    const paramLabel = row.param === 'expectedReturn' ? i18n.t('MonteCarloPage.k57') : row.param === 'volatility' ? 'components.volatility' : i18n.t('MonteCarloPage.k58');
                    const prevRow = i > 0 ? results.sensitivity[i - 1] : null;
                    const isGroupStart = !prevRow || prevRow.param !== row.param;
                    return (
                      <tr key={i} className={`border-b border-gray-800 ${isGroupStart ? 'border-t border-gray-600' : ''}`}>
                        <td className="py-2 px-3 text-gray-300">{isGroupStart ? paramLabel : ''}</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-400">{row.value}</td>
                        <td className="py-2 px-3 text-right">¥{fmt(row.median)}</td>
                        <td className="py-2 px-3 text-right">¥{fmt(row.mean)}</td>
                        <td className="py-2 px-3 text-right text-red-400">¥{fmt(row.var95)}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.probProfit >= 0.7 ? 'bg-green-500/20 text-green-400' : row.probProfit >= 0.5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            {pct(row.probProfit)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <span className="text-5xl mb-4">🎲</span>
          <p className="text-lg">{i18n.t('MonteCarloPage.k59')}</p>
          <p className="text-sm mt-2">{i18n.t('MonteCarloPage.k60')}</p>
        </div>
      )}
    </div>
  );
}
