// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
interface CopyTradeOrder {
  id: string; masterName: string; masterAvatar: string; masterROI: string;
  ticker: string; tickerName: string; action: 'BUY' | 'SELL'; quantity: number;
  price: number; total: string; market: string;
}

interface RelatedNewsItem {
  id: string; title: string; source: string; time: string; sentiment: number;
  impact: 'positive' | 'negative' | 'neutral'; summary: string;
}

interface NewsCluster {
  order: CopyTradeOrder; news: RelatedNewsItem[]; rationale: string; confidence: number;
}

/* ====== Mock Data ====== */
const mockOrders: NewsCluster[] = [
  {
    order: { id: 'ct1', masterName: 'QuantAlpha', masterAvatar: '🐋', masterROI: '+156%', ticker: 'NVDA', tickerName: 'NVIDIA Corp', action: 'BUY', quantity: 50, price: 148.50, total: '$7,425.00', market: 'US' },
    news: [
      { id: 'rn1', title: 'NVDA Q2 revenue $42B beats estimates by 10%', source: 'Bloomberg', time: '3h ago', sentiment: 82, impact: 'positive', summary: 'Record quarterly revenue, forward guidance raised to $45B for Q3.' },
      { id: 'rn2', title: 'AI chip demand forecast to grow 35% in 2026', source: 'Reuters', time: '5h ago', sentiment: 75, impact: 'positive', summary: 'Industry analysts project sustained AI infrastructure spending through 2027.' }
    ],
    rationale: 'Master is buying NVDA after earnings beat and raised guidance. AI demand tailwinds remain strong with 35% YoY growth forecast.', confidence: 88
  },
  {
    order: { id: 'ct2', masterName: '港股猎人', masterAvatar: '🏹', masterROI: '+89%', ticker: '00700', tickerName: '腾讯控股', action: 'BUY', quantity: 500, price: 475.00, total: 'HK$237,500', market: 'HK' },
    news: [
      { id: 'rn3', title: '南向资金连续5日净流入超100亿，腾讯获净买入45亿', source: '信报', time: '4h ago', sentiment: 70, impact: 'positive', summary: '机构资金持续流入港股科技龙头，南向资金本周净买入超500亿港元。' },
      { id: 'rn4', title: 'Tencent Cloud signs $2B AI infrastructure deal in SEA', source: 'Nikkei Asia', time: '7h ago', sentiment: 55, impact: 'positive', summary: 'Tencent Cloud expands Southeast Asia presence with major government AI contracts.' }
    ],
    rationale: 'Master is accumulating 腾讯 on strong southbound flow and new AI cloud deals in Southeast Asia.', confidence: 82
  },
  {
    order: { id: 'ct3', masterName: 'CryptoKing', masterAvatar: '👑', masterROI: '+312%', ticker: 'BTC', tickerName: 'Bitcoin', action: 'BUY', quantity: 0.5, price: 121000, total: '$60,500', market: 'CRYPTO' },
    news: [
      { id: 'rn5', title: 'Bitcoin breaks $120K – ETF inflows hit $2.8B this week', source: 'CoinDesk', time: '1h ago', sentiment: 85, impact: 'positive', summary: 'Spot BTC ETFs see record weekly inflows, options max pain at $115K.' },
      { id: 'rn6', title: 'SEC approves spot Ethereum ETF options trading', source: 'CoinDesk', time: '5h ago', sentiment: 70, impact: 'positive', summary: 'Broader crypto ETF approvals signal regulatory tailwinds for the sector.' }
    ],
    rationale: 'Master buys BTC on ATH breakout + record ETF inflows. Gamma squeeze potential above $120K.', confidence: 75
  }
];

/* ====== Inline Icons ====== */
const IconInfo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
const IconChevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>;
const IconNews = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>;

const SentimentDot = ({ score }: { score: number }) => {
  const color = score > 30 ? 'bg-green-400' : score < -30 ? 'bg-red-400' : 'bg-gray-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color} flex-shrink-0`} />;
};

