// ── R192 ML P8-01: FactorParameterHeatmap — 参数敏感性热力图 ──────────
// Window × Threshold → IC matrix with gradient color scale
// 3 window presets (3M/6M/12M) × 3 threshold levels (±1σ/±1.5σ/±2σ)
// Hover tooltip shows exact IC + rank + stability percentile
// Overfitting warning when single cell is 2x any other in same row

import React, { useState, useMemo } from 'react';
import { Tooltip } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
interface SensitivityCell {
  window: number;   // months
  threshold: number; // sigma multiplier
  ic: number;        // information coefficient
  ir: number;        // information ratio
  hitRate: number;   // % positive IC windows
  overfitRisk: number; // 0-1, higher = more likely overfitting
}

interface FactorParameterHeatmapProps {
  factorId: string;
  factorName: string;
  demoData?: SensitivityCell[];
  payPerUse?: boolean;
  onUnlock?: () => void;
}

// ── Demo Data Generator ─────────────────────────────────────────────
function generateDemoHeatmapData(factorId: string): SensitivityCell[] {
  const seed = factorId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const pseudoRandom = (i: number, j: number): number => {
    const x = Math.sin(seed * (i + 1) * 3.7 + (j + 1) * 7.3 + seed * 0.1) * 10000;
    return x - Math.floor(x);
  };

  const windows = [3, 6, 12];
  const thresholds = [1.0, 1.5, 2.0];
  const cells: SensitivityCell[] = [];

  windows.forEach((w) => {
    thresholds.forEach((t) => {
      const idx = windows.indexOf(w);
      const jdx = thresholds.indexOf(t);
      const baseIC = 0.02 + pseudoRandom(idx, jdx) * 0.06;
      const noise = (pseudoRandom(jdx, idx) - 0.5) * 0.02;
      const ic = Math.round((baseIC + noise) * 10000) / 10000;
      const ir = Math.round(ic * (2.5 + pseudoRandom(jdx, idx) * 2) * 10000) / 10000;
      const hitRate = Math.round((0.55 + pseudoRandom(idx, jdx) * 0.3) * 100) / 100;
      const overfitRisk = Math.round(pseudoRandom(jdx, idx) * 100) / 100;

      cells.push({ window: w, threshold: t, ic, ir, hitRate, overfitRisk });
    });
  });

  return cells;
}

// ── Color Scale ──────────────────────────────────────────────────────
function icColor(ic: number): string {
  if (ic >= 0.06) return '#1a9850'; // deep green — excellent
  if (ic >= 0.04) return '#66bd63'; // green — good
  if (ic >= 0.02) return '#a6d96a'; // light green — acceptable
  if (ic >= 0.00) return '#ffffbf'; // neutral
  if (ic >= -0.02) return '#fdae61'; // light red — weak
  if (ic >= -0.04) return '#f46d43'; // red — poor
  return '#d73027'; // deep red — terrible
}

function overfitColor(risk: number): string {
  if (risk < 0.3) return 'transparent';
  if (risk < 0.6) return 'rgba(255, 165, 0, 0.2)';
  return 'rgba(255, 0, 0, 0.25)';
}

