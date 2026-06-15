// ── R217-auto#1 (P13): TouchpointTemplateIndex 反向索引 ────────────────────
// 触点→模板反向映射 + 数据驱动优化建议
// 用途: 查询"哪些模板用了AI_HEALTH_CHECK?" / 覆盖率统计 / 收入分析
// 依赖: factor-strategy-templates.ts (静态分析, 构建时生成)

// ── Types ──────────────────────────────────────────────────────────────────

export interface TouchpointTemplateEntry {
  templateId: string;
  templateName: string;
  templateNameCn: string;
  category: string;
  costUSDT: number;
  description: string;
}

export interface TouchpointStats {
  touchpointId: string;
  touchpointLabel: string;
  templateCount: number;
  templates: string[];                // template IDs
  totalCostUSDT: number;             // sum of all template costs for this touchpoint
  avgCostUSDT: number;
  coveragePercent: number;           // % of 44 templates
  marketDistribution: Record<string, number>; // market → template count
}

export interface TouchpointCoverage {
  totalTemplates: number;
  touchpoints: TouchpointStats[];
  summary: {
    fullyCovered: number;            // touchpoints on all 44
    mostlyCovered: number;           // touchpoints on ≥60% templates
    partiallyCovered: number;        // touchpoints on ≥20% templates
    barelyCovered: number;           // touchpoints on <20% templates
  };
}

export interface TouchpointRevenue {
  touchpointId: string;
  touchpointLabel: string;
  totalRevenue: number;              // sum of costUSDT × 1 activation
  perTemplate: Array<{ templateId: string; costUSDT: number }>;
  activationRevenue: number;         // if all 44 activated once
}

export interface TouchpointOptimizationSuggestion {
  templateId: string;
  templateName: string;
  currentTouchpoints: string[];
  suggestedTouchpoint: string;
  suggestedLabel: string;
  costUSDT: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  revenueImpact: number;             // estimated additional revenue if added to all suggested
  similarTemplate: string;            // template that already has this touchpoint
}

export interface TouchpointHeatmapCell {
  templateId: string;
  templateName: string;
  category: string;
  touchpoints: Record<string, boolean>; // touchpointId → has/not
}

// ═══════════════════════════════════════════════════════════════════════════
// TOUCHPOINT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOUCHPOINT_DEFS: Record<string, { label: string; defaultCost: number }> = {
  'FACTOR_ALT_DATA_UNLOCK':    { label: '替代数据解锁',     defaultCost: 2 },
  'AI_HEALTH_CHECK':           { label: 'AI策略健康检查',   defaultCost: 1 },
  'FACTOR_PARAM_OPTIMIZE':     { label: 'AI参数优化',       defaultCost: 1.5 },
  'AI_BACKTEST_READ':          { label: 'AI回测解读',       defaultCost: 1 },
  'AI_DEEP_DIAGNOSIS':         { label: 'AI深度诊断',       defaultCost: 1.5 },
  'AI_ATTRIBUTION':            { label: 'AI收益归因',       defaultCost: 2 },
  'AI_FACTOR_SIGNAL_PUSH':     { label: '因子信号推送',     defaultCost: 0.5 },
  'AI_SMART_PICK':             { label: '智能选股',         defaultCost: 1 },
  'AI_MARKET_SENTIMENT':       { label: '市场情绪分析',     defaultCost: 1 },
  'AI_SENTIMENT_PULSE':        { label: '情绪脉冲',         defaultCost: 0.5 },
  'AI_ARBITRAGE_SCAN':         { label: '套利机会扫描',     defaultCost: 1.5 },
  'AI_PORTFOLIO_DIAGNOSE':     { label: '持仓诊断',         defaultCost: 2 },
};

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE-TO-TOUCHPOINT MAPPING (extracted from factor-strategy-templates.ts)
// Generated at build time; this is the canonical mapping for the index engine.
// ═══════════════════════════════════════════════════════════════════════════

