// ── R198 ML P14-02: SeasonalityCalendar — 商品季节性环形日历 ──────────
// 12-month ring layout with seasonal performance for 6 core commodities
// 🟢 Peak season / 🔴 Off-season / 🟡 Transition
// Current month glow + hover tooltip with 10-year avg return %
// Gold 🥇 / Crude 🛢️ / Copper 🔩 / Nat Gas 🔥 / Corn 🌽 / Soybeans 🫘

import React, { useState, useMemo } from 'react';
import { Tooltip } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
interface MonthlyPerformance {
  month: number; // 1-12
  commodity: string;
  avgReturn: number; // % average monthly return over 10 years
  winRate: number; // % of years positive
  season: 'peak' | 'off' | 'transition';
  label: string; // one-line insight
}

interface SeasonalityCalendarProps {
  commodity?: string;
  data?: MonthlyPerformance[];
  onMonthClick?: (month: number, commodity: string) => void;
}

// ── Demo Data (10-year averages from industry sources) ─────────────
function generateSeasonalityData(): MonthlyPerformance[] {
  const commodities = [
    { code: 'GOLD', name: 'Gold', emoji: '🥇', color: '#FFD700' },
    { code: 'CRUDE', name: 'Crude Oil', emoji: '🛢️', color: '#FF8C00' },
    { code: 'COPPER', name: 'Copper', emoji: '🔩', color: '#B87333' },
    { code: 'NATGAS', name: 'Natural Gas', emoji: '🔥', color: '#4169E1' },
    { code: 'CORN', name: 'Corn', emoji: '🌽', color: '#228B22' },
    { code: 'SOYBEAN', name: 'Soybeans', emoji: '🫘', color: '#8B4513' },
  ];

  // Known seasonal patterns (approximate, from MRCI/SeasonAlgo research)
  const seasonalPatterns: Record<string, Record<number, { return: number; winRate: number; season: MonthlyPerformance['season']; label: string }>> = {
    GOLD: {
      1: { return: 2.1, winRate: 65, season: 'peak', label: 'January effect + Chinese New Year buying' },
      2: { return: 0.8, winRate: 55, season: 'transition', label: 'Post-CNY consolidation' },
      3: { return: -0.3, winRate: 40, season: 'off', label: 'Rate hike fears peak' },
      4: { return: 0.5, winRate: 50, season: 'transition', label: 'Wedding season India begins' },
      5: { return: 0.2, winRate: 45, season: 'off', label: 'Dollar strength drag' },
      6: { return: 1.8, winRate: 60, season: 'peak', label: 'Summer safe-haven demand' },
      7: { return: 1.2, winRate: 58, season: 'peak', label: 'Monsoon + Akshaya Tritiya' },
      8: { return: 1.5, winRate: 62, season: 'peak', label: 'Diwali festival buying + ETF inflows' },
      9: { return: 0.6, winRate: 52, season: 'transition', label: 'Post-festival consolidation' },
      10: { return: -0.8, winRate: 38, season: 'off', label: 'Equity rally rotation out of gold' },
      11: { return: 0.3, winRate: 48, season: 'transition', label: 'Indian wedding season resumes' },
      12: { return: 1.1, winRate: 55, season: 'transition', label: 'Year-end safe-haven positioning' },
    },
    CRUDE: {
      1: { return: 1.5, winRate: 55, season: 'transition', label: 'Winter demand + OPEC meeting' },
      2: { return: 2.8, winRate: 65, season: 'peak', label: 'Refinery maintenance + spring demand prep' },
      3: { return: 2.2, winRate: 60, season: 'peak', label: 'Driving season stockpiling' },
      4: { return: 1.0, winRate: 52, season: 'transition', label: 'OPEC quota decision flow' },
      5: { return: 2.5, winRate: 63, season: 'peak', label: 'Memorial Day → driving season begins' },
      6: { return: 1.8, winRate: 58, season: 'peak', label: 'Peak driving + hurricane risk premium' },
      7: { return: 2.0, winRate: 60, season: 'peak', label: 'Hurricane season peak + July 4th demand' },
      8: { return: 0.5, winRate: 48, season: 'off', label: 'Late summer demand dip' },
      9: { return: -1.2, winRate: 38, season: 'off', label: 'Post-driving season + refinery turnaround' },
      10: { return: -1.5, winRate: 35, season: 'off', label: 'Shoulder month — weakest demand period' },
      11: { return: 0.2, winRate: 45, season: 'transition', label: 'Winter heating demand begins' },
      12: { return: 1.3, winRate: 52, season: 'transition', label: 'Year-end OPEC quota positioning' },
    },
    COPPER: {
      1: { return: 2.5, winRate: 65, season: 'peak', label: 'Chinese restocking before CNY' },
      2: { return: 1.8, winRate: 60, season: 'peak', label: 'Construction season starts in China' },
      3: { return: 2.0, winRate: 62, season: 'peak', label: 'Peak construction + infrastructure spending' },
      4: { return: 1.2, winRate: 55, season: 'transition', label: 'LME warrant cancellations rise' },
      5: { return: -0.5, winRate: 42, season: 'off', label: 'Summer construction slowdown' },
      6: { return: 0.3, winRate: 48, season: 'transition', label: 'Mid-year restocking cycle' },
      7: { return: 1.0, winRate: 52, season: 'transition', label: 'Infrastructure budget mid-year review' },
      8: { return: -0.2, winRate: 44, season: 'off', label: 'Summer lull + European holidays' },
      9: { return: 1.5, winRate: 58, season: 'peak', label: 'Pre-Q4 construction stockpiling' },
      10: { return: 2.2, winRate: 62, season: 'peak', label: 'Q4 infrastructure push + power grid' },
      11: { return: 0.8, winRate: 53, season: 'transition', label: 'Year-end inventory drawdown' },
      12: { return: -0.5, winRate: 40, season: 'off', label: 'Fiscal year-end + winter slowdown' },
    },
    NATGAS: {
      1: { return: 3.5, winRate: 70, season: 'peak', label: 'Peak winter heating demand' },
      2: { return: 2.5, winRate: 65, season: 'peak', label: 'Polar vortex potential' },
      3: { return: -1.0, winRate: 40, season: 'off', label: 'Spring shoulder — injection season begins' },
      4: { return: -1.5, winRate: 35, season: 'off', label: 'Mild weather + storage builds' },
      5: { return: -0.8, winRate: 42, season: 'off', label: 'Pre-summer storage continues' },
      6: { return: 1.5, winRate: 55, season: 'transition', label: 'Early cooling demand + hurricane watch' },
      7: { return: 2.2, winRate: 60, season: 'peak', label: 'Peak cooling + hurricane disruptions' },
      8: { return: 2.0, winRate: 58, season: 'peak', label: 'Hot summer + AC demand' },
      9: { return: 0.5, winRate: 48, season: 'transition', label: 'Cooling demand fades' },
      10: { return: -1.2, winRate: 38, season: 'off', label: 'Storage refill peak' },
      11: { return: 1.0, winRate: 50, season: 'transition', label: 'Early winter heating demand' },
      12: { return: 2.8, winRate: 62, season: 'peak', label: 'Winter heating + holiday demand' },
    },
    CORN: {
      1: { return: -0.5, winRate: 45, season: 'off', label: 'South American harvest pressure' },
      2: { return: -0.3, winRate: 48, season: 'off', label: 'Post-harvest supply glut' },
      3: { return: 0.5, winRate: 52, season: 'transition', label: 'USDA planting intentions report' },
      4: { return: 1.2, winRate: 56, season: 'transition', label: 'Planting weather premium' },
      5: { return: 2.5, winRate: 65, season: 'peak', label: 'Planting progress + weather premium' },
      6: { return: 3.0, winRate: 68, season: 'peak', label: 'Weather scare premium + acreage report' },
      7: { return: 2.2, winRate: 62, season: 'peak', label: 'Pollination weather + WASDE report' },
      8: { return: 0.8, winRate: 50, season: 'transition', label: 'Crop tour estimates' },
      9: { return: -1.8, winRate: 30, season: 'off', label: 'Harvest pressure begins — weakest month' },
      10: { return: -1.5, winRate: 35, season: 'off', label: 'Full harvest + supply peak' },
      11: { return: -0.5, winRate: 42, season: 'off', label: 'Post-harvest + ethanol demand check' },
      12: { return: 0.2, winRate: 48, season: 'transition', label: 'Year-end demand + South America planting' },
    },
    SOYBEAN: {
      1: { return: -0.8, winRate: 42, season: 'off', label: 'Brazil harvest pressure' },
      2: { return: 1.0, winRate: 55, season: 'transition', label: 'USDA outlook forum' },
      3: { return: 1.5, winRate: 58, season: 'peak', label: 'China demand restocking + planting intentions' },
      4: { return: 0.5, winRate: 50, season: 'transition', label: 'Planting weather watch' },
      5: { return: 2.2, winRate: 63, season: 'peak', label: 'Planting progress + weather premium' },
      6: { return: 2.8, winRate: 65, season: 'peak', label: 'Weather scare + acreage report' },
      7: { return: 2.5, winRate: 60, season: 'peak', label: 'Pod-setting weather + WASDE' },
      8: { return: 0.2, winRate: 45, season: 'transition', label: 'Crop tour estimates' },
      9: { return: -2.0, winRate: 28, season: 'off', label: 'Harvest pressure — weakest month' },
      10: { return: -1.5, winRate: 32, season: 'off', label: 'Harvest peak + logistics' },
      11: { return: 0.5, winRate: 50, season: 'transition', label: 'China demand recovery + Brazil planting' },
      12: { return: 0.8, winRate: 52, season: 'transition', label: 'South America weather premium' },
    },
  };

  const data: MonthlyPerformance[] = [];
  commodities.forEach((com) => {
    const patterns = seasonalPatterns[com.code];
    if (!patterns) return;
    for (let m = 1; m <= 12; m++) {
      const p = patterns[m];
      data.push({
        month: m,
        commodity: com.code,
        avgReturn: p.return,
        winRate: p.winRate,
        season: p.season,
        label: p.label,
      });
    }
  });
  return data;
}

