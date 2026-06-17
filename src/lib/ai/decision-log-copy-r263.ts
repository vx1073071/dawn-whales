// ══ R263 QClaw Task 3: 决策日志文案模板 ══
// "Why was this AI recommendation made" explanation framework
// Design: 不是"AI说买你就买"的解释——是"AI把它的思考过程全部摊开给你看，然后你自己判断"

// ═══════════════════════════════════════
// PART A: 决策日志核心框架
// ═══════════════════════════════════════

export const DECISION_LOG_FRAMEWORK = {

  // ── 哲学 ──
  philosophy: {
    title: '🧠 Whaley 决策日志',
    subtitle: '每一次AI分析留下的\"思考痕迹\"',
    core: 'Whaley不告诉你"该干什么"——Whaley告诉你的策略为什么被触发了、哪些信号亮了、不确定性有多大。决策是你自己的。这个日志是\"你的AI分析师的工作笔记\"——你可以审核、反驳、参考，但不能"替你做决定"。',
    promise: '你可以随时回看——"当时Whaley说了什么？我为什么做了那个决定？"',
  },

  // ── 决策日志结构 ──
  logEntryStructure: {
    header: '📋 决策日志 #{logId} · {date} · {time}',
    summary: '🐋 Whaley Summary: {oneLiner}',
    confidence: '置信度: {confidenceLevel} ({confidenceBar}) — {confidenceExplanation}',
    sections: [
      {
        id: 'trigger', title: '🎯 触发信号', icon: '🎯',
        template: 'AI分析基于{triggerCount}个信号触发：\n{triggerList}\n\n这些信号在今天之前处于{todayPosition}——今天的变化是{changeDirection}。',
        items: '{icon} {signalName}: 当前={currentValue}，阈值={threshold}，状态={triggerStatus}。',
      },
      {
        id: 'factors', title: '📊 因子全景', icon: '📊',
        template: '14核心因子中{positiveCount}个看多、{negativeCount}个看空、{neutralCount}个中性。\n\n最强看多信号: {topPositive}\n最强看空信号: {topNegative}',
        items: '  {factorBar} [{direction}] {factorName} · {factorInterpretation}',
        bars: { strong_bullish: '🟢🟢', mild_bullish: '🟢', neutral: '⬜', mild_bearish: '🔴', strong_bearish: '🔴🔴' },
      },
      {
        id: 'context', title: '🌍 市场上下文', icon: '🌍',
        template: '大盘环境: {marketContext}\n板块{changePct}%，{sectorJudgment}\n利率: 10Y={treasuryRate}% · {treasuryDirection}\n波动率: VIX={vix} · {vixInterpretation}',
        marketContexts: {
          strong_bull: '强势牛市——信号可信度正常',
          mild_bull: '温和上行——信号方向性偏正面',
          sideways: '横盘——信号可能反复，方向性减弱',
          mild_bear: '温和下行——信号可信度正常，但下行风险加大',
          strong_bear: '熊市——信号方向性偏负面，防御信号权重大',
          volatile: '高波动——信号噪音大，建议降权解读',
        },
        vixLevels: {
          lt15: '市场极度平静（VIX<15）——可能过于自满',
          lt20: '正常波动（VIX<20）',
          lt30: '偏高的波动（VIX>20）——不确定性在上升',
          lt40: '高波动（VIX>30）——恐慌定价',
          ge40: '极高波动（VIX>40）——极端状态，所有信号噪音变大',
        },
      },
      {
        id: 'uncertainty', title: '❓ 不确定性', icon: '❓',
        template: '本次分析的不确定性等级: {uncertaintyLevel}\n\n原因:\n{uncertaintyReasons}\n\n这意味着: {uncertaintyImplication}',
        levels: {
          low: { label: '🟢 低不确定性', desc: '信号一致且清晰。数据完整。市场环境正常。' },
          medium: { label: '🟡 中等不确定性', desc: '部分信号互相矛盾。或数据有缺口(财报未出/非交易时段)。' },
          high: { label: '🔴 高不确定性', desc: '多个信号互相矛盾。或处于极端市场环境中。或数据严重缺失。' },
        },
        reasons: [
          '信号分歧：{factorA}看多但{factorB}看空——两个信号\"打架\"',
          '数据缺口：{missingField}数据未更新(上次更新于{lastUpdate})——「缺少一条腿在跑」' ,
          '极端环境：当前市场处于{extremeDescription}——历史上处于该状态的交易日，信号噪音比正常水平高{noiseMultiplier}倍',
          '事件悬置：{pendingEvent}尚未公布——这是当前最重要的未知变量',
        ],
      },
      {
        id: 'similarity', title: '🔄 历史相似案例', icon: '🔄',
        template: '过去2年中找到{similarCount}个类似情况(因子组合+市场环境相近):\n\n{similarityList}\n\n平均后续表现: {avgOutcome} · 胜率: {winRate}% · 平均持有: {avgHoldDays}天',
        items: '  📅 {similarDate} · {similarDescription} → 后续{forwardDays}天: {forwardReturn}%',
        noMatch: '没有找到足够相似的案例（{matchScore}是最接近的，但相似度<相似度阈值）。这意味着当前情况\"不典型\"——历史类比价值有限。',
      },
      {
        id: 'contradictions', title: '⚡ 矛盾与\"为什么不该这么做\"', icon: '⚡',
        template: '即使信号指向{direction}——以下是\"反方\"观点:\n{contradictions}',
        defaultContradictions: [
          '估值角度: {valuationView}',
          '技术角度: {technicalView}',
          '情绪角度: {sentimentView}',
          '宏观角度: {macroView}',
        ],
        empty: '当前未发现显著矛盾——但这不代表\"没有风险\"。市场总是在你最有信心的时候给你\"惊喜\"。',
      },
    ] as const,
  },

  // ── 置信度可视化 ──
  confidenceVisual: {
    description: 'Whaley的\"信心\"来自信号一致性+数据完整性+市场环境——三者的\"最低\"决定最终的置信度。',
    rule: '{signalConfidence} ∩ {dataCompleteness} ∩ {marketContextQuality} = 最终置信度 {finalConfidence}',
    bar: '▓▓▓▓▓▓▓▓▓░ 80% (信号: 90% · 数据: 85% · 市场: 80%)',
    levels: [
      { range: '90-100%', zh: '高度确信——信号一致，数据完整，市场环境清晰', en: 'High certainty' },
      { range: '70-89%', zh: '置信——多数信号一致，个别矛盾', en: 'Confident' },
      { range: '50-69%', zh: '不确定——信号混合，或数据有缺口', en: 'Uncertain' },
      { range: '30-49%', zh: '低确信——信号矛盾严重，或极端市场环境', en: 'Low confidence' },
      { range: '<30%', zh: '极低确信——不建议基于此做决策', en: 'Very low — not actionable' },
    ],
  },
};