interface TemplateTouchpointMap {
  id: string;
  name: string;
  nameCn: string;
  category: string;
  touchpoints: Array<{ id: string; touchpointId: string; costUSDT: number; description: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE DATA (extracted — 44 templates × touchpoints)
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATE_TOUCHPOINTS: TemplateTouchpointMap[] = [
  // ── HK (10) ──
  { id: 'hk-ah-premium', name: 'AH Premium', nameCn: 'AH溢价套利', category: 'hk', touchpoints: [
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: 'AH溢价实时数据+互联互通额度' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'AH溢价策略回测解读' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '溢价收敛概率+持仓风险诊断' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'AH溢价突破阈值实时推送' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AH溢价策略健康: 价差仍在历史区间? 套利窗口>1%?' },
  ]},
  { id: 'hk-dividend-ladder', name: 'Dividend Ladder', nameCn: '港股股息阶梯', category: 'hk', touchpoints: [
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '检查持仓股息是否可持续' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化股息率阈值和仓位分配' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '港股股息策略历史表现分析' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港交所披露易+公司公告派息预测数据' },
  ]},
  { id: 'hk-southbound-tracker', name: 'Southbound Smart Money', nameCn: '南向聪明钱追踪', category: 'hk', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '南向资金集中度+持仓风险诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '南向资金历史有效性分析' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港股通北向资金+港交所CCASS持仓替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '南向资金策略健康: 资金流向趋势延续? IC>0.03?' },
  ]},
  { id: 'hk-redchip-homecoming', name: 'Red Chip Homecoming', nameCn: '红筹回归套利', category: 'hk', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '回A进程加速概率诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '历史红筹回A案例复盘' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '红筹回A审批进度变化推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港股红筹公司财务数据源' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '红筹回A策略健康: 回A进度正常? 价差合理?' },
  ]},
  { id: 'hk-warrant-direction', name: 'Warrant Direction', nameCn: '窝轮方向追踪', category: 'hk', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '牛熊证分布+方向力量诊断' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '牛熊证比例突变实时推送' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '牛熊证指标择时有效性回测' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '牛熊证街货量+发行商对冲数据' },
  ]},
  { id: 'hk-reit-yield', name: 'REIT Yield Harvest', nameCn: '港股REIT收租机', category: 'hk', touchpoints: [
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'REIT租金收入+派息可持续性检查' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '港股REIT历史收益分析' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'REIT资产质量+利率敏感性诊断' },
  ]},
  { id: 'hk-ipo-flip', name: 'IPO Flip', nameCn: '港股打新翻倍', category: 'hk', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'IPO超额认购倍数+暗盘走势分析' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '港股IPO首日涨幅统计分析' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'IPO打新健康: 首日涨幅分布正常? 市场热度?' },
  ]},
  { id: 'hk-short-squeeze', name: 'Short Squeeze Hunter', nameCn: '港股沽空挤压', category: 'hk', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '沽空比例+挤压概率诊断' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '沽空仓位+借货费率替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '沽空挤压健康: 沽空比例正常? 挤压概率合理?' },
  ]},
  // ── Crypto (8) ──
  { id: 'crypto-btc-trend', name: 'BTC Trend', nameCn: 'BTC趋势跟踪', category: 'crypto', touchpoints: [
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '链上数据: MVRV/交易所流入/矿工持仓' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'BTC链上+技术面深度诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'BTC动量策略历史周期分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'BTC趋势突破/反转信号实时推送' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'BTC趋势策略月度健康体检: IC>0.02? 因子相关性<0.7?' },
  ]},
  { id: 'crypto-eth-btc-rotation', name: 'ETH/BTC Rotation', nameCn: 'ETH/BTC轮动', category: 'crypto', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'ETH/BTC相对强弱+链上活动诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'ETH/BTC轮动历史回测解读' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'ETH/BTC比率突破信号推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: 'ETH链上Gas费+稳定币供应+DeFi TVL替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'ETH/BTC轮动策略健康检查: 轮动信号准确率>60%?' },
  ]},
  { id: 'crypto-funding-arbitrage', name: 'Funding Rate Arbitrage', nameCn: '资金费率套利', category: 'crypto', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '永续合约资金费率+持仓集中度诊断' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '资金费率异动触发套利窗口推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '交易所BTC储备+稳定币流入/流出替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '资金费率套利健康: 套利空间持续存在? 执行成功率>90%?' },
  ]},
  { id: 'crypto-liquidation-hunt', name: 'Liquidation Hunt', nameCn: '清算猎杀', category: 'crypto', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '期货爆仓热力图+清算墙诊断' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '清算墙突破+爆仓密集区推送' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '清算狩猎策略历史有效性分析' },
  ]},
  { id: 'crypto-onchain-three-lights', name: 'Onchain Three Lights', nameCn: '链上三灯信号', category: 'crypto', touchpoints: [
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '链上三灯数据: 交易所余额+活跃地址+NVT' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '三灯信号综合诊断+可信度评分' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '链上三灯信号历史准确性回测' },
  ]},
  { id: 'crypto-futures-spot-arb', name: 'Futures-Spot Arbitrage', nameCn: '期现套利', category: 'crypto', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '期货升贴水+交割日风险诊断' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '期现价差异动突破套利阈值推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '期货持仓量+多空比+清算热力图替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '期现套利健康: 价差>交易成本? IC持续为正?' },
  ]},
  { id: 'crypto-hodl-dca-enhanced', name: 'HODL DCA Enhanced', nameCn: 'HODL定投增强', category: 'crypto', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '周期位置诊断+定投加速/减速建议' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'DCA策略历史表现+最大回撤分析' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化定投频率+金额分配' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'DCA加速/减速信号推送(超跌加仓/过热减仓)' },
  ]},
  { id: 'crypto-whale-tracker', name: 'Whale Tracker', nameCn: '巨鲸追踪', category: 'crypto', touchpoints: [
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '大额转账+交易所巨鲸地址监控' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '巨鲸行为模式+意图诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '巨鲸行为与价格走势关联分析' },
  ]},
  // ── JP (2) ──
  { id: 'jp-jpx-value-repair', name: 'JPX Value Repair', nameCn: 'JPX价值修复', category: 'jp', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '日本公司治理改善+回购力度诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '日股价值因子历史表现分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '东证改革新政策/回购公告推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '东京证交所披露数据+外资持股变动替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'JPX价值修复健康: 价值因子溢价持续? 公司治理改善?' },
  ]},
  { id: 'jp-nisa-dca-enhanced', name: 'NISA DCA Enhanced', nameCn: 'NISA定投增强', category: 'jp', touchpoints: [
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'NISA定投组合季度健康检查' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '定投策略日本市场历史回测' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: 'NISA额度+定投频率优化' },
  ]},
  // ── KR (2) ──
  { id: 'kr-krx-momentum', name: 'KRX Momentum', nameCn: 'KRX动量追踪', category: 'kr', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'KOSPI动量因子+外资流向诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '韩国动量因子历史表现分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'KOSPI动量突破+外资大额买入推送' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'KRX动量策略健康: 动量因子IC>0? 换手率合理?' },
  ]},
  { id: 'kr-krx-export-cycle', name: 'KRX Export Cycle', nameCn: 'KRX出口周期轮动', category: 'kr', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '半导体出口+全球经济周期诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '出口周期与股价关联回测' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '韩国出口数据+半导体景气推送' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'KRX出口周期健康: 出口数据与股价相关性稳定?' },
  ]},
  // ── TW (1) ──
  { id: 'tw-twse-electronic-exdiv', name: 'TWSE Electronic Ex-Div', nameCn: 'TWSE电子除权息行情', category: 'tw', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '台股填息概率+产业景气诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '台股除权息后填息率分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '台积电/联发科等权值股除权息日历推送' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'TWSE除权息健康: 填息率>70%? 因子稳定性?' },
  ]},
  // ── SG (2) ──
  { id: 'sg-sgx-financial-yield', name: 'SGX Financial Yield', nameCn: 'SGX金融高息', category: 'sg', touchpoints: [
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '新加坡REIT+银行股收息健康检查' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '新加坡金融板块收益历史' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'SGD利率环境+REIT资产质量诊断' },
  ]},
  { id: 'sg-sgx-reit-enhanced', name: 'SGX REIT Enhanced', nameCn: '新加坡REIT增强', category: 'sg', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'S-REIT商业地产+酒店REIT分类诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'S-REIT板块轮动分析' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: 'REIT权重+子行业配置优化' },
  ]},
  // ── AU (1) ──
  { id: 'au-asx-resource-franking', name: 'ASX Resource Franking', nameCn: 'ASX资源Franking双收', category: 'au', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '铁矿石/煤炭价格+澳元汇率诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '澳洲矿业分红历史分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '铁矿石FOB价格+澳元突破推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '澳洲港口出货量+矿山生产报告替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'ASX资源策略健康: 大宗商品与股价相关性? Franking信用?' },
  ]},
  // ── IN (3) ──
  { id: 'in-nse-it-outsourcing', name: 'NSE IT Outsourcing', nameCn: 'NSE IT外包动量', category: 'in', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '印度IT支出+外包订单+汇率诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '印度IT板块周期分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'TCS/Infosys/Wipro财报+订单推送' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'NSE IT外包健康: IT支出趋势延续? 汇率影响可控?' },
  ]},
  { id: 'in-nifty50-rotation', name: 'Nifty50 Rotation', nameCn: 'Nifty50轮动', category: 'in', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'Nifty行业轮动+外资FII流向诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '印度行业轮动历史有效性分析' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'Nifty50轮动健康: 因子轮动超额>基准? IC>0?' },
  ]},
  { id: 'in-nse-inflation-hedge', name: 'NSE Inflation Hedge', nameCn: 'NSE通胀对冲', category: 'in', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '印度CPI+食品通胀+季风影响诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '印度通胀敏感资产历史分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '印度CPI数据公布+食品价格异动推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '印度CPI成分价格+季风降雨替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'NSE通胀对冲健康: 通胀敏感度稳定? 因子有效性?' },
  ]},
  // ── EU (1) ──
  { id: 'eu-stoxx-esg-premium', name: 'STOXX ESG Premium', nameCn: 'STOXX ESG溢价捕获', category: 'eu', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '欧洲碳价+ESG评级变动诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'ESG因子在欧洲市场溢价分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'EU碳价+ESG评级调整推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: 'EU排放权价格+公司ESG披露替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'STOXX ESG健康: ESG评级变动趋势? 碳价影响?' },
  ]},
  // ── Cross-market (2) ──
  { id: 'xm-ah-premium-plus', name: 'AH Premium Plus', nameCn: 'AH溢价增强版', category: 'cross', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: 'AH溢价+互联互通+汇率综合诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'AH溢价历史均值回归分析' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: 'AH溢价阈值+仓位动态优化' },
  ]},
  { id: 'xm-southbound-plus', name: 'Southbound Plus', nameCn: '南向增强版', category: 'cross', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '南向资金+恒生指数+离岸人民币综合诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '南向资金超额收益归因' },
  ]},
  // ── AI (14) ──
  { id: 'ai-value-hunter', name: 'AI Value Hunter', nameCn: 'AI价值猎手', category: 'ai', touchpoints: [
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'AI选股历史表现回测' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '价值因子+质量因子综合诊断' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '价值因子有效性+持仓质量检查' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '价值洼地标的新增推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '13F机构持仓+内幕交易披露替代数据' },
  ]},
  { id: 'ai-momentum-chaser', name: 'AI Momentum Chaser', nameCn: 'AI动量猎手', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '多周期动量+波动率诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '动量因子多市场回测' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '动量突破+趋势确认信号推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '跨市场资金流+社交媒体情绪替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AI动量策略月度体检: 各因子IC衰减? 过拟合风险?' },
  ]},
  { id: 'ai-arbitrage-engine', name: 'AI Arbitrage Engine', nameCn: 'AI套利引擎', category: 'ai', touchpoints: [
    { id: 'arbitrage-scan', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 1.5, description: '多市场套利机会扫描' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '套利空间+交易成本综合分析' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '套利策略历史胜率分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '套利窗口打开+关闭实时推送' },
  ]},
  { id: 'ai-timing-oracle', name: 'AI Timing Oracle', nameCn: 'AI择时先知', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '多维度择时信号综合判断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '择时信号历史准确性分析' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '择时阈值+信号权重优化' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '期权订单流+暗池交易量替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AI择时策略健康: 信号准确率>55%? 各维度贡献?' },
  ]},
  { id: 'ai-risk-sentinel', name: 'AI Risk Sentinel', nameCn: 'AI风控哨兵', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '组合风险+尾部风险+压力测试' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '风险指标健康度+预警阈值检查' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '风险预警+VaR突破阈值推送' },
    { id: 'arbitrage-scan', touchpointId: 'AI_ARBITRAGE_SCAN', costUSDT: 1.5, description: '对冲机会+保险成本扫描' },
  ]},
  { id: 'ai-portfolio-builder', name: 'AI Portfolio Builder', nameCn: 'AI组合大师', category: 'ai', touchpoints: [
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '组合历史表现+风险收益分析' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '组合持仓+因子暴露诊断' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '组合健康度+再平衡建议' },
    { id: 'attribution', touchpointId: 'AI_ATTRIBUTION', costUSDT: 2, description: '组合收益归因+因子贡献分解' },
  ]},
  { id: 'ai-stock-screener', name: 'AI Stock Screener', nameCn: 'AI选股大师', category: 'ai', touchpoints: [
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '选股策略历史胜率分析' },
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '选股因子+持仓集中度诊断' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '新增入选/淘汰标的推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '招聘数据+APP下载量+信用卡消费替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AI选股策略健康: 月胜率>55%? 因子暴露漂移?' },
  ]},
  { id: 'ai-sector-rotator', name: 'AI Sector Rotator', nameCn: 'AI行业轮动', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '行业轮动+宏观周期诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '行业轮动历史超额收益分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '行业轮动信号+板块切换推送' },
  ]},
  { id: 'ai-event-catalyst', name: 'AI Event Catalyst', nameCn: 'AI事件驱动', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '事件类型+影响力度+持续性诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '事件驱动策略历史胜率分析' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '新闻情绪+NLP事件分类替代数据' },
  ]},
  { id: 'ai-rebalance-optimizer', name: 'AI Rebalance Optimizer', nameCn: 'AI调仓大师', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '持仓偏离度+再平衡必要性诊断' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '组合权重漂移+再平衡信号' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '再平衡频率+阈值优化' },
    { id: 'attribution', touchpointId: 'AI_ATTRIBUTION', costUSDT: 2, description: '再平衡贡献归因+交易成本分析' },
  ]},
  { id: 'ai-factor-rotation', name: 'AI Factor Rotation', nameCn: 'AI因子轮动', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '因子动量+因子拥挤度诊断' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '因子权重+切换频率优化' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '因子轮动信号+因子失效预警推送' },
  ]},
  { id: 'ai-timing-enhanced', name: 'AI Timing Enhanced', nameCn: 'AI择时增强', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '多时间框架择时+趋势一致性诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '增强择时信号回测' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '择时参数+信号过滤器优化' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '高频数据+订单流替代数据' },
  ]},
  { id: 'ai-hedge-enhanced', name: 'AI Hedge Enhanced', nameCn: 'AI对冲增强', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '对冲比率+对冲成本+有效性诊断' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '对冲比率+对冲工具选择优化' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '对冲策略保护效果分析' },
  ]},
  { id: 'ai-long-term-growth', name: 'AI Long-Term Growth', nameCn: 'AI长期增长', category: 'ai', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '成长因子+估值合理性诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '长期增长策略历史分析' },
    { id: 'param-optimize', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '增长/价值权重+仓位优化' },
  ]},
  // ── Cross-data (4) ──
  { id: 'xm-fx-hedge', name: 'FX Hedge', nameCn: '汇率对冲矩阵', category: 'cross', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '汇率走势+利差+资本流动诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '外汇对冲策略历史有效性' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '汇率突破+央行干预信号推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '央行利率预期+跨境资金流替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '外汇对冲健康: 对冲有效性>80%? 成本合理?' },
  ]},
  { id: 'xm-rate-spread', name: 'Rate Spread', nameCn: '全球利率差交易', category: 'cross', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '利差曲线+央行政策预期诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '利差交易历史表现分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '利差异动+降息/加息预期推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '各国CPI/PPI+贸易余额替代数据' },
  ]},
  { id: 'xm-credit-arbitrage', name: 'Credit Arbitrage', nameCn: '跨境信贷套利', category: 'cross', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '信用利差+违约风险诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '信用套利历史分析' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: 'CDS价格+债券利差替代数据' },
  ]},
  { id: 'xm-commodity-pair', name: 'Commodity Pair', nameCn: '商品配对交易', category: 'commodity', touchpoints: [
    { id: 'deep-diagnosis', touchpointId: 'AI_DEEP_DIAGNOSIS', costUSDT: 1.5, description: '商品价格+商品货币+季节性诊断' },
    { id: 'backtest-read', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '商品货币对关联分析' },
    { id: 'signal-push', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '商品价格突破+库存变动推送' },
    { id: 'alt-data', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港口库存+航运指数+天气预测替代数据' },
    { id: 'health-check', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '商品配对健康: 价差均值回归速度? 季节性稳定?' },
  ]},
];

