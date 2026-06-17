import { useState, useMemo } from 'react';

// ── Multi-Stock K-line Overlay ── ML#4 R266 (4h)
// Overlay multiple stocks on same chart for relative strength comparison

interface OverlayStock {
  symbol: string;
  name: string;
  color: string;
  prices: { close: number; date: string }[];
  changePct: number;
}

interface MultiStockOverlayProps {
  stocks: OverlayStock[];
  baseIndex?: number; // rebase to percentage from index
}

const PRESET_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const MultiStockOverlay = ({ stocks, baseIndex = 0 }: MultiStockOverlayProps) => {
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set(stocks.slice(0, 5).map(s => s.symbol)));
  const [showPercent, setShowPercent] = useState(true);
  const [referenceSymbol, _setReferenceSymbol] = useState<string | null>(null);
  const [showSpread, setShowSpread] = useState(false);
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);

  const available = useMemo(() => stocks.filter(s => selectedStocks.has(s.symbol)), [stocks, selectedStocks]);

  const toggleStock = (symbol: string) => {
    const next = new Set(selectedStocks);
    if (next.has(symbol)) next.delete(symbol);
    else next.add(symbol);
    setSelectedStocks(next);
  };

  // Normalize data for overlay
  const normalizedData = useMemo(() => {
    if (available.length === 0) return [];
    const maxLen = Math.max(...available.map(s => s.prices.length));
    const result: { date: string; series: Record<string, number> }[] = [];

    for (let i = 0; i < maxLen; i++) {
      const entry: { date: string; series: Record<string, number> } = { date: '', series: {} };
      for (const stock of available) {
        const idx = i - (maxLen - stock.prices.length);
        if (idx >= 0) {
          const p = stock.prices[idx].close;
          const baseP = stock.prices[Math.max(0, idx - baseIndex)]?.close || p;
          entry.series[stock.symbol] = showPercent ? ((p - baseP) / baseP) * 100 : p;
          entry.date = stock.prices[idx].date;
        }
      }

      // Spread calculation
      if (showSpread && selectedPair && entry.series[selectedPair[0]] != null && entry.series[selectedPair[1]] != null) {
        entry.series['__spread__'] = entry.series[selectedPair[0]] - entry.series[selectedPair[1]];
      }

      result.push(entry);
    }
    return result;
  }, [available, showPercent, baseIndex, referenceSymbol, showSpread, selectedPair]);

  // Stats
  const stats = useMemo(() => {
    return available.map(stock => {
      const p = stock.prices;
      if (p.length < 2) return { ...stock, high: 0, low: 0, avg: 0, vol: 0 };
      const pcts = p.map((pt, i) => i > 0 ? ((pt.close - p[i - 1].close) / p[i - 1].close) * 100 : 0).slice(1);
      return {
        ...stock,
        high: Math.max(...p.map(pt => pt.close)),
        low: Math.min(...p.map(pt => pt.close)),
        avg: p.reduce((s, pt) => s + pt.close, 0) / p.length,
        vol: pcts.reduce((s, v) => s + v * v, 0) / pcts.length,
      };
    });
  }, [available]);

  const chartWidth = 480;
  const chartHeight = 300;

  if (stocks.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 13 }}>
        请先添加股票到对比列表
      </div>
    );
  }

  return (
    <div className="multi-stock-overlay" style={{ padding: 12, fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>📊 多股K线叠加</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{available.length}/{stocks.length} 已选</span>
      </div>

      {/* Stock Selector */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {stocks.map((stock, i) => (
          <button
            key={stock.symbol}
            onClick={() => toggleStock(stock.symbol)}
            style={{
              padding: '4px 10px', borderRadius: 16, border: `2px solid ${stock.color || PRESET_COLORS[i % PRESET_COLORS.length]}`,
              background: selectedStocks.has(stock.symbol) ? (stock.color || PRESET_COLORS[i % PRESET_COLORS.length]) : 'white',
              color: selectedStocks.has(stock.symbol) ? 'white' : (stock.color || PRESET_COLORS[i % PRESET_COLORS.length]),
              fontWeight: 500, fontSize: 11, cursor: 'pointer',
            }}
          >
            {stock.symbol} {stock.changePct > 0 ? `+${stock.changePct.toFixed(1)}%` : `${stock.changePct.toFixed(1)}%`}
          </button>
        ))}
      </div>

      {/* Mode Toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input type="checkbox" checked={showPercent} onChange={e => setShowPercent(e.target.checked)} />
          %百分比
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <input type="checkbox" checked={showSpread} onChange={e => setShowSpread(e.target.checked)} />
          价差
        </label>
        {showSpread && (
          <select
            onChange={e => {
              const [a, b] = e.target.value.split('-');
              setSelectedPair([a, b]);
            }}
            style={{ fontSize: 10, padding: '0 4px' }}
          >
            <option value="">选择对比对</option>
            {available.slice(0, 5).flatMap((a, i) =>
              available.slice(i + 1, i + 5).map(b => (
                <option key={`${a.symbol}-${b.symbol}`} value={`${a.symbol}-${b.symbol}`}>
                  {a.symbol} vs {b.symbol}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      {/* Chart */}
      {normalizedData.length > 0 && (
        <div style={{ position: 'relative', width: chartWidth + 60, height: chartHeight + 40 }}>
          <svg width={chartWidth + 60} height={chartHeight + 40}>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => (
              <line key={f} x1={40} y1={10 + f * chartHeight} x2={40 + chartWidth} y2={10 + f * chartHeight} stroke="#f1f5f9" strokeWidth={1} />
            ))}

            {/* Y-axis labels */}
            {[1, 0.75, 0.5, 0.25, 0].map(f => {
              const allVals = normalizedData.flatMap(d => Object.values(d.series).filter(v => v != null && !String(v).startsWith('__')));
              const maxV = Math.max(...allVals, 1);
              const minV = Math.min(...allVals, 0);
              const val = minV + (maxV - minV) * f;
              return (
                <text key={f} x={35} y={14 + f * chartHeight} textAnchor="end" fontSize={9} fill="#94a3b8">
                  {showPercent ? `${val.toFixed(1)}%` : val.toFixed(2)}
                </text>
              );
            })}

            {/* Lines */}
            {available.map((stock, si) => {
              const points = normalizedData
                .map((d, i) => {
                  const v = d.series[stock.symbol];
                  if (v == null) return null;
                  const allVals = normalizedData.flatMap(dd => Object.values(dd.series).filter(vv => vv != null && !String(vv).startsWith('__')));
                  const maxV = Math.max(...allVals, 1);
                  const minV = Math.min(...allVals, 0);
                  const x = 40 + (i / (normalizedData.length - 1 || 1)) * chartWidth;
                  const y = 10 + chartHeight - ((v - minV) / (maxV - minV || 1)) * chartHeight;
                  return `${x},${y}`;
                })
                .filter(Boolean)
                .join(' ');

              if (points.length < 10) return null;

              return (
                <g key={stock.symbol}>
                  <polyline points={points} fill="none" stroke={stock.color || PRESET_COLORS[si % PRESET_COLORS.length]} strokeWidth={1.5} opacity={0.8} />
                  {/* Last point label */}
                  {(() => {
                    const last = normalizedData[normalizedData.length - 1];
                    const v = last?.series[stock.symbol];
                    if (v == null) return null;
                    const allVals = normalizedData.flatMap(d => Object.values(d.series).filter(vv => vv != null && !String(vv).startsWith('__')));
                    const maxV = Math.max(...allVals, 1);
                    const minV = Math.min(...allVals, 0);
                    const y = 10 + chartHeight - ((v - minV) / (maxV - minV || 1)) * chartHeight;
                    return (
                      <text x={40 + chartWidth + 4} y={y + 4} fontSize={9} fill={stock.color || PRESET_COLORS[si % PRESET_COLORS.length]} fontWeight={600}>
                        {stock.symbol}
                      </text>
                    );
                  })()}
                </g>
              );
            })}

            {/* Spread line */}
            {showSpread && selectedPair && (() => {
              const spreadPoints = normalizedData
                .map((d, i) => {
                  const v = d.series['__spread__'];
                  if (v == null) return null;
                  const allSpreads = normalizedData.map(dd => dd.series['__spread__']).filter(vv => vv != null);
                  const maxS = Math.max(...(allSpreads as number[]), 1);
                  const minS = Math.min(...(allSpreads as number[]), -1);
                  const x = 40 + (i / (normalizedData.length - 1 || 1)) * chartWidth;
                  const y = 10 + chartHeight - ((v - minS) / (maxS - minS || 1)) * chartHeight;
                  return `${x},${y}`;
                })
                .filter(Boolean)
                .join(' ');
              return spreadPoints.length > 10 ? (
                <polyline points={spreadPoints} fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,2" opacity={0.6} />
              ) : null;
            })()}
          </svg>
        </div>
      )}

      {/* Stats Table */}
      <div style={{ marginTop: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>代码</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>最新价</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>涨跌幅</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>最高</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>最低</th>
              <th style={{ textAlign: 'right', padding: '4px 8px' }}>波幅</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.symbol} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '3px 8px' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color || PRESET_COLORS[i % PRESET_COLORS.length], marginRight: 4 }} />
                  {s.symbol}
                </td>
                <td style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 500 }}>{s.avg.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '3px 8px', color: s.changePct >= 0 ? '#16a34a' : '#dc2626' }}>
                  {s.changePct >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
                </td>
                <td style={{ textAlign: 'right', padding: '3px 8px' }}>{s.high.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '3px 8px' }}>{s.low.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '3px 8px' }}>{s.vol.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tip */}
      <div style={{ marginTop: 8, fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
        💡 提示：叠加多股走势可快速对比相对强弱。百分比模式以选定基点对齐，适合配对交易和行业轮动分析。
      </div>
    </div>
  );
};

export default MultiStockOverlay;
