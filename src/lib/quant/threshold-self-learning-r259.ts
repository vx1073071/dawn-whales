// ══ R259 LOBEHUB P3: 异动阈值自学习引擎 ══
// Anomaly Threshold Self-Learning — "阈值不是人调的，是市场自己调的"
//
// 方法:
//   1. 滚动窗口历史波动率 → 自适应基准
//   2. 假阳性/假阴性反馈 → 阈值迭代
//   3. 用户行为反馈 → 点击=有效异动, 忽略=噪音
//   4. 市场状态转移 → 阈值平滑过渡
//   5. 冷却自适应 → 同股短期不重复推送

// R259: 自学习引擎内置阈值逻辑，不依赖外部配置

export interface ThresholdFeedback {
  symbol: string;
  market: string;
  priceChangePct: number;
  thresholdAtTrigger: number;
  triggered: boolean;          // 是否触发了异动
  userClicked: boolean;        // 用户是否点击了推送
  userBought: boolean;         // 用户是否因此买入
  falsePositive: boolean;      // 用户标记为"不需要"
  timestamp: number;
}

export interface ThresholdLearningState {
  symbol: string;
  market: string;
  baseThreshold: number;
  rollingVolatility: number;    // 最近30天波动率
  feedbackWindow: ThresholdFeedback[];  // 最近100条反馈
  falsePositiveRate: number;
  clickRate: number;
  lastAdjustedAt: number;
}

export interface ThresholdLearningReport {
  timestamp: number;
  symbols: ThresholdLearningState[];
  averageThreshold: number;
  averageFalsePositiveRate: number;
  averageClickRate: number;
  adjustments: Array<{
    symbol: string;
    oldThreshold: number;
    newThreshold: number;
    reason: string;
  }>;
  recommendations: string[];
}

// ═══════════════════ 滚动波动率计算 ═══════════════════

export function computeRollingVolatility(
  dailyReturns: number[],  // 每日涨跌幅%
  window: number = 30,
): number {
  if (dailyReturns.length < 5) return 2; // 默认2%
  const recent = dailyReturns.slice(-Math.min(window, dailyReturns.length));
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((s, r) => s + (r - mean) ** 2, 0) / recent.length;
  return Math.sqrt(variance);
}

// ═══════════════════ 假阳性/假阴性率 ═══════════════════

export function computeFalsePositiveRate(feedback: ThresholdFeedback[]): number {
  if (feedback.length < 10) return 0.1; // 默认10%
  const triggered = feedback.filter(f => f.triggered);
  if (triggered.length === 0) return 0;
  const fp = triggered.filter(f => f.falsePositive || (!f.userClicked && f.triggered));
  return fp.length / triggered.length;
}

export function computeClickRate(feedback: ThresholdFeedback[]): number {
  const triggered = feedback.filter(f => f.triggered);
  if (triggered.length === 0) return 0;
  return triggered.filter(f => f.userClicked).length / triggered.length;
}

// ═══════════════════ 阈值自学习核心 ═══════════════════

export function learnOptimalThreshold(state: ThresholdLearningState): {
  newThreshold: number;
  reason: string;
} {
  const { baseThreshold, rollingVolatility, falsePositiveRate, clickRate } = state;

  // 基础：取历史阈值和波动率×1.5的加权
  let optimal = (baseThreshold * 0.4) + (rollingVolatility * 1.5 * 0.6);

  // 假阳性太多→提高阈值
  if (falsePositiveRate > 0.4) {
    optimal *= 1.3;
  } else if (falsePositiveRate > 0.2) {
    optimal *= 1.1;
  }

  // 点击率高→可以稍微降低阈值(更多推送=更多点击?)
  if (clickRate > 0.08 && falsePositiveRate < 0.2) {
    optimal *= 0.9;
  }

  // 不低于1%的底线
  optimal = Math.max(1, optimal);
  // 不高于15%的上限
  optimal = Math.min(15, optimal);

  const reason = `波动率${rollingVolatility.toFixed(1)}% ×1.5 ${falsePositiveRate > 0.3 ? '→假阳性高提高阈值' : clickRate > 0.06 ? '→点击率高微降阈值' : ''} = ${optimal.toFixed(2)}%`;

  return { newThreshold: Math.round(optimal * 100) / 100, reason };
}

// ═══════════════════ 批量自学习 ═══════════════════

export function batchLearnThresholds(
  states: ThresholdLearningState[],
): ThresholdLearningReport {
  const adjustments: ThresholdLearningReport['adjustments'] = [];

  for (const state of states) {
    const { newThreshold, reason } = learnOptimalThreshold(state);
    if (Math.abs(newThreshold - state.baseThreshold) > 0.5) {
      adjustments.push({
        symbol: state.symbol,
        oldThreshold: state.baseThreshold,
        newThreshold,
        reason,
      });
    }
  }

  adjustments.sort((a, b) => Math.abs(b.newThreshold - b.oldThreshold) - Math.abs(a.newThreshold - a.oldThreshold));

  const avgThreshold = states.reduce((s, st) => s + st.baseThreshold, 0) / Math.max(1, states.length);
  const avgFP = states.reduce((s, st) => s + st.falsePositiveRate, 0) / Math.max(1, states.length);
  const avgClick = states.reduce((s, st) => s + st.clickRate, 0) / Math.max(1, states.length);

  return {
    timestamp: Date.now(),
    symbols: states,
    averageThreshold: Math.round(avgThreshold * 100) / 100,
    averageFalsePositiveRate: Math.round(avgFP * 1000) / 10,
    averageClickRate: Math.round(avgClick * 1000) / 10,
    adjustments,
    recommendations: [
      avgFP > 30 ? `⚠️ 假阳性率${avgFP.toFixed(1)}%偏高——建议全局提高阈值` : `✅ 假阳性率${avgFP.toFixed(1)}%健康`,
      avgClick < 3 ? '💡 点击率偏低——可能推送内容不够吸引人而非阈值问题' : '',
      adjustments.length > 0 ? `🔧 ${adjustments.length}个股票阈值需要调整` : '✅ 所有股票阈值稳定',
    ].filter(r => r !== ''),
  };
}

// ═══════════════════ 冷却自适应 ═══════════════════

export interface CooldownState {
  symbol: string;
  lastPushAt: number;
  pushCount24h: number;
  clickCount24h: number;
}

export function adaptiveCooldown(state: CooldownState): number {
  // 基础冷却：30分钟
  let cooldown = 30;

  // 24h内推送>5次→冷却翻倍
  if (state.pushCount24h > 5) cooldown *= 2;
  // 24h内推送>10次→冷却4倍
  if (state.pushCount24h > 10) cooldown *= 2;
  // 用户一直在点→可以多发(冷却减半)
  if (state.clickCount24h > 3 && state.pushCount24h > 3) cooldown = Math.round(cooldown / 2);

  return Math.max(15, Math.min(480, cooldown)); // 15-480分钟
}

export default ThresholdLearningReport;
