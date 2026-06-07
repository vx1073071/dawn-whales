/**
 * Risk Visualizer — ML-49-NEW [P0]
 * R48+R49: Smart Risk Visualization Dashboard
 *
 * Features:
 * - Risk heatmap (correlation matrix SVG)
 * - VaR/CVaR trend chart (SVG)
 * - Risk score gauge
 * - Exposure breakdown bars
 * - Alert list with severity filter
 */

import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

interface RiskHeatmapCell {
  row: string;
  col: string;
  value: number;
  intensity: number;
}

interface VaRPoint {
  date: string;
  var95: number;
  var99: number;
  cvar95: number;
  drawdown: number;
}

interface RiskAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  timestamp: string;
  value?: number;
}

interface ExposureItem {
  name: string;
  category: string;
  value: number;
  pct: number;
  color: string;
}

// ── Demo Data ───────────────────────────────────────────────────────────

const demoCorrelation: RiskHeatmapCell[] = [];
const symbols = ['QQQ', 'TQQQ', 'AAPL', 'TSLA', 'NVDA'];
const corrValues: number[][] = [
  [1.00, 0.97, 0.72, 0.45, 0.68],
  [0.97, 1.00, 0.70, 0.43, 0.66],
  [0.72, 0.70, 1.00, 0.38, 0.55],
  [0.45, 0.43, 0.38, 1.00, 0.52],
  [0.68, 0.66, 0.55, 0.52, 1.00],
];
for (let r = 0; r < symbols.length; r++) {
  for (let c = 0; c < symbols.length; c++) {
    demoCorrelation.push({
      row: symbols[r],
      col: symbols[c],
      value: corrValues[r][c],
      intensity: Math.round(corrValues[r][c] * 100),
    });
  }
}

const demoVaRData: VaRPoint[] = [
  { date: '06/01', var95: 2.1, var99: 3.5, cvar95: 2.8, drawdown: -1.2 },
  { date: '06/02', var95: 2.3, var99: 3.8, cvar95: 3.0, drawdown: -2.5 },
  { date: '06/03', var95: 3.1, var99: 5.2, cvar95: 4.1, drawdown: -4.8 },
  { date: '06/04', var95: 2.7, var99: 4.5, cvar95: 3.6, drawdown: -3.3 },
  { date: '06/05', var95: 1.9, var99: 3.1, cvar95: 2.5, drawdown: -0.8 },
  { date: '06/06', var95: 1.7, var99: 2.8, cvar95: 2.3, drawdown: -0.5 },
  { date: '06/07', var95: 1.5, var99: 2.5, cvar95: 2.0, drawdown: -0.2 },
];

const demoAlerts: RiskAlert[] = [
  { id: 'a1', severity: 'high', category: 'drawdown', message: 'Portfolio drawdown approaching 5% threshold', timestamp: '23:15', value: 4.8 },
  { id: 'a2', severity: 'medium', category: 'correlation', message: 'QQQ-TQQQ correlation increased to 0.97', timestamp: '23:10', value: 0.97 },
  { id: 'a3', severity: 'low', category: 'exposure', message: 'Tech sector concentration exceeds 60%', timestamp: '23:05', value: 62 },
  { id: 'a4', severity: 'critical', category: 'var', message: 'VaR99 breached 5% risk budget limit', timestamp: '22:55', value: 5.2 },
  { id: 'a5', severity: 'medium', category: 'margin', message: 'Margin utilization reached 75%', timestamp: '22:30', value: 75 },
  { id: 'a6', severity: 'low', category: 'liquidity', message: 'TSLA liquidity score dropped to 0.82', timestamp: '22:15', value: 0.82 },
];

const demoExposure: ExposureItem[] = [
  { name: 'Technology', category: 'sector', value: 6200000, pct: 62, color: '#3b82f6' },
  { name: 'Consumer', category: 'sector', value: 1800000, pct: 18, color: '#10b981' },
  { name: 'Finance', category: 'sector', value: 1200000, pct: 12, color: '#f59e0b' },
  { name: 'Healthcare', category: 'sector', value: 500000, pct: 5, color: '#ef4444' },
  { name: 'Cash', category: 'sector', value: 300000, pct: 3, color: '#8b5cf6' },
];

// ── Config ──────────────────────────────────────────────────────────────

const severityCfg: Record<string, { bg: string; textCls: string; label: string }> = {
  critical: { bg: 'bg-red-500/15', textCls: 'text-red-400', label: 'CRIT' },
  high: { bg: 'bg-orange-500/15', textCls: 'text-orange-400', label: 'HIGH' },
  medium: { bg: 'bg-yellow-500/15', textCls: 'text-yellow-400', label: 'MED' },
  low: { bg: 'bg-blue-500/15', textCls: 'text-blue-400', label: 'LOW' },
};

const catLabels: Record<string, string> = {
  drawdown: 'Drawdown',
  var: 'VaR',
  correlation: 'Correlation',
  exposure: 'Exposure',
  liquidity: 'Liquidity',
  margin: 'Margin',
};

