// @ts-nocheck
// ── R196 ML P12-03: CrossMarketFactorCompare — 7市场因子横向对比台 ──────────
// Select a universal factor → compare IC/performance across all markets
// Heatmap table: factor × market matrix with color scale
// Bar chart comparison: IC by market for selected factor
// "Where does this factor work best?" question answered visually
// Filters: factor category, market region, IC threshold

import React, { useState, useMemo, useCallback } from 'react';
import { Tooltip, Tag, Select, Empty, Segmented } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
interface FactorMarketIC {
  factorId: string;
  factorName: string;
  market: string;
  marketFlag: string;
  ic: number; // -0.1 to 0.1
  ir: number;
  sharpe: number;
  hitRate: number; // 0-1
  tier: 'basic' | 'advanced' | 'pro';
  category: string;
}

interface CrossMarketFactorCompareProps {
  data?: FactorMarketIC[];
  onSelectCell?: (cell: FactorMarketIC) => void;
}

// ── Demo Data ────────────────────────────────────────────────────────
function generateCompareData(): FactorMarketIC[] {
  const markets = [
    { code: 'hk', flag: '🇭🇰' },
    { code: 'us', flag: '🇺🇸' },
    { code: 'crypto', flag: '🪙' },
    { code: 'jp', flag: '🇯🇵' },
    { code: 'tw', flag: '🇹🇼' },
    { code: 'kr', flag: '🇰🇷' },
    { code: 'sg', flag: '🇸🇬' },
    { code: 'au', flag: '🇦🇺' },
    { code: 'in', flag: '🇮🇳' },
    { code: 'eu', flag: '🇪🇺' },
  ];

  const factors = [
    { id: 'PE_RATIO', name: 'PE Ratio', category: 'Value', tier: 'basic' as const },
    { id: 'MOM_12M1M', name: '12-1M Momentum', category: 'Momentum', tier: 'basic' as const },
    { id: 'EARNINGS_YIELD', name: 'Earnings Yield', category: 'Value', tier: 'advanced' as const },
    { id: 'BAB', name: 'Bet Against Beta', category: 'Low Vol', tier: 'advanced' as const },
    { id: 'ROE', name: 'ROE', category: 'Quality', tier: 'basic' as const },
    { id: 'DIVIDEND_YIELD', name: 'Dividend Yield', category: 'Income', tier: 'basic' as const },
    { id: 'SHORT_INTEREST', name: 'Short Interest', category: 'Sentiment', tier: 'advanced' as const },
    { id: 'VOLATILITY_1M', name: '1M Volatility', category: 'Risk', tier: 'basic' as const },
    { id: 'GAMMA_EXPOSURE', name: 'Gamma Exposure', category: 'Options', tier: 'pro' as const },
    { id: 'MOMENTUM_CRASH', name: 'Momentum Crash', category: 'Risk', tier: 'advanced' as const },
    { id: 'ANALYST_REVISION', name: 'Analyst Revision', category: 'Sentiment', tier: 'advanced' as const },
    { id: 'FCF_YIELD', name: 'FCF Yield', category: 'Value', tier: 'advanced' as const },
  ];

  const data: FactorMarketIC[] = [];
  let idx = 0;

  factors.forEach((f) => {
    markets.forEach((m) => {
      idx++;
      const seed = idx * f.id.length + m.code.charCodeAt(0) + idx * 3;
      const rand = (offset: number) => {
        const x = Math.sin(seed * offset * 1.97 + seed * 0.07) * 10000;
        return x - Math.floor(x);
      };

      // Value factors work better in APAC, momentum better in US
      let baseIC = 0.02;
      if (f.category === 'Value' && ['hk', 'sg', 'jp', 'kr'].includes(m.code)) baseIC += 0.015;
      if (f.category === 'Momentum' && ['us', 'crypto', 'in'].includes(m.code)) baseIC += 0.012;
      if (f.category === 'Quality' && ['us', 'eu', 'jp'].includes(m.code)) baseIC += 0.01;
      if (f.category === 'Income' && ['hk', 'sg', 'au', 'eu'].includes(m.code)) baseIC += 0.018;
      if (f.category === 'Sentiment' && ['us', 'eu'].includes(m.code)) baseIC += 0.01;
      if (f.category === 'Options' && ['us', 'kr'].includes(m.code)) baseIC += 0.02;
      if (f.category === 'Risk' && ['us', 'eu', 'crypto'].includes(m.code)) baseIC += 0.008;
      if (f.category === 'Low Vol' && ['jp', 'eu', 'hk'].includes(m.code)) baseIC += 0.012;

      // Regional quirks
      if (['jp', 'kr'].includes(m.code) && f.name.includes('Dividend')) baseIC -= 0.01; // APAC pays less dividends
      if (['tw'].includes(m.code) && f.name.includes('Momentum')) baseIC += 0.015; // Taiwan momentum strong
      if (['au'].includes(m.code) && f.name.includes('Value')) baseIC += 0.01; // Australia value premium
      if (['in'].includes(m.code) && f.name.includes('Short')) baseIC = 0; // India short data unreliable

      const ic = Math.round((baseIC + (rand(0) - 0.5) * 0.04) * 10000) / 10000;
      const ir = Math.round(ic * (2.5 + rand(1) * 1.5) * 1000) / 1000;
      const sharpe = Math.round((0.3 + rand(2) * 0.7) * 100) / 100;
      const hitRate = Math.round((0.48 + rand(3) * 0.35) * 100) / 100;

      data.push({
        factorId: f.id,
        factorName: f.name,
        market: m.code,
        marketFlag: m.flag,
        ic,
        ir,
        sharpe,
        hitRate,
        tier: f.tier,
        category: f.category,
      });
    });
  });

  return data;
}

