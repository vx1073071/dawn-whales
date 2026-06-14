/**
* FreemiumUpgrade — ML R182 P1-03 [P0] 免费梯度优化
* Replace lock icons with personalized upgrade reasons.
* Shows "why you should unlock" instead of "you can't see this".
*/

import { useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export interface UpgradeReason {
  /** What the user gets */
  benefit: string;
  /** Why it matters to THIS user specifically */
  personalReason: string;
  /** Quantitative value */
  valueHint: string;
  /** Emoji for visual appeal */
  emoji: string;
}

interface FreemiumUpgradeProps {
  /** User's portfolio composition for personalization */
  userFactors?: string[];
  userMarket?: string;
  userStyle?: string;
  /** What they're trying to unlock */
  unlockType: 'factor_analysis' | 'weight_optimization' | 'backtest_detail' | 'signal_subscription' | 'full_unlock';
  /** Price in USDT */
  price: number;
  /** Callback */
  onUnlock: () => void;
  className?: string;
}

// ── Upgrade reason generator ───────────────────────────────────────────

function generateUpgradeReason(
  type: FreemiumUpgradeProps['unlockType'],
  factors?: string[],
  market?: string,
  style?: string
): UpgradeReason {
  const hasFactors = factors && factors.length > 0;

  switch (type) {
    case 'factor_analysis':
      return {
        benefit: '8个因子的完整深度分析',
        personalReason: hasFactors
          ? `你已配置 ${factors!.slice(0, 2).join('、')}，解锁后可查看它们的衰减趋势和拥挤度预警`
          : '根据你的市场偏好，AI精选了最适合的因子组合',
        valueHint: '回测准确率提升 ~15%',
        emoji: '🔬',
      };
    case 'weight_optimization':
      return {
        benefit: 'AI权重多目标优化',
        personalReason: style === 'conservative'
          ? '你偏好稳健风格，AI可帮你找到风险最低的权重配置'
          : 'AI可遍历5000+权重组合，找到Sharpe最高的配置',
        valueHint: 'Sharpe预计提升 +0.15 ~ +0.30',
        emoji: '⚖️',
      };
    case 'backtest_detail':
      return {
        benefit: '完整回测归因分析',
        personalReason: hasFactors
          ? `查看 ${factors!.slice(0, 2).join('、')} 的回测贡献分解和R²解释度`
          : '查看各因子对回测收益的实际贡献占比',
        valueHint: '发现表现最好的因子',
        emoji: '📊',
      };
    case 'signal_subscription':
      return {
        benefit: '实时因子信号推送',
        personalReason: market === 'HK'
          ? '港股波动大，实时信号可帮你及时调仓'
          : '第一时间获取因子IC突破/衰减预警',
        valueHint: '信号订阅者平均收益 +8%',
        emoji: '📡',
      };
    case 'full_unlock':
    default:
      return {
        benefit: '全部AI分析功能',
        personalReason: hasFactors
          ? `解锁后可查看 ${factors!.length} 个因子的深度分析和个性化建议`
          : '解锁后可查看所有因子的深度分析和AI定制建议',
        valueHint: '完整功能集',
        emoji: '🚀',
      };
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function FreemiumUpgrade({
  userFactors,
  userMarket,
  userStyle,
  unlockType,
  price,
  onUnlock,
  className = '',
}: FreemiumUpgradeProps) {
  const reason = useMemo(
    () => generateUpgradeReason(unlockType, userFactors, userMarket, userStyle),
    [unlockType, userFactors, userMarket, userStyle]
  );

  return (
    <div className={`bg-[#1a1a25] border border-[#D4A853]/10 rounded-lg p-4 space-y-3 ${className}`}>
      {/* Personalized header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{reason.emoji}</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{reason.benefit}</div>
          <div className="text-xs text-gray-400 mt-1 leading-relaxed">
            {reason.personalReason}
          </div>
        </div>
      </div>

      {/* Value proposition */}
      <div className="bg-[#D4A853]/5 border border-[#D4A853]/10 rounded p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{reason.valueHint}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">费用</span>
          <span className="text-[#D4A853] font-bold text-sm">{price.toFixed(1)} USDT</span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onUnlock}
        className="w-full py-2.5 rounded-lg bg-[#C9A046] hover:bg-[#D4A853] text-black font-semibold text-sm transition-colors"
      >
        {reason.emoji} 解锁{reason.benefit} — {price.toFixed(1)} USDT
      </button>

      {/* Reassurance */}
      <div className="text-center text-[9px] text-gray-600">
        解锁后立即生效 · 不满意可退款(48小时) · 无自动续费
      </div>
    </div>
  );
}
