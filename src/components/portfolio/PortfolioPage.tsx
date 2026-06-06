import { useState, useEffect } from 'react';
import * as api from '@/lib/bridge-api';

interface FundsInfo {
  totalAssets: number;
  cash: number;
  power: number;
  marketVal: number;
  todayPnl: number;
  currency: string;
}

export default function PortfolioPage() {
  const [accountId, setAccountId] = useState<string>('');
  const [funds, setFunds] = useState<FundsInfo | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    if (accountId) loadData();
    if (autoRefresh && accountId) {
      const timer = setInterval(loadData, 30000);
      return () => clearInterval(timer);
    }
  }, [accountId, autoRefresh]);

  async function loadAccount() {
    try {
      const accs = await api.getAccounts();
      if (accs.length > 0) setAccountId(accs[0].accId);
    } catch { /* silent */ }
  }

  async function loadData() {
    if (!accountId) return;
    setLoading(true);
    setError('');
    try {
      const [fundsData, pos] = await Promise.all([
        api.getFunds(accountId),
        api.getPositions(accountId),
      ]);
      if (fundsData) setFunds({ ...fundsData, currency: fundsData.currency || 'USD' });
      setPositions(pos || []);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  const pnlClass = (v: number) => v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '--';

  // Calculate portfolio allocation
  const totalVal = positions.reduce((sum, p) => sum + (p.marketVal || 0), 0);
  const allocation = positions.map((p) => ({
    ...p,
    pct: totalVal > 0 ? ((p.marketVal || 0) / totalVal * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">持仓管理</h1>
          <p className="text-gray-400 text-sm">账户总览 · 持仓明细 · 资产配置</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-[#C9A046]"
            />
            自动刷新
          </label>
          <button
            onClick={loadData}
            disabled={loading || !accountId}
            className="px-4 py-2 bg-[#1a1a25] border border-white/5 rounded-lg text-sm text-gray-300 hover:bg-[#22222f] transition-colors disabled:opacity-40"
          >
            ⟳ 刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm">{error}</div>
      )}

      {!accountId && !loading && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-8 text-center mb-4">
          <div className="text-3xl mb-2 opacity-40">🔌</div>
          <p className="text-gray-400 text-sm">未连接券商</p>
          <p className="text-gray-500 text-xs mt-1">请先在系统设置中连接 OpenD</p>
        </div>
      )}

      {/* Account Summary Cards */}
      {funds && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          <SummaryCard label="总资产" value={`$${fmt(funds.totalAssets)}`} highlight />
          <SummaryCard label="今日盈亏" value={`${funds.todayPnl >= 0 ? '+' : ''}$${fmt(funds.todayPnl)}`} className={pnlClass(funds.todayPnl)} />
          <SummaryCard label="持仓市值" value={`$${fmt(funds.marketVal)}`} />
          <SummaryCard label="可用资金" value={`$${fmt(funds.cash)}`} />
          <SummaryCard label="购买力" value={`$${fmt(funds.power)}`} />
        </div>
      )}

      {/* Allocation Bar */}
      {allocation.length > 0 && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4 mb-4">
          <h3 className="text-gray-300 text-xs font-medium mb-3">资产配置</h3>
          <div className="flex h-4 rounded-lg overflow-hidden mb-3">
            {allocation.slice(0, 8).map((p, i) => {
              const colors = ['#C9A046', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#f97316', '#06b6d4', '#ec4899'];
              return (
                <div
                  key={i}
                  style={{ width: `${p.pct}%`, backgroundColor: colors[i % colors.length] }}
                  className="transition-all duration-500"
                  title={`${p.code?.replace('US.', '')}: ${p.pct.toFixed(1)}%`}
                />
              );
            })}
            {funds && funds.cash > 0 && totalVal > 0 && (
              <div
                style={{ width: `${(funds.cash / (totalVal + funds.cash)) * 100}%` }}
                className="bg-gray-700 transition-all duration-500"
                title={`现金: ${((funds.cash / (totalVal + funds.cash)) * 100).toFixed(1)}%`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-[11px]">
            {allocation.slice(0, 8).map((p, i) => {
              const colors = ['text-[#C9A046]', 'text-emerald-400', 'text-blue-400', 'text-purple-400', 'text-red-400', 'text-orange-400', 'text-cyan-400', 'text-pink-400'];
              return (
                <div key={i} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-sm`} style={{ backgroundColor: ['#C9A046', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#f97316', '#06b6d4', '#ec4899'][i % 8] }} />
                  <span className={colors[i % colors.length]}>{p.code?.replace('US.', '')}</span>
                  <span className="text-gray-500">{p.pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-white font-medium text-sm">持仓明细 ({positions.length})</h2>
        </div>
        {positions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-3xl mb-2 opacity-40">💼</div>
            <p className="text-sm">{loading ? '加载中...' : '暂无持仓'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">代码</th>
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-right">持仓</th>
                <th className="px-4 py-3 text-right">均价</th>
                <th className="px-4 py-3 text-right">现价</th>
                <th className="px-4 py-3 text-right">盈亏</th>
                <th className="px-4 py-3 text-right">盈亏%</th>
                <th className="px-4 py-3 text-right">市值</th>
                <th className="px-4 py-3 text-right">占比</th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((p, i) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-semibold text-white text-sm">{p.code?.replace('US.', '')}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-200">{p.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">{fmt(p.avgCost)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-200">{fmt(p.curPrice)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${pnlClass(p.pnl)}`}>
                    {p.pnl >= 0 ? '+' : ''}{fmt(p.pnl)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${pnlClass(p.pnlPct)}`}>
                    {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct?.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-gray-200">{fmt(p.marketVal)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1.5 bg-[#12121a] rounded-full overflow-hidden">
                        <div className="h-full bg-[#C9A046] rounded-full" style={{ width: `${Math.min(p.pct, 100)}%` }} />
                      </div>
                      <span className="text-gray-500 text-xs w-10 text-right">{p.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, className = '', highlight = false }: { label: string; value: string; className?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-[#C9A046]/10 border border-[#C9A046]/20' : 'bg-[#1a1a25] border border-white/5'}`}>
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${className}`}>{value}</div>
    </div>
  );
}