// ═══════════════════════════════════════════════════════════════════════════
// CORE: Build the reverse index
// ═══════════════════════════════════════════════════════════════════════════

class TouchpointTemplateIndexEngine {
  // touchpointId → templates
  private touchpointToTemplates = new Map<string, TouchpointTemplateEntry[]>();
  // templateId → touchpoints
  private templateToTouchpoints = new Map<string, Array<{ touchpointId: string; costUSDT: number; description: string }>>();
  private initialized = false;

  init(): void {
    if (this.initialized) return;

    for (const tpl of TEMPLATE_TOUCHPOINTS) {
      const entries: TouchpointTemplateEntry[] = [];
      const touchpoints: Array<{ touchpointId: string; costUSDT: number; description: string }> = [];

      for (const tp of tpl.touchpoints) {
        entries.push({
          templateId: tpl.id,
          templateName: tpl.name,
          templateNameCn: tpl.nameCn,
          category: tpl.category,
          costUSDT: tp.costUSDT,
          description: tp.description,
        });
        touchpoints.push({
          touchpointId: tp.touchpointId,
          costUSDT: tp.costUSDT,
          description: tp.description,
        });

        // Add to reverse index (deduplicated)
        if (!this.touchpointToTemplates.has(tp.touchpointId)) {
          this.touchpointToTemplates.set(tp.touchpointId, []);
        }
        const existing = this.touchpointToTemplates.get(tp.touchpointId)!;
        if (existing.some(e => e.templateId === tpl.id)) continue;
        existing.push({
          templateId: tpl.id,
          templateName: tpl.name,
          templateNameCn: tpl.nameCn,
          category: tpl.category,
          costUSDT: tp.costUSDT,
          description: tp.description,
        });
      }

      this.templateToTouchpoints.set(tpl.id, touchpoints);
    }

    this.initialized = true;
  }

