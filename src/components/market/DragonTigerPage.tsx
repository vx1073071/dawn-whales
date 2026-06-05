import { useState, useEffect } from 'react';
import { getDragonTigerList, getDragonTigerDetail, getInstitutionalTrades } from '../../lib/bridge-api';

interface DragonTigerEntry {
  code: string;
  name: string;
  changePct: number;
  netBuyAmount: number;
  reason: string;
  date: string;
}

interface TraderSeat {
  rank: number;
  name: string;
  buyAmount: number;
  sellAmount: number;
  netAmount: number;
}

interface DragonTigerDetail {
  code: string;
  name: string;
  date: string;
  buySeats: TraderSeat[];
  sellSeats: TraderSeat[];
}

export default function DragonTigerPage() {
  const [entries, setEntries] = useState<DragonTigerEntry[]>([]);
  const [detail, setDetail] = useState<DragonTigerDetail | null>(null);
  const [institutional, setInstitutional] = useState<DragonTigerEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [, setSelectedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'daily' | 'institutional' | 'detail'>('daily');

  const fetchDaily = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getDragonTigerList(selectedDate || undefined);
      if (res?.success) setEntries(res.entries || []);
      else setError(res?.error || '获取失败');
    } catch (e: any) {
      setError(e.message || '获取失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchInstitutional = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getInstitutionalTrades(selectedDate || undefined);
      if (res?.success) setInstitutional(res.entries || []);
    } catch (e: any) {
      setError(e.message || '获取失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await getDragonTigerDetail(code, selectedDate || new Date().toISOString().split('T')[0]);
      if (res?.success) {
        setDetail(res.detail);
        setSelectedCode(code);
        setTab('detail');
      }
    } catch (e: any) {
      setError(e.message || '获取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'daily') fetchDaily();
    else if (tab === 'institutional') fetchInstitutional();
  }, [tab, selectedDate]);

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">🐉 龙虎榜</h1>
          <p className="text-gray-400 text-sm">每日异动股 · 席位分析 · 机构动向</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]/50"
          />
          <button
            onClick={tab === 'daily' ? fetchDaily : fetchInstitutional}
            disabled={loading}
            className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors"
          >
            {loading ? '刷新中...' : '🔄'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['daily', 'institutional', 'detail'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              tab === t
                ? 'bg-[#C9A046]/20 border-[#C9A046]/40 text-[#C9A046]'
                : 'bg-[#1a1a25] border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'daily' ? '每日榜单' : t === 'institutional' ? '机构席位' : '席位详情'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Daily List */}
      {tab === 'daily' && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card text-gray-400 text-xs">
                <th className="px-4 py-3 text-left">代码</th>
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-right">涨跌幅</th>
                <th className="px-4 py-3 text-right">净买额</th>
                <th className="px-4 py-3 text-left">上榜原因</th>
                <th className="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {entries.map((e) => (
                <tr key={e.code} className="hover:bg-white/[0.02] cursor-pointer">
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{e.code}</td>
                  <td className="px-4 py-3 text-white font-medium">{e.name}</td>
                  <td className={`px-4 py-3 text-right font-medium ${e.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {e.changePct >= 0 ? '+' : ''}{e.changePct?.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${e.netBuyAmount >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {(e.netBuyAmount / 1e4).toFixed(0)}万
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{e.reason}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => fetchDetail(e.code)}
                      className="text-xs text-[#C9A046] hover:text-[#d4b55a]"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && !loading && (
            <div className="text-gray-500 text-sm py-8 text-center">暂无数据</div>
          )}
        </div>
      )}

      {/* Institutional */}
      {tab === 'institutional' && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card text-gray-400 text-xs">
                <th className="px-4 py-3 text-left">代码</th>
                <th className="px-4 py-3 text-left">名称</th>
                <th className="px-4 py-3 text-right">涨跌幅</th>
                <th className="px-4 py-3 text-right">机构净买</th>
                <th className="px-4 py-3 text-left">原因</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {institutional.map((e) => (
                <tr key={e.code} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{e.code}</td>
                  <td className="px-4 py-3 text-white font-medium">{e.name}</td>
                  <td className={`px-4 py-3 text-right font-medium ${e.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {e.changePct >= 0 ? '+' : ''}{e.changePct?.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${e.netBuyAmount >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {(e.netBuyAmount / 1e4).toFixed(0)}万
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {institutional.length === 0 && !loading && (
            <div className="text-gray-500 text-sm py-8 text-center">暂无数据</div>
          )}
        </div>
      )}

      {/* Detail */}
      {tab === 'detail' && detail && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setTab('daily')} className="text-xs text-gray-500 hover:text-white">← 返回</button>
            <span className="text-white font-medium">{detail.name} ({detail.code})</span>
            <span className="text-xs text-gray-500">{detail.date}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Buy Seats */}
            <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-medium text-red-400 mb-3">买入前五席位</h3>
              <div className="space-y-2">
                {detail.buySeats.map((s) => (
                  <div key={s.rank} className="flex items-center justify-between p-2 bg-card rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{s.rank}</span>
                      <span className="text-sm text-white truncate max-w-[200px]">{s.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-red-400">{(s.buyAmount / 1e4).toFixed(0)}万</div>
                      <div className="text-[10px] text-gray-500">净 {(s.netAmount / 1e4).toFixed(0)}万</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sell Seats */}
            <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
              <h3 className="text-sm font-medium text-emerald-400 mb-3">卖出前五席位</h3>
              <div className="space-y-2">
                {detail.sellSeats.map((s) => (
                  <div key={s.rank} className="flex items-center justify-between p-2 bg-card rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{s.rank}</span>
                      <span className="text-sm text-white truncate max-w-[200px]">{s.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-emerald-400">{(s.sellAmount / 1e4).toFixed(0)}万</div>
                      <div className="text-[10px] text-gray-500">净 {(s.netAmount / 1e4).toFixed(0)}万</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
