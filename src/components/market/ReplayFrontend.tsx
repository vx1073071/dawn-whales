import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface ReplayBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ReplayEvent {
  time: number;
  type: 'news' | 'earnings' | 'trade' | 'signal' | 'alert' | 'crash';
  label: string;
  severity: 'low' | 'medium' | 'high';
}

function generateMockBars(symbol: string, days = 5): { bars: ReplayBar[]; events: ReplayEvent[] } {
  const now = Date.now();
  const count = days * 78;
  let price = symbol === 'NVDA' ? 135 : 100;
  const bars: ReplayBar[] = [];

  for (let i = 0; i < count; i++) {
    const t = now - (count - i) * 300000;
    const open = price;
    const change = (Math.random() - 0.48) * price * 0.015;
    const close = price + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = Math.floor(Math.random() * 5000000 + 500000);
    bars.push({ time: t, open: parseFloat(open.toFixed(2)), high: parseFloat(high.toFixed(2)), low: parseFloat(low.toFixed(2)), close: parseFloat(close.toFixed(2)), volume });
    price = close;
  }

  const events: ReplayEvent[] = [
    { time: bars[Math.floor(count * 0.15)].time, type: 'earnings', label: 'Earnings Beat', severity: 'high' },
    { time: bars[Math.floor(count * 0.3)].time, type: 'news', label: 'AI Chip Launch', severity: 'medium' },
    { time: bars[Math.floor(count * 0.45)].time, type: 'trade', label: '$50M Block', severity: 'medium' },
    { time: bars[Math.floor(count * 0.5)].time, type: 'signal', label: 'MA Cross', severity: 'medium' },
    { time: bars[Math.floor(count * 0.65)].time, type: 'alert', label: 'Vol Spike', severity: 'high' },
    { time: bars[Math.floor(count * 0.75)].time, type: 'crash', label: '-5% Drop', severity: 'high' },
    { time: bars[Math.floor(count * 0.85)].time, type: 'signal', label: 'RSI Oversold', severity: 'low' },
    { time: bars[Math.floor(count * 0.92)].time, type: 'news', label: 'Analyst Upgrade', severity: 'medium' },
  ];

  return { bars, events };
}

