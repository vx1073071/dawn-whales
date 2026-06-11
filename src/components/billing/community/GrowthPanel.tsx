import i18n from '../../../i18n';
﻿import { useState, type CSSProperties } from 'react';

// ── R80: ML-80-01/02/03 综合 — 内容审核+邀请裂变+成就+PWA+GA打磨 ──

// Types
interface ModerationItem { id: string; type: 'report' | 'spam' | 'sensitive'; user: string; content: string; status: 'pending' | 'approved' | 'blocked'; reportedAt: string }
interface InviteRecord { code: string; usedBy: string; status: 'pending' | 'completed'; reward: number; date: string }
interface Achievement { id: string; name: string; icon: string; description: string; progress: number; target: number; unlocked: boolean; reward: string }

const MODERATION: ModerationItem[] = [
  { id: 'm1', type: 'report', user: 'TraderX', content: i18n.t('GrowthPanel.k1'), status: 'pending', reportedAt: '2026-06-09 22:30' },
  { id: 'm2', type: 'spam', user: 'Bot_User99', content: i18n.t('GrowthPanel.k2'), status: 'blocked', reportedAt: '2026-06-09 20:15' },
  { id: 'm3', type: 'sensitive', user: 'Anonymous', content: i18n.t('GrowthPanel.k3'), status: 'pending', reportedAt: '2026-06-09 21:00' },
  { id: 'm4', type: 'report', user: 'QuantKing', content: i18n.t('GrowthPanel.k4'), status: 'approved', reportedAt: '2026-06-08 18:00' },
];

const INVITES: InviteRecord[] = [
  { code: 'DW-A3X7K', usedBy: 'Friend_Alpha', status: 'completed', reward: 1.0, date: '2026-06-09' },
  { code: 'DW-B9M2P', usedBy: 'Friend_Beta', status: 'completed', reward: 1.0, date: '2026-06-08' },
  { code: 'DW-C5L8R', usedBy: '—', status: 'pending', reward: 0, date: i18n.t('GrowthPanel.k5') },
];

const ACHIEVEMENTS: Achievement[] = [
  { id: 'a1', name: i18n.t('GrowthPanel.k6'), icon: '📈', description: i18n.t('GrowthPanel.k7'), progress: 1, target: 1, unlocked: true, reward: i18n.t('GrowthPanel.k8') },
  { id: 'a2', name: i18n.t('GrowthPanel.k9'), icon: '🔔', description: i18n.t('GrowthPanel.k10'), progress: 1, target: 1, unlocked: true, reward: i18n.t('GrowthPanel.k11') },
  { id: 'a3', name: i18n.t('GrowthPanel.k12'), icon: '💰', description: i18n.t('GrowthPanel.k13'), progress: 1, target: 1, unlocked: true, reward: i18n.t('GrowthPanel.k14') },
  { id: 'a4', name: i18n.t('GrowthPanel.k15'), icon: '🔥', description: i18n.t('GrowthPanel.k16'), progress: 5, target: 7, unlocked: false, reward: i18n.t('GrowthPanel.k17') },
  { id: 'a5', name: i18n.t('GrowthPanel.k18'), icon: '📡', description: i18n.t('GrowthPanel.k19'), progress: 6, target: 10, unlocked: false, reward: i18n.t('GrowthPanel.k20') },
  { id: 'a6', name: i18n.t('GrowthPanel.k21'), icon: '👥', description: i18n.t('GrowthPanel.k22'), progress: 2, target: 3, unlocked: false, reward: i18n.t('GrowthPanel.k23') },
  { id: 'a7', name: i18n.t('GrowthPanel.k24'), icon: '🏆', description: i18n.t('GrowthPanel.k25'), progress: 87, target: 100, unlocked: false, reward: i18n.t('GrowthPanel.k26') },
];

