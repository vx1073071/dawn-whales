// ── R222-auto#1: 🇹🇼 台湾市场策略模板定义 ────────────────────────────────
import type { FactorStrategyTemplate } from './factor-strategy-templates';

export const TW_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'tw-twse-electronic-exdiv',
    name: 'TWSE Electronic Ex-Dividend',
    nameCn: '台湾电子除权息策略',
    category: 'tw',
    difficulty: 2,
    timeHorizon: 'swing',
    expectedHoldingDays: '14-45天',
    holdingDays: { min: 14, max: 45, unit: 'day' },
    fourIronRules: {
      humanLine: '台股电子股除权息前30日买入，赚取填权息行情+外资回补。殖利率>4%+外资连续买入信号。',
      stopLossRule: '除权息后10日未填权息止损，或外资转卖超过3日止损。',
      marketScope: [{ market: '🇹🇼', assetClass: '股票' }],
      failureCheck: '台积电营收连续2月下滑时暂停；台币大幅贬值时调整。',
    },
    factorCombo: [
      { factorId: 'FACTOR_DIVIDEND_YIELD', factorName: '股息率因子', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_TW_FOREIGN_FLOW', factorName: '外资流向因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_EARNINGS_GROWTH', factorName: '盈利增长因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_MOM_6M', factorName: '6个月动量', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_SEMI_CYCLE', factorName: '半导体周期因子', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'tw-exdiv-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '除权息日历+填权息概率推送' },
      { id: 'tw-exdiv-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '除权息组合健康度+外资动向跟踪' },
      { id: 'tw-exdiv-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '台股电子产业景气+除权息策略优化' },
    ],
    tags: ['tw', 'dividend', 'electronics', 'foreign-flow'],
    version: '2.1.0',
  },
];

export default TW_TEMPLATES;
