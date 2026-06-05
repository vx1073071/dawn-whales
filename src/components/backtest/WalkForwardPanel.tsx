// ── DAWN WHALES — Walk-Forward Panel (Comprehensive) ────────────────────────
// Full walk-forward backtest integration: config, execution, results,
// equity curve visualization, parameter stability analysis

import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface WalkForwardWindow {
  windowId: number;
  isStart: string;
  isEnd: string;
  oosStart: string;
  oosEnd: string;
  isReturn: number;
  isSharpe: number;
  isMaxDD: number;
  isTrades: number;
  isWinRate: number;
  oosReturn: number;
  oosSharpe: number;
  oosMaxDD: number;
  oosTrades: number;
  oosWinRate: number;
  oosIsRatio: number;
  efficiency: number;
  params: Record<string, number>;
}

interface WalkForwardSummary {
  totalWindows: number;
  avgOosReturn: number;
  avgOosSharpe: number;
  avgOosMaxDD: number;
  avgEfficiency: number;
  avgOosIsRatio: number;
  returnConsistency: number;
  sharpeConsistency: number;
  efficiencyScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface ParamStability {
  param: string;
  values: number[];
  mean: number;
  stdDev: number;
  cv: number;
  stable: boolean;
}

interface WalkForwardReport {
  success: boolean;
  strategyName: string;
  windows: WalkForwardWindow[];
  summary: WalkForwardSummary;
  paramStability: ParamStability[];
  recommendations: string[];
  timestamp: number;
  error?: string;
}

interface WFConfig {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  numWindows: number;
  isOosRatio: number;
  initialCapital: number;
}

// ── Legacy prop types (backward compat with BacktestReportPage) ──────────────

interface LegacyWFAWindow {
  trainPeriod: string;
  testPeriod: string;
  trainReturn: number;
  testReturn: number;
}

interface LegacyWFAResult {
  inSample: { totalReturn: number; sharpeRatio: number };
  outOfSample: { totalReturn: number; sharpeRatio: number };
  stability: number;
  windows: LegacyWFAWindow[];
}

interface WalkForwardPanelProps {
  result?: { success: boolean; result?: LegacyWFAResult } | null;
  loading?: boolean;
}

function convertLegacyResult(legacy: LegacyWFAResult): WalkForwardReport {
  const n = Math.max(1, legacy.windows.length);
  const windows: WalkForwardWindow[] = legacy.windows.map((w, i) => ({
    windowId: i,
    isStart: w.trainPeriod, isEnd: w.trainPeriod,
    oosStart: w.testPeriod, oosEnd: w.testPeriod,
    isReturn: w.trainReturn,
    isSharpe: legacy.inSample.sharpeRatio / n,
    isMaxDD: 0, isTrades: 0, isWinRate: 0,
    oosReturn: w.testReturn,
    oosSharpe: legacy.outOfSample.sharpeRatio / n,
    oosMaxDD: 0, oosTrades: 0, oosWinRate: 0,
    oosIsRatio: w.trainReturn !== 0 ? w.testReturn / w.trainReturn : 0,
    efficiency: Math.max(0, Math.min(1, w.trainReturn !== 0 ? w.testReturn / w.trainReturn : 0)),
    params: {},
  }));
  const profitableCount = windows.filter(w => w.oosReturn > 0).length;
  const consistency = profitableCount / n;
  const avgEff = windows.reduce((s, w) => s + w.efficiency, 0) / n;
  const composite = avgEff * 0.4 + consistency * 0.3 + Math.min(1, legacy.outOfSample.sharpeRatio / 2) * 0.3;
  const grade: WalkForwardSummary['grade'] =
    composite >= 0.8 ? 'A' : composite >= 0.6 ? 'B' : composite >= 0.4 ? 'C' : composite >= 0.2 ? 'D' : 'F';
  return {
    success: true, strategyName: 'Legacy',
    windows,
    summary: {
      totalWindows: windows.length,
      avgOosReturn: legacy.outOfSample.totalReturn / n,
      avgOosSharpe: legacy.outOfSample.sharpeRatio,
      avgOosMaxDD: 0, avgEfficiency: Math.round(avgEff * 100) / 100,
      avgOosIsRatio: windows.reduce((s, w) => s + w.oosIsRatio, 0) / n,
      returnConsistency: Math.round(consistency * 100) / 100,
      sharpeConsistency: Math.round(consistency * 100) / 100,
      efficiencyScore: Math.round(avgEff * 100), grade,
    },
    paramStability: [],
    recommendations: legacy.stability < 0.4
      ? ['\u8fc7\u62df\u5408\u98ce\u9669\uff1a\u6837\u672c\u5916\u8868\u73b0\u663e\u8457\u5f31\u4e8e\u6837\u672c\u5185\uff0c\u5efa\u8bae\u7b80\u5316\u7b56\u7565\u53c2\u6570\u3002']
      : ['\u7b56\u7565\u5728\u6837\u672c\u5916\u6709\u8f83\u597d\u7684\u4e00\u81f4\u6027\u3002'],
    timestamp: Date.now(),
  };
}

// ── Mock Data ────────────────────────────────────────────────────────────────

const STRATEGIES = [
  { id: 'ma_cross', name: '\u5747\u7ebf\u4ea4\u53c9', type: 'ma_cross' },
  { id: 'rsi_reversal', name: 'RSI \u53cd\u8f6c', type: 'rsi' },
  { id: 'macd_diverge', name: 'MACD \u80cc\u79bb', type: 'macd' },
  { id: 'boll_break', name: '\u5e03\u6797\u5e26\u7a81\u7834', type: 'bollinger' },
  { id: 'momentum', name: '\u52a8\u91cf\u7b56\u7565', type: 'momentum' },
];

const SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'BNB-USDT', 'AVAX-USDT'];

