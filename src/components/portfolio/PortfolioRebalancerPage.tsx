import { useState, useEffect } from 'react';
import { getFunds } from '@/lib/bridge-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useTranslation } from "react-i18next";

interface RebalanceSuggestion {
  code: string;
  name: string;
  currentWeight: number;
  targetWeight: number;
  currentShares: number;
  targetShares: number;
  action: 'increaseHolding' | 'decreaseHolding' | 'newlyAdded' | 'delete';
  diffShares: number;
  diffAmount: number;
  price: number;
}

interface RebalanceConfig {
  threshold: number;
  maxTurnover: number;
  useKelly: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
}

const MOCK_SUGGESTIONS: RebalanceSuggestion[] = [
  { code: 'AAPL', name: '苹果', currentWeight: 12.5, targetWeight: 15.0, currentShares: 100, targetShares: 120, action: t('components.increaseHolding'), diffShares: 20, diffAmount: 3790, price: 189.50 },
  { code: 'NVDA', name: '英伟达', currentWeight: 18.2, targetWeight: 20.0, currentShares: 50, targetShares: 55, action: t('components.increaseHolding'), diffShares: 5, diffAmount: 4376, price: 875.28 },
  { code: 'MSFT', name: '微软', currentWeight: 15.0, targetWeight: 15.0, currentShares: 60, targetShares: 60, action: t('components.increaseHolding'), diffShares: 0, diffAmount: 0, price: 412.20 },
  { code: 'AVGO', name: '博通', currentWeight: 10.8, targetWeight: 12.0, currentShares: 25, targetShares: 28, action: t('components.increaseHolding'), diffShares: 3, diffAmount: 3841, price: 1280.45 },
  { code: 'TSLA', name: '特斯拉', currentWeight: 8.5, targetWeight: 5.0, currentShares: 80, targetShares: 47, action: t('components.decreaseHolding'), diffShares: -33, diffAmount: -5697, price: 172.63 },
  { code: 'META', name: 'Meta', currentWeight: 5.2, targetWeight: 8.0, currentShares: 20, targetShares: 31, action: t('components.increaseHolding'), diffShares: 11, diffAmount: 5218, price: 474.35 },
  { code: 'AMD', name: 'AMD', currentWeight: 0, targetWeight: 5.0, currentShares: 0, targetShares: 50, action: t('components.newlyAdded'), diffShares: 50, diffAmount: 7413, price: 148.25 },
  { code: 'INTC', name: '英特尔', currentWeight: 4.5, targetWeight: 0, currentShares: 150, targetShares: 0, action: t('components.delete'), diffShares: -150, diffAmount: -4350, price: 29.00 },
];

