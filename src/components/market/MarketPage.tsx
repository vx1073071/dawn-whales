import React from 'react';
import { useMarketStore } from '@/stores/marketStore';

export default function MarketPage() {
  const watchlist = useMarketStore((s) => s.watchlist);
  const quotes = useMarketStore((s) => s.quotes);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">行情中心</h1>
        <p className="text-gray-400 text-sm">实时监控自选股行情</p>
      </div>

      {/* Market table */}
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">代码</th>
              <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium uppercase tracking-wide">名称</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">最新价</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">涨跌额</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">涨跌幅</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">成交量</th>
              <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium uppercase tracking-wide">振幅</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">标签</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((code) => {
              const q = quotes[code];
              const chg = q?.change ?? 0;
              const pct = q?.changePct ?? 0;
              const cls = chg > 0 ? 'text-up' : chg < 0 ? 'text-down' : 'text-gray-500';
              const sym = code.replace('US.', '');
              const isLev = ['TQQQ','SOXL','SQQQ','SOXS'].includes(sym);
              const isInv = ['SQQQ','SOXS'].includes(sym);

              return (
                <tr key={code} className="border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-semibold text-white text-sm">{sym}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{q?.name || '--'}</td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{q ? q.price.toFixed(2) : '--'}</td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{chg > 0 ? '+' : ''}{chg.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${cls}`}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{q ? fmtVol(q.volume) : '--'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{q?.amplitude?.toFixed(2) || '--'}%</td>
                  <td className="px-4 py-3">
                    {isLev && <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded mr-1">3x</span>}
                    {isInv && <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">反向</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Chart placeholder */}
      <div className="mt-6 bg-surface-2 border border-border rounded-xl p-6 min-h-[300px] flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-3xl mb-2 opacity-40">📈</div>
          <p className="text-sm">K线图区域</p>
          <p className="text-xs mt-1">选择一只股票查看 K 线走势</p>
        </div>
      </div>
    </div>
  );
}

function fmtVol(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}
