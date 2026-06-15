/**
 * template-definitions-crypto-extra.ts — R207 J1: 加密补充4策略模板
 *
 * 4 crypto-native templates:
 *   1. LEVERAGED_LONG_SHORT  — 杠杆多空: 资金费率+持仓量信号
 *   2. SHORT_SIGNAL          — 做空信号: 负资金费率+技术破位
 *   3. STABLECOIN_ARB        — 稳定币套利: 稳定币脱锚+期现套利
 *   4. NFT_BLUECHIP          — NFT蓝筹: 蓝筹指数+Gas追踪
 *
 * Register with templateRegistry.registerAll().
 */

import { StrategyTemplate, MarketTag, AITriggerPoint } from './TemplateEngine';

function cryptoT(name: string, extra?: AITriggerPoint): AITriggerPoint[] {
  const base: AITriggerPoint[] = [
    { type: 'BACKTEST_READ', nameCN: '回测解读', nameEN: 'Backtest Read', priceUSDT: 1,
      descriptionCN: 'AI解读' + name + '历史回测', descriptionEN: 'AI analyzes ' + name + ' backtest',
      targetParams: ['lookback'] },
    { type: 'OPTIMIZE', nameCN: '优化建议', nameEN: 'Optimization Advice', priceUSDT: 1.5,
      descriptionCN: 'AI优化' + name + '杠杆倍数与仓位', descriptionEN: 'AI optimizes ' + name + ' leverage and sizing',
      targetParams: ['leverage', 'maxPosition'] },
    { type: 'PARAM_FILL', nameCN: '参数填充', nameEN: 'Auto Param Fill', priceUSDT: 1,
      descriptionCN: '根据链上数据智能推荐' + name + '参数', descriptionEN: 'AI recommends ' + name + ' params from on-chain data',
      targetParams: ['entryThreshold'] },
    { type: 'FACTOR_DIAGNOSE', nameCN: '因子诊断', nameEN: 'Factor Diagnose', priceUSDT: 1,
      descriptionCN: '诊断' + name + '因子IC', descriptionEN: 'Diagnose ' + name + ' factor ICs',
      targetParams: ['factorIds'] },
  ];
  if (extra) base.push(extra);
  return base;
}

