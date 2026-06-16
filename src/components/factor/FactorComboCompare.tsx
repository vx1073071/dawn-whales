// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
interface FactorCombo {
  id: string; name: string; label: string; factors: string[];
  annualReturn: number; maxDrawdown: number; winRate: number; sharpe: number; sortino: number; calmar: number;
  category: string; market: string; isDefault: boolean;
}

interface CompareResult {
  comboA: FactorCombo; comboB: FactorCombo; dimensions: CompareDim[];
  overallWinner: string; scoreA: number; scoreB: number; summary: string;
}

interface CompareDim {
  name: string; valueA: number; valueB: number; winner: 'A' | 'B' | 'draw';
  margin: number; significance: 'clear' | 'slight' | 'negligible'; betterHigher: boolean;
}

/* ====== Mock Data ====== */
const presetCombos: FactorCombo[] = [
  { id: 'fc1', name: '动量王者', label: 'Momentum King', factors: ['Momentum12M', 'Momentum3M', '行业动量', 'RSI动量'], annualReturn: 28, maxDrawdown: 22, winRate: 58, sharpe: 1.27, sortino: 1.8, calmar: 1.27, category: '动量', market: 'US', isDefault: true },
  { id: 'fc2', name: '价值防守', label: 'Value Defense', factors: ['PE_G', 'PB', '股息率', 'EV_EBITDA', 'F-Score'], annualReturn: 12, maxDrawdown: 10, winRate: 68, sharpe: 1.2, sortino: 1.7, calmar: 1.2, category: '价值', market: 'HK/CN', isDefault: true },
  { id: 'fc3', name: '资金跟随', label: 'Flow Follower', factors: ['北向资金', '机构资金', '大单净流入', '交易所资金流'], annualReturn: 32, maxDrawdown: 18, winRate: 64, sharpe: 1.78, sortino: 2.4, calmar: 1.78, category: '资金流', market: 'CN/CRYPTO', isDefault: true },
  { id: 'fc4', name: '低波稳健', label: 'Low Vol Stable', factors: ['Volatility20d', 'Beta', 'SharpeRatio', 'MaxDrawdown', 'PutCallRatio'], annualReturn: 8, maxDrawdown: 6, winRate: 75, sharpe: 1.33, sortino: 2.0, calmar: 1.33, category: '风控', market: 'ALL', isDefault: false }
];

/* ====== Generate mock compare ====== */
const genCompare = (a: FactorCombo, b: FactorCombo): CompareResult => {
  const dims: CompareDim[] = [
    { name: '年化收益', valueA: a.annualReturn, valueB: b.annualReturn, winner: a.annualReturn > b.annualReturn ? 'A' : 'B', margin: Math.abs(a.annualReturn - b.annualReturn), significance: Math.abs(a.annualReturn - b.annualReturn) > 8 ? 'clear' : 'slight', betterHigher: true },
    { name: '最大回撤', valueA: a.maxDrawdown, valueB: b.maxDrawdown, winner: a.maxDrawdown < b.maxDrawdown ? 'A' : 'B', margin: Math.abs(a.maxDrawdown - b.maxDrawdown), significance: Math.abs(a.maxDrawdown - b.maxDrawdown) > 5 ? 'clear' : 'slight', betterHigher: false },
    { name: '胜率', valueA: a.winRate, valueB: b.winRate, winner: a.winRate > b.winRate ? 'A' : 'B', margin: Math.abs(a.winRate - b.winRate), significance: Math.abs(a.winRate - b.winRate) > 8 ? 'clear' : 'slight', betterHigher: true },
    { name: '夏普比率', valueA: a.sharpe, valueB: b.sharpe, winner: a.sharpe > b.sharpe ? 'A' : 'B', margin: Math.abs(a.sharpe - b.sharpe), significance: Math.abs(a.sharpe - b.sharpe) > 0.3 ? 'clear' : 'slight', betterHigher: true },
    { name: 'Sortino', valueA: a.sortino, valueB: b.sortino, winner: a.sortino > b.sortino ? 'A' : 'B', margin: Math.abs(a.sortino - b.sortino), significance: Math.abs(a.sortino - b.sortino) > 0.5 ? 'clear' : 'slight', betterHigher: true },
    { name: 'Calmar', valueA: a.calmar, valueB: b.calmar, winner: a.calmar > b.calmar ? 'A' : 'B', margin: Math.abs(a.calmar - b.calmar), significance: Math.abs(a.calmar - b.calmar) > 0.3 ? 'clear' : 'slight', betterHigher: true }
  ];
  const winsA = dims.filter(d => d.winner === 'A').length;
  const winsB = dims.filter(d => d.winner === 'B').length;
  const overallWinner = winsA > winsB ? 'A' : winsB > winsA ? 'B' : 'draw';
  const scoreA = Math.round((winsA / 6) * 100);
  const scoreB = Math.round((winsB / 6) * 100);
  const summary = overallWinner === 'A' ? `${a.name} 在${winsA}/6维度占优，综合更强` : overallWinner === 'B' ? `${b.name} 在${winsB}/6维度占优，综合更强` : '两者各有千秋，建议看具体维度选择';
  return { comboA: a, comboB: b, dimensions: dims, overallWinner, scoreA, scoreB, summary };
};

