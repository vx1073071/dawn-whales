/**
 * R222 JVS#2: HK factor-based strategy templates.
 * Split from factor-strategy-templates.ts for market-level maintainability.
 * v2.3.0 CRYSTAL
 */

import type { FactorStrategyTemplate } from './factor-strategy-templates-types';

export const HK_TEMPLATES: FactorStrategyTemplate[] = [

  // ── 1. AH溢价套利 ────────────────────────────────────────────────────────
  {
    id: 'hk-ah-premium',
    name: 'AH Premium Arbitrage',
    nameCn: 'AH溢价套利',
    category: 'hk',
    difficulty: 3,
    timeHorizon: 'swing',
    expectedHoldingDays: '5-20天',
    holdingDays: { min: 5, max: 20, unit: 'day' },
    fourIronRules: {
      humanLine: '当A股比H股贵超30%时买H股卖A股，溢价回落到15%以下平仓。利用同一公司两地定价差套利。',
      stopLossRule: 'AH溢价扩大超过入场时5%止损，或单只亏损超过3%止损。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['H股AH双重上市标的: 工商银行/中国平安/中石油等'] },
      ],
      failureCheck: 'AH溢价指数<115(溢价消失)时放弃此策略；人民币大幅贬值(>3%/月)时暂停(汇率驱动溢价而非定价错误)。',
    },
    factorCombo: [
      { factorId: 'HK_AH_PREMIUM', factorName: 'AH溢价因子', weight: 45, direction: 'short', threshold: { min: 30 } },
      { factorId: 'HK_SOUTHBOUND_SMART', factorName: '南向资金流向', weight: 20, direction: 'long' },
      { factorId: 'VALUE_PE', factorName: '市盈率价值', weight: 15, direction: 'long' },
      { factorId: 'MOMENTUM_1M', factorName: '1月反转', weight: 10, direction: 'long' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: 'AH溢价策略健康: 价差仍在历史区间? 套利窗口>1%?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: 'AH溢价突破阈值实时推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: 'AI分析AH溢价历史套利胜率和最优入场阈值' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: 'AI自动优化溢价阈值和持仓天数' },
      { id: 'alt-data', label: '替代数据解锁', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '解锁AH溢价实时监控+港交所持股数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是AH溢价套利策略助手。基于AH溢价/南向资金/PB价值因子，帮助用户优化溢价阈值、持仓周期和止损参数。',
      conversationStarters: [
        'AH溢价何时入场最优？',
        '南向资金流出需要减仓吗？',
        '溢价阈值设30%还是35%更优？'
      ],
      tunableParams: [
        { paramName: 'premiumThreshold', description: 'AH溢价入场阈值', currentValue: '30%', range: '25%-40%' },
        { paramName: 'holdingDays', description: '持仓天数', currentValue: '5-20', range: '3-30天' },
        { paramName: 'stopLossPct', description: '止损百分比', currentValue: '5%', range: '3%-8%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['AH溢价', '套利', '跨市场', '价值'],
    version: 'v1.0',
  },

  // ── 2. 窝轮/牛熊证方向 ────────────────────────────────────────────────────
  {
    id: 'hk-warrant-direction',
    name: 'Warrant/CBBC Direction Flow',
    nameCn: '窝轮方向追踪',
    category: 'hk',
    difficulty: 4,
    timeHorizon: 'intraday',
    expectedHoldingDays: '1-3天',
    holdingDays: { min: 1, max: 3, unit: 'day' },
    fourIronRules: {
      humanLine: '当窝轮/牛熊证街货量集中在某个方向时反向操作——散户窝轮持仓是反向指标。散户大量买入认购=看跌信号。',
      stopLossRule: '窝轮方向指标回落到中位(±0.3)止损；持仓不超过3个交易日。',
      marketScope: [
        { market: '🇭🇰', assetClass: '窝轮/牛熊证', symbols: ['恒指/腾讯/美团/阿里/港交所相关轮证'] },
      ],
      failureCheck: '市场单边暴涨暴跌(恒指单日>5%)→窝轮被强平导致数据失真→暂停；港交所修改轮证规则→重新评估。',
    },
    factorCombo: [
      { factorId: 'HK_WARRANT_FLOW', factorName: '窝轮资金流向', weight: 40, direction: 'short', threshold: { min: 1.5 } },
      { factorId: 'HK_CBBC_RATIO', factorName: '牛熊证比例', weight: 25, direction: 'short', threshold: { min: 1.5 } },
      { factorId: 'HK_SHORT_SELL_RATIO', factorName: '沽空比率', weight: 15, direction: 'long' },
      { factorId: 'RETAIL_SENTIMENT', factorName: '散户情绪', weight: 10, direction: 'short' },
      { factorId: 'VOLATILITY', factorName: '波动率', weight: 10, direction: 'long', threshold: { max: 30 } },
    ],
    aiTriggerPoints: [
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '窝轮街货量异常+散户情绪反转推送' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '窝轮反向指标历史胜率分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '诊断窝轮拥挤度+牛熊比例可靠性' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '窝轮实时街货量+发行商对冲数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股窝轮牛熊证策略助手。基于街货量/散户情绪/沽空比率因子，帮助用户判断方向信号强度和止盈止损。',
      conversationStarters: [
        '窝轮街货量激增是反向信号吗？',
        '牛熊证比例怎么看方向？',
        '窝轮数据失真怎么办？'
      ],
      tunableParams: [
        { paramName: 'flowThreshold', description: '窝轮方向阈值', currentValue: '1.5', range: '1.0-2.5' },
        { paramName: 'holdingDays', description: '持仓天数', currentValue: '1-3', range: '1-5天' },
        { paramName: 'sentimentWeight', description: '散户情绪权重', currentValue: '10%', range: '5%-20%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['窝轮', '牛熊证', '逆向', '散户情绪'],
    version: 'v1.0',
  },

  // ── 3. 高股息阶梯 ────────────────────────────────────────────────────────
  {
    id: 'hk-dividend-ladder',
    name: 'HK Dividend Ladder',
    nameCn: '港股股息阶梯',
    category: 'hk',
    difficulty: 1,
    timeHorizon: 'long-term',
    expectedHoldingDays: '90-365天',
    holdingDays: { min: 3, max: 12, unit: 'month' },
    fourIronRules: {
      humanLine: '买入港股中股息率>5%+派息稳定(连续3年)+PB<1的蓝筹，按除息日排期轮动持有，吃股息+估值修复双重收益。',
      stopLossRule: '股息率跌破4%或公司削减派息>20%→立即卖出。PB回升到>1.2时分批止盈。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['中资银行/电信/能源/REITs等稳定派息港股蓝筹'] },
      ],
      failureCheck: '利率大幅上升(美联储加息>2%)→高股息股被抛售→暂停加仓；港股通南向资金连续2月净流出→减仓。',
    },
    factorCombo: [
      { factorId: 'HK_DIVIDEND_YIELD', factorName: '港股股息率', weight: 40, direction: 'long', threshold: { min: 5 } },
      { factorId: 'HK_PB_RATIO', factorName: '港股PB价值', weight: 20, direction: 'long', threshold: { max: 1.0 } },
      { factorId: 'DIVIDEND_STABILITY', factorName: '派息稳定性', weight: 20, direction: 'long' },
      { factorId: 'HK_SOUTHBOUND_SMART', factorName: '南向资金', weight: 10, direction: 'long' },
      { factorId: 'LOW_VOLATILITY', factorName: '低波动', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
      { id: 'health-check', label: 'AI策略健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '检查持仓股息是否可持续' },
      { id: 'param-optimize', label: 'AI参数优化', touchpointId: 'FACTOR_PARAM_OPTIMIZE', costUSDT: 1.5, description: '优化股息率阈值和仓位分配' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '港股股息策略历史表现分析' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港交所披露易+公司公告派息预测数据' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股股息阶梯策略助手。基于股息率/PB价值/派息稳定性因子，帮助用户优化除息日轮动和调仓节奏。',
      conversationStarters: [
        '港股股息率>5%的蓝筹有哪些？',
        '除息日轮动怎么排期最优？',
        '公司削派息时怎么切换？'
      ],
      tunableParams: [
        { paramName: 'divYieldMin', description: '最低股息率', currentValue: '5%', range: '4%-7%' },
        { paramName: 'holdingMonths', description: '持仓月数', currentValue: '3-12', range: '1-24个月' },
        { paramName: 'pbMax', description: 'PB上限', currentValue: '1.0', range: '0.5-1.5' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['高股息', '价值', '蓝筹', '长期持有'],
    version: 'v1.0',
  },

  // ── 4. 南向资金追踪 ──────────────────────────────────────────────────────
  {
    id: 'hk-southbound-tracker',
    name: 'Southbound Smart Money Tracker',
    nameCn: '南向聪明钱追踪',
    category: 'hk',
    difficulty: 2,
    timeHorizon: 'swing',
    expectedHoldingDays: '7-21天',
    holdingDays: { min: 7, max: 21, unit: 'day' },
    fourIronRules: {
      humanLine: '跟着南向资金走：南向连续3日净买入>50亿港元时买入港股，南向连续3日净卖出>30亿时减仓。资金流向是港股最大的alpha来源。',
      stopLossRule: '南向资金反转(连续2日净卖出>10亿)时止损，或个股跌超5%止损。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['恒生科技/恒生指数权重股: 腾讯/美团/阿里/快手/小米'] },
      ],
      failureCheck: '人民币汇率突然大幅贬值(>2%/周)→南向资金可能是避险而非主动流入→暂停。中美关系急剧恶化→港股系统性风险>南向alpha。',
    },
    factorCombo: [
      { factorId: 'HK_SOUTHBOUND_SMART', factorName: '南向资金智能流向', weight: 40, direction: 'long', threshold: { min: 1.5 } },
      { factorId: 'HK_BOARD_TRADE_HK', factorName: '港股通成交占比', weight: 20, direction: 'long' },
      { factorId: 'MOMENTUM_12M', factorName: '12月动量', weight: 20, direction: 'long' },
      { factorId: 'HK_SECTOR_ROTATION', factorName: '板块轮动', weight: 10, direction: 'long' },
      { factorId: 'MONEY_FLOW_CMF', factorName: '资金流量', weight: 10, direction: 'long' },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '南向资金策略健康: 资金流向趋势延续? IC>0.03?' },
    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港股通北向资金+港交所CCASS持仓替代数据' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '南向资金历史alpha分析' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '南向资金拥挤度+边际效应衰减预警' },
      { id: 'ai-daily', label: 'AI每日简报', touchpointId: 'AI_DAILY_BRIEFING', costUSDT: 1, description: '每日南向资金动向+Top被买标的' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股南向资金追踪策略助手。基于南向净买入/板块偏好/聪明钱信号因子，帮助用户跟随后续资金流向。',
      conversationStarters: [
        '南向资金流向哪个板块最多？',
        '南向净流出是否持续？',
        '聪明钱信号可靠性如何提升？'
      ],
      tunableParams: [
        { paramName: 'flowThreshold', description: '南向流入阈值', currentValue: '5亿', range: '2-10亿/日' },
        { paramName: 'sectorRotation', description: '板块轮动间隔', currentValue: '2周', range: '1-4周' },
        { paramName: 'trailingStop', description: '移动止损', currentValue: '8%', range: '5%-12%' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['南向资金', '资金流', '趋势', '聪明钱'],
    version: 'v1.0',
  },

  // ── 5. 红筹回归 ──────────────────────────────────────────────────────────
  {
    id: 'hk-redchip-homecoming',
    name: 'Red Chip Homecoming Arbitrage',
    nameCn: '红筹回归套利',
    category: 'hk',
    difficulty: 4,
    timeHorizon: 'position',
    expectedHoldingDays: '30-90天',
    holdingDays: { min: 30, max: 90, unit: 'day' },
    fourIronRules: {
      humanLine: '布局可能回归A股/科创板二次上市的中概红筹股。触发信号：提交A股上市申请+港股折价>20%→买入港股等待估值收敛。',
      stopLossRule: '回归申请被否→立即清仓；申请后3个月内无进展→减半仓；港股折价扩大到>40%→止损。',
      marketScope: [
        { market: '🇭🇰', assetClass: '股票', symbols: ['已/拟回A中概: 中芯国际/华虹/百济神州/再鼎医药等'] },
      ],
      failureCheck: 'A股IPO审核收紧(过会率<70%)→回归路径被封→暂停；中美审计监管合作破裂→中概退市风险>回归溢价。',
    },
    factorCombo: [
      { factorId: 'HK_REDCHIP_PREMIUM', factorName: '红筹AH折价', weight: 35, direction: 'long', threshold: { min: 20 } },
      { factorId: 'HK_LISTING_EVENT', factorName: '港股上市事件', weight: 25, direction: 'long' },
      { factorId: 'HK_AH_PREMIUM', factorName: 'AH溢价', weight: 15, direction: 'short' },
      { factorId: 'SECTOR_TECH', factorName: '科技板块', weight: 15, direction: 'long' },
      { factorId: 'REGULATORY_RISK', factorName: '监管风险', weight: 10, direction: 'short', threshold: { max: -0.5 } },
    ],
    aiTriggerPoints: [
    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '红筹回A策略健康: 回A进度正常? 价差合理?' },
    { id: 'signal-push', label: '信号推送', touchpointId: 'AI_FACTOR_SIGNAL_PUSH', costUSDT: 0.5, description: '红筹回A进度+价差信号推送' },
      { id: 'deep-diagnosis', label: 'AI因子诊断', touchpointId: 'FACTOR_DEEP_DIAGNOSIS', costUSDT: 1, description: '红筹回归概率+时间线预测' },
      { id: 'backtest-read', label: 'AI回测解读', touchpointId: 'AI_BACKTEST_READ', costUSDT: 1, description: '历史中概回归案例收益率分析' },
      { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '港交所/A股IPO审核进度+招股书分析' },
    ],,
    deepSeekChat: {
      enabled: true,
      systemPrompt: '你是港股红筹回归策略助手。基于红筹股回A股折价/政策催化剂/流动性对比因子，帮助用户抓住回A套利机会。',
      conversationStarters: [
        '红筹回A大概率折价多少？',
        '哪些红筹股最有回A可能？',
        '政策暂停回A怎么办？'
      ],
      tunableParams: [
        { paramName: 'discountTarget', description: '回归折价目标', currentValue: '20%', range: '10%-35%' },
        { paramName: 'policyCatalyst', description: '政策催化剂权重', currentValue: '30%', range: '20%-40%' },
        { paramName: 'timeHorizon', description: '时间窗口', currentValue: '3-12月', range: '1-24月' }
      ],
      costPerTurn: 1,
      degradationChain: 'AIDegradationChain',
      oneClickApply: true,
      maxRounds: 20,
    }
    tags: ['红筹', '回归套利', '事件驱动', '中概'],
    version: 'v1.0',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🪙 CRYPTO TEMPLATES (8) — autoclaw #4
// ═══════════════════════════════════════════════════════════════════════════════