// ═══════════════════════════════════════
// PART B: 决策日志模板变体
// ═══════════════════════════════════════

export const DECISION_LOG_VARIANTS = {

  // ── 1. 策略触发日志 ──
  strategyTrigger: {
    header: '{strategyName}策略被触发 · {date} {time}',
    summary: '📍 \"{strategyOneLiner}\" 触发了 {triggerType} 级别的信号。',
    body: [
      '触发条件: {triggerCondition}',
      '触发时的市场环境: {marketSnapshot}',
      '策略回测表现: 过去2年命中{hitCount}次 · 胜率{winRate}% · 平均收益{avgReturn}%',
      '⚠️ 策略当前处于{liveStatus}模式。{liveStatusExplanation}',
    ],
    action: '你可以: {linkToStrategySettings}修改策略参数 · {linkToBacktest}查看完整回测 · {linkToDismiss}忽略这次触发',
  },

  // ── 2. AI诊断日志 ──
  aiDiagnosis: {
    header: '🤖 Whaley板块诊断 · {sectorName} · {date} {time}',
    summary: '板块{changePct}% · {oneLiner}',
    body: [
      '驱动因素(权重):',
      '  {driverFactor1}: {weight1}%',
      '  {driverFactor2}: {weight2}%',
      '  {driverFactor3}: {weight3}%',
      '',
      '板块内部分化: {advancingPct}%上涨 vs {decliningPct}%下跌。分化程度={divergenceLevel}→这通常意味着{divergenceImplication}。',
      '',
      '资金面: {moneyFlowJudgment}',
      '',
      '风险提示: {riskWarning}',
    ],
  },

  // ── 3. 对比分析日志 ──
  stockComparison: {
    header: '📊 股票对比 · {stockA} vs {stockB} vs {stockC} · {date} {time}',
    summary: '{dimension}维度下，{winner}综合得分最高({topScore}/100)',
    body: [
      '{dimensionName}对比 (权重{weight}%):',
      '  {stockA}: {scoreA}/100 — {explanationA}',
      '  {stockB}: {scoreB}/100 — {explanationB}',
      '  {stockC}: {scoreC}/100 — {explanationC}',
      '',
      '最终排名 (加权总分):',
      '  🥇 {winner}: {finalScore}',
      '  🥈 {runnerUp}: {runnerUpScore}',
      '  🥉 {third}: {thirdScore}',
      '',
      '⚠️ 注意: {winner}在{weakDimension}上得分{weakScore}——如果这个维度对你很重要，{winner}可能有\'隐藏弱点\'。',
    ],
  },

  // ── 4. 异动分析日志 ──
  anomalyAnalysis: {
    header: '🔔 异动分析 · {symbol} {changePct}% · {date} {time}',
    summary: '{symbol}{changePct}%——{anomalyType}',
    body: [
      '可能原因(按概率):',
      '  1️⃣ {reason1} (可能性: {prob1}%)',
      '  2️⃣ {reason2} (可能性: {prob2}%)',
      '  3️⃣ {reason3} (可能性: {prob3}%)',
      '',
      '如果是{mostLikelyReason}: {mostLikelyImplication}',
      '',
      '历史参考: {similarAnomalies}次类似异动 · 之后{forwardDays}天平均{avgForward}% · {forwardDirection}概率>{winBias}%',
    ],
  },

  // ── 5. 风险扫描日志 ──
  riskScan: {
    header: '⚠️ 风险扫描 · {scanType} · {date} {time}',
    summary: '{riskCount}个关注点中，{criticalCount}个需要立即关注。',
    body: [
      '🔴 高优先级:',
      '{highPriorityList}',
      '',
      '🟡 注意事项:',
      '{mediumPriorityList}',
      '',
      '📋 缓解建议:',
      '{mitigationList}',
    ],
  },
};

