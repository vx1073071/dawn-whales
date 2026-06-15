// ── R187 ML P3-02: FactorPK — 2因子实时PK对比台 ─────────────────────
// Side-by-side comparison of any two factors. Users pick two factors and
// see a head-to-head battle across 6 dimensions:
// IC, Sharpe, Win Rate, Max Drawdown, Correlation, Stability.
//
// Design:
// - Top: factor selector dropdowns (searchable)
// - Middle: 6-dimension radar-style comparison with bar charts
// - Bottom: verdict card (which one wins overall + synergy note)
// - "婚姻" metaphor: shows if factors complement or conflict
// - Dark theme, golden accent for winner

import React, { useState, useMemo, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FactorStats {
  id: string;
  name: string;
  nameCN: string;
  category: string;
  ic: number;
  sharpe: number;
  winRate: number;
  maxDrawdown: number;    // positive number (e.g. 25 = -25%)
  stability: number;      // 0-100, how consistent the IC is
  description: string;
  level?: 'L1' | 'L2' | 'L3';
  color: string;
}

interface FactorPKProps {
  /** Available factors for comparison */
  factors: FactorStats[];
  /** Pre-selected factors */
  defaultLeft?: string;
  defaultRight?: string;
  /** Called when PK complete */
  onCompare?: (left: FactorStats, right: FactorStats, winner: FactorStats | null) => void;
  className?: string;
}

// ── Comparison Dimension ─────────────────────────────────────────────────────

type Dimension = 'ic' | 'sharpe' | 'winRate' | 'maxDrawdown' | 'stability' | 'correlation';

interface DimConfig {
  key: Dimension;
  label: string;
  icon: string;
  higherBetter: boolean;
  format: (v: number) => string;
}

const DIMENSIONS: DimConfig[] = [
  { key: 'ic', label: 'IC (信息系数)', icon: '📊', higherBetter: true, format: v => v.toFixed(3) },
  { key: 'sharpe', label: 'Sharpe (夏普)', icon: '📈', higherBetter: true, format: v => v.toFixed(2) },
  { key: 'winRate', label: '胜率', icon: '🎯', higherBetter: true, format: v => `${v.toFixed(0)}%` },
  { key: 'maxDrawdown', label: 'Max Drawdown', icon: '📉', higherBetter: false, format: v => `-${v.toFixed(0)}%` },
  { key: 'stability', label: '稳定性', icon: '🔒', higherBetter: true, format: v => `${v.toFixed(0)}/100` },
  { key: 'correlation', label: '预估相关性', icon: '🔗', higherBetter: false, format: v => v.toFixed(2) },
];

// ── Mock correlation data (simplified) ───────────────────────────────────────

function estimateCorrelation(leftId: string, rightId: string): number {
  // Same factor → 1.0
  if (leftId === rightId) return 1.0;

  // Same category → high correlation
  const sameCategoryPairs: Record<string, string[]> = {
    momentum: ['MOM_12M', 'MOM_1M', 'RSI_14'],
    value: ['HML', 'YIELD'],
    quality: ['QUAL', 'RMW', 'CMA'],
    volatility: ['VOL_60D', 'BOLL', 'ATR_14', 'US_VIX'],
    technical: ['EMA_12_26', 'KDJ', 'OBV'],
    crypto: ['CRYPTO_FUNDING', 'CRYPTO_OI_DELTA', 'CRYPTO_NVT'],
    hk_specific: ['HKEX_SOUTHBOUND', 'HKEX_CBCS_PREMIUM', 'HKEX_WARRANT_IV'],
    us_specific: ['US_SHORT_RATIO', 'US_INST_HOLD', 'US_BUYBACK'],
  };

  for (const [, ids] of Object.entries(sameCategoryPairs)) {
    if (ids.includes(leftId) && ids.includes(rightId)) return 0.75;
  }

  // Known complementary pairs → low correlation
  const complementary: [string, string][] = [
    ['MOM_12M', 'HML'], ['MOM_12M', 'YIELD'], ['GROWTH', 'YIELD'],
    ['MOM_12M', 'VOL_60D'], ['QUAL', 'GROWTH'],
  ];
  for (const [a, b] of complementary) {
    if ((leftId === a && rightId === b) || (leftId === b && rightId === a)) return 0.15;
  }

  // Default moderate
  return 0.45;
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorPK: React.FC<FactorPKProps> = ({
  factors,
  defaultLeft,
  defaultRight,
  onCompare,
  className = '',
}) => {
  const [leftId, setLeftId] = useState(defaultLeft || factors[0]?.id || '');
  const [rightId, setRightId] = useState(defaultRight || factors[1]?.id || factors[0]?.id || '');
  const [showSelector, setShowSelector] = useState<'left' | 'right' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const left = useMemo(() => factors.find(f => f.id === leftId), [factors, leftId]);
  const right = useMemo(() => factors.find(f => f.id === rightId), [factors, rightId]);

  const correlation = useMemo(() => {
    if (!left || !right) return 0;
    return estimateCorrelation(left.id, right.id);
  }, [left, right]);

  // Determine winner per dimension + overall
  const { winners, leftWins, rightWins, verdict } = useMemo(() => {
    if (!left || !right) return { winners: {} as Record<Dimension, 'left' | 'right' | 'tie'>, leftWins: 0, rightWins: 0, verdict: '' };

    const w: Record<Dimension, 'left' | 'right' | 'tie'> = {} as Record<Dimension, 'left' | 'right' | 'tie'>;
    let lw = 0, rw = 0;

    for (const dim of DIMENSIONS) {
      if (dim.key === 'correlation') {
        w.correlation = correlation < 0.4 ? 'left' : 'right'; // Lower is better for diversification
        if (correlation < 0.4) lw++; else rw++;
        continue;
      }
      const lVal = (left as any)[dim.key] as number;
      const rVal = (right as any)[dim.key] as number;
      if (dim.higherBetter) {
        if (lVal > rVal) { w[dim.key] = 'left'; lw++; }
        else if (rVal > lVal) { w[dim.key] = 'right'; rw++; }
        else { w[dim.key] = 'tie'; }
      } else {
        if (lVal < rVal) { w[dim.key] = 'left'; lw++; }
        else if (rVal < lVal) { w[dim.key] = 'right'; rw++; }
        else { w[dim.key] = 'tie'; }
      }
    }

    let v = '';
    if (lw >= 4) v = 'left';
    else if (rw >= 4) v = 'right';
    else v = 'tie';

    return { winners: w, leftWins: lw, rightWins: rw, verdict: v };
  }, [left, right, correlation]);

  // Synergy analysis
  const synergy = useMemo(() => {
    if (correlation < 0.2) return { level: 'perfect', emoji: '🤝', text: '天生一对！相关性极低，组合使用效果1+1>2。' };
    if (correlation < 0.4) return { level: 'good', emoji: '🤝', text: '好搭档。相关性较低，可以分散风险。' };
    if (correlation < 0.65) return { level: 'ok', emoji: '🤔', text: '还行。有一定重叠但还可搭配。' };
    if (correlation < 0.8) return { level: 'warning', emoji: '⚠️', text: '近亲配对。重叠度较高，选一个就够了。' };
    return { level: 'bad', emoji: '🔴', text: '双胞胎！高度冗余，不要同时使用。' };
  }, [correlation]);

  // Factor selector dropdown
  const filteredFactors = useMemo(() => {
    if (!searchQuery) return factors;
    const q = searchQuery.toLowerCase();
    return factors.filter(f => f.nameCN.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
  }, [factors, searchQuery]);

  const handleSelect = useCallback((factorId: string) => {
    if (showSelector === 'left') {
      setLeftId(factorId);
    } else {
      setRightId(factorId);
    }
    setShowSelector(null);
    setSearchQuery('');
  }, [showSelector]);

  const renderDimensionBar = (dim: DimConfig, lVal: number, rVal: number) => {
    const maxVal = Math.max(Math.abs(lVal), Math.abs(rVal), 0.01);
    const winner = winners[dim.key];
    return (
      <div key={dim.key} className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">{dim.icon} {dim.label}</span>
          <span className={`font-mono text-[9px] ${
            winner === 'left' ? 'text-green-400' : winner === 'right' ? 'text-blue-400' : 'text-gray-500'
          }`}>
            {winner === 'left' ? '← 左胜' : winner === 'right' ? '右胜 →' : '平手'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-green-400 w-12 text-right">{dim.format(lVal)}</span>
          <div className="flex-1 flex gap-1">
            <div className="flex-1 flex justify-end">
              <div
                className="h-2 rounded-l transition-all duration-500"
                style={{
                  width: `${Math.min(Math.abs(lVal) / maxVal * 100, 100)}%`,
                  backgroundColor: dim.higherBetter ? '#4CAF50' : '#F44336',
                  opacity: winner === 'left' ? 1 : 0.4,
                }}
              />
            </div>
            <div className="w-px bg-white/10" />
            <div className="flex-1">
              <div
                className="h-2 rounded-r transition-all duration-500"
                style={{
                  width: `${Math.min(Math.abs(rVal) / maxVal * 100, 100)}%`,
                  backgroundColor: dim.higherBetter ? '#3b82f6' : '#f97316',
                  opacity: winner === 'right' ? 1 : 0.4,
                }}
              />
            </div>
          </div>
          <span className="text-[10px] font-mono text-blue-400 w-12">{dim.format(rVal)}</span>
        </div>
      </div>
    );
  };

  if (factors.length < 2) {
    return <div className="text-center py-8 text-xs text-gray-600">需要至少2个因子才能PK对比</div>;
  }

  return (
    <div className={`${className}`}>
      {/* Factor selectors */}
      <div className="flex items-center gap-4 mb-4">
        {/* Left selector */}
        <div className="flex-1 relative">
          <button
            onClick={() => { setShowSelector(showSelector === 'left' ? null : 'left'); setSearchQuery(''); }}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-left border transition-all"
            style={{
              backgroundColor: left ? left.color + '15' : 'rgba(255,255,255,0.03)',
              borderColor: left ? left.color + '40' : 'rgba(255,255,255,0.08)',
              color: left ? left.color : '#9ca3af',
            }}
          >
            {left ? `${left.nameCN}` : '选择因子A'}
            <span className="text-[10px] text-gray-600 ml-2 font-mono">{left?.id}</span>
          </button>
          {/* Dropdown */}
          {showSelector === 'left' && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a25] border border-white/10 rounded-lg shadow-2xl max-h-[250px] overflow-y-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索因子..."
                className="w-full px-3 py-2 text-xs bg-transparent border-b border-white/5 text-white placeholder-gray-600 focus:outline-none"
                autoFocus
              />
              {filteredFactors.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleSelect(f.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-white/[0.05] text-xs flex items-center gap-2 ${f.id === leftId ? 'bg-white/[0.08]' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-white">{f.nameCN}</span>
                  <span className="text-gray-600 font-mono">{f.id}</span>
                  <span className="text-gray-600">{f.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* VS */}
        <div className="text-lg font-bold text-gray-600 flex-shrink-0">VS</div>

        {/* Right selector */}
        <div className="flex-1 relative">
          <button
            onClick={() => { setShowSelector(showSelector === 'right' ? null : 'right'); setSearchQuery(''); }}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-left border transition-all"
            style={{
              backgroundColor: right ? right.color + '15' : 'rgba(255,255,255,0.03)',
              borderColor: right ? right.color + '40' : 'rgba(255,255,255,0.08)',
              color: right ? right.color : '#9ca3af',
            }}
          >
            {right ? `${right.nameCN}` : '选择因子B'}
            <span className="text-[10px] text-gray-600 ml-2 font-mono">{right?.id}</span>
          </button>
          {showSelector === 'right' && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a25] border border-white/10 rounded-lg shadow-2xl max-h-[250px] overflow-y-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索因子..."
                className="w-full px-3 py-2 text-xs bg-transparent border-b border-white/5 text-white placeholder-gray-600 focus:outline-none"
                autoFocus
              />
              {filteredFactors.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleSelect(f.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-white/[0.05] text-xs flex items-center gap-2 ${f.id === rightId ? 'bg-white/[0.08]' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-white">{f.nameCN}</span>
                  <span className="text-gray-600 font-mono">{f.id}</span>
                  <span className="text-gray-600">{f.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!left || !right ? (
        <div className="text-center py-8 text-xs text-gray-600">请选择两个因子开始PK</div>
      ) : (
        <>
          {/* Scoreboard */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className={`text-xs font-bold ${verdict === 'left' ? 'text-green-400' : 'text-gray-400'}`}>
              🏆 {left.nameCN} <span className="text-[10px]">({leftWins}/{DIMENSIONS.length})</span>
            </div>
            <div className="text-[10px] text-gray-600">{leftWins} : {rightWins}</div>
            <div className={`text-xs font-bold ${verdict === 'right' ? 'text-blue-400' : 'text-gray-400'}`}>
              <span className="text-[10px]">({rightWins}/{DIMENSIONS.length})</span> {right.nameCN} 🏆
            </div>
          </div>

          {/* Dimension bars */}
          <div className="space-y-3 mb-4">
            {DIMENSIONS.map(dim => {
              if (dim.key === 'correlation') {
                return (
                  <div key="correlation" className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">🔗 相关性</span>
                      <span className={`text-[9px] font-mono ${
                        correlation < 0.3 ? 'text-green-400' : correlation < 0.6 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {correlation.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${correlation * 100}%`,
                          backgroundColor: correlation < 0.3 ? '#4CAF50' : correlation < 0.6 ? '#f59e0b' : '#F44336',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-gray-700">
                      <span>独立</span><span>中度</span><span>高度重叠</span>
                    </div>
                  </div>
                );
              }
              const lVal = (left as any)[dim.key] as number;
              const rVal = (right as any)[dim.key] as number;
              return renderDimensionBar(dim, lVal, rVal);
            })}
          </div>

          {/* Synergy verdict */}
          <div className={`p-4 rounded-xl border ${
            synergy.level === 'perfect' ? 'bg-green-500/5 border-green-500/20' :
            synergy.level === 'good' ? 'bg-blue-500/5 border-blue-500/20' :
            synergy.level === 'ok' ? 'bg-yellow-500/5 border-yellow-500/20' :
            synergy.level === 'warning' ? 'bg-orange-500/5 border-orange-500/20' :
            'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{synergy.emoji}</span>
              <span className="text-xs font-bold text-white">
                {synergy.level === 'perfect' ? '最佳搭配' : synergy.level === 'good' ? '不错搭配' : synergy.level === 'ok' ? '可选搭配' : synergy.level === 'warning' ? '谨慎搭配' : '避免搭配'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">{synergy.text}</p>

            {/* Winner summary */}
            {verdict !== 'tie' && (
              <div className="mt-2 pt-2 border-t border-white/5">
                <p className="text-[10px] text-[#D4A853]">
                  🏆 综合PK: <strong>{verdict === 'left' ? left.nameCN : right.nameCN}</strong> 在{verdict === 'left' ? leftWins : rightWins}/{DIMENSIONS.length - 1}个维度胜出
                  {synergy.level === 'perfect' || synergy.level === 'good' ? ' — 但两者搭配效果最佳！' : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FactorPK;
