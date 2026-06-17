import { useState, useMemo } from 'react';

// ── DOM (Depth of Market) Panel ── ML#5 R269 (2h)
// Full depth-of-market order book visualization

interface DOMLevel {
  price: number;
  bidSize: number;
  askSize: number;
  bidTotal: number;
  askTotal: number;
}

interface DOMPanelProps {
  levels: DOMLevel[];
  currentPrice: number;
  symbol: string;
  totalBid: number;
  totalAsk: number;
  spread: number;
  spreadPct: number;
}

const DOMPanel = ({ levels, currentPrice, symbol, totalBid, totalAsk, spread, spreadPct }: DOMPanelProps) => {
  const [depth, setDepth] = useState(10);
  const [showImbalance] = useState(true);
  const [highlightLarge, setHighlightLarge] = useState(true);

  const visibleLevels = useMemo(() => {
    const sorted = [...levels].sort((a, b) => b.price - a.price);
    const cpIdx = sorted.findIndex(l => l.price <= currentPrice);
    const start = Math.max(0, cpIdx - depth - 1);
    const end = Math.min(sorted.length, cpIdx + depth + 1);
    return sorted.slice(start, end);
  }, [levels, currentPrice, depth]);

  const maxSize = useMemo(() => {
    return Math.max(...levels.map(l => Math.max(l.bidSize, l.askSize, 1)));
  }, [levels]);

  const formatSize = (s: number) => {
    if (s >= 10000) return (s / 10000).toFixed(1) + '万';
    if (s >= 1000) return (s / 1000).toFixed(1) + 'K';
    return s.toFixed(0);
  };

  const imbalanceBid = useMemo(() => {
    if (levels.length === 0) return 0;
    const allBid = levels.filter(l => l.price <= currentPrice).reduce((s, l) => s + l.bidSize, 0);
    const allAsk = levels.filter(l => l.price >= currentPrice).reduce((s, l) => s + l.askSize, 0);
    return ((allBid - allAsk) / (allBid + allAsk || 1)) * 100;
  }, [levels, currentPrice]);

  return (
    <div className="dom-panel" style={{ padding: 8, fontFamily: 'monospace', fontSize: 11, maxWidth: 400 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>📖 DOM 订单簿</span>
        <span style={{ fontSize: 9, color: '#94a3b8' }}>{symbol}</span>
      </div>

      {/* Imbalance Bar */}
      {showImbalance && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
            <span style={{ color: '#16a34a' }}>买 {formatSize(totalBid)}</span>
            <span style={{ color: '#dc2626' }}>卖 {formatSize(totalAsk)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', display: 'flex', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(0, Math.min(100, 50 + imbalanceBid / 2))}%`,
              background: '#16a34a', transition: 'width 0.3s',
            }} />
            <div style={{
              flex: 1,
              background: '#dc2626',
            }} />
          </div>
          <div style={{ fontSize: 9, color: '#64748b', textAlign: 'center', marginTop: 2 }}>
            买卖失衡: {imbalanceBid >= 0 ? '+' : ''}{imbalanceBid.toFixed(1)}%
          </div>
        </div>
      )}

      {/* Spread */}
      <div style={{
        padding: 6, borderRadius: 6, marginBottom: 6,
        background: '#f8fafc', display: 'flex', justifyContent: 'space-between',
        fontSize: 10,
      }}>
        <span>点差: <b>{spread.toFixed(2)}</b></span>
        <span>百分比: <b>{spreadPct.toFixed(3)}%</b></span>
        <span>档位: <b>{depth}</b></span>
      </div>

      {/* Depth Selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[5, 10, 20, 50].map(d => (
          <button key={d} onClick={() => setDepth(d)} style={{
            padding: '2px 6px', borderRadius: 8, border: 'none', fontSize: 9, cursor: 'pointer',
            background: depth === d ? '#3b82f6' : '#f1f5f9',
            color: depth === d ? 'white' : '#64748b',
          }}>{d}档</button>
        ))}
        <label style={{ marginLeft: 'auto', fontSize: 9, color: '#64748b', display: 'flex', alignItems: 'center', gap: 2 }}>
          <input type="checkbox" checked={highlightLarge} onChange={e => setHighlightLarge(e.target.checked)} />
          大单
        </label>
      </div>

      {/* DOM Table */}
      <div style={{ maxHeight: 400, overflowY: 'auto', fontSize: 10 }}>
        {/* Column Headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '60px 1fr 70px 70px 1fr',
          gap: 4, padding: '2px 4px', borderBottom: '1px solid #e5e7eb', color: '#94a3b8', fontSize: 8,
        }}>
          <span style={{ textAlign: 'right' }}>价格</span>
          <span style={{ textAlign: 'center' }}>买单量</span>
          <span style={{ textAlign: 'right' }}>买单累计</span>
          <span style={{ textAlign: 'right' }}>卖单累计</span>
          <span style={{ textAlign: 'center' }}>卖单量</span>
        </div>

        {visibleLevels.map((level, i) => {
          const isAbove = level.price > currentPrice;
          const bidPct = (level.bidSize / maxSize) * 100;
          const askPct = (level.askSize / maxSize) * 100;
          const isLargeBid = level.bidSize > maxSize * 0.5;
          const isLargeAsk = level.askSize > maxSize * 0.5;

          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 70px 70px 1fr',
              gap: 4, padding: '1px 4px', alignItems: 'center',
              background: level.price === currentPrice ? '#fef9c3' :
                         isAbove ? '#fef2f2' + (highlightLarge && isLargeAsk ? '80' : '30') :
                                  '#f0fdf4' + (highlightLarge && isLargeBid ? '80' : '30'),
              borderBottom: '1px solid #f8fafc',
            }}>
              <span style={{ textAlign: 'right', fontWeight: level.price === currentPrice ? 700 : 400, color: isAbove ? '#dc2626' : '#16a34a' }}>
                {level.price.toFixed(2)}
                {level.price === currentPrice && ' ★'}
              </span>

              {/* Bid bar */}
              <div style={{ position: 'relative', height: 14 }}>
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0,
                  width: `${bidPct}%`, background: '#16a34a', opacity: 0.3,
                  borderRadius: 2,
                }} />
                <span style={{
                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 8, color: '#16a34a', fontWeight: isLargeBid ? 700 : 400,
                }}>
                  {formatSize(level.bidSize)}
                </span>
              </div>

              <span style={{ textAlign: 'right', fontSize: 8, color: '#94a3b8' }}>
                {formatSize(level.bidTotal)}
              </span>
              <span style={{ textAlign: 'right', fontSize: 8, color: '#94a3b8' }}>
                {formatSize(level.askTotal)}
              </span>

              {/* Ask bar */}
              <div style={{ position: 'relative', height: 14 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${askPct}%`, background: '#dc2626', opacity: 0.3,
                  borderRadius: 2,
                }} />
                <span style={{
                  position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 8, color: '#dc2626', fontWeight: isLargeAsk ? 700 : 400,
                }}>
                  {formatSize(level.askSize)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 8, color: '#94a3b8' }}>
        <span>🟢 Bid 买盘</span>
        <span>🔴 Ask 卖盘</span>
        <span>★ 最新价</span>
        <span>粗体=大单</span>
      </div>
    </div>
  );
};

export default DOMPanel;
