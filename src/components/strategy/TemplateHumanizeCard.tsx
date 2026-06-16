// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
type TemplateCategory = 'trend' | 'mean_reversion' | 'momentum' | 'value' | 'multi_factor' | 'options';
type ScenarioTag = '追涨' | '抄底' | '震荡' | '长线' | '短线' | '防御' | '进攻' | '套利' | '对冲';
type MarketTag = 'US' | 'HK' | 'CN' | 'CRYPTO' | 'ALL';

interface StrategyTemplate {
  id: string; nameEn: string; nameCn: string; category: TemplateCategory;
  oneLinerCn: string; // ≤15字一句话
  scenario: ScenarioTag | ScenarioTag[];
  market: MarketTag[]; holdPeriod: string; winRate: number; // 0-100
  annualReturn: number; // 年化收益 %
  maxDrawdown: number; difficulty: 'easy' | 'medium' | 'hard';
  price: string; // 免费 or 1U etc
  isHot: boolean; isNew: boolean;
}

/* ====== Mock 22 Templates ====== */
const mockTemplates: StrategyTemplate[] = [
  // Trend (4)
  { id: 'macd-dual-ma', nameEn: 'MACD Dual MA', nameCn: 'MACD双均线', category: 'trend', oneLinerCn: '你跟着MACD金叉买，死叉卖', scenario: '追涨', market: ['US', 'HK', 'CN'], holdPeriod: '1-4周', winRate: 58, annualReturn: 22, maxDrawdown: 18, difficulty: 'easy', price: '免费', isHot: true, isNew: false },
  { id: 'n-breakout', nameEn: 'N-Period Breakout', nameCn: '周期突破', category: 'trend', oneLinerCn: '你等突破最高价再追进去', scenario: '追涨', market: ['ALL'], holdPeriod: '2-8周', winRate: 52, annualReturn: 28, maxDrawdown: 25, difficulty: 'medium', price: '免费', isHot: false, isNew: true },
  { id: 'ema-trend-atr', nameEn: 'EMA Trend + ATR', nameCn: '均线趋势+真实波幅', category: 'trend', oneLinerCn: '你顺着均线方向买，用波动率控制仓位', scenario: '追涨', market: ['US', 'HK'], holdPeriod: '3-10天', winRate: 55, annualReturn: 18, maxDrawdown: 15, difficulty: 'medium', price: '1U', isHot: false, isNew: false },
  { id: 'turtle', nameEn: 'Turtle System', nameCn: '海龟交易法', category: 'trend', oneLinerCn: '你学海龟大师，突破20日高点才买', scenario: '追涨', market: ['US', 'CN'], holdPeriod: '2-12周', winRate: 45, annualReturn: 35, maxDrawdown: 30, difficulty: 'hard', price: '1U', isHot: true, isNew: false },
  // Mean Reversion (4)
  { id: 'bollinger-reversion', nameEn: 'Bollinger Reversion', nameCn: '布林带回归', category: 'mean_reversion', oneLinerCn: '你在布林带下轨捡便宜，涨回中间卖出', scenario: '抄底', market: ['ALL'], holdPeriod: '1-5天', winRate: 62, annualReturn: 15, maxDrawdown: 12, difficulty: 'easy', price: '免费', isHot: true, isNew: false },
  { id: 'rsi-reversal', nameEn: 'RSI Reversal', nameCn: 'RSI反转', category: 'mean_reversion', oneLinerCn: '你在超卖区买入，超买区卖出', scenario: '抄底', market: ['ALL'], holdPeriod: '1-3天', winRate: 55, annualReturn: 12, maxDrawdown: 10, difficulty: 'easy', price: '免费', isHot: false, isNew: false },
  { id: 'kdj-swing', nameEn: 'KDJ Swing', nameCn: 'KDJ摆动', category: 'mean_reversion', oneLinerCn: '你等KDJ金叉确认反弹再买', scenario: '抄底', market: ['CN'], holdPeriod: '2-5天', winRate: 50, annualReturn: 20, maxDrawdown: 15, difficulty: 'medium', price: '免费', isHot: false, isNew: false },
  { id: 'cci-divergence', nameEn: 'CCI Divergence', nameCn: 'CCI背离', category: 'mean_reversion', oneLinerCn: '你看CCI底背离抄底，顶背离逃顶', scenario: ['抄底', '追涨'], market: ['US', 'CN'], holdPeriod: '3-10天', winRate: 48, annualReturn: 25, maxDrawdown: 20, difficulty: 'medium', price: '1U', isHot: false, isNew: true },
  // Momentum (4)
  { id: 'momentum-rotation', nameEn: 'Momentum Rotation', nameCn: '动量轮动', category: 'momentum', oneLinerCn: '你买最近涨最多的板块，轮着换', scenario: '追涨', market: ['US'], holdPeriod: '1-3月', winRate: 60, annualReturn: 30, maxDrawdown: 22, difficulty: 'easy', price: '1U', isHot: true, isNew: false },
  { id: 'rsi-momentum', nameEn: 'RSI Momentum', nameCn: 'RSI动量', category: 'momentum', oneLinerCn: '你追已经很强还在加速的股票', scenario: '追涨', market: ['ALL'], holdPeriod: '3-10天', winRate: 53, annualReturn: 18, maxDrawdown: 20, difficulty: 'medium', price: '免费', isHot: false, isNew: false },
  { id: 'vwap-breakout', nameEn: 'VWAP Breakout', nameCn: 'VWAP突破', category: 'momentum', oneLinerCn: '你跟着机构价格线突破买入', scenario: '追涨', market: ['US', 'HK'], holdPeriod: '1-5天', winRate: 56, annualReturn: 15, maxDrawdown: 12, difficulty: 'medium', price: '1U', isHot: false, isNew: true },
  { id: 'gap-momentum', nameEn: 'Gap Momentum', nameCn: '跳空动量', category: 'momentum', oneLinerCn: '你买跳空高开后继续上冲的股票', scenario: '短线', market: ['US'], holdPeriod: '同日', winRate: 50, annualReturn: 22, maxDrawdown: 25, difficulty: 'hard', price: '1U', isHot: false, isNew: false },
  // Value (3)
  { id: 'deep-value', nameEn: 'Deep Value PE+PB', nameCn: '深度价值PE+PB', category: 'value', oneLinerCn: '你买最便宜的价值股长期持有', scenario: '长线', market: ['ALL'], holdPeriod: '6-24月', winRate: 65, annualReturn: 14, maxDrawdown: 20, difficulty: 'easy', price: '免费', isHot: false, isNew: false },
  { id: 'dividend-value', nameEn: 'Dividend Value', nameCn: '分红价值', category: 'value', oneLinerCn: '你买分红最多最稳的股票吃利息', scenario: ['长线', '防御'], market: ['HK', 'US'], holdPeriod: '12-36月', winRate: 70, annualReturn: 10, maxDrawdown: 12, difficulty: 'easy', price: '免费', isHot: true, isNew: false },
  { id: 'peter-lynch', nameEn: 'Peter Lynch PEG', nameCn: '林奇PEG选股', category: 'value', oneLinerCn: '你用林奇的方法找又便宜又增长快的', scenario: ['长线', '进攻'], market: ['US', 'HK'], holdPeriod: '6-18月', winRate: 62, annualReturn: 20, maxDrawdown: 18, difficulty: 'medium', price: '1U', isHot: false, isNew: false },
  // Multi-Factor (3)
  { id: 'qt-5factor', nameEn: 'QT 5-Factor', nameCn: '量化5因子', category: 'multi_factor', oneLinerCn: '你跑5个经典因子综合评分选股', scenario: ['长线', '进攻'], market: ['ALL'], holdPeriod: '3-12月', winRate: 60, annualReturn: 18, maxDrawdown: 16, difficulty: 'medium', price: '1U', isHot: false, isNew: false },
  { id: 'smart-beta', nameEn: 'Smart Beta', nameCn: '聪明贝塔', category: 'multi_factor', oneLinerCn: '你比追踪指数多赚4-6个点', scenario: ['长线', '防御'], market: ['US', 'HK'], holdPeriod: '3-12月', winRate: 68, annualReturn: 12, maxDrawdown: 14, difficulty: 'easy', price: '免费', isHot: false, isNew: true },
  { id: 'ai-combo', nameEn: 'AI Factor Combo', nameCn: 'AI因子组合', category: 'multi_factor', oneLinerCn: '你让AI帮你选出最有效的因子组合', scenario: '进攻', market: ['ALL'], holdPeriod: '1-3月', winRate: 58, annualReturn: 25, maxDrawdown: 20, difficulty: 'hard', price: '1.5U', isHot: true, isNew: true },
  // Options (4)
  { id: 'covered-call', nameEn: 'Covered Call', nameCn: '备兑看涨', category: 'options', oneLinerCn: '你持有股票同时卖Call收权利金', scenario: ['震荡', '防御'], market: ['US'], holdPeriod: '每周', winRate: 75, annualReturn: 8, maxDrawdown: 5, difficulty: 'medium', price: '1U', isHot: true, isNew: false },
  { id: 'cash-secured-put', nameEn: 'Cash Secured Put', nameCn: '现金担保Put', category: 'options', oneLinerCn: '你想低价买股票就先卖Put收钱', scenario: '抄底', market: ['US'], holdPeriod: '每周', winRate: 70, annualReturn: 10, maxDrawdown: 8, difficulty: 'medium', price: '1U', isHot: false, isNew: false },
  { id: 'iron-condor', nameEn: 'Iron Condor', nameCn: '铁鹰套利', category: 'options', oneLinerCn: '你在区间震荡时双卖期权赚双倍', scenario: ['震荡', '套利'], market: ['US'], holdPeriod: '每周', winRate: 80, annualReturn: 6, maxDrawdown: 4, difficulty: 'hard', price: '1.5U', isHot: false, isNew: true },
  { id: 'straddle', nameEn: 'Long Straddle', nameCn: '跨式突破', category: 'options', oneLinerCn: '你赌财报会暴涨或暴跌，都赚', scenario: ['短线', '对冲'], market: ['US'], holdPeriod: '同日', winRate: 40, annualReturn: 35, maxDrawdown: 30, difficulty: 'hard', price: '1.5U', isHot: false, isNew: false }
];