  // ── QUERY: get all templates that use a specific touchpoint
  getTemplatesForTouchpoint(touchpointId: string): TouchpointTemplateEntry[] {
    this.init();
    return this.touchpointToTemplates.get(touchpointId) ?? [];
  }

  // ── QUERY: get all touchpoints for a specific template
  getTouchpointsForTemplate(templateId: string): Array<{ touchpointId: string; costUSDT: number; description: string }> {
    this.init();
    return this.templateToTouchpoints.get(templateId) ?? [];
  }

  // ── QUERY: full coverage statistics
  getTouchpointCoverage(): TouchpointCoverage {
    this.init();
    const totalTemplates = TEMPLATE_TOUCHPOINTS.length;
    const touchpoints: TouchpointStats[] = [];

    for (const [touchpointId, templates] of Array.from(this.touchpointToTemplates)) {
      const def = TOUCHPOINT_DEFS[touchpointId];
      const marketDist: Record<string, number> = {};
      let totalCost = 0;

      for (const t of templates) {
        marketDist[t.category] = (marketDist[t.category] || 0) + 1;
        totalCost += t.costUSDT;
      }

      touchpoints.push({
        touchpointId,
        touchpointLabel: def?.label ?? touchpointId,
        templateCount: templates.length,
        templates: templates.map(t => t.templateId),
        totalCostUSDT: totalCost,
        avgCostUSDT: templates.length > 0 ? Math.round((totalCost / templates.length) * 100) / 100 : 0,
        coveragePercent: Math.round((templates.length / totalTemplates) * 100),
        marketDistribution: marketDist,
      });
    }

    touchpoints.sort((a, b) => b.templateCount - a.templateCount);

    let fullyCovered = 0, mostlyCovered = 0, partiallyCovered = 0, barelyCovered = 0;
    for (const tp of touchpoints) {
      if (tp.coveragePercent >= 90) fullyCovered++;
      else if (tp.coveragePercent >= 60) mostlyCovered++;
      else if (tp.coveragePercent >= 20) partiallyCovered++;
      else barelyCovered++;
    }

    return {
      totalTemplates,
      touchpoints,
      summary: { fullyCovered, mostlyCovered, partiallyCovered, barelyCovered },
    };
  }