// ── Helper ──────────────────────────────────────────────────────────────

function corrColor(value: number): string {
  const abs = Math.abs(value);
  if (value > 0) return `rgba(239,68,68,${abs})`;
  return `rgba(59,130,246,${abs})`;
}

// ── Sub-components ──────────────────────────────────────────────────────

const VaRTrendChart: React.FC<{ data: VaRPoint[] }> = ({ data }) => {
  const maxVal = 6;
  const h = 120;
  const w = 320;
  const px = 30;
  const py = 15;
  const cw = w - px * 2;
  const ch = h - py * 2;
  const pts = (vals: number[]) =>
    vals.map((v, i) => {
      const x = px + (i / (vals.length - 1)) * cw;
      const y = py + ch - (v / maxVal) * ch;
      return `${x},${y}`;
    });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 2, 4, 6].map((v) => {
        const y = py + ch - (v / maxVal) * ch;
        return (
          <g key={v}>
            <line x1={px} y1={y} x2={w - px} y2={y} stroke="rgba(255,255,255,0.05)" />
            <text x={px - 5} y={y + 4} textAnchor="end" fill="#666" fontSize="8">{v}%</text>
          </g>
        );
      })}
      <polyline points={pts(data.map((d) => d.var95)).join(' ')} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />
      <polyline points={pts(data.map((d) => d.var99)).join(' ')} fill="none" stroke="#ef4444" strokeWidth="2" />
      <polyline points={pts(data.map((d) => d.cvar95)).join(' ')} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="2,2" />
      {data.map((d, i) =>
        i % 2 === 0 ? (
          <text key={i} x={px + (i / (data.length - 1)) * cw} y={h - 3} textAnchor="middle" fill="#666" fontSize="8">{d.date}</text>
        ) : null
      )}
      <g transform={`translate(${px}, ${py - 8})`}>
        <line x1={0} y1={0} x2={12} y2={0} stroke="#ef4444" strokeWidth="2" />
        <text x={16} y={3} fill="#555" fontSize="8">VaR99</text>
        <line x1={50} y1={0} x2={62} y2={0} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x={66} y={3} fill="#555" fontSize="8">VaR95</text>
        <line x1={100} y1={0} x2={112} y2={0} stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="2,2" />
        <text x={116} y={3} fill="#555" fontSize="8">CVaR</text>
      </g>
    </svg>
  );
};

const RiskHeatmap: React.FC<{ data: RiskHeatmapCell[]; syms: string[] }> = ({ data, syms }) => {
  const cs = 44;
  const lp = 36;
  const sz = lp + syms.length * cs;
  return (
    <svg viewBox={`0 0 ${sz} ${sz}`} className="w-full h-auto max-w-[300px]">
      {data.map((cell, i) => {
        const ri = syms.indexOf(cell.row);
        const ci = syms.indexOf(cell.col);
        const x = lp + ci * cs;
        const y = lp + ri * cs;
        const diag = cell.row === cell.col;
        return (
          <g key={i}>
            <rect x={x} y={y} width={cs - 2} height={cs - 2} rx={4} fill={diag ? 'rgba(212,168,83,0.15)' : corrColor(cell.value)} />
            <text x={x + (cs - 2) / 2} y={y + (cs - 2) / 2 + 3} textAnchor="middle" fill={diag ? '#D4A853' : 'white'} fontSize="11" fontWeight={diag ? 'bold' : 'normal'}>{cell.value.toFixed(2)}</text>
          </g>
        );
      })}
      {syms.map((s, i) => (
        <text key={'r' + s} x={lp - 6} y={lp + i * cs + cs / 2 + 3} textAnchor="end" fill="#999" fontSize="10">{s}</text>
      ))}
      {syms.map((s, i) => (
        <text key={'c' + s} x={lp + i * cs + cs / 2 - 1} y={lp - 8} textAnchor="start" fill="#999" fontSize="10" transform={`rotate(-45, ${lp + i * cs + cs / 2}, ${lp - 8})`}>{s}</text>
      ))}
    </svg>
  );
};

const RiskGauge: React.FC<{ score: number; max?: number }> = ({ score, max = 100 }) => {
  const pct = Math.min(score / max, 1);
  const angle = pct * 180;
  const rad = (angle * Math.PI) / 180;
  const r = 54;
  const cx = 100;
  const cy = 90;
  const nx = cx + r * Math.cos(Math.PI - rad);
  const ny = cy - r * Math.sin(Math.PI - rad);
  const gColor = score < 30 ? '#10b981' : score < 60 ? '#f59e0b' : score < 80 ? '#f97316' : '#ef4444';
  const gLabel = score < 30 ? 'Low Risk' : score < 60 ? 'Med Risk' : score < 80 ? 'High Risk' : 'Critical';
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto max-w-[200px]">
      <path d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
      {angle > 0 && (
        <path d={`M ${cx - r},${cy} A ${r},${r} 0 ${angle > 90 ? 1 : 0},1 ${nx},${ny}`} fill="none" stroke={gColor} strokeWidth="12" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 10} textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={gColor} fontSize="11">{gLabel}</text>
      <text x={cx - r + 10} y={cy + 20} textAnchor="middle" fill="#666" fontSize="9">0</text>
      <text x={cx + r - 10} y={cy + 20} textAnchor="middle" fill="#666" fontSize="9">{max}</text>
    </svg>
  );
};

