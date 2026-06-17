import { useState, useMemo } from 'react';

// ── Tick Chart Integration ── ML#5 R271 (2h)
// Real-time intraday tick chart with VWAP and volume profile

interface TickData {
  time: string;
  price: number;
  volume: number;
  avgPrice: number;
  cumulativeVol: number;
  direction: 'up' | 'down' | 'flat';
}

interface TickChartProps {
  symbol: string;
  ticks: TickData[];
  prevClose: number;
  width?: number;
  height?: number;
}

const TickChartIntegration = ({ symbol, ticks, prevClose, width = 600, height = 280 }: TickChartProps) => {
  const [showVWAP, setShowVWAP] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const chartData = useMemo(() => {
    if (ticks.length === 0) return null;
    const prices = ticks.map(t => t.price);
    const allVals = [...prices, prevClose];
    const minP = Math.min(...allVals) * 0.998;
    const maxP = Math.max(...allVals) * 1.002;
    const range = maxP - minP || 1;

    const maxVol = Math.max(...ticks.map(t => t.volume), 1);
    const changePct = ((prices[prices.length - 1] - prevClose) / prevClose) * 100;
    const isUp = changePct >= 0;

    return { minP, maxP, range, maxVol, changePct, isUp, prices };
  }, [ticks, prevClose]);

  if (!chartData) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>📈 等待分时数据...</div>;
  }

  const { minP, range, maxVol, changePct, isUp } = chartData;
  const color = isUp ? '#22c55e' : '#dc2626';
  const bgColor = isUp ? '#f0fdf4' : '#fef2f2';
  const W = width, H = height;
  const PAD_LEFT = 50, PAD_RIGHT = 10, PAD_TOP = 10, PAD_BOT = 30;
  const CW = W - PAD_LEFT - PAD_RIGHT;
  const CH = H - PAD_TOP - PAD_BOT;

  // Build price line points
  const pricePath = ticks.map((t, i) => {
    const x = PAD_LEFT + (i / (ticks.length - 1 || 1)) * CW;
    const y = PAD_TOP + CH - ((t.price - minP) / range) * CH;
    return `${x},${y}`;
  }).join(' ');

  const avgPath = ticks.map((t, i) => {
    const x = PAD_LEFT + (i / (ticks.length - 1 || 1)) * CW;
    const y = PAD_TOP + CH - ((t.avgPrice - minP) / range) * CH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="tick-chart" style={{ padding: 8, fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, padding: '0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>📈 {symbol} 分时图</span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: isUp ? '#16a34a' : '#dc2626',
            background: bgColor, padding: '1px 8px', borderRadius: 4,
          }}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{ fontSize: 9, color: '#64748b', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input type="checkbox" checked={showVWAP} onChange={e => setShowVWAP(e.target.checked)} />
            VWAP
          </label>
          <label style={{ fontSize: 9, color: '#64748b', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input type="checkbox" checked={showVolume} onChange={e => setShowVolume(e.target.checked)} />
            量
          </label>
          <label style={{ fontSize: 9, color: '#64748b', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
            网格
          </label>
        </div>
      </div>

      {/* Chart SVG */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Background */}
        <rect x={PAD_LEFT} y={PAD_TOP} width={CW} height={CH} fill={isUp ? '#f0fdf4' : '#fef2f2'} opacity={0.3} />

        {/* Grid */}
        {showGrid && [0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={PAD_LEFT} y1={PAD_TOP + f * CH} x2={W - PAD_RIGHT} y2={PAD_TOP + f * CH}
            stroke="#e5e7eb" strokeWidth={0.5} />
        ))}

        {/* Yesterday Close Line */}
        <line
          x1={PAD_LEFT} x2={W - PAD_RIGHT}
          y1={PAD_TOP + CH - ((prevClose - minP) / range) * CH}
          y2={PAD_TOP + CH - ((prevClose - minP) / range) * CH}
          stroke="#94a3b8" strokeWidth={1} strokeDasharray="4,2"
        />
        <text x={PAD_LEFT - 4} y={PAD_TOP + CH - ((prevClose - minP) / range) * CH} textAnchor="end" fontSize={8} fill="#94a3b8">
          昨收
        </text>

        {/* Price Line */}
        <polyline points={pricePath} fill="none" stroke={color} strokeWidth={1.5} />

        {/* Area Fill */}
        <polygon
          points={`${PAD_LEFT},${PAD_TOP + CH} ${pricePath} ${PAD_LEFT + CW},${PAD_TOP + CH}`}
          fill={color} opacity={0.08}
        />

        {/* VWAP Line */}
        {showVWAP && avgPath && (
          <polyline points={avgPath} fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" opacity={0.8} />
        )}

        {/* Volume Bar */}
        {showVolume && ticks.slice(-60).map((t, i) => {
          const idx = i + Math.max(0, ticks.length - 60);
          const x = PAD_LEFT + (idx / (ticks.length - 1 || 1)) * CW;
          const barH = (t.volume / maxVol) * 40;
          return (
            <rect key={i} x={x - 0.5} y={H - PAD_BOT - barH} width={CW / 60} height={barH}
              fill={t.direction === 'up' ? '#22c55e' : t.direction === 'down' ? '#ef4444' : '#94a3b8'}
              opacity={0.5} />
          );
        })}

        {/* Price Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const p = minP + f * range;
          return (
            <text key={f} x={PAD_LEFT - 4} y={PAD_TOP + CH - f * CH + 4} textAnchor="end" fontSize={8}
              fill={p === prevClose ? '#94a3b8' : '#64748b'}
              fontWeight={p === prevClose ? 600 : 400}>
              {p.toFixed(2)}
            </text>
          );
        })}

        {/* Latest price dot */}
        {ticks.length > 0 && (
          <>
            <circle
              cx={PAD_LEFT + CW} cy={PAD_TOP + CH - ((ticks[ticks.length - 1].price - minP) / range) * CH}
              r={3} fill={color} stroke="white" strokeWidth={1}
            />
            <text
              x={PAD_LEFT + CW} y={PAD_TOP + CH - ((ticks[ticks.length - 1].price - minP) / range) * CH - 8}
              textAnchor="end" fontSize={9} fontWeight={700} fill={color}
            >
              {ticks[ticks.length - 1].price.toFixed(2)}
            </text>
          </>
        )}
      </svg>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 12px', fontSize: 9, color: '#64748b' }}>
        <span>开盘: {ticks[0]?.price.toFixed(2) || '—'}</span>
        <span>最高: {Math.max(...ticks.map(t => t.price)).toFixed(2)}</span>
        <span>最低: {Math.min(...ticks.map(t => t.price)).toFixed(2)}</span>
        <span>均价: {(ticks.reduce((s, t) => s + t.avgPrice, 0) / ticks.length).toFixed(2)}</span>
        <span>总量: {(ticks.reduce((s, t) => s + t.volume, 0) / 10000).toFixed(1)}万</span>
      </div>
    </div>
  );
};

export default TickChartIntegration;