  // ── QUERY: revenue analysis per touchpoint
  getTouchpointRevenue(): TouchpointRevenue[] {
    this.init();
    const results: TouchpointRevenue[] = [];

    for (const [touchpointId, templates] of Array.from(this.touchpointToTemplates)) {
      const def = TOUCHPOINT_DEFS[touchpointId];
      const perTemplate = templates.map(t => ({
        templateId: t.templateId,
        costUSDT: t.costUSDT,
      }));
      const totalRevenue = perTemplate.reduce((s, t) => s + t.costUSDT, 0);

      results.push({
        touchpointId,
        touchpointLabel: def?.label ?? touchpointId,
        totalRevenue,
        perTemplate,
        activationRevenue: totalRevenue, // all templates activated once
      });
    }

    results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return results;
  }

  // ── QUERY: heatmap data for visualization
  getHeatmap(): TouchpointHeatmapCell[] {
    this.init();
    const allTouchpointIds = Array.from(this.touchpointToTemplates.keys());

    return TEMPLATE_TOUCHPOINTS.map(tpl => {
      const tpMap: Record<string, boolean> = {};
      const tplTps = this.templateToTouchpoints.get(tpl.id) ?? [];

      for (const tpId of allTouchpointIds) {
        tpMap[tpId] = tplTps.some(t => t.touchpointId === tpId);
      }

      return {
        templateId: tpl.id,
        templateName: tpl.name,
        category: tpl.category,
        touchpoints: tpMap,
      };
    });
  }

