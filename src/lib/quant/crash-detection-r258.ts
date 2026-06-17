// ══ R258 LOBEHUB P1-05: 崩盘判定规则引擎 ══
// Crash Detection Rules — "什么时候该拉响警报？规则不能说谎。"
//
// 判定维度:
//   1. 大盘跌幅 (单日/3日/5日)
//   2. 广度 (下跌股票占比)
//   3. 波动率 (VIX飙升)
//   4. 流动性 (成交量爆量)
//   5. 跨市场确认 (多市场同时下跌)
//   6. 因子异常 (多因子同时反转)

export type CrashLevel = 'NONE' | 'CORRECTION' | 'BEAR_TERRITORY' | 'CRASH' | 'PANIC';

export interface CrashRuleResult {
  timestamp: number;
  level: CrashLevel;
  score: number;           // 0-100 崩盘概率
  triggers: string[];      // 触发条件
  indicators: {
    marketDeclinePct: number;
    breadthPct: number;
    vix: number;
    vixChangePct: number;
    volumeSurgeRatio: number;
    crossMarketConfirmation: number; // 几市场同时跌
    factorReversalCount: number;
  };
  action: {
    push: 'NONE' | 'ALL_USERS' | 'AFFECTED_ONLY' | 'VIP_ONLY';
    message: string;
    cooldownMinutes: number;  // 多久内不重复推送
  };
}

// ═══════════════════ 分层规则 ═══════════════════

export interface CrashRule {
  name: string;
  condition: (indicators: CrashRuleResult['indicators']) => boolean;
  score: number;           // 触发后加多少分
  explanation: string;
}

export const CRASH_RULES: CrashRule[] = [
  // 大盘跌幅
  { name: '单日跌>3%', condition: i => i.marketDeclinePct < -3, score: 20, explanation: '主要指数单日跌幅超3%' },
  { name: '单日跌>5%', condition: i => i.marketDeclinePct < -5, score: 30, explanation: '主要指数单日跌幅超5%' },
  { name: '单日跌>7%', condition: i => i.marketDeclinePct < -7, score: 40, explanation: '主要指数单日跌幅超7%——接近熔断' },
  { name: '3日跌>8%', condition: i => i.marketDeclinePct < -8, score: 25, explanation: '三日累计跌幅超8%' },

  // 广度
  { name: '广度<30%', condition: i => i.breadthPct < 30, score: 15, explanation: '全市场<30%股票上涨' },
  { name: '广度<15%', condition: i => i.breadthPct < 15, score: 25, explanation: '普跌——恐慌抛售迹象' },

  // VIX
  { name: 'VIX>30', condition: i => i.vix > 30, score: 15, explanation: 'VIX突破30——恐惧出现' },
  { name: 'VIX>40', condition: i => i.vix > 40, score: 25, explanation: 'VIX突破40——极度恐惧' },
  { name: 'VIX>50', condition: i => i.vix > 50, score: 35, explanation: 'VIX突破50——市场恐慌' },
  { name: 'VIX单日翻倍', condition: i => i.vixChangePct > 100, score: 30, explanation: 'VIX单日翻倍' },

  // 流动性
  { name: '成交量爆量>3×', condition: i => i.volumeSurgeRatio > 3, score: 10, explanation: '恐慌性交易量' },

  // 跨市场
  { name: '3市场同步跌', condition: i => i.crossMarketConfirmation >= 3, score: 15, explanation: '3个以上主要市场同步下跌' },
  { name: '5市场同步跌', condition: i => i.crossMarketConfirmation >= 5, score: 30, explanation: '全球性下跌——系统性风险' },

  // 因子
  { name: '5+因子反转', condition: i => i.factorReversalCount >= 5, score: 10, explanation: '多个因子同时失效' },
  { name: '10+因子反转', condition: i => i.factorReversalCount >= 10, score: 20, explanation: '大量因子失效——市场结构改变' },
];

// ═══════════════════ 崩盘判定引擎 ═══════════════════

