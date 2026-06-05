import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { getPaperTraderStatus } from '@/lib/bridge-api';

interface PaperPosition {
  code: string;
  name: string;
  qty: number;
  avgCost: number;
  curPrice: number;
  marketVal: number;
  pnl: number;
  pnlPct: number;
}

interface PaperTrade {
  id: string;
  time: string;
  code: string;
  name: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  total: number;
}

interface PaperAccount {
  initialCapital: number;
  cash: number;
  marketValue: number;
  totalEquity: number;
  todayPnl: number;
  todayPnlPct: number;
  totalTrades: number;
  winRate: number;
}

const MOCK_ACCOUNT: PaperAccount = {
  initialCapital: 100000,
  cash: 42350.25,
  marketValue: 61250.00,
  totalEquity: 103600.25,
  todayPnl: 850.50,
  todayPnlPct: 0.83,
  totalTrades: 45,
  winRate: 62.2,
};

const MOCK_POSITIONS: PaperPosition[] = [
  { code: 'AAPL', name: '苹果', qty: 50, avgCost: 185.00, curPrice: 189.50, marketVal: 9475.00, pnl: 225.00, pnlPct: 2.43 },
  { code: 'NVDA', name: '英伟达', qty: 20, avgCost: 850.00, curPrice: 875.28, marketVal: 17505.60, pnl: 505.60, pnlPct: 2.97 },
  { code: 'MSFT', name: '微软', qty: 30, avgCost: 405.00, curPrice: 412.20, marketVal: 12366.00, pnl: 216.00, pnlPct: 1.78 },
  { code: 'TSLA', name: '特斯拉', qty: 40, avgCost: 180.00, curPrice: 172.63, marketVal: 6905.20, pnl: -294.80, pnlPct: -4.09 },
  { code: 'META', name: 'Meta', qty: 25, avgCost: 465.00, curPrice: 474.35, marketVal: 11858.75, pnl: 233.75, pnlPct: 2.01 },
  { code: 'AVGO', name: '博通', qty: 10, avgCost: 1250.00, curPrice: 1280.45, marketVal: 12804.50, pnl: 304.50, pnlPct: 2.44 },
];

const MOCK_TRADES: PaperTrade[] = [
  { id: 'PT001', time: '09:32:15', code: 'AAPL', name: '苹果', side: 'BUY', qty: 50, price: 185.00, total: 9250.00 },
  { id: 'PT002', time: '09:35:22', code: 'NVDA', name: '英伟达', side: 'BUY', qty: 20, price: 850.00, total: 17000.00 },
  { id: 'PT003', time: '10:15:33', code: 'MSFT', name: '微软', side: 'BUY', qty: 30, price: 405.00, total: 12150.00 },
  { id: 'PT004', time: '11:20:45', code: 'TSLA', name: '特斯拉', side: 'BUY', qty: 40, price: 180.00, total: 7200.00 },
  { id: 'PT005', time: '13:05:12', code: 'META', name: 'Meta', side: 'BUY', qty: 25, price: 465.00, total: 11625.00 },
  { id: 'PT006', time: '14:10:30', code: 'AVGO', name: '博通', side: 'BUY', qty: 10, price: 1250.00, total: 12500.00 },
];

export default function PaperTraderPanel() {
  const [account] = useState<PaperAccount>(MOCK_ACCOUNT);
  const [positions] = useState<PaperPosition[]>(MOCK_POSITIONS);
  const [trades] = useState<PaperTrade[]>(MOCK_TRADES);
  const [loading, setLoading] = useState(false);
  const [isPaper, setIsPaper] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await getPaperTraderStatus();
      if (res?.success) {
        // account/positions/trades would be populated from IPC response
        // For now keep mock data until backend returns real data
      }
    } catch (e) { console.error('[Error:PaperTraderPanel]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPct = (totalPnl / (account.totalEquity - totalPnl)) * 100;

  if (loading) return <LoadingSpinner fullscreen text="加载模拟盘数据..." />;

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🎮 模拟盘交易</h1>
          <p className="text-gray-400 text-sm">零风险策略验证环境</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPaper(!isPaper)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPaper ? 'bg-[#C9A046]' : 'bg-gray-700'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isPaper ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          <span className="text-sm text-gray-300">{isPaper ? '模拟盘模式' : '实盘模式'}</span>
        </div>
      </div>

      {/* Account Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">总资产</div>
          <div className="text-xl font-bold font-mono text-white">${account.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">今日盈亏</div>
          <div className={`text-xl font-bold font-mono ${account.todayPnl >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {account.todayPnl >= 0 ? '+' : ''}${account.todayPnl.toFixed(2)}
          </div>
          <div className={`text-xs ${account.todayPnlPct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {account.todayPnlPct >= 0 ? '+' : ''}{account.todayPnlPct.toFixed(2)}%
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">累计盈亏</div>
          <div className={`text-xl font-bold font-mono ${totalPnl >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
          <div className={`text-xs ${totalPnlPct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">胜率</div>
          <div className="text-xl font-bold font-mono text-white">{account.winRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">{account.totalTrades} 笔交易</div>
        </div>
      </div>

      {/* Capital Breakdown */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">资金分布</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex h-4 rounded-full overflow-hidden">
              <div className="bg-[#C9A046]" style={{ width: `${(account.cash / account.totalEquity) * 100}%` }} />
              <div className="bg-[#3b82f6]" style={{ width: `${(account.marketValue / account.totalEquity) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-gray-400">现金: ${account.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({((account.cash / account.totalEquity) * 100).toFixed(1)}%)</span>
              <span className="text-gray-400">持仓: ${account.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({((account.marketValue / account.totalEquity) * 100).toFixed(1)}%)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">初始资金</div>
            <div className="text-sm font-mono text-white">${account.initialCapital.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Positions */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">模拟持仓</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">股票</th>
                <th className="px-4 py-3 text-right">数量</th>
                <th className="px-4 py-3 text-right">成本价</th>
                <th className="px-4 py-3 text-right">当前价</th>
                <th className="px-4 py-3 text-right">市值</th>
                <th className="px-4 py-3 text-right">盈亏</th>
                <th className="px-4 py-3 text-right">盈亏%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {positions.map((p) => (
                <tr key={p.code} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{p.code}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{p.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">${p.avgCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">${p.curPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">${p.marketVal.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${p.pnl >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${p.pnlPct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trades */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">模拟交易记录</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">时间</th>
                <th className="px-4 py-3 text-left">股票</th>
                <th className="px-4 py-3 text-center">方向</th>
                <th className="px-4 py-3 text-right">数量</th>
                <th className="px-4 py-3 text-right">价格</th>
                <th className="px-4 py-3 text-right">金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trades.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-400">{t.time}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{t.name}</div>
                    <div className="text-[10px] text-gray-500">{t.code}</div>
                  </td>
                  <td className={`px-4 py-3 text-center ${t.side === 'BUY' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {t.side === 'BUY' ? '买入' : '卖出'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{t.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">${t.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">${t.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
