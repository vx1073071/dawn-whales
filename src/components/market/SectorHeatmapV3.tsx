import { useState, useMemo } from 'react';

interface SectorBlock {
  id: string;
  name: string;
  icon: string;
  changePercent: number;
  heat: number; // 0..100
  topStock: string;
  topChange: number;
  marketCap: number; // billions
  upCount: number;
  downCount: number;
  neutral: number;
  aiDiagnosisAvailable: boolean;
}

const MOCK_SECTORS: SectorBlock[] = [
  { id: 'semiconductor', name: 'Semiconductor', icon: '💻', changePercent: 3.2, heat: 85, topStock: 'NVDA', topChange: 5.2, marketCap: 4200, upCount: 18, downCount: 2, neutral: 0, aiDiagnosisAvailable: true },
  { id: 'ai-cloud', name: 'AI & Cloud', icon: '☁️', changePercent: 2.8, heat: 78, topStock: 'MSFT', topChange: 1.5, marketCap: 3800, upCount: 14, downCount: 4, neutral: 2, aiDiagnosisAvailable: true },
  { id: 'crypto', name: 'Crypto', icon: '🪙', changePercent: 2.1, heat: 72, topStock: 'COIN', topChange: 4.8, marketCap: 2500, upCount: 12, downCount: 5, neutral: 3, aiDiagnosisAvailable: true },
  { id: 'energy', name: 'Energy', icon: '🛢️', changePercent: -0.8, heat: 35, topStock: 'XOM', topChange: -1.2, marketCap: 1800, upCount: 5, downCount: 14, neutral: 1, aiDiagnosisAvailable: true },
  { id: 'consumer', name: 'Consumer', icon: '🛒', changePercent: 0.3, heat: 55, topStock: 'AMZN', topChange: 0.7, marketCap: 3200, upCount: 10, downCount: 8, neutral: 2, aiDiagnosisAvailable: true },
  { id: 'financials', name: 'Financials', icon: '🏦', changePercent: -0.5, heat: 42, topStock: 'JPM', topChange: -0.9, marketCap: 2800, upCount: 7, downCount: 12, neutral: 1, aiDiagnosisAvailable: false },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', changePercent: 0.6, heat: 60, topStock: 'UNH', topChange: 0.9, marketCap: 2200, upCount: 11, downCount: 7, neutral: 2, aiDiagnosisAvailable: false },
  { id: 'real-estate', name: 'Real Estate', icon: '🏘️', changePercent: -1.5, heat: 25, topStock: 'PLD', topChange: -2.1, marketCap: 950, upCount: 3, downCount: 16, neutral: 1, aiDiagnosisAvailable: false },
  { id: 'auto', name: 'Automotive', icon: '🚗', changePercent: -2.1, heat: 18, topStock: 'TSLA', topChange: -4.3, marketCap: 1500, upCount: 2, downCount: 17, neutral: 1, aiDiagnosisAvailable: false },
  { id: 'defense', name: 'Defense', icon: '🛡️', changePercent: 1.2, heat: 65, topStock: 'RTX', topChange: 1.8, marketCap: 1100, upCount: 13, downCount: 5, neutral: 2, aiDiagnosisAvailable: false },
];

function getHeatColor(heat: number): { bg: string; text: string; border: string } {
  if (heat >= 80) return { bg: '#14532d', text: '#4ade80', border: '#22c55e' }; // 极端涨
  if (heat >= 65) return { bg: '#1a5c2a', text: '#86efac', border: '#4ade80' }; // 大涨
  if (heat >= 55) return { bg: '#1a5c1a', text: '#a3e635', border: '#65a30d' }; // 温和涨
  if (heat >= 45) return { bg: '#1a2a1a', text: '#d4d4d8', border: '#52525b' }; // 中性
  if (heat >= 35) return { bg: '#2a1a1a', text: '#fca5a5', border: '#dc2626' }; // 温和跌
  if (heat >= 20) return { bg: '#3b1a1a', text: '#f87171', border: '#ef4444' }; // 大跌
  return { bg: '#450a0a', text: '#ef4444', border: '#b91c1c' }; // 极端跌
}

