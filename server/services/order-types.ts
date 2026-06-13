// @ts-nocheck
/**
 * DAWN WHALES R147 J01 — Order Types Engine
 * 
 * 4 order types with default routing per scenario:
 *   1. Strategy Entry → LIMIT  (user can switch to MARKET)
 *   2. Copy Trade Entry → MARKET (must follow trader; can switch to LIMIT)
 *   3. Stop Loss → MARKET (must execute, non-overridable)
 *   4. Take Profit → LIMIT (precise exit)
 * 
 * Limit order logic:
 *   - Price offset from current price (±N tick levels)
 *   - Timeout: GTC (Good-Til-Cancelled), expires if unfilled by session close
 * 
 * ≥250L
 */

export type OrderScenario = 'strategy_entry' | 'copy_trade_entry' | 'stop_loss' | 'take_profit';
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';

export interface OrderTypeConfig {
  scenario: OrderScenario;
  defaultType: OrderType;
  allowedTypes: OrderType[];
  overridable: boolean;
  description: string;
}

export interface OrderOptions {
  scenario: OrderScenario;
  requestedType?: OrderType;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  currentPrice: number;
  limitPrice?: number;
  stopPrice?: number;
  timeoutMinutes?: number; // GTC: 0 = no timeout, >0 = expire after N minutes
}

export interface OrderValidationResult {
  valid: boolean;
  orderType: OrderType;
  finalPrice?: number;
  priceOffsetPct?: number;
  expiresAt?: string;
  reason?: string;
}

// ═══════════════ Default Config ═════════════════════════════════════════

const ORDER_TYPE_CONFIGS: Record<OrderScenario, OrderTypeConfig> = {
  strategy_entry: {
    scenario: 'strategy_entry',
    defaultType: 'LIMIT',
    allowedTypes: ['LIMIT', 'MARKET'],
    overridable: true,
    description: '策略入场: 默认限价单(可控成本), 可切市价(快速成交)',
  },
  copy_trade_entry: {
    scenario: 'copy_trade_entry',
    defaultType: 'MARKET',
    allowedTypes: ['MARKET', 'LIMIT'],
    overridable: true,
    description: '跟单入场: 默认市价单(跟上作者), 可切限价(防滑点)',
  },
  stop_loss: {
    scenario: 'stop_loss',
    defaultType: 'MARKET',
    allowedTypes: ['MARKET', 'STOP_MARKET'],
    overridable: false,
    description: '止损: 市价/止损市价, 必须执行不可调',
  },
  take_profit: {
    scenario: 'take_profit',
    defaultType: 'LIMIT',
    allowedTypes: ['LIMIT'],
    overridable: false,
    description: '止盈: 限价单, 精准出场',
  },
};

// Tick sizes per market
const TICK_SIZES: Record<string, number> = {
  HK: 0.01,
  US: 0.01,
  CN: 0.01,
  CRYPTO: 0.01,
  default: 0.01,
};

// Max offset from current price (percentage)
const MAX_PRICE_OFFSET_PCT = 10; // 10%
const DEFAULT_GTC_MINUTES = 0;   // 0 = no timeout (GTC)

// ═══════════════ Order Types Service ════════════════════════════════════

export class OrderTypesService {

  getConfig(scenario: OrderScenario): OrderTypeConfig {
    return ORDER_TYPE_CONFIGS[scenario];
  }

  getAllConfigs(): OrderTypeConfig[] {
    return Object.values(ORDER_TYPE_CONFIGS);
  }

  /**
   * Validate and compute final order parameters.
   */
  validateAndCompute(options: OrderOptions): OrderValidationResult {
    const config = ORDER_TYPE_CONFIGS[options.scenario];
    if (!config) {
      return { valid: false, orderType: 'MARKET', reason: `Unknown scenario: ${options.scenario}` };
    }

    // Determine order type
    const orderType = options.requestedType || config.defaultType;

    // Check if valid for this scenario
    if (!config.allowedTypes.includes(orderType)) {
      return {
        valid: false, orderType,
        reason: `${orderType} not allowed for ${options.scenario}. Allowed: ${config.allowedTypes.join(', ')}`,
      };
    }

    // Check override permission
    if (options.requestedType && !config.overridable && options.requestedType !== config.defaultType) {
      return {
        valid: false, orderType: config.defaultType,
        reason: `${options.scenario} does not allow type override. Must use ${config.defaultType}.`,
      };
    }

    // For MARKET orders — no price validation needed
    if (orderType === 'MARKET' || orderType === 'STOP_MARKET') {
      return { valid: true, orderType };
    }

    // For LIMIT / STOP_LIMIT — compute price
    const finalPrice = this.computeLimitPrice(options, orderType);
    const priceOffsetPct = Math.abs((finalPrice - options.currentPrice) / options.currentPrice) * 100;

    // Validate price offset
    if (priceOffsetPct > MAX_PRICE_OFFSET_PCT) {
      return {
        valid: false, orderType, finalPrice, priceOffsetPct,
        reason: `Price offset ${priceOffsetPct.toFixed(1)}% exceeds max ${MAX_PRICE_OFFSET_PCT}%. Current: ${options.currentPrice}, computed: ${finalPrice}.`,
      };
    }

    // Compute expiry
    const timeoutMin = options.timeoutMinutes ?? DEFAULT_GTC_MINUTES;
    const expiresAt = timeoutMin > 0
      ? new Date(Date.now() + timeoutMin * 60000).toISOString()
      : undefined;

    return { valid: true, orderType, finalPrice, priceOffsetPct, expiresAt };
  }

  /**
   * Compute limit price based on scenario defaults.
   */
  private computeLimitPrice(options: OrderOptions, orderType: OrderType): number {
    const tickSize = TICK_SIZES[options.symbol?.split('.')?.[0] || 'default'] || TICK_SIZES.default;
    const currentPrice = options.currentPrice;

    // If user provided explicit limit price, use it
    if (options.limitPrice && options.limitPrice > 0) {
      return roundToTick(options.limitPrice, tickSize);
    }

    if (orderType === 'LIMIT') {
      if (options.scenario === 'strategy_entry') {
        // Buy: -1 tick (better fill), Sell: +1 tick (better exit)
        const offset = options.side === 'BUY' ? -1 : 1;
        return roundToTick(currentPrice + offset * tickSize, tickSize);
      }
      if (options.scenario === 'copy_trade_entry') {
        // Copy trade: buy at +0.5% to ensure fill, sell at -0.5%
        const offsetPct = options.side === 'BUY' ? 0.005 : -0.005;
        return roundToTick(currentPrice * (1 + offsetPct), tickSize);
      }
      if (options.scenario === 'take_profit') {
        // Take profit: sell above current (profit target)
        return options.side === 'SELL'
          ? roundToTick(currentPrice * 1.015, tickSize) // +1.5% above current
          : roundToTick(currentPrice * 0.985, tickSize);
      }
      return roundToTick(currentPrice, tickSize);
    }

    if (orderType === 'STOP_LIMIT') {
      // Stop entry: buy above trigger, sell below trigger
      const offsetPct = options.side === 'BUY' ? 0.005 : -0.005;
      return roundToTick(
        (options.stopPrice || currentPrice) * (1 + offsetPct),
        tickSize
      );
    }

    return roundToTick(currentPrice, tickSize);
  }

  /**
   * Get the tick size for price rounding.
   */
  getTickSize(symbol: string): number {
    return TICK_SIZES[symbol?.split('.')?.[0] || 'default'] || TICK_SIZES.default;
  }
}

function roundToTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}
