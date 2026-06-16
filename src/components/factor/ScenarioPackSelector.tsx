// @ts-nocheck
// ── R185 ML P1-02: ScenarioPackSelector — 8场景包一键选择器 ────────────
// Based on QClaw R184 design spec Part B (8 scenario packs: 4 L1 + 3 L2 + 1 L3).
// Each pack shows: icon, name, story snippet, historical stats, current signal.
// One-click applies the pack's factor composition with preset weights.
//
// Design:
// - Grid layout: 4 columns on desktop, 2 on tablet, 1 on mobile
// - Color coding by level: L1=emerald border, L2=blue border, L3=purple border
// - Signal light indicator per pack (aggregated from constituent factors)
// - Historical Sharpe/MaxDD badges
// - Hover: story expansion + factor list

import React, { useState, useMemo } from 'react';
import { FactorSignalLight, type SignalColor } from './FactorSignalLight';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScenarioPack {
  id: string;
  name: string;
  nameEN: string;
  icon: string;
  level: 'L1' | 'L2' | 'L3';
  markets: string[];
  factorIds: string[];
  factorNames: string[];
  weights: Record<string, number>;
  story: string;
  storyShort: string;
  useCase: string;
  signalColor: SignalColor;
  historicalSharpe?: number;
  historicalMaxDD?: number;
  bestYear?: string;
  worstYear?: string;
}

interface ScenarioPackSelectorProps {
  packs: ScenarioPack[];
  activePackId?: string;
  onSelect: (pack: ScenarioPack) => void;
  onApply: (pack: ScenarioPack) => void;
  className?: string;
}

// ── Level Badge ──────────────────────────────────────────────────────────────