const categoryLabel: Record<TemplateCategory, string> = {
  trend: '趋势跟踪', mean_reversion: '均值回归', momentum: '动量追击', value: '价值投资', multi_factor: '多因子', options: '期权策略'
};

const scenarioIcons: Record<string, string> = {
  '追涨': '🚀', '抄底': '🎯', '震荡': '〰️', '长线': '🏔️', '短线': '⚡', '防御': '🛡️', '进攻': '⚔️', '套利': '💰', '对冲': '🔄'
};

const diffBadge = (d: string) => {
  const map = { easy: '新手友好', medium: '进阶', hard: '老手' };
  const cls = d === 'easy' ? 'bg-green-100 text-green-700' : d === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cls}`}>{map[d]}</span>;
};

const ReturnBadge = ({ val, drawdown }: { val: number; drawdown: number }) => {
  const ratio = drawdown > 0 ? (val / drawdown).toFixed(1) : '∞';
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="font-bold text-green-600 dark:text-green-400">+{val}%</span>
      <span className="text-gray-400">·</span>
      <span className="text-red-500 dark:text-red-400">-{drawdown}% DD</span>
      <span className="text-gray-400">·</span>
      <span className="text-gray-500">{ratio}x 收益/风险</span>
    </div>
  );
};

/* ====== Main Component ====== */

export default function TemplateHumanizeCard() {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [scenarioFilter, setScenarioFilter] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const categories = ['ALL', ...Object.keys(categoryLabel)] as string[];
  const scenarios = ['ALL', '追涨', '抄底', '震荡', '长线', '短线', '防御', '进攻'];
  const markets = ['ALL', 'US', 'HK', 'CN', 'CRYPTO'];
  const difficulties = ['ALL', 'easy', 'medium', 'hard'];

  const filtered = useMemo(() => {
    let list = [...mockTemplates];
    if (categoryFilter !== 'ALL') list = list.filter(t => t.category === categoryFilter);
    if (scenarioFilter !== 'ALL') list = list.filter(t => Array.isArray(t.scenario) ? t.scenario.includes(scenarioFilter as ScenarioTag) : t.scenario === scenarioFilter);
    if (marketFilter !== 'ALL') list = list.filter(t => t.market.includes(marketFilter as MarketTag) || t.market.includes('ALL'));
    if (difficultyFilter !== 'ALL') list = list.filter(t => t.difficulty === difficultyFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.oneLinerCn.toLowerCase().includes(q) || t.nameCn.toLowerCase().includes(q) || t.nameEn.toLowerCase().includes(q));
    }
    // Sort: hot first, then new, then by return
    list.sort((a, b) => {
      if (a.isHot && !b.isHot) return -1;
      if (!a.isHot && b.isHot) return 1;
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      return b.annualReturn - a.annualReturn;
    });
    return list;
  }, [categoryFilter, scenarioFilter, marketFilter, difficultyFilter, search]);

  const hotCount = mockTemplates.filter(t => t.isHot).length;
  const newCount = mockTemplates.filter(t => t.isNew).length;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">📋 策略模板库</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mockTemplates.length} 个模板 · 🔥 {hotCount} 热门 · ✨ {newCount} 新
            </p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">人话版 v2.7</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={'搜策略，用人话说... (如 追涨 抄底 收分红)'} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {categories.map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)} className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${categoryFilter === c ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {c === 'ALL' ? '全部' : categoryLabel[c]}
          </button>
        ))}
      </div>

      {/* Scenario + Market + Difficulty filters */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 overflow-x-auto">
        <span className="flex-shrink-0 font-medium">场景:</span>
        {scenarios.map(s => (
          <button key={s} onClick={() => setScenarioFilter(s)} className={`px-1.5 py-0.5 rounded whitespace-nowrap ${scenarioFilter === s ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {s === 'ALL' ? '不限' : `${scenarioIcons[s] || ''} ${s}`}
          </button>
        ))}
        <span className="flex-shrink-0 ml-2 font-medium">市场:</span>
        {markets.map(m => (
          <button key={m} onClick={() => setMarketFilter(m)} className={`px-1.5 py-0.5 rounded ${marketFilter === m ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {m === 'ALL' ? '全' : m}
          </button>
        ))}
        <span className="flex-shrink-0 ml-2 font-medium">难度:</span>
        {difficulties.map(d => (
          <button key={d} onClick={() => setDifficultyFilter(d)} className={`px-1.5 py-0.5 rounded ${difficultyFilter === d ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {d === 'ALL' ? '不限' : d === 'easy' ? '入门' : d === 'medium' ? '进阶' : '高级'}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm font-medium">没有匹配的策略</p>
            <p className="text-xs mt-1">换个条件试试</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-2">{filtered.length} 个策略</p>
            {filtered.map(t => (
              <div key={t.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {t.isHot && <span className="text-xs bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">🔥 热门</span>}
                    {t.isNew && <span className="text-xs bg-blue-100 text-blue-600 px-1 py-0.5 rounded font-bold">✨ 新</span>}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${t.category === 'trend' ? 'bg-blue-50 text-blue-600' : t.category === 'mean_reversion' ? 'bg-green-50 text-green-600' : t.category === 'momentum' ? 'bg-purple-50 text-purple-600' : t.category === 'value' ? 'bg-amber-50 text-amber-700' : t.category === 'options' ? 'bg-pink-50 text-pink-600' : 'bg-cyan-50 text-cyan-600'}`}>
                      {categoryLabel[t.category]}
                    </span>
                    {diffBadge(t.difficulty)}
                  </div>
                  <span className={`text-xs font-bold ${t.price.includes('免费') ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{t.price}</span>
                </div>

                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{t.oneLinerCn}</h3>
                <p className="text-xs text-gray-500 mb-2">{t.nameEn} — {t.nameCn}</p>

                <ReturnBadge val={t.annualReturn} drawdown={t.maxDrawdown} />

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {t.market.map(m => <span key={m} className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{m}</span>)}
                  <span className="text-xs text-gray-400">· 持有 {t.holdPeriod}</span>
                  <span className="text-xs text-gray-400">· 胜率 <span className="font-semibold text-gray-600">{t.winRate}%</span></span>
                </div>

                <div className="flex items-center gap-1 mt-2">
                  {(Array.isArray(t.scenario) ? t.scenario : [t.scenario]).map(s => (
                    <span key={s} className="text-xs">{scenarioIcons[s] || ''} {s}</span>
                  ))}
                </div>

                <div className="flex justify-end mt-2 gap-2">
                  <button className="px-2 py-1 rounded text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">详情</button>
                  <button className="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700">一键使用</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>💡</span>
          <span>选一个模板 → 改3个参数 → 5分钟上线你的策略</span>
        </div>
        <span>{mockTemplates.length} 模板全部可用</span>
      </div>
    </div>
  );
}