export function detectCrash(indicators: CrashRuleResult['indicators']): CrashRuleResult {
  let score = 0;
  const triggers: string[] = [];

  for (const rule of CRASH_RULES) {
    if (rule.condition(indicators)) {
      score += rule.score;
      triggers.push(rule.explanation);
    }
  }

  // 评分→崩盘等级
  let level: CrashLevel;
  if (score >= 100) level = 'PANIC';
  else if (score >= 70) level = 'CRASH';
  else if (score >= 40) level = 'BEAR_TERRITORY';
  else if (score >= 15) level = 'CORRECTION';
  else level = 'NONE';

  // 推送策略
  let push: CrashRuleResult['action']['push'] = 'NONE';
  let cooldown = 0;
  let message = '';

  if (level === 'PANIC') {
    push = 'ALL_USERS';
    cooldown = 30;
    message = `🚨 市场恐慌警报：${triggers.slice(0, 3).join('，')}。冷静，不要恐慌抛售。鲸灵会持续监控并更新。`;
  } else if (level === 'CRASH') {
    push = 'ALL_USERS';
    cooldown = 60;
    message = `⚠️ 市场急剧下跌：${triggers.slice(0, 2).join('，')}。回顾你的止损线，不要冲动交易。`;
  } else if (level === 'BEAR_TERRITORY') {
    push = 'AFFECTED_ONLY';
    cooldown = 120;
    message = `📉 市场进入熊市区域：${triggers[0]}。检查你的仓位暴露和止损设置。`;
  } else if (level === 'CORRECTION') {
    push = 'VIP_ONLY';
    cooldown = 240;
    message = `📊 市场回调：${triggers[0]}。正常调整，不必恐慌。`;
  }

  return {
    timestamp: Date.now(),
    level, score, triggers, indicators,
    action: { push, message, cooldownMinutes: cooldown },
  };
}

// ═══════════════════ 崩溃场景模拟 ═══════════════════

export interface CrashScenario {
  name: string;
  description: string;
  indicators: CrashRuleResult['indicators'];
  expectedLevel: CrashLevel;
  expectedPush: boolean;
}

export const CRASH_SCENARIOS: CrashScenario[] = [
  {
    name: '2020年3月式恐慌',
    description: 'COVID引发的全球性崩盘',
    indicators: {
      marketDeclinePct: -12, breadthPct: 5, vix: 82,
      vixChangePct: 200, volumeSurgeRatio: 5,
      crossMarketConfirmation: 8, factorReversalCount: 15,
    },
    expectedLevel: 'PANIC', expectedPush: true,
  },
  {
    name: '正常回调',
    description: '牛市中的健康调整',
    indicators: {
      marketDeclinePct: -2.5, breadthPct: 35, vix: 18,
      vixChangePct: 30, volumeSurgeRatio: 1.5,
      crossMarketConfirmation: 1, factorReversalCount: 2,
    },
    expectedLevel: 'NONE', expectedPush: false,
  },
  {
    name: '技术性修正',
    description: '-10%左右的回调',
    indicators: {
      marketDeclinePct: -8, breadthPct: 20, vix: 28,
      vixChangePct: 60, volumeSurgeRatio: 2,
      crossMarketConfirmation: 1, factorReversalCount: 5,
    },
    expectedLevel: 'BEAR_TERRITORY', expectedPush: true,
  },
  {
    name: '黑色星期一',
    description: '单日暴跌+全球联动',
    indicators: {
      marketDeclinePct: -20, breadthPct: 2, vix: 120,
      vixChangePct: 500, volumeSurgeRatio: 10,
      crossMarketConfirmation: 12, factorReversalCount: 20,
    },
    expectedLevel: 'PANIC', expectedPush: true,
  },
  {
    name: '平淡的一天',
    description: '正常的市场波动',
    indicators: {
      marketDeclinePct: -0.5, breadthPct: 48, vix: 14,
      vixChangePct: 5, volumeSurgeRatio: 0.8,
      crossMarketConfirmation: 0, factorReversalCount: 0,
    },
    expectedLevel: 'NONE', expectedPush: false,
  },
];

export function validateCrashRules(): { scenario: string; pass: boolean; expected: CrashLevel; got: CrashLevel }[] {
  return CRASH_SCENARIOS.map(s => {
    const result = detectCrash(s.indicators);
    const severityOrder: CrashLevel[] = ['NONE', 'CORRECTION', 'BEAR_TERRITORY', 'CRASH', 'PANIC'];
    const gotIdx = severityOrder.indexOf(result.level);
    const expIdx = severityOrder.indexOf(s.expectedLevel);
    // Allow +/-1 level tolerance
    return {
      scenario: s.name,
      pass: Math.abs(gotIdx - expIdx) <= 1,
      expected: s.expectedLevel,
      got: result.level,
    };
  });
}

export default CrashRuleResult;
