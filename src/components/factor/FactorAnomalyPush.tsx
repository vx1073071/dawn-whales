/**
 * FactorAnomalyPush — R279 ML#4: 因子异动推送UI
 *
 * Real-time factor anomaly detection and push:
 * - Factor value exceeding 2 std (Z-score)
 * - IC spike/plunge alerts
 * - Crowding sudden change
 * - Push notification configuration per factor
 * - Alert history log
 */
import React, { useState } from 'react';

interface AnomalyAlert {
  id: string;
  factorId: string;
  factorName: string;
  market: string;
  flag: string;
  type: 'Z_SCORE' | 'IC_SPIKE' | 'CROWDING' | 'REGIME_SHIFT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  value: number;
  threshold: number;
  direction: 'ABOVE' | 'BELOW';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface PushConfig {
  factorId: string;
  factorName: string;
  enabled: boolean;
  channels: string[];  // desktop, mobile, email
  zScoreThreshold: number;
  icThreshold: number;
  cooldownMin: number;
}

const MOCK_ALERTS: AnomalyAlert[] = [
  { id: 'alt_001', factorId: 'PE_TTM_US', factorName: 'US PE TTM', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', type: 'Z_SCORE', severity: 'HIGH', value: 2.1, threshold: 2.0, direction: 'ABOVE', message: 'PE TTM Z-score 2.1 — valuation stretched beyond normal range', timestamp: '2026-06-18T02:15', acknowledged: false },
  { id: 'alt_002', factorId: 'Northbound_CN', factorName: 'CN Northbound', market: 'CN', flag: '\u{1F1E8}\u{1F1F3}', type: 'IC_SPIKE', severity: 'CRITICAL', value: 0.35, threshold: 0.20, direction: 'ABOVE', message: 'Northbound IC spiked to 0.35 — unusually strong predictive power', timestamp: '2026-06-18T01:30', acknowledged: false },
  { id: 'alt_003', factorId: 'PCR_NDX', factorName: 'NDX Put/Call', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', type: 'Z_SCORE', severity: 'MEDIUM', value: -1.8, threshold: 1.5, direction: 'BELOW', message: 'PCR extremely low — complacency warning. Historically precedes pullback', timestamp: '2026-06-17T22:00', acknowledged: true },
  { id: 'alt_004', factorId: 'MOM_12M_JP', factorName: 'JP Momentum', market: 'JP', flag: '\u{1F1EF}\u{1F1F5}', type: 'REGIME_SHIFT', severity: 'HIGH', value: 0, threshold: 0, direction: 'ABOVE', message: 'Momentum regime shifting from neutral to bullish after 45 days', timestamp: '2026-06-17T18:00', acknowledged: false },
  { id: 'alt_005', factorId: 'Crowding_US_Value', factorName: 'US Value Crowding', market: 'US', flag: '\u{1F1FA}\u{1F1F8}', type: 'CROWDING', severity: 'HIGH', value: 0.75, threshold: 0.70, direction: 'ABOVE', message: 'Value factor crowding at 75th percentile — crowded trade risk', timestamp: '2026-06-17T14:00', acknowledged: true },
];

const MOCK_CONFIGS: PushConfig[] = [
  { factorId: 'PE_TTM_US', factorName: 'US PE TTM', enabled: true, channels: ['desktop', 'mobile'], zScoreThreshold: 2.0, icThreshold: 0.20, cooldownMin: 60 },
  { factorId: 'Northbound_CN', factorName: 'CN Northbound', enabled: true, channels: ['desktop', 'mobile', 'email'], zScoreThreshold: 1.8, icThreshold: 0.15, cooldownMin: 30 },
  { factorId: 'PCR_NDX', factorName: 'NDX Put/Call', enabled: true, channels: ['desktop'], zScoreThreshold: 2.0, icThreshold: 0.15, cooldownMin: 120 },
];

export const FactorAnomalyPush: React.FC = () => {
  const [tab, setTab] = useState<'alerts' | 'config'>('alerts');
  const [configs, setConfigs] = useState(MOCK_CONFIGS);

  const unacknowledged = MOCK_ALERTS.filter(a => !a.acknowledged).length;
  const criticalCount = MOCK_ALERTS.filter(a => a.severity === 'CRITICAL' && !a.acknowledged).length;

  const toggleChannel = (factorId: string, ch: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.factorId !== factorId) return c;
      const channels = c.channels.includes(ch) ? c.channels.filter(x => x !== ch) : [...c.channels, ch];
      return { ...c, channels };
    }));
  };

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{'\u{1F514}'} Factor Anomaly Alerts</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setTab('alerts')} style={tabBtn(tab === 'alerts')}>{'\u{1F4CB}'} Alerts {unacknowledged > 0 ? `(${unacknowledged})` : ''}</button>
          <button onClick={() => setTab('config')} style={tabBtn(tab === 'config')}>{'\u2699}\u{FE0F}'} Config</button>
        </div>
      </div>

      {tab === 'alerts' ? (
        <>
          {/* Alert summary */}
          {criticalCount > 0 && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.25)', marginBottom: 10, fontSize: 11, fontWeight: 600, color: '#ef4444' }}>
              {'\u{203C}\u{FE0F}'} {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} requiring attention
            </div>
          )}

          {MOCK_ALERTS.map(a => {
            const sevColors: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6' };
            const typeIcons: Record<string, string> = { Z_SCORE: '\u{1F4CF}', IC_SPIKE: '\u{26A1}', CROWDING: '\u{1F465}', REGIME_SHIFT: '\u{1F504}' };
            return (
              <div key={a.id} style={{
                padding: '8px 10px', marginBottom: 4, borderRadius: 6,
                background: a.acknowledged ? 'var(--bg-card)' : 'var(--bg-card)',
                border: `1px solid var(--border)`,
                borderLeft: `3px solid ${sevColors[a.severity]}`,
                opacity: a.acknowledged ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14 }}>{a.flag}</span>
                      <span style={{ fontWeight: 700 }}>{a.factorName}</span>
                      <span style={{
                        padding: '1px 5px', borderRadius: 3, background: `${sevColors[a.severity]}18`, color: sevColors[a.severity],
                        fontSize: 9, fontWeight: 600,
                      }}>{a.severity}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{typeIcons[a.type]} {a.type.replace('_', ' ')}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{a.message}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                      Value: {a.value} | {a.direction} threshold {a.threshold} | {a.timestamp}
                    </div>
                  </div>
                  {!a.acknowledged && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,.12)', color: '#818cf8', fontWeight: 600 }}>
                      NEW
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        /* Config tab */
        <div>
          {configs.map(c => (
            <div key={c.factorId} style={{ padding: 10, marginBottom: 6, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{c.factorName}</span>
                <button onClick={() => setConfigs(prev => prev.map(x => x.factorId === c.factorId ? { ...x, enabled: !x.enabled } : x))}
                  style={{
                    padding: '2px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    background: c.enabled ? 'rgba(34,197,94,.15)' : 'rgba(107,114,128,.15)',
                    color: c.enabled ? '#22c55e' : '#6b7280', border: 'none',
                  }}>
                  {c.enabled ? '\u{2713} ON' : '\u{2717} OFF'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 10, marginBottom: 6 }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Z-Score: </span>
                  <span style={{ fontWeight: 600 }}>{c.zScoreThreshold}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>IC Spike: </span>
                  <span style={{ fontWeight: 600 }}>{c.icThreshold}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Cooldown: </span>
                  <span style={{ fontWeight: 600 }}>{c.cooldownMin}min</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {['desktop', 'mobile', 'email'].map(ch => (
                  <button key={ch} onClick={() => toggleChannel(c.factorId, ch)} style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                    border: c.channels.includes(ch) ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: c.channels.includes(ch) ? 'rgba(99,102,241,.10)' : 'transparent',
                    color: c.channels.includes(ch) ? 'var(--accent)' : 'var(--text-dim)',
                  }}>
                    {c.channels.includes(ch) ? '\u{2705}' : '\u{2B1C}'} {ch}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#fff' : 'var(--text)', fontSize: 12, cursor: 'pointer', fontWeight: active ? 700 : 500,
});

export default FactorAnomalyPush;