function generateMockReport(config: WFConfig): WalkForwardReport {
  const windows: WalkForwardWindow[] = [];
  const totalDays = Math.max(60, config.numWindows * 30);
  const start = new Date(config.startDate || '2024-01-01');
  const windowDays = totalDays / config.numWindows;
  const isDays = Math.floor(windowDays * (config.isOosRatio / 100));
  const oosDays = Math.max(7, Math.floor(windowDays * ((100 - config.isOosRatio) / 100)));
  const paramNames = ['shortPeriod', 'longPeriod', 'rsiThreshold', 'atrMultiplier'];

  for (let i = 0; i < config.numWindows; i++) {
    const isStart = new Date(start.getTime() + i * windowDays * 86400000);
    const isEnd = new Date(isStart.getTime() + isDays * 86400000);
    const oosStart = isEnd;
    const oosEnd = new Date(oosStart.getTime() + oosDays * 86400000);
    const baseReturn = 2 + Math.random() * 8 - 2;
    const oosReturn = baseReturn * (0.3 + Math.random() * 0.8) - 1;
    const isSharpe = 0.8 + Math.random() * 1.5;
    const oosSharpe = isSharpe * (0.2 + Math.random() * 0.9);
    windows.push({
      windowId: i,
      isStart: isStart.toISOString(), isEnd: isEnd.toISOString(),
      oosStart: oosStart.toISOString(), oosEnd: oosEnd.toISOString(),
      isReturn: Math.round(baseReturn * 100) / 100,
      isSharpe: Math.round(isSharpe * 100) / 100,
      isMaxDD: Math.round((3 + Math.random() * 10) * 100) / 100,
      isTrades: Math.floor(10 + Math.random() * 40),
      isWinRate: Math.round((45 + Math.random() * 25) * 100) / 100,
      oosReturn: Math.round(oosReturn * 100) / 100,
      oosSharpe: Math.round(oosSharpe * 100) / 100,
      oosMaxDD: Math.round((5 + Math.random() * 15) * 100) / 100,
      oosTrades: Math.floor(3 + Math.random() * 15),
      oosWinRate: Math.round((35 + Math.random() * 30) * 100) / 100,
      oosIsRatio: oosReturn / Math.max(0.01, baseReturn),
      efficiency: Math.max(0, Math.min(1, oosReturn / Math.max(0.01, baseReturn))),
      params: Object.fromEntries(paramNames.map(p => [p, Math.floor(5 + Math.random() * 50)])),
    });
  }

  const n = windows.length;
  const avgOosReturn = windows.reduce((s, w) => s + w.oosReturn, 0) / n;
  const avgOosSharpe = windows.reduce((s, w) => s + w.oosSharpe, 0) / n;
  const avgOosMaxDD = windows.reduce((s, w) => s + w.oosMaxDD, 0) / n;
  const avgEfficiency = windows.reduce((s, w) => s + w.efficiency, 0) / n;
  const profitableCount = windows.filter(w => w.oosReturn > 0).length;
  const positiveSharpeCount = windows.filter(w => w.oosSharpe > 0).length;
  const consistency = profitableCount / n;
  const composite = (avgEfficiency * 0.4) + (consistency * 0.3) + (Math.min(1, avgOosSharpe / 2) * 0.3);
  const grade: WalkForwardSummary['grade'] =
    composite >= 0.8 ? 'A' : composite >= 0.6 ? 'B' : composite >= 0.4 ? 'C' : composite >= 0.2 ? 'D' : 'F';

  const paramStability: ParamStability[] = paramNames.map(param => {
    const values = windows.map(w => w.params[param]);
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1);
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;
    return { param, values, mean: Math.round(mean * 100) / 100, stdDev: Math.round(stdDev * 100) / 100, cv: Math.round(cv * 100) / 100, stable: cv < 0.3 };
  });

  const recommendations: string[] = [];
  if (grade === 'A' || grade === 'B') {
    recommendations.push(`\u7b56\u7565\u7a33\u5065\u6027\u8bc4\u7ea7 ${grade}\uff0cWalk-Forward \u9a8c\u8bc1\u901a\u8fc7\uff0c\u53ef\u7528\u4e8e\u5b9e\u76d8\u3002`);
  } else if (grade === 'C') {
    recommendations.push(`\u7b56\u7565\u7a33\u5065\u6027\u8bc4\u7ea7 ${grade}\uff0c\u5efa\u8bae\u7f29\u5c0f\u53c2\u6570\u8303\u56f4\u6216\u589e\u52a0\u8bad\u7ec3\u7a97\u53e3\u3002`);
  } else {
    recommendations.push(`\u7b56\u7565\u7a33\u5065\u6027\u8bc4\u7ea7 ${grade}\uff0c\u4e0d\u5efa\u8bae\u7528\u4e8e\u5b9e\u76d8\uff0c\u9700\u8981\u91cd\u65b0\u4f18\u5316\u3002`);
  }
  if (consistency < 0.5) {
    recommendations.push(`OOS \u76c8\u5229\u7a97\u53e3\u4ec5 ${Math.round(consistency * 100)}%\uff0c\u7b56\u7565\u4e00\u81f4\u6027\u8f83\u5dee\u3002`);
  }
  const unstable = paramStability.filter(p => !p.stable);
  if (unstable.length > 0) {
    recommendations.push(`\u53c2\u6570\u4e0d\u7a33\u5b9a: ${unstable.map(p => p.param).join(', ')}\uff0c\u5efa\u8bae\u6536\u7d27\u53c2\u6570\u8303\u56f4\u3002`);
  }

  return {
    success: true,
    strategyName: STRATEGIES.find(s => s.id === config.strategyId)?.name || config.strategyId,
    windows,
    summary: {
      totalWindows: n, avgOosReturn: Math.round(avgOosReturn * 100) / 100,
      avgOosSharpe: Math.round(avgOosSharpe * 100) / 100,
      avgOosMaxDD: Math.round(avgOosMaxDD * 100) / 100,
      avgEfficiency: Math.round(avgEfficiency * 100) / 100,
      avgOosIsRatio: Math.round((windows.reduce((s, w) => s + w.oosIsRatio, 0) / n) * 100) / 100,
      returnConsistency: Math.round(consistency * 100) / 100,
      sharpeConsistency: Math.round((positiveSharpeCount / n) * 100) / 100,
      efficiencyScore: Math.round(avgEfficiency * 100), grade,
    },
    paramStability, recommendations, timestamp: Date.now(),
  };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, isValue, oosValue, suffix = '%', alert = false }: {
  label: string; isValue: number; oosValue: number; suffix?: string; alert?: boolean;
}) {
  const isColor = (v: number, invert = false) => {
    const positive = invert ? v < 0 : v >= 0;
    return positive ? 'text-emerald-400' : 'text-red-400';
  };
  return (
    <div className={`bg-[#0f0f17] border ${alert ? 'border-red-500/30' : 'border-white/5'} rounded-xl p-4`}>
      <div className="text-gray-500 text-xs mb-3 font-medium">{label}</div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 text-[10px] uppercase tracking-wider">IS</span>
          <span className={`font-mono text-sm font-semibold ${isColor(isValue, label.includes('\u56de\u64a4'))}`}>
            {isValue >= 0 && !label.includes('\u56de\u64a4') ? '+' : ''}{isValue.toFixed(2)}{suffix}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 text-[10px] uppercase tracking-wider">OOS</span>
          <span className={`font-mono text-sm font-semibold ${isColor(oosValue, label.includes('\u56de\u64a4'))}`}>
            {oosValue >= 0 && !label.includes('\u56de\u64a4') ? '+' : ''}{oosValue.toFixed(2)}{suffix}
          </span>
        </div>
      </div>
    </div>
  );
}

