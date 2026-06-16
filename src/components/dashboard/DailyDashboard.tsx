// @ts-nocheck
import React, { useState, useEffect } from 'react';

/* ====== Types ====== */
interface DashboardAlert {
  id: string; level: 'critical' | 'warning' | 'info' | 'success';
  title: string; detail: string; time: string; actionable: boolean;
}

interface MarketIndex { ticker: string; name: string; value: number; change: number; changePct: number; }
interface WatchlistItem { symbol: string; name: string; price: number; changePct: number; alert: string | null; }
interface AIBrief { text: string; confidence: number; actions: string[]; }

/* ====== Mock Data ====== */
const mockIndices: MarketIndex[] = [
  { ticker: 'SPX', name: '标普500', value: 6285, change: 50.3, changePct: 0.8 },
  { ticker: 'HSI', name: '恒生指数', value: 24350, change: 292, changePct: 1.2 },
  { ticker: 'BTC', name: 'BTC/USD', value: 122500, change: 4250, changePct: 3.5 },
  { ticker: 'GLD', name: '黄金', value: 3500, change: 35, changePct: 1.0 }
];

const mockAlerts: DashboardAlert[] = [
  { id: 'a1', level: 'critical', title: 'NVDA 财报超预期', detail: 'Q2营收$42B vs 预期$38B，盘后涨8%', time: '3h前', actionable: true },
  { id: 'a2', level: 'warning', title: 'Fed会议纪要偏鸽', detail: '多数委员支持9月降息，关注本周官员讲话', time: '5h前', actionable: false },
  { id: 'a3', level: 'info', title: '南向资金连续5日净流入', detail: '本周净买入超500亿港元，腾讯美团受追捧', time: '8h前', actionable: true }
];

const mockWatchlist: WatchlistItem[] = [
  { symbol: 'NVDA', name: 'NVIDIA', price: 148.5, changePct: 8.2, alert: '财报超预期+盘后涨8%' },
  { symbol: '00700', name: '腾讯控股', price: 475.0, changePct: 2.1, alert: '南向资金连续净买入' },
  { symbol: 'BTC', name: 'Bitcoin', price: 122500, changePct: 3.5, alert: 'ETF净流入$2.8B' },
  { symbol: 'GLD', name: '黄金ETF', price: 350, changePct: 1.0, alert: null }
];

const mockAIBrief: AIBrief = {
  text: '今日市场整体偏多。Fed鸽派信号+AI财报季推动科技股上涨，BTC突破$120K创年内新高。港股受南向资金持续流入提振。建议：维持科技仓位，适度加仓黄金对冲政策不确定性。',
  confidence: 82,
  actions: ['加仓 NVDA', '增持黄金 ETF', '关注 Fed 官员讲话']
};

/* ====== Sub Components ====== */