const CRYPTO_EXTRA_TEMPLATES: StrategyTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════
  // 1. 杠杆多空 — FUNDING_RATE + OPEN_INTEREST + MOM_20 + VOL_BREAKOUT
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'crypto-leveraged-long-short',
    name: 'Leveraged Long-Short',
    nameCN: '杠杆多空',
    category: 'crypto',
    description: '资金费率极端+持仓量变化→3x杠杆做多/做空：费率负>0.1%做多，费率正>0.1%做空',
    oneLiner: '资金费率极端→3x杠杆顺势→高波动下的趋势捕捉',
    version: 1,
    marketTags: ['CRYPTO'] as MarketTag[],
    factorCombo: {
      factorIds: ['FUNDING_RATE', 'OPEN_INTEREST', 'MOM_20', 'VOL_BREAKOUT'],
      weights: [0.30, 0.25, 0.25, 0.20],
      formula: '0.30*FUNDING_RATE + 0.25*OPEN_INTEREST + 0.25*MOM_20 + 0.20*VOL_BREAKOUT',
    },
    ironRules: {
      oneLiner: '资金费率极端→3x杠杆顺势→高波动下的趋势捕捉',
      stopLossRule: '3x杠杆-15%止损（相当于现货-5%）；资金费率方向翻转即平仓',
      marketScope: 'BTC/ETH 永续合约（币安+OKX+Bybit），3x杠杆上限',
      failureCheck: '资金费率方向连续3次8h费率未回正收益时暂停',
    },
    aiTriggers: cryptoT('杠杆多空'),
    applicable: ['Crypto Futures', 'Perpetual Swaps'],
    tags: ['crypto', 'leverage', 'funding-rate', 'futures'],
    risk: { defaultStopLoss: 0.15, defaultTakeProfit: 0.40, maxPosition: 0.10 },
    timeframe: ['1h', '4h', '1d'],
    popularityScore: 78,
    winRate: 0.58,
    sharpe: 1.05,
    matchesKeyword(kw: string): boolean { return ['杠杆', '多空', 'leverage', 'funding'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 2. 做空信号 — FUNDING_RATE + MOM_1M + OPEN_INTEREST + TREND_STRENGTH
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'crypto-short-signal',
    name: 'Short Signal Detector',
    nameCN: '做空信号',
    category: 'crypto',
    description: '负资金费率-0.05%+1月动量转负+OI骤降→做空信号触发',
    oneLiner: '资金费率转负+动量破位+OI撤退→三重做空确认',
    version: 1,
    marketTags: ['CRYPTO'] as MarketTag[],
    factorCombo: {
      factorIds: ['FUNDING_RATE', 'MOM_1M', 'OPEN_INTEREST', 'TREND_STRENGTH'],
      weights: [0.30, 0.25, 0.25, 0.20],
      formula: '0.30*FUNDING_RATE + 0.25*MOM_1M + 0.25*OPEN_INTEREST + 0.20*TREND_STRENGTH',
    },
    ironRules: {
      oneLiner: '资金费率转负+动量破位+OI撤退→三重做空确认',
      stopLossRule: '-8%止损（做空）；资金费率突然转正>0.05%平仓',
      marketScope: 'BTC/ETH/BNB/SOL 永续合约，市值>10B',
      failureCheck: '连续3次做空信号后市场反弹>5%（假信号），暂停1周',
    },
    aiTriggers: cryptoT('做空信号'),
    applicable: ['Crypto Futures', 'Short Selling'],
    tags: ['crypto', 'short', 'bearish', 'funding-rate', 'futures'],
    risk: { defaultStopLoss: 0.08, defaultTakeProfit: 0.20, maxPosition: 0.08 },
    timeframe: ['1h', '4h', '1d'],
    popularityScore: 72,
    winRate: 0.55,
    sharpe: 0.90,
    matchesKeyword(kw: string): boolean { return ['做空', 'short', '空头', 'bear'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 3. 稳定币套利 — FUNDING_RATE + CMD_BASIS
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'crypto-stablecoin-arb',
    name: 'Stablecoin Arbitrage',
    nameCN: '稳定币套利',
    category: 'arbitrage',
    description: '稳定币脱锚>0.5%买入/溢价>0.5%卖出+期现套利（现货vs季度合约价差）',
    oneLiner: '稳定币脱锚>0.5%买入+期现价差>2%套利→低风险收益',
    version: 1,
    marketTags: ['CRYPTO'] as MarketTag[],
    factorCombo: {
      factorIds: ['FUNDING_RATE', 'CMD_BASIS'],
      weights: [0.50, 0.50],
      formula: '0.50*FUNDING_RATE + 0.50*CMD_BASIS',
    },
    ironRules: {
      oneLiner: '稳定币脱锚>0.5%买入+期现价差>2%套利→低风险收益',
      stopLossRule: '脱锚持续>24h平仓（可能协议风险）；价差套利到期日自动平仓',
      marketScope: 'USDT/USDC/DAI vs USD脱锚；BTC/ETH 现货vs季度合约价差',
      failureCheck: '稳定币脱锚原因若为协议漏洞则立即退出；季度合约流动性<1M USD暂停',
    },
    aiTriggers: cryptoT('稳定币套利'),
    applicable: ['Crypto', 'Arbitrage', 'Stablecoins'],
    tags: ['stablecoin', 'arbitrage', 'basis', 'futures', 'crypto'],
    risk: { defaultStopLoss: 0.03, defaultTakeProfit: 0.08, maxPosition: 0.20 },
    timeframe: ['1d', '1w'],
    popularityScore: 68,
    winRate: 0.70,
    sharpe: 1.50,
    matchesKeyword(kw: string): boolean { return ['稳定币', 'stablecoin', 'arb', '套利'].some(t => kw.toLowerCase().includes(t)); },
  }))(),

  // ═══════════════════════════════════════════════════════════════════════
  // 4. NFT蓝筹 — INST_OWNER + TURNOVER + OPEN_INTEREST
  // ═══════════════════════════════════════════════════════════════════════

  ((): StrategyTemplate => ({
    id: 'crypto-nft-bluechip',
    name: 'NFT Bluechip Index',
    nameCN: 'NFT蓝筹',
    category: 'crypto',
    description: 'NFT蓝筹指数追踪：Punks/BAYC/MAYC/Azuki/Pudgy等蓝筹地板价+交易量+持有人数变化',
    oneLiner: '蓝筹地板价↑+交易量↑+持有人增→NFT回暖信号',
    version: 1,
    marketTags: ['CRYPTO'] as MarketTag[],
    factorCombo: {
      factorIds: ['INST_OWNER', 'TURNOVER', 'OPEN_INTEREST'],
      weights: [0.40, 0.35, 0.25],
      formula: '0.40*INST_OWNER + 0.35*TURNOVER + 0.25*OPEN_INTEREST',
    },
    ironRules: {
      oneLiner: '蓝筹地板价↑+交易量↑+持有人增→NFT回暖信号',
      stopLossRule: 'ETH计价地板价-20%止损；NFT市场总交易量连降2月清仓',
      marketScope: 'ETH链上NFT蓝筹（Punks/BAYC/MAYC/Azuki/Pudgy），ETH计价',
      failureCheck: 'NFT市场交易量<100M/月（熊市冰点）时暂停；Gas费>200gwei抑制交易时降仓',
    },
    aiTriggers: cryptoT('NFT蓝筹', {
      type: 'ALT_DATA', nameCN: '链上数据解锁', nameEN: 'On-Chain Data', priceUSDT: 2,
      descriptionCN: '解锁NFT稀有度+巨鲸持仓+wash trading检测', descriptionEN: 'Unlock NFT rarity + whale holdings + wash trade detection',
      targetParams: ['altData'],
    }),
    applicable: ['Crypto', 'NFT'],
    tags: ['NFT', 'bluechip', 'alternative', 'crypto'],
    risk: { defaultStopLoss: 0.20, defaultTakeProfit: 0.50, maxPosition: 0.06 },
    timeframe: ['1d', '1w'],
    popularityScore: 62,
    winRate: 0.48,
    sharpe: 0.70,
    matchesKeyword(kw: string): boolean { return ['nft', 'bluechip', '蓝筹'].some(t => kw.toLowerCase().includes(t)); },
  }))(),
];

export default CRYPTO_EXTRA_TEMPLATES;