const ConfidenceBar = ({ pct }: { pct: number }) => {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }}/>
      </div>
      <span className="text-xs font-bold text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
};

/* ====== Main Component ====== */

export default function CopytradeNewsBanner() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const handleConfirm = (id: string) => {
    setConfirmedIds(prev => new Set(prev).add(id));
  };

  const overallPositive = useMemo(() => mockOrders.reduce((sum, c) => sum + c.news.reduce((s, n) => s + n.sentiment, 0), 0) / mockOrders.reduce((sum, c) => sum + c.news.length, 0), []);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📰</span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Copy Trade News Context</h3>
              <p className="text-xs text-gray-500">{mockOrders.length} masters · {overallPositive > 30 ? '🟢 Overall positive sentiment' : overallPositive < -30 ? '🔴 Overall negative sentiment' : '🟡 Mixed sentiment'}</p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">v2.7</span>
        </div>
      </div>

      {/* Orders with News */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {mockOrders.map((cluster) => {
          const isExpanded = expandedId === cluster.order.id;
          const isConfirmed = confirmedIds.has(cluster.order.id);
          const sentimentAvg = cluster.news.reduce((s, n) => s + n.sentiment, 0) / cluster.news.length;

          return (
            <div key={cluster.order.id} className={`rounded-lg border ${isConfirmed ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} overflow-hidden transition-all`}>
              {/* Order Summary Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{cluster.order.masterAvatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{cluster.order.masterName}</span>
                    <span className="text-xs text-green-600 font-semibold">{cluster.order.masterROI}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-bold ${cluster.order.action === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>{cluster.order.action}</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{cluster.order.ticker} · {cluster.order.tickerName}</span>
                    <span className="text-gray-400">{cluster.order.quantity} × ${cluster.order.price.toLocaleString()}</span>
                    <span className="text-gray-500 font-semibold">= {cluster.order.total}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 3-dot news indicator */}
                  <div className="flex items-center gap-1" title={`${cluster.news.length} related news`}>
                    <IconNews />
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{cluster.news.length}</span>
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : cluster.order.id)} className={`p-1 rounded transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <IconChevron />
                  </button>
                </div>
              </div>

              {/* Expanded: News Cards */}
              {isExpanded && (
                <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                  {/* AI Rationale */}
                  <div className="flex items-start gap-2 mb-3 p-2.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <span className="text-sm flex-shrink-0 mt-0.5">🤖</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-amber-800 dark:text-amber-200 font-medium mb-1">AI Rationale</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">{cluster.rationale}</p>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Signal Confidence</span>
                      <span className="text-xs font-bold">{cluster.confidence}%</span>
                    </div>
                    <ConfidenceBar pct={cluster.confidence} />
                  </div>

                  {/* Related News */}
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Related News ({cluster.news.length})</p>
                  <div className="space-y-2">
                    {cluster.news.map(n => (
                      <div key={n.id} className="flex items-start gap-2 p-2 rounded bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                        <div className="mt-0.5"><SentimentDot score={n.sentiment} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">{n.title}</span>
                            <span className={`text-xs font-bold ${n.impact === 'positive' ? 'text-green-600' : n.impact === 'negative' ? 'text-red-600' : 'text-gray-400'}`}>
                              {n.impact}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{n.source}</span>
                            <span className="text-xs text-gray-400">{n.time}</span>
                            <span className={`text-xs font-mono font-bold ${n.sentiment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {n.sentiment > 0 ? '+' : ''}{n.sentiment}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Confirm Button */}
                  {!isConfirmed && (
                    <button onClick={() => handleConfirm(cluster.order.id)} className="w-full mt-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                      <IconCheck /> Confirm Copy — I have reviewed the news context
                    </button>
                  )}
                  {isConfirmed && (
                    <div className="mt-3 py-2 px-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 text-sm font-semibold flex items-center justify-center gap-2">
                      <IconCheck /> Copy confirmed with news context
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <IconInfo />
          <span>Review news context before confirming copy trades. Past performance does not guarantee future results.</span>
        </div>
      </div>
    </div>
  );
}
