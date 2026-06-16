import { useState, useEffect, useRef, useCallback } from 'react';

interface BriefingScript {
  id: string;
  icon: string;
  title: string;
  market: string;
  duration: number;
  text: string;
}

const VOICE_SCRIPTS: BriefingScript[] = [
  {
    id: 'morning-us', icon: '🌅', title: 'US Morning Brief', market: 'US',
    duration: 45, text: 'Good morning. Here is your market briefing. S&P 500 futures point to a positive open, up 0.4 percent. Overnight, Asian markets were mixed with Hang Seng down 1.2 percent and Nikkei gaining 0.5 percent. Bitcoin is trading at 104 thousand dollars, up 2 percent. Key events today: Fed minutes at 2 PM Eastern, and earnings from Oracle after the close. Technology leads pre-market with NVIDIA up 1.5 percent. The VIX is at 18, suggesting moderate volatility. Key levels to watch: S&P 500 support at 5,950, resistance at 6,020. That is your morning briefing. Trade smart.'
  },
  {
    id: 'midday-hk', icon: '🏙️', title: 'HK Midday Brief', market: 'HK',
    duration: 35, text: 'Hong Kong midday update. Hang Seng index is down 1.2 percent at 20,200. Tencent drags the index, down 3.2 percent on regulatory concerns. Property stocks are mixed. Trading volume is moderate at 85 billion Hong Kong dollars. Southbound connect shows net inflow of 2.1 billion yuan. Key support at 20,000. The lunch break is now. Markets resume at 1 PM. Stay tuned for afternoon developments.'
  },
  {
    id: 'close-us', icon: '🌇', title: 'US Closing Brief', market: 'US',
    duration: 50, text: 'Markets are closing. Here is your end of day summary. S&P 500 closed at 5,988, up 0.5 percent. The NASDAQ outperformed, gaining 0.9 percent, led by semiconductors. NVIDIA surged 5.2 percent to 152 dollars on strong AI chip demand. Tesla dropped 4.3 percent after delivery numbers disappointed. Sector performance: Technology was the top sector plus 2.5 percent, while Energy lagged down 0.8 percent. Bitcoin rose 2 percent to 104,500. After hours: watch for Oracle earnings and Fed minutes. Your portfolio: up 1.2 percent today. That wraps up the trading day. See you tomorrow.'
  },
  {
    id: 'crypto-24h', icon: '🪙', title: 'Crypto 24H', market: 'Crypto',
    duration: 30, text: 'Crypto market update. Bitcoin is trading at 104,500 dollars, up 2 percent in the last 24 hours. Ethereum follows at 3,950 dollars, up 2.2 percent. The total crypto market cap is 3.5 trillion dollars. Top movers: Solana up 8 percent, Avalanche up 5 percent. Bitcoin dominance is at 52 percent. The fear and greed index shows 72, indicating greed. Key on-chain metrics: exchange reserves continue to decline, suggesting accumulation. Bitcoin ETF flows were positive at 380 million dollars yesterday. That is your crypto briefing.'
  },
  {
    id: 'macro-weekly', icon: '📅', title: 'Weekly Macro', market: 'Global',
    duration: 55, text: 'Your weekly macro overview. This week features several key economic events. Wednesday: Fed minutes from the June meeting, expected to show continued data dependence. Thursday: US CPI inflation data, consensus at 3.1 percent year over year. Friday: China industrial production and retail sales. Central bank watch: the ECB held rates steady last week, the Bank of Japan meets next week. Commodities: Gold at 2,420 dollars, up 1.2 percent. Crude oil at 71 dollars, down 0.5 percent. The US dollar index is at 104.5, slightly weaker. Key theme: markets pricing in one to two rate cuts by December. That is your macro week ahead.'
  },
  {
    id: 'portfolio-personal', icon: '💼', title: 'My Portfolio', market: 'Personal',
    duration: 35, text: 'Here is your personal portfolio update. Your portfolio is up 1.2 percent today. Top performers: NVIDIA up 5.2 percent, Coinbase up 8.5 percent. Underperformers: Tesla down 4.3 percent, Tencent down 3.2 percent. Your Bitcoin position is up 2 percent. Total portfolio value is approximately 128 thousand dollars. Unrealized profit today is 1,520 dollars. Risk metrics: portfolio beta is 1.4, slightly aggressive. Diversification score: 72 out of 100. Suggestion: consider rebalancing as technology exposure is now 45 percent of your portfolio. Your next earnings to watch: Microsoft on July 23rd. That is your portfolio update.'
  },
];

