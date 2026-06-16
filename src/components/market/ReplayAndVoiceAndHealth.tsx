import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { VoiceBroadcastButton } from './VoiceBroadcastButton';
import { SourceHealthDashboard } from './SourceHealthDashboard';

// ═══════════════════════════════════════════════════════════════
// Market Replay UI — 历史行情回放控制面板
// ═══════════════════════════════════════════════════════════════

interface ReplayFrame {
  timestamp: number;
  price: number;
  volume: number;
  event?: {
    type: 'news' | 'earnings' | 'block_trade' | 'breakout' | 'catalyst';
    label: string;
    severity: 'low' | 'medium' | 'high';
  };
}

interface ReplaySession {
  symbol: string;
  name: string;
  startTime: number;
  endTime: number;
  totalFrames: number;
  startPrice: number;
  endPrice: number;
  changePercent: number;
  highPrice: number;
  lowPrice: number;
  frames: ReplayFrame[];
}

function generateMockReplayData(symbol: string, days = 5): ReplaySession {
  const now = Date.now();
  const startTime = now - days * 86400000;
  const endTime = now;
  const totalFrames = days * 480;
  let price = symbol.includes('NVDA') ? 148 : symbol.includes('TSLA') ? 270 : 100;
  const startPrice = price;
  let highPrice = price;
  let lowPrice = price;
  const frames: ReplayFrame[] = [];

  const events: ReplayFrame['event'][] = [
    { type: 'earnings', label: 'Earnings Beat', severity: 'high' },
    { type: 'news', label: 'New Product', severity: 'medium' },
    { type: 'block_trade', label: '$50M Block', severity: 'medium' },
    { type: 'breakout', label: 'Resistance Break', severity: 'high' },
    { type: 'catalyst', label: 'Analyst Upgrade', severity: 'medium' },
    { type: 'news', label: 'Fed Decision', severity: 'high' },
    { type: 'breakout', label: 'MA Cross', severity: 'medium' },
    { type: 'block_trade', label: '$100M Block', severity: 'high' },
    { type: 'catalyst', label: 'Sector Rotation', severity: 'low' },
  ];

  for (let i = 0; i < totalFrames; i++) {
    const changePercent = (Math.random() - 0.48) * (symbol.includes('NVDA') ? 3 : 2);
    const volume = Math.floor(Math.random() * 5000000 + 1000000);
    price = price * (1 + changePercent / 100);
    highPrice = Math.max(highPrice, price);
    lowPrice = Math.min(lowPrice, price);

    const frame: ReplayFrame = {
      timestamp: startTime + (i / totalFrames) * (endTime - startTime),
      price: parseFloat(price.toFixed(2)),
      volume,
    };

    if (i > 0 && i % Math.floor(totalFrames / (events.length + 2)) === 0 && events.length > 0) {
      frame.event = events.shift();
    }

    frames.push(frame);
  }

  const endPrice = parseFloat(price.toFixed(2));
  return {
    symbol, name: symbol, startTime, endTime, totalFrames, startPrice,
    endPrice, highPrice, lowPrice,
    changePercent: parseFloat(((endPrice - startPrice) / startPrice * 100).toFixed(2)),
    frames,
  };
}

export default function ReplayAndVoiceAndHealth() {
  const [tab, setTab] = useState<'replay' | 'voice' | 'health'>('replay');

  return (
    <div className="rvh-container">
      <div className="rvh-tabs">
        <button className={`rvh-tab ${tab === 'replay' ? 'active' : ''}`} onClick={() => setTab('replay')}>
          ⏪ Replay
        </button>
        <button className={`rvh-tab ${tab === 'voice' ? 'active' : ''}`} onClick={() => setTab('voice')}>
          🔊 Voice
        </button>
        <button className={`rvh-tab ${tab === 'health' ? 'active' : ''}`} onClick={() => setTab('health')}>
          🫀 Health
        </button>
      </div>

      <div className="rvh-content">
        {tab === 'replay' && <MarketReplayPanel />}
        {tab === 'voice' && <VoiceBroadcastButton />}
        {tab === 'health' && <SourceHealthDashboard />}
      </div>

      <style>{`
        .rvh-container { font-family: 'Inter', -apple-system, sans-serif; color: var(--text-primary, #c9d1d9); }
        .rvh-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
        .rvh-tab {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 8px 8px 0 0; padding: 6px 16px; font-size: 13px;
          cursor: pointer; transition: all 0.15s; border-bottom: none;
        }
        .rvh-tab.active { background: var(--bg-card, #161b22); color: #58a6ff; border-color: #58a6ff; }
        .rvh-tab:hover { color: #c9d1d9; }
        .rvh-content {}
      `}</style>
    </div>
  );
}