function SectorHeatBlock({ sector, onClickAI }: { sector: SectorBlock; onClickAI: () => void }) {
  const colors = getHeatColor(sector.heat);
  const direction = sector.changePercent > 0 ? '↑' : sector.changePercent < 0 ? '↓' : '→';

  return (
    <div className="shb-block" style={{ background: colors.bg, borderColor: colors.border }}>
      <div className="shb-top">
        <span className="shb-icon">{sector.icon}</span>
        <span className="shb-name" style={{ color: colors.text }}>{sector.name}</span>
      </div>
      <div className="shb-change" style={{ color: colors.text }}>
        <span className="shb-direction">{direction}</span>
        <span className="shb-pct">{sector.changePercent > 0 ? '+' : ''}{sector.changePercent.toFixed(1)}%</span>
      </div>
      <div className="shb-heat-bar">
        <div className="shb-heat-fill" style={{ width: `${sector.heat}%`, background: colors.text }} />
      </div>
      <div className="shb-details">
        <div className="shb-stock-counts">
          <span className="shb-up-count">▲{sector.upCount}</span>
          <span className="shb-down-count">▼{sector.downCount}</span>
          {sector.neutral > 0 && <span className="shb-neutral-count">={sector.neutral}</span>}
        </div>
        <div className="shb-leader">
          <span className="shb-leader-label">Leader</span>
          <span className="shb-leader-name">{sector.topStock}</span>
          <span className={`shb-leader-change ${sector.topChange > 0 ? 'pos' : 'neg'}`}>
            {sector.topChange > 0 ? '+' : ''}{sector.topChange.toFixed(1)}%
          </span>
        </div>
        <div className="shb-cap">
          <span className="shb-cap-label">Mkt Cap</span>
          <span className="shb-cap-value">${(sector.marketCap / 1000).toFixed(1)}T</span>
        </div>
      </div>
      {sector.aiDiagnosisAvailable && (
        <button className="shb-ai-btn" onClick={onClickAI}>
          🤖 AI Diagnosis (1U)
        </button>
      )}
    </div>
  );
}