// ═══════════════════════════════════════
// PART C: 决策日志UI文案
// ═══════════════════════════════════════

export const DECISION_LOG_UI = {

  // ── 日志列表 ──
  list: {
    title: { zh: '📋 Whaley决策日志', en: '📋 Whaley Decision Log' },
    subtitle: { zh: '共{totalCount}条记录 · 最近{recentDays}天内有{recentCount}条', en: '{totalCount} entries · {recentCount} in last {recentDays}d' },
    empty: {
      title: { zh: '📋 还没有决策日志', en: '📋 No decision logs yet' },
      body: { zh: '当你使用AI分析、策略触发或板块诊断时——Whaley会自动记录分析过程。这样你以后可以回看"当时的分析"和"后来的走势"。', en: 'When you use AI analysis, strategy triggers, or sector diagnosis, Whaley will automatically log the reasoning. You can review them later against actual outcomes.' },
    },
    item: {
      summary: '{icon} {title} · {relativeTime}',
      meta: '置信度: {confidenceBar} · {signalCount}信号 · {factorAgreement}',
      expand: '查看完整思考链 →',
    },
    filters: {
      all: { zh: '全部', en: 'All' },
      strategy: { zh: '🎯 策略触发', en: '🎯 Strategy' },
      diagnosis: { zh: '🤖 AI诊断', en: '🤖 Diagnosis' },
      compare: { zh: '📊 对比分析', en: '📊 Compare' },
      anomaly: { zh: '🔔 异动分析', en: '🔔 Anomaly' },
      risk: { zh: '⚠️ 风险扫描', en: '⚠️ Risk' },
    },
  },

  // ── 日志详情 ──
  detail: {
    back: '← 返回日志列表',
    actions: {
      share: { zh: '📤 分享思考链', en: '📤 Share' },
      copy: { zh: '📋 复制文本', en: '📋 Copy' },
      bookmark: { zh: '⭐ 收藏', en: '⭐ Bookmark' },
      review: { zh: '✅ 事后验证', en: '✅ Review' },
    },
    reviewModal: {
      title: { zh: '事后验证：这个分析对吗？', en: 'Review: Was this analysis correct?' },
      prompt: { zh: '现在回头看——当时Whaley的分析是...', en: 'Looking back now — was Whaley\'s analysis...' },
      options: [
        { value: 'correct', zh: '✅ 对——预测和后来的走势一致', en: '✅ Correct — prediction matched outcome' },
        { value: 'partial', zh: '⚠️ 部分对——方向对了但幅度/时间错了', en: '⚠️ Partially — direction right, magnitude/timing off' },
        { value: 'incorrect', zh: '❌ 不对——后来的走势和预测相反', en: '❌ Incorrect — outcome was opposite' },
        { value: 'not_relevant', zh: '⊘ 不适用——我没有据此做决策', en: '⊘ N/A — I didn\'t act on this' },
      ],
      note: { zh: '✍️ 备注 (可选)— 你为什么这么判断？', en: '✍️ Note (optional) — why do you think that?' },
    },
  },

  // ── 决策日志的"反思模式" ──
  reflection: {
    title: { zh: '🪞 你在决策时的思考', en: '🪞 Your thinking at decision time' },
    prompt: { zh: '记录下来——你当时不只是看了AI分析就决策了。你脑子里还有什么？', en: 'Record it — you didn\'t just act on the AI analysis. What else was in your head?' },
    fields: [
      { id: 'yourReasoning', zh: '你的主要理由', en: 'Your main reasoning' },
      { id: 'yourDoubts', zh: '你的犹豫', en: 'Your doubts' },
      { id: 'externalFactors', zh: '外部因素(消息/新闻/感受)', en: 'External factors (news/gut feel)' },
    ],
    saveNote: { zh: '💾 保存反思 — 未来你会感谢\"现在的你\"', en: '💾 Save — future you will thank you' },
  },

  // ── 月度决策报告 ──
  monthlyReport: {
    title: { zh: '📊 {month} 决策健康报告', en: '📊 {month} Decision Health Report' },
    summary: { zh: '本月{totalLogCount}条决策日志 · AI准确率: {accuracy}% · 你的行动率: {actionRate}%', en: '{totalLogCount} decision logs · AI accuracy: {accuracy}% · Your action rate: {actionRate}%' },
    insight: [
      { id: 'mostUsed', zh: '你最常用的功能是{mostUsedFeature}({usageCount}次)——{usageInsight}', en: 'Most used: {mostUsedFeature} ({usageCount}×) — {usageInsight}' },
      { id: 'bestAccuracy', zh: '准确率最高的功能是{bestFeature}({bestAccuracy}%)', en: 'Highest accuracy: {bestFeature} ({bestAccuracy}%)' },
      { id: 'actionBias', zh: '你看到AI分析后的行动倾向: {actionBiasDescription}', en: 'Your action bias after AI analysis: {actionBiasDescription}' },
    ],
  },
};

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function getConfidenceLevel(pct: number): string {
  if (pct >= 90) return 'low_uncertainty';
  if (pct >= 70) return 'medium_uncertainty';
  return 'high_uncertainty';
}

