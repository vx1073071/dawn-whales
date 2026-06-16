// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
type HubTab = 'market' | 'factor' | 'strategy' | 'ai';

/* ====== Inline Icons ====== */
const IconHub = ({ tab }: { tab: string }) => {
  const map = { market: '📊', factor: '🧬', strategy: '📋', ai: '🤖' };
  return <span className="text-lg">{map[tab] || '📌'}</span>;
};

/* ====== Mock Data ====== */
interface QuickAction { id: string; label: string; desc: string; icon: string; tab: HubTab; isPaid: boolean; badge?: string; }
interface RecentItem { id: string; title: string; subtitle: string; time: string; type: 'news' | 'strategy' | 'factor' | 'ai'; }

const quickActions: QuickAction[] = [
  { id: 'qa1', label: '看新闻', desc: '持仓相关+市场热点', icon: '📰', tab: 'market', isPaid: false, badge: '5新' },
  { id: 'qa2', label: '扫风险', desc: '持仓风险一键扫描', icon: '🔍', tab: 'market', isPaid: true },
  { id: 'qa3', label: '找因子', desc: '智能推荐Top5因子', icon: '🧬', tab: 'factor', isPaid: false },
  { id: 'qa4', label: '选策略', desc: '22模板一键使用', icon: '📋', tab: 'strategy', isPaid: false, badge: '3热' },
  { id: 'qa5', label: '问AI', desc: 'AI助手免费3次/天', icon: '🤖', tab: 'ai', isPaid: false },
  { id: 'qa6', label: '对比策略', desc: '3个策略同台PK', icon: '⚔️', tab: 'strategy', isPaid: false },
  { id: 'qa7', label: '生成策略', desc: 'AI自然语言→策略', icon: '✨', tab: 'ai', isPaid: true },
  { id: 'qa8', label: '新闻回测', desc: '事件→N天后股价', icon: '🔬', tab: 'market', isPaid: true }
];

const recentItems: RecentItem[] = [
  { id: 'r1', title: 'Fed signal rate cut in September', subtitle: 'FOMC minutes show growing consensus', time: '2h ago', type: 'news' },
  { id: 'r2', title: 'NVDA earnings beat — Q2 $42B', subtitle: 'Record revenue, guidance raised', time: '3h ago', type: 'news' },
  { id: 'r3', title: 'MACD双均线策略', subtitle: '胜率58% · +22%年化', time: '昨天', type: 'strategy' },
  { id: 'r4', title: '布林带回归策略', subtitle: '胜率62% · +15%年化', time: '昨天', type: 'strategy' },
  { id: 'r5', title: '北向资金因子', subtitle: 'IC +0.12 · 跟大资金走', time: '3天前', type: 'factor' },
  { id: 'r6', title: 'AI建议: 加仓黄金', subtitle: '地缘风险+央行购金持续', time: '5h ago', type: 'ai' }
];

/* ====== Sub-components ====== */

const WelcomeCard = () => (
  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white mb-4">
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-xl font-bold">📊 QUANT MOO</h2>
      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">v2.7.0</span>
    </div>
    <p className="text-sm text-white/80 mb-3">你的AI量化交易伙伴 — 市场、因子、策略、AI 一站式搞定</p>
    <div className="flex gap-2">
      <button className="px-3 py-1.5 rounded-lg bg-white text-blue-700 text-xs font-bold hover:bg-blue-50 transition-colors">🚀 新手指引</button>
      <button className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition-colors">📺 看视频教程</button>
    </div>
  </div>
);

const QuickActionGrid = ({ onAction }: { onAction: (a: QuickAction) => void }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
    {quickActions.map(a => (
      <button key={a.id} onClick={() => onAction(a)} className="flex flex-col items-start p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all text-left">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xl">{a.icon}</span>
          {a.badge && <span className="text-xs px-1 py-0.5 rounded bg-red-100 text-red-600 font-bold">{a.badge}</span>}
          {a.isPaid && <span className="text-xs px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">💰</span>}
        </div>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.label}</span>
        <span className="text-xs text-gray-400 mt-0.5">{a.desc}</span>
      </button>
    ))}
  </div>
);

