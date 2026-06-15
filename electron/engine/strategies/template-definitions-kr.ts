// ── R222-auto#1: 🇰🇷 韩国市场策略模板定义 ────────────────────────────────

import type { FactorStrategyTemplate } from './factor-strategy-templates';

export const KR_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'kr-krx-momentum',
    name: 'KRX Momentum',
    nameCn: '韩国动量选股',
    category: 'kr',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '14-45天',
    holdingDays: { min: 14, max: 45, unit: 'day' },
    fourIronRules: {
      humanLine: '选择KOSPI中12个月动量最高的前20%股票，配合外资买入信号，月度调仓。动量+资金流双确认。',
      stopLossRule: '个股动量排名跌出前30%时卖出，或外资连续3日净卖出时止损。',
      marketScope: [{ market: '🇰🇷', assetClass: '股票' }],
      failureCheck: 'KOSPI跌破200日均线时暂停；韩元汇率单月波动超过5%时调整仓位。',
    },
    factorCombo: [
      { factorId: 'FACTOR_MOM_12M', factorName: '12个月动量', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_KR_FOREIGN_FLOW', factorName: '外资流向因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_MOM_6M', factorName: '6个月动量', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_TURNOVER_RATE', factorName: '换手率因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_EARNINGS_GROWTH', factorName: '盈利增长因子', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'kr-mom-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '动量排名变动+外资异动推送' },
      { id: 'kr-mom-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '月度动量组合健康度检查' },
      { id: 'kr-mom-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'KOSPI行业动量轮动分析' },
    ],
    tags: ['kr', 'momentum', 'foreign-flow'],
    version: '2.1.0',
  },
  {
    id: 'kr-krx-export-cycle',
    name: 'KRX Export Cycle',
    nameCn: '韩国出口周期策略',
    category: 'kr',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '追踪韩国月度出口数据（半导体/汽车/石化），出口增速转正+连续2月上升时做多出口龙头。',
      stopLossRule: '出口增速转负时减仓50%，连续2月下降时清仓。',
      marketScope: [{ market: '🇰🇷', assetClass: '股票' }],
      failureCheck: '全球PMI连续3月低于50时策略失效；韩元大幅升值(>5%/月)时暂停。',
    },
    factorCombo: [
      { factorId: 'FACTOR_EXPORT_GROWTH', factorName: '出口增速因子', weight: 35, direction: 'long' },
      { factorId: 'FACTOR_GLOBAL_PMI', factorName: '全球PMI因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_SEMI_CYCLE', factorName: '半导体周期因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_KR_FOREIGN_FLOW', factorName: '外资流向因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_VALUE_PB', factorName: '市净率价值', weight: 15, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'kr-export-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '韩国出口数据发布+周期信号推送' },
      { id: 'kr-export-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '出口周期+行业前景综合分析' },
      { id: 'kr-export-alt', label: 'ALT数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 1.5, description: '韩国海关实时出口数据+半导体出货量' },
    ],
    tags: ['kr', 'macro', 'export', 'cyclical'],
    version: '2.1.0',
  },
];

export default KR_TEMPLATES;