export function getConfidenceBar(pct: number): string {
  const filled = Math.round(pct / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled) + ` ${pct}%`;
}

export function getConfidenceRange(pct: number): (typeof DECISION_LOG_FRAMEWORK.confidenceVisual.levels)[number] | undefined {
  if (pct >= 90) return DECISION_LOG_FRAMEWORK.confidenceVisual.levels[0];
  if (pct >= 70) return DECISION_LOG_FRAMEWORK.confidenceVisual.levels[1];
  if (pct >= 50) return DECISION_LOG_FRAMEWORK.confidenceVisual.levels[2];
  if (pct >= 30) return DECISION_LOG_FRAMEWORK.confidenceVisual.levels[3];
  return DECISION_LOG_FRAMEWORK.confidenceVisual.levels[4];
}

export function getVixLevel(vix: number): string {
  if (vix < 15) return 'lt15'; if (vix < 20) return 'lt20'; if (vix < 30) return 'lt30'; if (vix < 40) return 'lt40'; return 'ge40';
}

export function getLogVariant(type: string) {
  const key = type as keyof typeof DECISION_LOG_VARIANTS;
  return DECISION_LOG_VARIANTS[key] || null;
}

export function getFactorsBar(direction: string): string {
  const bars = DECISION_LOG_FRAMEWORK.logEntryStructure.sections[1].bars as Record<string, string>;
  return bars[direction] || '⬜';
}

export default DECISION_LOG_FRAMEWORK;
