import React, { useState, useEffect } from 'react';
import * as api from '@/lib/bridge-api';

interface AccountInfo {
  accId: string;
  totalAssets: number;
  cash: number;
  power: number;
  marketVal: number;
  todayPnl: number;
  currency: string;
}

interface PositionInfo {
  code: string;
  name: string;
  qty: number;
  avgCost: number;
  curPrice: number;
  marketVal: number;
  pnl: number;
  pnlPct: number;
}

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [funds, setFunds] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      // Get accounts
      const accs = await api.getAccounts();
      setAccounts(accs);

      if (accs.length > 0) {
        const accId = accs[0].accId;
        // Get funds
        const fundsData = await api.getFunds(accId);
        if (fundsData) {
          setFunds({ ...fundsData, accId });
        }
        // Get positions
        const pos = await api.getPositions(accId);
        setPositions(pos);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const pnlClass = (v: number) => v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-gray-400';
  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '--';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">持仓管理</h1>
          <p className="text-gray-400 text-sm">账户总览 · 持仓明细 · 盈亏分析</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-surface-2 border border-border rounded-lg text-sm text-gray-300 hover:bg-surface-hover transition-colors"
        >
          ⟳ 刷新
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Account Summary Cards */}
      {funds && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          <SummaryCard label="总资产" value={`$${fmt(funds.totalAssets)}`} />
          <SummaryCard label="今日盈亏" value={`${funds.todayPnl >= 0 ? '+' : ''}$${fmt(funds.todayPnl)}`} className={pnlClass(funds.todayPnl)} />
          <SummaryCard label="持仓市值" value={`$${fmt(funds.marketVal)}`} />
          <SummaryCard label="可用资金" value={`$${fmt(funds.cash)}`} />
          <SummaryCard label="购买力" value={`$${fmt(funds.power)}`} />
        </div>
      )}

      {/* Positions Table */}
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-white font-medium text-sm">持仓明细</h2>
        </div>
        {positions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-3xl mb-2 opacity-40">💼</div>
            <p className="text-sm">暂无持仓</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">代码</th>
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-right">持仓</th>
                <th className="px-4 py-3 text-right">均价</th>
                <th className="px-4 py-3 text-right">现价</th>
                <th className="px-4 py-3 text-right">盈亏</th>
                <th className="px-4 py-3 text-right">盈亏%</th>
                <th className="px-4 py-3 text-right">市值</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3 font-semibold text-white text-sm">{p.code}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${className}`}>{value}</div>
    </div>
  );
}
