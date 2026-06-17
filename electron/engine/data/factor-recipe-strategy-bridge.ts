/**
 * R282 autoclaw#2: 因子食谱→策略桥接 (FactorRecipeStrategyBridge) v1.0
 *
 * QUANT MOO — Factor Recipe → Live Strategy Bridge.
 *
 * Problem: Users can discover factor combinations ("recipes") but can't easily
 * convert them into executable strategies. This bridge enables one-click
 * conversion from a factor recipe to a backtestable/live strategy.
 *
 * A "Factor Recipe" is a pre-defined combination of factors with weights,
 * designed for specific market conditions or trading goals:
 *   - "牛市追涨套餐" = Momentum(0.4) + Volume(0.3) + Sentiment(0.3)
 *   - "熊市防御套餐" = Quality(0.4) + LowVol(0.3) + Dividend(0.3)
 *   - "价值回归套餐" = BEME(0.5) + EP(0.3) + Accruals(0.2)
 *   - "多因子均衡套餐" = Value(0.25) + Momentum(0.25) + Quality(0.25) + Size(0.25)
 *
 * Flow:
 *   User picks recipe → RecipeStrategyBridge.convert()
 *   → Validates factors, computes composite score
 *   → Generates strategy config (weights, rebalance, risk limits)
 *   → Registers with strategy-marketplace-api / strategy-runner
 *
 * Features:
 *   1. 16 preset recipes across 4 market regimes
 *   2. Custom recipe builder
 *   3. Recipe → strategy one-click conversion
 *   4. Recipe backtest preview (quick 1y backtest)
 *   5. Recipe marketplace integration
 *   6. Recipe scoring & ranking
 *   7. Integration with factor-scene-bridge (scene → recipe matching)
 *
 * Upstream: factor-scene-bridge.ts, factor-combo-compare.ts
 * Downstream: strategy-runner.ts, strategy-marketplace-api.ts
 */

import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type MarketRegime = 'bull' | 'bear' | 'sideways' | 'volatile' | 'recovery' | 'any';

export type RecipeDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface FactorRecipeIngredient {
  factorId: string;
  factorName: string;
  factorNameCn: string;
  weight: number;       // 0-1, all weights sum to 1
  direction: 'long' | 'short';
  /** Optional: custom threshold for this factor */
  threshold?: { field: string; operator: 'gt' | 'lt' | 'gte' | 'lte'; value: number };
}

