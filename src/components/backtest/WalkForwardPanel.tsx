// ── DAWN WHALES — Walk-Forward Panel (Sprint 2 UI) ──────────────────────────
// Stability grade + decay bar chart + window detail table

import { useState, useEffect } from 'react';
import { walkForwardAnalysis } from '../../lib/bridge-api';

interface WFAConfig {
  klines: any[];
  baseConfig: any;
  paramRanges: Record<string, { min: number; max: number; step: number }>;
  trainSize?: number;
  testSize?: number;
}

interface WFAWindow {
  trainPeriod: string;
  testPeriod: string;
  trainReturn: number;
  testReturn: number;
}

interface WFAResult {
  inSample: { totalReturn: number; sharpeRatio: number };
  outOfSample: { totalReturn: number; sharpeRatio: number };
  stability: number;
  windows: WFAWindow[];
}

export default function WalkForwardPanel({ config }: { config: WFAConfig }) {
  const [result, setResult] = useState<WFAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState<number | null>(null);

  useEffect(() => { runWFA(); }, []);

  async function runWFA() {
    setLoading(true);
    try {
      const res = await walkForwardAnalysis({
        klines: config.klines,
        baseConfig: config.baseConfig,
        paramRanges: config.paramRanges,
        trainSize: config.trainSize || 500,
        testSize: config.testSize || 100,
      });
      if (res?.success && res.result) {
        setResult(res.result);
      }
    } catch {}
    setLoading(false);
  }

  if (loading) return <div className="text-center py-8 text-gray-500 text-sm">正在运行 Walk-Forward 分析...</div>;
  if (!result || !result.windows.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm mb-2">暂无 WFA 结果</p>
        <button
          onClick={runWFA}
          className="text-xs bg-[#C9A046]/20 text-[#D4A853] px-4 py-2 rounded-lg hover:bg-[#C9A046]/30"
        >
          运行 Walk-Forward 分析
        </button>
      </div>
    );
  }

  // Stability grade
  const stabilityPct = Math.round(result.stability * 100);
  let grade = 'F', gradeColor = 'text-red-400';
  if (stabilityPct >= 85) { grade = 'S'; gradeColor = 'text-[#D4A853]'; }
  else if (stabilityPct >= 70) { grade = 'A'; gradeColor = 'text-emerald-400'; }
  else if (stabilityPct >= 55) { grade = 'B'; gradeColor = 'text-blue-400'; }
  else if (stabilityPct >= 40) { grade = 'C'; gradeColor = 'text-yellow-400'; }
  else if (stabilityPct >= 25) { grade = 'D'; gradeColor = 'text-orange-400'; }

  const overfit = stabilityPct < 40;
  const decayRatio = result.outOfSample.sharpeRatio / Math.max(0.01, result.inSample.sharpeRatio);
  const consistent = result.windows.filter((w) => w.testReturn > 0).length / result.windows.length * 100;

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">🔍 Walk-Forward 分析</h3>
        <button
          onClick={runWFA}
          disabled={loading}
          className="text-xs bg-[#22222f] text-gray-400 px-3 py-1 rounded-lg hover:text-gray-200"
        >
          重新分析
        </button>
      </div>

      {/* Overfit warning */}
      {overfit && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400">
          ⚠️ 过拟合风险：样本外表现显著弱于样本内。策略可能对历史数据过拟合，建议简化策略或增加样本外验证。
        </div>
      )}

      {/* Scoreboard */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <ScoreCard
          label="稳定性"
          value={grade}
          sub={`${stabilityPct}%`}
          color={gradeColor}
        />
        <ScoreCard
          label="衰减比"
          value={decayRatio.toFixed(2)}
          sub="OOS / IS"
          color={decayRatio > 0.7 ? 'text-emerald-400' : decayRatio > 0.3 ? 'text-yellow-400' : 'text-red-400'}
        />
        <ScoreCard
          label="一致性"
          value={`${Math.round(consistent)}%`}
          sub="正收益窗口"
          color={consistent > 60 ? 'text-emerald-400' : consistent > 40 ? 'text-yellow-400' : 'text-red-400'}
        />
        <ScoreCard
          label="窗口数"
          value={String(result.windows.length)}
          sub="滚动窗口"
          color="text-gray-300"
        />
      </div>

      {/* Decay ratio bar chart */}
      <div className="mb-4">
        <div className="text-gray-400 text-[11px] font-medium mb-2">📊 逐窗衰减比</div>
        <div className="flex items-end gap-1 h-20">
          {result.windows.map((w, i) => {
            const oosSharpe = w.testReturn > 0 && w.trainReturn > 0
              ? Math.abs(w.testReturn / w.trainReturn)
              : 0;
            const ratio = Math.min(1.5, oosSharpe);
            const barH = Math.max(4, ratio / 1.5 * 72);
            const color = ratio > 0.8 ? '#22c55e'
              : ratio > 0.5 ? '#C9A046'
              : ratio > 0.3 ? '#eab308'
              : '#ef4444';
            return (
              <div
                key={i}
                className={`flex-1 rounded-t cursor-pointer transition-opacity ${selectedWindow === i ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}
                style={{ height: barH, backgroundColor: color }}
                onClick={() => setSelectedWindow(selectedWindow === i ? null : i)}
              />
            );
          })}
        </div>
        <div className="mt-1">
          <div className="border-t border-dashed border-white/10 relative" style={{ marginBottom: -16 }}>
            <span className="absolute -top-2 right-0 text-[9px] text-gray-600">1.0 参考线</span>
          </div>
        </div>
      </div>

      {/* Window detail table */}
      <div className="mb-3">
        <div className="text-gray-400 text-[11px] font-medium mb-2">📋 窗口明细</div>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 border-b border-white/5">
              <tr>
                <th className="text-left py-1.5">训练期</th>
                <th className="text-left py-1.5">测试期</th>
                <th className="text-right py-1.5">IS收益</th>
                <th className="text-right py-1.5">OOS收益</th>
              </tr>
            </thead>
            <tbody>
              {result.windows.map((w, i) => (
                <tr
                  key={i}
                  className={`border-b border-white/[0.02] cursor-pointer ${
                    selectedWindow === i ? 'bg-[#C9A046]/10' : 'hover:bg-white/[0.02]'
                  }`}
                  onClick={() => setSelectedWindow(selectedWindow === i ? null : i)}
                >
                  <td className="py-1.5 text-gray-400">{w.trainPeriod.slice(0, 10)}</td>
                  <td className="py-1.5 text-gray-400">{w.testPeriod.slice(0, 10)}</td>
                  <td className={`py-1.5 text-right font-mono ${w.trainReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {w.trainReturn >= 0 ? '+' : ''}{w.trainReturn.toFixed(1)}%
                  </td>
                  <td className={`py-1.5 text-right font-mono ${w.testReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {w.testReturn >= 0 ? '+' : ''}{w.testReturn.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto conclusion */}
      <div className="bg-[#12121a] rounded-lg p-3 text-xs text-gray-400">
        <span className="text-gray-300 font-medium">结论：</span>
        样本内年化 {result.inSample.totalReturn.toFixed(1)}%，样本外 {result.outOfSample.totalReturn.toFixed(1)}%，
        稳定性 {grade} 级（{stabilityPct}%）。{overfit ? '⚠️ 建议简化策略参数。' : '策略在样本外有较好的一致性。'}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[#12121a] rounded-lg p-3 text-center">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[9px] text-gray-600">{sub}</div>
    </div>
  );
}