// ── Color Scale ──────────────────────────────────────────────────────
function icColorCode(ic: number): string {
  if (ic >= 0.05) return '#1a9850';
  if (ic >= 0.03) return '#66bd63';
  if (ic >= 0.02) return '#a6d96a';
  if (ic >= 0.00) return '#ffffbf';
  if (ic >= -0.02) return '#fdae61';
  if (ic >= -0.04) return '#f46d43';
  return '#d73027';
}

// ── Component ────────────────────────────────────────────────────────
const CrossMarketFactorCompare: React.FC<CrossMarketFactorCompareProps> = ({
  data: propData,
  onSelectCell,
}) => {
  const allData = useMemo(() => propData || generateCompareData(), [propData]);
  const [selectedFactor, setSelectedFactor] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'heatmap' | 'chart'>('heatmap');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const factors = useMemo(
    () => [...new Set(allData.map((d) => d.factorName))],
    [allData],
  );
  const markets = useMemo(
    () =>
      [...new Map(allData.map((d) => [d.market, { code: d.market, flag: d.marketFlag }])).values()],
    [allData],
  );
  const categories = useMemo(
    () => [...new Set(allData.map((d) => d.category))],
    [allData],
  );

  const filteredData = useMemo(() => {
    let d = allData;
    if (selectedFactor) d = d.filter((r) => r.factorName === selectedFactor);
    if (selectedMarket) d = d.filter((r) => r.market === selectedMarket);
    if (categoryFilter) d = d.filter((r) => r.category === categoryFilter);
    return d;
  }, [allData, selectedFactor, selectedMarket, categoryFilter]);

  const displayFactors = selectedFactor
    ? factors.filter((f) => f === selectedFactor)
    : factors.filter((f) => {
        if (!categoryFilter) return true;
        return allData.some((d) => d.factorName === f && d.category === categoryFilter);
      });

  // Stats
  const avgIC = filteredData.length
    ? Math.round((filteredData.reduce((s, d) => s + d.ic, 0) / filteredData.length) * 10000) / 10000
    : 0;
  const bestCell = filteredData.length
    ? filteredData.reduce((best, d) => (d.ic > best.ic ? d : best))
    : null;
  const worstCell = filteredData.length
    ? filteredData.reduce((worst, d) => (d.ic < worst.ic ? d : worst))
    : null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🌏 Cross-Market Factor Comparison</h3>
          <p style={styles.subtitle}>
            Compare factor performance across 10 markets
          </p>
        </div>
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as any)}
          options={[
            { label: '🗺️ Heatmap', value: 'heatmap' },
            { label: '📊 Chart', value: 'chart' },
          ]}
          style={{ background: '#0f0f1e' }}
        />
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <Select
          allowClear
          placeholder="Select factor"
          value={selectedFactor}
          onChange={setSelectedFactor}
          style={{ minWidth: 200 }}
          options={factors.map((f) => ({ value: f, label: f }))}
          popupMatchSelectWidth={false}
        />
        <Select
          allowClear
          placeholder="Select market"
          value={selectedMarket}
          onChange={setSelectedMarket}
          style={{ minWidth: 160 }}
          options={markets.map((m) => ({ value: m.code, label: `${m.flag} ${m.code.toUpperCase()}` }))}
        />
        <div style={styles.catChips}>
          {categories.map((c) => (
            <button
              key={c}
              style={{
                ...styles.catBtn,
                background: categoryFilter === c ? '#d4a85320' : 'transparent',
                borderColor: categoryFilter === c ? '#d4a853' : '#2a2a4a',
              }}
              onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Avg IC</span>
          <span style={{ ...styles.statVal, color: icColorCode(avgIC) }}>
            {(avgIC * 100).toFixed(2)}%
          </span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Best</span>
          {bestCell && (
            <span style={{ ...styles.statVal, color: icColorCode(bestCell.ic) }}>
              {bestCell.marketFlag} {(bestCell.ic * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Worst</span>
          {worstCell && (
            <span style={{ ...styles.statVal, color: icColorCode(worstCell.ic) }}>
              {worstCell.marketFlag} {(worstCell.ic * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Records</span>
          <span style={{ ...styles.statVal, color: '#aaa' }}>{filteredData.length}</span>
        </div>
      </div>

      {/* Heatmap View */}
      {viewMode === 'heatmap' && (
        <div style={styles.heatmapScroll}>
          <table style={styles.heatmap}>
            <thead>
              <tr>
                <th style={styles.cornerCell}>Factor</th>
                {markets.map((m) => (
                  <th key={m.code} style={styles.marketHeader}>
                    <Tooltip title={m.code.toUpperCase()}>
                      <span>{m.flag}</span>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayFactors.map((factorName) => {
                const factorData = allData.filter((d) => d.factorName === factorName);
                const category = factorData[0]?.category || '';
                return (
                  <tr key={factorName}>
                    <td style={styles.rowHeader}>
                      <div style={styles.rowName}>{factorName}</div>
                      <div style={styles.rowCat}>{category}</div>
                    </td>
                    {markets.map((m) => {
                      const cell = factorData.find((d) => d.market === m.code);
                      if (!cell) return <td key={m.code} style={styles.emptyCell}>—</td>;
                      const isBestInRow =
                        factorData.reduce((b, d) => (d.ic > b.ic ? d : b)).ic === cell.ic;
                      const isWorstInRow =
                        factorData.reduce((w, d) => (d.ic < w.ic ? d : w)).ic === cell.ic;
                      return (
                        <td key={m.code} style={styles.dataCell}>
                          <Tooltip
                            title={
                              <div style={styles.tt}>
                                <div>{cell.marketFlag} {factorName}</div>
                                <div>IC: {(cell.ic * 100).toFixed(2)}%</div>
                                <div>IR: {cell.ir.toFixed(3)}</div>
                                <div>Sharpe: {cell.sharpe.toFixed(2)}</div>
                                <div>Hit Rate: {(cell.hitRate * 100).toFixed(0)}%</div>
                                <div>Tier: {cell.tier}</div>
                              </div>
                            }
                          >
                            <div
                              style={{
                                ...styles.cellBlock,
                                backgroundColor: icColorCode(cell.ic),
                                outline: isBestInRow ? '2px solid #1a9850' : isWorstInRow ? '2px dashed #d73027' : 'none',
                                opacity: selectedMarket && selectedMarket !== m.code ? 0.3 : 1,
                              }}
                              onClick={() => onSelectCell?.(cell)}
                            >
                              <span style={styles.cellText}>
                                {(cell.ic * 100).toFixed(1)}%
                              </span>
                              {isBestInRow && <span style={styles.cellStar}>★</span>}
                            </div>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart View — Horizontal bar comparing IC for 1 factor across markets */}
      {viewMode === 'chart' && (
        <div style={styles.chartView}>
          {selectedFactor ? (
            <div style={styles.chartBars}>
              <div style={styles.chartTitle}>Factor: {selectedFactor}</div>
              {markets.map((m) => {
                const cell = filteredData.find((d) => d.market === m.code);
                const ic = cell?.ic || 0;
                const barWidth = Math.abs(ic) * 500; // scale
                return (
                  <div key={m.code} style={styles.barRow}>
                    <span style={styles.barLabel}>
                      {m.flag} {m.code.toUpperCase()}
                    </span>
                    <div style={styles.barTrack}>
                      <div
                        style={{
                          ...styles.barFill,
                          width: `${Math.min(barWidth, 100)}%`,
                          background: ic >= 0
                            ? 'linear-gradient(90deg, #a6d96a, #1a9850)'
                            : 'linear-gradient(90deg, #fdae61, #d73027)',
                          marginLeft: ic < 0 ? 'auto' : 0,
                        }}
                      />
                    </div>
                    <span style={{ ...styles.barValue, color: icColorCode(ic) }}>
                      {(ic * 100).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.chartEmpty}>
              <Empty description="Select a factor to see cross-market IC comparison" />
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendLabel}>IC Scale:</span>
        {[
          { label: '> 5%', color: '#1a9850' },
          { label: '3-5%', color: '#66bd63' },
          { label: '2-3%', color: '#a6d96a' },
          { label: '0-2%', color: '#ffffbf' },
          { label: '0 ~ -2%', color: '#fdae61' },
          { label: '< -2%', color: '#f46d43' },
        ].map((l) => (
          <span key={l.label} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', margin: 0 },
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' },
  filters: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  catChips: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  catBtn: {
    padding: '2px 8px', borderRadius: 10, border: '1px solid #2a2a4a',
    background: 'transparent', color: '#aaa', fontSize: 10, cursor: 'pointer',
  },
  statsBar: {
    display: 'flex', gap: 16, padding: '8px 14px',
    background: '#0f0f1e', borderRadius: 8, marginBottom: 14,
  },
  stat: { textAlign: 'center', flex: 1 },
  statLabel: { display: 'block', fontSize: 9, color: '#888', textTransform: 'uppercase' },
  statVal: { fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: '#e0e0e0' },
  heatmapScroll: { overflowX: 'auto' },
  heatmap: { width: '100%', borderCollapse: 'collapse' as const },
  cornerCell: { padding: '6px 8px', fontSize: 10, color: '#888', textAlign: 'left' as const },
  marketHeader: { padding: '6px 4px', fontSize: 16, textAlign: 'center' as const },
  rowHeader: { padding: '6px 8px', textAlign: 'left' as const, minWidth: 120 },
  rowName: { fontSize: 11, fontWeight: 600, color: '#ccc', fontFamily: 'monospace' },
  rowCat: { fontSize: 9, color: '#666' },
  dataCell: { padding: 2 },
  emptyCell: { textAlign: 'center', color: '#444', fontSize: 11, padding: 6 },
  cellBlock: {
    minWidth: 52, height: 40, borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', position: 'relative', transition: 'transform 0.15s',
  },
  cellText: { fontSize: 11, fontWeight: 800, color: '#1a1a2e' },
  cellStar: { position: 'absolute', top: 1, left: 3, fontSize: 9, color: '#1a9850' },
  chartView: { minHeight: 200 },
  chartBars: {},
  chartTitle: { fontSize: 14, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 },
  barRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  barLabel: { fontSize: 11, color: '#aaa', minWidth: 60, fontFamily: 'monospace' },
  barTrack: { flex: 1, height: 20, background: '#2a2a4a', borderRadius: 4, overflow: 'hidden', display: 'flex' },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease' },
  barValue: { fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 50, textAlign: 'right' },
  chartEmpty: { padding: 30, textAlign: 'center' },
  legend: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  legendLabel: { fontSize: 10, color: '#888', fontWeight: 600 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#888' },
  legendDot: { width: 10, height: 10, borderRadius: 2, display: 'inline-block' },
  tt: { fontSize: 11, lineHeight: 1.8 },
};

export { CrossMarketFactorCompare, generateCompareData };
export type { CrossMarketFactorCompareProps, FactorMarketIC };
