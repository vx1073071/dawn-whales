import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';
import { getTradeHistory } from '@/lib/bridge-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface TradeRecord {
  tradeId: string;
  orderId: string;
  code: string;
  name: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  filledQty: number;
  filledPrice: number;
  commission: number;
  pnl: number;
  pnlPct: number;
  tradeTime: string;
  strategyId?: string;
  strategyName?: string;
  remark?: string;
}

const MOCK_TRADES: TradeRecord[] = [
  { tradeId: 'T001', orderId: 'O001', code: 'AAPL', name: '苹果', side: 'BUY', qty: 100, price: 185.00, filledQty: 100, filledPrice: 184.95, commission: 1.85, pnl: 0, pnlPct: 0, tradeTime: '2024-01-15 09:32:15', strategyId: 'strategy-001', strategyName: '双均线突破', remark: '金叉信号' },
  { tradeId: 'T002', orderId: 'O002', code: 'NVDA', name: '英伟达', side: 'BUY', qty: 50, price: 540.00, filledQty: 50, filledPrice: 540.20, commission: 2.70, pnl: 0, pnlPct: 0, tradeTime: '2024-01-15 09:35:22', strategyId: 'strategy-002', strategyName: '动量轮动', remark: '突破前高' },
  { tradeId: 'T003', orderId: 'O003', code: 'AAPL', name: '苹果', side: 'SELL', qty: 100, price: 192.50, filledQty: 100, filledPrice: 192.45, commission: 1.92, pnl: 750.00, pnlPct: 4.05, tradeTime: '2024-02-20 14:28:10', strategyId: 'strategy-001', strategyName: '双均线突破', remark: '死叉信号' },
  { tradeId: 'T004', orderId: 'O004', code: 'TSLA', name: '特斯拉', side: 'BUY', qty: 80, price: 195.00, filledQty: 80, filledPrice: 195.10, commission: 1.56, pnl: 0, pnlPct: 0, tradeTime: '2024-02-22 10:15:33', strategyId: 'strategy-001', strategyName: '双均线突破', remark: '金叉信号' },
  { tradeId: 'T005', orderId: 'O005', code: 'NVDA', name: '英伟达', side: 'SELL', qty: 50, price: 720.00, filledQty: 50, filledPrice: 719.80, commission: 3.60, pnl: 8980.00, pnlPct: 33.27, tradeTime: '2024-03-10 11:45:18', strategyId: 'strategy-002', strategyName: '动量轮动', remark: '动量衰减' },
  { tradeId: 'T006', orderId: 'O006', code: 'MSFT', name: '微软', side: 'BUY', qty: 60, price: 405.00, filledQty: 60, filledPrice: 405.05, commission: 2.43, pnl: 0, pnlPct: 0, tradeTime: '2024-03-12 09:20:45', strategyId: 'strategy-003', strategyName: '价值投资', remark: 'PE低于均值' },
  { tradeId: 'T007', orderId: 'O007', code: 'TSLA', name: '特斯拉', side: 'SELL', qty: 80, price: 175.00, filledQty: 80, filledPrice: 174.90, commission: 1.40, pnl: -1616.00, pnlPct: -10.35, tradeTime: '2024-03-25 15:30:05', strategyId: 'strategy-001', strategyName: '双均线突破', remark: '止损触发' },
  { tradeId: 'T008', orderId: 'O008', code: 'AVGO', name: '博通', side: 'BUY', qty: 30, price: 1200.00, filledQty: 30, filledPrice: 1200.50, commission: 3.60, pnl: 0, pnlPct: 0, tradeTime: '2024-04-05 10:10:22', strategyId: 'strategy-002', strategyName: '动量轮动', remark: 'AI芯片需求' },
  { tradeId: 'T009', orderId: 'O009', code: 'MSFT', name: '微软', side: 'SELL', qty: 60, price: 420.00, filledQty: 60, filledPrice: 419.95, commission: 2.52, pnl: 894.00, pnlPct: 3.68, tradeTime: '2024-04-18 13:25:40', strategyId: 'strategy-003', strategyName: '价值投资', remark: '目标价到达' },
  { tradeId: 'T010', orderId: 'O010', code: 'AVGO', name: '博通', side: 'SELL', qty: 30, price: 1285.00, filledQty: 30, filledPrice: 1284.80, commission: 3.85, pnl: 2529.00, pnlPct: 7.02, tradeTime: '2024-05-08 09:45:12', strategyId: 'strategy-002', strategyName: '动量轮动', remark: '动量转弱' },
  { tradeId: 'T011', orderId: 'O011', code: 'META', name: 'Meta', side: 'BUY', qty: 45, price: 465.00, filledQty: 45, filledPrice: 465.10, commission: 2.79, pnl: 0, pnlPct: 0, tradeTime: '2024-05-15 10:05:33', strategyId: 'strategy-001', strategyName: '双均线突破', remark: '金叉信号' },
  { tradeId: 'T012', orderId: 'O012', code: 'META', name: 'Meta', side: 'SELL', qty: 45, price: 480.00, filledQty: 45, filledPrice: 479.90, commission: 2.88, pnl: 664.50, pnlPct: 3.18, tradeTime: '2024-06-01 14:15:20', strategyId: 'strategy-001', strategyName: '双均线突破', remark: '死叉信号' },
];

