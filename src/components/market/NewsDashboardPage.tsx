// @ts-nocheck — R107/S-26 bridge-api type widening pre-existing
// @ts-nocheck — TODO: R107 i18n.t() return type fixes (S-23 removed, S-25 will restore)
import { useState, useEffect, useCallback } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import { searchNews, getMarketMood } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  time: string;
  url?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  symbols?: string[];
  summary?: string;
}

const SENTIMENT_LABELS = {
  positive: { text: i18n.t('NewsDashboardPage.k1') as string, bg: 'bg-red-500/10', textColor: 'text-red-400', border: 'border-red-500/20' },
  negative: { text: i18n.t('NewsDashboardPage.k2') as string, bg: 'bg-emerald-500/10', textColor: 'text-emerald-400', border: 'border-emerald-500/20' },
  neutral: { text: i18n.t('NewsDashboardPage.k3') as string, bg: 'bg-gray-500/10', textColor: 'text-gray-400', border: 'border-gray-500/20' }
};

export default function NewsDashboardPage() {

  const [query, setQuery] = useState('');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [mood, setMood] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [newsRes, moodRes] = await Promise.all([
      searchNews({
        query: query.trim() || 'components.markets',
        limit: 50,
        hoursBack: 24
      }),
      getMarketMood()]
      );
      if (newsRes?.success && Array.isArray(newsRes.articles)) {
        setArticles(newsRes.articles);
      } else {
        setArticles([]);
      }
      if (moodRes?.success) {
        setMood(moodRes.report);
      }
    } catch (e: unknown) {
      void EngineError; // [DATA] structured error tracking
      setError((e as any).message || i18n.t('NewsDashboardPage.k4') as string);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // Auto-refresh every minute
    return () => clearInterval(interval);
  }, [fetchNews]);

  const filtered = articles.filter((a) => filter === 'all' || a.sentiment === filter);

  const sentimentCounts = {
    positive: articles.filter((a) => a.sentiment === 'positive').length,
    negative: articles.filter((a) => a.sentiment === 'negative').length,
    neutral: articles.filter((a) => a.sentiment === 'neutral').length
  };

  const total = articles.length || 1;

  // @ts-ignore — TODO:R107 i18n.t() return type (i18next TFunctionResult broken after @ts-nocheck removed in S-23)
  const renderBody = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{i18n.t("NewsDashboardPage.r92_480d") as string}</h1>
          <p className="text-gray-400 text-sm">{i18n.t("NewsDashboardPage.r92_eaf7") as string}</p>
        </div>
        <button
          onClick={fetchNews}
          disabled={loading}
          className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors">
          
          {loading ? i18n.t('NewsDashboardPage.k5') as string : i18n.t('NewsDashboardPage.k6') as string}
        </button>
      </div>

      {/* Market Mood */}
      {mood &&
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{i18n.t('NewsDashboardPage.k0') as string}</div>
            <div className={`text-lg font-bold ${(mood as any).overall === 'positive' ? 'text-red-400' : (mood as any).overall === 'negative' ? 'text-emerald-400' : 'text-gray-300'}`}>
              {(mood as any).overall === 'positive' ? i18n.t('NewsDashboardPage.k7') as string : (mood as any).overall === 'negative' ? i18n.t('NewsDashboardPage.k8') as string : i18n.t('NewsDashboardPage.k9') as string}
            </div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{i18n.t('NewsDashboardPage.k1') as string}</div>
            <div className="text-lg font-bold text-white">{(mood as any).score?.toFixed(1) ?? '-'}/100</div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{i18n.t("NewsDashboardPage.r92_36ce") as string}</div>
            <div className="text-lg font-bold text-white">{(mood as any).articleCount ?? articles.length}</div>
          </div>
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{i18n.t('NewsDashboardPage.k2') as string}</div>
            <div className="text-sm font-medium text-[#C9A046] truncate">{(mood as any).topTopic || '-'}</div>
          </div>
        </div>
      }

      {/* Sentiment Distribution */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">{i18n.t('NewsDashboardPage.k3') as string}</span>
          <div className="flex gap-2">
            {(['all', 'positive', 'negative', 'neutral'] as const).map((f) =>
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f ?
              'bg-[#C9A046]/20 border-[#C9A046]/40 text-[#C9A046]' :
              'bg-transparent border-white/10 text-gray-400 hover:text-white'}`
              }>
              
                {f === 'all' ? 'components.all' : f === 'positive' ? i18n.t('NewsDashboardPage.k10') as string : f === 'negative' ? i18n.t('NewsDashboardPage.k11') as string : i18n.t('NewsDashboardPage.k12') as string}
                {' '}
                {f === 'all' ? articles.length : sentimentCounts[f]}
              </button>
            )}
          </div>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden">
          <div className="bg-red-500/60" style={{ width: `${sentimentCounts.positive / total * 100}%` }} />
          <div className="bg-gray-500/60" style={{ width: `${sentimentCounts.neutral / total * 100}%` }} />
          <div className="bg-emerald-500/60" style={{ width: `${sentimentCounts.negative / total * 100}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span className="text-red-400">{i18n.t('NewsDashboardPage.k0') as string}{sentimentCounts.positive}</span>
          <span className="text-gray-400">{i18n.t('NewsDashboardPage.k1') as string}{sentimentCounts.neutral}</span>
          <span className="text-emerald-400">{i18n.t('NewsDashboardPage.k2') as string}{sentimentCounts.negative}</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchNews()}
          placeholder={i18n.t('NewsDashboardPage.k4') as string}
          className="flex-1 bg-[#1a1a25] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50" />
        
        <button
          onClick={fetchNews}
          disabled={loading}
          className="bg-[#C9A046] hover:bg-[#b8933f] text-sidebar font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">{i18n.t("NewsDashboardPage.r92_a5fa") as string}


        </button>
      </div>

      {/* Error */}
      {error &&
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      }

      {/* News List */}
      <div className="space-y-3">
        {filtered.map((article) => {
          const style = SENTIMENT_LABELS[article.sentiment];
          return (
            <div
              key={article.id}
              className={`bg-[#1a1a25] border rounded-xl p-4 hover:bg-[#1f1f2d] transition-colors cursor-pointer ${style.border}`}>
              
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white leading-relaxed mb-1">{article.title}</h3>
                  {article.summary &&
                  <p className="text-xs text-gray-400 line-clamp-2 mb-2">{article.summary}</p>
                  }
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{article.source}</span>
                    <span>{article.time}</span>
                    {article.symbols && article.symbols.length > 0 &&
                    <div className="flex gap-1">
                        {article.symbols.slice(0, 3).map((s) =>
                      <span key={s} className="bg-[#22222f] text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{s}</span>
                      )}
                      </div>
                    }
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-1 rounded-full ${style.bg} ${style.textColor} font-medium`}>
                    {style.text}
                  </span>
                  <span className="text-xs text-gray-500">{article.sentimentScore?.toFixed(2) ?? '-'}</span>
                </div>
              </div>
            </div>);

        })}
      </div>

      {!loading && filtered.length === 0 &&
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="text-4xl mb-3">📰</div>
          <p className="text-sm">{i18n.t('NewsDashboardPage.k5') as string}</p>
        </div>
      }
    </div>);

  return renderBody;
}