/**
 * StrategyComparer — A/B side-by-side strategy comparison
 * (ML-43-02, R43 Phase 6.0)
 *
 * Features:
 * - Left/right split comparison
 * - Synced time axis for equity curves
 * - 4-dimension radar chart (Sharpe/Return/Drawdown/WinRate)
 * - Metric diff highlighting (green better, red worse)
 * - Strategy selector dropdowns
 */

import React, { useState, useMemo, useCallback } from 'react';
import i18n from '../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

// ── R164 B3: Factor exposure per strategy for radar comparison ────────
interface FactorExposure {
  factor: string;
  nameCN: string;
  loading: number; // standardized beta, -1 to +1
}

interface StrategySnapshot {
  id: string;
  name: string;
  type: string;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  annualVol: number;
  calmarRatio: number;
  tradeCount: number;
  avgHoldingDays: number;
  profitFactor: number;
  equityCurve: number[]; // 100 normalized points
  factorExposures?: FactorExposure[];
}

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_STRATEGIES: StrategySnapshot[] = [
{
  id: 's1', name: i18n.t('StrategyComparer.k1'), type: 'MA_CROSS',
  sharpe: 2.1, totalReturn: 0.35, maxDrawdown: -0.12, winRate: 0.58,
  annualVol: 0.18, calmarRatio: 2.9, tradeCount: 245, avgHoldingDays: 7.2,
  profitFactor: 1.8,
  equityCurve: Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i / 8) * 15 + i * 0.35 + Math.random() * 5),
  factorExposures: [
    { factor: 'MKT', nameCN: '市场Beta', loading: 0.72 },
    { factor: 'SMB', nameCN: '小盘因子', loading: 0.15 },
    { factor: 'HML', nameCN: '价值因子', loading: -0.08 },
    { factor: 'MOM_12M', nameCN: '12月动量', loading: 0.45 },
    { factor: 'VOL_60D', nameCN: '60日低波', loading: -0.32 },
    { factor: 'QUAL', nameCN: '品质因子', loading: 0.22 },
    { factor: 'LIQ', nameCN: '流动性', loading: 0.10 },
    { factor: 'YIELD', nameCN: '股息率', loading: -0.05 },
  ],
},
{
  id: 's2', name: i18n.t('StrategyComparer.k2'), type: 'MOMENTUM',
  sharpe: 1.8, totalReturn: 0.28, maxDrawdown: -0.18, winRate: 0.52,
  annualVol: 0.22, calmarRatio: 1.6, tradeCount: 180, avgHoldingDays: 4.5,
  profitFactor: 1.4,
  equityCurve: Array.from({ length: 100 }, (_, i) => 100 + Math.cos(i / 6) * 20 + i * 0.28 + Math.random() * 8),
  factorExposures: [
    { factor: 'MKT', nameCN: '市场Beta', loading: 0.55 },
    { factor: 'SMB', nameCN: '小盘因子', loading: 0.30 },
    { factor: 'HML', nameCN: '价值因子', loading: -0.18 },
    { factor: 'MOM_12M', nameCN: '12月动量', loading: 0.68 },
    { factor: 'VOL_60D', nameCN: '60日低波', loading: -0.15 },
    { factor: 'QUAL', nameCN: '品质因子', loading: 0.10 },
    { factor: 'LIQ', nameCN: '流动性', loading: 0.28 },
    { factor: 'YIELD', nameCN: '股息率', loading: -0.12 },
  ],
},
{
  id: 's3', name: i18n.t('StrategyComparer.k3'), type: 'MEAN_REV',
  sharpe: 2.4, totalReturn: 0.42, maxDrawdown: -0.09, winRate: 0.63,
  annualVol: 0.15, calmarRatio: 4.7, tradeCount: 320, avgHoldingDays: 3.1,
  profitFactor: 2.1,
  equityCurve: Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i / 10) * 8 + i * 0.42 + Math.random() * 3),
  factorExposures: [
    { factor: 'MKT', nameCN: '市场Beta', loading: 0.42 },
    { factor: 'SMB', nameCN: '小盘因子', loading: -0.22 },
    { factor: 'HML', nameCN: '价值因子', loading: 0.35 },
    { factor: 'MOM_12M', nameCN: '12月动量', loading: 0.05 },
    { factor: 'VOL_60D', nameCN: '60日低波', loading: -0.48 },
    { factor: 'QUAL', nameCN: '品质因子', loading: 0.38 },
    { factor: 'LIQ', nameCN: '流动性', loading: -0.08 },
    { factor: 'YIELD', nameCN: '股息率', loading: 0.20 },
  ],
}];