// ── Tab: Content Moderation ──
function ModerationTab() {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? MODERATION : MODERATION.filter(m => m.status === filter || m.type === filter);

  const typeColors: Record<string, { label: string; color: string }> = {
    report: { label: i18n.t('GrowthPanel.k27'), color: '#F59E0B' },
    spam: { label: i18n.t('GrowthPanel.k28'), color: '#EF4444' },
    sensitive: { label: i18n.t('GrowthPanel.k29'), color: '#8B5CF6' },
  };
  const statusColors: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: i18n.t('GrowthPanel.k30'), color: '#F59E0B', bg: '#F59E0B22' },
    approved: { label: i18n.t('GrowthPanel.k31'), color: '#10B981', bg: '#10B98122' },
    blocked: { label: i18n.t('GrowthPanel.k32'), color: '#EF4444', bg: '#EF444422' },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['all', 'pending', 'report', 'spam'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 6, border: '1px solid', borderColor: filter === f ? '#6366F1' : '#374151',
            background: filter === f ? '#6366F118' : 'transparent', color: filter === f ? '#818CF8' : '#6B7280', fontSize: 12, cursor: 'pointer',
          }}>
            {f === 'all' ? 'components.all' : f === 'pending' ? i18n.t('GrowthPanel.k33') : f === 'report' ? i18n.t('GrowthPanel.k34') : i18n.t('GrowthPanel.k35')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(m => {
          const tc = typeColors[m.type];
          const sc = statusColors[m.status];
          return (
            <div key={m.id} style={{
              padding: '14px 16px', borderRadius: 10, background: '#111827',
              border: `1px solid ${m.status === 'pending' ? '#F59E0B33' : '#1F2937'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tc.color + '22', color: tc.color }}>{tc.label}</span>
                  <span style={{ fontSize: 13, color: '#D1D5DB' }}>{m.user}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{m.reportedAt}</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>{m.content}</div>
              {m.status === 'pending' && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#10B981', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{i18n.t('GrowthPanel.k36')}</button>
                  <button style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{i18n.t('GrowthPanel.k37')}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Invite Referral ──
function InviteTab() {
  const inviteCode = 'DW-A3X7K';
  const totalRewards = 2.0;
  const invitesPending = 1;
  const link = `https://dawnwhales.com/invite/${inviteCode}`;

  return (
    <div>
      {/* Invite card */}
      <div style={{
        padding: '22px', borderRadius: 14, background: 'linear-gradient(135deg, #6366F118, #D4A85314)',
        border: '1px solid #374151', textAlign: 'center', marginBottom: 20,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>{i18n.t('GrowthPanel.k38')}</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>
          每成功邀请 1 人 → 双方各得 <strong style={{ color: '#D4A853' }}>{i18n.t('GrowthPanel.k39')}</strong>（价值 1.0 USDT）
        </div>

        {/* Invite link */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
          <input readOnly value={link} style={{
            flex: 1, maxWidth: 340, padding: '10px 14px', borderRadius: 8, border: '1px solid #374151',
            background: '#111827', color: '#818CF8', fontSize: 13, fontFamily: 'monospace', outline: 'none',
          }} />
          <button style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#6366F1', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{i18n.t('GrowthPanel.k40')}</button>
        </div>

        <div style={{ fontSize: 11, color: '#6B7280' }}>
          🛡️ 防刷: 同设备/同IP 24h内最多3个有效邀请
        </div>
      </div>

      {/* Rewards summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{i18n.t('GrowthPanel.k41')}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#D4A853' }}>{totalRewards.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>{i18n.t('GrowthPanel.k42')}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{i18n.t('GrowthPanel.k43')}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#F59E0B' }}>{invitesPending}</div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>{i18n.t('GrowthPanel.k44')}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{i18n.t('GrowthPanel.k45')}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#818CF8' }}>#12</div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>{i18n.t('GrowthPanel.k46')}</div>
        </div>
      </div>

      {/* History */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#D1D5DB', marginBottom: 10 }}>{i18n.t('GrowthPanel.k47')}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>{i18n.t('GrowthPanel.k48')}</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>{i18n.t('GrowthPanel.k49')}</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', color: '#9CA3AF' }}>{"components.status"}</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#9CA3AF' }}>{i18n.t('GrowthPanel.k50')}</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#9CA3AF' }}>{"components.date"}</th>
              </tr>
            </thead>
            <tbody>
              {INVITES.map(i => (
                <tr key={i.code} style={{ borderBottom: '1px solid #1F2937' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#818CF8' }}>{i.code}</td>
                  <td style={{ padding: '10px 12px', color: '#D1D5DB' }}>{i.usedBy}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: i.status === 'completed' ? '#10B98122' : '#6B728022', color: i.status === 'completed' ? '#34D399' : '#6B7280' }}>
                      {i.status === 'completed' ? i18n.t('GrowthPanel.k51') : i18n.t('GrowthPanel.k52')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#D4A853', fontWeight: 600 }}>{i.reward > 0 ? `+${i.reward} USDT` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#9CA3AF', fontSize: 11 }}>{i.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Achievements ──
function AchievementTab() {
  const unlocked = ACHIEVEMENTS.filter(a => a.unlocked).length;
  const total = ACHIEVEMENTS.length;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{i18n.t('GrowthPanel.k53')}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#D4A853' }}>{unlocked}/{total}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: 10, background: '#111827', border: '1px solid #1F2937', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{i18n.t('GrowthPanel.k54')}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#818CF8' }}>{Math.round(unlocked/total*100)}%</div>
        </div>
      </div>

      {/* Achievement list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACHIEVEMENTS.map(a => (
          <div key={a.id} style={{
            padding: '14px 16px', borderRadius: 10, background: '#111827',
            border: `1px solid ${a.unlocked ? '#D4A85333' : '#1F2937'}`,
            opacity: a.unlocked ? 1 : 0.7,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{a.unlocked ? a.icon : '🔒'}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: a.unlocked ? '#D4A853' : '#D1D5DB' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{a.description}</div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: a.unlocked ? '#34D399' : '#F59E0B' }}>
                {a.unlocked ? i18n.t('GrowthPanel.k55') : `${a.progress}/${a.target}`}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 6, borderRadius: 3, background: '#374151', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: a.unlocked ? '#D4A853' : 'linear-gradient(90deg, #6366F1, #818CF8)',
                width: `${(a.progress / a.target) * 100}%`,
                transition: 'width 0.5s',
              }} />
            </div>

            <div style={{ fontSize: 11, color: '#6B7280' }}>
              🎁 {a.unlocked ? `${i18n.t('GrowthPanel.k0')}${a.reward}` : `${i18n.t('GrowthPanel.k1')}${a.reward}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──
export default function GrowthPanel() {
  const [tab, setTab] = useState<'moderation' | 'invite' | 'achievement'>('moderation');

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
            🚀 增长运营中心
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9CA3AF' }}>
            内容审核 · 邀请裂变 · 成就系统 · v1.9.0 GA
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        <button onClick={() => setTab('moderation')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'moderation' ? '#6366F1' : '#1F2937',
          color: tab === 'moderation' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>{i18n.t('GrowthPanel.k56')}</button>
        <button onClick={() => setTab('invite')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'invite' ? '#6366F1' : '#1F2937',
          color: tab === 'invite' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>{i18n.t('GrowthPanel.k57')}</button>
        <button onClick={() => setTab('achievement')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: tab === 'achievement' ? '#6366F1' : '#1F2937',
          color: tab === 'achievement' ? '#FFF' : '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>{i18n.t('GrowthPanel.k58')}</button>
      </div>

      {tab === 'moderation' && <ModerationTab />}
      {tab === 'invite' && <InviteTab />}
      {tab === 'achievement' && <AchievementTab />}
    </div>
  );
}