const LevelBadge: React.FC<{ level: 'L1' | 'L2' | 'L3' }> = ({ level }) => {
  const config = {
    L1: { label: '常⽤', emoji: '🌱', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    L2: { label: '进阶', emoji: '🌿', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    L3: { label: '实验', emoji: '🌳', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  }[level];

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
      style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.color}30` }}
    >
      {config.emoji} {config.label}
    </span>
  );
};

// ── Pack Card ────────────────────────────────────────────────────────────────

const PackCard: React.FC<{
  pack: ScenarioPack;
  isActive: boolean;
  onSelect: () => void;
  onApply: () => void;
}> = ({ pack, isActive, onSelect, onApply }) => {
  const [showStory, setShowStory] = useState(false);
  const levelColors = {
    L1: { border: '#22c55e', glow: 'rgba(34,197,94,0.06)' },
    L2: { border: '#3b82f6', glow: 'rgba(59,130,246,0.06)' },
    L3: { border: '#a855f7', glow: 'rgba(168,85,247,0.06)' },
  };
  const lc = levelColors[pack.level];

  return (
    <div
      className={`relative rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer ${
        isActive ? 'border-white/30 shadow-xl scale-[1.02]' : 'border-white/5 hover:border-white/15'
      }`}
      style={{
        backgroundColor: isActive ? lc.glow : 'rgba(255,255,255,0.02)',
        borderColor: isActive ? lc.border : undefined,
      }}
      onClick={onSelect}
      onMouseEnter={() => setShowStory(true)}
      onMouseLeave={() => setShowStory(false)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{pack.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">{pack.name}</h4>
                <LevelBadge level={pack.level} />
              </div>
              <p className="text-[10px] text-gray-600 font-mono">{pack.nameEN}</p>
            </div>
          </div>
          {/* Aggregate signal */}
          <FactorSignalLight
            data={{ color: pack.signalColor, label: '' }}
            compact
            animated={pack.signalColor !== 'gray'}
          />
        </div>

        {/* Story snippet (expand on hover) */}
        <div
          className={`text-[10px] leading-relaxed transition-all duration-300 ${
            showStory ? 'max-h-[150px] opacity-100' : 'max-h-[40px] opacity-60'
          } overflow-hidden`}
        >
          <p className="text-gray-400">{showStory ? pack.story : pack.storyShort}</p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
          {pack.historicalSharpe !== undefined && (
            <span className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-600">Sharpe</span>
              <span className={`font-mono font-bold ${
                pack.historicalSharpe >= 1.0 ? 'text-green-400' :
                pack.historicalSharpe >= 0.7 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {pack.historicalSharpe.toFixed(2)}
              </span>
            </span>
          )}
          {pack.historicalMaxDD !== undefined && (
            <span className="flex items-center gap-1 text-[10px]">
              <span className="text-gray-600">MaxDD</span>
              <span className={`font-mono font-bold ${
                Math.abs(pack.historicalMaxDD) <= 20 ? 'text-green-400' :
                Math.abs(pack.historicalMaxDD) <= 35 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {pack.historicalMaxDD}%
              </span>
            </span>
          )}
          {pack.bestYear && (
            <span className="text-[9px] text-green-400/60 font-mono">{pack.bestYear}</span>
          )}
        </div>

        {/* Factor chips */}
        <div className="flex flex-wrap gap-1 mt-2">
          {pack.factorNames.slice(0, 4).map((name) => (
            <span key={name} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-500">
              {name}
            </span>
          ))}
          {pack.factorNames.length > 4 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-600">
              +{pack.factorNames.length - 4}
            </span>
          )}
        </div>

        {/* Apply button (visible when active) */}
        {isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onApply(); }}
            className="w-full mt-3 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              backgroundColor: lc.border + '20',
              color: lc.border,
              border: `1px solid ${lc.border}40`,
            }}
          >
            ⚡ 应用此场景包 ({pack.factorIds.length}因子)
          </button>
        )}
      </div>

      {/* Market badges */}
      <div className="absolute top-3 right-3 flex gap-1">
        {pack.markets.map((m) => {
          const flags: Record<string, string> = { US: '🇺🇸', HK: '🇭🇰', CRYPTO: '🪙' };
          return (
            <span key={m} className="text-[10px] opacity-60" title={m}>
              {flags[m] || m}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const ScenarioPackSelector: React.FC<ScenarioPackSelectorProps> = ({
  packs,
  activePackId,
  onSelect,
  onApply,
  className = '',
}) => {
  // Group by level
  const grouped = useMemo(() => {
    const groups: Record<string, ScenarioPack[]> = { L1: [], L2: [], L3: [] };
    for (const p of packs) {
      groups[p.level].push(p);
    }
    return groups;
  }, [packs]);

  if (packs.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-gray-600">
        暂无场景包 — 请先添加因子数据
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">
          🎯 场景化因子包
        </h3>
        <span className="text-[10px] text-gray-600">
          {packs.length}个场景包 · 点击选择 · 一键应用
        </span>
      </div>

      {/* Grid: 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            isActive={pack.id === activePackId}
            onSelect={() => onSelect(pack)}
            onApply={() => onApply(pack)}
          />
        ))}
      </div>

      {/* Level legend */}
      <div className="mt-4 pt-3 border-t border-white/5 flex gap-4 text-[9px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} /> L1 常⽤ · 新手友好
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} /> L2 进阶 · 专业交易者
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#a855f7' }} /> L3 实验 · 前沿探索
        </span>
      </div>
    </div>
  );
};

// ── Built-in 8 scenario packs (from QClaw R184 design spec) ──────────────────

export const DEFAULT_SCENARIO_PACKS: ScenarioPack[] = [
  // ⛏️ L1: 价值掘金
  {
    id: 'value-mining',
    name: '价值掘金', nameEN: 'Value Mining', icon: '⛏️',
    level: 'L1', markets: ['HK', 'US'],
    factorIds: ['HML', 'QUAL', 'YIELD', 'RMW', 'CMA'],
    factorNames: ['价值(HML)', '品质(QUAL)', '股息(YIELD)', '盈利(RMW)', '投资(CMA)'],
    weights: { HML: 0.30, QUAL: 0.25, YIELD: 0.20, RMW: 0.15, CMA: 0.10 },
    story: '1998年亚洲金融风暴后，港股遍地打折货。不追涨杀跌，专挑低市净率+高股息+高盈利质量的人，3年赚了200%+。巴菲特的老师格雷厄姆说："市场短期是投票机，长期是称重机。"',
    storyShort: '找最被低估的好公司。不跟风，等称重。',
    useCase: '熊市/回调 → 最适合。恐慌时找到被错杀的好公司。',
    signalColor: 'yellow', historicalSharpe: 1.12, historicalMaxDD: -25,
    bestYear: '2022 +18%', worstYear: '2021 -15%',
  },
  // 🦅 L1: 成长猎手
  {
    id: 'growth-hunter',
    name: '成长猎手', nameEN: 'Growth Hunter', icon: '🦅',
    level: 'L1', markets: ['US'],
    factorIds: ['GROWTH', 'MOM_12M', 'EMA_12_26', 'OBV'],
    factorNames: ['成⻓(GROWTH)', '动量12M', 'MACD(EMA)', '量价(OBV)'],
    weights: { GROWTH: 0.35, MOM_12M: 0.30, EMA_12_26: 0.20, OBV: 0.15 },
    story: '2022年10月，NVIDIA股价跌到$108。ChatGPT还没发布。但信号在闪烁：研发投入28%（行业最高），AI芯片订单悄悄增加，机构持仓不降反升。成长猎手找的就是"正在长大"的未来巨头。',
    storyShort: '找正在长大的未来巨头。不是已经长大的。',
    useCase: '牛市/上升趋势 → 强者恒强。',
    signalColor: 'green', historicalSharpe: 1.28, historicalMaxDD: -42,
    bestYear: '2023 +58%', worstYear: '2022 -42%',
  },
  // 🔄 L1: 震荡轮动
  {
    id: 'range-swing',
    name: '震荡轮动', nameEN: 'Range Swing', icon: '🔄',
    level: 'L1', markets: ['HK', 'US'],
    factorIds: ['RSI_14', 'BOLL', 'ATR_14', 'KDJ'],
    factorNames: ['RSI', '布林带', 'ATR', 'KDJ'],
    weights: { RSI_14: 0.30, BOLL: 0.25, ATR_14: 0.25, KDJ: 0.20 },
    story: '2023年港股在18000-22000之间来回震荡了8个月。追涨的被套，抄底的再跌。只有做震荡的人赚到了钱。布林带说"太贵了"→卖，RSI说"太便宜了"→买。不是猜方向，是用概率吃饭。',
    storyShort: '横盘震荡专精。RSI+布林带双确认买卖。',
    useCase: '横盘/无趋势 → 港股2023-2025常见。',
    signalColor: 'yellow', historicalSharpe: 0.95, historicalMaxDD: -18,
    bestYear: '2023 +22%', worstYear: '2024 -12%',
  },
  // 🛡️ L1: 稳健防守
  {
    id: 'defense',
    name: '稳健防守', nameEN: 'Defense Mode', icon: '🛡️',
    level: 'L1', markets: ['HK', 'US'],
    factorIds: ['QUAL', 'YIELD', 'VOL_60D', 'HML'],
    factorNames: ['品质(QUAL)', '股息(YIELD)', '低波(VOL)', '价值(HML)'],
    weights: { QUAL: 0.30, YIELD: 0.25, VOL_60D: 0.25, HML: 0.20 },
    story: '2018年贸易战恒指跌-14%，有些股票只跌了-3%。共同点：低负债、稳定现金流、高股息、高盈利质量。防守模式不是让你不亏钱，是让你亏得比大盘少。活下来=下一轮还有本金。',
    storyShort: '亏得比大盘少就是赢。活下来迎接下一轮。',
    useCase: '熊市/高波动/不确定 → 最适用。',
    signalColor: 'yellow', historicalSharpe: 0.88, historicalMaxDD: -12,
    bestYear: '2022 -8%(大盘-20%)', worstYear: '2020 +15%(大盘+45%)',
  },
  // 🐂 L2: 牛市进攻
  {
    id: 'bull-charge',
    name: '牛市进攻', nameEN: 'Bull Charge', icon: '🐂',
    level: 'L2', markets: ['HK', 'US'],
    factorIds: ['MOM_12M', 'MOM_1M', 'GROWTH', 'ADX', 'EMA_12_26'],
    factorNames: ['动量12M', '动量1M', '成⻓', 'ADX', 'MACD'],
    weights: { MOM_12M: 0.25, MOM_1M: 0.15, GROWTH: 0.25, ADX: 0.15, EMA_12_26: 0.20 },
    story: 'CANSLIM发明人O\'Neil发现95%超级牛股在爆发前都有共同特征。牛市进攻就是CANSLIM简化版：找最强动量+最好基本面+最受机构青睐。牛市里弱者被淘汰，强者更强。',
    storyShort: '牛市中追最强的。CANSLIM简化版。',
    useCase: '确认牛市(指数>年线+20%)。',
    signalColor: 'green', historicalSharpe: 1.52, historicalMaxDD: -35,
    bestYear: '2024 +48%', worstYear: '2022 -32%',
  },
  // 📈 L2: 加密趋势
  {
    id: 'crypto-trend',
    name: '加密趋势', nameEN: 'Crypto Trend', icon: '📈',
    level: 'L2', markets: ['CRYPTO'],
    factorIds: ['CRYPTO_MVRV', 'CRYPTO_NVT', 'CRYPTO_EXCHANGE_FLOW', 'CRYPTO_FUNDING', 'CRYPTO_OI_DELTA', 'CRYPTO_ACTIVE_ADDR', 'MOM_12M'],
    factorNames: ['MVRV', 'NVT', '交易所流', '资金费率', 'OI', '活跃地址', '动量'],
    weights: { CRYPTO_MVRV: 0.20, CRYPTO_NVT: 0.15, CRYPTO_EXCHANGE_FLOW: 0.15, CRYPTO_FUNDING: 0.15, CRYPTO_OI_DELTA: 0.15, CRYPTO_ACTIVE_ADDR: 0.10, MOM_12M: 0.10 },
    story: '加密市场Alpha来源独特：链上数据公开、不可篡改、实时。MVRV告诉你大家的平均成本，交易所储备告诉你抛压，稳定币供应告诉你购买力。传统股市看不到这些。你不需要认识做市商，只需要会读链。',
    storyShort: '链上数据=散户的内幕信息。MVRV+交易所+费率。',
    useCase: '加密趋势跟踪 → 周级别中长期。',
    signalColor: 'yellow', historicalSharpe: 1.42, historicalMaxDD: -48,
    bestYear: '2023 +220%', worstYear: '2022 -45%',
  },
  // 🌈 L2: 全天候均衡
  {
    id: 'all-weather',
    name: '全天候均衡', nameEN: 'All Weather', icon: '🌈',
    level: 'L2', markets: ['HK', 'US'],
    factorIds: ['MOM_12M', 'HML', 'QUAL', 'SIZE', 'VOL_60D', 'YIELD', 'LIQ'],
    factorNames: ['动量', '价值', '品质', '小盘', '低波', '股息', '流动性'],
    weights: { MOM_12M: 0.20, HML: 0.15, QUAL: 0.15, SIZE: 0.15, VOL_60D: 0.15, YIELD: 0.10, LIQ: 0.10 },
    story: '桥水Dalio说："全天候不是预测天气，是无论什么天气都能活下来。"同时配置增长/价值/质量/小盘/低波/股息/流动性。牛市赚趋势的钱，熊市赚价值的钱。不会大赚特赚，也不会大亏特亏。这是"睡得着觉"的策略。',
    storyShort: '同时配置7大因子。无论什么市场都能活下来。',
    useCase: '不确定市场方向 → 任何时间适用。',
    signalColor: 'green', historicalSharpe: 1.18, historicalMaxDD: -20,
    bestYear: '2024 +22%', worstYear: '2022 -15%',
  },
  // ⚡ L3: 衍生品信号
  {
    id: 'derivatives-signal',
    name: '衍生品信号', nameEN: 'Derivatives Signal', icon: '⚡',
    level: 'L3', markets: ['HK', 'US'],
    factorIds: ['US_VIX', 'OPTION_PCR', 'US_SHORT_RATIO', 'CRYPTO_LIQUIDATIONS'],
    factorNames: ['VIX', '期权PCR', '做空比率', '清算数据'],
    weights: { US_VIX: 0.30, OPTION_PCR: 0.25, US_SHORT_RATIO: 0.25, CRYPTO_LIQUIDATIONS: 0.20 },
    story: '2021年GameStop：做市商卖出了120%流通股的期权。散户买Call→做市商买正股对冲→股价涨→更多人买Call...Gamma Squeeze无限循环。这些"二次信号"往往走在股价前面2-3天，因为衍生品价格发现了"将要发生的事"。',
    storyShort: '衍生品的二次信号。超前股价2-3天。高度实验性。',
    useCase: '短线辅助(1-5天) → 不适用于长期配置。',
    signalColor: 'red', historicalSharpe: 0.72, historicalMaxDD: -52,
    bestYear: '2024 +35%', worstYear: '2023 -28%',
  },
];

export default ScenarioPackSelector;