// ── Radar chart sub-component ───────────────────────────────────────────

// ── R168 P2-12: Market Regime Detection + Comparison Conclusion ─────────

type MarketRegime = 'bull' | 'bear' | 'ranging' | 'volatile';

interface RegimeAnalysis {
  regime: MarketRegime;
  regimeCN: string;
  confidence: number; // 0-1
  trendSlope: number;
  volatilityPercentile: number; // 0-100, higher=more volatile
  evidence: string;
}

interface ComparisonConclusion {
  /** Overall winner */
  overallWinner: 'A' | 'B' | 'tie';
  /** Dimension-specific winners */
  returnWinner: 'A' | 'B' | 'tie';
  riskWinner: 'A' | 'B' | 'tie';
  stabilityWinner: 'A' | 'B' | 'tie';
  /** Market regime analysis */
  regime: RegimeAnalysis;
  /** Scenario-based recommendations */
  scenarios: ScenarioRecommendation[];
  /** One-line verdict */
  verdict: string;
  /** Detailed reasoning */
  reasoning: string[];
}

interface ScenarioRecommendation {
  scenario: string;
  scenarioCN: string;
  recommended: 'A' | 'B' | 'either';
  reason: string;
}

/**
 * Detect market regime from equity curve and factor exposures.
 */
function detectMarketRegime(
  curveA: number[],
  curveB: number[],
  mktBetaA: number,
  mktBetaB: number,
): RegimeAnalysis {
  // Use average curve for regime detection
  const avgCurve = curveA.map((v, i) => (v + (curveB[i] ?? v)) / 2);
  const n = avgCurve.length;

  if (n < 10) {
    return { regime: 'ranging', regimeCN: '震荡', confidence: 0.3, trendSlope: 0, volatilityPercentile: 50, evidence: '数据不足' };
  }

  // Linear regression trend
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += avgCurve[i];
    sumXY += i * avgCurve[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX + 0.0001);
  const meanY = sumY / n;
  const normalizedSlope = slope / (meanY + 0.0001);

  // Volatility: std of daily returns
  const returns = [];
  for (let i = 1; i < n; i++) {
    returns.push((avgCurve[i] - avgCurve[i - 1]) / (avgCurve[i - 1] + 0.0001));
  }
  const meanRet = returns.reduce((s, r) => s + r, 0) / returns.length;
  const retVol = Math.sqrt(returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / returns.length);

  // Percentile (rough): typical daily vol 1% = normal, >2% = high
  const volPct = Math.min(100, Math.round(retVol / 0.03 * 100));

  // Average market beta
  const avgBeta = (mktBetaA + mktBetaB) / 2;

  let regime: MarketRegime;
  let regimeCN: string;
  let confidence: number;
  let evidence: string;

  if (normalizedSlope > 0.003) {
    regime = 'bull';
    regimeCN = '牛市';
    confidence = Math.min(0.95, 0.5 + Math.abs(normalizedSlope) * 50);
    evidence = `趋势向上(斜率${(normalizedSlope * 100).toFixed(1)}%)，市场Beta=${avgBeta.toFixed(2)}`;
  } else if (normalizedSlope < -0.003) {
    regime = 'bear';
    regimeCN = '熊市';
    confidence = Math.min(0.95, 0.5 + Math.abs(normalizedSlope) * 50);
    evidence = `趋势向下(斜率${(normalizedSlope * 100).toFixed(1)}%)，市场Beta=${avgBeta.toFixed(2)}`;
  } else if (volPct > 60) {
    regime = 'volatile';
    regimeCN = '高波动';
    confidence = Math.min(0.9, 0.4 + volPct / 200);
    evidence = `横盘但波动率高(${volPct}分位)，市场Beta=${avgBeta.toFixed(2)}`;
  } else {
    regime = 'ranging';
    regimeCN = '震荡';
    confidence = Math.min(0.85, 0.4 + (100 - volPct) / 200);
    evidence = `横盘低波动(${volPct}分位)，市场Beta=${avgBeta.toFixed(2)}`;
  }

  return { regime, regimeCN, confidence, trendSlope: normalizedSlope, volatilityPercentile: volPct, evidence };
}

/**
 * Generate comparison conclusion with market-aware recommendations.
 */