export default function ReplayFrontend() {
  const [symbol, setSymbol] = useState('NVDA');
  const [bars, setBars] = useState<ReplayBar[]>([]);
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [compareSymbol, setCompareSymbol] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const playRef = useRef<number>();

  const load = useCallback(() => {
    const data = generateMockBars(symbol);
    setBars(data.bars);
    setEvents(data.events);
    setCurrentIdx(0);
    setLoaded(true);
    setPlaying(false);
  }, [symbol]);

  useEffect(() => {
    if (!playing || bars.length === 0) return;
    const interval = 40 / speed;
    playRef.current = window.setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= bars.length - 1) { setPlaying(false); return bars.length - 1; }
        return prev + 1;
      });
    }, interval);
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, bars, speed]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      if (e.key === 'ArrowLeft') setCurrentIdx(c => Math.max(0, c - 5));
      if (e.key === 'ArrowRight') setCurrentIdx(c => Math.min(bars.length - 1, c + 5));
      if (e.key === 'r') { setCurrentIdx(0); setPlaying(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [bars]);

  const displayBars = useMemo(() => bars.slice(Math.max(0, currentIdx - 30), currentIdx + 10), [bars, currentIdx]);
  const currentBar = bars[currentIdx];
  const progress = bars.length > 0 ? (currentIdx / (bars.length - 1)) * 100 : 0;

  const startPrice = bars[0]?.close ?? 0;
  const endPrice = bars[bars.length - 1]?.close ?? 0;

  const chartPts = useMemo(() => {
    if (displayBars.length === 0) return '';
    const W = 580, H = 200, P = 20;
    const all = displayBars.flatMap(b => [b.high, b.low]);
    const min = Math.min(...all) * 0.998;
    const max = Math.max(...all) * 1.002;
    const range = max - min || 1;
    const barW = (W - P * 2) / displayBars.length;
    let path = '';
    displayBars.forEach((b, i) => {
      const x = P + i * barW + barW / 2;
      const y = H - P - ((b.close - min) / range) * (H - P * 2);
      path += `${i === 0 ? 'M' : 'L'}${x},${y}`;
    });
    return path;
  }, [displayBars]);

  const volBars = useMemo(() => {
    if (!showVolume || displayBars.length === 0) return null;
    const W = 580, H = 60, P = 20;
    const maxVol = Math.max(...displayBars.map(b => b.volume));
    const barW = (W - P * 2) / displayBars.length;
    return displayBars.map((b, i) => {
      const x = P + i * barW;
      const h = (b.volume / maxVol) * (H - P);
      return { x, y: H - h, w: Math.max(barW * 0.8, 1), h };
    });
  }, [displayBars, showVolume]);

  const activeEvents = events.filter(e => {
    const idx = bars.findIndex(b => b.time >= e.time);
    return idx >= 0 && idx <= currentIdx;
  });

  const stats = useMemo(() => {
    if (bars.length === 0) return [];
    const allCloses = bars.map(b => b.close);
    const high = Math.max(...allCloses);
    const low = Math.min(...allCloses);
    const maxDrawdown = (() => {
      let peak = allCloses[0], dd = 0;
      allCloses.forEach(c => { if (c > peak) peak = c; const d = (peak - c) / peak * 100; if (d > dd) dd = d; });
      return dd;
    })();
    const totalVol = bars.reduce((s, b) => s + b.volume, 0);
    return [
      ['Return', `${endPrice >= startPrice ? '+' : ''}${((endPrice - startPrice) / startPrice * 100).toFixed(2)}%`],
      ['High', `$${high.toFixed(2)}`],
      ['Low', `$${low.toFixed(2)}`],
      ['Max DD', `${maxDrawdown.toFixed(2)}%`],
      ['Bars', String(bars.length)],
      ['Avg Vol', `${Math.round(totalVol / bars.length).toLocaleString()}`],
    ];
  }, [bars, startPrice, endPrice]);

  return (
    <div className="rpf-container">
      <div className="rpf-header">
        <span className="rpf-icon">⏪</span>
        <span className="rpf-title">Market Replay</span>
        {loaded && <span className="rpf-subtitle">{symbol} · {bars.length} bars</span>}
      </div>

      <div className="rpf-controls-top">
        <div className="rpf-input-group">
          <input className="rpf-symbol-inp" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && load()} placeholder="Symbol" />
          <button className="rpf-btn rpf-load" onClick={load}>Load</button>
        </div>
        {compareSymbol && (
          <div className="rpf-compare-group">
            <span className="rpf-compare-label">vs</span>
            <input className="rpf-symbol-inp rpf-compare-inp" value={compareSymbol} onChange={e => setCompareSymbol(e.target.value.toUpperCase())} placeholder="AAPL" />
          </div>
        )}
      </div>

      {loaded && bars.length > 0 && (
        <>
          <div className="rpf-stats">
            {stats.map(([label, value], i) => (
              <div key={i} className="rpf-stat">
                <span className="rpf-stat-label">{label}</span>
                <span className={`rpf-stat-value ${label === 'Return' ? (endPrice >= startPrice ? 'pos' : 'neg') : ''}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="rpf-chart-area">
            <svg ref={svgRef} viewBox="0 0 580 260" className="rpf-chart">
              {[0.25, 0.5, 0.75].map(p => (
                <line key={p} x1={20} y1={220 - 180 * p} x2={560} y2={220 - 180 * p} stroke="#21262d" strokeWidth={0.5} />
              ))}
              <path d={chartPts} fill="none" stroke="#58a6ff" strokeWidth={1.5} />
              {currentBar && (
                <circle cx={580 / 2} cy={200 - 20 - ((currentBar.close - Math.min(...displayBars.flatMap(b => [b.low]))) / (Math.max(...displayBars.flatMap(b => [b.high])) - Math.min(...displayBars.flatMap(b => [b.low])) || 1)) * 160} r={4} fill="#58a6ff" stroke="#fff" strokeWidth={1.5}>
                  <animate attributeName="r" values="4;6;4" dur="0.5s" repeatCount="indefinite" />
                </circle>
              )}

              {volBars && volBars.map((v, i) => (
                <rect key={i} x={v.x} y={240 - v.h} width={Math.max(v.w, 1)} height={v.h}
                  fill={displayBars[i]?.close >= displayBars[i]?.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'} />
              ))}

              {showEvents && activeEvents.map((e, i) => {
                const idx = bars.findIndex(b => b.time >= e.time);
                if (idx < 0) return null;
                const x = 20 + (idx / bars.length) * 540;
                const sevColors = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };
                return (
                  <g key={i}>
                    <line x1={x} y1={20} x2={x} y2={220} stroke={sevColors[e.severity]} strokeWidth={0.5} strokeDasharray="3,2" />
                    <circle cx={x} cy={25} r={3} fill={sevColors[e.severity]} />
                    <text x={x} y={18} fontSize={6} fill="#8b949e" textAnchor="middle">{e.label.slice(0, 10)}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="rpf-bar-info">
            <span>{currentBar ? new Date(currentBar.time).toLocaleString() : ''}</span>
            {currentBar && (
              <>
                <span>O:{currentBar.open.toFixed(2)}</span>
                <span>H:{currentBar.high.toFixed(2)}</span>
                <span>L:{currentBar.low.toFixed(2)}</span>
                <span className={currentBar.close >= currentBar.open ? 'pos' : 'neg'}>C:{currentBar.close.toFixed(2)}</span>
                <span>Vol:{(currentBar.volume / 1000000).toFixed(1)}M</span>
              </>
            )}
          </div>

          <div className="rpf-playback">
            <button className="rpf-btn" onClick={() => { setCurrentIdx(0); setPlaying(false); }}>⏮</button>
            <button className="rpf-btn" onClick={() => setCurrentIdx(c => Math.max(0, c - 1))}>◀</button>
            <button className="rpf-btn rpf-play" onClick={() => setPlaying(p => !p)}>{playing ? '⏸' : '▶'}</button>
            <button className="rpf-btn" onClick={() => setCurrentIdx(c => Math.min(bars.length - 1, c + 1))}>▶</button>
            <button className="rpf-btn" onClick={() => setCurrentIdx(bars.length - 1)}>⏭</button>

            <div className="rpf-speed-group">
              {[0.5, 1, 2, 4, 8, 16, 32].map(s => (
                <button key={s} className={`rpf-speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>{s}x</button>
              ))}
            </div>

            <div className="rpf-progress-wrap">
              <input type="range" min={0} max={bars.length - 1} value={currentIdx} onChange={e => setCurrentIdx(Number(e.target.value))} className="rpf-seek" />
              <span className="rpf-progress-text">{Math.round(progress)}%</span>
            </div>

            <div className="rpf-toggles">
              <button className={`rpf-btn ${showVolume ? 'active' : ''}`} onClick={() => setShowVolume(!showVolume)}>📊</button>
              <button className={`rpf-btn ${showEvents ? 'active' : ''}`} onClick={() => setShowEvents(!showEvents)}>📌</button>
              <button className="rpf-btn" onClick={() => setCompareSymbol(compareSymbol ? '' : 'AAPL')}>🔗</button>
            </div>
          </div>
        </>
      )}

      {!loaded && (
        <div className="rpf-empty">
          <span>Enter a symbol and click Load to replay market data</span>
          <span className="rpf-hint">Space = Play/Pause · ←→ = Step · R = Reset · Drag seek bar</span>
        </div>
      )}

      <style>{`
        .rpf-container { background:var(--bg-surface,#0d1117); border:1px solid #21262d; border-radius:12px; padding:14px; color:#c9d1d9; font-family:'Inter',-apple-system,sans-serif; }
        .rpf-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .rpf-icon { font-size:18px; }
        .rpf-title { font-size:15px; font-weight:700; }
        .rpf-subtitle { font-size:10px; color:#484f58; }
        .rpf-controls-top { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
        .rpf-input-group { display:flex; gap:4px; }
        .rpf-symbol-inp { background:#0d1117; border:1px solid #30363d; border-radius:8px; padding:5px 10px; color:#c9d1d9; font-size:13px; width:100px; outline:none; }
        .rpf-symbol-inp:focus { border-color:#58a6ff; }
        .rpf-compare-group { display:flex; align-items:center; gap:4px; }
        .rpf-compare-label { font-size:10px; color:#484f58; }
        .rpf-compare-inp { width:80px; }
        .rpf-btn { background:#161b22; border:1px solid #30363d; color:#c9d1d9; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:13px; transition:all 0.15s; }
        .rpf-btn:hover { border-color:#58a6ff; }
        .rpf-btn.active { background:#1f6feb; color:#fff; border-color:#1f6feb; }
        .rpf-load { background:#238636; color:#fff; border-color:#238636; }
        .rpf-play { min-width:44px; }
        .rpf-stats { display:grid; grid-template-columns:repeat(6,1fr); gap:4px; margin-bottom:10px; }
        .rpf-stat { display:flex; flex-direction:column; padding:4px 6px; background:rgba(22,27,34,0.5); border-radius:6px; }
        .rpf-stat-label { font-size:9px; color:#484f58; }
        .rpf-stat-value { font-size:11px; font-weight:600; font-variant-numeric:tabular-nums; }
        .pos { color:#22c55e; } .neg { color:#ef4444; }
        .rpf-chart-area { margin-bottom:6px; }
        .rpf-chart { width:100%; background:rgba(13,17,23,0.5); border-radius:8px; }
        .rpf-bar-info { display:flex; align-items:center; gap:12px; padding:5px 10px; background:rgba(22,27,34,0.5); border-radius:6px; font-size:11px; margin-bottom:8px; font-variant-numeric:tabular-nums; }
        .rpf-playback { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
        .rpf-speed-group { display:flex; gap:1px; }
        .rpf-speed-btn { background:none; border:1px solid #30363d; color:#8b949e; border-radius:3px; padding:1px 5px; font-size:10px; cursor:pointer; }
        .rpf-speed-btn.active { background:#1f6feb; color:#fff; border-color:#1f6feb; }
        .rpf-progress-wrap { display:flex; align-items:center; gap:4px; flex:1; min-width:80px; }
        .rpf-seek { flex:1; accent-color:#58a6ff; height:4px; }
        .rpf-progress-text { font-size:10px; color:#484f58; font-variant-numeric:tabular-nums; }
        .rpf-toggles { display:flex; gap:2px; }
        .rpf-empty { padding:30px; text-align:center; color:#8b949e; }
        .rpf-hint { display:block; font-size:11px; margin-top:10px; color:#484f58; }
      `}</style>
    </div>
  );
}