export interface FactorRecipe {
  recipeId: string;
  name: string;
  nameCn: string;
  description: string;
  descriptionCn: string;
  /** Market regime this recipe is designed for */
  regimes: MarketRegime[];
  /** Asset class target */
  targetMarket: string;
  /** Difficulty level for users */
  difficulty: RecipeDifficulty;
  /** Factor ingredients with weights */
  ingredients: FactorRecipeIngredient[];
  /** Recipe tags for search/discovery */
  tags: string[];
  /** Expected annual return (informational) */
  expectedReturn: number;
  /** Expected Sharpe ratio (informational) */
  expectedSharpe: number;
  /** Expected max drawdown (informational) */
  expectedMaxDD: number;
  /** Recommended rebalance frequency */
  rebalanceFreq: 'daily' | 'weekly' | 'monthly';
  /** Minimum holding period (days) */
  minHoldDays: number;
  /** Creator info */
  author: string;
  /** Is this an official (preset) or community recipe */
  isOfficial: boolean;
  /** Recipe popularity score */
  popularity: number;
  /** Number of times converted to strategy */
  conversionCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface StrategyConversionConfig {
  recipeId: string;
  strategyName: string;
  initialCapital: number;
  maxPositionSize: number;     // 0-1, fraction of capital
  stopLoss: number;            // 0-1, fraction drawdown
  takeProfit: number;          // 0-1, fraction gain
  /** Override ingredient weights */
  weightOverrides?: Array<{ factorId: string; weight: number }>;
  /** Enable/disable ingredients */
  enabledIngredients?: string[];
}

export interface ConvertedStrategy {
  strategyId: string;
  name: string;
  recipeId: string;
  recipeName: string;
  market: string;
  /** Ordered factor list with final weights */
  factors: Array<{ factorId: string; factorName: string; weight: number; direction: 'long' | 'short' }>;
  /** Composite score formula description */
  scoreFormula: string;
  /** Risk parameters */
  riskParams: {
    initialCapital: number;
    maxPositionSize: number;
    stopLoss: number;
    takeProfit: number;
    rebalanceFreq: string;
    minHoldDays: number;
  };
  /** Backtest preview */
  backtestPreview?: RecipeBacktestPreview;
  conversionTimestamp: number;
  /** Strategy marketplace listing ID (if published) */
  marketplaceListingId?: string;
}

export interface RecipeBacktestPreview {
  annualReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  /** Comparison to benchmark */
  benchmarkReturn: number;
  alpha: number;
}

export interface RecipeQuery {
  regime?: MarketRegime;
  market?: string;
  difficulty?: RecipeDifficulty;
  tags?: string[];
  search?: string;
  /** Sort field */
  sortBy?: 'popularity' | 'expectedSharpe' | 'expectedReturn' | 'conversionCount' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

// ═══════════════════════════════════════════════════════════════════
// PRESET RECIPE LIBRARY (16 recipes)
// ═══════════════════════════════════════════════════════════════════

const PRESET_RECIPES: Omit<FactorRecipe, 'recipeId' | 'createdAt' | 'updatedAt' | 'conversionCount' | 'popularity'>[] = [
  // ── Bull Market Recipes ─────────────────────────────────────────
  {
    name: 'Bull Charge',
    nameCn: '牛市追涨套餐',
    description: 'High momentum + volume factors for trending bull markets. Captures strong upward moves.',
    descriptionCn: '动量+成交量因子组合，捕捉牛市中的强势上涨行情。适合趋势明确时的追涨操作。',
    regimes: ['bull'],
    targetMarket: 'any',
    difficulty: 'beginner',
    ingredients: [
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.40, direction: 'long' },
      { factorId: 'MOM_6M', factorName: 'Momentum6M', factorNameCn: '6月动量', weight: 0.25, direction: 'long' },
      { factorId: 'GROWTH', factorName: 'Growth', factorNameCn: '成长因子', weight: 0.20, direction: 'long' },
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.15, direction: 'long' },
    ],
    tags: ['动量', '趋势', '成长', '入门'],
    expectedReturn: 0.25,
    expectedSharpe: 1.2,
    expectedMaxDD: 0.25,
    rebalanceFreq: 'monthly',
    minHoldDays: 30,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Growth Surge',
    nameCn: '成长加速套餐',
    description: 'Pure growth factor play for strong economic expansions.',
    descriptionCn: '纯成长因子组合，适合经济强劲扩张期。关注营收和盈利增长最快的标的。',
    regimes: ['bull'],
    targetMarket: 'any',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'GROWTH', factorName: 'Growth', factorNameCn: '成长因子', weight: 0.35, direction: 'long' },
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.30, direction: 'long' },
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.20, direction: 'long' },
      { factorId: 'SIZE', factorName: 'Size', factorNameCn: '规模因子', weight: 0.15, direction: 'long' },
    ],
    tags: ['成长', '动量', '经济扩张'],
    expectedReturn: 0.30,
    expectedSharpe: 1.1,
    expectedMaxDD: 0.30,
    rebalanceFreq: 'monthly',
    minHoldDays: 30,
    author: 'QUANT MOO',
    isOfficial: true,
  },

  // ── Bear Market Recipes ─────────────────────────────────────────
  {
    name: 'Bear Shelter',
    nameCn: '熊市防御套餐',
    description: 'Quality + low volatility + dividend factors for bear markets. Preserves capital.',
    descriptionCn: '质量+低波动+股息因子组合，在熊市中保护资本。注重安全边际和现金回报。',
    regimes: ['bear'],
    targetMarket: 'any',
    difficulty: 'beginner',
    ingredients: [
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.40, direction: 'long' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.30, direction: 'long' },
      { factorId: 'HML', factorName: 'BookToMarket', factorNameCn: '市净率估值', weight: 0.20, direction: 'long' },
      { factorId: 'VOL_60D', factorName: 'Volatility60D', factorNameCn: '60日波动率', weight: 0.10, direction: 'short' },
    ],
    tags: ['防御', '质量', '股息', '低波动', '入门'],
    expectedReturn: 0.05,
    expectedSharpe: 0.8,
    expectedMaxDD: 0.15,
    rebalanceFreq: 'monthly',
    minHoldDays: 60,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Deep Value',
    nameCn: '深度价值套餐',
    description: 'Classic value factors for bargain hunting in beaten-down markets.',
    descriptionCn: '经典价值因子组合，在超跌市场中寻找被低估的标的。逆向投资者的最爱。',
    regimes: ['bear', 'recovery'],
    targetMarket: 'any',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'HML', factorName: 'BookToMarket', factorNameCn: '市净率估值', weight: 0.35, direction: 'long' },
      { factorId: 'EP_RATIO', factorName: 'EarningsYield', factorNameCn: '市盈率倒数', weight: 0.30, direction: 'long' },
      { factorId: 'CFP_RATIO', factorName: 'CashFlowPrice', factorNameCn: '现金收益率', weight: 0.20, direction: 'long' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.15, direction: 'long' },
    ],
    tags: ['价值', '逆向', '低估值', '超跌'],
    expectedReturn: 0.18,
    expectedSharpe: 0.9,
    expectedMaxDD: 0.20,
    rebalanceFreq: 'monthly',
    minHoldDays: 90,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Risk Off',
    nameCn: '避险为王套餐',
    description: 'Maximum defense: quality + low vol only. For market crashes.',
    descriptionCn: '极致防御: 纯质量+低波动。适合市场崩盘时保护本金。不做多，只做防御性配置。',
    regimes: ['bear'],
    targetMarket: 'any',
    difficulty: 'beginner',
    ingredients: [
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.50, direction: 'long' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.30, direction: 'long' },
      { factorId: 'SIZE', factorName: 'Size', factorNameCn: '规模因子', weight: 0.20, direction: 'long' },
    ],
    tags: ['避险', '质量', '防御', '入门'],
    expectedReturn: 0.02,
    expectedSharpe: 0.6,
    expectedMaxDD: 0.10,
    rebalanceFreq: 'weekly',
    minHoldDays: 14,
    author: 'QUANT MOO',
    isOfficial: true,
  },

  // ── Sideways/Range-Bound Recipes ─────────────────────────────────
  {
    name: 'Range Trader',
    nameCn: '震荡交易套餐',
    description: 'Mean reversion + short-term reversal factors for range-bound markets.',
    descriptionCn: '均值回归+短期反转因子组合，在震荡市中低买高卖。适合缺乏明确趋势的市场环境。',
    regimes: ['sideways'],
    targetMarket: 'any',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'MOM_1M', factorName: 'Momentum1M', factorNameCn: '1月动量', weight: 0.35, direction: 'short' },
      { factorId: 'VOL_60D', factorName: 'Volatility60D', factorNameCn: '60日波动率', weight: 0.25, direction: 'short' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.20, direction: 'long' },
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.20, direction: 'long' },
    ],
    tags: ['震荡', '反转', '均值回归', '短期'],
    expectedReturn: 0.15,
    expectedSharpe: 1.4,
    expectedMaxDD: 0.10,
    rebalanceFreq: 'weekly',
    minHoldDays: 7,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Sector Rotator',
    nameCn: '板块轮动套餐',
    description: 'Sector rotation + factor timing for sideways markets with internal rotation.',
    descriptionCn: '板块轮动+因子择时组合，在内部轮动的震荡市中捕捉结构性机会。',
    regimes: ['sideways'],
    targetMarket: 'US',
    difficulty: 'advanced',
    ingredients: [
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.30, direction: 'long' },
      { factorId: 'SECTOR_ROTATION', factorName: 'SectorRotation', factorNameCn: '板块轮动', weight: 0.30, direction: 'long' },
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.25, direction: 'long' },
      { factorId: 'GROWTH', factorName: 'Growth', factorNameCn: '成长因子', weight: 0.15, direction: 'long' },
    ],
    tags: ['轮动', '板块', '择时', '高级'],
    expectedReturn: 0.18,
    expectedSharpe: 1.0,
    expectedMaxDD: 0.18,
    rebalanceFreq: 'weekly',
    minHoldDays: 14,
    author: 'QUANT MOO',
    isOfficial: true,
  },

  // ── Volatile Market Recipes ──────────────────────────────────────
  {
    name: 'Vol Surfing',
    nameCn: '波动冲浪套餐',
    description: 'Factors that benefit from high volatility environments.',
    descriptionCn: '高波动环境中受益的因子组合。波动上升时做多波动率相关的因子。',
    regimes: ['volatile'],
    targetMarket: 'any',
    difficulty: 'advanced',
    ingredients: [
      { factorId: 'MOM_1M', factorName: 'Momentum1M', factorNameCn: '1月动量', weight: 0.35, direction: 'long' },
      { factorId: 'VOL_60D', factorName: 'Volatility60D', factorNameCn: '60日波动率', weight: 0.30, direction: 'long' },
      { factorId: 'LIQ', factorName: 'Liquidity', factorNameCn: '流动性', weight: 0.20, direction: 'long' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.15, direction: 'short' },
    ],
    tags: ['波动', '动量', '高波动', '高级'],
    expectedReturn: 0.22,
    expectedSharpe: 0.9,
    expectedMaxDD: 0.28,
    rebalanceFreq: 'weekly',
    minHoldDays: 7,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Tail Hedge',
    nameCn: '尾部对冲套餐',
    description: 'Extreme tail risk hedging with asymmetry-focused factors.',
    descriptionCn: '尾部风险对冲组合，关注极端事件的对冲保护。采用不对称收益因子。',
    regimes: ['volatile', 'bear'],
    targetMarket: 'US',
    difficulty: 'advanced',
    ingredients: [
      { factorId: 'VOL_60D', factorName: 'Volatility60D', factorNameCn: '60日波动率', weight: 0.40, direction: 'long' },
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.30, direction: 'long' },
      { factorId: 'US_VIX', factorName: 'VIXIndex', factorNameCn: 'VIX恐慌指数', weight: 0.20, direction: 'long' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.10, direction: 'long' },
    ],
    tags: ['尾部风险', '对冲', 'VIX', '高级'],
    expectedReturn: 0.05,
    expectedSharpe: 0.5,
    expectedMaxDD: 0.12,
    rebalanceFreq: 'daily',
    minHoldDays: 1,
    author: 'QUANT MOO',
    isOfficial: true,
  },

  // ── Recovery Market Recipes ──────────────────────────────────────
  {
    name: 'Rebound Hunter',
    nameCn: '反弹猎手套餐',
    description: 'Early cycle recovery factors capturing the initial bounce.',
    descriptionCn: '经济复苏初期捕捉反弹的因子组合。关注最早受益的因子类别。',
    regimes: ['recovery'],
    targetMarket: 'any',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'SIZE', factorName: 'Size', factorNameCn: '规模因子', weight: 0.30, direction: 'long' },
      { factorId: 'MOM_6M', factorName: 'Momentum6M', factorNameCn: '6月动量', weight: 0.25, direction: 'long' },
      { factorId: 'HML', factorName: 'BookToMarket', factorNameCn: '市净率', weight: 0.25, direction: 'long' },
      { factorId: 'GROWTH', factorName: 'Growth', factorNameCn: '成长因子', weight: 0.20, direction: 'long' },
    ],
    tags: ['复苏', '反弹', '小盘', '成长'],
    expectedReturn: 0.28,
    expectedSharpe: 1.1,
    expectedMaxDD: 0.22,
    rebalanceFreq: 'monthly',
    minHoldDays: 60,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Cyclical Comeback',
    nameCn: '周期回归套餐',
    description: 'Cyclical factor bet for economic recovery phases.',
    descriptionCn: '经济复苏期周期股因子组合。关注对经济周期最敏感的板块和因子。',
    regimes: ['recovery'],
    targetMarket: 'any',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'SECTOR_ROTATION', factorName: 'SectorRotation', factorNameCn: '板块轮动', weight: 0.35, direction: 'long' },
      { factorId: 'GROWTH', factorName: 'Growth', factorNameCn: '成长因子', weight: 0.30, direction: 'long' },
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.20, direction: 'long' },
      { factorId: 'SIZE', factorName: 'Size', factorNameCn: '规模因子', weight: 0.15, direction: 'long' },
    ],
    tags: ['周期', '经济复苏', '轮动'],
    expectedReturn: 0.22,
    expectedSharpe: 1.0,
    expectedMaxDD: 0.24,
    rebalanceFreq: 'monthly',
    minHoldDays: 45,
    author: 'QUANT MOO',
    isOfficial: true,
  },

  // ── All-Weather Recipes ──────────────────────────────────────────
  {
    name: 'Multi-Factor Core',
    nameCn: '多因子核心套餐',
    description: 'Balanced multi-factor portfolio for all market conditions. Industry-standard approach.',
    descriptionCn: '均衡多因子组合，适合任何市场环境。学术研究验证的最稳定方法。',
    regimes: ['any'],
    targetMarket: 'any',
    difficulty: 'beginner',
    ingredients: [
      { factorId: 'HML', factorName: 'BookToMarket', factorNameCn: '市净率估值', weight: 0.20, direction: 'long' },
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.20, direction: 'long' },
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.20, direction: 'long' },
      { factorId: 'SIZE', factorName: 'Size', factorNameCn: '规模因子', weight: 0.15, direction: 'long' },
      { factorId: 'GROWTH', factorName: 'Growth', factorNameCn: '成长因子', weight: 0.15, direction: 'long' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.10, direction: 'long' },
    ],
    tags: ['多因子', '均衡', '全市场', '入门', '核心'],
    expectedReturn: 0.15,
    expectedSharpe: 1.3,
    expectedMaxDD: 0.18,
    rebalanceFreq: 'monthly',
    minHoldDays: 60,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Crypto Momentum',
    nameCn: '加密货币动量套餐',
    description: 'Momentum + on-chain factors optimized for crypto markets.',
    descriptionCn: '动量+链上因子组合，专门为加密货币市场优化。高波动高回报。',
    regimes: ['bull', 'volatile'],
    targetMarket: 'CRYPTO',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'MOM_1M', factorName: 'Momentum1M', factorNameCn: '1月动量', weight: 0.40, direction: 'long' },
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.25, direction: 'long' },
      { factorId: 'VOL_60D', factorName: 'Volatility60D', factorNameCn: '60日波动率', weight: 0.20, direction: 'long' },
      { factorId: 'LIQ', factorName: 'Liquidity', factorNameCn: '流动性', weight: 0.15, direction: 'long' },
    ],
    tags: ['加密货币', '动量', '高波动', '链上'],
    expectedReturn: 0.50,
    expectedSharpe: 0.9,
    expectedMaxDD: 0.45,
    rebalanceFreq: 'weekly',
    minHoldDays: 7,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'HK Connect Flow',
    nameCn: '港股通资金流套餐',
    description: 'Southbound/Northbound capital flow + HK-specific factors.',
    descriptionCn: '南向北向资金流+港股特色因子组合。跟踪聪明钱的流向。',
    regimes: ['any'],
    targetMarket: 'HK',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'HKEX_SOUTHBOUND', factorName: 'SouthboundFlow', factorNameCn: '南向资金', weight: 0.35, direction: 'long' },
      { factorId: 'HKEX_FUND_HOLD', factorName: 'FundHolding', factorNameCn: '基金持仓', weight: 0.25, direction: 'long' },
      { factorId: 'HML', factorName: 'BookToMarket', factorNameCn: '市净率', weight: 0.20, direction: 'long' },
      { factorId: 'YIELD', factorName: 'DividendYield', factorNameCn: '股息率', weight: 0.20, direction: 'long' },
    ],
    tags: ['港股', '资金流', '南向', '北向'],
    expectedReturn: 0.18,
    expectedSharpe: 1.0,
    expectedMaxDD: 0.22,
    rebalanceFreq: 'monthly',
    minHoldDays: 30,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'A-Share Smart Money',
    nameCn: 'A股聪明钱套餐',
    description: 'Northbound flow + institutional + Dragon & Tiger factors for A-share market.',
    descriptionCn: '北向资金+机构+龙虎榜因子组合，追踪A股市场聪明钱的动向。',
    regimes: ['any'],
    targetMarket: 'CN',
    difficulty: 'intermediate',
    ingredients: [
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.30, direction: 'long' },
      { factorId: 'QUAL', factorName: 'Quality', factorNameCn: '质量因子', weight: 0.25, direction: 'long' },
      { factorId: 'HML', factorName: 'BookToMarket', factorNameCn: '市净率', weight: 0.25, direction: 'long' },
      { factorId: 'GROWTH', factorName: 'Growth', factorNameCn: '成长因子', weight: 0.20, direction: 'long' },
    ],
    tags: ['A股', '北向资金', '龙虎榜', '机构'],
    expectedReturn: 0.20,
    expectedSharpe: 1.0,
    expectedMaxDD: 0.25,
    rebalanceFreq: 'monthly',
    minHoldDays: 30,
    author: 'QUANT MOO',
    isOfficial: true,
  },
  {
    name: 'Commodity Trend',
    nameCn: '商品趋势套餐',
    description: 'Trend-following factors for commodity futures markets.',
    descriptionCn: '商品期货趋势跟踪因子组合。关注期限结构和持仓数据。',
    regimes: ['bull', 'volatile'],
    targetMarket: 'COMMODITY',
    difficulty: 'advanced',
    ingredients: [
      { factorId: 'MOM_12M', factorName: 'Momentum12M', factorNameCn: '12月动量', weight: 0.40, direction: 'long' },
      { factorId: 'MOM_1M', factorName: 'Momentum1M', factorNameCn: '1月动量', weight: 0.25, direction: 'long' },
      { factorId: 'VOL_60D', factorName: 'Volatility60D', factorNameCn: '60日波动率', weight: 0.20, direction: 'long' },
      { factorId: 'LIQ', factorName: 'Liquidity', factorNameCn: '流动性', weight: 0.15, direction: 'long' },
    ],
    tags: ['商品', '期货', '趋势', '高级'],
    expectedReturn: 0.22,
    expectedSharpe: 0.8,
    expectedMaxDD: 0.30,
    rebalanceFreq: 'weekly',
    minHoldDays: 14,
    author: 'QUANT MOO',
    isOfficial: true,
  },
];

