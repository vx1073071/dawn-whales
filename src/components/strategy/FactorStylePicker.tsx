// ── R172 B1: Three-Step Factor Decision Tree ─────────────────────────────
// Walks users through factor selection like a wizard:
//   Step 1: Pick investment style (5 options: growth/value/defensive/income/momentum)
//   Step 2: Pick market (HK/US/Crypto/All)
//   Step 3: AI-recommended factor combination with preview
//
// Profit: Step 3 shows top 3 factors free, "查看完整42因子组合" → 1U

import React, { useState, useMemo } from 'react';
import { DataTrustBadge } from '@/components/common/DataTrustBadge';

// ── Types ────────────────────────────────────────────────────────────────────

type InvestmentStyle = 'growth' | 'value' | 'defensive' | 'income' | 'momentum';

interface StyleOption {
  id: InvestmentStyle;
  label: string;
  emoji: string;
  description: string;
  recommendedFactors: string[];
  tip: string;
}

interface FactorRecommendation {
  factorId: string;
  nameCN: string;
  weight: number;
  reason: string;
  ic: number;
}

// ── Style definitions ────────────────────────────────────────────────────────

const STYLES: StyleOption[] = [
  {
    id: 'growth', label: '高成长', emoji: '📈',
    description: '追求高增长潜力，接受较高波动',
    recommendedFactors: ['MOM_12M', 'GROWTH', 'QUAL'],
    tip: '适合牛市中早期，关注科技/新经济板块',
  },
  {
    id: 'value', label: '深度价值', emoji: '💎',
    description: '寻找被低估的高质量资产',
    recommendedFactors: ['HML', 'QUAL', 'YIELD'],
    tip: '适合利率上升周期，关注金融/能源板块',
  },
  {
    id: 'defensive', label: '稳健防御', emoji: '🛡️',
    description: '降低波动，控制回撤为首要目标',
    recommendedFactors: ['VOL_60D', 'QUAL', 'YIELD'],
    tip: '适合熊市或震荡市，关注消费/公用事业',
  },
  {
    id: 'income', label: '股息收入', emoji: '💰',
    description: '追求稳定现金流和股息增长',
    recommendedFactors: ['YIELD', 'QUAL', 'VOL_60D'],
    tip: '适合低利率环境，关注高股息/REITs',
  },
  {
    id: 'momentum', label: '趋势动量', emoji: '🚀',
    description: '追随市场趋势，捕捉强势标的',
    recommendedFactors: ['MOM_12M', 'MKT', 'LIQ'],
    tip: '适合趋势明确的单边市场，及时止盈',
  },
];

const MARKETS = [
  { id: 'all', label: '不限制', emoji: '🌍' },
  { id: 'hk', label: '港股', emoji: '🇭🇰' },
  { id: 'us', label: '美股', emoji: '🇺🇸' },
  { id: 'crypto', label: '加密', emoji: '🔗' },
];

// ── Mock: generate recommendations based on selections ───────────────────────

function generateRecommendations(style: InvestmentStyle): FactorRecommendation[] {
  const baseMap: Record<string, FactorRecommendation[]> = {
    growth: [
      { factorId: 'MOM_12M', nameCN: '12月动量', weight: 40, reason: '成长股动量效应显著，IC=0.045', ic: 0.045 },
      { factorId: 'GROWTH', nameCN: '成长因子', weight: 35, reason: '营收增长率筛选，适合成长风格', ic: 0.038 },
      { factorId: 'QUAL', nameCN: '品质因子', weight: 25, reason: '过滤伪成长，确保质地优良', ic: 0.040 },
    ],
    value: [
      { factorId: 'HML', nameCN: '价值因子', weight: 40, reason: '低估值+高BP，经典价值策略', ic: 0.035 },
      { factorId: 'QUAL', nameCN: '品质因子', weight: 35, reason: '避免价值陷阱，选好公司', ic: 0.040 },
      { factorId: 'YIELD', nameCN: '股息率', weight: 25, reason: '高股息=价值信号+现金回报', ic: 0.028 },
    ],
    defensive: [
      { factorId: 'VOL_60D', nameCN: '60日低波', weight: 45, reason: '低波动异象，熊市防御核心', ic: -0.040 },
      { factorId: 'QUAL', nameCN: '品质因子', weight: 35, reason: '高质量企业更抗跌', ic: 0.040 },
      { factorId: 'YIELD', nameCN: '股息率', weight: 20, reason: '股息提供安全垫', ic: 0.028 },
    ],
    income: [
      { factorId: 'YIELD', nameCN: '股息率', weight: 50, reason: '股息率因子直接瞄准收入', ic: 0.028 },
      { factorId: 'QUAL', nameCN: '品质因子', weight: 30, reason: '确保分红的可持续性', ic: 0.040 },
      { factorId: 'VOL_60D', nameCN: '60日低波', weight: 20, reason: '降低分红股的波动', ic: -0.040 },
    ],
    momentum: [
      { factorId: 'MOM_12M', nameCN: '12月动量', weight: 45, reason: '动量为王，但注意拥挤风险', ic: 0.045 },
      { factorId: 'MKT', nameCN: '市场Beta', weight: 30, reason: '趋势行情中Beta放大收益', ic: 0.055 },
      { factorId: 'LIQ', nameCN: '流动性', weight: 25, reason: '动量策略需流动性支持换手', ic: 0.025 },
    ],
  };
  return baseMap[style] || baseMap.growth;
}

