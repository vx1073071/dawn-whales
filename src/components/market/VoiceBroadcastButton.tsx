import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceState {
  speaking: boolean;
  text: string;
  error: string | null;
}

export function VoiceBroadcastButton() {
  const [state, setState] = useState<VoiceState>({ speaking: false, text: '', error: null });
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const marketStates = [
    { icon: '☀️', label: 'Bullish', text: 'US markets are bullish today. S&P 500 up 0.8%, led by tech and semiconductors. NVDA surged 5.2% on strong AI demand.', key: 'bull' },
    { icon: '🌥️', label: 'Mixed', text: 'Markets are mixed. Hang Seng down 1.2% while Nikkei gained 0.5%. Crypto is flat. Gold is holding steady.', key: 'mixed' },
    { icon: '🌧️', label: 'Bearish', text: 'Markets under pressure. Global sell-off triggered by rising yields. VIX spiked to 28. Defensive sectors outperforming.', key: 'bear' },
  ];

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setState({ speaking: false, text, error: 'TTS not supported in this browser' });
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    utterance.onstart = () => setState(s => ({ ...s, speaking: true, error: null }));
    utterance.onend = () => setState(s => ({ ...s, speaking: false }));
    utterance.onerror = () => setState(s => ({ ...s, speaking: false, error: 'TTS playback failed' }));
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState(s => ({ ...s, speaking: false }));
  }, []);

  useEffect(() => { return () => { window.speechSynthesis?.cancel(); }; }, []);

  return (
    <div className="voi-panel">
      <div className="voi-presets">
        {marketStates.map(ms => (
          <button key={ms.key} className={`voi-preset-btn ${state.speaking ? 'voi-disabled' : ''}`}
            onClick={() => { if (!state.speaking) { setState(s => ({ ...s, text: ms.text })); speak(ms.text); } }}
            disabled={state.speaking}>
            <span className="voi-preset-icon">{ms.icon}</span>
            <span className="voi-preset-label">{ms.label}</span>
          </button>
        ))}
      </div>

      {state.speaking && (
        <div className="voi-playing">
          <span className="voi-pulse">🔊</span>
          <span>Speaking market briefing...</span>
          <button className="voi-stop-btn" onClick={stop}>⏹ Stop</button>
        </div>
      )}

      {state.error && <div className="voi-error">⚠ {state.error}</div>}

      <style>{`
        .voi-panel { background:var(--bg-surface,#0d1117); border:1px solid #21262d; border-radius:12px; padding:14px; color:#c9d1d9; font-family:'Inter',-apple-system,sans-serif; }
        .voi-presets { display:flex; gap:8px; flex-wrap:wrap; }
        .voi-preset-btn { display:flex; flex-direction:column; align-items:center; gap:4px; background:#161b22; border:1px solid #30363d; border-radius:10px; padding:10px 16px; cursor:pointer; color:#c9d1d9; transition:all 0.2s; min-width:80px; }
        .voi-preset-btn:hover { border-color:#58a6ff; background:rgba(31,111,235,0.08); }
        .voi-preset-btn.voi-disabled { opacity:0.5; cursor:not-allowed; }
        .voi-preset-icon { font-size:24px; }
        .voi-preset-label { font-size:11px; color:#8b949e; }
        .voi-playing { margin-top:10px; display:flex; align-items:center; gap:8px; padding:8px 12px; background:rgba(34,197,94,0.1); border-radius:8px; border:1px solid rgba(34,197,94,0.2); }
        .voi-pulse { animation:voi-pulse 1s ease-in-out infinite; }
        @keyframes voi-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .voi-stop-btn { margin-left:auto; background:#ef4444; color:#fff; border:none; border-radius:6px; padding:4px 12px; cursor:pointer; font-size:12px; }
        .voi-error { margin-top:8px; color:#f87171; font-size:12px; }
      `}</style>
    </div>
  );
}
