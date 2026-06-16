// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';

/* ====== Types ====== */
interface BreakingAlert {
  id: string; title: string; body: string; source: string;
  timestamp: string; urgency: 'extreme' | 'high' | 'medium';
  market: string; tags: string[]; actionable: boolean;
  actionLabel?: string;
}

/* ====== Mock Data ====== */
const mockAlerts: BreakingAlert[] = [
  { id: 'b1', title: '🚨 FOMC紧急降息50bp', body: '美联储宣布紧急降息50个基点至4.25%，应对经济数据恶化。全球市场剧烈波动，标普500期货跌2.3%，黄金涨1.8%，BTC涨3.5%。', source: 'Reuters', timestamp: '刚刚', urgency: 'extreme', market: 'US', tags: ['Fed', '利率', '紧急'], actionable: true, actionLabel: '查看策略' },
  { id: 'b2', title: 'NVDA盘后暴跌12%', body: 'NVIDIA Q3指引不及预期，股价盘后跌超12%。CEO表示Blackwell芯片量产延迟至2027年。AI板块承压。', source: 'Bloomberg', timestamp: '5分钟前', urgency: 'high', market: 'US', tags: ['NVDA', 'AI', '财报'], actionable: true, actionLabel: '调整持仓' },
  { id: 'b3', title: 'BTC突破$130K创历史新高', body: '比特币突破$130K，ETF单日净流入$5.2B。SOL/ETH领涨山寨币，加密总市值突破$4万亿。', source: 'CoinDesk', timestamp: '15分钟前', urgency: 'high', market: 'CRYPTO', tags: ['BTC', 'ATH', '牛市'], actionable: true, actionLabel: '加仓' },
  { id: 'b4', title: '港元触及弱方兑换保证', body: '港元兑美元跌至7.85弱方兑换保证水平，金管局入市干预，买入23亿港元。资金外流压力加大。', source: '信报', timestamp: '30分钟前', urgency: 'medium', market: 'HK', tags: ['港元', '资金外流', '金管局'], actionable: false }
];

/* ====== Inline Icons ====== */
const UrgencyIcon = ({ level }: { level: string }) => {
  const map: Record<string, { icon: string; color: string; border: string; bg: string }> = {
    extreme: { icon: '🔴', color: 'text-red-600', border: 'border-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    high: { icon: '🟠', color: 'text-orange-600', border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    medium: { icon: '🟡', color: 'text-yellow-600', border: 'border-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' }
  };
  const m = map[level] || map.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold ${m.color} ${m.bg}`}>
      {m.icon} {level.toUpperCase()}
    </span>
  );
};

/* ====== Sub Components ====== */

const AlertCard = ({ alert, onAction }: { alert: BreakingAlert; onAction: (a: BreakingAlert) => void }) => {
  const [dismissed, setDismissed] = useState(false);
  const urgencyBg = { extreme: 'border-l-red-500', high: 'border-l-orange-400', medium: 'border-l-yellow-400' }[alert.urgency];

  if (dismissed) return null;

  return (
    <div className={`rounded-lg border-l-4 ${urgencyBg} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg animate-[slideDown_0.3s_ease-out] mb-3 overflow-hidden`}>
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <UrgencyIcon level={alert.urgency} />
            <span className="text-xs text-gray-400">{alert.source} · {alert.timestamp}</span>
          </div>
          <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{alert.title}</h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{alert.body}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{alert.market}</span>
            {alert.tags.slice(0, 3).map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{t}</span>
            ))}
          </div>
          {alert.actionable && (
            <button onClick={() => onAction(alert)} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors">
              {alert.actionLabel || '立即查看'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ====== Main Component ====== */

export default function BreakingNewsPush() {
  const [alerts, setAlerts] = useState<BreakingAlert[]>(mockAlerts);
  const [showSettings, setShowSettings] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [newAlertCount, setNewAlertCount] = useState(4);

  // Simulate a new alert arriving
  useEffect(() => {
    if (!pushEnabled) return;
    const timer = setTimeout(() => {
      const newAlert: BreakingAlert = {
        id: `b${Date.now()}`, title: '⚡ 上证指数急速拉升+3.2%', body: '上证指数在最后30分钟急速拉升，全日涨3.2%。传闻周末有利好政策出台，券商/科技板块领涨。', source: '财联社', timestamp: '刚刚', urgency: 'high', market: 'CN', tags: ['A股', '政策', '急涨'], actionable: true, actionLabel: '追涨策略'
      };
      setAlerts(prev => [newAlert, ...prev]);
      setNewAlertCount(prev => prev + 1);
    }, 8000);
    return () => clearTimeout(timer);
  }, [pushEnabled]);

  const filtered = alerts.filter(a => {
    if (urgencyFilter !== 'ALL' && a.urgency !== urgencyFilter) return false;
    if (marketFilter !== 'ALL' && a.market !== marketFilter) return false;
    return true;
  });

  const handleAction = useCallback((alert: BreakingAlert) => {
    // In production: navigate to relevant strategy/analysis page
    console.log('Action on:', alert.id, alert.title);
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">⚡ 突发新闻推送</h2>
            {pushEnabled && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
                <span className="text-xs text-green-600 font-medium">在线</span>
              </span>
            )}
            {!pushEnabled && <span className="text-xs text-gray-400">已暂停</span>}
          </div>
          <div className="flex items-center gap-2">
            {newAlertCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                {newAlertCount} 新
              </span>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={pushEnabled} onChange={e => setPushEnabled(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              推
            </label>
            <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-gray-600 text-lg" title="设置">⚙️</button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">推送设置</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" /> 美股突发事件</label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" /> 港股突发事件</label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" /> A股突发事件</label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" /> 加密货币突发事件</label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" /> 宏观政策事件</label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" /> 商品市场事件</label>
          </div>
          <p className="text-xs text-gray-400 mt-2">💡 突发新闻推送完全免费，实时监测40+新闻源</p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {(['ALL', 'extreme', 'high', 'medium'] as const).map(level => (
          <button key={level} onClick={() => setUrgencyFilter(level)} className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${urgencyFilter === level ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {level === 'ALL' ? '全部' : level.toUpperCase()}
          </button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {(['ALL', 'US', 'HK', 'CN', 'CRYPTO'] as const).map(m => (
          <button key={m} onClick={() => setMarketFilter(m)} className={`px-2 py-1 rounded text-xs font-medium ${marketFilter === m ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {m === 'ALL' ? '全市场' : m}
          </button>
        ))}
      </div>

      {/* Alert Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🔇</p>
            <p className="text-sm font-medium">暂无突发新闻</p>
            <p className="text-xs mt-1">市场平静中，祝你度过美好的一天</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">{filtered.length} 条突发新闻</span>
              <button onClick={() => { setNewAlertCount(0); }} className="text-xs text-blue-600 hover:text-blue-800">全部已读</button>
            </div>
            {filtered.map(a => <AlertCard key={a.id} alert={a} onAction={handleAction} />)}
          </>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span>📡 40+ 新闻源</span>
            <span className="text-gray-300">|</span>
            <span>⚡ 实时推送</span>
            <span className="text-gray-300">|</span>
            <span className="text-green-600 font-semibold">免费</span>
          </div>
          <span>v2.7</span>
        </div>
      </div>
    </div>
  );
}
