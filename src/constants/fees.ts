/**
 * TradingEasy R151 Claw(PM) — Unified Fee Constants (v17.6 PERMANENT LOCK)
 * 
 * SINGLE SOURCE OF TRUTH for all fee rates.
 * Every component, page, and service references this file.
 * Update here → all references update automatically.
 * 
 * v17.6 Rules:
 *   - Trading fees: by asset type, NOT creator tier
 *   - Creator level: marketplace commission (30/20/10%), NOT trading fee
 *   - Transfer: 0.3% ×2 (independent from tipping)
 *   - Tipping: by creator level (L1:30%/L2:20%/L3:10%)
 *   - Withdrawal: 0.1% min 2 USDT
 *   - Deposit: 0%
 *   - AI: pure per-use (1-2 USDT)
 *   - TA: pure per-round (1.0/1.5/2.0 USDT)
 */

// ═══════════════ Asset Types (Trading Fee) ═════════════════════════════════

export type AssetType = 'STOCK' | 'ETF' | 'FUTURES' | 'OPTIONS' | 'CRYPTO_SPOT' | 'CRYPTO_FUTURES';

export interface AssetFeeConfig {
  rate: number;        // decimal (0.001 = 0.1%)
  minUSDT: number;     // minimum fee in USDT
  label: string;       // display name
  rateDisplay: string; // "0.1%"
}

export const ASSET_FEE_TABLE: Record<AssetType, AssetFeeConfig> = {
  STOCK:          { rate: 0.001,  minUSDT: 2.0, label: '股票', rateDisplay: '0.1%' },
  ETF:            { rate: 0.001,  minUSDT: 2.0, label: 'ETF', rateDisplay: '0.1%' },
  FUTURES:        { rate: 0.001,  minUSDT: 2.0, label: '期货', rateDisplay: '0.1%' },
  OPTIONS:        { rate: 0.001,  minUSDT: 2.0, label: '期权', rateDisplay: '0.1%' },
  CRYPTO_SPOT:    { rate: 0.001,  minUSDT: 2.0, label: '加密货币现货', rateDisplay: '0.1%' },
  CRYPTO_FUTURES: { rate: 0.0002, minUSDT: 0.5, label: '加密货币合约', rateDisplay: '0.02%' },
};

// ═══════════════ Wallet Fees ═══════════════════════════════════════════════

export const WALLET_FEES = {
  DEPOSIT:      { rate: 0,     minUSDT: 0,   label: '充值', rateDisplay: '0%' },
  WITHDRAW:     { rate: 0.001, minUSDT: 2.0, label: '提现', rateDisplay: '0.1%' },
  TRANSFER_SEND:    { rate: 0.003, minUSDT: 0, label: '转账(发)', rateDisplay: '0.3%' },
  TRANSFER_RECEIVE: { rate: 0.003, minUSDT: 0, label: '转账(收)', rateDisplay: '0.3%' },
} as const;

// ═══════════════ Creator Level (Marketplace Commission) ════════════════════

export type CreatorLevel = 'L1' | 'L2' | 'L3';

export interface CreatorLevelConfig {
  level: number;
  minSales: number;
  commissionPercent: number;  // platform takes this %
  creatorPercent: number;     // creator keeps this %
  label: string;
  color: string;
}

export const CREATOR_LEVEL_TABLE: Record<CreatorLevel, CreatorLevelConfig> = {
  L1: { level: 1, minSales: 0,    commissionPercent: 30, creatorPercent: 70, label: '新手创作者', color: '#8b949e' },
  L2: { level: 2, minSales: 100,  commissionPercent: 20, creatorPercent: 80, label: '进阶创作者', color: '#3b82f6' },
  L3: { level: 3, minSales: 1000, commissionPercent: 10, creatorPercent: 90, label: '旗舰创作者', color: '#f59e0b' },
};

// ═══════════════ AI & TA Pricing ═══════════════════════════════════════════

