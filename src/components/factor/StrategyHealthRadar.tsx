// ── R193 ML P9-03: StrategyHealthRadar — 策略健康评分5维雷达 ──────────
// 5-dim radar chart: IC / IR / Stability / Crowding / Drawdown
// Overall health score 0-100 with grade (A+/A/B/C/D/F)
// Health history timeline + trend arrows
// Factor contribution breakdown with weight sliders (read-only for basic)

import React, { useState, useMemo } from 'react';
import { Tooltip, Tag, Progress } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
interface RadarDimension {
  key: string;
  label: string;
  value: number; // 0-100
  weight: number; // 0-1
  description: string;
  trend: 'up' | 'down' | 'stable';
}

interface HealthSnapshot {
  timestamp: string;
  score: number;
  dimensions: Record<string, number>;
}

interface StrategyHealthRadarProps {
  strategyName: string;
  dimensions?: RadarDimension[];
  history?: HealthSnapshot[];
  onDimensionClick?: (dim: RadarDimension) => void;
}

// ── Demo Data ────────────────────────────────────────────────────────
function generateDemoDimensions(strategyName: string): RadarDimension[] {
  const seed = strategyName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (i: number) => {
    const x = Math.sin(seed * (i + 1) * 2.31 + seed * 0.01) * 10000;
    return x - Math.floor(x);
  };

  return [
    {
      key: 'ic',
      label: 'IC Strength',
      value: Math.round(55 + rand(0) * 35),
      weight: 0.30,
      description: 'Information Coefficient: how well the factor predicts returns.',
      trend: rand(0) > 0.6 ? 'up' : rand(0) > 0.3 ? 'stable' : 'down',
    },
    {
      key: 'ir',
      label: 'IR Consistency',
      value: Math.round(50 + rand(1) * 38),
      weight: 0.25,
      description: 'Information Ratio: risk-adjusted return persistence.',
      trend: rand(1) > 0.5 ? 'up' : 'stable',
    },
    {
      key: 'stability',
      label: 'Stability',
      value: Math.round(45 + rand(2) * 45),
      weight: 0.20,
      description: 'Rolling IC volatility and drawdown recovery speed.',
      trend: rand(2) > 0.4 ? 'stable' : 'down',
    },
    {
      key: 'crowding',
      label: 'Crowding',
      value: Math.round(30 + rand(3) * 55),
      weight: 0.15,
      description: 'How crowded the factor is. Lower = better (less crowded).',
      trend: rand(3) > 0.7 ? 'down' : 'stable',
    },
    {
      key: 'drawdown',
      label: 'Drawdown',
      value: Math.round(40 + rand(4) * 50),
      weight: 0.10,
      description: 'Max drawdown resilience score. Higher = better recovery.',
      trend: rand(4) > 0.5 ? 'up' : 'stable',
    },
  ];
}

function generateDemoHistory(dimensions: RadarDimension[]): HealthSnapshot[] {
  const snaps: HealthSnapshot[] = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(2024, 0, 1);
    date.setMonth(date.getMonth() + i);
    const jitter = Math.sin(i * 1.3) * 8 + (Math.random() - 0.5) * 4;
    const dims: Record<string, number> = {};
    dimensions.forEach((d) => {
      dims[d.key] = Math.max(0, Math.min(100, d.value + jitter + (Math.random() - 0.5) * 10));
    });
    const score = Math.round(
      dimensions.reduce((sum, d) => sum + (dims[d.key] || 50) * d.weight, 0),
    );
    snaps.push({
      timestamp: date.toISOString().split('T')[0],
      score,
      dimensions: dims,
    });
  }
  return snaps;
}

