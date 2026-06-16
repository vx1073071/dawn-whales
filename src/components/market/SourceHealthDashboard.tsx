import { useState, useEffect, useCallback, useMemo } from 'react';

interface SourceHealth {
  id: string;
  name: string;
  icon: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  latency: number;
  uptime: number;
  successRate: number;
  lastCheck: number;
  markets: string[];
  errorMessage?: string;
}

const MOCK_SOURCES: SourceHealth[] = [
  { id: 'yahoo', name: 'Yahoo Finance', icon: '📊', status: 'healthy', latency: 85, uptime: 99.8, successRate: 99.5, lastCheck: Date.now() - 5000, markets: ['US', 'HK', 'JP', 'UK', 'DE', 'FR', 'AU', 'SG'] },
  { id: 'binance', name: 'Binance', icon: '🔶', status: 'healthy', latency: 42, uptime: 99.9, successRate: 99.9, lastCheck: Date.now() - 3000, markets: ['Crypto'] },
  { id: 'futu', name: 'Futu OpenD', icon: '🐮', status: 'healthy', latency: 28, uptime: 100, successRate: 100, lastCheck: Date.now() - 2000, markets: ['HK', 'US', 'CN'] },
  { id: 'moomoo', name: 'Moomoo', icon: '🦬', status: 'degraded', latency: 145, uptime: 97.2, successRate: 96.8, lastCheck: Date.now() - 8000, markets: ['HK', 'US'], errorMessage: 'High latency' },
  { id: 'ibkr', name: 'Interactive Brokers', icon: '🏦', status: 'healthy', latency: 55, uptime: 99.5, successRate: 99.2, lastCheck: Date.now() - 4000, markets: ['US', 'HK', 'JP', 'UK', 'DE'] },
  { id: 'eastmoney', name: 'EastMoney', icon: '🇨🇳', status: 'degraded', latency: 210, uptime: 95.5, successRate: 94.2, lastCheck: Date.now() - 15000, markets: ['CN'], errorMessage: 'Slow response' },
  { id: 'google', name: 'Google Finance', icon: '🔍', status: 'offline', latency: 0, uptime: 85.0, successRate: 80.0, lastCheck: Date.now() - 60000, markets: ['US', 'UK', 'JP'], errorMessage: 'Connection timeout' },
];

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e', degraded: '#f59e0b', unhealthy: '#ef4444', offline: '#6b7280',
};