function AIHoverDiagnosis({ sector, onClose }: { sector: SectorBlock; onClose: () => void }) {
  const diagnosis = useMemo(() => {
    if (sector.changePercent > 2) return {
      summary: `${sector.name} showing strong momentum. ${sector.topStock} leads with ${sector.topChange > 0 ? '+' : ''}${sector.topChange}%. Up/down ratio: ${sector.upCount}/${sector.downCount}. Bullish breadth.`,
      drivers: ['Strong institutional buying', 'Sector rotation inflow', `${sector.topStock} earnings beat catalyzing peers`],
      risks: ['Overbought RSI > 70', 'Valuation stretched vs 5yr avg', 'Macro headwinds if rates rise'],
      keyLevels: { support: `$${(sector.marketCap * 0.95).toFixed(0)}B mkt`, resistance: `$${(sector.marketCap * 1.05).toFixed(0)}B mkt` },
      confidence: 82,
    };
    return {
      summary: `${sector.name} under pressure. ${sector.downCount}/${sector.upCount} stocks declining. ${sector.topStock} leading weakness.`,
      drivers: ['Profit-taking after recent rally', 'Sector rotation outflow', 'Macro uncertainty'],
      risks: ['May find support at 200-day MA', 'Oversold could trigger bounce', 'Earnings season ahead'],
      keyLevels: { support: `$${(sector.marketCap * 0.92).toFixed(0)}B mkt`, resistance: `$${(sector.marketCap * 0.98).toFixed(0)}B mkt` },
      confidence: 75,
    };
  }, [sector]);

  return (
    <div className="shb-ai-overlay" onClick={e => e.stopPropagation()}>
      <div className="shb-ai-card">
        <div className="shb-ai-header">
          <span>🤖 AI Diagnosis: {sector.name}</span>
          <span className="shb-ai-confidence">{diagnosis.confidence}% confidence</span>
          <button className="shb-ai-close" onClick={onClose}>×</button>
        </div>
        <p className="shb-ai-summary">{diagnosis.summary}</p>
        <div className="shb-ai-section">
          <span className="shb-ai-subtitle">📈 Drivers</span>
          <ul>{diagnosis.drivers.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
        <div className="shb-ai-section">
          <span className="shb-ai-subtitle">⚠️ Risks</span>
          <ul>{diagnosis.risks.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
        <div className="shb-ai-keys">
          <span>Support: {diagnosis.keyLevels.support}</span>
          <span>Resistance: {diagnosis.keyLevels.resistance}</span>
        </div>
        <div className="shb-ai-footer">
          <span className="shb-ai-cost">1 USDT</span>
          <button className="shb-ai-action-btn">📊 Backtest Sector</button>
        </div>
      </div>
    </div>
  );
}

export default function SectorHeatmapV3() {
  const [sectors] = useState<SectorBlock[]>(MOCK_SECTORS);
  const [selectedAI, setSelectedAI] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [period, setPeriod] = useState<'1D' | '1W' | '1M'>('1D');
  const [sortedBy, setSortedBy] = useState<'change' | 'heat' | 'cap'>('change');

  const sortedSectors = useMemo(() => {
    const s = [...sectors];
    if (sortedBy === 'change') s.sort((a, b) => b.changePercent - a.changePercent);
    if (sortedBy === 'heat') s.sort((a, b) => b.heat - a.heat);
    if (sortedBy === 'cap') s.sort((a, b) => b.marketCap - a.marketCap);
    return s;
  }, [sectors, sortedBy]);

  const leader = sortedSectors[0];
  const lagger = sortedSectors[sortedSectors.length - 1];
  const totalUp = sectors.filter(s => s.changePercent > 0).length;
  const totalDown = sectors.filter(s => s.changePercent < 0).length;

  const colorLegend = [
    { label: '+2%+', color: '#4ade80', bg: '#14532d' },
    { label: '+1~2%', color: '#86efac', bg: '#1a5c2a' },
    { label: '0~1%', color: '#a3e635', bg: '#1a5c1a' },
    { label: 'Flat', color: '#d4d4d8', bg: '#1a2a1a' },
    { label: '0~-1%', color: '#fca5a5', bg: '#2a1a1a' },
    { label: '-1~-2%', color: '#f87171', bg: '#3b1a1a' },
    { label: '-2%+', color: '#ef4444', bg: '#450a0a' },
  ];

  return (
    <div className="shb-container">
      {/* header */}
      <div className="shb-header">
        <div className="shb-title-row">
          <span className="shb-icon">🔥</span>
          <span className="shb-title">Sector Heatmap</span>
        </div>
        <div className="shb-controls">
          <div className="shb-period-group">
            {(['1D', '1W', '1M'] as const).map(p => (
              <button key={p} className={`shb-period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
          <div className="shb-sort-group">
            <span className="shb-sort-label">Sort:</span>
            {(['change', 'heat', 'cap'] as const).map(s => (
              <button key={s} className={`shb-sort-btn ${sortedBy === s ? 'active' : ''}`} onClick={() => setSortedBy(s)}>
                {s === 'change' ? '%' : s === 'heat' ? '🔥' : '💰'}
              </button>
            ))}
          </div>
          <button className={`shb-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
          <button className={`shb-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>≡</button>
        </div>
      </div>

      {/* summary bar */}
      <div className="shb-summary">
        <div className="shb-summary-stat">
          <span className="shb-summary-label">Leading</span>
          <span className="shb-summary-value">{leader.icon} {leader.name} <span className="pos">+{leader.changePercent.toFixed(1)}%</span></span>
        </div>
        <div className="shb-summary-stat">
          <span className="shb-summary-label">Lagging</span>
          <span className="shb-summary-value">{lagger.icon} {lagger.name} <span className="neg">{lagger.changePercent.toFixed(1)}%</span></span>
        </div>
        <div className="shb-summary-stat">
          <span className="shb-summary-label">Breadth</span>
          <span className="shb-summary-value">
            <span className="pos">{totalUp}↑</span> / <span className="neg">{totalDown}↓</span>
          </span>
        </div>
      </div>

      {/* color legend */}
      <div className="shb-legend">
        {colorLegend.map(c => (
          <div key={c.label} className="shb-legend-item">
            <span className="shb-legend-swatch" style={{ background: c.bg, borderColor: c.color }} />
            <span className="shb-legend-label">{c.label}</span>
          </div>
        ))}
      </div>

      {/* grid view */}
      {viewMode === 'grid' && (
        <div className="shb-grid">
          {sortedSectors.map(s => (
            <SectorHeatBlock key={s.id} sector={s} onClickAI={() => setSelectedAI(s.id)} />
          ))}
        </div>
      )}

      {/* list view */}
      {viewMode === 'list' && (
        <div className="shb-list">
          <div className="shb-list-header">
            <span className="shb-lh-sector">Sector</span>
            <span className="shb-lh-change">Change</span>
            <span className="shb-lh-heat">Heat</span>
            <span className="shb-lh-breadth">↑/↓</span>
            <span className="shb-lh-leader">Leader</span>
            <span className="shb-lh-cap">Mkt Cap</span>
            <span className="shb-lh-ai">AI</span>
          </div>
          {sortedSectors.map(s => (
            <div key={s.id} className="shb-list-row" style={{ borderLeftColor: getHeatColor(s.heat).border }}>
              <span className="shb-lr-sector">{s.icon} {s.name}</span>
              <span className={`shb-lr-change ${s.changePercent > 0 ? 'pos' : 'neg'}`}>{s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(1)}%</span>
              <span className="shb-lr-heat">
                <div className="shb-lr-heat-bar"><div className="shb-lr-heat-fill" style={{ width: `${s.heat}%`, background: getHeatColor(s.heat).text }} /></div>
              </span>
              <span className="shb-lr-breadth">{s.upCount}↑ {s.downCount}↓</span>
              <span className="shb-lr-leader">{s.topStock} <span className={s.topChange > 0 ? 'pos' : 'neg'}>{s.topChange > 0 ? '+' : ''}{s.topChange}%</span></span>
              <span className="shb-lr-cap">${(s.marketCap / 1000).toFixed(1)}T</span>
              <span className="shb-lr-ai">{s.aiDiagnosisAvailable ? '🤖' : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI diagnosis overlay */}
      {selectedAI && (
        <AIHoverDiagnosis
          sector={sectors.find(s => s.id === selectedAI)!}
          onClose={() => setSelectedAI(null)}
        />
      )}

      <style>{`
        .shb-container {
          background: var(--bg-surface, #0d1117);
          border: 1px solid var(--border, #21262d);
          border-radius: 12px; padding: 14px;
          color: var(--text-primary, #c9d1d9);
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .shb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px; }
        .shb-title-row { display: flex; align-items: center; gap: 6px; }
        .shb-icon { font-size: 18px; }
        .shb-title { font-size: 15px; font-weight: 600; }
        .shb-controls { display: flex; align-items: center; gap: 6px; }
        .shb-period-group, .shb-sort-group { display: flex; gap: 1px; }
        .shb-period-btn, .shb-sort-btn, .shb-view-btn {
          background: none; border: 1px solid #30363d; color: #8b949e;
          border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer;
        }
        .shb-period-btn.active, .shb-sort-btn.active, .shb-view-btn.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
        .shb-sort-label { font-size: 10px; color: #484f58; margin-right: 4px; }
        .shb-summary { display: flex; gap: 12px; margin-bottom: 10px; padding: 8px 12px; background: rgba(22,27,34,0.5); border-radius: 8px; }
        .shb-summary-stat { display: flex; flex-direction: column; flex: 1; }
        .shb-summary-label { font-size: 9px; color: #484f58; text-transform: uppercase; }
        .shb-summary-value { font-size: 12px; font-weight: 500; }
        .pos { color: #22c55e; } .neg { color: #ef4444; }
        .shb-legend { display: flex; gap: 2px; margin-bottom: 10px; flex-wrap: wrap; }
        .shb-legend-item { display: flex; align-items: center; gap: 3px; }
        .shb-legend-swatch { width: 16px; height: 12px; border-radius: 2px; border: 1px solid; }
        .shb-legend-label { font-size: 9px; color: #484f58; }
        .shb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
        .shb-block {
          padding: 12px; border-radius: 10px; border: 1px solid;
          display: flex; flex-direction: column; gap: 6px;
          transition: transform 0.15s, box-shadow 0.15s; cursor: pointer;
        }
        .shb-block:hover { transform: scale(1.03); box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .shb-top { display: flex; align-items: center; gap: 6px; }
        .shb-icon { font-size: 20px; }
        .shb-name { font-size: 13px; font-weight: 600; }
        .shb-change { display: flex; align-items: baseline; gap: 4px; }
        .shb-direction { font-size: 18px; }
        .shb-pct { font-size: 18px; font-weight: 700; }
        .shb-heat-bar { height: 3px; background: rgba(107,114,128,0.2); border-radius: 2px; overflow: hidden; }
        .shb-heat-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }
        .shb-details { display: flex; flex-direction: column; gap: 2px; font-size: 10px; }
        .shb-stock-counts { display: flex; gap: 6px; }
        .shb-up-count { color: #22c55e; }
        .shb-down-count { color: #ef4444; }
        .shb-neutral-count { color: #6b7280; }
        .shb-leader { display: flex; gap: 4px; align-items: center; }
        .shb-leader-label { color: #484f58; }
        .shb-leader-name { font-weight: 600; }
        .shb-cap { display: flex; gap: 4px; }
        .shb-cap-label { color: #484f58; }
        .shb-cap-value { color: #8b949e; }
        .shb-ai-btn {
          background: rgba(31,111,235,0.1); border: 1px solid rgba(31,111,235,0.3);
          color: #58a6ff; border-radius: 6px; padding: 4px 8px;
          font-size: 10px; cursor: pointer; text-align: center; margin-top: 4px;
        }
        .shb-ai-btn:hover { background: rgba(31,111,235,0.2); }
        .shb-ai-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .shb-ai-card {
          background: #0d1117; border: 1px solid #30363d; border-radius: 12px;
          padding: 20px; max-width: 480px; width: 90vw; max-height: 80vh; overflow-y: auto;
        }
        .shb-ai-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .shb-ai-confidence { font-size: 10px; color: #484f58; }
        .shb-ai-close { margin-left: auto; background: none; border: none; color: #8b949e; font-size: 20px; cursor: pointer; }
        .shb-ai-summary { font-size: 13px; line-height: 1.6; margin-bottom: 12px; color: #c9d1d9; }
        .shb-ai-section { margin-bottom: 10px; }
        .shb-ai-subtitle { font-size: 11px; font-weight: 600; color: #58a6ff; display: block; margin-bottom: 4px; }
        .shb-ai-section ul { margin: 0; padding-left: 18px; }
        .shb-ai-section li { font-size: 11px; color: #8b949e; margin-bottom: 2px; }
        .shb-ai-keys { display: flex; gap: 16px; font-size: 11px; color: #8b949e; margin-bottom: 12px; }
        .shb-ai-footer { display: flex; justify-content: space-between; align-items: center; }
        .shb-ai-cost { font-size: 11px; color: #fbbf24; }
        .shb-ai-action-btn { background: #238636; color: #fff; border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 12px; }
        .shb-list { }
        .shb-list-header { display: flex; gap: 8px; padding: 6px 8px; font-size: 10px; color: #484f58; text-transform: uppercase; border-bottom: 1px solid #21262d; margin-bottom: 4px; }
        .shb-list-row { display: flex; gap: 8px; align-items: center; padding: 6px 8px; font-size: 11px; border-left: 2px solid; margin-bottom: 2px; border-radius: 2px; background: rgba(22,27,34,0.3); }
        .shb-lh-sector, .shb-lr-sector { flex: 2; }
        .shb-lh-change, .shb-lr-change { flex: 1; text-align: right; font-weight: 600; }
        .shb-lh-heat, .shb-lr-heat { flex: 1.5; }
        .shb-lh-breadth, .shb-lr-breadth { flex: 1; text-align: center; }
        .shb-lh-leader, .shb-lr-leader { flex: 1.5; }
        .shb-lh-cap, .shb-lr-cap { flex: 1; text-align: right; }
        .shb-lh-ai, .shb-lr-ai { flex: 0.5; text-align: center; }
        .shb-lr-heat-bar { height: 3px; background: rgba(107,114,128,0.2); border-radius: 2px; overflow: hidden; }
        .shb-lr-heat-fill { height: 100%; border-radius: 2px; }
      `}</style>
    </div>
  );
}
