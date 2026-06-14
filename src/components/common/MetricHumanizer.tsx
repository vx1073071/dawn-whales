/**
* MetricHumanizer — ML R181 P0-09 [P0] 数字人话翻译
* Translates quantitative metrics into human-readable analogies.
* IC/Sharpe/MaxDD/etc → natural language comparisons.
*/

// ── Types ───────────────────────────────────────────────────────────────

export interface HumanizedMetric {
  /** Original metric name */
  metric: string;
  /** Numeric value */
  value: number;
  /** Human-readable translation */
  human: string;
  /** Emoji for visual cue */
  emoji: string;
  /** Color hint */
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

// ── Translation rules ──────────────────────────────────────────────────

/**
 * Translate IC (Information Coefficient) to human language.
 * IC measures factor's predictive power: how well factor rank correlates with future return rank.
 */
function humanizeIC(ic: number): HumanizedMetric {
  const abs = Math.abs(ic);
  if (abs >= 0.05) {
    return { metric: 'IC', value: ic, human: '很强预测力', emoji: '🔥', color: 'green',
      detail: `相当于天气预报准确率 >80%——${ic >= 0 ? '做多' : '做空'}方向的预测非常可靠` };
  }
  if (abs >= 0.03) {
    return { metric: 'IC', value: ic, human: '中等预测力', emoji: '👍', color: 'yellow',
      detail: `相当于天气预报准确率 60-70%——有一定参考价值，但别全信` };
  }
  return { metric: 'IC', value: ic, human: '较弱预测力', emoji: '🤔', color: 'red',
    detail: `相当于抛硬币稍微好一点——当前市场环境下该因子的预测能力有限` };
}

/**
 * Translate IR (Information Ratio) to human language.
 * IR measures consistency of IC over time.
 */
function humanizeIR(ir: number): HumanizedMetric {
  if (ir >= 0.7) {
    return { metric: 'IR', value: ir, human: '非常稳定', emoji: '🪨', color: 'green',
      detail: '像石头一样稳——因子表现不随市场大起大落' };
  }
  if (ir >= 0.5) {
    return { metric: 'IR', value: ir, human: '基本稳定', emoji: '🌊', color: 'yellow',
      detail: '像海浪一样有节奏——大部分时间可预测' };
  }
  return { metric: 'IR', value: ir, human: '不太稳定', emoji: '🎢', color: 'red',
    detail: '像过山车——时灵时不灵，谨慎依赖' };
}

/**
 * Translate Sharpe Ratio to human language.
 */
function humanizeSharpe(sharpe: number): HumanizedMetric {
  if (sharpe >= 1.5) {
    return { metric: 'Sharpe', value: sharpe, human: '极高的性价比', emoji: '🏆', color: 'green',
      detail: '每承担1份风险，收获1.5份以上收益——专业投资者的理想水平' };
  }
  if (sharpe >= 1.0) {
    return { metric: 'Sharpe', value: sharpe, human: '良好的性价比', emoji: '✅', color: 'green',
      detail: '每承担1份风险收获1份以上收益——及格线以上' };
  }
  if (sharpe >= 0.5) {
    return { metric: 'Sharpe', value: sharpe, human: '性价比一般', emoji: '⚖️', color: 'yellow',
      detail: '承担的风险和收益大致相当——不太划算' };
  }
  return { metric: 'Sharpe', value: sharpe, human: '性价比差', emoji: '⚠️', color: 'red',
    detail: '承担的风险大于收益——可能需要重新考虑' };
}

/**
 * Translate Max Drawdown to human language.
 */
function humanizeMaxDD(maxDD: number): HumanizedMetric {
  if (maxDD <= 10) {
    return { metric: '最大回撤', value: maxDD, human: '风险极低', emoji: '🛡️', color: 'green',
      detail: `历史上最多亏过${maxDD.toFixed(0)}%——像买了保险一样安全` };
  }
  if (maxDD <= 20) {
    return { metric: '最大回撤', value: maxDD, human: '风险适中', emoji: '📊', color: 'yellow',
      detail: `历史上最多亏过${maxDD.toFixed(0)}%——正常市场波动的范围` };
  }
  return { metric: '最大回撤', value: maxDD, human: '风险较高', emoji: '⚠️', color: 'red',
    detail: `历史上最多亏过${maxDD.toFixed(0)}%——要有心理准备` };
}

/**
 * Translate Win Rate to human language.
 */
function humanizeWinRate(wr: number): HumanizedMetric {
  if (wr >= 70) {
    return { metric: '胜率', value: wr, human: '十拿七稳', emoji: '🎯', color: 'green',
      detail: `每10次交易赢${(wr / 10).toFixed(0)}次以上——胜多负少` };
  }
  if (wr >= 55) {
    return { metric: '胜率', value: wr, human: '小有优势', emoji: '👍', color: 'yellow',
      detail: `比抛硬币略好——长期坚持能累积优势` };
  }
  return { metric: '胜率', value: wr, human: '胜率偏低', emoji: '🎲', color: 'red',
    detail: '接近抛硬币——可能需要调整策略参数' };
}

/**
 * Translate Decay Factor to human language.
 */
function humanizeDecay(lambda: number): HumanizedMetric {
  if (lambda <= 0.1) {
    return { metric: '衰减', value: lambda, human: '几乎不衰减', emoji: '💪', color: 'green',
      detail: '因子的预测力很持久，不需要频繁调仓' };
  }
  if (lambda <= 0.25) {
    return { metric: '衰减', value: lambda, human: '缓慢衰减', emoji: '⏳', color: 'yellow',
      detail: `大约${Math.round(Math.log(2) / lambda)}天后预测力减半——定期检查即可` };
  }
  return { metric: '衰减', value: lambda, human: '快速衰减', emoji: '🏃', color: 'red',
    detail: `大约${Math.round(Math.log(2) / lambda)}天内预测力减半——需要频繁调仓` };
}

/**
 * Translate Compatibility Score to human language.
 */
function humanizeCompat(score: number): HumanizedMetric {
  if (score >= 0.8) {
    return { metric: '兼容度', value: score, human: '天生搭档', emoji: '🤝', color: 'green',
      detail: '与当前组合其他因子互补性极强，1+1>2' };
  }
  if (score >= 0.6) {
    return { metric: '兼容度', value: score, human: '可以搭配', emoji: '👌', color: 'yellow',
      detail: '与当前组合基本兼容，不会有冲突' };
  }
  return { metric: '兼容度', value: score, human: '存在冲突', emoji: '⚠️', color: 'red',
    detail: '与当前组合中的某些因子高度相关或方向冲突，建议替换' };
}

// ── Main function ───────────────────────────────────────────────────────

export type MetricType = 'ic' | 'ir' | 'sharpe' | 'maxDD' | 'winRate' | 'decay' | 'compat';

export function humanizeMetric(type: MetricType, value: number): HumanizedMetric {
  switch (type) {
    case 'ic': return humanizeIC(value);
    case 'ir': return humanizeIR(value);
    case 'sharpe': return humanizeSharpe(value);
    case 'maxDD': return humanizeMaxDD(value);
    case 'winRate': return humanizeWinRate(value);
    case 'decay': return humanizeDecay(value);
    case 'compat': return humanizeCompat(value);
    default: return { metric: type, value, human: String(value), emoji: '📊', color: 'gray' };
  }
}

// ── Hover tooltip component ─────────────────────────────────────────────

interface MetricTooltipProps {
  type: MetricType;
  value: number;
  /** If true, show as hover tooltip; if false, show inline */
  tooltip?: boolean;
  className?: string;
}

export function MetricTooltip({ type, value, tooltip = true, className = '' }: MetricTooltipProps) {
  const h = humanizeMetric(type, value);

  if (!tooltip) {
    // Inline display
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${className}`} title={h.detail}>
        <span>{h.emoji}</span>
        <span className={h.color === 'green' ? 'text-green-400' : h.color === 'red' ? 'text-red-400' : h.color === 'yellow' ? 'text-yellow-400' : 'text-blue-400'}>
          {h.human}
        </span>
      </span>
    );
  }

  // Hover tooltip
  return (
    <span className={`group relative inline-flex items-center gap-0.5 cursor-help ${className}`}>
      <span className="text-[10px] text-gray-400 border-b border-dotted border-gray-600">
        {value.toFixed(typeof value === 'number' && value < 10 ? 2 : 0)}{type === 'winRate' || type === 'decay' || type === 'compat' ? '%' : ''}
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
        <div className="bg-[#1A1A24] border border-white/10 rounded-lg p-2.5 shadow-xl min-w-[200px]">
          <div className="flex items-center gap-1.5 mb-1">
            <span>{h.emoji}</span>
            <span className={`text-xs font-medium ${h.color === 'green' ? 'text-green-400' : h.color === 'red' ? 'text-red-400' : h.color === 'yellow' ? 'text-yellow-400' : 'text-blue-400'}`}>
              {h.human}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">{h.detail || ''}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1A1A24] border-r border-b border-white/10 rotate-45 -mt-1" />
        </div>
      </div>
    </span>
  );
}

export default humanizeMetric;
