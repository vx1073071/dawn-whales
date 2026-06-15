// ── R222-auto#1: 🇮🇳 印度市场策略模板定义 ────────────────────────────────
import type { FactorStrategyTemplate } from './factor-strategy-templates';

export const IN_TEMPLATES: FactorStrategyTemplate[] = [
  {
    id: 'in-nse-it-outsourcing',
    name: 'NSE IT Outsourcing',
    nameCn: '印度IT外包龙头',
    category: 'in',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '60-180天',
    holdingDays: { min: 60, max: 180, unit: 'day' },
    fourIronRules: {
      humanLine: '买入NSE IT外包龙头(TCS/Infosys/Wipro)，季度收入增速>15%+美元兑卢比走强时建仓。IT服务外包周期+汇率双驱动。',
      stopLossRule: '季度收入增速降至10%以下减仓，连续2季下滑清仓。',
      marketScope: [{ market: '🇮🇳', assetClass: '股票' }],
      failureCheck: '全球IT支出预测转负时策略失效；卢比大幅升值(>5%)时暂停。',
    },
    factorCombo: [
      { factorId: 'FACTOR_EARNINGS_GROWTH', factorName: '盈利增长因子', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_INR_USD', factorName: '卢比兑美元因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_IT_SPENDING', factorName: '全球IT支出因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_MOM_12M', factorName: '12个月动量', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_QUALITY_ROE', factorName: 'ROE质量因子', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'in-it-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'IT公司财报+外汇汇率信号推送' },
      { id: 'in-it-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '月度IT组合健康度+订单跟踪' },
      { id: 'in-it-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '印度IT产业竞争力+全球外包趋势分析' },
    ],
    tags: ['in', 'it', 'outsourcing', 'earnings'],
    version: '2.1.0',
  },
  {
    id: 'in-nse-inflation-hedge',
    name: 'NSE Inflation Hedge',
    nameCn: '印度通胀对冲',
    category: 'in',
    difficulty: 3,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '印度CPI>6%时配置黄金ETF+消费必需品龙头+基础设施股，利用通胀传导+国内消费韧性对冲通胀。',
      stopLossRule: 'CPI回落至4%以下时逐步退出；黄金价格单月跌幅超过10%止损。',
      marketScope: [{ market: '🇮🇳', assetClass: 'ETF+股票' }],
      failureCheck: 'RBI降息周期时策略效率降低；卢比剧烈波动时调整黄金仓位。',
    },
    factorCombo: [
      { factorId: 'FACTOR_INFLATION', factorName: '通胀因子', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_CONSUMER_DEFENSIVE', factorName: '消费防御因子', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_GOLD_PRICE', factorName: '黄金价格因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_INFRASTRUCTURE', factorName: '基础设施因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_INR_USD', factorName: '卢比兑美元因子', weight: 10, direction: 'short' },
    ],
    aiTriggerPoints: [
      { id: 'in-cpi-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '印度CPI+黄金价格信号推送' },
      { id: 'in-cpi-health', label: '健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '月度通胀对冲组合审视' },
      { id: 'in-cpi-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '印度宏观经济+通胀趋势预测' },
      { id: 'in-cpi-alt', label: 'ALT数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 1.5, description: '印度农村消费+PMI高频数据' },
    ],
    tags: ['in', 'inflation', 'hedge', 'gold', 'consumer'],
    version: '2.1.0',
  },
  {
    id: 'in-nifty50-rotation',
    name: 'Nifty50 Sector Rotation',
    nameCn: 'Nifty50板块轮动',
    category: 'in',
    difficulty: 4,
    timeHorizon: 'swing',
    expectedHoldingDays: '14-45天',
    holdingDays: { min: 14, max: 45, unit: 'day' },
    fourIronRules: {
      humanLine: '基于Nifty50板块相对强弱，每月买入最强3个板块+卖出最弱3个板块，动量轮动+资金流确认。',
      stopLossRule: '单个板块ETF跌幅超过8%止损，最强板块排名掉出前5时换仓。',
      marketScope: [{ market: '🇮🇳', assetClass: 'ETF' }],
      failureCheck: 'Nifty50跌破200日均线时暂停；卢比单月贬值超过5%时降低仓位。',
    },
    factorCombo: [
      { factorId: 'FACTOR_SECTOR_MOMENTUM', factorName: '板块动量因子', weight: 30, direction: 'long' },
      { factorId: 'FACTOR_MOM_6M', factorName: '6个月动量', weight: 25, direction: 'long' },
      { factorId: 'FACTOR_FII_FLOW', factorName: '外资机构流向因子', weight: 20, direction: 'long' },
      { factorId: 'FACTOR_DII_FLOW', factorName: '国内机构流向因子', weight: 15, direction: 'long' },
      { factorId: 'FACTOR_VOLATILITY', factorName: '波动率因子', weight: 10, direction: 'short' },
    ],
    aiTriggerPoints: [
      { id: 'in-rot-signal', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '板块强弱变动+轮动信号推送' },
      { id: 'in-rot-backtest', label: '回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'Nifty板块轮动历史回测' },
      { id: 'in-rot-diagnosis', label: '深度诊断', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '印度板块轮动+资金流综合分析' },
    ],
    tags: ['in', 'sector-rotation', 'momentum', 'nifty50'],
    version: '2.1.0',
  },
];

export default IN_TEMPLATES;