// ── SVG Radar Chart ──────────────────────────────────────────────────
function RadarChart({
  dimensions,
  size,
}: {
  dimensions: RadarDimension[];
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const n = dimensions.length;
  const angleStep = (2 * Math.PI) / n;

  const getCoord = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = (value / 100) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const getLabelCoord = (index: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = radius + 24;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  // Grid circles
  const gridLevels = [25, 50, 75, 100];

  // Data polygon
  const dataPoints = dimensions.map((d, i) => getCoord(i, d.value));
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} style={{ fontFamily: 'monospace' }}>
      {/* Grid circles */}
      {gridLevels.map((level) => {
        const r = (level / 100) * radius;
        return (
          <circle
            key={level}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#2a2a4a"
            strokeWidth={0.5}
            strokeDasharray={level === 50 ? '3,3' : 'none'}
          />
        );
      })}

      {/* Grid lines */}
      {dimensions.map((_, i) => {
        const p = getCoord(i, 100);
        return <line key={`line-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#2a2a4a" strokeWidth={0.5} />;
      })}

      {/* Data area */}
      <path d={dataPath} fill="rgba(212,168,83,0.15)" stroke="#d4a853" strokeWidth={2} />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={4} fill="#d4a853" stroke="#1a1a2e" strokeWidth={2} />
      ))}

      {/* Labels */}
      {dimensions.map((d, i) => {
        const p = getLabelCoord(i);
        const textAnchor = p.x < cx - 10 ? 'end' : p.x > cx + 10 ? 'start' : 'middle';
        return (
          <g key={`label-${i}`}>
            <text
              x={p.x}
              y={p.y - 4}
              fill="#aaa"
              fontSize={10}
              fontWeight={600}
              textAnchor={textAnchor}
            >
              {d.label}
            </text>
            <text
              x={p.x}
              y={p.y + 10}
              fill={d.trend === 'up' ? '#66bd63' : d.trend === 'down' ? '#f46d43' : '#888'}
              fontSize={9}
              textAnchor={textAnchor}
            >
              {d.value} {d.trend === 'up' ? '↑' : d.trend === 'down' ? '↓' : '→'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Grade ────────────────────────────────────────────────────────────
function getGrade(score: number): { letter: string; color: string; desc: string } {
  if (score >= 85) return { letter: 'A+', color: '#1a9850', desc: 'Excellent — Institutional grade' };
  if (score >= 75) return { letter: 'A', color: '#66bd63', desc: 'Very Good — Above institutional threshold' };
  if (score >= 65) return { letter: 'B', color: '#a6d96a', desc: 'Good — Solid retail-grade strategy' };
  if (score >= 55) return { letter: 'C', color: '#d4a853', desc: 'Fair — Needs optimization' };
  if (score >= 45) return { letter: 'D', color: '#fdae61', desc: 'Weak — Significant improvement needed' };
  return { letter: 'F', color: '#d73027', desc: 'Failing — Not deployable' };
}

// ── Component ────────────────────────────────────────────────────────
const StrategyHealthRadar: React.FC<StrategyHealthRadarProps> = ({
  strategyName,
  dimensions: propsDimensions,
  history: propsHistory,
  onDimensionClick,
}) => {
  const [selectedDim, setSelectedDim] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const dimensions = useMemo(
    () => propsDimensions || generateDemoDimensions(strategyName),
    [strategyName, propsDimensions],
  );

  const history = useMemo(
    () => propsHistory || generateDemoHistory(dimensions),
    [dimensions, propsHistory],
  );

  const score = Math.round(
    dimensions.reduce((sum, d) => sum + d.value * d.weight, 0),
  );

  const grade = getGrade(score);
  const latestHistory = history[history.length - 1];
  const previousHistory = history.length > 1 ? history[history.length - 2] : null;
  const trendDelta = previousHistory ? latestHistory.score - previousHistory.score : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.icon}>🎯</span>
        <div style={{ flex: 1 }}>
          <span style={styles.title}>Strategy Health Radar</span>
          <div style={styles.subtitle}>{strategyName}</div>
        </div>
      </div>

      {/* Score Banner */}
      <div style={styles.scoreBanner}>
        <div style={styles.scoreMain}>
          <div style={{ ...styles.scoreCircle, borderColor: grade.color }}>
            <span style={{ ...styles.scoreLetter, color: grade.color }}>{grade.letter}</span>
            <span style={styles.scoreNum}>{score}</span>
          </div>
          <div style={styles.scoreInfo}>
            <div style={styles.scoreDesc}>{grade.desc}</div>
            <div style={styles.scoreTrend}>
              {trendDelta !== 0 && (
                <Tag color={trendDelta > 0 ? 'green' : 'red'} style={{ fontSize: 11 }}>
                  {trendDelta > 0 ? '▲' : '▼'} {Math.abs(trendDelta)}pts this month
                </Tag>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div style={styles.chartWrapper}>
        <RadarChart dimensions={dimensions} size={280} />
      </div>

      {/* Dimension Detail Strip */}
      <div style={styles.dimStrip}>
        {dimensions.map((d) => (
          <Tooltip key={d.key} title={d.description}>
            <div
              style={{
                ...styles.dimStripItem,
                borderColor: selectedDim === d.key ? '#d4a853' : '#2a2a4a',
                background: selectedDim === d.key ? '#1e1e3a' : '#0f0f1e',
              }}
              onClick={() => {
                setSelectedDim((prev) => (prev === d.key ? null : d.key));
                onDimensionClick?.(d);
              }}
            >
              <div style={styles.dimLabel}>{d.label}</div>
              <div style={styles.dimBarBg}>
                <div
                  style={{
                    ...styles.dimBarFill,
                    width: `${d.value}%`,
                    background:
                      d.value >= 75
                        ? '#66bd63'
                        : d.value >= 50
                          ? '#d4a853'
                          : d.value >= 25
                            ? '#fdae61'
                            : '#f46d43',
                  }}
                />
              </div>
              <div style={styles.dimMeta}>
                <span style={styles.dimValue}>{d.value}</span>
                <span style={styles.dimWeight}>{Math.round(d.weight * 100)}%</span>
                <span
                  style={{
                    color: d.trend === 'up' ? '#66bd63' : d.trend === 'down' ? '#f46d43' : '#888',
                  }}
                >
                  {d.trend === 'up' ? '↑' : d.trend === 'down' ? '↓' : '→'}
                </span>
              </div>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Selected Dimension Detail */}
      {selectedDim && (() => {
        const dim = dimensions.find((d) => d.key === selectedDim)!;
        return (
          <div style={styles.dimDetail}>
            <div style={styles.dimDetailHeader}>
              <span style={styles.dimDetailTitle}>{dim.label}</span>
              <span style={styles.dimDetailScore}>{dim.value}/100</span>
            </div>
            <p style={styles.dimDetailDesc}>{dim.description}</p>
            <div style={styles.dimDetailStats}>
              <div style={styles.dimDetailStat}>
                <span style={styles.dimDetailStatLabel}>Weight</span>
                <span>{Math.round(dim.weight * 100)}%</span>
              </div>
              <div style={styles.dimDetailStat}>
                <span style={styles.dimDetailStatLabel}>Trend</span>
                <span style={{ color: dim.trend === 'up' ? '#66bd63' : '#f46d43' }}>
                  {dim.trend === 'up' ? 'Improving' : dim.trend === 'down' ? 'Deteriorating' : 'Stable'}
                </span>
              </div>
              <div style={styles.dimDetailStat}>
                <span style={styles.dimDetailStatLabel}>Contribution</span>
                <span>{(dim.value * dim.weight).toFixed(1)} pts</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* History Toggle */}
      <div style={styles.historyToggle} onClick={() => setShowHistory(!showHistory)}>
        <span>📈 Health History (12 months)</span>
        <span style={{ color: '#888' }}>{showHistory ? '▲' : '▼'}</span>
      </div>

      {showHistory && (
        <div style={styles.historyPanel}>
          <div style={styles.historyChart}>
            {history.map((snap, i) => {
              const barH = (snap.score / 100) * 80;
              const grd = getGrade(snap.score);
              return (
                <Tooltip
                  key={snap.timestamp}
                  title={
                    <div style={{ fontSize: 11 }}>
                      <div>{snap.timestamp}</div>
                      <div>Score: {snap.score} ({grd.letter})</div>
                    </div>
                  }
                >
                  <div style={styles.historyBar}>
                    <div
                      style={{
                        height: `${barH}%`,
                        width: '100%',
                        background: grd.color,
                        borderRadius: '2px 2px 0 0',
                        transition: 'height 0.3s ease',
                        opacity: i === history.length - 1 ? 1 : 0.6,
                        border: i === history.length - 1 ? '1px solid #e0e0e0' : 'none',
                      }}
                    />
                    <span style={styles.historyMonth}>
                      {snap.timestamp.slice(5, 7)}
                    </span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
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
    alignItems: 'center',
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
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  scoreBanner: {
    padding: '12px 16px',
    background: '#0f0f1e',
    borderRadius: 10,
    marginBottom: 14,
  },
  scoreMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: '3px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreLetter: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1,
  },
  scoreNum: {
    fontSize: 10,
    color: '#888',
    fontFamily: 'monospace',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreDesc: {
    fontSize: 13,
    color: '#ccc',
    fontWeight: 500,
    marginBottom: 4,
  },
  scoreTrend: {},
  chartWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dimStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  dimStripItem: {
    flex: '1 1 140px',
    padding: '8px 10px',
    background: '#0f0f1e',
    borderRadius: 8,
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.15s ease',
  },
  dimLabel: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: 600,
    marginBottom: 4,
  },
  dimBarBg: {
    height: 4,
    background: '#2a2a4a',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  dimBarFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.5s ease',
  },
  dimMeta: {
    display: 'flex',
    gap: 8,
    fontSize: 10,
  },
  dimValue: {
    fontWeight: 700,
    color: '#ccc',
    fontFamily: 'monospace',
  },
  dimWeight: {
    color: '#888',
  },
  dimDetail: {
    padding: 12,
    background: '#0f0f1e',
    borderRadius: 8,
    marginBottom: 12,
    border: '1px solid #d4a853',
  },
  dimDetailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dimDetailTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  dimDetailScore: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#d4a853',
    fontWeight: 700,
  },
  dimDetailDesc: {
    fontSize: 11,
    color: '#aaa',
    margin: '4px 0 8px',
    lineHeight: 1.5,
  },
  dimDetailStats: {
    display: 'flex',
    gap: 16,
  },
  dimDetailStat: {
    textAlign: 'center',
  },
  dimDetailStatLabel: {
    display: 'block',
    fontSize: 9,
    color: '#888',
    marginBottom: 2,
  },
  historyToggle: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    cursor: 'pointer',
    fontSize: 12,
    color: '#aaa',
    borderTop: '1px solid #2a2a4a',
  },
  historyPanel: {
    padding: '10px 0',
  },
  historyChart: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    gap: 2,
  },
  historyBar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    cursor: 'pointer',
  },
  historyMonth: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
  },
};

export { StrategyHealthRadar };
export { generateDemoDimensions, generateDemoHistory, getGrade, RadarChart };
export type { StrategyHealthRadarProps, RadarDimension, HealthSnapshot };