// ── Month Names ──────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COMMODITY_INFO: Record<string, { emoji: string; name: string; color: string }> = {
  GOLD: { emoji: '🥇', name: 'Gold', color: '#FFD700' },
  CRUDE: { emoji: '🛢️', name: 'Crude Oil', color: '#FF8C00' },
  COPPER: { emoji: '🔩', name: 'Copper', color: '#B87333' },
  NATGAS: { emoji: '🔥', name: 'Natural Gas', color: '#4169E1' },
  CORN: { emoji: '🌽', name: 'Corn', color: '#228B22' },
  SOYBEAN: { emoji: '🫘', name: 'Soybeans', color: '#8B4513' },
};

const SEASON_COLORS: Record<MonthlyPerformance['season'], string> = {
  peak: 'rgba(102,189,99,0.25)',
  off: 'rgba(244,109,67,0.25)',
  transition: 'rgba(212,168,83,0.12)',
};

const SEASON_BORDERS: Record<MonthlyPerformance['season'], string> = {
  peak: '#66bd63',
  off: '#f46d43',
  transition: '#d4a853',
};

// ── Component ────────────────────────────────────────────────────────
const SeasonalityCalendar: React.FC<SeasonalityCalendarProps> = ({
  commodity: propCommodity,
  data: propData,
  onMonthClick,
}) => {
  const [selected, setSelected] = useState<string>(propCommodity || 'GOLD');
  const allData = useMemo(() => propData || generateSeasonalityData(), [propData]);

  const commodityData = useMemo(
    () => allData.filter((d) => d.commodity === selected),
    [allData, selected],
  );

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const info = COMMODITY_INFO[selected];

  const summary = useMemo(() => {
    const peaks = commodityData.filter((d) => d.season === 'peak');
    const offs = commodityData.filter((d) => d.season === 'off');
    const bestMonth = peaks.length > 0 ? peaks.reduce((a, b) => (a.avgReturn > b.avgReturn ? a : b)) : null;
    const worstMonth = offs.length > 0 ? offs.reduce((a, b) => (a.avgReturn < b.avgReturn ? a : b)) : null;
    return { peaks: peaks.length, offs: offs.length, bestMonth, worstMonth };
  }, [commodityData]);

  // Circular layout: 12 segments positioned around a circle
  const ringSize = 320;
  const cx = ringSize / 2;
  const cy = ringSize / 2;
  const outerR = ringSize / 2 - 20;
  const innerR = outerR * 0.45;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>📅 Commodity Seasonality Calendar</h3>
        <p style={styles.subtitle}>10-year average monthly returns — know when to plant, when to harvest</p>
      </div>

      {/* Commodity Selector */}
      <div style={styles.selector}>
        {Object.entries(COMMODITY_INFO).map(([code, info]) => (
          <button
            key={code}
            style={{
              ...styles.comBtn,
              background: selected === code ? `${info.color}20` : '#0f0f1e',
              borderColor: selected === code ? info.color : '#2a2a4a',
              color: selected === code ? '#e0e0e0' : '#888',
            }}
            onClick={() => setSelected(code)}
          >
            <span style={{ fontSize: 16 }}>{info.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{info.name}</span>
          </button>
        ))}
      </div>

      {/* Ring Calendar */}
      <div style={styles.ringWrapper}>
        <svg width={ringSize} height={ringSize}>
          {/* Background ring */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#2a2a4a" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="#2a2a4a" strokeWidth={0.5} />

          {/* Month segments */}
          {commodityData.map((d) => {
            const startAngle = ((d.month - 1) / 12) * Math.PI * 2 - Math.PI / 2;
            const endAngle = (d.month / 12) * Math.PI * 2 - Math.PI / 2;
            const isCurrent = d.month === currentMonth;

            const x1 = cx + innerR * Math.cos(startAngle);
            const y1 = cy + innerR * Math.sin(startAngle);
            const x2 = cx + outerR * Math.cos(startAngle);
            const y2 = cy + outerR * Math.sin(startAngle);
            const x3 = cx + outerR * Math.cos(endAngle);
            const y3 = cy + outerR * Math.sin(endAngle);
            const x4 = cx + innerR * Math.cos(endAngle);
            const y4 = cy + innerR * Math.sin(endAngle);

            const path = `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${outerR},${outerR} 0 0,1 ${x3.toFixed(1)},${y3.toFixed(1)} L${x4.toFixed(1)},${y4.toFixed(1)} A${innerR},${innerR} 0 0,0 ${x1.toFixed(1)},${y1.toFixed(1)} Z`;

            return (
              <g key={d.month} onClick={() => onMonthClick?.(d.month, selected)} style={{ cursor: 'pointer' }}>
                <Tooltip
                  title={
                    <div style={styles.tooltip}>
                      <div style={styles.ttHeader}>{info.emoji} {info.name} — {MONTHS[d.month - 1]}</div>
                      <div style={styles.ttRow}><span>10yr Avg Return:</span><b style={{ color: d.avgReturn >= 0 ? '#66bd63' : '#f46d43' }}>{d.avgReturn >= 0 ? '+' : ''}{d.avgReturn.toFixed(1)}%</b></div>
                      <div style={styles.ttRow}><span>Win Rate:</span><b>{d.winRate}%</b></div>
                      <div style={styles.ttRow}><span>Season:</span><b style={{ color: SEASON_BORDERS[d.season] }}>{d.season === 'peak' ? '🟢 Peak' : d.season === 'off' ? '🔴 Off' : '🟡 Transition'}</b></div>
                      <div style={styles.ttInsight}>💡 {d.label}</div>
                    </div>
                  }
                >
                  <path d={path} fill={SEASON_COLORS[d.season]} stroke={isCurrent ? SEASON_BORDERS[d.season] : 'transparent'} strokeWidth={isCurrent ? 2.5 : 0.5} />
                </Tooltip>
              </g>
            );
          })}

          {/* Month Labels */}
          {MONTHS.map((m, i) => {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const labelR = (innerR + outerR) / 2;
            const lx = cx + labelR * Math.cos(angle);
            const ly = cy + labelR * Math.sin(angle);
            return (
              <text key={m} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
                fill={i + 1 === currentMonth ? '#d4a853' : '#aaa'} fontSize={10} fontWeight={i + 1 === currentMonth ? 800 : 400}
                style={{ pointerEvents: 'none' }}>
                {m}
              </text>
            );
          })}

          {/* Center text */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#e0e0e0" fontSize={18} fontWeight={700}>{info.emoji}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#aaa" fontSize={10}>{info.name}</text>
        </svg>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: SEASON_BORDERS.peak }} /> Peak (旺季)</span>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: SEASON_BORDERS.transition }} /> Transition</span>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: SEASON_BORDERS.off }} /> Off-season (淡季)</span>
        <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#d4a853', border: '2px solid #d4a853' }} /> Current Month</span>
      </div>

      {/* Summary Card */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Peak Months</span>
          <span style={{ ...styles.summaryValue, color: '#66bd63' }}>{summary.peaks} mo</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Best Month</span>
          <span style={{ ...styles.summaryValue, color: '#66bd63' }}>
            {summary.bestMonth ? `${MONTHS[summary.bestMonth.month - 1]} (+${summary.bestMonth.avgReturn.toFixed(1)}%)` : 'N/A'}
          </span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Worst Month</span>
          <span style={{ ...styles.summaryValue, color: '#f46d43' }}>
            {summary.worstMonth ? `${MONTHS[summary.worstMonth.month - 1]} (${summary.worstMonth.avgReturn.toFixed(1)}%)` : 'N/A'}
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
  header: { marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', margin: 0 },
  subtitle: { fontSize: 11, color: '#888', margin: '2px 0 0' },
  selector: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' },
  comBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 16, border: '1px solid #2a2a4a', background: '#0f0f1e', cursor: 'pointer', transition: 'all 0.15s' },
  ringWrapper: { display: 'flex', justifyContent: 'center', marginBottom: 10 },
  legend: { display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#aaa' },
  legendDot: { width: 10, height: 10, borderRadius: 2, display: 'inline-block' },
  summary: { display: 'flex', gap: 12, padding: '10px 14px', background: '#0f0f1e', borderRadius: 8 },
  summaryItem: { flex: 1, textAlign: 'center' },
  summaryLabel: { display: 'block', fontSize: 9, color: '#888', textTransform: 'uppercase', marginBottom: 2 },
  summaryValue: { fontSize: 12, fontFamily: 'monospace', fontWeight: 700 },
  tooltip: { fontSize: 12, lineHeight: 1.8, minWidth: 160 },
  ttHeader: { fontWeight: 700, marginBottom: 4, fontSize: 13 },
  ttRow: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  ttInsight: { marginTop: 6, paddingTop: 6, borderTop: '1px solid #4a4a6a', color: '#ccc' },
};

export { SeasonalityCalendar, generateSeasonalityData, MONTHS, COMMODITY_INFO };
export type { SeasonalityCalendarProps, MonthlyPerformance };