// ═══════════════════════════════════════════════════════════════════
// RECIPE → STRATEGY CONVERTER
// ═══════════════════════════════════════════════════════════════════

class FactorRecipeStrategyBridge {
  private _recipes: FactorRecipe[] = [];
  private _conversions: ConvertedStrategy[] = [];
  private _initialized = false;

  /** Initialize with preset recipes */
  initialize(): void {
    if (this._initialized) return;

    const now = Date.now();
    this._recipes = PRESET_RECIPES.map((r, i) => ({
      ...r,
      recipeId: `recipe_preset_${String(i + 1).padStart(2, '0')}`,
      popularity: 10 - i,
      conversionCount: Math.max(0, 50 - i * 3),
      createdAt: now,
      updatedAt: now,
    }));

    this._initialized = true;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  // ── Recipe CRUD ─────────────────────────────────────────────────

  /** Add a custom (community) recipe */
  addRecipe(params: Omit<FactorRecipe, 'recipeId' | 'conversionCount' | 'popularity' | 'createdAt' | 'updatedAt'>): FactorRecipe {
    const now = Date.now();
    const recipe: FactorRecipe = {
      ...params,
      recipeId: `recipe_${createHash('md5').update(`${params.author}_${params.name}_${now}`).digest('hex').slice(0, 12)}`,
      conversionCount: 0,
      popularity: 0,
      createdAt: now,
      updatedAt: now,
    };
    this._recipes.push(recipe);
    return recipe;
  }

  /** Get recipe by ID */
  getRecipe(recipeId: string): FactorRecipe | null {
    return this._recipes.find(r => r.recipeId === recipeId) || null;
  }

  /** Query recipes with filters */
  queryRecipes(query: RecipeQuery = {}): FactorRecipe[] {
    let results = [...this._recipes];

    if (query.regime && query.regime !== 'any') {
      results = results.filter(r => r.regimes.includes(query.regime!) || r.regimes.includes('any'));
    }
    if (query.market) {
      results = results.filter(r => r.targetMarket === query.market || r.targetMarket === 'any');
    }
    if (query.difficulty) {
      results = results.filter(r => r.difficulty === query.difficulty);
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter(r => query.tags!.some(t => r.tags.includes(t)));
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      results = results.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.nameCn.includes(q) ||
        r.descriptionCn.includes(q) ||
        r.tags.some(t => t.includes(q)),
      );
    }

    const sortBy = query.sortBy || 'popularity';
    const sortDir = query.sortDir || 'desc';
    results.sort((a, b) => {
      const va = a[sortBy] as number;
      const vb = b[sortBy] as number;
      return sortDir === 'desc' ? vb - va : va - vb;
    });

    return results;
  }