  // ── DATA-DRIVEN OPTIMIZATION: suggest which templates should add which touchpoints
  getOptimizationSuggestions(): TouchpointOptimizationSuggestion[] {
    this.init();
    const suggestions: TouchpointOptimizationSuggestion[] = [];

    for (const tpl of TEMPLATE_TOUCHPOINTS) {
      const currentIds = new Set(tpl.touchpoints.map(t => t.touchpointId));

      // Check each touchpoint the template doesn't have
      for (const [tpId, templates] of Array.from(this.touchpointToTemplates)) {
        if (currentIds.has(tpId)) continue;

        // Find a similar template (same category) that has this touchpoint
        const similarTpl = templates.find(
          t => t.category === tpl.category && t.templateId !== tpl.id,
        );

        if (!similarTpl) continue;

        const def = TOUCHPOINT_DEFS[tpId];
        const coverage = templates.length / TEMPLATE_TOUCHPOINTS.length;

        // Only suggest if coverage is high (touchpoint is valuable)
        if (coverage < 0.3) continue;

        // Determine priority based on coverage and missing count
        let priority: 'high' | 'medium' | 'low' = 'low';
        if (coverage >= 0.6 && templates.length >= 25) {
          priority = 'high';
        } else if (coverage >= 0.4) {
          priority = 'medium';
        }

        // Count similar templates missing this touchpoint for revenue impact
        const similarMissing = TEMPLATE_TOUCHPOINTS.filter(
          t => t.category === tpl.category && !t.touchpoints.some(tp => tp.touchpointId === tpId),
        ).length;

        suggestions.push({
          templateId: tpl.id,
          templateName: tpl.name,
          currentTouchpoints: tpl.touchpoints.map(t => t.id),
          suggestedTouchpoint: tpId,
          suggestedLabel: def?.label ?? tpId,
          costUSDT: def?.defaultCost ?? 1,
          reason: `${similarTpl.templateNameCn} (同类策略) 已使用此触点, 您的${tpl.nameCn}也可受益`,
          priority,
          revenueImpact: similarMissing * (def?.defaultCost ?? 1),
          similarTemplate: similarTpl.templateId,
        });
      }
    }

    // Sort by priority then coverage impact
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    return suggestions;
  }

