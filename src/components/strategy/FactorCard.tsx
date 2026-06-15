// ── R168 P2-01 + R184 P0-02: FactorCard with Level Badge + Signal Light ──
// Each factor card shows name + IC + signal indicator + level badge.
// Hovering reveals a popover with: factor definition, calculation method,
// typical IC range, best market, usage tips, and level info.
// Level badge: 🌱 L1 (essential) / 🌿 L2 (advanced) / 🌳 L3 (expert).
// Signal light: green/red/gray dot with glow animation.

import React, { useState, useRef, useEffect } from 'react';
import type { FactorLevel } from '../factor/FactorLevelSelector';

// ── Types ────────────────────────────────────────────────────────────────────

interface FactorEncyclopedia {
  factorId: string;
  nameCN: string;
  category: string;           // 'momentum' | 'value' | 'quality' | 'volatility' | 'macro'
  definition: string;
  calculation: string;
  typicalICRange: string;
  bestMarket: string;
  usageTips: string;
  pros: string[];
  cons: string[];
}

// ── Encyclopedia Data (240 factors, showing top 8 for UI) ────────────────────

const ENCYCLOPEDIA: Record<string, FactorEncyclopedia> = {
  MKT: {
    factorId: 'MKT', nameCN: '市场Beta', category: 'macro',
    definition: '衡量个股/策略对整体市场波动的敏感度。Beta=1表示与市场同步，>1表示放大市场波动，<1表示相对防御。',
    calculation: 'Cov(策略收益, 市场收益) / Var(市场收益)，使用60日滚动窗口计算。',
    typicalICRange: '0.04 ~ 0.07',
    bestMarket: '趋势明显的单边市场，震荡市Beta因子失效。',
    usageTips: '牛市时增配高Beta，熊市时降Beta或对冲。不宜单独使用，需搭配Alpha因子。',
    pros: ['市场主要驱动力', '计算简单稳定', '解释力强(R²=30-60%)'],
    cons: ['同质化严重', '超额收益有限', '尾部风险暴露'],
  },
  MOM_12M: {
    factorId: 'MOM_12M', nameCN: '12月动量', category: 'momentum',
    definition: '过去12个月扣除最近1个月的累计收益。动量效应指过去表现好的股票未来短期继续跑赢。',
    calculation: '(Price_t - Price_{t-12}) / Price_{t-12}，跳过最近1个月避免短期反转。',
    typicalICRange: '0.03 ~ 0.06',
    bestMarket: '趋势延续的市场，尤其适合科技股和成长股。',
    usageTips: '关注动量崩溃风险——均值回归时动量因子会大幅回撤。搭配低波因子可缓冲。',
    pros: ['A股/港股美股均有效', '超额收益显著', '与价值因子低相关'],
    cons: ['动量崩溃风险', '高换手率', '拥挤度上升快'],
  },
  HML: {
    factorId: 'HML', nameCN: '价值因子', category: 'value',
    definition: '高账面市值比(BP)股票减去低BP股票的收益。价值股长期跑赢成长股(价值溢价)。',
    calculation: 'BP = 每股净资产/股价。按BP排序，做多Top30%做空Bottom30%。',
    typicalICRange: '0.02 ~ 0.05',
    bestMarket: '利率上升期、经济复苏期、价值回归周期。',
    usageTips: '价值因子与动量因子呈负相关，组合使用可降低波动。当前低利率环境压制价值因子。',
    pros: ['长期学术验证', '低波动', '与动量互补'],
    cons: ['近年表现低迷', '价值陷阱', '周期依赖'],
  },
  VOL_60D: {
    factorId: 'VOL_60D', nameCN: '60日低波', category: 'volatility',
    definition: '过去60个交易日收益率的标准差。低波动异象：低波动股票长期风险调整后收益高于高波动股票。',
    calculation: 'StdDev(日收益率, 60日) × sqrt(252)，年化波动率。',
    typicalICRange: '-0.03 ~ -0.05 (负相关，IC为负但有效)',
    bestMarket: '震荡市和熊市中防御性最强。',
    usageTips: '绝对IC为负是正常的——低波动=好。可做对冲工具，减少组合尾部风险。',
    pros: ['熊市防御', '低回撤', '风险调整收益高'],
    cons: ['牛市跑输', '可能错过反弹', '容量有限'],
  },
  QUAL: {
    factorId: 'QUAL', nameCN: '品质因子', category: 'quality',
    definition: '综合衡量公司盈利质量：高ROE+低负债率+稳定盈利增长。优质公司长期复合收益更高。',
    calculation: '综合评分 = ROE(40%) + 毛利率稳定性(30%) + 负债率倒数(20%) + 现金流/利润(10%)。',
    typicalICRange: '0.03 ~ 0.05',
    bestMarket: '经济下行期、信用收缩期，优质公司更抗跌。',
    usageTips: '品质因子是长期持有的最佳伙伴。结合价值因子可捕捉"合理价格买优质公司"。',
    pros: ['长期稳定', '低回撤', '复利效应'],
    cons: ['增长缓慢', '牛市可能落后', '定义主观'],
  },
  SMB: {
    factorId: 'SMB', nameCN: '小盘因子', category: 'macro',
    definition: '小市值股票减去大市值股票的收益。小盘股长期存在溢价效应。',
    calculation: '按总市值排序，小盘组合(最小30%) - 大盘组合(最大30%)的收益差。',
    typicalICRange: '0.01 ~ 0.03',
    bestMarket: '流动性充裕、风险偏好上升的市场环境。',
    usageTips: '小盘股波动大，建议配置上限20%。注册制下小盘供给增加，溢价可能收窄。',
    pros: ['长期溢价', '与大盘低相关', '并购溢价'],
    cons: ['高波动', '流动性差', '幸存者偏差'],
  },
  LIQ: {
    factorId: 'LIQ', nameCN: '流动性因子', category: 'macro',
    definition: '日均成交额/换手率衡量股票的流动性。流动性好的股票交易成本低，承载资金量更大。',
    calculation: 'log(日均成交额 × 换手率)，20日滚动平均后标准化。',
    typicalICRange: '0.02 ~ 0.04',
    bestMarket: 'US、HK、JP、TW大型股市场，对大盘股策略尤为重要。',
    usageTips: '流动性因子主要用于风控而非Alpha。大资金策略的硬约束。结合动量可提升执行效率。',
    pros: ['交易成本低', '容量大', '执行效率高'],
    cons: ['超额有限', '机构拥挤', '信号弱'],
  },
  YIELD: {
    factorId: 'YIELD', nameCN: '股息率因子', category: 'value',
    definition: '过去12个月每股股息/当前股价。高股息股票在低利率环境下有类债券属性。',
    calculation: 'TTM股息/股价，剔除一次性特别股息。',
    typicalICRange: '0.01 ~ 0.03',
    bestMarket: '低利率、经济平稳期。利率上行时高股息吸引力下降。',
    usageTips: '适合防御型配置，年化股息+资本增值双收益。注意避免"股息陷阱"(高股息因股价大跌)。',
    pros: ['现金回报', '防御属性', '低波动'],
    cons: ['成长受限', '利率敏感', '股息陷阱'],
  },
};

