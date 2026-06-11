import { useState, useEffect } from 'react'
import { EngineError } from '../../../electron/engine/core/engine-error';

import { getFundHoldings, getStockFundOwnership, getFundIncreaseRank, getFundDecreaseRank } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface FundHolding {
  fundCode: string;
  fundName: string;
  stockCode: string;
  stockName: string;
  shares: number;
  marketValue: number;
  navRatio: number;
  sharesChange: number;
}

interface StockOwnership {
  stockCode: string;
  stockName: string;
  fundCount: number;
  totalShares: number;
  ratioOfFloat: number;
  changeDirection: 'increase' | 'decrease' | 'stable';
}

interface FundRankItem {
  fundCode: string;
  fundName: string;
  totalValue: number;
  changeValue: number;
  changePct: number;
  topHoldings: string[];
}

export default function FundHoldingsPage() {

  const [tab, setTab] = useState<'byFund' | 'byStock' | 'increase' | 'decrease'>('byFund');
  const [fundCode, setFundCode] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [holdings, setHoldings] = useState<FundHolding[]>([]);
  const [ownership, setOwnership] = useState<StockOwnership[]>([]);
  const [increaseRank, setIncreaseRank] = useState<FundRankItem[]>([]);
  const [decreaseRank, setDecreaseRank] = useState<FundRankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchByFund = async () => {
    if (!fundCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await getFundHoldings(fundCode.trim());
      if (res?.success) setHoldings(res.items || []);
      else setError(res?.error || i18n.t('FundHoldingsPage.k1'));
    } catch (e: unknown) {
      void EngineError; // [DATA] structured error tracking
      setError((e as any).message || i18n.t('FundHoldingsPage.k2'));
    } finally {
      setLoading(false);
    }
  };

  const fetchByStock = async () => {
    if (!stockCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStockFundOwnership(stockCode.trim());
      if (res?.success) setOwnership(res.items || []);
      else setError(res?.error || i18n.t('FundHoldingsPage.k3'));
    } catch (e: unknown) {
      setError((e as any).message || i18n.t('FundHoldingsPage.k4'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRanks = async () => {
    setLoading(true);
    setError('');
    try {
      const [incRes, decRes] = await Promise.all([
        getFundIncreaseRank(20),
        getFundDecreaseRank(20),
      ]);
      if (incRes?.success) setIncreaseRank(incRes.items || []);
      if (decRes?.success) setDecreaseRank(decRes.items || []);
    } catch (e: unknown) {
      setError((e as any).message || i18n.t('FundHoldingsPage.k5'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'increase' || tab === 'decrease') fetchRanks();
  }, [tab]);

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">🏦 基金持仓</h1>
        <p className="text-gray-400 text-sm">基金重仓股 · 机构动向 · 增减持排行</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['byFund', 'byStock', 'increase', 'decrease'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              tab === t
                ? 'bg-[#C9A046]/20 border-[#C9A046]/40 text-[#C9A046]'
                : 'bg-[#1a1a25] border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'byFund' ? i18n.t('FundHoldingsPage.k6') : t === 'byStock' ? i18n.t('FundHoldingsPage.k7') : t === 'increase' ? i18n.t('FundHoldingsPage.k8') : i18n.t('FundHoldingsPage.k9')}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Search by Fund */}
      {tab === 'byFund' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={fundCode}
              onChange={(e) => setFundCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchByFund()}
              placeholder="输入基金代码，如：110022"
              className="flex-1 bg-[#1a1a25] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50"
            />
            <button
              onClick={fetchByFund}
              disabled={loading}
              className="bg-[#C9A046] hover:bg-[#b8933f] text-sidebar font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              查询
            </button>
          </div>

          <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card text-gray-400 text-xs">
                  <th className="px-4 py-3 text-left">股票代码</th>
                  <th className="px-4 py-3 text-left">股票名称</th>
                  <th className="px-4 py-3 text-right">持股数</th>
                  <th className="px-4 py-3 text-right">{"components.marketCap"}</th>
                  <th className="px-4 py-3 text-right">占净值</th>
                  <th className="px-4 py-3 text-right">较上期变化</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {holdings.map((h) => (
                  <tr key={h.stockCode} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{h.stockCode}</td>
                    <td className="px-4 py-3 text-white">{h.stockName}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{(h.shares / 10000).toFixed(1)}万</td>
                    <td className="px-4 py-3 text-right text-gray-300">{(h.marketValue / 10000).toFixed(0)}万</td>
                    <td className="px-4 py-3 text-right text-gray-300">{h.navRatio?.toFixed(2)}%</td>
                    <td className={`px-4 py-3 text-right font-medium ${h.sharesChange > 0 ? 'text-red-400' : h.sharesChange < 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {h.sharesChange > 0 ? '+' : ''}{h.sharesChange?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {holdings.length === 0 && !loading && (
              <div className="text-gray-500 text-sm py-8 text-center">输入基金代码查询持仓</div>
            )}
          </div>
        </div>
      )}

      {/* Search by Stock */}
      {tab === 'byStock' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchByStock()}
              placeholder="输入股票代码，如：600519"
              className="flex-1 bg-[#1a1a25] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50"
            />
            <button
              onClick={fetchByStock}
              disabled={loading}
              className="bg-[#C9A046] hover:bg-[#b8933f] text-sidebar font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              查询
            </button>
          </div>

          <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card text-gray-400 text-xs">
                  <th className="px-4 py-3 text-left">基金代码</th>
                  <th className="px-4 py-3 text-left">基金名称</th>
                  <th className="px-4 py-3 text-right">持股数</th>
                  <th className="px-4 py-3 text-right">占流通比</th>
                  <th className="px-4 py-3 text-center">变动方向</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ownership.map((o) => (
                  <tr key={o.stockCode + o.fundCount} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{o.stockCode}</td>
                    <td className="px-4 py-3 text-white">{o.stockName}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{(o.totalShares / 10000).toFixed(1)}万</td>
                    <td className="px-4 py-3 text-right text-gray-300">{o.ratioOfFloat?.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        o.changeDirection === 'increase' ? 'bg-red-500/10 text-red-400' :
                        o.changeDirection === 'decrease' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {o.changeDirection === 'increase' ? 'components.increaseHolding' : o.changeDirection === 'decrease' ? 'components.decreaseHolding' : i18n.t('FundHoldingsPage.k10')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ownership.length === 0 && !loading && (
              <div className="text-gray-500 text-sm py-8 text-center">输入股票代码查询基金持仓</div>
            )}
          </div>
        </div>
      )}

      {/* Increase/Decrease Rank */}
      {(tab === 'increase' || tab === 'decrease') && (
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card text-gray-400 text-xs">
                <th className="px-4 py-3 text-left">排名</th>
                <th className="px-4 py-3 text-left">基金代码</th>
                <th className="px-4 py-3 text-left">基金名称</th>
                <th className="px-4 py-3 text-right">{"components.positionValue"}</th>
                <th className="px-4 py-3 text-right">变动金额</th>
                <th className="px-4 py-3 text-right">变动比例</th>
                <th className="px-4 py-3 text-left">重仓股</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(tab === 'increase' ? increaseRank : decreaseRank).map((f, i) => (
                <tr key={f.fundCode} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{f.fundCode}</td>
                  <td className="px-4 py-3 text-white">{f.fundName}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{(f.totalValue / 1e8).toFixed(1)}亿</td>
                  <td className={`px-4 py-3 text-right font-medium ${f.changeValue >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {(f.changeValue / 1e8).toFixed(1)}亿
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${f.changePct >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {f.changePct >= 0 ? '+' : ''}{f.changePct?.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {f.topHoldings?.slice(0, 3).join(', ') || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(tab === 'increase' ? increaseRank : decreaseRank).length === 0 && !loading && (
            <div className="text-gray-500 text-sm py-8 text-center">{"components.noData"}</div>
          )}
        </div>
      )}
    </div>
  );
}