  // ── STATS: total templates count
  get totalTemplates(): number {
    return TEMPLATE_TOUCHPOINTS.length;
  }

  // ── QUERY: all touchpoint IDs
  getAllTouchpointIds(): string[] {
    this.init();
    return Array.from(this.touchpointToTemplates.keys());
  }

  // ── QUERY: templates missing a specific touchpoint
  getTemplatesMissingTouchpoint(touchpointId: string): Array<{ templateId: string; templateName: string; category: string }> {
    this.init();
    const has = new Set(this.touchpointToTemplates.get(touchpointId)?.map(t => t.templateId) ?? []);
    return TEMPLATE_TOUCHPOINTS
      .filter(tpl => !has.has(tpl.id))
      .map(tpl => ({ templateId: tpl.id, templateName: tpl.name, category: tpl.category }));
  }

  // ── ADMIN: reload data (useful after template file changes)
  reload(): void {
    this.touchpointToTemplates.clear();
    this.templateToTouchpoints.clear();
    this.initialized = false;
    this.init();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let _indexInstance: TouchpointTemplateIndexEngine | null = null;

export function getTouchpointTemplateIndex(): TouchpointTemplateIndexEngine {
  if (!_indexInstance) {
    _indexInstance = new TouchpointTemplateIndexEngine();
    _indexInstance.init();
  }
  return _indexInstance;
}

export function resetTouchpointTemplateIndex(): void {
  _indexInstance = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

/** Quick query: which templates have this touchpoint? */
export function queryTouchpoint(touchpointId: string): TouchpointTemplateEntry[] {
  return getTouchpointTemplateIndex().getTemplatesForTouchpoint(touchpointId);
}

/** Quick query: which touchpoints does this template have? */
export function queryTemplate(templateId: string): Array<{ touchpointId: string; costUSDT: number; description: string }> {
  return getTouchpointTemplateIndex().getTouchpointsForTemplate(templateId);
}

/** Quick query: full coverage report */
export function queryCoverage(): TouchpointCoverage {
  return getTouchpointTemplateIndex().getTouchpointCoverage();
}

/** Quick query: revenue report */
export function queryRevenue(): TouchpointRevenue[] {
  return getTouchpointTemplateIndex().getTouchpointRevenue();
}

/** Quick query: optimization suggestions */
export function queryOptimization(): TouchpointOptimizationSuggestion[] {
  return getTouchpointTemplateIndex().getOptimizationSuggestions();
}

/** Quick query: heatmap data */
export function queryHeatmap(): TouchpointHeatmapCell[] {
  return getTouchpointTemplateIndex().getHeatmap();
}

export default {
  getTouchpointTemplateIndex,
  resetTouchpointTemplateIndex,
  queryTouchpoint,
  queryTemplate,
  queryCoverage,
  queryRevenue,
  queryOptimization,
  queryHeatmap,
};