export function SourceHealthDashboard() {
  const [sources, setSources] = useState<SourceHealth[]>(MOCK_SOURCES);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(() => {
    setSources(prev => prev.map(s => {
      const jitter = () => Math.random() * 30 - 15;
      return {
        ...s,
        latency: Math.max(5, (s.latency || 80) + jitter()),
        uptime: Math.min(100, Math.max(80, (s.uptime || 98) + (Math.random() - 0.5) * 2)),
        successRate: Math.min(100, Math.max(75, (s.successRate || 98) + (Math.random() - 0.5) * 3)),
        lastCheck: Date.now(),
      };
    }));
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { healthy: 0, degraded: 0, unhealthy: 0, offline: 0 };
    sources.forEach(s => c[s.status]++);
    return c;
  }, [sources]);

  const overallHealth = statusCounts.offline === 0 && statusCounts.unhealthy === 0
    ? (statusCounts.degraded === 0 ? 'All Healthy' : 'Minor Degradation')
    : 'Issues Detected';

  return (
    <div className="shd-panel">
      <div className="shd-header">
        <div className="shd-title-row">
          <span className={`shd-overall ${statusCounts.offline + statusCounts.unhealthy > 0 ? 'issues' : 'ok'}`}>
            {overallHealth}
          </span>
        </div>
        <div className="shd-actions">
          <button className={`shd-refresh-btn ${autoRefresh ? 'active' : ''}`} onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? '⟳ Auto' : '⟳ Manual'}
          </button>
          <button className="shd-refresh-btn" onClick={refresh}>🔄 Now</button>
        </div>
      </div>

      <div className="shd-banner">
        {(['healthy', 'degraded', 'unhealthy', 'offline'] as const).map(s => (
          <div key={s} className="shd-banner-stat">
            <span className="shd-banner-value" style={{ color: STATUS_COLORS[s] }}>{statusCounts[s]}</span>
            <span className="shd-banner-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          </div>
        ))}
      </div>

      <div className="shd-cards">
        {sources.map(s => (
          <div key={s.id} className={`shd-card ${selectedSource === s.id ? 'expanded' : ''} shd-${s.status}`}
            onClick={() => setSelectedSource(selectedSource === s.id ? null : s.id)}>
            <div className="shd-card-top">
              <span className="shd-source-icon">{s.icon}</span>
              <span className="shd-source-name">{s.name}</span>
              <span className="shd-status-dot" style={{ backgroundColor: STATUS_COLORS[s.status] }} />
              <span className="shd-status-text" style={{ color: STATUS_COLORS[s.status] }}>{s.status.toUpperCase()}</span>
            </div>
            <div className="shd-card-metrics">
              <div className="shd-metric">
                <span className="shd-metric-label">Latency</span>
                <span className="shd-metric-value">{s.latency > 0 ? `${Math.round(s.latency)}ms` : '—'}</span>
              </div>
              <div className="shd-metric">
                <span className="shd-metric-label">Uptime</span>
                <span className="shd-metric-value">{s.uptime.toFixed(1)}%</span>
              </div>
              <div className="shd-metric">
                <span className="shd-metric-label">Success</span>
                <span className="shd-metric-value">{s.successRate.toFixed(1)}%</span>
              </div>
            </div>
            <div className="shd-health-bar">
              <div className="shd-health-fill" style={{
                width: `${s.successRate}%`,
                backgroundColor: s.successRate > 98 ? '#22c55e' : s.successRate > 90 ? '#f59e0b' : '#ef4444',
              }} />
            </div>
            {selectedSource === s.id && (
              <div className="shd-card-detail">
                <div className="shd-detail-markets">
                  <span className="shd-detail-label">Markets:</span>
                  {s.markets.map(m => <span key={m} className="shd-market-tag">{m}</span>)}
                </div>
                <div className="shd-detail-time">Last check: {new Date(s.lastCheck).toLocaleTimeString()}</div>
                {s.errorMessage && <div className="shd-detail-error">⚠ {s.errorMessage}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .shd-panel { background:var(--bg-surface,#0d1117); border:1px solid #21262d; border-radius:12px; padding:14px; color:#c9d1d9; font-family:'Inter',-apple-system,sans-serif; }
        .shd-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .shd-title-row { display:flex; align-items:center; gap:8px; }
        .shd-overall { font-size:10px; padding:2px 8px; border-radius:10px; }
        .shd-overall.ok { background:rgba(34,197,94,0.15); color:#22c55e; }
        .shd-overall.issues { background:rgba(239,68,68,0.15); color:#ef4444; }
        .shd-actions { display:flex; gap:4px; }
        .shd-refresh-btn { background:none; border:1px solid #30363d; color:#8b949e; border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; }
        .shd-refresh-btn.active { background:#1f6feb; color:#fff; border-color:#1f6feb; }
        .shd-banner { display:flex; gap:12px; margin-bottom:12px; padding:10px; background:rgba(22,27,34,0.5); border-radius:8px; }
        .shd-banner-stat { display:flex; flex-direction:column; align-items:center; flex:1; }
        .shd-banner-value { font-size:18px; font-weight:700; }
        .shd-banner-label { font-size:10px; color:#8b949e; }
        .shd-cards { display:flex; flex-direction:column; gap:6px; }
        .shd-card { background:#161b22; border:1px solid #21262d; border-radius:8px; padding:10px 12px; cursor:pointer; transition:all 0.2s; }
        .shd-card:hover { border-color:#30363d; }
        .shd-card.expanded { border-color:#1f6feb; }
        .shd-card.shd-healthy { border-left:3px solid #22c55e; }
        .shd-card.shd-degraded { border-left:3px solid #f59e0b; }
        .shd-card.shd-unhealthy { border-left:3px solid #ef4444; }
        .shd-card.shd-offline { border-left:3px solid #6b7280; opacity:0.7; }
        .shd-card-top { display:flex; align-items:center; gap:8px; }
        .shd-source-icon { font-size:18px; }
        .shd-source-name { flex:1; font-size:13px; font-weight:500; }
        .shd-status-dot { width:8px; height:8px; border-radius:50%; }
        .shd-status-text { font-size:10px; font-weight:600; }
        .shd-card-metrics { display:flex; gap:16px; margin:8px 0 6px; }
        .shd-metric { display:flex; flex-direction:column; }
        .shd-metric-label { font-size:10px; color:#8b949e; }
        .shd-metric-value { font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; }
        .shd-health-bar { height:3px; background:#21262d; border-radius:2px; margin-bottom:4px; overflow:hidden; }
        .shd-health-fill { height:100%; border-radius:2px; transition:width 0.5s; }
        .shd-card-detail { margin-top:8px; padding-top:8px; border-top:1px solid #21262d; }
        .shd-detail-markets { display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-bottom:4px; }
        .shd-detail-label { font-size:10px; color:#8b949e; }
        .shd-market-tag { font-size:9px; background:rgba(31,111,235,0.15); color:#58a6ff; padding:1px 5px; border-radius:4px; }
        .shd-detail-time { font-size:10px; color:#484f58; margin-bottom:2px; }
        .shd-detail-error { font-size:10px; color:#f87171; }
      `}</style>
    </div>
  );
}
