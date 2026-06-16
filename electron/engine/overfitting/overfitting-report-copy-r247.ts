// ══ R247 QClaw P2-04: 策略过拟合报告文案 ══
// Explain bootstrap, param sensitivity, monkey test to non-expert users
// Design: "你看不懂统计没关系——我们用人话告诉你这个策略靠不靠谱"

export type OverfittingGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface OverfittingSection {
  sectionId: string;
  title: string;
  /** 一句话解释这是什么 */
  oneLiner: string;
  /** 详细解释 (≤150字) */
  explanation: string;
  /** 类比 (用一个生活中的例子解释) */
  analogy: string;
  /** 结果解读模板 (positive/negative/neutral) */
  resultTemplates: {
    positive: string;
    negative: string;
    neutral: string;
  };
}

export interface OverfittingReport {
  strategyName: string;
  strategyId: string;
  overallGrade: OverfittingGrade;
  overallVerdict: string;
  sections: OverfittingSection[];
  summary: {
    whatThisMeans: string;
    whatToDo: string;
  };
}

// ═══════════════════ 报告各节文案定义 ═══════════════════

export const OVERFITTING_SECTIONS: Record<string, OverfittingSection> = {
  // ── Section 1: Bootstrap (鲁棒性检验) ──
  bootstrap: {
    sectionId: 'bootstrap',
    title: '换个时间段还行吗？',
    oneLiner: '我们在过去的数据里随机抽了1000段不同时期来测试——结果稳定吗？',
    explanation: '过拟合的策略就像一张只适合"特定考试"的答案——换个题目就不灵了。Bootstrap做的事情很简单：把历史数据随机切成1000份不同的"考试"，看你的策略每一份都能及格，还是只在某些时段考高分。如果在大部分随机时段都能赚钱，说明策略是真本事，不是碰巧。',
    analogy: '就像你考驾照——你不会只练一个考场的一条路线就觉得自己能上路了。真正的驾驶能力是在任何一个城市、任何天气下都能安全开车。Bootstrap就是在模拟：让你在1000个不同的"城市"和"天气"里开一遍。',
    resultTemplates: {
      positive: '✅ 稳健！在1000个随机时段中，{win_pct}%都是赚钱的。你的策略不是"考过一次高分"——它是"每次考试都能及格"。',
      negative: '⚠️ 不稳定。在1000个随机时段中，只有{win_pct}%能赚钱——这意味着你的策略成绩很大程度上取决于"运气好碰到了什么时段"。换个时间段可能就亏了。',
      neutral: '表现中等。{win_pct}%的时段能赚钱——说明策略有一定稳定性，但还有改进空间。',
    },
  },

  // ── Section 2: Parameter Sensitivity (参数敏感性) ──
  param_sensitivity: {
    sectionId: 'param_sensitivity',
    title: '参数稍微变一点点，结果还一样吗？',
    oneLiner: '如果把RSI周期从14改成13，或者把止损从5%改成4%——策略还赚钱吗？',
    explanation: '一个真正好的策略，不应该只对某一个"完美的参数组合"有效。我们对每个参数做了±20%的扰动测试——比如你的RSI周期是14，我们就试10、11、12、13、15、16、17各跑一遍回测。如果所有版本都能赚钱，说明策略逻辑本身是成立的，不是调参调出来的巧合。',
    analogy: '就像做一道菜——如果"盐3.5克"这道菜完美，"盐3.3克"就完全不能吃，那说明这道菜的配方太脆弱了。真正的好菜谱应该是在某个范围内怎么调都好吃。',
    resultTemplates: {
      positive: '✅ 稳定！{stable_params}/{total_params}个参数在±20%范围内扰动后，策略仍保持正收益。你的策略不依赖某个精确的参数值——逻辑本身是成立的。',
      negative: '🚩 敏感！只有{sensitive_params}/{total_params}个参数在扰动后保持盈利——这意味着你的策略高度依赖特定的参数组合。很可能是在"调参"而不是"发现规律"。',
      neutral: '部分参数敏感。{stable_params}/{total_params}个参数在扰动后保持盈利。核心逻辑没问题，但有些参数的设置比较"挑剔"。',
    },
  },

  // ── Section 3: Out-of-Sample Test (样本外测试) ──
  out_of_sample: {
    sectionId: 'out_of_sample',
    title: '在没见过的新数据上表现如何？',
    oneLiner: '如果我们用最近的数据（策略从来没"见过"的）来测试——它还能赚钱吗？',
    explanation: '这是最关键的测试。我们把数据分成两段：前一段用来"训练"你的策略（找到最佳参数），后一段用来"考试"（策略完全没见过这些数据）。如果考试阶段表现远差于训练阶段，说明策略只是在"背题"而不是"学会了"——这就是过拟合。',
    analogy: '就像期末考试——如果你只在做过的练习题里能考高分，但换一套全新的题就考砸了，说明你不是真的理解了，只是在"背答案"。样本外测试就是那套你没见过的全新考卷。',
    resultTemplates: {
      positive: '✅ 通过！样本外收益率{OOS_return}%，与样本内{INS_return}%相比差距{gap}%——在合理范围内。你的策略在没见过的新数据上也能赚钱。',
      negative: '🚩 过拟合警告！样本外收益率{OOS_return}%，远低于样本内{INS_return}%——差距{gap}%太大了。你的策略在训练数据上表现很好，但一碰到新数据就原形毕露。',
      neutral: '可接受。样本内外差距{gap}%——有一点下滑但不算严重。策略大概率不是在"背题"。',
    },
  },

  // ── Section 4: Monkey Test (猴子测试) ──
  monkey_test: {
    sectionId: 'monkey_test',
    title: '你的策略比猴子强吗？',
    oneLiner: '我们让1000只"虚拟猴子"随机买卖——你的策略打败了多少只？',
    explanation: '这是一个用来检验"你的策略是不是真的比随机买卖强"的测试。我们模拟了1000个随机策略（瞎买瞎卖），然后看你的策略跑赢了其中多少。如果你的策略只跑赢了500只猴子——那你的策略跟猴子一样，纯粹靠运气。',
    analogy: '想象有一群猴子在股票键盘上随机敲买卖——它们也有50%的概率在某一年赚钱。你的策略必须显著超过这群猴子，才算真有本事。如果连猴子的平均水平都打不过——那你不如让猴子帮你操作，还省了策略费。',
    resultTemplates: {
      positive: '✅ 远胜猴子！你的策略跑赢了{beat_pct}%的随机策略（猴子）。它在{all_stats}等关键指标上都远超随机水准——这不仅仅是运气。',
      negative: '🐒 跟猴子差不太多。你的策略只跑赢了{beat_pct}%的随机策略。换句话说，随便一个乱买的"猴子"都有{monkey_equal_chance}%的概率做得跟你一样好。',
      neutral: '中等偏上。打败了{beat_pct}%的猴子——有统计上的优势，但不算压倒性。可以考虑再优化一下参数。',
    },
  },

  // ── Section 5: Market Regime (市场体制覆盖) ──
  regime_coverage: {
    sectionId: 'regime_coverage',
    title: '牛市熊市都能赚钱吗？',
    oneLiner: '我们把市场分成三种状态（上涨/下跌/震荡），分别看你的策略在每种状态下的表现。',
    explanation: '有些策略在牛市赚得盆满钵满，一到熊市就血流成河。有些策略反过来——熊市赚钱牛市踏空。真正好的策略应该至少不会在某种状态下死得很惨。我们分别测试了三种市场状态下的表现，让你知道什么环境适合用这个策略，什么环境最好收手。',
    analogy: '就像一件外套——如果它只适合25°C的天气，低于20°C就完全没用，那它不能算一件好外套。一个好的策略应该至少能"适应"不同的市场天气——哪怕在不同天气下表现有差异，也不应该在某种天气下直接报废。',
    resultTemplates: {
      positive: '✅ 全天候！牛市{up_return}%，熊市{down_return}%，震荡{sideways_return}%。三种环境都保持正收益——这是一件"四季外套"。',
      negative: '⚠️ 单季节型。牛市{up_return}%，但熊市{down_return}%。这个策略只在上涨环境中有效——如果市场转熊，建议暂停使用。',
      neutral: '偏某种环境。在{best_regime}表现最好({best_return}%)，{worst_regime}较弱({worst_return}%)。使用时注意市场环境。',
    },
  },
};

