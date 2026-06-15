// ── R222-auto#1: 🇪🇺 欧洲市场策略模板定义 ────────────────────────────────
import type { FactorStrategyTemplate } from './factor-strategy-templates';

export const EU_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'eu-stoxx-esg-premium',
    name: 'STOXX ESG Premium',
    nameCn: '欧股ESG溢价策略',
    category: 'eu',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '60-180天',
    holdingDays: { min: 60, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '买入STOXX 600中ESG评分>80+股息率>3%+ROE>12%的欧洲龙头，享受ESG资金流入溢价+稳定分红。',
      stopLossRule: 'ESG评分降至70分以下卖出，或股息率降至2%以下减仓。',
      marketScope: [{ market: '🇪🇺', assetClass: '股票' }],
      failureCheck: '欧洲碳价暴跌(>30%)时暂停；EU经济衰退预期时重新评估。',
    },
    factorCombo: [
      { factorId: 'FACTOR_ESG_SCORE', factorName: 'ESG评分因子', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_DIVIDEND_YIELD', factorName: '股息率因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_QUALITY_ROE', factorName: 'ROE质量因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_LOW_CARBON', factorName: '低碳因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_MOM_12M', factorName: '12个月动量', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'eu-esg-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'ESG评级变动+碳价信号推送' },
      { id: 'eu-esg-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '月度ESG组合体检+评级跟踪' },
      { id: 'eu-esg-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '欧洲ESG政策+资金流综合分析' },
    ],
    tags: ['eu', 'esg', 'sustainability', 'dividend', 'quality'],
    version: '2.1.0',
  },
];

export default EU_TEMPLATES;