export const AI_PRICE_TABLE = {
  AI_DRAW_LINES:    { priceUSDT: 1.0, label: 'AI 自动画线+形态识别' },
  AI_CHAT:          { priceUSDT: 1.0, label: 'AI 对话' },
  AI_PARAM_FILL:    { priceUSDT: 1.0, label: 'AI 智能填充策略参数' },
  AI_PORTFOLIO:     { priceUSDT: 2.0, label: 'AI 生成策略组合' },
  AI_BACKTEST_READ: { priceUSDT: 1.0, label: 'AI 回测解读' },
  AI_OPTIMIZE:      { priceUSDT: 1.5, label: 'AI 策略优化建议' },
  AI_HEALTH_CHECK:  { priceUSDT: 1.0, label: 'AI 策略健康检查' },
  AI_FACTOR_ADVISOR:{ priceUSDT: 1.0, label: 'AI 因子推荐' },
  AI_EVENT_STRATEGY:{ priceUSDT: 1.5, label: 'AI 事件策略生成' },
  AI_FACTOR_DIAGNOSIS:{ priceUSDT: 1.0, label: 'AI 因子深度诊断' },
  AI_FACTOR_OPTIMIZE:{ priceUSDT: 1.5, label: 'AI 因子参数优化' },
  AI_ALT_FACTOR:    { priceUSDT: 2.0, label: 'AI 替代数据因子解锁' },
} as const;

export const TA_PRICE_TABLE = {
  STANDARD:  { priceUSDT: 1.0, label: 'TA 标准 Agent', description: '单策略, 基础执行' },
  ADVANCED:  { priceUSDT: 1.5, label: 'TA 高级 Agent', description: '多策略协同, 动态参数调整' },
  FLAGSHIP:  { priceUSDT: 2.0, label: 'TA 旗舰 Agent', description: '全策略组合, AI驱动决策' },
} as const;

// ═══════════════ Minimum Amounts ═══════════════════════════════════════════

export const MINIMUMS = {
  TIP:          9.9,    // USDT
  TRADING_FEE:  2.0,    // USDT (stock/etf/futures/options/crypto_spot)
  CRYPTO_FEE:   0.5,    // USDT (crypto futures only)
  WITHDRAWAL:   2.0,    // USDT
  WITHDRAWAL_SINGLE_MAX: 100_000, // USDT
  WITHDRAWAL_DAILY_MAX:  1_000_000, // USDT
  STRATEGY_PRODUCT: 9.9, // USDT (templates/combos/subscriptions)
  SIGNAL_SUBSCRIPTION: 9.9, // USDT/month
  COLD_WALLET_THRESHOLD: 10_000, // USDT
  COLD_WALLET_SPLIT_WINDOW_HOURS: 24, // cumulative window
} as const;

export const TIP_QUICK_AMOUNTS = [9.9, 19.9, 49.9, 99.9] as const;

// ═══════════════ Precision ════════════════════════════════════════════════

export const USDT_DECIMALS = 6;
export const USDT_DISPLAY_DECIMALS = 2;

// ═══════════════ Helpers ═══════════════════════════════════════════════════

export function calcTradeFee(assetType: AssetType, tradeValue: number): { fee: number; appliedMin: boolean } {
  const config = ASSET_FEE_TABLE[assetType];
  const rawFee = roundUSDT(tradeValue * config.rate);
  if (rawFee < config.minUSDT) {
    return { fee: config.minUSDT, appliedMin: true };
  }
  return { fee: rawFee, appliedMin: false };
}

export function calcWithdrawFee(amount: number): { fee: number; receive: number } {
  const rawFee = roundUSDT(amount * WALLET_FEES.WITHDRAW.rate);
  const fee = Math.max(rawFee, WALLET_FEES.WITHDRAW.minUSDT);
  return { fee, receive: roundUSDT(amount - fee) };
}

export function calcTransferFee(amount: number): { senderPays: number; receiverGets: number } {
  const fee = roundUSDT(amount * WALLET_FEES.TRANSFER_SEND.rate);
  return { senderPays: roundUSDT(amount + fee), receiverGets: roundUSDT(amount * (1 - WALLET_FEES.TRANSFER_RECEIVE.rate)) };
}

export function calcTipCommission(amount: number, level: CreatorLevel): { platformCut: number; creatorGets: number } {
  const config = CREATOR_LEVEL_TABLE[level];
  const cut = roundUSDT(amount * config.commissionPercent / 100);
  return { platformCut: cut, creatorGets: roundUSDT(amount - cut) };
}

export function getCreatorLevel(totalSales: number): CreatorLevel {
  if (totalSales >= 1000) return 'L3';
  if (totalSales >= 100) return 'L2';
  return 'L1';
}

function roundUSDT(v: number): number {
  return Math.round(v * 10 ** USDT_DECIMALS) / 10 ** USDT_DECIMALS;
}