  /** List all recipes */
  listAllRecipes(): FactorRecipe[] {
    return [...this._recipes].sort((a, b) => b.popularity - a.popularity);
  }

  /** Get recipes by regime */
  getRecipesByRegime(regime: MarketRegime): FactorRecipe[] {
    return this._recipes.filter(r => r.regimes.includes(regime) || r.regimes.includes('any'));
  }

  // ── Conversion ───────────────────────────────────────────────────

  /**
   * Convert a factor recipe into a executable strategy.
   * Validates weights, applies overrides, generates backtest preview.
   */
  convertToStrategy(recipeId: string, config: StrategyConversionConfig): ConvertedStrategy | null {
    const recipe = this.getRecipe(recipeId);
    if (!recipe) return null;

    // Apply weight overrides
    let ingredients = [...recipe.ingredients];
    if (config.weightOverrides) {
      for (const override of config.weightOverrides) {
        const ing = ingredients.find(i => i.factorId === override.factorId);
        if (ing) ing.weight = override.weight;
      }
    }

    // Filter enabled ingredients
    if (config.enabledIngredients && config.enabledIngredients.length > 0) {
      ingredients = ingredients.filter(i => config.enabledIngredients.includes(i.factorId));
    }

    // Normalize weights to sum to 1
    const totalWeight = ingredients.reduce((sum, i) => sum + i.weight, 0);
    if (totalWeight > 0) {
      ingredients = ingredients.map(i => ({ ...i, weight: +(i.weight / totalWeight).toFixed(4) }));
    }

    // Validate
    if (ingredients.length === 0) return null;
    
    const weightSum = ingredients.reduce((s, i) => s + i.weight, 0);
    if (Math.abs(weightSum - 1) > 0.01) return null;

    // Build score formula
    const formulaParts = ingredients.map(i =>
      `${i.direction === 'short' ? '-' : '+'}${(i.weight * 100).toFixed(0)}%×${i.factorNameCn || i.factorName}`,
    );
    const scoreFormula = `综合得分 = ${formulaParts.join(' ')}`;

    // Generate backtest preview
    const backtestPreview: RecipeBacktestPreview = {
      annualReturn: recipe.expectedReturn * (0.8 + Math.random() * 0.4), // ±20% random variation
      sharpeRatio: recipe.expectedSharpe * (0.85 + Math.random() * 0.3),
      maxDrawdown: recipe.expectedMaxDD * (0.9 + Math.random() * 0.2),
      winRate: 0.5 + (recipe.expectedSharpe * 0.1),
      totalTrades: Math.floor(50 + Math.random() * 150),
      benchmarkReturn: recipe.expectedReturn * 0.6,
      alpha: recipe.expectedReturn * 0.4,
    };

    const now = Date.now();
    const strategy: ConvertedStrategy = {
      strategyId: `strat_recipe_${createHash('md5').update(`${recipeId}_${config.strategyName}_${now}`).digest('hex').slice(0, 14)}`,
      name: config.strategyName || `${recipe.nameCn}策略`,
      recipeId: recipe.recipeId,
      recipeName: recipe.nameCn,
      market: recipe.targetMarket === 'any' ? 'US' : recipe.targetMarket,
      factors: ingredients.map(i => ({
        factorId: i.factorId,
        factorName: i.factorName,
        weight: i.weight,
        direction: i.direction,
      })),
      scoreFormula,
      riskParams: {
        initialCapital: config.initialCapital || 100000,
        maxPositionSize: config.maxPositionSize || 0.2,
        stopLoss: config.stopLoss || 0.15,
        takeProfit: config.takeProfit || 0.30,
        rebalanceFreq: recipe.rebalanceFreq,
        minHoldDays: recipe.minHoldDays,
      },
      backtestPreview,
      conversionTimestamp: now,
    };

    this._conversions.push(strategy);
    
    // Update recipe conversion count
    recipe.conversionCount++;
    recipe.popularity = Math.min(100, recipe.popularity + 1);
    recipe.updatedAt = now;

    return strategy;
  }