// ── Component ────────────────────────────────────────────────────────
const FactorParameterHeatmap: React.FC<FactorParameterHeatmapProps> = ({
  factorId,
  factorName,
  demoData,
  payPerUse = false,
  onUnlock,
}) => {
  const [unlocked, setUnlocked] = useState(!payPerUse);
  const [selectedCell, setSelectedCell] = useState<SensitivityCell | null>(null);

  const cells = useMemo(
    () => demoData || generateDemoHeatmapData(factorId),
    [factorId, demoData],
  );

  const windows = [3, 6, 12];
  const thresholds = [1.0, 1.5, 2.0];

  const getCell = (w: number, t: number): SensitivityCell =>
    cells.find((c) => c.window === w && c.threshold === t)!;

  // Find best cell overall
  const bestIC = Math.max(...cells.map((c) => c.ic));
  const worstIC = Math.min(...cells.map((c) => c.ic));

  // Check overfitting: any cell 2x its row minimum?
  const overfitWarnings = windows
    .map((w) => {
      const row = cells.filter((c) => c.window === w);
      const min = Math.min(...row.map((c) => c.ic));
      const max = Math.max(...row.map((c) => c.ic));
      return max > min * 2 ? w : null;
    })
    .filter(Boolean);

  if (!unlocked) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.icon}>🌡️</span>
          <span style={styles.title}>Parameter Sensitivity Heatmap</span>
          <span style={styles.badge}>1U</span>
        </div>
        <div style={styles.paywall}>
          <div style={styles.paywallBlur}>
            <div style={styles.paywallGrid}>
              {windows.map((w) =>
                thresholds.map((t) => (
                  <div
                    key={`${w}-${t}`}
                    style={{
                      ...styles.cellFake,
                      backgroundColor: `hsl(${w * 30 + t * 15}, 40%, 70%)`,
                    }}
                  />
                )),
              )}
            </div>
          </div>
          <div style={styles.paywallOverlay}>
            <p style={styles.paywallText}>
              Unlock full sensitivity analysis for <b>{factorName}</b>
            </p>
            <p style={styles.paywallSub}>
              3M/6M/12M × ±1σ/±1.5σ/±2σ IC matrix
            </p>
            <button
              style={styles.unlockBtn}
              onClick={() => {
                setUnlocked(true);
                onUnlock?.();
              }}
            >
              🔓 Unlock — 1 USDT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.icon}>🌡️</span>
        <span style={styles.title}>Parameter Sensitivity Heatmap</span>
        <span style={{ ...styles.badge, background: '#1a9850' }}>✓ Unlocked</span>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendLabel}>IC:</span>
        {[
          { label: '< 0', color: '#d73027' },
          { label: '0-2%', color: '#fdae61' },
          { label: '2-4%', color: '#a6d96a' },
          { label: '4-6%', color: '#66bd63' },
          { label: '> 6%', color: '#1a9850' },
        ].map((g) => (
          <span key={g.label} style={styles.legendItem}>
            <span
              style={{
                ...styles.legendSwatch,
                backgroundColor: g.color,
              }}
            />
            {g.label}
          </span>
        ))}
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendSwatch, border: '2px dashed orange' }} />
          Overfit risk
        </span>
      </div>

      {/* Heatmap Grid */}
      <div style={styles.gridWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.cornerCell}></th>
              {thresholds.map((t) => (
                <th key={t} style={styles.colHeader}>
                  ±{t}σ
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <tr key={w}>
                <td style={styles.rowHeader}>
                  {w}M
                  {overfitWarnings.includes(w) && (
                    <Tooltip title="Overfitting: max IC > 2× min in this row">
                      <span style={styles.warnIcon}>⚠️</span>
                    </Tooltip>
                  )}
                </td>
                {thresholds.map((t) => {
                  const cell = getCell(w, t);
                  const isBest = cell.ic === bestIC;
                  const isWorst = cell.ic === worstIC;
                  return (
                    <td
                      key={`${w}-${t}`}
                      style={styles.cell}
                      onMouseEnter={() => setSelectedCell(cell)}
                      onMouseLeave={() => setSelectedCell(null)}
                    >
                      <Tooltip
                        title={
                          <div style={styles.tooltipContent}>
                            <div>IC: <b>{(cell.ic * 100).toFixed(2)}%</b></div>
                            <div>IR: {cell.ir.toFixed(3)}</div>
                            <div>Hit Rate: {(cell.hitRate * 100).toFixed(0)}%</div>
                            <div>Overfit Risk: {(cell.overfitRisk * 100).toFixed(0)}%</div>
                          </div>
                        }
                      >
                        <div
                          style={{
                            ...styles.cellInner,
                            backgroundColor: icColor(cell.ic),
                            outline: isBest
                              ? '2px solid #1a9850'
                              : isWorst
                                ? '2px dashed #d73027'
                                : 'none',
                            boxShadow: isBest ? '0 0 8px rgba(26,152,80,0.4)' : 'none',
                          }}
                        >
                          {isBest && <span style={styles.cellStar}>★</span>}
                          <span style={styles.cellValue}>
                            {(cell.ic * 100).toFixed(1)}%
                          </span>
                        </div>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected Cell Detail */}
      {selectedCell && (
        <div style={styles.detailPanel}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Window</span>
            <span style={styles.detailValue}>{selectedCell.window} months</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Threshold</span>
            <span style={styles.detailValue}>±{selectedCell.threshold}σ</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>IC</span>
            <span style={{ ...styles.detailValue, color: icColor(selectedCell.ic) }}>
              {(selectedCell.ic * 100).toFixed(2)}%
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>IR</span>
            <span style={styles.detailValue}>{selectedCell.ir.toFixed(3)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Hit Rate</span>
            <span style={styles.detailValue}>
              {(selectedCell.hitRate * 100).toFixed(0)}%
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Overfit Risk</span>
            <span
              style={{
                ...styles.detailValue,
                color: selectedCell.overfitRisk > 0.6 ? '#d73027' : '#666',
              }}
            >
              {(selectedCell.overfitRisk * 100).toFixed(0)}%
              {selectedCell.overfitRisk > 0.6 && ' ⚠️ HIGH'}
            </span>
          </div>
        </div>
      )}

      {/* Overfitting Warning Banner */}
      {overfitWarnings.length > 0 && (
        <div style={styles.warningBanner}>
          <span>⚠️</span>
          <span>
            Overfitting detected in {overfitWarnings.length} window
            {overfitWarnings.length > 1 ? 's' : ''}:{' '}
            {overfitWarnings.map((w) => `${w}M`).join(', ')}.
            Max IC &gt; 2× row minimum. Consider cross-validation.
          </span>
        </div>
      )}

      {/* Summary Footer */}
      <div style={styles.footer}>
        <div style={styles.footerStat}>
          <span style={styles.footerLabel}>Best IC</span>
          <span style={{ ...styles.footerValue, color: '#1a9850' }}>
            {(bestIC * 100).toFixed(2)}%
          </span>
        </div>
        <div style={styles.footerStat}>
          <span style={styles.footerLabel}>Worst IC</span>
          <span style={{ ...styles.footerValue, color: '#d73027' }}>
            {(worstIC * 100).toFixed(2)}%
          </span>
        </div>
        <div style={styles.footerStat}>
          <span style={styles.footerLabel}>Robustness</span>
          <span style={styles.footerValue}>
            {cells.filter((c) => c.overfitRisk < 0.5).length}/{cells.length} cells
          </span>
        </div>
      </div>
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
    marginBottom: 16,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e0e0e0',
    flex: 1,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    background: '#d4a853',
    color: '#1a1a2e',
  },
  paywall: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 200,
  },
  paywallBlur: {
    filter: 'blur(8px)',
    pointerEvents: 'none',
    opacity: 0.3,
  },
  paywallGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 4,
  },
  cellFake: {
    height: 50,
    borderRadius: 4,
  },
  paywallOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(26, 26, 46, 0.85)',
  },
  paywallText: {
    color: '#e0e0e0',
    fontSize: 14,
    margin: 0,
    fontWeight: 500,
  },
  paywallSub: {
    color: '#888',
    fontSize: 12,
    margin: '4px 0 12px',
  },
  unlockBtn: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #d4a853, #b8942e)',
    color: '#1a1a2e',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  legendLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: 600,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: '#aaa',
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    display: 'inline-block',
  },
  gridWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  cornerCell: {
    width: 50,
    padding: 4,
  },
  colHeader: {
    fontSize: 11,
    color: '#aaa',
    textAlign: 'center' as const,
    padding: '6px 4px',
    fontFamily: 'monospace',
  },
  rowHeader: {
    fontSize: 11,
    color: '#aaa',
    fontFamily: 'monospace',
    padding: '6px 8px',
    textAlign: 'right' as const,
    fontWeight: 600,
  },
  warnIcon: {
    marginLeft: 4,
    cursor: 'help',
  },
  cell: {
    padding: 2,
    cursor: 'pointer',
  },
  cellInner: {
    height: 50,
    minWidth: 64,
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease',
    position: 'relative',
  },
  cellStar: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontSize: 10,
    color: '#1a9850',
  },
  cellValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  tooltipContent: {
    fontSize: 12,
    lineHeight: 1.6,
  },
  detailPanel: {
    marginTop: 12,
    padding: 12,
    background: '#0f0f1e',
    borderRadius: 8,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 16px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 11,
    color: '#888',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: 600,
    color: '#ccc',
    fontFamily: 'monospace',
  },
  warningBanner: {
    marginTop: 12,
    padding: '8px 12px',
    background: 'rgba(255, 165, 0, 0.15)',
    border: '1px solid rgba(255, 165, 0, 0.3)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#e0a040',
  },
  footer: {
    marginTop: 12,
    padding: '8px 12px',
    background: '#0f0f1e',
    borderRadius: 8,
    display: 'flex',
    justifyContent: 'space-around',
  },
  footerStat: {
    textAlign: 'center' as const,
  },
  footerLabel: {
    display: 'block',
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
  },
  footerValue: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#ccc',
  },
};

export { FactorParameterHeatmap };
export { generateDemoHeatmapData };
export type { SensitivityCell, FactorParameterHeatmapProps };
