// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';

/* ====== Types ====== */
type TriggerType = 'position_risk' | 'strategy_health' | 'better_strategy' | 'panic_alert' | 'dormant_user' | 'market_event';

interface ProactivePush {
  id: string; type: TriggerType; icon: string; title: string;
  body: string; actionLabel: string; actionColor: string;
  time: string; isRead: boolean; urgency: 'high' | 'medium' | 'low';
}

/* ====== Mock Data ====== */
const mockPushes: ProactivePush[] = [
  { id: 'p1', type: 'position_risk', icon: '⚠️', title: '持仓集中度过高提醒', body: '鲸灵注意到你的NVDA仓位占38%，超过30%上限。建议减仓或加对冲。历史数据显示，集中度>35%时回撤放大1.8倍。', actionLabel: '查看调整方案', actionColor: 'bg-red-600 hover:bg-red-700', time: '10分钟前', isRead: false, urgency: 'high' },
  { id: 'p2', type: 'strategy_health', icon: '🩺', title: 'MACD策略健康度下降', body: '你的MACD双均线策略近30天胜率从58%降到42%，信号退化明显。可能因为市场进入盘整期。建议暂停或调整参数。', actionLabel: '诊断策略', actionColor: 'bg-amber-600 hover:bg-amber-700', time: '30分钟前', isRead: false, urgency: 'high' },
  { id: 'p3', type: 'better_strategy', icon: '💡', title: '发现更适合你的策略', body: '基于你的持仓(科技+港股)和风险偏好，布林带回归策略比你现在的策略胜率高6%，回撤低20%。要看看对比吗？', actionLabel: '对比策略', actionColor: 'bg-blue-600 hover:bg-blue-700', time: '1小时前', isRead: false, urgency: 'medium' },
  { id: 'p4', type: 'market_event', icon: '📰', title: 'Fed紧急降息50bp', body: '美联储刚刚宣布紧急降息。你的债券持仓将受益，但科技股短期波动加剧。建议检查止损位。', actionLabel: '查看影响分析', actionColor: 'bg-red-600 hover:bg-red-700', time: '2小时前', isRead: true, urgency: 'high' },
  { id: 'p5', type: 'dormant_user', icon: '👋', title: '3天没来了，鲸灵想你了', body: '你3天没登录了。市场已经变了：NVDA涨了8%，BTC破了$120K。要不要看看你的策略是否需要调整？', actionLabel: '快速复盘', actionColor: 'bg-indigo-600 hover:bg-indigo-700', time: '1天前', isRead: true, urgency: 'low' }
];

/* ====== Sub-Components ====== */

const TriggerBadge = ({ type }: { type: TriggerType }) => {
  const map: Record<TriggerType, { label: string; color: string }> = {
    position_risk: { label: '持仓风险', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    strategy_health: { label: '策略健康', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    better_strategy: { label: '更好策略', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    panic_alert: { label: '恐慌警报', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
    dormant_user: { label: '唤醒提醒', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' },
    market_event: { label: '市场事件', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' }
  };
  const m = map[type];
  return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${m.color}`}>{m.label}</span>;
};

const PushCard = ({ push, onAction, onRead }: { push: ProactivePush; onAction: (p: ProactivePush) => void; onRead: (id: string) => void }) => {
  const urgencyBorder = { high: 'border-l-red-500', medium: 'border-l-amber-400', low: 'border-l-gray-300' };
  return (
    <div className={`rounded-lg border ${push.isRead ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800' : `border-l-4 ${urgencyBorder[push.urgency]} bg-blue-50/50 dark:bg-blue-900/5 border-gray-200 dark:border-gray-700`} p-3 mb-2 hover:shadow-md transition-all cursor-pointer`} onClick={() => onRead(push.id)}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{push.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TriggerBadge type={push.type} />
            {!push.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
          </div>
          <h4 className={`text-sm font-bold mb-1 ${push.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {push.title}
          </h4>
          <p className={`text-xs leading-relaxed mb-2 ${push.isRead ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {push.body}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{push.time}</span>
            <button onClick={(e) => { e.stopPropagation(); onAction(push); }} className={`px-3 py-1 rounded-lg text-xs font-bold text-white transition-colors ${push.actionColor}`}>
              {push.actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ====== Main Component ====== */

export default function ProactiveAIPush() {
  const [pushes, setPushes] = useState<ProactivePush[]>(mockPushes);
  const [filter, setFilter] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Simulate new push arriving
  useEffect(() => {
    const timer = setTimeout(() => {
      const newPush: ProactivePush = {
        id: `p${Date.now()}`, type: 'panic_alert', icon: '🚨', title: 'BTC 5分钟暴跌-8%', body: 'BTC从$122K急速跌至$112K。15分钟内爆仓$3.2B。鲸灵检测到恐慌信号，建议暂停所有买入操作，等稳定后再评估。', actionLabel: '紧急查看', actionColor: 'bg-red-600 hover:bg-red-700', time: '刚刚', isRead: false, urgency: 'high'
      };
      setPushes(prev => [newPush, ...prev]);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  const filtered = pushes.filter(p => {
    if (filter !== 'ALL' && p.type !== filter) return false;
    if (unreadOnly && p.isRead) return false;
    return true;
  });

  const unreadCount = pushes.filter(p => !p.isRead).length;

  const handleAction = useCallback((push: ProactivePush) => {
    console.log('AI push action:', push.type, push.title);
  }, []);

  const handleRead = useCallback((id: string) => {
    setPushes(prev => prev.map(p => p.id === id ? { ...p, isRead: true } : p));
  }, []);

  const markAllRead = () => setPushes(prev => prev.map(p => ({ ...p, isRead: true })));

  const triggers: (TriggerType | 'ALL')[] = ['ALL', 'position_risk', 'strategy_health', 'better_strategy', 'market_event', 'dormant_user'];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">🐋 鲸灵推送</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                {unreadCount} 未读
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} className="w-3.5 h-3.5 rounded" /> 只看未读
            </label>
            <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-800">全部已读</button>
          </div>
        </div>
      </div>

      {/* Trigger Type Filter */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {triggers.map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${filter === t ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {t === 'ALL' ? '全部' : t === 'position_risk' ? '⚠️ 持仓风险' : t === 'strategy_health' ? '🩺 策略健康' : t === 'better_strategy' ? '💡 更好策略' : t === 'market_event' ? '📰 市场事件' : '👋 唤醒'}
          </button>
        ))}
      </div>

      {/* Push List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🤫</p>
            <p className="text-sm font-medium">没有推送了</p>
            <p className="text-xs mt-1">一切正常，鲸灵帮你盯着呢</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-2">{filtered.length} 条推送 · {unreadCount} 条未读</p>
            {filtered.map(p => <PushCard key={p.id} push={p} onAction={handleAction} onRead={handleRead} />)}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>🐋 鲸灵AI 24小时主动监控你的持仓</span>
          <span className="text-blue-600 font-medium">5种触发 · 免费</span>
        </div>
      </div>
    </div>
  );
}