const ExposureBars: React.FC<{ items: ExposureItem[] }> = ({ items }) => (
  <div className="space-y-3">
    {items.map((item) => (
      <div key={item.name} className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">{item.name}</span>
          <span className="text-gray-300">{item.pct}%</span>
        </div>
        <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
        </div>
      </div>
    ))}
  </div>
);

// ── Main Component ──────────────────────────────────────────────────────

const RiskVisualizer: React.FC = () => {
  const [tab, setTab] = useState<'overview' | 'heatmap' | 'trends' | 'alerts'>('overview');
  const [alertF, setAlertF] = useState('all');
  const filtered = useMemo(() => {
    if (alertF === 'all') return demoAlerts;
    return demoAlerts.filter((a) => a.severity === alertF);
  }, [alertF]);

  const tabs = [
    { id: 'overview' as const, icon: '\u{1F4CA}', label: 'Overview' },
    { id: 'heatmap' as const, icon: '\u{1F525}', label: 'Heatmap' },
    { id: 'trends' as const, icon: '\u{1F4C9}', label: 'VaR Trends' },
    { id: 'alerts' as const, icon: '\u{1F514}', label: 'Alerts' },
  ];

  return (
    <div className="h-full bg-[#0d0d15] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-lg">{'\u{1F6E1}'}</div>
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Risk Visualizer</h2>
            <p className="text-[10px] text-gray-600">Real-time risk monitoring & alerting</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-gray-600">P95:</span>
          <span className="text-green-400">&lt;500ms</span>
        </div>
      </div>

      <div className="flex gap-1 px-5 py-2 border-b border-white/[0.03]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              tab === t.id ? 'bg-amber-500/15 text-amber-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col items-center">
                <RiskGauge score={47} />
                <p className="text-[10px] text-gray-600 mt-1">Risk Score</p>
              </div>
              {[
                { label: 'Daily VaR95', value: '15,200 HKD', change: '-8%', up: true },
                { label: 'Max Drawdown', value: '-4.8%', change: '', up: false },
                { label: 'Sharpe Ratio', value: '1.82', change: '+0.12', up: true },
              ].map((s, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                  <p className="text-[10px] text-gray-600 mb-1">{s.label}</p>
                  <p className="text-lg font-semibold text-gray-200">{s.value}</p>
                  {s.change && <p className={`text-[10px] ${s.up ? 'text-green-400' : 'text-red-400'}`}>{s.change}</p>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                <h3 className="text-xs font-medium text-gray-400 mb-3">Sector Exposure</h3>
                <ExposureBars items={demoExposure} />
              </div>
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                <h3 className="text-xs font-medium text-gray-400 mb-3">Recent Alerts</h3>
                <div className="space-y-2">
                  {demoAlerts.slice(0, 4).map((a) => {
                    const cfg = severityCfg[a.severity];
                    return (
                      <div key={a.id} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${cfg.bg} ${cfg.textCls}`}>{cfg.label}</span>
                        <span className="text-gray-400 truncate flex-1">{a.message}</span>
                        <span className="text-gray-700">{a.timestamp}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'heatmap' && (
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
            <h3 className="text-xs font-medium text-gray-400 mb-4">Correlation Matrix (60d)</h3>
            <RiskHeatmap data={demoCorrelation} syms={symbols} />
          </div>
        )}

        {tab === 'trends' && (
          <div className="space-y-4">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
              <h3 className="text-xs font-medium text-gray-400 mb-4">VaR & CVaR Trend (7d)</h3>
              <VaRTrendChart data={demoVaRData} />
            </div>
          </div>
        )}

        {tab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {['all', 'critical', 'high', 'medium', 'low'].map((f) => {
                const cfg = severityCfg[f];
                const active = alertF === f;
                return (
                  <button
                    key={f}
                    onClick={() => setAlertF(f)}
                    className={`px-2.5 py-1 rounded text-[10px] transition-colors ${
                      active ? (cfg?.bg ?? 'bg-white/[0.06]') + ' ' + (cfg?.textCls ?? 'text-gray-300') : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    {f === 'all' ? 'All' : cfg?.label ?? f}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              {filtered.map((a) => {
                const cfg = severityCfg[a.severity];
                return (
                  <div key={a.id} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-4 py-3 flex items-center gap-3">
                    <span className={`shrink-0 w-7 h-7 rounded-lg ${cfg.bg} ${cfg.textCls} flex items-center justify-center text-xs font-bold`}>{cfg.label[0]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{a.message}</p>
                      <span className="text-[10px] text-gray-600">{catLabels[a.category] ?? a.category}</span>
                    </div>
                    <span className="text-[10px] text-gray-700">{a.timestamp}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskVisualizer;