const IndexTicker = ({ idx }: { idx: MarketIndex }) => {
  const colorClass = idx.changePct >= 0 ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
  const arrow = idx.changePct >= 0 ? '▲' : '▼';
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${colorClass} min-w-[160px]`}>
      <div>
        <p className="text-xs font-semibold">{idx.name}</p>
        <p className="text-lg font-bold">{idx.value.toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold">{arrow} {Math.abs(idx.changePct).toFixed(1)}%</p>
        <p className="text-xs opacity-70">{idx.change > 0 ? '+' : ''}{idx.change.toLocaleString()}</p>
      </div>
    </div>
  );
};

const AlertCard = ({ alert }: { alert: DashboardAlert }) => {
  const levelColor: Record<string, string> = {
    critical: 'border-red-500 bg-red-50 dark:bg-red-900/10',
    warning: 'border-amber-400 bg-amber-50 dark:bg-amber-900/10',
    info: 'border-blue-400 bg-blue-50 dark:bg-blue-900/10',
    success: 'border-green-400 bg-green-50 dark:bg-green-900/10'
  };
  const levelIcon: Record<string, string> = {
    critical: '🔴', warning: '🟡', info: '🔵', success: '🟢'
  };
  return (
    <div className={`rounded-lg border-l-4 p-3 ${levelColor[alert.level]} mb-2 transition-all hover:shadow-md cursor-pointer`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span>{levelIcon[alert.level]}</span>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{alert.title}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{alert.detail}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{alert.time}</span>
      </div>
      {alert.actionable && (
        <div className="mt-2 flex gap-2 justify-end">
          <button className="px-2 py-0.5 rounded text-xs bg-blue-600 text-white hover:bg-blue-700">查看策略</button>
          <button className="px-2 py-0.5 rounded text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50">稍后</button>
        </div>
      )}
    </div>
  );
};

/* ====== Main Component ====== */

export default function DailyDashboard() {
  const [pulse, setPulse] = useState(0);

  // Simulate live pulse
  const updatePulse = () => { setPulse(prev => (prev + 1) % 3); };
  useEffect(() => {
    const timer = setInterval(updatePulse, 3000);
    return () => clearInterval(timer);
  }, []);

  const pulseDots = ['●', '●', '●'].map((d, i) => 
    <span key={i} className={`text-xs ${i <= pulse ? 'text-green-400' : 'text-gray-300'} transition-colors`}>{d}</span>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>QUANT MOO v2.7</span>
          <span className="text-gray-300">|</span>
          <span>📡 5/5数据源在线</span>
          <span className="flex items-center gap-0.5 ml-1">{pulseDots}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">💰 USDT 钱包: 1,250.00 U</span>
          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">今日已用 0 U</span>
        </div>
      </div>

      {/* AI Briefing Bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
        <div className="flex items-start gap-2">
          <span className="text-xl flex-shrink-0 mt-1">🤖</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">AI 今日建议</span>
              <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">置信度 {mockAIBrief.confidence}%</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed mb-2">{mockAIBrief.text}</p>
            <div className="flex gap-2">
              {mockAIBrief.actions.map((a, i) => (
                <button key={i} className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium hover:bg-white/30 transition-colors">{a}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Market Indices Ticker */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mockIndices.map(idx => <IndexTicker key={idx.ticker} idx={idx} />)}
        </div>
      </div>

      {/* Main Grid: Alerts + Watchlist */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Alerts Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">🔔 实时警报</h3>
            <button className="text-xs text-blue-600 hover:text-blue-800">查看全部 →</button>
          </div>
          {mockAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>

        {/* Watchlist Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">⭐ 我的自选</h3>
            <button className="text-xs text-blue-600 hover:text-blue-800">管理 →</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {mockWatchlist.map(item => (
              <div key={item.symbol} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.symbol}</p>
                    <p className="text-xs text-gray-400">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">${item.price.toLocaleString()}</p>
                    <p className={`text-xs font-bold ${item.changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.changePct >= 0 ? '+' : ''}{item.changePct}%
                    </p>
                  </div>
                </div>
                {item.alert && (
                  <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <span>⚡</span> {item.alert}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">⚡ 快捷操作</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: '📊', label: '市场总览', color: 'bg-gradient-to-br from-blue-500 to-blue-600' },
              { icon: '🔍', label: '选股器', color: 'bg-gradient-to-br from-purple-500 to-purple-600' },
              { icon: '📋', label: '策略模板', color: 'bg-gradient-to-br from-amber-500 to-amber-600' },
              { icon: '🤖', label: '问 AI', color: 'bg-gradient-to-br from-green-500 to-green-600' },
              { icon: '🔬', label: '回测', color: 'bg-gradient-to-br from-rose-500 to-rose-600' },
              { icon: '💬', label: '讨论区', color: 'bg-gradient-to-br from-indigo-500 to-indigo-600' }
            ].map(a => (
              <button key={a.label} className={`${a.color} rounded-lg p-3 text-white hover:opacity-90 transition-opacity text-center`}>
                <p className="text-2xl mb-1">{a.icon}</p>
                <p className="text-xs font-medium">{a.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Market Calendar Quick */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">📅 本周关注</h3>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {[
              { date: '今', event: 'NVDA 财报后电话会', impact: '高' },
              { date: '明', event: 'Fed 官员讲话 (Waller)', impact: '中' },
              { date: '周五', event: '中国 6月PMI 公布', impact: '高' }
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-10 text-center text-sm font-bold bg-gray-100 dark:bg-gray-700 rounded px-1 py-0.5">{e.date}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{e.event}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${e.impact === '高' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>{e.impact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span>3s 驾驶舱</span>
          <span className="text-gray-300">|</span>
          <span>数据实时更新</span>
        </div>
        <button className="text-blue-600 hover:text-blue-800">换一批</button>
      </div>
    </div>
  );
}