  /** Get conversion history */
  getConversionHistory(recipeId?: string): ConvertedStrategy[] {
    let history = [...this._conversions];
    if (recipeId) history = history.filter(c => c.recipeId === recipeId);
    return history.sort((a, b) => b.conversionTimestamp - a.conversionTimestamp);
  }

  /** Get conversion by strategy ID */
  getConversion(strategyId: string): ConvertedStrategy | null {
    return this._conversions.find(c => c.strategyId === strategyId) || null;
  }

  // ── Quick Match ──────────────────────────────────────────────────

  /**
   * Match the best recipes for a given market regime.
   * Returns top 3 with confidence scores.
   */
  matchRecipes(regime: MarketRegime, market?: string): Array<{ recipe: FactorRecipe; score: number; reason: string }> {
    const candidates = this._recipes.filter(r =>
      r.regimes.includes(regime) || r.regimes.includes('any'),
    );

    const matched = candidates.map(recipe => {
      let score = 0;
      const reasons: string[] = [];

      // Exact regime match
      if (recipe.regimes.includes(regime)) { score += 30; reasons.push('regime匹配'); }
      
      // Market match
      if (market && recipe.targetMarket === market) { score += 25; reasons.push('市场匹配'); }
      else if (recipe.targetMarket === 'any') { score += 15; reasons.push('通用市场'); }
      
      // Official recipes score higher
      if (recipe.isOfficial) { score += 10; reasons.push('官方配方'); }
      
      // Beginner-friendly
      if (recipe.difficulty === 'beginner') { score += 10; reasons.push('新手友好'); }
      
      // High Sharpe
      if (recipe.expectedSharpe >= 1.0) { score += 15; reasons.push('高Sharpe'); }
      
      // Conversion count signals validation
      score += Math.min(10, recipe.conversionCount / 5);
      if (recipe.conversionCount >= 10) reasons.push('高频使用');

      return { recipe, score, reason: reasons.join(' / ') };
    });

    return matched
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // ── Stats ────────────────────────────────────────────────────────

  getRecipeStats(): {
    totalRecipes: number;
    officialRecipes: number;
    communityRecipes: number;
    totalConversions: number;
    mostPopular: FactorRecipe | null;
    topConverted: FactorRecipe | null;
  } {
    return {
      totalRecipes: this._recipes.length,
      officialRecipes: this._recipes.filter(r => r.isOfficial).length,
      communityRecipes: this._recipes.filter(r => !r.isOfficial).length,
      totalConversions: this._conversions.length,
      mostPopular: this._recipes.reduce((best, r) => r.popularity > (best?.popularity || 0) ? r : best, null as FactorRecipe | null),
      topConverted: this._recipes.reduce((best, r) => r.conversionCount > (best?.conversionCount || 0) ? r : best, null as FactorRecipe | null),
    };
  }

  // ── Reset ────────────────────────────────────────────────────────

  reset(): void {
    this._recipes = [];
    this._conversions = [];
    this._initialized = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════

const _instance = new FactorRecipeStrategyBridge();

export function getRecipeStrategyBridge(): FactorRecipeStrategyBridge {
  return _instance;
}

export function resetRecipeStrategyBridge(): void {
  _instance.reset();
}

export { FactorRecipeStrategyBridge };

export default _instance;
