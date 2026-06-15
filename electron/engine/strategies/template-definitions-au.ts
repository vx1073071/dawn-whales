// ── R222-auto#1: 🇦🇺 澳大利亚市场策略模板定义 ──────────────────────────────
import type { FactorStrategyTemplate } from './factor-strategy-templates';

export const AU_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'au-asx-resource-franking',
    name: 'ASX Resource Franking',
    nameCn: '澳洲资源股红利抵免',
    category: 'au',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '60-180天',
    holdingDays: { min: 60, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '买入ASX资源股(必和必拓/力拓)+银行股，利用franking credit税务抵免，股息率>5%+铁矿石价格>100美元时建仓。',
      stopLossRule: '铁矿石价格跌破80美元止损资源仓位；银行股股息率降至3%以下卖出。',
      marketScope: [{ market: '🇦🇺', assetClass: '股票' }],
      failureCheck: '澳洲RBA连续降息时重新评估；中国经济硬着陆风险时暂停资源仓位。',
    },
    factorCombo: [
      { factorId: 'FACTOR_DIVIDEND_YIELD', factorName: '股息率因子', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_COMMODITY_PRICE', factorName: '商品价格因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_FRANKING_CREDIT', factorName: '红利抵免因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_CHINA_DEMAND', factorName: '中国需求因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_VALUE_PB', factorName: '市净率价值', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'au-resource-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '铁矿石/煤炭价格+除息日历推送' },
      { id: 'au-resource-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '月度组合体检+商品周期风险分析' },
      { id: 'au-resource-alt', label: 'ALT数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 1.5, description: '澳洲港口出货量+中国工业数据' },
      { id: 'au-resource-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '大宗商品超级周期+澳元汇率分析' },
    ],
    tags: ['au', 'resources', 'dividend', 'franking', 'commodity'],
    version: '2.1.0',
  },
];

export default AU_TEMPLATES;