export default function PortfolioRebalancerPage() {
  const { t } = useTranslation();

  const [suggestions] = useState<RebalanceSuggestion[]>(MOCK_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<RebalanceConfig>({
    threshold: 5,
    maxTurnover: 20,
    useKelly: true,
    frequency: 'monthly',
  });
  const [dryRun, setDryRun] = useState(true);
  const [totalAssets, setTotalAssets] = useState(150000);

  async function load() {
    setLoading(true);
    try {
      // const res = await getRebalanceSuggestions();
      // if (res?.success) setSuggestions(res.suggestions);
      const funds = await getFunds('');
      if (funds) setTotalAssets(funds.totalAssets);
    } catch (e) { console.error('[Error:PortfolioRebalancerPage]', e); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const activeSuggestions = suggestions.filter(s => s.action !== t('components.increaseHolding') || s.diffShares > 0);
  const totalBuy = activeSuggestions.filter(s => s.diffAmount > 0).reduce((s, i) => s + i.diffAmount, 0);
  const totalSell = activeSuggestions.filter(s => s.diffAmount < 0).reduce((s, i) => s + i.diffAmount, 0);
  // const netFlow = totalBuy + totalSell;
  const turnover = (Math.abs(totalBuy) + Math.abs(totalSell)) / totalAssets * 100;

  if (loading) return <LoadingSpinner fullscreen text="加载调仓建议..." />;

  return (
    <div className="p-6 space-y-6 bg-deep min-h-full">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">⚖️ 组合再平衡</h1>
          <p className="text-gray-400 text-sm">定期调仓，维持目标权重</p>
        </div>
        <button
          onClick={load}
          className="text-xs bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-4 py-2 rounded-lg transition-colors"
        >
          刷新建议
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{t("components.totalAssets")}</div>
          <div className="text-xl font-bold font-mono text-white">${totalAssets.toLocaleString()}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">预计买入</div>
          <div className="text-xl font-bold font-mono text-red-400">+${totalBuy.toLocaleString()}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">预计卖出</div>
          <div className="text-xl font-bold font-mono text-emerald-400">${Math.abs(totalSell).toLocaleString()}</div>
        </div>
        <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{t("components.turnoverRate")}</div>
          <div className={`text-xl font-bold font-mono ${turnover > config.maxTurnover ? 'text-red-400' : 'text-white'}`}>
            {turnover.toFixed(1)}%
          </div>
          {turnover > config.maxTurnover && <div className="text-[10px] text-red-400">超出上限 {config.maxTurnover}%</div>}
        </div>
      </div>

      {/* Config Panel */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">再平衡配置</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">调仓阈值 (%)</label>
            <input
              type="number" value={config.threshold} min={1} max={20}
              onChange={(e) => setConfig({ ...config, threshold: parseInt(e.target.value) || 5 })}
              className="w-full bg-deep border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">最大换手率 (%)</label>
            <input
              type="number" value={config.maxTurnover} min={5} max={50}
              onChange={(e) => setConfig({ ...config, maxTurnover: parseInt(e.target.value) || 20 })}
              className="w-full bg-deep border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">频率</label>
            <select
              value={config.frequency}
              onChange={(e) => setConfig({ ...config, frequency: e.target.value as any })}
              className="w-full bg-deep border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A046]"
            >
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.useKelly}
                onChange={(e) => setConfig({ ...config, useKelly: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-deep text-[#C9A046] focus:ring-[#C9A046]"
              />
              <span className="text-sm text-gray-300">Kelly 优化</span>
            </label>
          </div>
        </div>
      </div>

      {/* Rebalance Suggestions */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">调仓建议</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{activeSuggestions.length} 项调整</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">股票</th>
                <th className="px-4 py-3 text-right">当前权重</th>
                <th className="px-4 py-3 text-right">目标权重</th>
                <th className="px-4 py-3 text-right">当前股数</th>
                <th className="px-4 py-3 text-right">目标股数</th>
                <th className="px-4 py-3 text-center">{t("components.actions")}</th>
                <th className="px-4 py-3 text-right">调整股数</th>
                <th className="px-4 py-3 text-right">调整金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeSuggestions.map((s) => (
                <tr key={s.code} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{s.name}</div>
                    <div className="text-[10px] text-gray-500">{s.code} · ${s.price.toFixed(2)}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{s.currentWeight.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-[#D4A853]">{s.targetWeight.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{s.currentShares}</td>
                  <td className="px-4 py-3 text-right font-mono text-white">{s.targetShares}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      s.action === t('components.increaseHolding') || s.action === t('components.newlyAdded') ? 'bg-red-500/20 text-red-400' :
                      s.action === t('components.decreaseHolding') || s.action === t('components.delete') ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {s.action}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    s.diffShares > 0 ? 'text-red-400' : s.diffShares < 0 ? 'text-emerald-400' : 'text-gray-400'
                  }`}>
                    {s.diffShares > 0 ? '+' : ''}{s.diffShares}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${
                    s.diffAmount > 0 ? 'text-red-400' : s.diffAmount < 0 ? 'text-emerald-400' : 'text-gray-400'
                  }`}>
                    {s.diffAmount > 0 ? '+' : ''}${s.diffAmount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weight Visualization */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">权重对比</h2>
        <div className="space-y-3">
          {activeSuggestions.map((s) => (
            <div key={s.code} className="flex items-center gap-3">
              <div className="w-20 text-xs text-gray-400 truncate">{s.name}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-white/5 rounded-full h-3 relative">
                  <div
                    className="absolute left-0 top-0 h-3 rounded-full bg-gray-600"
                    style={{ width: `${s.currentWeight}%` }}
                  />
                  <div
                    className="absolute left-0 top-0 h-3 rounded-full bg-[#C9A046] opacity-70"
                    style={{ width: `${s.targetWeight}%` }}
                  />
                </div>
                <div className="w-24 text-right">
                  <span className="text-xs text-gray-400">{s.currentWeight.toFixed(1)}% → </span>
                  <span className="text-xs text-[#D4A853]">{s.targetWeight.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-600" />当前权重</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#C9A046]" />目标权重</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-deep text-[#C9A046] focus:ring-[#C9A046]"
            />
            <span className="text-sm text-gray-300">仅预览（Dry-run）</span>
          </label>
        </div>
        <button
          className="bg-[#C9A046] hover:bg-[#D4A853] text-black font-medium px-6 py-2.5 rounded-lg transition-colors"
          onClick={() => alert(dryRun ? 'Dry-run 模式：仅展示调仓预览' : '真实执行：将提交调仓订单')}
        >
          {dryRun ? '预览调仓' : '执行调仓'}
        </button>
      </div>
    </div>
  );
}