// ── Component ────────────────────────────────────────────────────────────────

export const FactorStylePicker: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [style, setStyle] = useState<InvestmentStyle | null>(null);
  const [market, setMarket] = useState('all');
  const [showFull, setShowFull] = useState(false);

  const selectedStyle = STYLES.find((s) => s.id === style);
  const recommendations = useMemo(
    () => style ? generateRecommendations(style) : [],
    [style],
  );

  const totalIC = recommendations.reduce((s, r) => s + r.ic * r.weight, 0) / 100;

  const handleStyleSelect = (sid: InvestmentStyle) => {
    setStyle(sid);
    setStep(2);
  };

  const handleMarketSelect = (mid: string) => {
    setMarket(mid);
    setStep(3);
  };

  return (
    <div className="p-6 space-y-5 bg-deep min-h-full">
      <h1 className="text-2xl font-bold text-white">🧭 因子风格选择器</h1>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-xs">
        {[1, 2, 3].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                step >= s
                  ? 'bg-[#C9A046] text-black'
                  : 'bg-white/5 text-gray-600'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-0.5 rounded transition-all ${
                  step > s ? 'bg-[#C9A046]' : 'bg-white/5'
                }`}
              />
            )}
          </React.Fragment>
        ))}
        <span className="ml-2 text-gray-500">
          {step === 1 ? '选择风格' : step === 2 ? '选择市场' : '查看推荐'}
        </span>
      </div>

      {/* Step 1: Style selection */}
      {step === 1 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => handleStyleSelect(s.id)}
              className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-left hover:bg-white/[0.06] hover:border-[#C9A046]/30 transition-all group"
            >
              <div className="text-2xl mb-2">{s.emoji}</div>
              <div className="text-sm font-bold text-white mb-1">{s.label}</div>
              <div className="text-[10px] text-gray-500 leading-relaxed mb-2">
                {s.description}
              </div>
              <div className="text-[9px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                {s.tip}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Market selection */}
      {step === 2 && selectedStyle && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
            <span className="text-sm text-gray-400">已选风格: </span>
            <span className="text-sm text-white font-bold">
              {selectedStyle.emoji} {selectedStyle.label}
            </span>
            <button
              onClick={() => setStep(1)}
              className="ml-2 text-[10px] text-gray-600 hover:text-gray-400"
            >
              修改
            </button>
          </div>
          <h2 className="text-sm text-gray-300">第2步: 选择你的目标市场</h2>
          <div className="grid grid-cols-4 gap-3">
            {MARKETS.map((m) => (
              <button
                key={m.id}
                onClick={() => handleMarketSelect(m.id)}
                className={`rounded-xl p-4 text-center border transition-all ${
                  market === m.id
                    ? 'bg-[#C9A046]/10 border-[#C9A046]/30'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
                }`}
              >
                <div className="text-2xl mb-2">{m.emoji}</div>
                <div className="text-xs text-white font-medium">{m.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && selectedStyle && (
        <div className="space-y-4">
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-xs text-gray-400">
            <span>{selectedStyle.emoji} {selectedStyle.label}</span>
            <span className="mx-2">·</span>
            <span>{MARKETS.find((m) => m.id === market)?.emoji} {MARKETS.find((m) => m.id === market)?.label}</span>
            <button onClick={() => setStep(1)} className="ml-2 text-gray-600 hover:text-gray-400">
              重新选择
            </button>
          </div>

          <h2 className="text-sm text-gray-300">
            第3步: AI推荐因子组合
            <span className="ml-2 text-[10px] text-gray-600">
              预期加权IC: {totalIC.toFixed(4)}
            </span>
          </h2>

          {/* Free tier: Top 3 */}
          <div className="space-y-3">
            {recommendations.slice(0, 3).map((r, i) => (
              <div key={r.factorId} className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[#C9A046] text-lg font-bold mr-2">#{i + 1}</span>
                    <span className="text-white font-bold">{r.nameCN}</span>
                    <span className="ml-2 text-[10px] text-gray-500">权重 {r.weight}%</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    IC: {r.ic.toFixed(4)}
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2 mb-1">
                  <div
                    className="bg-[#C9A046] h-2 rounded-full transition-all"
                    style={{ width: `${r.weight}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500">{r.reason}</p>
              </div>
            ))}
          </div>

          {/* Premium tier: Full 42 factors */}
          <div className="bg-gradient-to-r from-[#C9A046]/10 to-transparent rounded-xl p-4 border border-[#C9A046]/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#C9A046] font-bold">
                  🔓 查看完整 42 因子组合
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  含 IC 排序表、衰减曲线、相关性矩阵、AI 详细推荐报告
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#C9A046] text-black hover:bg-[#D4A853] transition-all"
                onClick={() => setShowFull(true)}
              >
                1 USDT 解锁完整报告
              </button>
            </div>
            {showFull && (
              <div className="mt-3 pt-3 border-t border-[#C9A046]/10 text-[10px] text-gray-400">
                ✅ 支付模拟完成 — 完整42因子报告已解锁（实际集成付费网关后生效）
              </div>
            )}
          </div>

          {/* Data trust */}
          <DataTrustBadge
            source="SIMULATED"
            provider="factor-research-engine"
            freshness="基于历史IC加权"
            size="sm"
          />
        </div>
      )}
    </div>
  );
};

export default FactorStylePicker;