/* ====== Sub-Components ====== */

const ScoreRing = ({ score, label, color }: { score: number; label: string; color: string }) => (
  <div className="flex flex-col items-center">
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${score * 1.5} 150`} strokeLinecap="round" transform="rotate(-90 28 28)" />
      </svg>
      <span className="text-sm font-bold">{score}%</span>
    </div>
    <span className="text-xs text-gray-500 mt-0.5">{label}</span>
  </div>
);

const DimBar = ({ dim, maxVal }: { dim: CompareDim; maxVal: number }) => {
  const pctA = (dim.valueA / maxVal) * 100;
  const pctB = (dim.valueB / maxVal) * 100;
  const colorA = dim.winner === 'A' ? (dim.significance === 'clear' ? '#22c55e' : '#86efac') : '#d1d5db';
  const colorB = dim.winner === 'B' ? (dim.significance === 'clear' ? '#22c55e' : '#86efac') : '#d1d5db';
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{dim.name}</span>
        <span className="text-xs text-gray-400">
          <span className="font-bold text-gray-700">{dim.valueA}</span> vs <span className="font-bold text-gray-700">{dim.valueB}</span>
          {dim.winner !== 'draw' && <span className={`ml-1 font-bold ${dim.winner === 'A' ? 'text-green-600' : 'text-blue-600'}`}>{dim.winner === 'A' ? 'A胜' : 'B胜'}</span>}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pctA, 100)}%`, backgroundColor: colorA }} />
        </div>
        <span className="text-xs font-bold text-gray-700 w-10 text-right">{dim.valueA}</span>
        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pctB, 100)}%`, backgroundColor: colorB }} />
        </div>
        <span className="text-xs font-bold text-gray-700 w-10 text-right">{dim.valueB}</span>
      </div>
    </div>
  );
};

/* ====== Main Component ====== */

export default function FactorComboCompare() {
  const [comboAId, setComboAId] = useState('fc1');
  const [comboBId, setComboBId] = useState('fc2');
  const [customFactors, setCustomFactors] = useState('');

  const comboA = presetCombos.find(c => c.id === comboAId) || presetCombos[0];
  const comboB = presetCombos.find(c => c.id === comboBId) || presetCombos[1];
  const result = useMemo(() => genCompare(comboA, comboB), [comboAId, comboBId]);

  const maxDimValue = Math.max(...result.dimensions.flatMap(d => [d.valueA, d.valueB])) * 1.2;
  const winnerColor = result.overallWinner === 'A' ? 'text-green-600' : result.overallWinner === 'B' ? 'text-blue-600' : 'text-gray-500';

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <h2 className="text-lg font-bold">⚖️ 因子组合对比</h2>
        <p className="text-xs text-white/80">选2个因子组合 → 6维度头对头PK → 看谁更强</p>
      </div>

      {/* Combo Selectors */}
      <div className="grid grid-cols-2 gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: comboAId, setter: setComboAId, label: '组合 A', color: 'border-green-400 bg-green-50/30' },
          { id: comboBId, setter: setComboBId, label: '组合 B', color: 'border-blue-400 bg-blue-50/30' }
        ].map(sel => (
          <div key={sel.label} className={`rounded-lg border-2 ${sel.color} p-2`}>
            <p className="text-xs font-bold text-gray-500 mb-1">{sel.label}</p>
            <select value={sel.id} onChange={e => sel.setter(e.target.value)} className="w-full text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-1">
              {presetCombos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Combo Info Cards */}
      <div className="grid grid-cols-2 gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs">
        {[result.comboA, result.comboB].map((c, i) => (
          <div key={c.id} className={i === 0 ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'}>
            <p className="font-bold mb-0.5">{c.name}</p>
            <p className="text-gray-500">{c.factors.join(' · ')}</p>
          </div>
        ))}
      </div>

      {/* Score Rings */}
      <div className="flex items-center justify-center gap-8 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <ScoreRing score={result.scoreA} label={result.comboA.name} color="#22c55e" />
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">VS</p>
          <p className={`text-xs font-bold ${winnerColor}`}>{result.overallWinner === 'A' ? 'A 占优' : result.overallWinner === 'B' ? 'B 占优' : '平手'}</p>
        </div>
        <ScoreRing score={result.scoreB} label={result.comboB.name} color="#3b82f6" />
      </div>

      {/* Dimension Bars */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">📊 维度对比</h4>
        {result.dimensions.map(d => <DimBar key={d.name} dim={d} maxVal={maxDimValue} />)}
      </div>

      {/* Summary + CTA */}
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-lg">💡</span>
          <p className="text-xs text-amber-800 dark:text-amber-200">{result.summary}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold">用这个组合建策略</button>
          <button className="px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50">导出对比</button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center justify-between">
        <span>⚖️ 4个预设组合 · 可自定义组合</span>
        <span className="text-blue-600 font-semibold">免费</span>
      </div>
    </div>
  );
}