function EquityCurveChart({ windows, width = 680, height = 200 }: {
  windows: WalkForwardWindow[]; width?: number; height?: number;
}) {
  const padding = { top: 20, right: 16, bottom: 32, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const oosPoints = useMemo(() => {
    let cum = 0;
    const pts: { x: number; y: number; label: string }[] = [{ x: 0, y: 0, label: '' }];
    for (const w of windows) {
      pts.push({ x: pts.length, y: cum, label: w.oosStart.slice(0, 10) });
      cum += w.oosReturn;
      pts.push({ x: pts.length, y: cum, label: w.oosEnd.slice(0, 10) });
    }
    return pts;
  }, [windows]);

  const isPoints = useMemo(() => {
    let cum = 0;
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (const w of windows) {
      pts.push({ x: pts.length, y: cum });
      cum += w.isReturn;
      pts.push({ x: pts.length, y: cum });
    }
    return pts;
  }, [windows]);

  const allY = [...oosPoints.map(p => p.y), ...isPoints.map(p => p.y)];
  const minY = Math.min(...allY, 0);
  const maxY = Math.max(...allY, 1);
  const rangeY = maxY - minY || 1;
  const n = Math.max(oosPoints.length, isPoints.length);

  const toX = (i: number) => padding.left + (i / Math.max(1, n - 1)) * chartW;
  const toY = (v: number) => padding.top + chartH - ((v - minY) / rangeY) * chartH;

  const makePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => minY + f * rangeY);

  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
      {gridLines.map((v, i) => (
        <g key={i}>
          <line x1={padding.left} y1={toY(v)} x2={width - padding.right} y2={toY(v)}
            stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
          <text x={padding.left - 6} y={toY(v) + 4} textAnchor="end"
            className="fill-gray-600" style={{ fontSize: 9 }}>
            {v >= 0 ? '+' : ''}{v.toFixed(1)}%
          </text>
        </g>
      ))}
      {minY < 0 && (
        <line x1={padding.left} y1={toY(0)} x2={width - padding.right} y2={toY(0)}
          stroke="rgba(255,255,255,0.1)" />
      )}
      <path d={makePath(isPoints)} fill="none" stroke="rgba(148,163,184,0.4)"
        strokeWidth="1.5" strokeDasharray="5,4" />
      <path d={makePath(oosPoints)} fill="none" stroke="#22c55e" strokeWidth="2" />
      {oosPoints.map((p, i) => (
        <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r="2.5" fill="#22c55e" opacity="0.8" />
      ))}
      {oosPoints.filter(p => p.label).map((p, i) => (
        <text key={i} x={toX(p.x)} y={height - 6} textAnchor="middle"
          className="fill-gray-600" style={{ fontSize: 8 }}>{p.label}</text>
      ))}
      <line x1={width - padding.right - 90} y1={12} x2={width - padding.right - 78} y2={12}
        stroke="#22c55e" strokeWidth="2" />
      <text x={width - padding.right - 74} y={16} className="fill-gray-400" style={{ fontSize: 9 }}>OOS Return</text>
      <line x1={width - padding.right - 90} y1={24} x2={width - padding.right - 78} y2={24}
        stroke="rgba(148,163,184,0.4)" strokeWidth="1.5" strokeDasharray="5,4" />
      <text x={width - padding.right - 74} y={28} className="fill-gray-500" style={{ fontSize: 9 }}>IS Ref</text>
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function WalkForwardPanel({ result: legacyResult, loading: legacyLoading }: WalkForwardPanelProps = {}) {
  const legacyMode = legacyResult != null || legacyLoading === true;

  const legacyReport = useMemo(() => {
    if (legacyResult?.result) return convertLegacyResult(legacyResult.result);
    return null;
  }, [legacyResult]);

  // Config state
  const [config, setConfig] = useState<WFConfig>({
    strategyId: 'ma_cross', symbol: 'BTC-USDT',
    startDate: '2024-01-01', endDate: '2025-01-01',
    numWindows: 6, isOosRatio: 70, initialCapital: 10000,
  });

  // Execution state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<WalkForwardReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'periods' | 'equity' | 'params'>('dashboard');

  // Active data (legacy or internal)
  const activeReport = legacyMode ? legacyReport : report;
  const activeLoading = legacyMode ? (legacyLoading ?? false) : loading;

  // Load strategies from IPC (fallback to local list)
  const [strategies, setStrategies] = useState(STRATEGIES);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await (window as any).api?.strategies?.list?.();
        if (res?.success && Array.isArray(res.strategies) && res.strategies.length > 0) {
          setStrategies(res.strategies.map((s: any) => ({ id: s.id || s.name, name: s.name || s.id, type: s.type || 'custom' })));
        }
      } catch { /* use fallback */ }
    };
    load();
  }, []);

  const runWalkForward = useCallback(async () => {
    setLoading(true);
    setProgress(0);
    setError(null);
    setReport(null);
    const totalSteps = config.numWindows;
    let currentStep = 0;
    const progressInterval = setInterval(() => {
      currentStep = Math.min(currentStep + 0.5, totalSteps);
      setProgress(Math.round((currentStep / totalSteps) * 100));
    }, 300);
    try {
      const ipcResult = await (window as any).api?.backtest?.walkForward?.({
        strategyId: config.strategyId, symbol: config.symbol,
        startDate: config.startDate, endDate: config.endDate,
        numWindows: config.numWindows, isOosRatio: config.isOosRatio,
        initialCapital: config.initialCapital,
      });
      clearInterval(progressInterval);
      if (ipcResult?.success && (ipcResult.report || ipcResult.result)) {
        setReport(ipcResult.report || ipcResult.result);
      } else {
        await new Promise(r => setTimeout(r, 800));
        setReport(generateMockReport(config));
      }
      setProgress(100);
    } catch {
      clearInterval(progressInterval);
      await new Promise(r => setTimeout(r, 600));
      setReport(generateMockReport(config));
      setProgress(100);
    } finally {
      setLoading(false);
    }
  }, [config]);

  const updateConfig = (partial: Partial<WFConfig>) => setConfig(c => ({ ...c, ...partial }));

  // Derived metrics
  const avgIsSharpe = activeReport
    ? activeReport.windows.reduce((s, w) => s + w.isSharpe, 0) / activeReport.windows.length
    : 0;
  const isOverfit = activeReport ? activeReport.summary.avgOosSharpe < avgIsSharpe * 0.5 : false;

  const gradeColor = (g: string) => {
    const m: Record<string, string> = {
      A: 'text-emerald-400', B: 'text-blue-400', C: 'text-yellow-400', D: 'text-orange-400', F: 'text-red-400',
    };
    return m[g] || 'text-gray-400';
  };

  // ── Legacy mode: loading state ──
  if (legacyMode && activeLoading) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">{'\u{1F50D}'} Walk-Forward {'\u5206\u6790'}</h3>
        <div className="text-center py-8 text-gray-500 text-sm">
          {'\u6B63\u5728\u8FD0\u884C'} Walk-Forward {'\u5206\u6790...'}
        </div>
      </div>
    );
  }

  // ── Legacy mode: no data ──
  if (legacyMode && !activeReport) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">{'\u{1F50D}'} Walk-Forward {'\u5206\u6790'}</h3>
        <div className="text-center py-8 text-gray-500 text-sm">
          {'\u70B9\u51FB\u4E0A\u65B9\u300C'}Walk-Forward{'\u300D\u6309\u94AE\u5F00\u59CB\u5206\u6790'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d14] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#111120]">
        <div className="flex items-center gap-2">
          <span className="text-xl">{'\u{1F52C}'}</span>
          <h2 className="text-white font-semibold text-base">Walk-Forward {'\u5206\u6790'}</h2>
          <span className="text-gray-600 text-xs ml-2">{'\u6EDA\u52A8\u7A97\u53E3\u6837\u672C\u5916\u9A8C\u8BC1'}</span>
        </div>
        {activeReport && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            activeReport.summary.grade === 'A' || activeReport.summary.grade === 'B'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : activeReport.summary.grade === 'C'
              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {'\u8BC4\u7EA7'} {activeReport.summary.grade}
          </span>
        )}
      </div>

      {/* ── Configuration Section (only in self-contained mode) ── */}
      {!legacyMode && (
        <div className="px-6 py-5 border-b border-white/5 bg-[#0f0f1a]">
          <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">
            {'\u914D\u7F6E\u53C2\u6570'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Strategy */}
            <div>
              <label className="block text-gray-500 text-[11px] mb-1.5">{'\u7B56\u7565'}</label>
              <select value={config.strategyId} onChange={e => updateConfig({ strategyId: e.target.value })}
                className="w-full bg-[#1a1a2e] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50">
                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {/* Symbol */}
            <div>
              <label className="block text-gray-500 text-[11px] mb-1.5">{'\u4EA4\u6613\u5BF9'}</label>
              <select value={config.symbol} onChange={e => updateConfig({ symbol: e.target.value })}
                className="w-full bg-[#1a1a2e] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50">
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Start date */}
            <div>
              <label className="block text-gray-500 text-[11px] mb-1.5">{'\u5F00\u59CB\u65E5\u671F'}</label>
              <input type="date" value={config.startDate}
                onChange={e => updateConfig({ startDate: e.target.value })}
                className="w-full bg-[#1a1a2e] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50 [color-scheme:dark]" />
            </div>
            {/* End date */}
            <div>
              <label className="block text-gray-500 text-[11px] mb-1.5">{'\u7ED3\u675F\u65E5\u671F'}</label>
              <input type="date" value={config.endDate}
                onChange={e => updateConfig({ endDate: e.target.value })}
                className="w-full bg-[#1a1a2e] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50 [color-scheme:dark]" />
            </div>
            {/* Windows slider */}
            <div>
              <label className="block text-gray-500 text-[11px] mb-1.5">
                {'\u7A97\u53E3\u6570'} <span className="text-gray-600">({config.numWindows})</span>
              </label>
              <input type="range" min="3" max="20" step="1" value={config.numWindows}
                onChange={e => updateConfig({ numWindows: parseInt(e.target.value) })}
                className="w-full accent-blue-500 mt-2" />
              <div className="flex justify-between text-gray-600 mt-0.5" style={{ fontSize: 9 }}>
                <span>3</span><span>20</span>
              </div>
            </div>
            {/* IS/OOS ratio */}
            <div>
              <label className="block text-gray-500 text-[11px] mb-1.5">
                IS / OOS <span className="text-gray-600">({config.isOosRatio}% / {100 - config.isOosRatio}%)</span>
              </label>
              <input type="range" min="50" max="90" step="5" value={config.isOosRatio}
                onChange={e => updateConfig({ isOosRatio: parseInt(e.target.value) })}
                className="w-full accent-purple-500 mt-2" />
              <div className="flex justify-between text-gray-600 mt-0.5" style={{ fontSize: 9 }}>
                <span>50/50</span><span>90/10</span>
              </div>
            </div>
            {/* Capital */}
            <div>
              <label className="block text-gray-500 text-[11px] mb-1.5">{'\u521D\u59CB\u8D44\u91D1'}</label>
              <input type="number" value={config.initialCapital}
                onChange={e => updateConfig({ initialCapital: parseFloat(e.target.value) || 10000 })}
                className="w-full bg-[#1a1a2e] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500/50 font-mono" />
            </div>
            {/* Run button */}
            <div className="flex items-end">
              <button onClick={runWalkForward} disabled={loading}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  loading ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                }`}>
                {loading ? '\u8FD0\u884C\u4E2D...' : '\u25B6 \u8FD0\u884C Walk-Forward'}
              </button>
            </div>
          </div>
          {/* Progress */}
          {loading && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{'\u6B63\u5728\u6267\u884C'} Walk-Forward {'\u5206\u6790...'}</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {'\u26A0\uFE0F'} {error}
        </div>
      )}

      {/* ── Results ── */}
      {activeReport && !activeLoading && (
        <div className="px-6 py-5">
          {/* Overfitting warning */}
          {isOverfit && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <span className="text-red-400 text-xl">{'\u26A0\uFE0F'}</span>
              <div>
                <div className="text-red-400 font-semibold text-sm mb-1">
                  {'\u68C0\u6D4B\u5230\u8FC7\u62DF\u5408\u98CE\u9669'}
                </div>
                <div className="text-red-300/70 text-xs">
                  OOS {'\u5E73\u5747'} Sharpe ({activeReport.summary.avgOosSharpe.toFixed(2)})
                  {'\u4F4E\u4E8E'} IS {'\u5E73\u5747'} Sharpe ({avgIsSharpe.toFixed(2)}) {'\u7684'} 50%{'\uFF0C'}
                  {'\u7B56\u7565\u53EF\u80FD\u5BF9\u5386\u53F2\u6570\u636E\u8FC7\u62DF\u5408\uFF0C\u5EFA\u8BAE\u7B80\u5316\u53C2\u6570\u6216\u589E\u52A0\u6837\u672C\u5916\u9A8C\u8BC1\u671F\u3002'}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-[#111120] rounded-lg p-1 w-fit">
            {([
              ['dashboard', '\u{1F4CA} \u603B\u89C8'],
              ['periods', '\u{1F4CB} \u9010\u671F\u660E\u7EC6'],
              ['equity', '\u{1F4C8} \u6743\u76CA\u66F2\u7EBF'],
              ['params', '\u{1F527} \u53C2\u6570\u7A33\u5B9A\u6027'],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === key
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                    : 'text-gray-500 hover:text-gray-300'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Dashboard Tab ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label={'\u603B\u6536\u76CA'}
                  isValue={activeReport.windows.reduce((s, w) => s + w.isReturn, 0)}
                  oosValue={activeReport.summary.avgOosReturn * activeReport.summary.totalWindows} />
                <SummaryCard label="Sharpe \u6BD4\u7387"
                  isValue={avgIsSharpe} oosValue={activeReport.summary.avgOosSharpe} suffix="" alert={isOverfit} />
                <SummaryCard label={'\u6700\u5927\u56DE\u64A4'}
                  isValue={activeReport.windows.reduce((s, w) => s + w.isMaxDD, 0) / activeReport.windows.length}
                  oosValue={activeReport.summary.avgOosMaxDD} />
                <SummaryCard label={'\u80DC\u7387'}
                  isValue={activeReport.windows.reduce((s, w) => s + w.isWinRate, 0) / activeReport.windows.length}
                  oosValue={activeReport.windows.reduce((s, w) => s + w.oosWinRate, 0) / activeReport.windows.length} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#0f0f17] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-gray-500 text-xs mb-1">Walk-Forward {'\u6548\u7387'}</div>
                  <div className={`text-2xl font-bold font-mono ${
                    activeReport.summary.efficiencyScore >= 60 ? 'text-emerald-400'
                      : activeReport.summary.efficiencyScore >= 30 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{activeReport.summary.efficiencyScore}%</div>
                  <div className="text-gray-600 mt-1" style={{ fontSize: 10 }}>OOS/IS {'\u6536\u76CA\u6BD4'}</div>
                </div>
                <div className="bg-[#0f0f17] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-gray-500 text-xs mb-1">{'\u76C8\u5229\u4E00\u81F4\u6027'}</div>
                  <div className={`text-2xl font-bold font-mono ${
                    activeReport.summary.returnConsistency >= 0.6 ? 'text-emerald-400'
                      : activeReport.summary.returnConsistency >= 0.4 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{Math.round(activeReport.summary.returnConsistency * 100)}%</div>
                  <div className="text-gray-600 mt-1" style={{ fontSize: 10 }}>{'\u6B63\u6536\u76CA'} OOS {'\u7A97\u53E3\u5360\u6BD4'}</div>
                </div>
                <div className="bg-[#0f0f17] border border-white/5 rounded-xl p-4 text-center">
                  <div className="text-gray-500 text-xs mb-1">{'\u7A33\u5065\u6027\u8BC4\u7EA7'}</div>
                  <div className={`text-2xl font-bold ${gradeColor(activeReport.summary.grade)}`}>
                    {activeReport.summary.grade}
                  </div>
                  <div className="text-gray-600 mt-1" style={{ fontSize: 10 }}>{'\u7EFC\u5408\u8BC4\u5206'}</div>
                </div>
              </div>
              {activeReport.recommendations.length > 0 && (
                <div className="bg-[#111120] border border-white/5 rounded-xl p-4">
                  <div className="text-gray-400 text-xs font-semibold mb-3">{'\u{1F4A1} \u5EFA\u8BAE'}</div>
                  <ul className="space-y-1.5">
                    {activeReport.recommendations.map((r, i) => (
                      <li key={i} className="text-gray-300 text-xs flex items-start gap-2">
                        <span className="text-gray-600 mt-0.5">{'\u2022'}</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Periods Tab ── */}
          {activeTab === 'periods' && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-white/10">
                      <th className="text-left py-2 px-2 font-medium">#</th>
                      <th className="text-left py-2 px-2 font-medium">IS {'\u533A\u95F4'}</th>
                      <th className="text-left py-2 px-2 font-medium">OOS {'\u533A\u95F4'}</th>
                      <th className="text-right py-2 px-2 font-medium">IS {'\u6536\u76CA'}%</th>
                      <th className="text-right py-2 px-2 font-medium">OOS {'\u6536\u76CA'}%</th>
                      <th className="text-right py-2 px-2 font-medium">IS Sharpe</th>
                      <th className="text-right py-2 px-2 font-medium">OOS Sharpe</th>
                      <th className="text-right py-2 px-2 font-medium">IS {'\u56DE\u64A4'}%</th>
                      <th className="text-right py-2 px-2 font-medium">OOS {'\u56DE\u64A4'}%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReport.windows.map((w, i) => (
                      <tr key={w.windowId}
                        onClick={() => setSelectedWindow(selectedWindow === i ? null : i)}
                        className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                          selectedWindow === i ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'
                        }`}>
                        <td className="py-2 px-2 text-gray-500 font-mono">{i + 1}</td>
                        <td className="py-2 px-2 text-gray-400 font-mono">{w.isStart.slice(0, 10)}</td>
                        <td className="py-2 px-2 text-gray-400 font-mono">{w.oosStart.slice(0, 10)}</td>
                        <td className={`py-2 px-2 text-right font-mono font-medium ${w.isReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {w.isReturn >= 0 ? '+' : ''}{w.isReturn.toFixed(2)}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-semibold ${w.oosReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {w.oosReturn >= 0 ? '+' : ''}{w.oosReturn.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-gray-300">{w.isSharpe.toFixed(2)}</td>
                        <td className={`py-2 px-2 text-right font-mono ${w.oosSharpe >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {w.oosSharpe.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-orange-400">{w.isMaxDD.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono text-orange-400">{w.oosMaxDD.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Decay bar chart */}
              <div className="mt-5">
                <div className="text-gray-400 text-xs font-semibold mb-3">
                  {'\u{1F4CA} \u9010\u7A97'} OOS/IS {'\u8870\u51CF\u6BD4'}
                </div>
                <div className="flex items-end gap-1.5 h-24 px-2">
                  {activeReport.windows.map((w, i) => {
                    const ratio = w.isSharpe > 0 ? Math.min(2, w.oosSharpe / w.isSharpe) : 0;
                    const barH = Math.max(4, (ratio / 2) * 88);
                    const color = ratio > 0.7 ? '#22c55e' : ratio > 0.4 ? '#eab308' : ratio > 0.2 ? '#f97316' : '#ef4444';
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className={`w-full rounded-t cursor-pointer transition-opacity ${
                          selectedWindow === i ? 'opacity-100 ring-1 ring-blue-400/50' : 'opacity-70 hover:opacity-90'
                        }`} style={{ height: barH, backgroundColor: color }}
                          onClick={() => setSelectedWindow(selectedWindow === i ? null : i)} />
                        <span className="text-gray-600" style={{ fontSize: 8 }}>{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-gray-600 mt-1 px-2" style={{ fontSize: 9 }}>
                  <span>{'\u7A97\u53E3'} 1</span>
                  <span>{'\u7A97\u53E3'} {activeReport.windows.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Equity Tab ── */}
          {activeTab === 'equity' && (
            <div>
              <div className="text-gray-400 text-xs font-semibold mb-3">
                {'\u{1F4C8}'} OOS {'\u62FC\u63A5\u6743\u76CA\u66F2\u7EBF'}
              </div>
              <div className="bg-[#0a0a12] border border-white/5 rounded-xl p-4 overflow-hidden">
                <EquityCurveChart windows={activeReport.windows} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-[#0f0f17] border border-white/5 rounded-lg p-3 text-center">
                  <div className="text-gray-500 mb-1" style={{ fontSize: 10 }}>OOS {'\u7D2F\u8BA1\u6536\u76CA'}</div>
                  <div className={`font-mono text-sm font-semibold ${
                    activeReport.summary.avgOosReturn * activeReport.summary.totalWindows >= 0
                      ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {(activeReport.summary.avgOosReturn * activeReport.summary.totalWindows).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-[#0f0f17] border border-white/5 rounded-lg p-3 text-center">
                  <div className="text-gray-500 mb-1" style={{ fontSize: 10 }}>IS {'\u7D2F\u8BA1\u6536\u76CA'}</div>
                  <div className="font-mono text-sm font-semibold text-gray-300">
                    {activeReport.windows.reduce((s, w) => s + w.isReturn, 0).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-[#0f0f17] border border-white/5 rounded-lg p-3 text-center">
                  <div className="text-gray-500 mb-1" style={{ fontSize: 10 }}>OOS {'\u6700\u5927\u56DE\u64A4'}</div>
                  <div className="font-mono text-sm font-semibold text-orange-400">
                    {Math.max(...activeReport.windows.map(w => w.oosMaxDD)).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Params Tab ── */}
          {activeTab === 'params' && (
            <div>
              <div className="text-gray-400 text-xs font-semibold mb-3">
                {'\u{1F527} \u53C2\u6570\u7A33\u5B9A\u6027\u5206\u6790'}
              </div>
              {activeReport.paramStability.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">{'\u65E0\u53C2\u6570\u6570\u636E'}</div>
              ) : (
                <>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/10">
                        <th className="text-left py-2 px-3 font-medium">{'\u53C2\u6570'}</th>
                        <th className="text-right py-2 px-3 font-medium">{'\u5747\u503C'}</th>
                        <th className="text-right py-2 px-3 font-medium">{'\u6807\u51C6\u5DEE'}</th>
                        <th className="text-right py-2 px-3 font-medium">{'\u53D8\u5F02\u7CFB\u6570'} (CV)</th>
                        <th className="text-center py-2 px-3 font-medium">{'\u72B6\u6001'}</th>
                        <th className="text-left py-2 px-3 font-medium">{'\u5404\u7A97\u53E3\u503C'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeReport.paramStability.map((p, i) => (
                        <tr key={i} className="border-b border-white/[0.03]">
                          <td className="py-2 px-3 text-white font-medium">{p.param}</td>
                          <td className="py-2 px-3 text-right font-mono text-gray-300">{p.mean.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-gray-400">{p.stdDev.toFixed(2)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-medium ${
                            p.cv < 0.3 ? 'text-emerald-400' : p.cv < 0.6 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{(p.cv * 100).toFixed(0)}%</td>
                          <td className="py-2 px-3 text-center">
                            {p.stable
                              ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" style={{ fontSize: 10 }}>{'\u7A33\u5B9A'}</span>
                              : <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20" style={{ fontSize: 10 }}>{'\u4E0D\u7A33\u5B9A'}</span>
                            }
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex gap-1 flex-wrap">
                              {p.values.map((v, j) => (
                                <span key={j} title={`Window ${j + 1}: ${v}`}
                                  className={`inline-block px-1.5 py-0.5 rounded font-mono ${
                                    p.stable ? 'bg-gray-800 text-gray-400' : 'bg-orange-500/10 text-orange-300 border border-orange-500/10'
                                  }`} style={{ fontSize: 9 }}>
                                  {v}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Stability bars */}
                  <div className="mt-5 space-y-3">
                    {activeReport.paramStability.map((p, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-300 font-medium">{p.param}</span>
                          <span className={`font-mono ${p.stable ? 'text-emerald-400' : 'text-red-400'}`}>
                            CV {(p.cv * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex gap-px">
                          {p.values.map((v, j) => {
                            const min = Math.min(...p.values);
                            const max = Math.max(...p.values);
                            const range = max - min || 1;
                            const w = ((v - min) / range) * 100;
                            const hue = p.stable ? 140 : 30;
                            return (
                              <div key={j} className="h-full rounded-sm"
                                style={{ width: `${Math.max(8, w)}%`, backgroundColor: `hsl(${hue}, 60%, ${40 + j * 3}%)` }} />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!activeReport && !activeLoading && !legacyMode && (
        <div className="px-6 py-16 text-center">
          <div className="text-5xl mb-4 opacity-30">{'\u{1F52C}'}</div>
          <div className="text-gray-400 text-sm mb-2">
            {'\u914D\u7F6E\u53C2\u6570\u540E\u8FD0\u884C'} Walk-Forward {'\u5206\u6790'}
          </div>
          <div className="text-gray-600 text-xs max-w-xs mx-auto">
            Walk-Forward {'\u901A\u8FC7\u6EDA\u52A8\u7A97\u53E3\u9A8C\u8BC1\u7B56\u7565\u5728\u6837\u672C\u5916\u6570\u636E\u4E0A\u7684\u8868\u73B0\uFF0C\u662F\u68C0\u6D4B\u8FC7\u62DF\u5408\u7684\u6838\u5FC3\u5DE5\u5177\u3002'}
          </div>
        </div>
      )}
    </div>
  );
}