// ═══════════════════ 综合评级文案 ═══════════════════

export const OVERALL_GRADE_COPY: Record<OverfittingGrade, { label: string; emoji: string; verdict: string; whatToDo: string; }> = {
  A: {
    label: '优秀',
    emoji: '🏆',
    verdict: '你的策略通过了所有测试——它不是运气，是真本事。Bootstrap稳健、参数不敏感、样本外表现一致、远胜随机策略。可以实盘使用。',
    whatToDo: '放心部署。建议从小仓位开始（10-20%），熟悉一个月后再加仓。定期回来看一下"策略健康"指标——任何策略都会过时，好习惯是定期检查。',
  },
  B: {
    label: '良好',
    emoji: '👍',
    verdict: '策略大体可靠，但在某些测试中表现不够完美。大概率不是过拟合，但也不是100%稳定。有信心使用，但需要更多关注。',
    whatToDo: '可以部署，但建议用更小的仓位（5-10%）先跑1-2个月。密集关注策略健康告警——如果胜率连续下降超过20%，先暂停。',
  },
  C: {
    label: '一般',
    emoji: '🤔',
    verdict: '策略在一些关键测试上勉强及格。有信号优势，但不排除运气成分。不建议全仓使用。',
    whatToDo: '可以用极小仓位（1-5%）试水，同时考虑优化参数或结合其他策略分散风险。如果连续2个月跑输基准，建议放弃。',
  },
  D: {
    label: '较差',
    emoji: '⚠️',
    verdict: '策略在多项测试中表现不佳。样本外下降明显或参数过于敏感。高概率存在过拟合问题——回测表现不一定能重复。',
    whatToDo: '不建议实盘部署。如果你想继续使用这个策略的思路，可以考虑简化它——通常参数越少的策略越不容易过拟合。',
  },
  F: {
    label: '不合格',
    emoji: '🚩',
    verdict: '策略严重过拟合。所有测试都表明它在"背历史答案"——实盘大概率亏钱。不要在实盘上使用。',
    whatToDo: '这个策略不值得投入资金。但不要因此气馁——很多顶尖量化策略在第一次做出来时都是F。回到起点：你的核心逻辑是什么？简化它，用更少的参数，然后重新测试。',
  },
};