function MarketReplayPanel() {
  const [session, setSession] = useState<ReplaySession | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [symbolInput, setSymbolInput] = useState('NVDA');
  const [loaded, setLoaded] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const playRef = useRef<number>();
  const svgRef = useRef<SVGSVGElement>(null);

  const loadSession = useCallback(() => {
    const s = generateMockReplayData(symbolInput);
    setSession(s);
    setCurrentFrame(0);
    setLoaded(true);
    setPlaying(false);
  }, [symbolInput]);

  const steps = useMemo(() => {
    if (!session) return [];
    const step = Math.max(1, Math.floor(session.totalFrames / 120));
    return session.frames.filter((_, i) => i % step === 0);
  }, [session]);

  useEffect(() => {
    if (!playing || !session) return;
    const interval = 50 / speed;
    playRef.current = window.setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= session.totalFrames - 1) { setPlaying(false); return session.totalFrames - 1; }
        return prev + 1;
      });
    }, interval);
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, session, speed]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
      if (e.key === 'ArrowLeft' && session) setCurrentFrame(c => Math.max(0, c - 10));
      if (e.key === 'ArrowRight' && session) setCurrentFrame(c => Math.min(session.totalFrames - 1, c + 10));
      if (e.key === 'r') { setCurrentFrame(0); setPlaying(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session]);

  const frame = session?.frames[currentFrame] ?? null;
  const progress = session ? (currentFrame / (session.totalFrames - 1)) * 100 : 0;
  const frameTime = frame ? new Date(frame.timestamp).toLocaleString() : '';

  const chartPoints = useMemo(() => {
    if (!session) return '';
    const W = 600, H = 180, PAD = 10;
    const minP = session.lowPrice * 0.99;
    const maxP = session.highPrice * 1.01;
    const range = maxP - minP || 1;
    const xScale = (W - PAD * 2) / (steps.length - 1 || 1);
    return steps.map((f, i) => {
      const x = PAD + i * xScale;
      const y = H - PAD - ((f.price - minP) / range) * (H - PAD * 2);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }, [session, steps]);

  const currentPos = useMemo(() => {
    if (!session) return { x: 0, y: 0 };
    const W = 600, H = 180, PAD = 10;
    const minP = session.lowPrice * 0.99;
    const maxP = session.highPrice * 1.01;
    const range = maxP - minP || 1;
    const idx = Math.floor((currentFrame / session.totalFrames) * (steps.length - 1));
    const xScale = (W - PAD * 2) / (steps.length - 1 || 1);
    const x = PAD + idx * xScale;
    const y = H - PAD - (((frame?.price ?? 0) - minP) / range) * (H - PAD * 2);
    return { x, y };
  }, [session, currentFrame, frame, steps]);

  return (
    <div className="rpl-panel">
      <div className="rpl-input-row">
        <input className="rpl-symbol-input" value={symbolInput} onChange={e => setSymbolInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && loadSession()} placeholder="Symbol (e.g. NVDA)" />
        <button className="rpl-btn rpl-load-btn" onClick={loadSession}>Load</button>
      </div>

      {session && loaded && (
        <>
          <div className="rpl-stats">
            {[
              ['Period', `+${((session.endTime - session.startTime) / 86400000).toFixed(1)}d`],
              ['Return', `${session.changePercent >= 0 ? '+' : ''}${session.changePercent.toFixed(2)}%`],
              ['High', session.highPrice.toFixed(2)],
              ['Low', session.lowPrice.toFixed(2)],
              ['Frames', String(session.totalFrames)],
              ['VWAP', (session.frames.reduce((a, f) => a + f.price * f.volume, 0) / session.frames.reduce((a, f) => a + f.volume, 0)).toFixed(2)],
              ['Avg Vol', Math.round(session.frames.reduce((a, f) => a + f.volume, 0) / session.frames.length).toLocaleString()],
              ['Events', String(session.frames.filter(f => f.event).length)],
            ].map(([label, value], i) => (
              <div key={i} className="rpl-stat">
                <span className="rpl-stat-label">{label}</span>
                <span className={`rpl-stat-value ${label === 'Return' ? (session.changePercent >= 0 ? 'positive' : 'negative') : ''}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {showChart && (
            <div className="rpl-chart-container">
              <svg ref={svgRef} viewBox="0 0 600 180" className="rpl-chart">
                {[0.25, 0.5, 0.75].map(pct => (
                  <line key={pct} x1={10} y1={170 - 160 * pct} x2={590} y2={170 - 160 * pct} stroke="#21262d" strokeWidth={0.5} />
                ))}
                <path d={chartPoints} fill="none" stroke="#58a6ff" strokeWidth={1.5} />
                <circle cx={currentPos.x} cy={currentPos.y} r={4} fill="#58a6ff" stroke="#fff" strokeWidth={1.5}>
                  <animate attributeName="r" values="4;6;4" dur="0.5s" repeatCount="indefinite" />
                </circle>
                {steps.filter(f => f.event).map((f) => {
                  const idx = steps.indexOf(f);
                  const W = 600; const PAD = 10;
                  const xScale = (W - PAD * 2) / (steps.length - 1 || 1);
                  const x = PAD + idx * xScale;
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={40} r={3} fill={f.event!.severity === 'high' ? '#ef4444' : f.event!.severity === 'medium' ? '#f59e0b' : '#3b82f6'} />
                      <text x={x} y={32} fontSize={7} fill="#8b949e" textAnchor="middle">{f.event!.label.slice(0, 8)}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {frame && (
            <div className="rpl-frame-info">
              <span>{frameTime}</span>
              <span className={frame.price >= (session.startPrice + session.endPrice) / 2 ? 'positive' : 'negative'}>
                ${frame.price.toFixed(2)}
              </span>
              <span>Vol: {frame.volume.toLocaleString()}</span>
              {frame.event && <span className="rpl-event-tag">{frame.event.label}</span>}
            </div>
          )}

          <div className="rpl-controls">
            <button className="rpl-btn" onClick={() => { setCurrentFrame(0); setPlaying(false); }}>⏮</button>
            <button className="rpl-btn" onClick={() => setCurrentFrame(c => Math.max(0, c - 1))}>◀</button>
            <button className="rpl-btn rpl-play-btn" onClick={() => setPlaying(p => !p)}>{playing ? '⏸' : '▶'}</button>
            <button className="rpl-btn" onClick={() => setCurrentFrame(c => Math.min(session.totalFrames - 1, c + 1))}>▶</button>
            <button className="rpl-btn" onClick={() => setCurrentFrame(session.totalFrames - 1)}>⏭</button>
            <div className="rpl-speed-group">
              {[0.5, 1, 2, 4, 8].map(s => (
                <button key={s} className={`rpl-speed-btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>{s}x</button>
              ))}
            </div>
            <div className="rpl-progress-wrap">
              <div className="rpl-progress-bar"><div className="rpl-progress-fill" style={{ width: `${progress}%` }} /></div>
              <span className="rpl-progress-text">{Math.round(progress)}%</span>
            </div>
            <button className={`rpl-btn ${showChart ? 'active' : ''}`} onClick={() => setShowChart(!showChart)}>📈</button>
          </div>
        </>
      )}
      {!loaded && (
        <div className="rpl-empty">
          <span>Enter a stock symbol and click "Load" to start replay</span>
          <span className="rpl-hint">Space=play/pause, ←→=step, R=reset</span>
        </div>
      )}
      <style>{`
        .rpl-panel { background: var(--bg-surface,#0d1117); border:1px solid #21262d; border-radius:12px; padding:14px; }
        .rpl-input-row { display:flex; gap:8px; margin-bottom:10px; }
        .rpl-symbol-input { flex:1; background:#0d1117; border:1px solid #30363d; border-radius:8px; padding:6px 12px; color:#c9d1d9; font-size:14px; outline:none; }
        .rpl-symbol-input:focus { border-color:#58a6ff; }
        .rpl-btn { background:#161b22; border:1px solid #30363d; color:#c9d1d9; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:14px; }
        .rpl-btn:hover { border-color:#58a6ff; }
        .rpl-btn.active { background:#1f6feb; color:#fff; border-color:#1f6feb; }
        .rpl-load-btn { background:#238636; color:#fff; border-color:#238636; }
        .rpl-play-btn { min-width:40px; }
        .rpl-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; margin-bottom:10px; }
        .rpl-stat { display:flex; flex-direction:column; padding:4px 8px; background:rgba(22,27,34,0.5); border-radius:6px; }
        .rpl-stat-label { font-size:10px; color:#8b949e; }
        .rpl-stat-value { font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; }
        .positive { color:#22c55e; } .negative { color:#ef4444; }
        .rpl-chart-container { margin-bottom:8px; }
        .rpl-chart { width:100%; background:rgba(13,17,23,0.5); border-radius:8px; }
        .rpl-frame-info { display:flex; align-items:center; gap:12px; padding:6px 10px; background:rgba(22,27,34,0.5); border-radius:6px; font-size:12px; margin-bottom:8px; }
        .rpl-event-tag { background:rgba(239,68,68,0.15); color:#f87171; padding:1px 6px; border-radius:4px; font-size:10px; }
        .rpl-controls { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
        .rpl-speed-group { display:flex; gap:2px; }
        .rpl-speed-btn { background:none; border:1px solid #30363d; color:#8b949e; border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer; }
        .rpl-speed-btn.active { background:#1f6feb; color:#fff; border-color:#1f6feb; }
        .rpl-progress-wrap { display:flex; align-items:center; gap:6px; flex:1; min-width:100px; }
        .rpl-progress-bar { flex:1; height:4px; background:#21262d; border-radius:2px; overflow:hidden; }
        .rpl-progress-fill { height:100%; background:#58a6ff; border-radius:2px; transition:width 0.1s; }
        .rpl-progress-text { font-size:10px; color:#8b949e; font-variant-numeric:tabular-nums; }
        .rpl-empty { padding:20px; text-align:center; color:#8b949e; font-size:13px; }
        .rpl-hint { display:block; font-size:11px; margin-top:8px; color:#484f58; }
      `}</style>
    </div>
  );
}
