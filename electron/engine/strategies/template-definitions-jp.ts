// ── R222-auto#1: 🇯🇵 日本市场策略模板定义 ────────────────────────────────

import type { FactorStrategyTemplate } from './factor-strategy-templates';

export const JP_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'jp-jpx-value-repair',
    name: 'JPX Value Repair',
    nameCn: '日股价值修复',
    category: 'jp',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '买入东证一部PB<1.0、ROE>8%、且正在回购的日本价值股，等待PB修复至1.2以上获利。',
      stopLossRule: '单只股票PB继续下行至0.7以下止损，或公司取消回购计划时卖出。',
      marketScope: [{ market: '🇯🇵', assetClass: '股票' }],
      failureCheck: '日经225跌破25000点时暂停；日本央行加息周期时重新评估。',
    },
    factorCombo: [
      { factorId: 'FACTOR_VALUE_PB', factorName: '市净率价值', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_QUALITY_ROE', factorName: 'ROE质量因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_BUYBACK', factorName: '回购因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_DIVIDEND_YIELD', factorName: '股息率因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_JP_FOREIGN_FLOW', factorName: '外资流向因子', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'jp-jpx-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '日股价值修复潜力+外资动向分析' },
      { id: 'jp-jpx-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '回购公告+外资增减持信号' },
      { id: 'jp-jpx-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '日股组合健康度+治理改善跟踪' },
      { id: 'jp-jpx-alt', label: 'ALT数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 1.5, description: '东京证券交易所披露数据+NISA账户流向' },
    ],
    tags: ['jp', 'value', 'buyback', 'corporate-governance'],
    version: '2.1.0',
  },
  {
    id: 'jp-nisa-dca-enhanced',
    name: 'NISA DCA Enhanced',
    nameCn: 'NISA定投增强',
    category: 'jp',
    difficulty: 1,
    timeHorizon: 'long-term',
    expectedHoldingDays: '长期持有',
    holdingDays: { min: 180, max: 365, unit: 'day' },
    fourIronRules: {
      humanLine: '利用日本NISA免税账户，每月定投日经225ETF+TOPIX，PE<14时加倍投入，PE>18时减半。',
      stopLossRule: '日经225跌破200日均线时暂停加仓，但不卖出（长期持有策略）。',
      marketScope: [{ market: '🇯🇵', assetClass: 'ETF' }],
      failureCheck: '日本央行加息超过0.5%时重新评估；日元汇率极端贬值(>160)时调整。',
    },
    factorCombo: [
      { factorId: 'FACTOR_MARKET_INDEX', factorName: '市场指数因子', weight: 40, direction: 'long' },
      { factorId: 'FACTOR_VALUE_PE', factorName: '市盈率价值因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_JP_FOREIGN_FLOW', factorName: '外资流向因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_MOM_12M', factorName: '12个月动量', weight: 10, direction: 'long' },
      { factorId: 'FACTOR_VOLATILITY', factorName: '波动率因子', weight: 10, direction: 'short' },
    ],
    aiTriggerPoints: [
      { id: 'jp-nisa-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '月度NISA组合体检+定投金额优化建议' },
      { id: 'jp-nisa-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '日股估值+日元汇率综合分析' },
    ],
    tags: ['jp', 'dca', 'nisa', 'index', 'tax-advantaged'],
    version: '2.1.0',
  },
];

export default JP_TEMPLATES;
