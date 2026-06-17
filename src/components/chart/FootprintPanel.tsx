import { useState, useMemo } from 'react';

// ── Footprint Chart Frontend ── ML#4 R269 (2h)
// Volume footprint: bid/ask volume per price level per candle

interface FootprintCell {
  bidVol: number;
  askVol: number;
  totalVol: number;
  delta: number;
  price: number;
}

interface FootprintRow {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  cells: FootprintCell[];
  totalBid: number;
  totalAsk: number;
  totalDelta: number;
  poc?: number;
}

interface FootprintPanelProps {
  rows: FootprintRow[];
  symbol: string;
  tickSize: number;
}

const FootprintPanel = ({ rows, tickSize }: FootprintPanelProps) => {
  const [compact, setCompact] = useState(false);
  const [showDelta, setShowDelta] = useState(true);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const summary = useMemo(() => {
    if (rows.length === 0) return { totalBid: 0, totalAsk: 0, totalDelta: 0, deltaPct: 0 };
    const b = rows.reduce((s, r) => s + r.totalBid, 0);
    const a = rows.reduce((s, r) => s + r.totalAsk, 0);
    const d = rows.reduce((s, r) => s + r.totalDelta, 0);
    return { totalBid: b, totalAsk: a, totalDelta: d, deltaPct: ((b - a) / (b + a || 1)) * 100 };
  }, [rows]);

  const formatVol = (v: number) => {
    if (v >= 10000) return (v / 10000).toFixed(1) + '万';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toFixed(0);
  };

  if (rows.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 13 }}>👣 暂无Footprint数据</div>;
  }

  return (
    <div className="footprint-panel" style={{ padding: 8, fontFamily: 'monospace', fontSize: 10, maxWidth: 500, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>👣 Footprint</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <label style={{ fontSize: 8, color: '#64748b', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input type="checkbox" checked={showDelta} onChange={e => setShowDelta(e.target.checked)} />
            Δ
          </label>
          <label style={{ fontSize: 8, color: '#64748b', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)} />
            紧凑
          </label>
        </div>
      </div>

      {/* Summary Bar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 8, padding: 6, borderRadius: 6,
        background: summary.totalDelta >= 0 ? '#f0fdf4' : '#fef2f2',
        fontSize: 9,
      }}>
        <div>
          <span style={{ color: '#64748b' }}>Bid: </span>
          <span style={{ fontWeight: 600, color: '#16a34a' }}>{formatVol(summary.totalBid)}</span>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Ask: </span>
          <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatVol(summary.totalAsk)}</span>
        </div>
        <div>
          <span style={{ color: '#64748b' }}>Delta: </span>
          <span style={{ fontWeight: 700, color: summary.totalDelta >= 0 ? '#16a34a' : '#dc2626' }}>
            {summary.totalDelta >= 0 ? '+' : ''}{formatVol(summary.totalDelta)}
          </span>
          <span style={{ marginLeft: 4, color: summary.deltaPct >= 0 ? '#16a34a' : '#dc2626' }}>
            ({summary.deltaPct >= 0 ? '+' : ''}{summary.deltaPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Footprint Rows */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {rows.slice(-20).reverse().map((row, ri) => {
          const isSelected = selectedRow === ri;
          const maxCellVol = Math.max(...row.cells.map(c => c.totalVol), 1);
          const rowColor = row.close >= row.open ? '#16a34a' : '#dc2626';

          return (
            <div key={ri} style={{ marginBottom: 2 }}>
              {/* Candle summary row */}
              <div
                onClick={() => setSelectedRow(isSelected ? null : ri)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px',
                  borderRadius: 3, cursor: 'pointer',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ minWidth: 40, fontSize: 8, color: '#94a3b8' }}>{row.time}</span>
                <span style={{ color: rowColor, fontWeight: 600, minWidth: 50, textAlign: 'right' }}>
                  {row.close.toFixed(tickSize < 1 ? 2 : 0)}
                </span>
                {!compact && (
                  <span style={{ color: rowColor, fontSize: 8, minWidth: 40, textAlign: 'right' }}>
                    {row.close >= row.open ? '+' : ''}{((row.close - row.open) / row.open * 100).toFixed(2)}%
                  </span>
                )}
                <span style={{ color: '#16a34a', fontSize: 8, minWidth: 40, textAlign: 'right' }}>
                  B:{formatVol(row.totalBid)}
                </span>
                <span style={{ color: '#dc2626', fontSize: 8, minWidth: 40, textAlign: 'right' }}>
                  A:{formatVol(row.totalAsk)}
                </span>
                {showDelta && (
                  <span style={{
                    fontSize: 8, fontWeight: 600, minWidth: 50, textAlign: 'right',
                    color: row.totalDelta >= 0 ? '#16a34a' : '#dc2626',
                  }}>
                    Δ {row.totalDelta >= 0 ? '+' : ''}{formatVol(row.totalDelta)}
                  </span>
                )}
              </div>

              {/* Expanded cells */}
              {isSelected && (
                <div style={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {row.cells.slice(0, compact ? 5 : 10).map((cell, ci) => {
                    const barW = (cell.totalVol / maxCellVol) * 100;
                    return (
                      <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 7 }}>
                        <span style={{ minWidth: 50, textAlign: 'right', color: '#94a3b8' }}>
                          {cell.price.toFixed(tickSize < 1 ? 2 : 0)}
                        </span>
                        <div style={{
                          flex: 1, height: 10, position: 'relative', background: '#f1f5f9', borderRadius: 2,
                        }}>
                          {/* Bid (left) */}
                          <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${(cell.bidVol / cell.totalVol) * barW}%`,
                            background: '#16a34a', opacity: 0.6, borderRadius: '2px 0 0 2px',
                          }} />
                          {/* Ask (right) */}
                          <div style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0,
                            width: `${(cell.askVol / cell.totalVol) * barW}%`,
                            background: '#dc2626', opacity: 0.4, borderRadius: '0 2px 2px 0',
                          }} />
                          {/* Volume text */}
                          <span style={{
                            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                            fontSize: 6, color: '#64748b', whiteSpace: 'nowrap',
                          }}>
                            {formatVol(cell.totalVol)}
                          </span>
                        </div>
                        <span style={{ minWidth: 35, textAlign: 'right', color: cell.delta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                          {cell.delta >= 0 ? '+' : ''}{formatVol(cell.delta)}
                        </span>
                      </div>
                    );
                  })}
                  {row.cells.length > (compact ? 5 : 10) && (
                    <div style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center' }}>
                      +{row.cells.length - (compact ? 5 : 10)} 更多...
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 8, color: '#94a3b8' }}>
        <span>🟢 Bid (买家主动)</span>
        <span>🔴 Ask (卖家主动)</span>
        <span>Δ = Bid - Ask (正=净买入)</span>
        <span>tick: {tickSize}</span>
      </div>
    </div>
  );
};

export default FootprintPanel;
