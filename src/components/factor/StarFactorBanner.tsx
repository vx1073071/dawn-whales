// @ts-nocheck
import React, { useState } from 'react';

/* ====== Types ====== */
interface StarFactor {
  id: string; rank: number; label: string; icon: string;
  oneLiner: string; category: string; market: string;
  icScore: number; bestScenario: string; why: string;
  gradient: string;
}

/* ====== 12 Star Factors ====== */
const starFactors: StarFactor[] = [
  { id: 'sf1', rank: 1, label: '北向资金', icon: '🇨🇳', oneLiner: '你跟北上聪明钱一起走，他们连续买你就跟着买', category: '资金流', market: 'CN', icScore: 0.12, bestScenario: 'A股中期趋势', why: '机构大资金流向有5-15天惯性，散户跟着基本不会错', gradient: 'from-red-400 to-red-600' },
  { id: 'sf2', rank: 2, label: '机构资金流', icon: '🏦', oneLiner: '大户在买什么你买什么，别跟散户反向做', category: '资金流', market: 'US', icScore: 0.11, bestScenario: '美股机构加仓', why: '13F数据出来后机构资金流可信度最高，track record 最好', gradient: 'from-blue-400 to-blue-600' },
  { id: 'sf3', rank: 3, label: '行业动量', icon: '📊', oneLiner: '每季度买过去3个月最强的3个行业，轮着换', category: '动量', market: 'US', icScore: 0.10, bestScenario: '季度行业轮换', why: '机构最爱用的策略，有学术论文支撑，回测稳健', gradient: 'from-indigo-400 to-indigo-600' },
  { id: 'sf4', rank: 4, label: '交易所资金流', icon: '🪙', oneLiner: 'BTC从交易所大量流出=囤币=看涨，流入=准备卖', category: '加密货币', market: 'CRYPTO', icScore: 0.09, bestScenario: '加密货币中期', why: '链上数据无法造假，是最诚实的加密货币指标', gradient: 'from-yellow-400 to-yellow-600' },
  { id: 'sf5', rank: 5, label: '新闻情绪', icon: '📰', oneLiner: '正面新闻多的股票短期有延续性，负面新闻要躲3-5天', category: '情绪', market: 'ALL', icScore: 0.09, bestScenario: '事件驱动交易', why: 'NLP分析标题比看正文快10倍，机器比人快就是优势', gradient: 'from-purple-400 to-purple-600' },
  { id: 'sf6', rank: 6, label: '夏普比率', icon: '🎯', oneLiner: '每承担1%风险能赚多少，夏普>1算优秀', category: '风险', market: 'ALL', icScore: 0.09, bestScenario: '组合优化', why: '风险和收益一起看，比光看收益靠谱10倍', gradient: 'from-teal-400 to-teal-600' },
  { id: 'sf7', rank: 7, label: 'App下载量', icon: '📱', oneLiner: 'App下载增速>50%的互联网公司处于爆发期', category: '另类数据', market: 'US/CN', icScore: 0.08, bestScenario: '互联网/SAAS', why: '比财报早3个月知道，机构要等季报，你有时间优势', gradient: 'from-emerald-400 to-emerald-600' },
  { id: 'sf8', rank: 8, label: '12月动量', icon: '🚀', oneLiner: '过去一年涨最多的股票，趋势大概率继续', category: '动量', market: 'ALL', icScore: 0.08, bestScenario: '牛市追涨', why: '简单但有效，学术圈几十年验证都没推翻过', gradient: 'from-orange-400 to-orange-600' },
  { id: 'sf9', rank: 9, label: '认沽认购比', icon: '📈', oneLiner: 'Put/Call太高说明太恐慌了，反而是买入机会', category: '情绪', market: 'US', icScore: 0.08, bestScenario: '恐慌反弹', why: '市场过度恐惧时逆向操作，屡试不爽', gradient: 'from-rose-400 to-rose-600' },
  { id: 'sf10', rank: 10, label: '大单净流入', icon: '💰', oneLiner: '单笔>50万的大单净买入是专业资金信号', category: '资金流', market: 'CN', icScore: 0.10, bestScenario: 'A股短线', why: '大单信号+龙虎榜验证是A股最可靠的短线因子', gradient: 'from-cyan-400 to-cyan-600' },
  { id: 'sf11', rank: 11, label: '股息率', icon: '💸', oneLiner: '股息率>4%是现金奶牛，熊市比银行利息好', category: '估值', market: 'HK/US', icScore: 0.05, bestScenario: '熊市防御', why: '收息是你睡得着觉的策略，适合不着急的投资者', gradient: 'from-green-400 to-green-600' },
  { id: 'sf12', rank: 12, label: '稳定币铸币', icon: '🏗️', oneLiner: 'USDT大量增发=新资金入场=牛市前兆', category: '加密货币', market: 'CRYPTO', icScore: 0.11, bestScenario: '加密牛市定位', why: '稳定币是最诚实的资金流入指标，不骗人', gradient: 'from-pink-400 to-pink-600' }
];

/* ====== Main Component ====== */

export default function StarFactorBanner() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeMarket, setActiveMarket] = useState('ALL');

  const filtered = activeMarket === 'ALL' ? starFactors : starFactors.filter(f => f.market === activeMarket || f.market === 'ALL');
  const markets = ['ALL', 'US', 'CN', 'HK', 'CRYPTO'];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">⭐ 12明星因子</h2>
            <p className="text-xs text-white/80 mt-0.5">机构共识最强 · 散户最容易用 · 已经帮你精选好了</p>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-bold">TOP 12</span>
        </div>
      </div>

      {/* Market Filter */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {markets.map(m => (
          <button key={m} onClick={() => setActiveMarket(m)} className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeMarket === m ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {m === 'ALL' ? '🌍 全部' : m === 'US' ? '🇺🇸 美股' : m === 'CN' ? '🇨🇳 A股' : m === 'HK' ? '🇭🇰 港股' : '🪙 加密'}
          </button>
        ))}
      </div>

      {/* Factor Cards */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">⭐</p>
            <p className="text-sm">暂无该市场的明星因子</p>
          </div>
        ) : (
          filtered.map(factor => {
            const isExpanded = expandedId === factor.id;
            return (
              <div key={factor.id} className={`rounded-xl border ${isExpanded ? 'border-amber-400 ring-1 ring-amber-200' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 overflow-hidden transition-all hover:shadow-md`}>
                <div className="p-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : factor.id)}>
                  {/* Top Row */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${factor.gradient} flex items-center justify-center text-lg shadow-lg text-white flex-shrink-0`}>
                      {factor.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">#{factor.rank}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{factor.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">{factor.category}</span>
                        <span className="text-xs text-gray-400">{factor.market}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">+{factor.icScore.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">IC</p>
                    </div>
                  </div>

                  {/* One-liner */}
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">{factor.oneLiner}</p>

                  {/* Best Scenario */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">🏆 最适合：</span>
                    <span className="font-semibold text-gray-600 dark:text-gray-400">{factor.bestScenario}</span>
                  </div>
                </div>

                {/* Expanded: Why */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800">
                      <span className="text-sm mt-0.5">💡</span>
                      <div>
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-0.5">为什么选它</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">{factor.why}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold">加入策略</button>
                      <button className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 hover:bg-gray-50">详情</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>💡 12个因子全部免费使用</span>
          <button className="text-blue-600 hover:text-blue-800 font-medium">查看全部320+因子 →</button>
        </div>
      </div>
    </div>
  );
}
