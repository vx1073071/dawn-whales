import { useState, useMemo } from 'react';

// ── Volume Profile Panel ── ML#1 R266 (8h)
// Interactive Volume-at-Price histogram with POC/VAH/VAL zones

interface VolumeProfileBar {
  price: number;
  volume: number;
  pct: number;          // % of max volume
  isPOC?: boolean;      // Point of Control
  isVAH?: boolean;      // Value Area High (upper 70%)
  isVAL?: boolean;      // Value Area Low (lower 70%)
  isVN?: boolean;       // Value Node
}

interface VolumeProfilePanelProps {
  bars: VolumeProfileBar[];
  currentPrice?: number;
  width?: number;
  height?: number;
}

function VolumeProfilePanel({ bars, currentPrice, width = 200, height = 400 }: VolumeProfilePanelProps) {
  const [showVA, setShowVA] = useState(true);
  const [showPOCLine, setShowPOCLine] = useState(true);
  const [valueAreaPct, _setValueAreaPct] = useState(70);
  const [resolution, setResolution] = useState(50); // price buckets

  const maxVol = useMemo(() => Math.max(...bars.map(b => b.volume), 1), [bars]);
  const priceRange = useMemo(() => {
    if (bars.length === 0) return { min: 0, max: 100 };
    const prices = bars.map(b => b.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [bars]);

  const poc = useMemo(() => bars.find(b => b.isPOC), [bars]);
  const vah = useMemo(() => bars.find(b => b.isVAH), [bars]);
  const val = useMemo(() => bars.find(b => b.isVAL), [bars]);

  const histogramWidth = width - 60;

  return (
    <div className="volume-profile-panel" style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>📊 Volume Profile</span>
        <span style={{ color: '#888', fontSize: 11 }}>{bars.length} buckets</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 10, color: '#666', display: 'flex', alignItems: 'center', gap: 3 }}>
          <input type="checkbox" checked={showVA} onChange={e => setShowVA(e.target.checked)} />
          VA {valueAreaPct}%
        </label>
        <label style={{ fontSize: 10, color: '#666', display: 'flex', alignItems: 'center', gap: 3 }}>
          <input type="checkbox" checked={showPOCLine} onChange={e => setShowPOCLine(e.target.checked)} />
          POC
        </label>
        <select value={resolution} onChange={e => setResolution(Number(e.target.value))} style={{ fontSize: 10, padding: '0 4px' }}>
          <option value={25}>25档</option>
          <option value={50}>50档</option>
          <option value={100}>100档</option>
        </select>
      </div>

      {/* Chart */}
      <div style={{ position: 'relative', width, height }}>
        {/* Price labels left */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 45, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {[priceRange.max, (priceRange.max + priceRange.min) / 2, priceRange.min].map((p, i) => (
            <span key={i} style={{ fontSize: 9, color: '#999', textAlign: 'right', paddingRight: 4 }}>
              {p.toFixed(2)}
            </span>
          ))}
        </div>

        {/* Histogram */}
        <div style={{ position: 'absolute', left: 48, top: 0, bottom: 0, right: 0, overflow: 'hidden' }}>
          <svg width={histogramWidth} height={height}>
            {bars.map((bar, i) => {
              const barH = (bar.volume / maxVol) * histogramWidth * 0.9;
              const yFrac = (bar.price - priceRange.min) / (priceRange.max - priceRange.min || 1);
              const y = (1 - yFrac) * height;
              const barHeight = Math.max(2, height / bars.length);

              let fill = bar.pct > 80 ? '#2563eb' : bar.pct > 50 ? '#60a5fa' : bar.pct > 30 ? '#93c5fd' : '#dbeafe';
              if (bar.isPOC) fill = '#ef4444';
              if (bar.isVAH && showVA) fill = '#22c55e';
              if (bar.isVAL && showVA) fill = '#22c55e';

              return (
                <g key={i}>
                  <rect
                    x={0}
                    y={y - barHeight / 2}
                    width={barH}
                    height={barHeight}
                    fill={fill}
                    opacity={0.85}
                    rx={1}
                  />
                  {barH > 30 && (
                    <text x={barH / 2} y={y + 3} textAnchor="middle" fontSize={8} fill="#1e293b">
                      {(bar.volume / 1000).toFixed(0)}K
                    </text>
                  )}
                </g>
              );
            })}

            {/* Current price line */}
            {currentPrice && (
              <line
                x1={0} x2={histogramWidth}
                y1={((1 - (currentPrice - priceRange.min) / (priceRange.max - priceRange.min || 1)) * height)}
                y2={((1 - (currentPrice - priceRange.min) / (priceRange.max - priceRange.min || 1)) * height)}
                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,1"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Stats */}
      {poc && (
        <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, color: '#666' }}>
          <span>🔴 POC: {poc.price.toFixed(2)}</span>
          {vah && <span>🟢 VAH: {vah.price.toFixed(2)}</span>}
          {val && <span>🟢 VAL: {val.price.toFixed(2)}</span>}
          {vah && val && <span>VA Range: {(vah.price - val.price).toFixed(2)}</span>}
        </div>
      )}

      {/* Explanation */}
      <div style={{ marginTop: 6, fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
        🔴 POC = 成交量最大价位（主力成本区）
        🟢 VA = {valueAreaPct}% 价值区域（主力活跃区间）
        成交量越集中在某价位，该价位支撑/阻力越强。
      </div>
    </div>
  );
}

// ── Volume Profile Simulation Engine ──
export function simulateVolumeProfile(
  klineData: { high: number; low: number; close: number; volume: number }[],
  buckets = 50
): VolumeProfileBar[] {
  if (klineData.length === 0) return [];

  const allPrices = klineData.flatMap(k => [k.high, k.low, k.close]);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const bucketSize = (maxP - minP) / buckets;
  const volMap = new Map<number, number>();

  for (const k of klineData) {
    const range = Math.max(k.high - k.low, 0.001);
    const volPerTick = k.volume / range;

    // Distribute volume across price range proportionally
    for (let p = k.low; p <= k.high; p += bucketSize) {
      const bucketIdx = Math.floor((p - minP) / bucketSize);
      const bucketPrice = minP + bucketIdx * bucketSize + bucketSize / 2;
      volMap.set(bucketPrice, (volMap.get(bucketPrice) || 0) + volPerTick * bucketSize);
    }
  }

  const bars: VolumeProfileBar[] = Array.from(volMap.entries())
    .map(([price, volume]) => ({ price, volume, pct: 0, isPOC: false, isVAH: false, isVAL: false, isVN: false }))
    .sort((a, b) => b.price - a.price);

  if (bars.length === 0) return [];

  const maxVol = Math.max(...bars.map(b => b.volume));
  for (const bar of bars) {
    bar.pct = (bar.volume / maxVol) * 100;
  }

  // POC = max volume price
  const pocBar = bars.reduce((a, b) => (a.volume > b.volume ? a : b));
  pocBar.isPOC = true;

  // Value Area (70% by default)
  const totalVol = bars.reduce((s, b) => s + b.volume, 0);
  let cumulativeVol = 0;
  let vaStarted = false;
  const sortedByVol = [...bars].sort((a, b) => b.volume - a.volume);
  for (const bar of sortedByVol) {
    cumulativeVol += bar.volume;
    if (!vaStarted && cumulativeVol / totalVol >= 0.15) {
      bar.isVAH = true;
      vaStarted = true;
    }
    if (cumulativeVol / totalVol > 0.85) {
      bar.isVAL = true;
      break;
    }
  }

  return bars.slice(0, 80); // limit display
}

export default VolumeProfilePanel;
