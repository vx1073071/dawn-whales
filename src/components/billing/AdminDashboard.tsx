/**
 * AdminDashboard + UserManagement — ML-64-01 [P0]
 * R64: v1.6.0-alpha — /admin Web后台 (2FA login, independent)
 *
 * Features:
 * - 5-metric dashboard: DAU / Creators / Revenue / Trades / AI Calls
 * - 24h trend sparklines for each metric
 * - User management: creator list, search, level display (L1-L3)
 * - Freeze/unfreeze toggle with confirmation
 * - Blacklist: add/remove with reason
 * - Verified badge toggle for creators
 * - Admin-only: hidden page, requires 2FA
 */

import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface AdminMetrics {
  dau: number;
  dauTrend: number[];
  creators: number;
  creatorsTrend: number[];
  revenue: number;
  revenueTrend: number[];
  trades: number;
  tradesTrend: number[];
  aiCalls: number;
  aiCallsTrend: number[];
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'creator' | 'user';
  level: 'L1' | 'L2' | 'L3' | null;
  verified: boolean;
  frozen: boolean;
  blacklisted: boolean;
  blacklistReason?: string;
  joinedAt: string;
  revenue: number;
  subscribers: number;
}

export interface AdminDashboardProps {
  metrics?: AdminMetrics;
  users?: ManagedUser[];
  onFreeze?: (userId: string) => void;
  onUnfreeze?: (userId: string) => void;
  onBlacklist?: (userId: string, reason: string) => void;
  onRemoveBlacklist?: (userId: string) => void;
  onToggleVerified?: (userId: string) => void;
  onRefresh?: () => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockMetrics: AdminMetrics = {
  dau: 342, dauTrend: [280, 305, 290, 320, 315, 340, 342],
  creators: 48, creatorsTrend: [42, 44, 43, 45, 46, 47, 48],
  revenue: 2850, revenueTrend: [2100, 2250, 2400, 2580, 2700, 2780, 2850],
  trades: 1247, tradesTrend: [980, 1050, 1100, 1150, 1180, 1210, 1247],
  aiCalls: 2156, aiCallsTrend: [1800, 1900, 1950, 2000, 2050, 2100, 2156],
};

const mockUsers: ManagedUser[] = [
  { id: 'u-01', name: 'QuantEdge Pro', email: 'qe@dawnwhales.com', role: 'creator', level: 'L3', verified: true, frozen: false, blacklisted: false, joinedAt: '2026-04-01', revenue: 8500, subscribers: 1842 },
  { id: 'u-02', name: 'DeepAlpha AI', email: 'da@dawnwhales.com', role: 'creator', level: 'L2', verified: true, frozen: false, blacklisted: false, joinedAt: '2026-04-15', revenue: 3200, subscribers: 967 },
  { id: 'u-03', name: 'Sentiment Hawk', email: 'sh@dawnwhales.com', role: 'creator', level: 'L3', verified: true, frozen: false, blacklisted: false, joinedAt: '2026-03-20', revenue: 12000, subscribers: 3150 },
  { id: 'u-04', name: 'CryptoFlow_CN', email: 'cf@dawnwhales.com', role: 'creator', level: 'L1', verified: false, frozen: false, blacklisted: false, joinedAt: '2026-05-10', revenue: 280, subscribers: 45 },
  { id: 'u-05', name: 'SpamBot_01', email: 'spam@fake.com', role: 'user', level: null, verified: false, frozen: true, blacklisted: true, blacklistReason: 'Multiple disputed transactions', joinedAt: '2026-05-20', revenue: -150, subscribers: 0 },
];

// ── Mini Sparkline ──────────────────────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color: string; width?: number }> = ({ data, color, width = 70 }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1); const min = Math.min(...data, 0);
  const range = max - min || 1; const h = 24; const step = (width - 4) / (data.length - 1);
  const points = data.map((v, i) => `${2 + i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={h}><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
  );
};

// ── AdminDashboard ──────────────────────────────────────────────────────

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  metrics: inputMetrics,
  users: inputUsers,
  onFreeze, onUnfreeze, onBlacklist, onRemoveBlacklist, onToggleVerified, onRefresh,
  className = '',
}) => {
  const [metrics] = useState<AdminMetrics>(inputMetrics ?? mockMetrics);
  const [users, setUsers] = useState<ManagedUser[]>(inputUsers ?? mockUsers);
  const [tab, setTab] = useState<'dashboard' | 'users' | 'blacklist'>('dashboard');
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string } | null>(null);
  const [blReason, setBlReason] = useState('');

  const filtered = useMemo(() => {
    let list = tab === 'blacklist' ? users.filter(u => u.blacklisted) : users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, tab, search]);

  const metricCards = [
    { label: 'DAU', value: metrics.dau.toLocaleString(), trend: metrics.dauTrend, color: '#3b82f6' },
    { label: 'Creators', value: String(metrics.creators), trend: metrics.creatorsTrend, color: '#8b5cf6' },
    { label: 'Revenue', value: `$${metrics.revenue.toLocaleString()}`, trend: metrics.revenueTrend, color: '#10b981' },
    { label: 'Trades', value: metrics.trades.toLocaleString(), trend: metrics.tradesTrend, color: '#f59e0b' },
    { label: 'AI Calls', value: metrics.aiCalls.toLocaleString(), trend: metrics.aiCallsTrend, color: '#ef4444' },
  ];

  const handleAction = (id: string, action: string) => {
    if (action === 'blacklist') { setConfirmAction({ id, action }); return; }
    if (action === 'freeze') { setUsers(prev => prev.map(u => u.id === id ? { ...u, frozen: true } : u)); onFreeze?.(id); }
    if (action === 'unfreeze') { setUsers(prev => prev.map(u => u.id === id ? { ...u, frozen: false } : u)); onUnfreeze?.(id); }
    if (action === 'verify') { setUsers(prev => prev.map(u => u.id === id ? { ...u, verified: !u.verified } : u)); onToggleVerified?.(id); }
    if (action === 'unblacklist') { setUsers(prev => prev.map(u => u.id === id ? { ...u, blacklisted: false } : u)); onRemoveBlacklist?.(id); }
  };

  const confirmBlacklist = () => {
    if (!confirmAction) return;
    setUsers(prev => prev.map(u => u.id === confirmAction.id ? { ...u, blacklisted: true, blacklistReason: blReason } : u));
    onBlacklist?.(confirmAction.id, blReason);
    setConfirmAction(null); setBlReason('');
  };

  return (
    <div className={`admin-dashboard ${className}`} style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">🛡 Admin Dashboard</h1>
          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">ADMIN ONLY</span>
        </div>
        <button onClick={onRefresh} className="text-xs text-blue-600 font-medium">🔄 Refresh</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        {['dashboard', 'users', 'blacklist'].map(k => (
          <button key={k} onClick={() => setTab(k as typeof tab)}
            className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all capitalize ${tab === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            {k === 'blacklist' ? `🚫 Blacklist (${users.filter(u => u.blacklisted).length})` : k === 'users' ? `👥 Users (${users.length})` : '📊 Dashboard'}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div>
          <div className="grid grid-cols-5 gap-3 mb-6">
            {metricCards.map(m => (
              <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="text-[10px] text-slate-400 font-semibold mb-1">{m.label}</div>
                <div className="text-lg font-bold text-slate-800 mb-1">{m.value}</div>
                <Sparkline data={m.trend} color={m.color} width={60} />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-700 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              {([
                ['👥', 'User Mgmt', 'users'],
                ['🚫', 'Blacklist', 'blacklist'],
                ['💰', 'Fee Config', ''],
                ['📋', 'Audit Log', ''],
                ['🔑', 'License Keys', ''],
                ['⚙️', 'Settings', ''],
              ] as [string, string, string][]).map(([icon, label, target]) => (
                <button key={label} onClick={() => { if (target) setTab(target as 'users'|'blacklist'); }}
                  className="bg-slate-50 hover:bg-slate-100 rounded-lg p-3 text-center transition-colors">
                  <div className="text-lg mb-0.5">{icon}</div>
                  <div className="font-semibold text-slate-600">{label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users/Blacklist Tab */}
      {(tab === 'users' || tab === 'blacklist') && (
        <div>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-blue-300 outline-none" />

          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {filtered.map(u => (
              <div key={u.id} className={`bg-white rounded-xl border p-4 ${u.frozen ? 'border-red-300 bg-red-50/30' : u.blacklisted ? 'border-slate-400 bg-gray-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">{u.name}</span>
                    {u.verified && <span className="text-[10px] text-blue-500">✓</span>}
                    {u.level && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${u.level === 'L3' ? 'bg-purple-100 text-purple-700' : u.level === 'L2' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>{u.level}</span>}
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{u.role}</span>
                    {u.frozen && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">FROZEN</span>}
                    {u.blacklisted && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">BLACKLISTED</span>}
                  </div>
                  <span className="text-[10px] text-slate-400">{u.email}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[10px] mb-3">
                  <div><span className="text-slate-400">Revenue</span><div className="font-bold">${u.revenue.toLocaleString()}</div></div>
                  <div><span className="text-slate-400">Subscribers</span><div className="font-bold">{u.subscribers}</div></div>
                  <div><span className="text-slate-400">Joined</span><div>{u.joinedAt}</div></div>
                  {u.blacklistReason && <div><span className="text-red-400">Reason</span><div className="text-red-500">{u.blacklistReason}</div></div>}
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {u.frozen
                    ? <button onClick={() => handleAction(u.id, 'unfreeze')} className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200">Unfreeze</button>
                    : <button onClick={() => handleAction(u.id, 'freeze')} className="text-[10px] font-semibold bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">Freeze</button>
                  }
                  <button onClick={() => handleAction(u.id, 'verify')} className={`text-[10px] font-semibold px-2 py-1 rounded ${u.verified ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-600'}`}>
                    {u.verified ? 'Unverify' : '✓ Verify'}
                  </button>
                  {u.blacklisted
                    ? <button onClick={() => handleAction(u.id, 'unblacklist')} className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">Remove Blacklist</button>
                    : <button onClick={() => handleAction(u.id, 'blacklist')} className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200">🚫 Blacklist</button>
                  }
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No results</p>}
          </div>
        </div>
      )}

      {/* Blacklist Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-3">🚫 Add to Blacklist</h3>
            <p className="text-xs text-slate-500 mb-3">This will freeze P2P transfers and withdrawals for this user.</p>
            <textarea value={blReason} onChange={e => setBlReason(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 h-16 mb-3 focus:ring-2 focus:ring-red-300 outline-none resize-none"
              placeholder="Reason for blacklisting..." />
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl">Cancel</button>
              <button onClick={confirmBlacklist} disabled={!blReason.trim()}
                className={`flex-1 text-sm font-bold px-4 py-2.5 rounded-xl ${blReason.trim() ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                Confirm Blacklist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