export default function VoiceBroadcastUX() {
  const [scripts] = useState<BriefingScript[]>(VOICE_SCRIPTS);
  const [playing, setPlaying] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('ALL');
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1.0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [history, setHistory] = useState<{ id: string; time: number }[]>([]);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const filtered = selectedMarket === 'ALL' ? scripts : scripts.filter(s => s.market === selectedMarket);
  const markets = ['ALL', ...new Set(scripts.map(s => s.market))];

  const play = useCallback((script: BriefingScript) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script.text);
    utterance.rate = speed;
    utterance.volume = volume;
    utterance.pitch = 1.0;
    utterance.onstart = () => {
      setPlaying(script.id);
      setHistory(h => [{ id: script.id, time: Date.now() }, ...h].slice(0, 20));
    };
    utterance.onend = () => {
      setPlaying(null);
      if (autoPlay) {
        const idx = filtered.findIndex(s => s.id === script.id);
        const next = filtered[(idx + 1) % filtered.length];
        if (next && next.id !== script.id) setTimeout(() => play(next), 1000);
      }
    };
    utterance.onerror = () => setPlaying(null);
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [speed, volume, autoPlay, filtered]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setPlaying(null);
    setAutoPlay(false);
  }, []);

  useEffect(() => { return () => { window.speechSynthesis?.cancel(); }; }, []);

  const totalDuration = filtered.reduce((s, b) => s + b.duration, 0);

  return (
    <div className="vbx-container">
      {/* header */}
      <div className="vbx-header">
        <div className="vbx-title-row">
          <span className="vbx-icon">🎙️</span>
          <span className="vbx-title">Voice Broadcast</span>
          <span className="vbx-subtitle">{filtered.length} briefings · {totalDuration}s total</span>
        </div>
        <div className="vbx-header-actions">
          <button className={`vbx-autoplay-btn ${autoPlay ? 'active' : ''}`} onClick={() => setAutoPlay(!autoPlay)}>
            {autoPlay ? '⟳ Autoplay ON' : '⟳ Autoplay OFF'}
          </button>
          <button className="vbx-stop-btn" onClick={stop} disabled={!playing}>⏹ Stop All</button>
        </div>
      </div>

      {/* market filter */}
      <div className="vbx-market-chips">
        {markets.map(m => (
          <button key={m} className={`vbx-chip ${selectedMarket === m ? 'active' : ''}`} onClick={() => setSelectedMarket(m)}>
            {m === 'ALL' ? 'All Markets' : m}
          </button>
        ))}
      </div>

      {/* settings */}
      <div className="vbx-settings">
        <div className="vbx-setting">
          <span className="vbx-setting-label">🔊 Vol</span>
          <input type="range" min={0} max={100} value={volume * 100} onChange={e => setVolume(Number(e.target.value) / 100)} className="vbx-slider" />
          <span className="vbx-setting-value">{Math.round(volume * 100)}%</span>
        </div>
        <div className="vbx-setting">
          <span className="vbx-setting-label">⏩ Speed</span>
          <input type="range" min={50} max={200} value={speed * 100} onChange={e => setSpeed(Number(e.target.value) / 100)} className="vbx-slider" />
          <span className="vbx-setting-value">{speed.toFixed(1)}x</span>
        </div>
        <div className="vbx-setting">
          <label className="vbx-check-label">
            <input type="checkbox" checked={showTranscript} onChange={e => setShowTranscript(e.target.checked)} />
            <span>Show transcript</span>
          </label>
        </div>
      </div>

      {/* script cards */}
      <div className="vbx-cards">
        {filtered.map(script => (
          <div key={script.id} className={`vbx-card ${playing === script.id ? 'playing' : ''}`}>
            <div className="vbx-card-top">
              <span className="vbx-card-icon">{script.icon}</span>
              <div className="vbx-card-info">
                <span className="vbx-card-title">{script.title}</span>
                <span className="vbx-card-meta">{script.market} · {script.duration}s</span>
              </div>
              <button
                className={`vbx-play-btn ${playing === script.id ? 'playing' : ''}`}
                onClick={() => playing === script.id ? stop() : play(script)}
              >
                {playing === script.id ? '⏸' : '▶'}
              </button>
            </div>

            {playing === script.id && (
              <div className="vbx-progress-bar">
                <div className="vbx-progress-fill vbx-animated" />
              </div>
            )}

            {showTranscript && (
              <div className="vbx-transcript">
                <p>{script.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* history */}
      {history.length > 0 && (
        <div className="vbx-history">
          <span className="vbx-history-title">Recent Plays</span>
          <div className="vbx-history-list">
            {history.slice(0, 5).map((h, i) => {
              const s = scripts.find(b => b.id === h.id);
              if (!s) return null;
              return (
                <div key={i} className="vbx-history-item" onClick={() => play(s)}>
                  <span>{s.icon}</span>
                  <span>{s.title}</span>
                  <span>{new Date(h.time).toLocaleTimeString()}</span>
                  <button className="vbx-replay-btn">↻</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .vbx-container {
          background: var(--bg-surface, #0d1117);
          border: 1px solid var(--border, #21262d);
          border-radius: 12px; padding: 14px;
          color: var(--text-primary, #c9d1d9);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .vbx-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px; }
        .vbx-title-row { display: flex; align-items: center; gap: 8px; }
        .vbx-icon { font-size: 20px; }
        .vbx-title { font-size: 16px; font-weight: 700; }
        .vbx-subtitle { font-size: 11px; color: #484f58; }
        .vbx-header-actions { display: flex; gap: 6px; }
        .vbx-autoplay-btn {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer;
        }
        .vbx-autoplay-btn.active { background: rgba(34,197,94,0.15); color: #22c55e; border-color: #22c55e; }
        .vbx-stop-btn { background: #ef4444; color: #fff; border: none; border-radius: 6px; padding: 4px 12px; font-size: 11px; cursor: pointer; }
        .vbx-stop-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .vbx-market-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
        .vbx-chip {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 10px; padding: 2px 10px; font-size: 10px; cursor: pointer;
        }
        .vbx-chip.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
        .vbx-settings { display: flex; gap: 16px; align-items: center; margin-bottom: 10px; padding: 8px; background: rgba(22,27,34,0.5); border-radius: 8px; flex-wrap: wrap; }
        .vbx-setting { display: flex; align-items: center; gap: 6px; }
        .vbx-setting-label { font-size: 10px; color: #8b949e; min-width: 50px; }
        .vbx-slider { width: 80px; accent-color: #58a6ff; }
        .vbx-setting-value { font-size: 10px; color: #484f58; font-variant-numeric: tabular-nums; }
        .vbx-check-label { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #8b949e; cursor: pointer; }
        .vbx-cards { display: flex; flex-direction: column; gap: 6px; }
        .vbx-card {
          background: var(--bg-card, #161b22); border: 1px solid #21262d;
          border-radius: 10px; padding: 12px; transition: all 0.2s;
        }
        .vbx-card:hover { border-color: #30363d; }
        .vbx-card.playing { border-color: #22c55e; box-shadow: 0 0 16px rgba(34,197,94,0.1); }
        .vbx-card-top { display: flex; align-items: center; gap: 10px; }
        .vbx-card-icon { font-size: 24px; }
        .vbx-card-info { flex: 1; display: flex; flex-direction: column; }
        .vbx-card-title { font-size: 14px; font-weight: 600; }
        .vbx-card-meta { font-size: 10px; color: #484f58; }
        .vbx-play-btn {
          width: 40px; height: 40px; border-radius: 50%; border: 2px solid #30363d;
          background: none; color: #c9d1d9; font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .vbx-play-btn:hover { border-color: #58a6ff; color: #58a6ff; }
        .vbx-play-btn.playing { border-color: #22c55e; color: #22c55e; background: rgba(34,197,94,0.1); }
        .vbx-progress-bar { height: 3px; background: #21262d; border-radius: 2px; margin-top: 8px; overflow: hidden; }
        .vbx-progress-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #4ade80); border-radius: 2px; width: 0; }
        .vbx-animated { animation: vbx-fill 3s ease-in-out infinite; }
        @keyframes vbx-fill { 0%{width:0} 50%{width:60%} 100%{width:100%} }
        .vbx-transcript { margin-top: 8px; padding: 8px; background: rgba(13,17,23,0.5); border-radius: 6px; }
        .vbx-transcript p { font-size: 12px; line-height: 1.6; color: #8b949e; margin: 0; }
        .vbx-history { margin-top: 12px; padding-top: 10px; border-top: 1px solid #21262d; }
        .vbx-history-title { font-size: 11px; color: #484f58; display: block; margin-bottom: 6px; }
        .vbx-history-list { }
        .vbx-history-item {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 8px; font-size: 11px; cursor: pointer; border-radius: 4px;
        }
        .vbx-history-item:hover { background: rgba(22,27,34,0.5); }
        .vbx-replay-btn { background: none; border: none; color: #8b949e; cursor: pointer; font-size: 12px; margin-left: auto; }
      `}</style>
    </div>
  );
}