// ═══════════════════ 报告生成函数 ═══════════════════

export function generateOverfittingReport(grade: OverfittingGrade, strategyName: string, strategyId: string): OverfittingReport {
  const gradeInfo = OVERALL_GRADE_COPY[grade];
  return {
    strategyName,
    strategyId,
    overallGrade: grade,
    overallVerdict: `${gradeInfo.emoji} ${gradeInfo.label} — ${gradeInfo.verdict}`,
    sections: Object.values(OVERFITTING_SECTIONS),
    summary: {
      whatThisMeans: gradeInfo.verdict,
      whatToDo: gradeInfo.whatToDo,
    },
  };
}

/** Generate a full human-readable overfitting report */
export function generateOverfittingReportText(report: OverfittingReport): string {
  const grade = OVERALL_GRADE_COPY[report.overallGrade];
  let text = `📊 ${report.strategyName} 过拟合检测报告\n\n`;
  text += `${grade.emoji} 综合评级: ${grade.label}\n`;
  text += `${grade.verdict}\n\n`;

  text += `── 五项测试详情 ──\n\n`;
  for (const sec of report.sections) {
    text += `🔬 ${sec.title}\n`;
    text += `${sec.explanation}\n`;
    text += `💡 比喻: ${sec.analogy}\n\n`;
  }

  text += `── 建议 ──\n${grade.whatToDo}\n`;
  return text;
}

/** Monkey test one-liner for social proof */
export function getMonkeyTestOneLiner(beatPct: number): string {
  if (beatPct >= 95) return `🏆 跑赢了${beatPct}%的猴子——你的策略是真本事，不是运气。`;
  if (beatPct >= 80) return `👍 跑赢了${beatPct}%的猴子——明显比乱买强。`;
  if (beatPct >= 60) return `🤔 跑赢了${beatPct}%的猴子——有点优势，但不算压倒性。`;
  if (beatPct >= 40) return `🐒 只跑赢了${beatPct}%的猴子——跟随机买卖差不太多。`;
  return `🐵 被${100 - beatPct}%的猴子打败了——你不如让猴子帮你买。`;
}

export { OVERFITTING_SECTIONS, OVERALL_GRADE_COPY };
export default OVERFITTING_SECTIONS;