const RecentSection = () => (
  <div className="mb-4">
    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
      <span>📌</span> 最近
    </h3>
    <div className="space-y-1">
      {recentItems.map(item => (
        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
          <span className="text-lg flex-shrink-0">{item.type === 'news' ? '📰' : item.type === 'strategy' ? '📋' : item.type === 'factor' ? '🧬' : '🤖'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">{item.title}</p>
            <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{item.time}</span>
        </div>
      ))}
    </div>
  </div>
);

/* ====== Market Hub ====== */
const MarketHub = () => (
  <div className="space-y-4">
    {/* Market Overview */}
    <div className="grid grid-cols-3 gap-2">
      {[
        { name: '标普500', val: '6,285', change: '+0.8%', color: 'text-green-600' },
        { name: '恒生指数', val: '24,350', change: '+1.2%', color: 'text-green-600' },
        { name: 'BTC/USD', val: '122,500', change: '+3.5%', color: 'text-green-600' }
      ].map(idx => (
        <div key={idx.name} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">{idx.name}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{idx.val}</p>
          <p className={`text-xs font-bold ${idx.color}`}>{idx.change}</p>
        </div>
      ))}
    </div>

    {/* Quick News */}
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">📰 今日头条</h3>
      {[
        { title: 'Fed signals rate cut in September', source: 'Reuters', time: '1h ago', sentiment: 65 },
        { title: 'NVDA Q2 revenue $42B beats estimates', source: 'Bloomberg', time: '2h ago', sentiment: 82 },
        { title: 'BTC breaks $120K on ETF inflow surge', source: 'CoinDesk', time: '3h ago', sentiment: 75 }
      ].map((n, i) => (
        <div key={i} className="flex items-center gap-2 py-2 border-t border-gray-100 dark:border-gray-700 first:border-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${n.sentiment > 60 ? 'bg-green-400' : n.sentiment > 30 ? 'bg-yellow-400' : 'bg-red-400'}`}/>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{n.title}</p>
            <p className="text-xs text-gray-400">{n.source} · {n.time}</p>
          </div>
          <span className={`text-xs font-bold ${n.sentiment > 60 ? 'text-green-600' : n.sentiment > 30 ? 'text-yellow-600' : 'text-red-600'}`}>+{n.sentiment}</span>
        </div>
      ))}
    </div>

    {/* Source Health Quick */}
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">📡 数据源健康度</h3>
      <div className="flex items-center gap-3">
        {['Reuters', 'Bloomberg', 'CoinDesk', '信报', '金十'].map(src => (
          <div key={src} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400"/>
            <span className="text-xs text-gray-500">{src}</span>
          </div>
        ))}
        <span className="text-xs text-green-600 font-semibold ml-auto">5/5 在线</span>
      </div>
    </div>
  </div>
);

/* ====== Factor Hub ====== */
const FactorHub = () => (
  <div className="space-y-4">
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">🔝 今日最强因子</h3>
      {[
        { label: '你跟大资金一起走', ic: 0.12, market: 'CN' },
        { label: '新钱进来了没', ic: 0.11, market: 'CRYPTO' },
        { label: '你买最近涨最多的', ic: 0.10, market: 'US' }
      ].map((f, i) => (
        <div key={i} className="flex items-center gap-2 py-2 border-t border-gray-100 dark:border-gray-700 first:border-0">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{f.label}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{f.market}</span>
          <span className="text-xs font-bold text-green-600">IC +{f.ic.toFixed(2)}</span>
        </div>
      ))}
    </div>

    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">🧬 因子分类快览</h3>
      <div className="flex flex-wrap gap-1.5">
        {['动量', '波动', '资金流', '估值', '技术', '情绪', '宏观', '中国', '加密', '另类'].map(cat => (
          <span key={cat} className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors">{cat}</span>
        ))}
      </div>
    </div>
  </div>
);

/* ====== Strategy Hub ====== */
const StrategyHub = () => (
  <div className="space-y-4">
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">🔥 热门策略</h3>
      {[
        { line: '你在布林带下轨捡便宜', ret: 15, wr: 62, price: '免费' },
        { line: '你买分红最多最稳的股票', ret: 10, wr: 70, price: '免费' },
        { line: '你持有股票同时卖Call收钱', ret: 8, wr: 75, price: '1U' }
      ].map((s, i) => (
        <div key={i} className="flex items-center gap-2 py-2 border-t border-gray-100 dark:border-gray-700 first:border-0">
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 font-medium">{s.line}</span>
          <span className="text-xs text-green-600 font-bold">+{s.ret}%</span>
          <span className="text-xs text-gray-500">胜率 {s.wr}%</span>
          <span className={`text-xs font-semibold ${s.price === '免费' ? 'text-green-600' : 'text-amber-600'}`}>{s.price}</span>
        </div>
      ))}
      <button className="w-full mt-2 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 hover:bg-gray-200 transition-colors">查看全部 22 个模板 →</button>
    </div>

    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">📋 按场景选</h3>
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: '🚀 追涨', desc: '趋势策略' },
          { label: '🎯 抄底', desc: '反转策略' },
          { label: '🏔️ 长线', desc: '价值投资' },
          { label: '⚡ 短线', desc: '日内/隔夜' },
          { label: '🛡️ 防御', desc: '低波动' },
          { label: '💰 套利', desc: '期权策略' }
        ].map(s => (
          <div key={s.label} className="px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 cursor-pointer hover:border-blue-300 transition-colors text-xs text-center flex-1 min-w-[60px]">
            <p className="font-medium text-gray-700 dark:text-gray-300">{s.label}</p>
            <p className="text-gray-400">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ====== AI Hub ====== */
const AIHub = () => (
  <div className="space-y-4">
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🤖</span>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI 助手</h3>
          <p className="text-xs text-gray-500">免费3次/天 · 付费无限</p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2">
        <p className="text-xs text-gray-500 mb-2">AI 每日建议</p>
        <p className="text-sm text-gray-800 dark:text-gray-200">"今天Fed信号偏鸽，你的持仓中NVDA利好最直接。建议关注黄金避险配置，同时减仓高Beta科技股。"</p>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">💬 对话AI</button>
        <button className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-50">📋 历史</button>
      </div>
    </div>

    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">⚡ AI 快捷功能</h3>
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: '📰', label: '每日早报', desc: '1U/天' },
          { icon: '🔍', label: '持仓扫描', desc: '1U/次' },
          { icon: '📋', label: '生成策略', desc: '1.5U/次' },
          { icon: '🔬', label: '新闻回测', desc: '1.5U/次' }
        ].map(f => (
          <div key={f.label} className="p-2 rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-300 transition-colors text-center">
            <p className="text-lg mb-0.5">{f.icon}</p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{f.label}</p>
            <p className="text-xs text-gray-400">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">💡 使用技巧</h3>
      <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
        <p>1. "帮我分析这只股票" → AI综合因子+新闻+回测回答</p>
        <p>2. "给我生成一个低风险策略" → AI推荐3个候选</p>
        <p>3. "扫描我的持仓" → 5项风险+3个机会</p>
      </div>
    </div>
  </div>
);

/* ====== Main Component ====== */

export default function UnifiedHub() {
  const [activeTab, setActiveTab] = useState<HubTab>('market');

  const tabs: { key: HubTab; label: string; count?: number }[] = [
    { key: 'market', label: '市场' },
    { key: 'factor', label: '因子' },
    { key: 'strategy', label: '策略' },
    { key: 'ai', label: 'AI' }
  ];

  const handleAction = (action: QuickAction) => {
    // Navigate to the appropriate tab
    setActiveTab(action.tab);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <WelcomeCard />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">快捷入口</h3>
        <QuickActionGrid onAction={handleAction} />
      </div>

      {/* Tab Bar */}
      <div className="flex px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <IconHub tab={t.key} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'market' && <MarketHub />}
        {activeTab === 'factor' && <FactorHub />}
        {activeTab === 'strategy' && <StrategyHub />}
        {activeTab === 'ai' && <AIHub />}
      </div>

      {/* Recent Section — only in market tab */}
      {activeTab === 'market' && (
        <div className="px-4 pb-4">
          <RecentSection />
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span>📡</span>
          <span>5/5 数据源在线</span>
          <span className="text-gray-300 mx-1">|</span>
          <span>🔒 USDT 钱包已连接</span>
        </div>
        <span>v2.7.0</span>
      </div>
    </div>
  );
}
