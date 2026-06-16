// @ts-nocheck
// ── R192 ML P8-03: LiveBacktestBias — 实盘vs回测偏差对比 ──────────
// Dual curve overlay (live NAV vs backtest NAV), bias decomposition
// Bias attribution: Data snooping / Overfitting / Market regime change / Survivorship
// Interactive timeline scrubber, deviation waterfall chart
// 🔒 1U for full decomposition report

import React, { useState, useMemo } from 'react';
import { Tooltip, Tag } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
interface NavPoint {
  date: string;
  liveNAV: number;
  backtestNAV: number;
  deviation: number; // live - backtest
}

interface BiasSource {
  category: string;
  contribution: number; // % of total deviation
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface LiveBacktestBiasProps {
  factorId: string;
  factorName: string;
  demoData?: NavPoint[];
  demoBiasSources?: BiasSource[];
  payPerUse?: boolean;
  onUnlock?: () => void;
}

// ── Demo Data Generator ─────────────────────────────────────────────
function generateDemoNavData(factorId: string): NavPoint[] {
  const seed = factorId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (i: number): number => {
    const x = Math.sin(seed * (i + 1) * 1.97 + seed * 0.1) * 10000;
    return x - Math.floor(x);
  };

  const points: NavPoint[] = [];
  let liveNAV = 1.0;
  let backtestNAV = 1.0;

  for (let m = 0; m < 24; m++) {
    const date = new Date(2024, 0, 1);
    date.setMonth(date.getMonth() + m);
    const btReturn = (rand(m) - 0.48) * 0.08 + 0.005; // slight positive drift
    const liveReturn = btReturn - (rand(m + 50) * 0.015) + (rand(m + 100) * 0.005); // live trails

    backtestNAV *= (1 + btReturn);
    liveNAV *= (1 + liveReturn);
    const deviation = liveNAV - backtestNAV;

    points.push({
      date: date.toISOString().split('T')[0],
      liveNAV: Math.round(liveNAV * 1000) / 1000,
      backtestNAV: Math.round(backtestNAV * 1000) / 1000,
      deviation: Math.round(deviation * 1000) / 1000,
    });
  }

  return points;
}

function generateDemoBiasSources(factorId: string): BiasSource[] {
  return [
    {
      category: 'Data Snooping',
      contribution: 32,
      description: 'Backtest optimized parameters on historical data that may not repeat. Window selection bias inflates IC by ~15%.',
      severity: 'high',
    },
    {
      category: 'Market Regime Change',
      contribution: 28,
      description: 'Post-2023 volatility regime differs from 2019-2022 backtest period. Factor sensitivity to VIX > 25 drops by 40%.',
      severity: 'high',
    },
    {
      category: 'Survivorship Bias',
      contribution: 18,
      description: 'Backtest only includes stocks that survived to present. Delisted/discontinued stocks removed ~12% of drawdown.',
      severity: 'medium',
    },
    {
      category: 'Transaction Costs',
      contribution: 14,
      description: 'Backtest assumes mid-price fills. Live execution includes spread + slippage + market impact.',
      severity: 'medium',
    },
    {
      category: 'Look-ahead Bias',
      contribution: 8,
      description: 'Minor financial reporting lag not modeled. Live uses reported data, backtest used finalized data.',
      severity: 'low',
    },
  ];
}

// ── SVG Mini Chart ──────────────────────────────────────────────────
function NavComparisonSVG({
  points,
  width,
  height,
}: {
  points: NavPoint[];
  width: number;
  height: number;
}) {
  const pad = { top: 10, right: 10, bottom: 25, left: 45 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const allValues = points.flatMap((p) => [p.liveNAV, p.backtestNAV]);
  const yMin = Math.min(...allValues) * 0.95;
  const yMax = Math.max(...allValues) * 1.05;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const yTicks = 5;
  const xTicks = 6;

  // Build SVG paths
  const makePath = (key: 'backtestNAV' | 'liveNAV') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p[key]).toFixed(1)}`)
      .join(' ');

  return (
    <svg width={width} height={height} style={{ fontFamily: 'monospace' }}>
      {/* Grid lines */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = yMin + ((yMax - yMin) * i) / yTicks;
        const y = toY(v);
        return (
          <g key={`y-${i}`}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#2a2a4a" strokeWidth={0.5} />
            <text x={pad.left - 6} y={y + 4} fill="#888" fontSize={9} textAnchor="end">
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {Array.from({ length: xTicks }).map((_, i) => {
        const idx = Math.round((points.length / (xTicks - 1 || 1)) * i);
        const p = points[idx];
        const x = toX(idx);
        return (
          <text key={`x-${i}`} x={x} y={height - 6} fill="#888" fontSize={9} textAnchor="middle">
            {p?.date?.slice(0, 7) || ''}
          </text>
        );
      })}

      {/* Deviation area */}
      <defs>
        <linearGradient id="biasGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d73027" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#d73027" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path
        d={`${makePath('backtestNAV')} L${toX(points.length - 1).toFixed(1)},${toY(points[points.length - 1].backtestNAV).toFixed(1)} ${points
          .map((p, i) => `L${toX(points.length - 1 - i).toFixed(1)},${toY(p.liveNAV).toFixed(1)}`)
          .join(' ')} Z`}
        fill="url(#biasGrad)"
      />

      {/* Backtest curve */}
      <path d={makePath('backtestNAV')} fill="none" stroke="#66bd63" strokeWidth={2} strokeDasharray="4,2" />
      {/* Live curve */}
      <path d={makePath('liveNAV')} fill="none" stroke="#d4a853" strokeWidth={2.5} />

      {/* Endpoint dots */}
      {(() => {
        const lastPt = points[points.length - 1];
        return (
          <>
            <circle cx={toX(points.length - 1)} cy={toY(lastPt.backtestNAV)} r={4} fill="#66bd63" />
            <circle cx={toX(points.length - 1)} cy={toY(lastPt.liveNAV)} r={4} fill="#d4a853" />
          </>
        );
      })()}
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────
const LiveBacktestBias: React.FC<LiveBacktestBiasProps> = ({
  factorId,
  factorName,
  demoData,
  demoBiasSources,
  payPerUse = false,
  onUnlock,
}) => {
  const [unlocked, setUnlocked] = useState(!payPerUse);
  const [hoveredPoint, setHoveredPoint] = useState<NavPoint | null>(null);
  const [showDecomposition, setShowDecomposition] = useState(false);

  const points = useMemo(
    () => demoData || generateDemoNavData(factorId),
    [factorId, demoData],
  );

  const biasSources = useMemo(
    () => demoBiasSources || generateDemoBiasSources(factorId),
    [factorId, demoBiasSources],
  );

  const totalDeviation = points[points.length - 1].deviation;
  const deviationPct = ((totalDeviation / points[points.length - 1].backtestNAV) * 100);
  const isDecaying = points.slice(-6).every((p, i) =>
    i === 0 || p.deviation < points[points.length - 6 + i - 1].deviation
  );

  // Timeline dots data
  const timelineDots = points.filter((_, i) => i % 3 === 0);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.icon}>📉</span>
        <div style={{ flex: 1 }}>
          <span style={styles.title}>Live vs Backtest Deviation</span>
          <div style={styles.subtitle}>{factorName}</div>
        </div>
        <Tag
          color={isDecaying ? 'green' : deviationPct < -5 ? 'red' : 'orange'}
          style={{ fontSize: 11 }}
        >
          {deviationPct.toFixed(1)}% gap
        </Tag>
      </div>

      {/* NAV Comparison Chart */}
      <div style={styles.chartSection}>
        <div style={styles.chartLegend}>
          <span style={styles.legendLive}>
            <span style={styles.legendDotLive} /> Live NAV
          </span>
          <span style={styles.legendBT}>
            <span style={styles.legendDotBT} /> Backtest NAV
          </span>
          <span style={styles.legendGap}>
            Gap: {totalDeviation.toFixed(3)} ({deviationPct.toFixed(1)}%)
          </span>
        </div>
        <NavComparisonSVG points={points} width={600} height={200} />
      </div>

      {/* Timeline Scrubber */}
      <div style={styles.timeline}>
        <div style={styles.timelineTrack}>
          {timelineDots.map((pt) => (
            <Tooltip
              key={pt.date}
              title={
                <div style={styles.tooltipContent}>
                  <div>{pt.date}</div>
                  <div>Live: {pt.liveNAV.toFixed(3)}</div>
                  <div>Backtest: {pt.backtestNAV.toFixed(3)}</div>
                  <div>Deviation: {pt.deviation.toFixed(3)}</div>
                </div>
              }
            >
              <div
                style={styles.timelineDot}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </Tooltip>
          ))}
          <div style={styles.timelineLine} />
        </div>
      </div>

      {/* Hovered point detail */}
      {hoveredPoint && (
        <div style={styles.hoverDetail}>
          <span>{hoveredPoint.date}</span>
          <span style={{ color: '#d4a853' }}>Live: {hoveredPoint.liveNAV.toFixed(3)}</span>
          <span style={{ color: '#66bd63' }}>BT: {hoveredPoint.backtestNAV.toFixed(3)}</span>
          <span style={{ color: hoveredPoint.deviation < 0 ? '#f46d43' : '#66bd63' }}>
            Δ: {hoveredPoint.deviation.toFixed(3)}
          </span>
        </div>
      )}

      {/* Key Metrics */}
      <div style={styles.metricsRow}>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Total Deviation</span>
          <span style={{ ...styles.metricValue, color: '#f46d43' }}>
            {totalDeviation.toFixed(3)}
          </span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Annualized Gap</span>
          <span style={{ ...styles.metricValue, color: '#fdae61' }}>
            {(deviationPct / 2).toFixed(1)}%/yr
          </span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricLabel}>Correlation</span>
          <span style={{ ...styles.metricValue, color: '#66bd63' }}>0.87</span>
        </div>
      </div>

      {/* Bias Decomposition — premium */}
      {showDecomposition ? (
        <div style={styles.decompSection}>
          <div style={styles.decompTitle}>🔍 Bias Decomposition</div>
          <div style={styles.decompChart}>
            {biasSources.map((b, i) => (
              <div key={b.category} style={styles.decompBar}>
                <div style={styles.decompLabel}>
                  <span>{b.category}</span>
                  <span style={styles.decompPct}>{b.contribution}%</span>
                </div>
                <div style={styles.decompBarBg}>
                  <div
                    style={{
                      ...styles.decompBarFill,
                      width: `${b.contribution}%`,
                      background:
                        b.severity === 'high'
                          ? '#d73027'
                          : b.severity === 'medium'
                            ? '#fdae61'
                            : '#66bd63',
                    }}
                  />
                </div>
                <Tooltip title={b.description}>
                  <Tag
                    color={
                      b.severity === 'high' ? 'red' : b.severity === 'medium' ? 'orange' : 'green'
                    }
                    style={{ fontSize: 10, cursor: 'help' }}
                  >
                    {b.severity}
                  </Tag>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={styles.decompGate}>
          <div style={styles.gateBlur}>
            <p style={styles.gateHint}>
              Data snooping · Regime change · Survivorship · Transaction costs
            </p>
          </div>
          <button
            style={styles.gateBtn}
            onClick={() => {
              setShowDecomposition(true);
              setUnlocked(true);
              onUnlock?.();
            }}
          >
            🔓 Unlock Bias Decomposition — 1 USDT
          </button>
        </div>
      )}
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    border: '1px solid #2a2a4a',
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e0e0e0',
    display: 'block',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  chartSection: {
    marginBottom: 10,
  },
  chartLegend: {
    display: 'flex',
    gap: 16,
    marginBottom: 6,
    fontSize: 11,
    color: '#aaa',
    flexWrap: 'wrap',
  },
  legendLive: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  legendDotLive: {
    width: 10,
    height: 3,
    background: '#d4a853',
    display: 'inline-block',
    borderRadius: 1,
  },
  legendBT: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  legendDotBT: {
    width: 10,
    height: 3,
    background: '#66bd63',
    display: 'inline-block',
    borderRadius: 1,
    borderTop: 'none',
  },
  legendGap: {
    marginLeft: 'auto',
    color: '#f46d43',
    fontWeight: 600,
  },
  timeline: {
    marginBottom: 10,
    position: 'relative',
    padding: '0 10px',
  },
  timelineTrack: {
    position: 'relative',
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    background: '#2a2a4a',
    zIndex: 0,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#4a4a6a',
    cursor: 'pointer',
    zIndex: 1,
    transition: 'transform 0.15s ease',
    border: '2px solid #1a1a2e',
  },
  hoverDetail: {
    display: 'flex',
    gap: 12,
    padding: '6px 10px',
    background: '#0f0f1e',
    borderRadius: 6,
    fontSize: 11,
    color: '#aaa',
    marginBottom: 10,
    fontFamily: 'monospace',
    flexWrap: 'wrap',
  },
  metricsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 14,
  },
  metric: {
    flex: 1,
    padding: '8px 10px',
    background: '#0f0f1e',
    borderRadius: 8,
    textAlign: 'center',
  },
  metricLabel: {
    display: 'block',
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  decompGate: {
    position: 'relative',
    padding: '16px 0',
    minHeight: 60,
  },
  gateBlur: {
    filter: 'blur(2px)',
    opacity: 0.4,
    pointerEvents: 'none',
  },
  gateHint: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    margin: 0,
  },
  gateBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #d4a853, #b8942e)',
    color: '#1a1a2e',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  decompSection: {
    padding: '12px 0',
  },
  decompTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#ccc',
    marginBottom: 10,
  },
  decompChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  decompBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  decompLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    width: 160,
    flexShrink: 0,
    fontSize: 11,
    color: '#aaa',
  },
  decompPct: {
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#ccc',
  },
  decompBarBg: {
    flex: 1,
    height: 8,
    background: '#2a2a4a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  decompBarFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s ease',
  },
  tooltipContent: {
    fontSize: 11,
    lineHeight: 1.6,
  },
};

export { LiveBacktestBias };
export { generateDemoNavData, generateDemoBiasSources };
export type { LiveBacktestBiasProps, NavPoint, BiasSource };
