import { useState, type CSSProperties } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';

// ── Types ──
interface P2POrder { id: string; type: 'buy' | 'sell'; amount: number; price: number; total: number; status: 'active' | 'locked' | 'completed' | 'disputed'; counterparty: string; created: string; frozenUntil?: string }

interface BlacklistEntry { id: string; userId: string; reason: string; addedBy: string; addedAt: string; status: 'active' | 'expired'; expiresAt?: string }

const ORDERS: P2POrder[] = [
  { id: 'p2p-1', type: 'buy', amount: 500, price: 7.80, total: 3900, status: 'completed', counterparty: 'TraderX', created: '2026-06-09 15:30' },
  { id: 'p2p-2', type: 'sell', amount: 200, price: 7.82, total: 1564, status: 'locked', counterparty: 'QuantKing', created: '2026-06-09 10:00', frozenUntil: '2026-06-23 10:00' },
  { id: 'p2p-3', type: 'buy', amount: 100, price: 7.79, total: 779, status: 'disputed', counterparty: 'NewTrader88', created: '2026-06-08 20:15' },
  { id: 'p2p-4', type: 'sell', amount: 350, price: 7.81, total: 2733.5, status: 'active', counterparty: 'AlphaFund', created: '2026-06-09 17:45' },
];

const BLACKLIST: BlacklistEntry[] = [
  { id: 'bl-1', userId: 'user-scammer-99', reason: i18n.t('P2PBlacklistPanel.k1'), addedBy: 'Admin', addedAt: '2026-06-01', status: 'active' },
  { id: 'bl-2', userId: 'user-spam-42', reason: i18n.t('P2PBlacklistPanel.k2'), addedBy: 'Moderator', addedAt: '2026-05-28', status: 'active' },
  { id: 'bl-3', userId: 'user-test-expired', reason: i18n.t('P2PBlacklistPanel.k3'), addedBy: 'System', addedAt: '2026-03-15', status: 'expired', expiresAt: '2026-03-15' },
];

// ── Sub-components ──
function StatusBadge({ status }: { status: string }) {
  const { t: _t } = useTranslation();

  const map: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: i18n.t('P2PBlacklistPanel.k4'), color: '#06B6D4', bg: '#06B6D422' },
    locked: { label: i18n.t('P2PBlacklistPanel.k5'), color: '#F59E0B', bg: '#F59E0B22' },
    completed: { label: i18n.t('P2PBlacklistPanel.k6'), color: '#10B981', bg: '#10B98122' },
    disputed: { label: i18n.t('P2PBlacklistPanel.k7'), color: '#EF4444', bg: '#EF444422' },
  };
  const s = map[status] || map.active;
  return <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
}

function CountdownTimer({ until }: { until: string }) {
  const target = new Date(until).getTime();
  const [now] = useState(Date.now());
  const diff = target - now;
  const days = Math.max(0, Math.ceil(diff / 86400000));
  return (
    <span style={{ fontSize: 11, color: days > 0 ? '#FBBF24' : '#34D399', fontWeight: 600 }}>
      {days > 0 ? `⏳ ${days}${i18n.t('P2PBlacklistPanel.k0')}` : i18n.t('P2PBlacklistPanel.k8')}
    </span>
  );
}

