import { useState, useEffect, useRef } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

import * as echarts from 'echarts';
import { diagnoseStock } from '../../lib/bridge-api';
import i18n from '../../i18n';

interface DiagnosisResult {
  code: string;
  name: string;
  score: number;
  grade: string;
  recommendation: string;
  dimensions: {
    capitalFlow: { score: number; label: string };
    news: { score: number; label: string };
    fundHoldings: { score: number; label: string };
    dragonTiger: { score: number; label: string };
    anomalies: { score: number; label: string };
  };
  details: {
    capitalFlowSummary: string;
    newsSummary: string;
    fundSummary: string;
    dragonTigerSummary: string;
    anomalySummary: string;
  };
}

export default function StockOverviewPage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const radarRef = useRef<HTMLDivElement>(null);
  const radarChart = useRef<echarts.ECharts | null>(null);

  const handleDiagnose = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await diagnoseStock({ code: code.trim() });
      if (res?.success && res.report) {
        setResult(res.report);
      } else {
        setError(res?.error || i18n.t('StockOverviewPage.k1'));
      }
    } catch (e: unknown) {
      void EngineError; // [DATA] structured error tracking
      setError((e as any).message || i18n.t('StockOverviewPage.k2'));
    } finally {
      setLoading(false);
    }
  };

  // Radar Chart
  useEffect(() => {
    if (!radarRef.current || !result) return;
    if (!radarChart.current) radarChart.current = echarts.init(radarRef.current);

    const d = result.dimensions;
    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      radar: {
        indicator: [
          { name: i18n.t('StockOverviewPage.k3'), max: 100 },
          { name: i18n.t('StockOverviewPage.k4'), max: 100 },
          { name: i18n.t('StockOverviewPage.k5'), max: 100 },
          { name: i18n.t('StockOverviewPage.k6'), max: 100 },
          { name: i18n.t('StockOverviewPage.k7'), max: 100 },
        ],
        axisName: { color: '#9ca3af', fontSize: 12 },
        splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] } },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: [d.capitalFlow.score, d.news.score, d.fundHoldings.score, d.dragonTiger.score, d.anomalies.score],
          name: result.name,
          areaStyle: { color: 'rgba(201,160,70,0.2)' },
          lineStyle: { color: '#C9A046', width: 2 },
          itemStyle: { color: '#C9A046' },
        }],
      }],
    };
    radarChart.current.setOption(option);
  }, [result]);

  useEffect(() => {
    const handleResize = () => radarChart.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const gradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-red-400';
    if (grade.startsWith('B')) return 'text-yellow-400';
    if (grade.startsWith('C')) return 'text-gray-300';
    if (grade.startsWith('D')) return 'text-orange-400';
    return 'text-emerald-400';
  };

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">🔍 个股诊断</h1>
        <p className="text-gray-400 text-sm">五维度综合评分 · 资金流向 · 舆情 · 基金 · 龙虎榜 · 异动</p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleDiagnose()}
          placeholder="输入股票代码，如：600519"
          className="flex-1 bg-[#1a1a25] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A046]/50"
        />
        <button
          onClick={handleDiagnose}
          disabled={loading}
          className="bg-[#C9A046] hover:bg-[#b8933f] text-sidebar font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading ? i18n.t('StockOverviewPage.k8') : i18n.t('StockOverviewPage.k9')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Score Card */}
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{result.name}</div>
                <div className="text-sm text-gray-500 font-mono mt-1">{result.code}</div>
              </div>
              <div className="text-right">
                <div className={`text-5xl font-bold ${gradeColor(result.grade)}`}>{result.grade}</div>
                <div className="text-sm text-gray-400 mt-1">{result.score}/100</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-card rounded-lg">
              <div className="text-sm text-[#C9A046] font-medium">投资建议</div>
              <div className="text-sm text-gray-300 mt-1">{result.recommendation}</div>
            </div>
          </div>

          {/* Radar + Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
              <h2 className="text-sm font-medium text-white mb-3">五维度雷达图</h2>
              <div ref={radarRef} style={{ height: 320 }} />
            </div>

            <div className="space-y-3">
              {Object.entries(result.dimensions).map(([key, dim]) => {
                const labels: Record<string, string> = {
                  capitalFlow: i18n.t('StockOverviewPage.k10'),
                  news: i18n.t('StockOverviewPage.k11'),
                  fundHoldings: i18n.t('StockOverviewPage.k12'),
                  dragonTiger: i18n.t('StockOverviewPage.k13'),
                  anomalies: i18n.t('StockOverviewPage.k14'),
                };
                const details: Record<string, string> = {
                  capitalFlow: result.details.capitalFlowSummary,
                  news: result.details.newsSummary,
                  fundHoldings: result.details.fundSummary,
                  dragonTiger: result.details.dragonTigerSummary,
                  anomalies: result.details.anomalySummary,
                };
                return (
                  <div key={key} className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{labels[key]}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-card rounded-full overflow-hidden">
                          <div className="h-full bg-[#C9A046] rounded-full" style={{ width: `${dim.score}%` }} />
                        </div>
                        <span className="text-sm font-bold text-[#C9A046]">{dim.score}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">{details[key]}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm">输入股票代码开始综合诊断</p>
          <p className="text-xs mt-1">综合评估：资金流 + 舆情 + 基金 + 龙虎榜 + 异动</p>
        </div>
      )}
    </div>
  );
}
