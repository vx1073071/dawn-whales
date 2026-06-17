import { useState, useMemo } from 'react';

// ── Chip Distribution / Position Cost UI ── ML#5 R267 (4h)
// Visualizes chip distribution at different price levels

interface ChipLevel {
  price: number;
  chipRatio: number;     // % of total chips at this level
  avgCost: number;       // average cost at this level
  profitRatio: number;   // % of chips in profit
  trappedRatio: number;  // % of chips trapped (underwater)
}

interface ChipDistributionPanelProps {
  symbol: string;
  price: number;
  chips: ChipLevel[];
  totalChips: number;
}

const ChipDistributionPanel = ({ price, chips }: ChipDistributionPanelProps) => {
  const [showDualPeak, setShowDualPeak] = useState(false);

  const enriched = useMemo(() => {
    if (chips.length === 0) return null;

    const sorted = [...chips].sort((a, b) => a.price - b.price);
    const prices = sorted.map(c => c.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;

    // Find peaks (local maxima of chip concentration)
    const peaks: ChipLevel[] = [];
    for (let i = 1; i < sorted.length - 1; i++) {
      if (sorted[i].chipRatio > sorted[i - 1].chipRatio && sorted[i].chipRatio > sorted[i + 1].chipRatio) {
        peaks.push(sorted[i]);
      }
    }

    // Calculate concentration
    const top3 = [...sorted].sort((a, b) => b.chipRatio - a.chipRatio).slice(0, 3);
    const concentration = top3.reduce((s, c) => s + c.chipRatio, 0) / chips.reduce((s, c) => s + c.chipRatio, 1) * 100;

    // Profit/loss ratio
    const totalProfitChips = chips.filter(c => c.price <= price).reduce((s, c) => s + c.chipRatio, 0);
    const totalTrappedChips = chips.filter(c => c.price > price).reduce((s, c) => s + c.chipRatio, 0);
    const totalChipSum = chips.reduce((s, c) => s + c.chipRatio, 1);

    return {
      sorted, minP, maxP, range, peaks, top3, concentration,
      profitPct: (totalProfitChips / totalChipSum) * 100,
      trappedPct: (totalTrappedChips / totalChipSum) * 100,
    };
  }, [chips, price]);

  const chartW = 300, chartH = 250;

  if (!enriched || chips.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 13 }}>🎯 暂无筹码分布数据</div>;
  }

  return (
    <div className="chip-distribution" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🎯 筹码分布</span>
        <label style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input type="checkbox" checked={showDualPeak} onChange={e => setShowDualPeak(e.target.checked)} />
          双峰
        </label>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div style={{ padding: 8, borderRadius: 6, background: '#f0fdf4', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748b' }}>获利盘</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{enriched.profitPct.toFixed(1)}%</div>
        </div>
        <div style={{ padding: 8, borderRadius: 6, background: '#fef2f2', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748b' }}>套牢盘</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{enriched.trappedPct.toFixed(1)}%</div>
        </div>
        <div style={{ padding: 8, borderRadius: 6, background: '#f8fafc', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748b' }}>集中度</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {enriched.concentration.toFixed(1)}%
          </div>
          <div style={{ fontSize: 9, color: enriched.concentration > 60 ? '#f59e0b' : '#64748b' }}>
            {enriched.concentration > 70 ? '高度集中' : enriched.concentration > 50 ? '中等' : '分散'}
          </div>
        </div>
      </div>

      {/* Chip Chart */}
      <div style={{ position: 'relative', width: chartW + 50, height: chartH + 20 }}>
        <svg width={chartW + 50} height={chartH + 20}>
          {/* Price axis labels */}
          {[enriched.maxP, (enriched.maxP + enriched.minP) / 2, enriched.minP].map((p, i) => (
            <text key={i} x={0} y={15 + (i / 2) * chartH} fontSize={9} fill="#94a3b8">
              {p.toFixed(2)}
            </text>
          ))}

          {/* Chip bars (horizontal, area fills) */}
          <clipPath id="chip-clip"><rect x={30} y={5} width={chartW - 10} height={chartH} /></clipPath>
          <g clipPath="url(#chip-clip)">
            {enriched.sorted.map((ch, i) => {
              const maxR = Math.max(...enriched.sorted.map(c => c.chipRatio), 1);
              const barW = (ch.chipRatio / maxR) * (chartW - 40);
              const yFrac = (ch.price - enriched.minP) / (enriched.range || 1);
              const y = 5 + (1 - yFrac) * chartH;
              const barH = Math.max(3, chartH / enriched.sorted.length);

              const isBelow = ch.price <= price;
              return (
                <rect
                  key={i}
                  x={30} y={y - barH / 2}
                  width={barW} height={barH}
                  fill={isBelow ? '#16a34a' : '#ef4444'}
                  opacity={isBelow ? 0.7 : 0.4}
                  rx={1}
                />
              );
            })}

            {/* Current price line */}
            <line
              x1={30} x2={chartW - 10}
              y1={5 + (1 - (price - enriched.minP) / (enriched.range || 1)) * chartH}
              y2={5 + (1 - (price - enriched.minP) / (enriched.range || 1)) * chartH}
              stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,2"
            />
            <text
              x={chartW - 10} y={5 + (1 - (price - enriched.minP) / (enriched.range || 1)) * chartH - 4}
              fontSize={8} fill="#f59e0b" textAnchor="end" fontWeight={600}
            >
              {price.toFixed(2)}
            </text>
          </g>
        </svg>
      </div>

      {/* Peaks Analysis */}
      {enriched.peaks.length >= 2 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
            ⛰️ 筹码峰分析
          </div>
          <div style={{ fontSize: 10 }}>
            {enriched.peaks[0].price < price ? (
              <span style={{ color: '#16a34a' }}>
                下峰在 {enriched.peaks[0].price.toFixed(2)}（支撑位），上峰在 {enriched.peaks[1].price.toFixed(2)}（压力位）。
                {price < enriched.peaks[1].price ? ' 突破上峰需放量配合。' : ' 已站上双峰，筹码分布有利。'}
              </span>
            ) : (
              <span style={{ color: '#dc2626' }}>
                当前价低于第一筹码峰 {enriched.peaks[0].price.toFixed(2)}，上方压力较大。
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top 3 concentration levels */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
          📍 筹码密集区 (Top 3)
        </div>
        {enriched.top3.map((ch, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '3px 6px', borderRadius: 4, marginBottom: 2,
            background: ch.price <= price ? '#f0fdf4' : '#fef2f2', fontSize: 10,
          }}>
            <span>{ch.price.toFixed(2)}</span>
            <div style={{ flex: 1, margin: '0 8px', height: 6, borderRadius: 3, background: '#e5e7eb' }}>
              <div style={{
                height: 6, borderRadius: 3,
                width: `${(ch.chipRatio / enriched.top3[0].chipRatio) * 100}%`,
                background: ch.price <= price ? '#16a34a' : '#ef4444',
              }} />
            </div>
            <span style={{ color: '#64748b' }}>{ch.chipRatio.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {/* Interpretation */}
      <div style={{ marginTop: 8, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 10, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 筹码解读:</div>
        {enriched.profitPct > 70 ? (
          <span>70%以上筹码获利 → 抛压较小，但需警惕获利盘了结。</span>
        ) : enriched.trappedPct > 70 ? (
          <span>70%以上筹码套牢 → 上方压力重，突破需要强催化。</span>
        ) : (
          <span>获利/套牢均衡 → 多空博弈，关注筹码峰变化方向。</span>
        )}
        {enriched.concentration > 70 && <span> ⚠️ 筹码高度集中 → 主力控盘度高，波动可能加大。</span>}
      </div>

      {/* Comparison note */}
      <div style={{ marginTop: 6, fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>
        🎯 筹码分布 vs 同花顺 · 数据每日盘后更新 · 不构成投资建议
      </div>
    </div>
  );
};

export default ChipDistributionPanel;
