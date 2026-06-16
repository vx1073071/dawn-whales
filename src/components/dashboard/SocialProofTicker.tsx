// @ts-nocheck
import React, { useState, useEffect } from 'react';

/* ====== Types ====== */
interface SocialProof {
  id: string; type: 'purchase' | 'strategy_live' | 'review' | 'copy_trade';
  user: string; avatar: string; text: string; time: string;
}

/* ====== Mock Data ====== */
const liveActivity: SocialProof[] = [
  { id: 'sp1', type: 'purchase', user: '深圳程序猿小张', avatar: '👨‍💻', text: '刚购买了MACD金叉策略', time: '刚刚' },
  { id: 'sp2', type: 'strategy_live', user: '港股猎人', avatar: '🏹', text: '将北向策略部署到实盘 · +2.8% 本周', time: '3分钟前' },
  { id: 'sp3', type: 'review', user: 'TraderMike', avatar: '🧔', text: '给了Iron Condor 5星评价', time: '5分钟前' },
  { id: 'sp4', type: 'copy_trade', user: '散户老李', avatar: '👴', text: '跟单了QuantWhale 50股NVDA', time: '8分钟前' },
  { id: 'sp5', type: 'purchase', user: '挪威程序员Lars', avatar: '🧑‍💻', text: '购买了AI智能调仓机器人', time: '12分钟前' }
];

const communityStats = [
  { label: '策略创作者', value: '156', icon: '👥' },
  { label: '正在运行', value: '2,847', icon: '⚡' },
  { label: '本周跟单', value: '1,203', icon: '🔄' },
  { label: '平台交易额', value: 'US$892K', icon: '💰' }
];

/* ====== Main Component ====== */

export default function SocialProofTicker() {
  const [currentActivity, setCurrentActivity] = useState(0);
  const [toastQueue, setToastQueue] = useState<SocialProof[]>([]);
  const [visibleToast, setVisibleToast] = useState<SocialProof | null>(null);

  // Cycle through live activity
  useEffect(() => {
    const timer = setInterval(() => setCurrentActivity(prev => (prev + 1) % liveActivity.length), 3000);
    return () => clearInterval(timer);
  }, []);

  // Simulate toast appearing
  useEffect(() => {
    const timer = setInterval(() => {
      const newToast: SocialProof = {
        id: `t${Date.now()}`, type: 'purchase', user: '新用户', avatar: '🎉', text: '加入了QUANT MOO', time: '刚刚'
      };
      setVisibleToast(newToast);
      setTimeout(() => setVisibleToast(null), 4000);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const activity = liveActivity[currentActivity];
  const typeIcon: Record<string, string> = { purchase: '🛒', strategy_live: '⚡', review: '⭐', copy_trade: '🔄' };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">🌐 社区活跃证明</h2>
        <p className="text-xs text-gray-500">实时展示 — 让新用户看到平台有多活跃</p>
      </div>

      {/* Community Stats Grid */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-4 gap-2">
          {communityStats.map(stat => (
            <div key={stat.label} className="text-center p-2 rounded-lg bg-white/70 dark:bg-white/5">
              <p className="text-lg">{stat.icon}</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">📡 实时动态</h3>

        {/* Live activity items */}
        {liveActivity.map((sp, i) => (
          <div key={sp.id} className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 animate-[fadeIn_0.3s_ease-in]">
            <span className="text-xs">{typeIcon[sp.type]}</span>
            <span className="text-sm">{sp.avatar}</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{sp.user}</span>
              <span className="text-xs text-gray-500"> {sp.text}</span>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{sp.time}</span>
          </div>
        ))}

        {/* Trust Section */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border border-green-200 dark:border-green-800">
          <h4 className="text-sm font-bold text-green-800 dark:text-green-300 mb-2">🛡️ 平台信任证明</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { icon: '✓', text: '所有策略经过回测验证' },
              { icon: '🔒', text: 'USDT钱包冷热分离' },
              { icon: '📊', text: '实盘数据不可篡改' },
              { icon: '🤖', text: 'AI分析透明可追溯' },
              { icon: '🔄', text: '30天无理由退策略' },
              { icon: '👥', text: '156位活跃创作者' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-green-600">{item.icon}</span>
                <span className="text-green-700 dark:text-green-400">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Count */}
        <div className="mt-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-bold text-gray-900 mb-2">📊 策略表现透明度</h4>
          <div className="space-y-2">
            {[
              { label: '北向资金策略', users: '1,243人使用', roi: '+28%', color: 'bg-green-500' },
              { label: '高息股组合', users: '2,103人使用', roi: '+10%', color: 'bg-blue-500' },
              { label: 'MACD金叉策略', users: '1,847人使用', roi: '+22%', color: 'bg-purple-500' }
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-700">{s.label}</span>
                    <span className="text-xs font-bold text-green-600">{s.roi}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${Math.min(100, (parseInt(s.users) / 2103) * 80 + 20)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{s.users}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast Popup */}
      {visibleToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full shadow-xl text-xs flex items-center gap-2 animate-[slideUp_0.3s_ease-out] z-50">
          <span>{visibleToast.avatar}</span>
          <span>{visibleToast.user} {visibleToast.text}</span>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>📡 实时更新 · 数据真实可验证</span>
        <span className="text-blue-600 font-semibold">social-proof v2.7</span>
      </div>
    </div>
  );
}
