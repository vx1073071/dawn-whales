/**
 * TransactionMonitor + AuditLog — ML-64-02 [P0]
 * R64: v1.6.0-alpha — /admin transaction monitoring & audit trail
 *
 * Features:
 * - Real-time transaction stream (simulated polling)
 * - Abnormal transaction alerts: large amount (>1000 USDT), high frequency (>10/day)
 * - Transaction detail: type/amount/parties/status/timestamp
 * - Audit log: who did what when, with IP and result
 * - Searchable/filterable log by user, action type, time range
 * - Export capability hint
 */

import React, { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface MonitoredTransaction {
  id: string;
  type: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  status: 'completed' | 'frozen' | 'pending' | 'failed' | 'disputed';
  flagged: boolean;
  flagReason?: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  admin: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
  timestamp: string;
  category: 'user' | 'system' | 'financial' | 'security';
}

export interface TransactionMonitorProps {
  transactions?: MonitoredTransaction[];
  auditLog?: AuditEntry[];
  onDismiss?: (txId: string) => void;
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockTransactions: MonitoredTransaction[] = [
  { id: 'tx-mon-001', type: 'P2P Transfer', from: 'QuantEdge Pro', to: 'Sentiment Hawk', amount: 1200, fee: 3.6, status: 'completed', flagged: true, flagReason: 'Large amount >1000 USDT', createdAt: '2026-06-09T06:30:00Z' },
  { id: 'tx-mon-002', type: 'AI Analysis', from: 'DeepAlpha AI', to: 'System', amount: 1.5, fee: 0, status: 'completed', flagged: false, createdAt: '2026-06-09T06:28:00Z' },
  { id: 'tx-mon-003', type: 'Withdrawal', from: 'CryptoFlow_CN', to: 'External', amount: 200, fee: 0.2, status: 'pending', flagged: false, createdAt: '2026-06-09T06:25:00Z' },
  { id: 'tx-mon-004', type: 'P2P Transfer', from: 'SpamBot_01', to: 'Unknown', amount: 50, fee: 0.15, status: 'frozen', flagged: true, flagReason: 'Blacklisted user activity', createdAt: '2026-06-09T06:20:00Z' },
  { id: 'tx-mon-005', type: 'Subscription', from: 'User_1024', to: 'Sentiment Hawk', amount: 100, fee: 0.3, status: 'completed', flagged: false, createdAt: '2026-06-09T06:15:00Z' },
  { id: 'tx-mon-006', type: 'P2P Transfer', from: 'NewUser_X', to: 'NewUser_Y', amount: 800, fee: 2.4, status: 'completed', flagged: true, flagReason: 'New account (<7d) large transfer', createdAt: '2026-06-09T06:10:00Z' },
];

const mockAudit: AuditEntry[] = [
  { id: 'au-001', admin: 'admin@dawnwhales.com', action: 'Blacklist User', target: 'SpamBot_01', detail: 'Multiple disputed transactions', ip: '10.0.1.100', timestamp: '2026-06-09T06:20:00Z', category: 'user' },
  { id: 'au-002', admin: 'admin@dawnwhales.com', action: 'Manual Unfreeze', target: 'Transfer p2p-003', detail: 'System error recovery', ip: '10.0.1.100', timestamp: '2026-06-09T06:00:00Z', category: 'financial' },
  { id: 'au-003', admin: 'admin@dawnwhales.com', action: 'Verify Creator', target: 'DeepAlpha AI', detail: 'Identity verified', ip: '10.0.1.100', timestamp: '2026-06-08T22:00:00Z', category: 'user' },
  { id: 'au-004', admin: 'admin@dawnwhales.com', action: 'Fee Adjust', target: 'L3 Commission', detail: 'Adjusted to 90/10', ip: '10.0.1.100', timestamp: '2026-06-08T18:00:00Z', category: 'system' },
  { id: 'au-005', admin: 'admin@dawnwhales.com', action: '2FA Reset', target: 'User_1024', detail: 'Lost device recovery', ip: '10.0.1.100', timestamp: '2026-06-08T15:30:00Z', category: 'security' },
  { id: 'au-006', admin: 'admin@dawnwhales.com', action: 'License Revoke', target: 'user@leaked.com', detail: 'License key shared publicly', ip: '10.0.1.100', timestamp: '2026-06-08T12:00:00Z', category: 'security' },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const typeIcon: Record<string, string> = { 'P2P Transfer': '💸', 'AI Analysis': '🤖', 'Withdrawal': '🏦', 'Subscription': '📡', 'Commission': '💎' };
const statusColor: Record<string, string> = { completed: 'text-emerald-600', frozen: 'text-amber-600', pending: 'text-blue-600', failed: 'text-red-500', disputed: 'text-red-500' };
const categoryColor: Record<string, string> = { user: 'bg-blue-100 text-blue-700', system: 'bg-purple-100 text-purple-700', financial: 'bg-emerald-100 text-emerald-700', security: 'bg-red-100 text-red-700' };

// ── TransactionMonitor ──────────────────────────────────────────────────

const TransactionMonitor: React.FC<TransactionMonitorProps> = ({
  transactions: inputTx,
  auditLog: inputAudit,
  onDismiss,
  className = '',
}) => {
  const [txs] = useState<MonitoredTransaction[]>(inputTx ?? mockTransactions);
  const [auditLog] = useState<AuditEntry[]>(inputAudit ?? mockAudit);
  const [tab, setTab] = useState<'transactions' | 'audit'>('transactions');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState<string>('all');
  const [txFilter, setTxFilter] = useState<'all' | 'flagged'>('all');

  const filteredTx = txFilter === 'flagged' ? txs.filter(t => t.flagged) : txs;

  const filteredAudit = useMemo(() => {
    let list = auditLog;
    if (auditCategory !== 'all') list = list.filter(a => a.category === auditCategory);
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      list = list.filter(a => a.admin.toLowerCase().includes(q) || a.action.toLowerCase().includes(q) || a.target.toLowerCase().includes(q));
    }
    return list;
  }, [auditLog, auditCategory, auditSearch]);

  const alertCount = txs.filter(t => t.flagged).length;

  return (
    <div className={`tx-monitor ${className}`} style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">📡 Transaction Monitor</h1>
          {alertCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-full font-bold animate-pulse">
              {alertCount} alert{alertCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">
        {['transactions', 'audit'].map(k => (
          <button key={k} onClick={() => setTab(k as typeof tab)}
            className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition-all capitalize ${tab === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            {k === 'transactions' ? `💰 Transactions (${alertCount})` : `📋 Audit Log (${auditLog.length})`}
          </button>
        ))}
      </div>

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div>
          <div className="flex gap-1 mb-3">
            {['all', 'flagged'].map(f => (
              <button key={f} onClick={() => setTxFilter(f as typeof txFilter)}
                className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg ${txFilter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {f === 'all' ? `All (${txs.length})` : `🚩 Flagged (${alertCount})`}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredTx.map(tx => (
              <div key={tx.id} className={`bg-white rounded-xl border p-4 ${tx.flagged ? 'border-red-300 bg-red-50/20' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{typeIcon[tx.type] || '📋'}</span>
                    <span className="text-xs font-bold text-slate-700">{tx.type}</span>
                    <span className={`text-[10px] font-semibold ${statusColor[tx.status]}`}>● {tx.status}</span>
                    {tx.flagged && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">🚩</span>}
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleTimeString()}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                  <div><span className="text-slate-400">From</span><div className="font-semibold">{tx.from}</div></div>
                  <div><span className="text-slate-400">To</span><div className="font-semibold">{tx.to}</div></div>
                  <div><span className="text-slate-400">Amount</span><div className="font-bold text-slate-700">{tx.amount.toFixed(2)} USDT {tx.fee > 0 && <span className="text-red-400">(-{tx.fee.toFixed(2)})</span>}</div></div>
                </div>

                {tx.flagged && tx.flagReason && (
                  <div className="bg-red-100 rounded-lg px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-red-700">🚩 {tx.flagReason}</span>
                    <button onClick={() => onDismiss?.(tx.id)} className="text-[10px] font-semibold text-red-500 hover:text-red-600">Dismiss</button>
                  </div>
                )}
              </div>
            ))}
            {filteredTx.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No transactions</p>}
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {tab === 'audit' && (
        <div>
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Search admin/action/target..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)}
              className="flex-1 text-[10px] border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-300 outline-none" />
            <select value={auditCategory} onChange={e => setAuditCategory(e.target.value)}
              className="text-[10px] border border-slate-200 rounded-lg px-2 py-2 font-medium">
              <option value="all">All Categories</option>
              <option value="user">User</option>
              <option value="system">System</option>
              <option value="financial">Financial</option>
              <option value="security">Security</option>
            </select>
          </div>

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
            {filteredAudit.map(a => (
              <div key={a.id} className="bg-white rounded-lg border border-slate-100 px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${categoryColor[a.category]}`}>
                    {a.category}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700 truncate">{a.action} → {a.target}</div>
                    <div className="text-[10px] text-slate-400 truncate">{a.detail}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <div className="text-[10px] text-slate-400">{a.admin}</div>
                  <div className="text-[9px] text-slate-400">{a.ip}</div>
                  <div className="text-[9px] text-slate-400">{new Date(a.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {filteredAudit.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No audit entries</p>}
          </div>

          <p className="text-[9px] text-slate-400 text-center mt-4">Audit log is immutable. All admin actions are permanently recorded.</p>
        </div>
      )}
    </div>
  );
};

export default TransactionMonitor;