// ── Popover ──────────────────────────────────────────────────────────────────

interface PopoverPosition {
  top: number;
  left: number;
}

const FactorPopover: React.FC<{
  factor: FactorEncyclopedia;
  position: PopoverPosition;
  onClose: () => void;
}> = ({ factor, position, onClose }) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const categoryLabels: Record<string, string> = {
    momentum: '动量类', value: '价值类', quality: '品质类',
    volatility: '波动类', macro: '宏观类',
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[340px] bg-[#1a1a25] border border-white/10 rounded-xl shadow-2xl p-4 text-xs"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-white">{factor.nameCN}</h4>
        <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
          {categoryLabels[factor.category] || factor.category}
        </span>
      </div>

      {/* Definition */}
      <div className="mb-3">
        <span className="text-gray-500 font-medium">📖 定义</span>
        <p className="text-gray-300 mt-0.5 leading-relaxed">{factor.definition}</p>
      </div>

      {/* Calculation */}
      <div className="mb-3">
        <span className="text-gray-500 font-medium">🔢 计算方式</span>
        <p className="text-gray-400 mt-0.5 font-mono text-[10px] leading-relaxed">{factor.calculation}</p>
      </div>

      {/* IC Range */}
      <div className="mb-3">
        <span className="text-gray-500 font-medium">📊 典型IC范围</span>
        <p className="text-[#C9A046] mt-0.5 font-mono">{factor.typicalICRange}</p>
      </div>

      {/* Best Market */}
      <div className="mb-3">
        <span className="text-gray-500 font-medium">🌤 最佳市场</span>
        <p className="text-gray-300 mt-0.5">{factor.bestMarket}</p>
      </div>

      {/* Usage Tips */}
      <div className="mb-3">
        <span className="text-gray-500 font-medium">💡 使用建议</span>
        <p className="text-gray-300 mt-0.5">{factor.usageTips}</p>
      </div>

      {/* Pros & Cons */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-emerald-400 text-[10px] font-medium">✅ 优点</span>
          <ul className="mt-1 space-y-0.5">
            {factor.pros.map((p, i) => (
              <li key={i} className="text-gray-400 text-[10px]">{p}</li>
            ))}
          </ul>
        </div>
        <div>
          <span className="text-red-400 text-[10px] font-medium">⚠️ 局限</span>
          <ul className="mt-1 space-y-0.5">
            {factor.cons.map((c, i) => (
              <li key={i} className="text-gray-400 text-[10px]">{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// ── Factor Card ──────────────────────────────────────────────────────────────

interface FactorCardProps {
  factorId: string;
  nameCN?: string;
  ic?: number;
  signal?: 'up' | 'down' | 'neutral';
  size?: 'sm' | 'md';
}

export const FactorCard: React.FC<FactorCardProps & {
  /** R184: Factor tier level */
  level?: FactorLevel;
  /** R184: Whether to show level badge */
  showLevel?: boolean;
  /** R184: Show animated signal glow */
  showSignalGlow?: boolean;
}> = ({
  factorId,
  nameCN,
  ic,
  signal = 'neutral',
  size = 'md',
  level,
  showLevel = true,
  showSignalGlow = true,
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition>({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const encyclopedia = ENCYCLOPEDIA[factorId];
  const displayName = nameCN || encyclopedia?.nameCN || factorId;
  const isSm = size === 'sm';

  const signalColors: Record<string, string> = {
    up: '#22c55e', down: '#ef4444', neutral: '#6b7280',
  };

  const signalLabels: Record<string, string> = {
    up: '看多', down: '看空', neutral: '中性',
  };

  const handleHover = () => {
    if (!encyclopedia) return;
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 360),
      });
    }
    setShowPopover(true);
  };

  const levelBadge = level ? {
    L1: { emoji: '🌱', label: '常⽤', color: '#22c55e' },
    L2: { emoji: '🌿', label: '进阶', color: '#f59e0b' },
    L3: { emoji: '🌳', label: '实验', color: '#a855f7' },
  }[level] : null;

  return (
    <>
      <div
        ref={cardRef}
        className={`bg-white/[0.03] rounded-lg border border-white/5 ${
          isSm ? 'p-2' : 'p-3'
        } cursor-pointer hover:bg-white/[0.06] hover:border-[#C9A046]/30 transition-all group relative`}
        onMouseEnter={handleHover}
        onMouseLeave={() => setShowPopover(false)}
      >
        {/* R184: Level badge (top-left micro tag) */}
        {showLevel && levelBadge && (
          <div
            className="absolute -top-1.5 -left-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5 z-10"
            style={{
              backgroundColor: levelBadge.color + '25',
              color: levelBadge.color,
              border: `1px solid ${levelBadge.color}40`,
            }}
            title={`${levelBadge.label}因子 — ${level}`}
          >
            <span className="text-[8px]">{levelBadge.emoji}</span>
            {levelBadge.label}
          </div>
        )}

        <div className="flex items-center justify-between mb-1">
          <span className={`font-medium ${isSm ? 'text-[10px]' : 'text-xs'} text-white`}>
            {displayName}
            {encyclopedia && (
              <span className="ml-1 text-gray-600 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                ℹ️
              </span>
            )}
          </span>
          {/* R184: Signal light with animated glow */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <div
                className={`w-2 h-2 rounded-full ${
                  showSignalGlow && signal !== 'neutral'
                    ? signal === 'up' ? 'animate-pulse' : ''
                    : ''
                }`}
                style={{
                  backgroundColor: signalColors[signal],
                  boxShadow: showSignalGlow && signal !== 'neutral'
                    ? `0 0 6px ${signalColors[signal]}80`
                    : 'none',
                }}
              />
              {(signal === 'up' || signal === 'down') && showSignalGlow && (
                <div
                  className="absolute inset-0 rounded-full animate-ping opacity-20"
                  style={{ backgroundColor: signalColors[signal] }}
                />
              )}
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium`}
              style={{
                backgroundColor: signalColors[signal] + '20',
                color: signalColors[signal],
                border: `1px solid ${signalColors[signal]}30`,
              }}
            >
              {signalLabels[signal]}
            </span>
          </div>
        </div>
        {ic !== undefined && (
          <div className={`font-mono ${isSm ? 'text-sm' : 'text-lg'} font-bold ${
            ic >= 0.03 ? 'text-green-400' : ic > 0 ? 'text-green-400/70' : 'text-red-400'
          }`}>
            IC: {ic.toFixed(4)}
          </div>
        )}
        {encyclopedia && (
          <div className="text-[10px] text-gray-600 mt-1 truncate group-hover:text-gray-400 transition-colors">
            {encyclopedia.definition.substring(0, isSm ? 30 : 50)}...
          </div>
        )}
      </div>

      {showPopover && encyclopedia && (
        <FactorPopover
          factor={encyclopedia}
          position={popoverPos}
          onClose={() => setShowPopover(false)}
        />
      )}
    </>
  );
};

export default FactorCard;
