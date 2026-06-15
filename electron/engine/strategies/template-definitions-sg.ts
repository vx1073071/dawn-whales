// ── R222-auto#1: 🇸🇬 新加坡市场策略模板定义 ──────────────────────────────
import type { FactorStrategyTemplate } from './factor-strategy-templates';

export const SG_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'sg-sgx-financial-yield',
    name: 'SGX Financial Yield',
    nameCn: '新加坡金融收息',
    category: 'sg',
    difficulty: 2,
    timeHorizon: 'position',
    expectedHoldingDays: '60-180天',
    holdingDays: { min: 60, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '买入新加坡三大银行+REIT龙头，股息率>4%+PB<1.2时建仓，每季度再平衡。稳定收息+估值修复双驱动。',
      stopLossRule: '银行股PB跌破0.8止损，REIT股价跌破NAV 20%止损。',
      marketScope: [{ market: '🇸🇬', assetClass: '股票+REIT' }],
      failureCheck: 'MAS加息周期时暂停加仓；新加坡GDP连续2季负增长时减仓。',
    },
    factorCombo: [
      { factorId: 'FACTOR_DIVIDEND_YIELD', factorName: '股息率因子', weight: 35, direction: 'long' },
      { factorId: 'FACTOR_VALUE_PB', factorName: '市净率价值', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_LOW_VOL', factorName: '低波动因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_QUALITY_ROE', factorName: 'ROE质量因子', weight: 10, direction: 'long' },
      { factorId: 'FACTOR_SG_FOREIGN_FLOW', factorName: '外资流向因子', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'sg-yield-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'SG银行+REIT除息日历推送' },
      { id: 'sg-yield-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '月度组合体检+股息安全评估' },
      { id: 'sg-yield-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '新加坡金融板块景气分析' },
    ],
    tags: ['sg', 'dividend', 'financial', 'reit'],
    version: '2.1.0',
  },
];

export default SG_TEMPLATES;