export default function TradeHistoryPage() {
  const { t } = useTranslation();
  const [trades, setTrades] = useState<TradeRecord[]>(MOCK_TRADES);
  const [loading, setLoading] = useState(false);
  const [filterStrategy, setFilterStrategy] = useState('all');
  const [filterSide, setFilterSide] = useState<'all' | 'BUY' | 'SELL'>('all');
  const [searchCode, setSearchCode] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await getTradeHistory();
      if (res?.success && Array.isArray(res.trades)) setTrades(res.trades);
    } catch { /* use mock */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const strategies = useMemo(() => {
    const map = new Map<string, string>();
    trades.forEach(t => { if (t.strategyId && t.strategyName) map.set(t.strategyId, t.strategyName); });
    return Array.from(map.entries());
  }, [trades]);

  const filtered = useMemo(() => {
    return trades.filter(t => {
      if (filterStrategy !== 'all' && t.strategyId !== filterStrategy) return false;
      if (filterSide !== 'all' && t.side !== filterSide) return false;
      if (searchCode && !t.code.toLowerCase().includes(searchCode.toLowerCase()) && !t.name.includes(searchCode)) return false;
      return true;
    });
  }, [trades, filterStrategy, filterSide, searchCode]);

  // Stats
  const stats = useMemo(() => {
    const totalPnl = filtered.reduce((sum, t) => sum + t.pnl, 0);
    const winningTrades = filtered.filter(t => t.pnl > 0);
    const losingTrades = filtered.filter(t => t.pnl < 0);
    const winRate = filtered.length > 0 ? (winningTrades.length / filtered.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length : 0;
    const maxWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
    const maxLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;
    const totalCommission = filtered.reduce((s, t) => s + t.commission, 0);
    return { totalPnl, winRate, avgWin, avgLoss, maxWin, maxLoss, totalCommission, totalTrades: filtered.length };
  }, [filtered]);

  // Monthly PnL chart
  useEffect(() => {
    const chartDom = document.getElementById('trade-pnl-chart');
    if (!chartDom) return;
    const chart = echarts.init(chartDom, undefined, { renderer: 'canvas' });

    const monthlyMap: Record<string, number> = {};
    filtered.forEach(t => {
      const month = t.tradeTime.slice(0, 7);
      monthlyMap[month] = (monthlyMap[month] || 0) + t.pnl;
    });
    const months = Object.keys(monthlyMap).sort();
    const pnlData = months.map(m => +monthlyMap[m].toFixed(2));

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: '#1a1a25', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#e5e7eb' } },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10 } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisLabel: { color: '#6b7280', fontSize: 10, formatter: (v: number) => `$${v}` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
      series: [{
        type: 'bar',
        data: pnlData.map(v => ({ value: v, itemStyle: { color: v >= 0 ? '#ef4444' : '#10b981' } })),
        barWidth: '50%',
      }],
    });

    return () => chart.dispose();
  }, [filtered]);

  if (loading) return <LoadingSpinner fullscreen text={t('trading.loadingTrades')} />;

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">📜 {t('trading.tradeHistory')}</h1>
          <p className="text-gray-400 text-sm">{stats.totalTrades} {t('trading.tradeRecords')}</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">总盈亏</div>
          <div className={`text-xl font-bold font-mono ${stats.totalPnl >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">胜率</div>
          <div className="text-xl font-bold font-mono text-white">{stats.winRate.toFixed(1)}%</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">平均盈利/亏损</div>
          <div className="text-sm font-mono">
            <span className="text-red-400">+${stats.avgWin.toFixed(0)}</span>
            <span className="text-gray-500 mx-1">/</span>
            <span className="text-emerald-400">${stats.avgLoss.toFixed(0)}</span>
          </div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">最大单笔</div>
          <div className="text-sm font-mono">
            <span className="text-red-400">+${stats.maxWin.toFixed(0)}</span>
            <span className="text-gray-500 mx-1">/</span>
            <span className="text-emerald-400">${stats.maxLoss.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Monthly PnL Chart */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">月度盈亏</h2>
        <div id="trade-pnl-chart" className="w-full h-[200px]" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <input
          type="text"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          placeholder="搜索股票代码或名称..."
          className="bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A046] w-48"
        />
        <select
          value={filterStrategy}
          onChange={(e) => setFilterStrategy(e.target.value)}
          className="bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
        >
          <option value="all">全部策略</option>
          {strategies.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select
          value={filterSide}
          onChange={(e) => setFilterSide(e.target.value as any)}
          className="bg-[#0a0a12] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
        >
          <option value="all">全部方向</option>
          <option value="BUY">买入</option>
          <option value="SELL">卖出</option>
        </select>
      </div>

      {/* Trade Table */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">时间</th>
                <th className="px-4 py-3 text-left">股票</th>
                <th className="px-4 py-3 text-left">方向</th>
                <th className="px-4 py-3 text-right">数量</th>
                <th className="px-4 py-3 text-right">成交价</th>
                <th className="px-4 py-3 text-right">手续费</th>
                <th className="px-4 py-3 text-right">盈亏</th>
                <th className="px-4 py-3 text-right">盈亏%</th>
                <th className="px-4 py-3 text-left">策略</th>
                <th className="px-4 py-3 text-left">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((t) => (
                <tr key={t.tradeId} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{t.tradeTime}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{t.name}</div>
                    <div className="text-[10px] text-gray-500">{t.code}</div>
                  </td>
                  <td className={`px-4 py-3 ${t.side === 'BUY' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {t.side === 'BUY' ? '买入' : '卖出'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{t.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">${t.filledPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">${t.commission.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${t.pnl > 0 ? 'text-red-400' : t.pnl < 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {t.pnl > 0 ? '+' : ''}${t.pnl.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${t.pnlPct > 0 ? 'text-red-400' : t.pnlPct < 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {t.pnlPct > 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">{t.strategyName || '--'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{t.remark || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-gray-500 text-sm text-center py-8">无匹配记录</div>
        )}
      </div>
    </div>
  );
}