// ── Tab: P2P Orders ──
function P2POrdersTab() {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? ORDERS : ORDERS.filter(o => o.status === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['all', 'active', 'locked', 'completed', 'disputed'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 6, border: '1px solid', borderColor: filter === f ? '#6366F1' : '#374151',
            background: filter === f ? '#6366F118' : 'transparent', color: filter === f ? '#818CF8' : '#6B7280',
            fontSize: 12, cursor: 'pointer',
          }}>
            {f === 'all' ? 'components.all' : f === 'active' ? i18n.t('P2PBlacklistPanel.k9') : f === 'locked' ? i18n.t('P2PBlacklistPanel.k10') : f === 'completed' ? i18n.t('P2PBlacklistPanel.k11') : i18n.t('P2PBlacklistPanel.k12')}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>ID</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', color: '#9CA3AF' }}>{i18n.t('P2PBlacklistPanel.k0')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: '#9CA3AF' }}>{"components.quantity"}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: '#9CA3AF' }}>{i18n.t('P2PBlacklistPanel.k1')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: '#9CA3AF' }}>{i18n.t('P2PBlacklistPanel.k2')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', color: '#9CA3AF' }}>{"components.status"}</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>{"components.time"}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid #1F2937' }}>
                <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{o.id}</td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#6366F122', color: '#818CF8' }}>{o.counterparty}</span>
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#D1D5DB' }}>{o.amount} USDT</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#D1D5DB' }}>HK$ {o.price.toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#D1D5DB', fontWeight: 600 }}>
                  HK$ {o.total.toLocaleString()}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  <StatusBadge status={o.status} />
                  {o.frozenUntil && <div style={{ marginTop: 2 }}><CountdownTimer until={o.frozenUntil} /></div>}
                </td>
                <td style={{ padding: '10px 10px', color: '#9CA3AF', fontSize: 11 }}>{o.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Appeal entry */}
      <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#D1D5DB', marginBottom: 8 }}>⚖️ 申诉入口</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[i18n.t('P2PBlacklistPanel.k13'), i18n.t('P2PBlacklistPanel.k14'), i18n.t('P2PBlacklistPanel.k15'), i18n.t('P2PBlacklistPanel.k16')].map(r => (
            <button key={r} style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #374151', background: '#1F2937',
              color: '#D1D5DB', fontSize: 12, cursor: 'pointer', textAlign: 'left',
            }}>
              📋 {r}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>
          💡 申诉后订单进入争议状态 · 平台不仲裁 · 双方协商解决 · 申诉费率 0.3%
        </div>
      </div>
    </div>
  );
}

// ── Tab: Blacklist ──
function BlacklistTab() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#D1D5DB' }}>
          🚫 黑名单管理 · {BLACKLIST.filter(b => b.status === 'active').length} 个活跃
        </div>
        <button style={{
          padding: '6px 16px', borderRadius: 6, border: '1px solid #EF4444', background: '#EF444418',
          color: '#FCA5A5', fontSize: 12, cursor: 'pointer',
        }}>
          + 添加黑名单
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>{i18n.t('P2PBlacklistPanel.k3')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>{i18n.t('P2PBlacklistPanel.k4')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>{i18n.t('P2PBlacklistPanel.k5')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: '#9CA3AF' }}>{i18n.t('P2PBlacklistPanel.k6')}</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', color: '#9CA3AF' }}>{"components.status"}</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', color: '#9CA3AF' }}>{"components.actions"}</th>
            </tr>
          </thead>
          <tbody>
            {BLACKLIST.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid #1F2937' }}>
                <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontSize: 12, color: '#FCA5A5' }}>{b.userId}</td>
                <td style={{ padding: '10px 10px', color: '#D1D5DB', fontSize: 12, maxWidth: 200 }}>
                  {b.reason}
                </td>
                <td style={{ padding: '10px 10px', color: '#9CA3AF' }}>{b.addedBy}</td>
                <td style={{ padding: '10px 10px', color: '#9CA3AF', fontSize: 11 }}>{b.addedAt}</td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: b.status === 'active' ? '#EF444422' : '#6B728022',
                    color: b.status === 'active' ? '#FCA5A5' : '#6B7280',
                  }}>
                    {b.status === 'active' ? i18n.t('P2PBlacklistPanel.k17') : i18n.t('P2PBlacklistPanel.k18')}
                  </span>
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  {b.status === 'active' && (
                    <button style={{
                      padding: '4px 10px', borderRadius: 4, border: '1px solid #374151', background: '#1F2937',
                      color: '#D1D5DB', fontSize: 11, cursor: 'pointer',
                    }}>
                      移除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main ──
export default function P2PBlacklistPanel() {
  const [tab, setTab] = useState<'p2p' | 'blacklist'>('p2p');

  const theme: CSSProperties = {
    background: '#0A0A10', borderRadius: 16, padding: 24,
    border: '1px solid #1F2937', color: '#E5E7EB',
    maxWidth: 860, margin: '0 auto',
  };

  return (
    <div style={theme}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>
            ⚖️ P2P 转账 & 黑名单
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            14天冻结 · 4选1申诉 · 黑名单管理 · 0.3%双向手续费
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab('p2p')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'p2p' ? '#6366F1' : '#1F2937',
          color: tab === 'p2p' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>💱 P2P 转账</button>
        <button onClick={() => setTab('blacklist')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'blacklist' ? '#6366F1' : '#1F2937',
          color: tab === 'blacklist' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>🚫 黑名单</button>
      </div>

      {tab === 'p2p' && <P2POrdersTab />}
      {tab === 'blacklist' && <BlacklistTab />}
    </div>
  );
}

void EngineError; // [TRADE] structured error tracking