function generateConclusion(
  a: StrategySnapshot,
  b: StrategySnapshot,
): ComparisonConclusion {
  const mktBetaA = a.factorExposures?.find((f) => f.factor === 'MKT')?.loading ?? 0.5;
  const mktBetaB = b.factorExposures?.find((f) => f.factor === 'MKT')?.loading ?? 0.5;
  const regime = detectMarketRegime(a.equityCurve, b.equityCurve, mktBetaA, mktBetaB);

  // Return winner: total return
  const returnWinner: 'A' | 'B' | 'tie' =
    a.totalReturn > b.totalReturn * 1.02 ? 'A' : b.totalReturn > a.totalReturn * 1.02 ? 'B' : 'tie';

  // Risk winner: composite (sharpe + maxDD + volatility)
  const riskScoreA = a.sharpe * 0.4 + (1 / Math.abs(a.maxDrawdown + 0.01)) * 0.35 + (1 / (a.annualVol + 0.01)) * 0.25;
  const riskScoreB = b.sharpe * 0.4 + (1 / Math.abs(b.maxDrawdown + 0.01)) * 0.35 + (1 / (b.annualVol + 0.01)) * 0.25;
  const riskWinner: 'A' | 'B' | 'tie' =
    riskScoreA > riskScoreB * 1.05 ? 'A' : riskScoreB > riskScoreA * 1.05 ? 'B' : 'tie';

  // Stability winner: Calmar + winRate + profitability consistency
  const stabilityScoreA = a.calmarRatio * 0.4 + a.winRate * 0.4 + (a.profitFactor > 0 ? a.profitFactor * 0.2 : 0);
  const stabilityScoreB = b.calmarRatio * 0.4 + b.winRate * 0.4 + (b.profitFactor > 0 ? b.profitFactor * 0.2 : 0);
  const stabilityWinner: 'A' | 'B' | 'tie' =
    stabilityScoreA > stabilityScoreB * 1.05 ? 'A' : stabilityScoreB > stabilityScoreA * 1.05 ? 'B' : 'tie';

  // Overall winner: composite
  const overallScoreA = a.totalReturn * 0.35 + a.sharpe * 0.25 + (1 / (Math.abs(a.maxDrawdown) + 0.01)) * 0.2 + a.winRate * 0.2;
  const overallScoreB = b.totalReturn * 0.35 + b.sharpe * 0.25 + (1 / (Math.abs(b.maxDrawdown) + 0.01)) * 0.2 + b.winRate * 0.2;
  const overallWinner: 'A' | 'B' | 'tie' =
    overallScoreA > overallScoreB * 1.03 ? 'A' : overallScoreB > overallScoreA * 1.03 ? 'B' : 'tie';

  // Scenario recommendations
  const scenarios: ScenarioRecommendation[] = [
    {
      scenario: 'bull', scenarioCN: '牛市中',
      recommended: mktBetaA > mktBetaB + 0.15 ? 'A' : mktBetaB > mktBetaA + 0.15 ? 'B' : 'either',
      reason: `高Beta策略在牛市中表现更优 (A=${mktBetaA.toFixed(2)}, B=${mktBetaB.toFixed(2)})`,
    },
    {
      scenario: 'bear', scenarioCN: '熊市中',
      recommended: Math.abs(a.maxDrawdown) < Math.abs(b.maxDrawdown) ? 'A' : Math.abs(b.maxDrawdown) < Math.abs(a.maxDrawdown) ? 'B' : 'either',
      reason: `低回撤策略在熊市中更安全 (A=${(Math.abs(a.maxDrawdown) * 100).toFixed(0)}%, B=${(Math.abs(b.maxDrawdown) * 100).toFixed(0)}%)`,
    },
    {
      scenario: 'ranging', scenarioCN: '震荡市中',
      recommended: a.winRate > b.winRate + 0.05 ? 'A' : b.winRate > a.winRate + 0.05 ? 'B' : 'either',
      reason: `高胜率策略在震荡市中更稳定 (A=${(a.winRate * 100).toFixed(0)}%, B=${(b.winRate * 100).toFixed(0)}%)`,
    },
    {
      scenario: 'volatile', scenarioCN: '高波动中',
      recommended: a.calmarRatio > b.calmarRatio + 0.3 ? 'A' : b.calmarRatio > a.calmarRatio + 0.3 ? 'B' : 'either',
      reason: `高Calmar策略在高波动中回撤控制更好 (A=${a.calmarRatio.toFixed(1)}, B=${b.calmarRatio.toFixed(1)})`,
    },
    {
      scenario: 'current', scenarioCN: `当前${regime.regimeCN}`,
      recommended: regime.regime === 'bull'
        ? (mktBetaA > mktBetaB + 0.15 ? 'A' : mktBetaB > mktBetaA + 0.15 ? 'B' : returnWinner !== 'tie' ? returnWinner : 'either')
        : regime.regime === 'bear'
        ? (Math.abs(a.maxDrawdown) < Math.abs(b.maxDrawdown) ? 'A' : Math.abs(b.maxDrawdown) < Math.abs(a.maxDrawdown) ? 'B' : riskWinner !== 'tie' ? riskWinner : 'either')
        : ((a.sharpe > b.sharpe ? 'A' : b.sharpe > a.sharpe ? 'B' : 'either')),
      reason: `基于当前${regime.regimeCN}环境自动推荐`,
    },
  ];

  // Verdict
  const nameA = a.name.length > 12 ? a.name.slice(0, 12) + '…' : a.name;
  const nameB = b.name.length > 12 ? b.name.slice(0, 12) + '…' : b.name;

  let verdict: string;
  if (overallWinner === 'A') {
    verdict = `${nameA} 综合表现更优`;
  } else if (overallWinner === 'B') {
    verdict = `${nameB} 综合表现更优`;
  } else {
    verdict = `两者综合表现接近，需根据市场环境选择`;
  }

  // Reasoning
  const reasoning: string[] = [];
  if (returnWinner !== 'tie') {
    reasoning.push(`收益: ${returnWinner === 'A' ? nameA : nameB} 领先 (${returnWinner === 'A' ? (a.totalReturn * 100).toFixed(1) : (b.totalReturn * 100).toFixed(1)}% vs ${returnWinner === 'A' ? (b.totalReturn * 100).toFixed(1) : (a.totalReturn * 100).toFixed(1)}%)`);
  }
  if (riskWinner !== 'tie') {
    reasoning.push(`风险: ${riskWinner === 'A' ? nameA : nameB} 更安全 (夏普${riskWinner === 'A' ? a.sharpe.toFixed(1) : b.sharpe.toFixed(1)} vs ${riskWinner === 'A' ? b.sharpe.toFixed(1) : a.sharpe.toFixed(1)})`);
  }
  reasoning.push(`市场: 检测到${regime.regimeCN}环境 (置信度${(regime.confidence * 100).toFixed(0)}%)`);
  const currentScenario = scenarios.find((s) => s.scenario === 'current');
  if (currentScenario && currentScenario.recommended !== 'either') {
    const recName = currentScenario.recommended === 'A' ? nameA : nameB;
    reasoning.push(`建议: 当前${regime.regimeCN}环境推荐 ${recName}`);
  }

  return {
    overallWinner,
    returnWinner,
    riskWinner,
    stabilityWinner,
    regime,
    scenarios,
    verdict,
    reasoning,
  };
}

