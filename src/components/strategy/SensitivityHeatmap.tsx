/**
 * R167 P2-08: SensitivityHeatmap — 参数敏感性热力图 + 过拟合检测灯
 *
 * Renders 2D heatmap surfaces from SensitivityAnalyzer results.
 * Features: 🟢🟡🔴 overfitting status, robust parameter intervals,
 * marginal sensitivity charts, and exportable top-5 parameter combos.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

// ═══════════════════════════════════════════════════════════════════════════
// Types (mirrors sensitivity-analyzer.ts output)
// ═══════════════════════════════════════════════════════════════════════════

interface OverfittingResult {
  overfittingScore: number;
  status: 'stable' | 'moderate' | 'severe';
  light: string;
  evidence: string[];
  peakSharpnessPct: number;
  degradationRatio: number;
  hasIslands: boolean;
  islandCount: number;
}

interface RobustInterval {
  paramName: string;
  paramNameCN: string;
  min: number;
  max: number;
  avgScore: number;
  stability: number;
}

interface Param1DSensitivity {
  paramName: string;
  paramNameCN: string;
  points: Array<{ value: number; avgScore: number; minScore: number; maxScore: number }>;
  bestValue: number;
  bestScore: number;
  paramOverfitting: OverfittingResult;
  robustInterval: RobustInterval;
}

interface ParamPairSurface {
  paramX: string;
  paramY: string;
  paramXCN: string;
  paramYCN: string;
  grid: number[][];
  xLabels: number[];
  yLabels: number[];
  bestX: number;
  bestY: number;
  bestScore: number;
  surfaceOverfitting: OverfittingResult;
}

interface SurfacePoint {
  paramValues: Record<string, number>;
  score: number;
}

interface SensitivityResult {
  surfaces: ParamPairSurface[];
  marginals: Param1DSensitivity[];
  overfitting: OverfittingResult;
  topCombos: SurfacePoint[];
  totalPoints: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Component Props
// ═══════════════════════════════════════════════════════════════════════════

interface SensitivityHeatmapProps {
  data: SensitivityResult | null;
  /** Strategy name for display */
  strategyName?: string;
  /** Loading state */
  loading?: boolean;
  /** Show surface selection dropdown */
  showSurfaceSelector?: boolean;
  /** Callback to re-run analysis */
  onReanalyze?: () => void;
  /** Callback to export data */
  onExport?: (format: 'json' | 'csv') => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_CLASS: Record<string, string> = {
  stable: 'status-stable',
  moderate: 'status-moderate',
  severe: 'status-severe',
};

const LIGHT_EMOJI: Record<string, string> = {
  stable: '🟢',
  moderate: '🟡',
  severe: '🔴',
};

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

