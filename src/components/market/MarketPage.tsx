import React, { useState, useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import KLineChart from './KLineChart';
import * as api from '@/lib/bridge-api';

export default function MarketPage() {
  const watchlist = useMarketStore((s) => s.watchlist);
  const quotes = useMarketStore((s) => s.quotes);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [klineData, setKlineData] = useState<any[]>([]);

  useEffect(() => {
    if (selectedSymbol) {
      api.getKlines(selectedSymbol, 'daily', 200).then((klines) => {
        if (klines.length > 0) {
          setKlineData(klines.map((k: any) => ({
            time: Math.floor(new Date(k.time || k.date).getTime() / 1000),
            open: k.open,
            high: k.high,
            low: k.low,
            close: k.close,
            volume: k.volume,
          })));
        }
      });
    }
  }, [selectedSymbol]);

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
                <tr
                  key={code}
                  onClick={() => setSelectedSymbol(code)}
                  className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${
                    selectedSymbol === code ? 'bg-surface-3' : ''
                  }`}
                >
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

      {/* K-Line Chart */}
      <div className="mt-6">
        {selectedSymbol && klineData.length > 0 ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-white font-semibold">{selectedSymbol.replace('US.', '')}</h2>
              {(() => {
                const q = quotes[selectedSymbol];
                const cls = q && q.change > 0 ? 'text-up' : q && q.change < 0 ? 'text-down' : 'text-gray-500';
                return q ? (
                  <span className={`font-mono text-sm ${cls}`}>
                    {q.price.toFixed(2)} {q.change > 0 ? '+' : ''}{q.changePct.toFixed(2)}%
                  </span>
                ) : null;
              })()}
            </div>
            <KLineChart data={klineData} height={400} />
          </div>
        ) : selectedSymbol ? (
          <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">⏳</div>
            <p className="text-gray-400 text-sm">加载 {selectedSymbol.replace('US.', '')} K线数据...</p>
          </div>
        ) : (
          <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
            <div className="text-3xl mb-2 opacity-40">📈</div>
            <p className="text-gray-400 text-sm">点击上面的股票查看 K 线图</p>
          </div>
        )}
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