// ── R168: Conclusion Summary Card ────────────────────────────────────────

const ConclusionCard: React.FC<{ conclusion: ComparisonConclusion; nameA: string; nameB: string }> = ({
  conclusion,
  nameA,
  nameB,
}) => {
  const { regime, scenarios, verdict, reasoning, overallWinner, returnWinner, riskWinner } = conclusion;

  const regimeColors: Record<MarketRegime, string> = {
    bull: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    bear: 'text-red-400 bg-red-500/10 border-red-500/30',
    ranging: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    volatile: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  };

  const winnerBadge = (winner: 'A' | 'B' | 'tie') => {
    if (winner === 'A') return <span className="text-amber-400 font-semibold">{nameA} ⬅</span>;
    if (winner === 'B') return <span className="text-blue-400 font-semibold">➡ {nameB}</span>;
    return <span className="text-gray-500">持平</span>;
  };

  return (
    <div className="mt-5 space-y-4">
      {/* Verdict banner */}
      <div className={`p-4 rounded-lg border ${
        overallWinner === 'A' ? 'bg-amber-500/5 border-amber-500/30' :
        overallWinner === 'B' ? 'bg-blue-500/5 border-blue-500/30' :
        'bg-gray-800/40 border-gray-700/30'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-lg">📋</span>
          <span className="text-sm font-bold text-white">{i18n.t('StrategyComparer.k12')}</span>
        </div>
        <p className="text-base font-bold text-white">{verdict}</p>
        <ul className="mt-2 space-y-1">
          {reasoning.map((r, i) => (
            <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
              <span className="text-gray-600 mt-0.5">•</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Dimension winners */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 text-center">
          <div className="text-[10px] text-gray-500 mb-1">{i18n.t('StrategyComparer.k13')}</div>
          <div className="text-xs">{winnerBadge(returnWinner)}</div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 text-center">
          <div className="text-[10px] text-gray-500 mb-1">{i18n.t('StrategyComparer.k14')}</div>
          <div className="text-xs">{winnerBadge(riskWinner)}</div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 text-center">
          <div className="text-[10px] text-gray-500 mb-1">{i18n.t('StrategyComparer.k15')}</div>
          <div className="text-xs">{winnerBadge(conclusion.stabilityWinner)}</div>
        </div>
      </div>

      {/* Market regime detection */}
      <div className={`p-3 rounded-lg border ${regimeColors[regime.regime]}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">{regime.regime === 'bull' ? '🐂' : regime.regime === 'bear' ? '🐻' : regime.regime === 'volatile' ? '🌪️' : '📊'}</span>
          <span className="text-xs font-semibold">{i18n.t('StrategyComparer.k16')}: {regime.regimeCN}</span>
          <span className="text-[10px] opacity-70">置信度{(regime.confidence * 100).toFixed(0)}%</span>
        </div>
        <p className="text-[10px] opacity-70">{regime.evidence}</p>
      </div>

      {/* Scenario recommendations */}
      <div>
        <div className="text-[10px] text-gray-500 mb-2 font-semibold uppercase tracking-wider">
          {i18n.t('StrategyComparer.k17')}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {scenarios.map((sc, i) => {
            const isCurrent = sc.scenario === 'current';
            return (
              <div
                key={i}
                className={`p-2.5 rounded border text-xs ${
                  isCurrent
                    ? 'bg-yellow-500/5 border-yellow-500/40'
                    : 'bg-gray-800/30 border-gray-700/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold ${isCurrent ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {sc.scenarioCN}{isCurrent ? ' ⭐' : ''}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    sc.recommended === 'A' ? 'bg-amber-500/20 text-amber-400' :
                    sc.recommended === 'B' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-600/20 text-gray-500'
                  }`}>
                    {sc.recommended === 'A' ? nameA : sc.recommended === 'B' ? nameB : '均可'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">{sc.reason}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Original Radar Chart Component ───────────────────────────────────────

const RadarChart: React.FC<{
  data: {label: string;valueA: number;valueB: number;maxVal: number;}[];
  size?: number;
}> = ({ data, size = 140 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const n = data.length;

  const getPoint = (index: number, value: number, maxVal: number) => {
    const angle = index / n * 2 * Math.PI - Math.PI / 2;
    const r = value / maxVal * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    };
  };

  const maxVal = Math.max(...data.map((d) => d.maxVal), 1);

  // Background grid
  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid polygons */}
      {levels.map((level) => {
        const points = data.map((_, i) => {
          const p = getPoint(i, level * maxVal, maxVal);
          return `${p.x},${p.y}`;
        }).join(' ');
        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="#374151"
            strokeWidth="0.5" />);

      })}

      {/* Axes */}
      {data.map((_, i) => {
        const outer = getPoint(i, maxVal, maxVal);
        return (
          <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="#374151" strokeWidth="0.5" />);

      })}

      {/* Strategy A polygon */}
      <polygon
        points={data.map((d, i) => {
          const p = getPoint(i, d.valueA, maxVal);
          return `${p.x},${p.y}`;
        }).join(' ')}
        fill="#f59e0b"
        fillOpacity="0.2"
        stroke="#f59e0b"
        strokeWidth="1.5" />
      

      {/* Strategy B polygon */}
      <polygon
        points={data.map((d, i) => {
          const p = getPoint(i, d.valueB, maxVal);
          return `${p.x},${p.y}`;
        }).join(' ')}
        fill="#3b82f6"
        fillOpacity="0.2"
        stroke="#3b82f6"
        strokeWidth="1.5" />
      

      {/* Labels */}
      {data.map((d, i) => {
        const outer = getPoint(i, maxVal * 1.15, maxVal);
        return (
          <text
            key={i}
            x={outer.x}
            y={outer.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fill="#6b7280">
            
            {d.label}
          </text>);

      })}
    </svg>);

};

// ── R164 B3: Factor Exposure Radar (8-factor) ───────────────────────────
const FactorExposureRadar: React.FC<{
  exposuresA?: FactorExposure[];
  exposuresB?: FactorExposure[];
  size?: number;
}> = ({ exposuresA, exposuresB, size = 160 }) => {
  const expA = exposuresA ?? [];
  const expB = exposuresB ?? [];
  if (expA.length === 0 && expB.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.33;
  const n = Math.max(expA.length, expB.length);

  const factors = expA.length >= expB.length ? expA : expB;

  const getPoint = (index: number, loading: number) => {
    const angle = (index / n) * 2 * Math.PI - Math.PI / 2;
    // loading ranges -0.8 to 0.8, map to 0.1~1.0 of radius
    const r = Math.max(0.1, Math.min(1, (Math.abs(loading) / 0.8))) * radius;
    return { x: cx + (loading >= 0 ? r : -r) * Math.cos(angle), y: cy + (loading >= 0 ? r : -r) * Math.sin(angle) };
  };

  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid */}
      {levels.map((level) => (
        <circle key={level} cx={cx} cy={cy} r={level * radius} fill="none" stroke="#374151" strokeWidth="0.5" />
      ))}
      {/* Axes */}
      {factors.map((_: FactorExposure, i: number) => (
        <line key={i} x1={cx} y1={cy} x2={cx + radius * Math.cos((i / n) * 2 * Math.PI - Math.PI / 2)} y2={cy + radius * Math.sin((i / n) * 2 * Math.PI - Math.PI / 2)} stroke="#374151" strokeWidth="0.5" />
      ))}
      {/* Zero circle */}
      <circle cx={cx} cy={cy} r={0.12 * radius} fill="none" stroke="#4b5563" strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Mid-line */}
      <line x1={cx - 2} y1={cy} x2={cx + 2} y2={cy} stroke="#4b5563" strokeWidth="0.5" />
      <line x1={cx} y1={cy - 2} x2={cx} y2={cy + 2} stroke="#4b5563" strokeWidth="0.5" />
      {/* Strategy B polygon */}
      {expB.length > 0 && (
        <polygon
          points={expB.map((e: FactorExposure, i: number) => { const p = getPoint(i, e.loading); return `${p.x},${p.y}`; }).join(' ')}
          fill="#3b82f6" fillOpacity="0.15" stroke="#3b82f6" strokeWidth="1.5" />
      )}
      {/* Strategy A polygon */}
      {expA.length > 0 && (
        <polygon
          points={expA.map((e: FactorExposure, i: number) => { const p = getPoint(i, e.loading); return `${p.x},${p.y}`; }).join(' ')}
          fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="1.5" />
      )}
      {/* Labels */}
      {factors.map((e: FactorExposure, i: number) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const lx = cx + (radius + 14) * Math.cos(angle);
        const ly = cy + (radius + 14) * Math.sin(angle);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={7} fill="#6b7280">
            {e.nameCN}
          </text>
        );
      })}
    </svg>
  );
};

interface StrategyComparerProps {
  className?: string;
}

export const StrategyComparer: React.FC<StrategyComparerProps> = ({ className }) => {
  const [stratA, setStratA] = useState(MOCK_STRATEGIES[0].id);
  const [stratB, setStratB] = useState(MOCK_STRATEGIES[1].id);
  const [synced, setSynced] = useState(true);

  const strategyA = useMemo(() => MOCK_STRATEGIES.find((s) => s.id === stratA)!, [stratA]);
  const strategyB = useMemo(() => MOCK_STRATEGIES.find((s) => s.id === stratB)!, [stratB]);

  const swap = useCallback(() => {
    setStratA(stratB);
    setStratB(stratA);
  }, [stratA, stratB]);

  // Scoring
  const score = useCallback((s: StrategySnapshot) =>
  s.sharpe * 30 + s.totalReturn * 100 - Math.abs(s.maxDrawdown) * 50 + s.winRate * 40,
  []);
  const scoreA = useMemo(() => score(strategyA), [strategyA, score]);
  const scoreB = useMemo(() => score(strategyB), [strategyB, score]);

  // Radar data
  const radarData = useMemo(() => {
    const metrics: {key: string;label: string;maxVal: number;get: (s: StrategySnapshot) => number;}[] = [
    { key: 'sharpe', label: 'Sharpe', maxVal: 3.5, get: (s) => s.sharpe },
    { key: 'return', label: 'components.returnRate', maxVal: 0.6, get: (s) => s.totalReturn },
    { key: 'drawdown', label: i18n.t('StrategyComparer.k4'), maxVal: 0.25, get: (s) => Math.abs(s.maxDrawdown) },
    { key: 'winRate', label: 'components.winRate', maxVal: 0.8, get: (s) => s.winRate }];

    return metrics.map((m) => ({
      label: m.label,
      valueA: m.get(strategyA),
      valueB: m.get(strategyB),
      maxVal: m.maxVal
    }));
  }, [strategyA, strategyB]);

  // Equity curve SVG
  const equitySvgA = useMemo(() => {
    const maxY = Math.max(...strategyA.equityCurve);
    const minY = Math.min(...strategyA.equityCurve);
    const range = maxY - minY || 1;
    return strategyA.equityCurve.
    map((v, i) => `${i / 99 * 100},${100 - (v - minY) / range * 80}`).
    join(' ');
  }, [strategyA]);

  const equitySvgB = useMemo(() => {
    const maxY = Math.max(...strategyB.equityCurve);
    const minY = Math.min(...strategyB.equityCurve);
    const range = maxY - minY || 1;
    return strategyB.equityCurve.
    map((v, i) => `${i / 99 * 100},${100 - (v - minY) / range * 80}`).
    join(' ');
  }, [strategyB]);

  // Metric comparison rows
  const metrics = useMemo(() => {
    const list: {label: string;valueA: number;valueB: number;format: (v: number) => string;invert?: boolean;}[] = [
    { label: 'Sharpe', valueA: strategyA.sharpe, valueB: strategyB.sharpe, format: (v) => v.toFixed(2) },
    { label: 'components.totalReturn', valueA: strategyA.totalReturn, valueB: strategyB.totalReturn, format: (v) => `${(v * 100).toFixed(1)}%` },
    { label: 'components.maxDrawdown', valueA: strategyA.maxDrawdown, valueB: strategyB.maxDrawdown, format: (v) => `${(v * 100).toFixed(1)}%`, invert: true },
    { label: 'components.winRate', valueA: strategyA.winRate, valueB: strategyB.winRate, format: (v) => `${(v * 100).toFixed(1)}%` },
    { label: i18n.t('StrategyComparer.k5'), valueA: strategyA.annualVol, valueB: strategyB.annualVol, format: (v) => `${(v * 100).toFixed(1)}%` },
    { label: 'Calmar', valueA: strategyA.calmarRatio, valueB: strategyB.calmarRatio, format: (v) => v.toFixed(1) },
    { label: 'components.profitLossRatio', valueA: strategyA.profitFactor, valueB: strategyB.profitFactor, format: (v) => v.toFixed(1) },
    { label: i18n.t('StrategyComparer.k6'), valueA: strategyA.tradeCount, valueB: strategyB.tradeCount, format: (v) => String(v) },
    { label: i18n.t('StrategyComparer.k7'), valueA: strategyA.avgHoldingDays, valueB: strategyB.avgHoldingDays, format: (v) => v.toFixed(1) },
    { label: i18n.t('StrategyComparer.k8'), valueA: scoreA, valueB: scoreB, format: (v) => v.toFixed(0) }];

    return list;
  }, [strategyA, strategyB, scoreA, scoreB]);

  const getWinner = (a: number, b: number, invert = false): 'a' | 'b' | 'tie' => {
    if (invert) return a < b ? 'a' : b < a ? 'b' : 'tie';
    return a > b ? 'a' : b > a ? 'b' : 'tie';
  };

  // ── R168 P2-12: Comparison Conclusion ─────────────────────────
  const conclusion = useMemo(() => generateConclusion(strategyA, strategyB), [strategyA, strategyB]);
  const nameA = strategyA.name.length > 12 ? strategyA.name.slice(0, 12) + '…' : strategyA.name;
  const nameB = strategyB.name.length > 12 ? strategyB.name.slice(0, 12) + '…' : strategyB.name;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 p-5 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">{i18n.t("StrategyComparer.r92_531c")}

            <span className="ml-2 px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-normal">
              Phase 6.0
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {strategyA.name} vs {strategyB.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <input type="checkbox" checked={synced} onChange={(e) => setSynced(e.target.checked)} className="accent-amber-500" />{i18n.t("StrategyComparer.r92_031b")}

          </label>
          <button onClick={swap} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 hover:text-gray-200">{i18n.t("StrategyComparer.r92_3a67")}

          </button>
        </div>
      </div>

      {/* Strategy selectors */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <span className="text-amber-400 font-bold text-sm">A</span>
          <select
            value={stratA}
            onChange={(e) => setStratA(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
            
            {MOCK_STRATEGIES.map((s) =>
            <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
            )}
          </select>
        </div>
        <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <span className="text-blue-400 font-bold text-sm">B</span>
          <select
            value={stratB}
            onChange={(e) => setStratB(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
            
            {MOCK_STRATEGIES.map((s) =>
            <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
            )}
          </select>
        </div>
      </div>

      {/* Equity curves side by side */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Strategy A */}
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400">A: {strategyA.name}</span>
            <span className={`text-[10px] ${strategyA.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(strategyA.totalReturn * 100).toFixed(1)}%
            </span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-24">
            <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={equitySvgA} />
          </svg>
          <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px]">
            <div><span className="text-gray-600">Sharpe</span><br /><span className="text-amber-400">{strategyA.sharpe.toFixed(1)}</span></div>
            <div><span className="text-gray-600">{i18n.t('StrategyComparer.k0')}</span><br /><span className="text-red-400">{(strategyA.maxDrawdown * 100).toFixed(0)}%</span></div>
            <div><span className="text-gray-600">{"components.winRate"}</span><br /><span className="text-gray-400">{(strategyA.winRate * 100).toFixed(0)}%</span></div>
          </div>
        </div>
        {/* Strategy B */}
        <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-400">B: {strategyB.name}</span>
            <span className={`text-[10px] ${strategyB.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(strategyB.totalReturn * 100).toFixed(1)}%
            </span>
          </div>
          <svg viewBox="0 0 100 100" className="w-full h-24">
            <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" points={equitySvgB} />
          </svg>
          <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px]">
            <div><span className="text-gray-600">Sharpe</span><br /><span className="text-blue-400">{strategyB.sharpe.toFixed(1)}</span></div>
            <div><span className="text-gray-600">{i18n.t('StrategyComparer.k1')}</span><br /><span className="text-red-400">{(strategyB.maxDrawdown * 100).toFixed(0)}%</span></div>
            <div><span className="text-gray-600">{"components.winRate"}</span><br /><span className="text-gray-400">{(strategyB.winRate * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      </div>

      {/* Radar chart + metrics table */}
      <div className="flex items-start gap-6">
        {/* Radar */}
        <div className="flex-shrink-0">
          <RadarChart data={radarData} size={140} />
          <div className="flex justify-center gap-4 mt-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> A</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> B</span>
          </div>
        </div>

        {/* ── R164 B3: Factor Exposure Radar ── */}
        {(strategyA.factorExposures || strategyB.factorExposures) && (
          <div className="flex-shrink-0">
            <div className="text-[10px] text-gray-500 mb-1 text-center">因子暴露</div>
            <FactorExposureRadar
              exposuresA={strategyA.factorExposures}
              exposuresB={strategyB.factorExposures}
              size={160}
            />
            <div className="flex justify-center gap-4 mt-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> A</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> B</span>
            </div>
          </div>
        )}

        {/* Metrics table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700/50">
                <th className="text-left py-1.5 pr-3"></th>
                <th className="text-right py-1.5 pr-3">A</th>
                <th className="text-right py-1.5 pr-3">B</th>
                <th className="text-right py-1.5">{i18n.t('StrategyComparer.k2')}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const w = getWinner(m.valueA, m.valueB, m.invert);
                return (
                  <tr key={m.label} className="border-b border-gray-700/20 text-gray-400">
                    <td className="py-1.5 pr-3 font-medium">{m.label}</td>
                    <td className={`py-1.5 pr-3 text-right font-mono ${w === 'a' ? 'text-amber-400 font-bold' : ''}`}>
                      {m.format(m.valueA)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right font-mono ${w === 'b' ? 'text-blue-400 font-bold' : ''}`}>
                      {m.format(m.valueB)}
                    </td>
                    <td className="py-1.5 text-right">
                      {w === 'a' ? <span className="text-amber-400">⬅ A</span> :
                      w === 'b' ? <span className="text-blue-400">B ➡</span> :
                      <span className="text-gray-600">—</span>}
                    </td>
                  </tr>);

              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── R168 P2-12: Comparison Conclusion ── */}
      <ConclusionCard conclusion={conclusion} nameA={nameA} nameB={nameB} />

    </div>);

};

export default StrategyComparer;