const SensitivityHeatmap: React.FC<SensitivityHeatmapProps> = ({
  data,
  strategyName = '策略',
  loading = false,
  showSurfaceSelector = true,
  onReanalyze,
  onExport,
}) => {
  const [selectedSurfaceIdx, setSelectedSurfaceIdx] = useState(0);
  const [selectedParamIdx, setSelectedParamIdx] = useState(0);
  const [expandedEvidence, setExpandedEvidence] = useState(false);

  const surfaceChartRef = useRef<HTMLDivElement>(null);
  const marginalChartRef = useRef<HTMLDivElement>(null);
  const surfaceInstance = useRef<echarts.ECharts | null>(null);
  const marginalInstance = useRef<echarts.ECharts | null>(null);

  const surface = data?.surfaces[selectedSurfaceIdx] ?? null;
  const marginal = data?.marginals[selectedParamIdx] ?? null;
  const overfitting = data?.overfitting ?? null;

  // ── Heatmap Chart ─────────────────────────────────────────────────────

  const heatmapOption: EChartsOption | null = useMemo(() => {
    if (!surface || !data) return null;

    const { grid, xLabels, yLabels, bestX, bestY, paramXCN, paramYCN } = surface;

    // Build ECharts heatmap data: [xIdx, yIdx, value]
    const heatData: Array<[number, number, number]> = [];
    for (let yi = 0; yi < grid.length; yi++) {
      for (let xi = 0; xi < grid[yi].length; xi++) {
        heatData.push([xi, yi, grid[yi][xi]]);
      }
    }

    // Mark best point
    const bestXi = xLabels.indexOf(bestX);
    const bestYi = yLabels.indexOf(bestY);

    return {
      tooltip: {
        position: 'top',
        formatter: (params: unknown) => {
          const p = params as { data: [number, number, number] };
          const xv = xLabels[p.data[0]];
          const yv = yLabels[p.data[1]];
          const score = p.data[2];
          const isBest = p.data[0] === bestXi && p.data[1] === bestYi;
          return `${paramXCN}: ${xv}<br/>${paramYCN}: ${yv}<br/>得分: ${score.toFixed(3)}${isBest ? ' ⭐最优' : ''}`;
        },
      },
      grid: { left: 80, right: 30, top: 50, bottom: 60 },
      xAxis: {
        type: 'category',
        data: xLabels.map((v) => v.toFixed(2)),
        name: paramXCN,
        nameLocation: 'middle' as const,
        nameGap: 35,
        axisLabel: { fontSize: 10, rotate: 45 },
      },
      yAxis: {
        type: 'category',
        data: yLabels.map((v) => v.toFixed(2)),
        name: paramYCN,
        nameLocation: 'middle' as const,
        nameGap: 50,
        axisLabel: { fontSize: 10 },
      },
      visualMap: {
        min: 0,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        top: 5,
        inRange: { color: ['#1e3a5f', '#2d6a4f', '#52b788', '#d4edc9', '#fbbf24', '#dc2626'] },
        text: ['高', '低'],
      },
      series: [
        {
          type: 'heatmap',
          data: heatData,
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
          },
        },
        ...(bestXi >= 0 && bestYi >= 0
          ? [{
              type: 'scatter' as const,
              data: [[bestXi, bestYi, 1]],
              symbolSize: 18,
              itemStyle: { borderColor: '#fff', borderWidth: 2 },
              label: { show: true, formatter: '⭐', fontSize: 16 },
            }]
          : []),
      ],
    };
  }, [surface, data]);

  // ── Marginal Chart ────────────────────────────────────────────────────

  const marginalOption: EChartsOption | null = useMemo(() => {
    if (!marginal) return null;

    const values = marginal.points.map((p) => p.value);
    const avgScores = marginal.points.map((p) => p.avgScore);
    const minScores = marginal.points.map((p) => p.minScore);
    const maxScores = marginal.points.map((p) => p.maxScore);

    // Mark robust interval
    const ri = marginal.robustInterval;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const ps = params as Array<{ axisValueLabel: string; seriesName: string; value: number }>;
          const entries = ps.map((p) => `${p.seriesName}: ${p.value.toFixed(3)}`).join('<br/>');
          return `参数值: ${ps[0]?.axisValueLabel ?? ''}<br/>${entries}`;
        },
      },
      grid: { left: 60, right: 30, top: 40, bottom: 50 },
      xAxis: {
        type: 'category',
        data: values.map((v) => v.toFixed(2)),
        name: marginal.paramNameCN,
        axisLabel: { fontSize: 10, rotate: 45 },
      },
      yAxis: { type: 'value', name: '得分' },
      series: [
        {
          name: '平均得分',
          type: 'line',
          data: avgScores,
          smooth: true,
          lineStyle: { color: '#4ade80', width: 2 },
          itemStyle: { color: '#4ade80' },
          markArea: {
            silent: true,
            data: [[
              { xAxis: values.indexOf(ri.min) >= 0 ? values.indexOf(ri.min) : 0 },
              { xAxis: values.indexOf(ri.max) >= 0 ? values.indexOf(ri.max) : values.length - 1 },
            ]],
            itemStyle: { color: 'rgba(74, 222, 128, 0.1)' },
          },
        },
        {
          name: '最小值-最大值',
          type: 'line',
          data: minScores,
          lineStyle: { color: '#fbbf24', width: 1, type: 'dashed' },
          itemStyle: { color: '#fbbf24' },
          symbol: 'none',
        },
        {
          name: '最大值',
          type: 'line',
          data: maxScores,
          lineStyle: { color: '#ef4444', width: 1, type: 'dashed' },
          itemStyle: { color: '#ef4444' },
          symbol: 'none',
          areaStyle: { color: 'rgba(239, 68, 68, 0.05)' },
        },
        {
          name: '最优值',
          type: 'scatter',
          data: [[marginal.bestValue, marginal.bestScore]],
          symbolSize: 14,
          itemStyle: { color: '#fbbf24', borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: `⭐${marginal.bestValue.toFixed(2)}`, fontSize: 12 },
        },
      ],
    };
  }, [marginal]);

  // ── Chart Lifecycle ───────────────────────────────────────────────────

  useEffect(() => {
    if (!surfaceChartRef.current) return;

    surfaceInstance.current = echarts.init(surfaceChartRef.current);
    const handleResize = () => surfaceInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      surfaceInstance.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (surfaceInstance.current && heatmapOption) {
      surfaceInstance.current.setOption(heatmapOption, true);
    }
  }, [heatmapOption]);

  useEffect(() => {
    if (!marginalChartRef.current) return;

    marginalInstance.current = echarts.init(marginalChartRef.current);
    const handleResize = () => marginalInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      marginalInstance.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (marginalInstance.current && marginalOption) {
      marginalInstance.current.setOption(marginalOption, true);
    }
  }, [marginalOption]);

  // ── Render ────────────────────────────────────────────────────────────

  const renderOverfittingBadge = (of: OverfittingResult) => (
    <div className={`overfitting-badge ${STATUS_CLASS[of.status] ?? ''}`}>
      <span className="light">{LIGHT_EMOJI[of.status] ?? of.light}</span>
      <span className="status-text">
        {of.status === 'stable' ? '鲁棒性好' : of.status === 'moderate' ? '中度过拟合风险' : '严重过拟合'}
      </span>
      <span className="score">{of.overfittingScore}/100</span>
    </div>
  );

  if (loading) {
    return (
      <div className="sensitivity-container" style={styles.container}>
        <div style={styles.loadingBox}>
          <div className="loading-spinner" />
          <p style={{ color: '#8b93a7', marginTop: 12 }}>正在计算参数敏感性...</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalPoints === 0) {
    return (
      <div className="sensitivity-container" style={styles.container}>
        <div style={styles.emptyBox}>
          <p style={{ color: '#8b93a7' }}>暂无敏感性分析数据</p>
          {onReanalyze && (
            <button style={styles.actionButton} onClick={onReanalyze}>
              开始分析
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sensitivity-container" style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <h2 style={styles.title}>{strategyName} · 参数敏感性分析</h2>
        <div style={styles.headerRight}>
          {overfitting && renderOverfittingBadge(overfitting)}
          {onReanalyze && (
            <button style={styles.actionButton} onClick={onReanalyze}>
              🔄 重新分析
            </button>
          )}
          {onExport && (
            <button style={styles.actionButton} onClick={() => onExport('json')}>
              📥 导出
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Row ───────────────────────────────────────────────── */}
      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <span style={styles.statLabel}>总采样点</span>
          <span style={styles.statValue}>{data.totalPoints.toLocaleString()}</span>
        </div>
        {overfitting && (
          <>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>峰部锐度</span>
              <span style={{ ...styles.statValue, color: overfitting.peakSharpnessPct > 50 ? '#ef4444' : overfitting.peakSharpnessPct > 25 ? '#fbbf24' : '#4ade80' }}>
                {overfitting.peakSharpnessPct}%
              </span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>邻近衰减比</span>
              <span style={{ ...styles.statValue, color: overfitting.degradationRatio > 0.4 ? '#ef4444' : overfitting.degradationRatio > 0.2 ? '#fbbf24' : '#4ade80' }}>
                {overfitting.degradationRatio}
              </span>
            </div>
            <div style={styles.statBox}>
              <span style={styles.statLabel}>参数岛</span>
              <span style={{ ...styles.statValue, color: overfitting.hasIslands ? '#fbbf24' : '#4ade80' }}>
                {overfitting.hasIslands ? `${overfitting.islandCount}个` : '无'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Evidence (collapsible) ──────────────────────────────────── */}
      {overfitting && overfitting.evidence.length > 0 && (
        <div style={styles.evidenceBox}>
          <div
            style={styles.evidenceHeader}
            onClick={() => setExpandedEvidence(!expandedEvidence)}
          >
            <span>{expandedEvidence ? '▼' : '▶'} 过拟合证据 ({overfitting.evidence.length}条)</span>
          </div>
          {expandedEvidence && (
            <ul style={styles.evidenceList}>
              {overfitting.evidence.map((e, i) => (
                <li key={i} style={styles.evidenceItem}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Surface Selector ────────────────────────────────────────── */}
      {showSurfaceSelector && data.surfaces.length > 1 && (
        <div style={styles.selectorRow}>
          <span style={styles.selectorLabel}>参数对:</span>
          {data.surfaces.map((s, i) => (
            <button
              key={i}
              style={{
                ...styles.selectorButton,
                ...(i === selectedSurfaceIdx ? styles.selectorButtonActive : {}),
              }}
              onClick={() => setSelectedSurfaceIdx(i)}
            >
              {s.paramXCN} × {s.paramYCN}
            </button>
          ))}
        </div>
      )}

      {/* ── Heatmap ──────────────────────────────────────────────────── */}
      <div style={styles.sectionTitle}>
        📊 参数敏感性热力图
        {surface && (
          <span style={styles.sectionSubtitle}>
            {surface.paramXCN} × {surface.paramYCN}（最优: {surface.bestX.toFixed(2)}, {surface.bestY.toFixed(2)}）
            {renderOverfittingBadge(surface.surfaceOverfitting)}
          </span>
        )}
      </div>
      <div ref={surfaceChartRef} style={styles.chartLarge} />

      {/* ── Marginal Sensitivity ─────────────────────────────────────── */}
      <div style={styles.sectionTitle}>📈 单参数边际敏感性</div>

      {data.marginals.length > 0 && (
        <div style={styles.selectorRow}>
          <span style={styles.selectorLabel}>参数:</span>
          {data.marginals.map((m, i) => (
            <button
              key={i}
              style={{
                ...styles.selectorButton,
                ...(i === selectedParamIdx ? styles.selectorButtonActive : {}),
              }}
              onClick={() => setSelectedParamIdx(i)}
            >
              {m.paramNameCN}
              <span style={{ marginLeft: 6, fontSize: 12 }}>
                {LIGHT_EMOJI[m.paramOverfitting.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      {marginal && (
        <>
          {/* Marginal chart */}
          <div ref={marginalChartRef} style={styles.chartMedium} />

          {/* Robust interval */}
          <div style={styles.robustBox}>
            <span style={styles.robustLabel}>🛡️ 稳健参数区间:</span>
            <span style={styles.robustRange}>
              [{marginal.robustInterval.min.toFixed(2)}, {marginal.robustInterval.max.toFixed(2)}]
            </span>
            <span style={styles.robustMeta}>
              均分 {marginal.robustInterval.avgScore} | 稳定性 {marginal.robustInterval.stability}
            </span>
          </div>

          {/* Per-param overfitting */}
          <div style={styles.paramOFBox}>
            {renderOverfittingBadge(marginal.paramOverfitting)}
            {marginal.paramOverfitting.evidence.length > 0 && (
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                {marginal.paramOverfitting.evidence.map((e, i) => (
                  <li key={i} style={{ color: '#8b93a7', fontSize: 13, marginBottom: 4 }}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ── Top 5 Parameter Combos ────────────────────────────────────── */}
      {data.topCombos.length > 0 && (
        <>
          <div style={styles.sectionTitle}>🏆 最优参数组合 Top 5</div>
          <div style={styles.tableWrap}>
            <table style={styles.comboTable}>
              <thead>
                <tr>
                  <th style={styles.th}>排名</th>
                  <th style={styles.th}>得分</th>
                  {Object.keys(data.topCombos[0].paramValues).map((k) => (
                    <th key={k} style={styles.th}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topCombos.map((combo, i) => (
                  <tr key={i} style={i === 0 ? styles.trBest : undefined}>
                    <td style={styles.td}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</td>
                    <td style={{ ...styles.td, color: '#4ade80', fontWeight: 600 }}>{combo.score.toFixed(4)}</td>
                    {Object.entries(combo.paramValues).map(([k, v]) => (
                      <td key={k} style={styles.td}>{typeof v === 'number' ? v.toFixed(2) : v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Inline Styles (dark theme, consistent with project)
// ═══════════════════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1a1a25',
    borderRadius: 12,
    padding: 24,
    color: '#e0e0e0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f0f0f0',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 12,
  },
  actionButton: {
    background: '#C9A046',
    color: '#1a1a25',
    border: 'none',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  statsRow: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statBox: {
    background: '#252540',
    borderRadius: 8,
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 100,
  },
  statLabel: {
    fontSize: 11,
    color: '#8b93a7',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: '#e0e0e0',
  },
  evidenceBox: {
    background: '#252540',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 16,
  },
  evidenceHeader: {
    cursor: 'pointer',
    fontSize: 13,
    color: '#fbbf24',
    fontWeight: 600,
    userSelect: 'none',
  },
  evidenceList: {
    margin: '8px 0 0 0',
    paddingLeft: 20,
  },
  evidenceItem: {
    color: '#8b93a7',
    fontSize: 13,
    marginBottom: 4,
  },
  selectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  selectorLabel: {
    fontSize: 13,
    color: '#8b93a7',
    marginRight: 4,
  },
  selectorButton: {
    background: '#252540',
    color: '#8b93a7',
    border: '1px solid #3a3a5c',
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  selectorButtonActive: {
    background: '#C9A046',
    color: '#1a1a25',
    border: '1px solid #C9A046',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#C9A046',
    marginBottom: 12,
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#8b93a7',
    fontWeight: 400,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  chartLarge: {
    width: '100%',
    height: 400,
    background: '#1e1e2e',
    borderRadius: 8,
    marginBottom: 20,
  },
  chartMedium: {
    width: '100%',
    height: 280,
    background: '#1e1e2e',
    borderRadius: 8,
    marginBottom: 16,
  },
  robustBox: {
    background: '#1e3a2f',
    borderRadius: 8,
    padding: '10px 16px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  robustLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#4ade80',
  },
  robustRange: {
    fontSize: 16,
    fontWeight: 700,
    color: '#4ade80',
    fontFamily: 'monospace',
  },
  robustMeta: {
    fontSize: 12,
    color: '#6ee7b7',
  },
  paramOFBox: {
    background: '#252540',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 16,
  },
  tableWrap: {
    overflowX: 'auto',
    marginBottom: 16,
  },
  comboTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    color: '#8b93a7',
    borderBottom: '1px solid #3a3a5c',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #252540',
    color: '#c0c0d0',
  },
  trBest: {
    background: 'rgba(201, 160, 70, 0.08)',
  },
};

export default SensitivityHeatmap;
