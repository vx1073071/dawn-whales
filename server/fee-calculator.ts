// @ts-nocheck
/**
 * DAWN WHALES R132 J02 — Fee Calculator + Stop-Loss/Take-Profit Engine
 * 
 * Dual-mode fee calculation:
 *  - v15 business model: taker 0.1% / maker 0.02% / platform 100%
 *  - Per-broker overrides: Binance VIP tiers, OKX fee schedule, Bybit maker fee
 * 
 * Stop-Loss / Take-Profit calculation:
 *  - Fixed price: absolute SL/TP
 *  - Percentage: SL/TP based on entry price (e.g., -5% SL, +10% TP)
 *  - Trailing stop: dynamic SL that follows price up
 *  - ATR-based: SL = entry - (ATR * multiplier)
 */

export type FeeTier = 'taker' | 'maker';

export interface FeeBreakdown {
  totalValue: number;
  feeRate: number;
  feeAmount: number;
  tier: FeeTier;
  brokerId: string;
  currency: string;
  /** Revenue split: platform keeps this fraction per v15 */
  platformSplit: number;
  creatorSplit: number;
}

export interface StopLossConfig {
  type: 'fixed' | 'percentage' | 'trailing' | 'atr';
  /** Fixed stop price for fixed type */
  stopPrice?: number;
  /** Stop percentage (e.g., -5 for 5% below entry) */
  stopPercent?: number;
  /** Take profit percentage (e.g., 10 for 10% above entry) */
  takeProfitPercent?: number;
  /** Trailing stop distance in price */
  trailingDistance?: number;
  /** ATR multiplier for ATR-based stop */
  atrMultiplier?: number;
  atrValue?: number;
}

export interface PositionPnL {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  fees: FeeBreakdown;
  stopPrice?: number;
  takeProfitPrice?: number;
  stopTriggered: boolean;
  takeProfitTriggered: boolean;
}

// ═══════════════ Fee Calculator ═══════════════════════════

export class FeeCalculator {
  /** Default v15 fee structure */
  private static DEFAULT_TAKER = 0.001;   // 0.1%
  private static DEFAULT_MAKER = 0.0002; // 0.02%
  private static PLATFORM_SHARE = 1.0;    // 100% per v15 (no external exchange)

  /** Per-broker tiered fees */
  private static BROKER_FEES: Record<string, { taker: number; maker: number }> = {
    binance: { taker: 0.001, maker: 0.00075 },   // VIP 0
    'binance-vip1': { taker: 0.00075, maker: 0.0005 },
    okx: { taker: 0.001, maker: 0.0008 },
    bybit: { taker: 0.001, maker: 0.0001 },       // zero maker fee promo
    bitget: { taker: 0.001, maker: 0.0002 },
    robinhood: { taker: 0.004, maker: 0.0035 },   // high spread
    futu: { taker: 0.0003, maker: 0.0001 },       // HK low fees
    moomoo: { taker: 0.0008, maker: 0.0003 },
  };

  /**
   * Calculate trading fees for an order.
   * @param brokerId Broker identifier for tier lookup
   * @param symbol Trading pair
   * @param price Order price
   * @param quantity Order quantity
   * @param orderType MARKET or LIMIT
   */
  static calculateFee(
    brokerId: string,
    symbol: string,
    price: number,
    quantity: number,
    orderType: 'MARKET' | 'LIMIT',
  ): FeeBreakdown {
    const totalValue = price * quantity;
    const tier: FeeTier = orderType === 'MARKET' ? 'taker' : 'maker';

    // Look up broker-specific fee or use default
    const broker = this.BROKER_FEES[brokerId];
    const feeRate = broker ? broker[tier] : (tier === 'taker' ? this.DEFAULT_TAKER : this.DEFAULT_MAKER);
    const feeAmount = totalValue * feeRate;
    const platformSplit = this.PLATFORM_SHARE;

    return {
      totalValue,
      feeRate,
      feeAmount,
      tier,
      brokerId,
      currency: 'USDT',
      platformSplit,
      creatorSplit: 1 - platformSplit,
    };
  }

  /**
   * Calculate fee for multiple orders (batch).
   */
  static calculateBatchFees(
    orders: Array<{ brokerId: string; symbol: string; price: number; quantity: number; orderType: 'MARKET' | 'LIMIT' }>,
  ): FeeBreakdown[] {
    return orders.map((o) => this.calculateFee(o.brokerId, o.symbol, o.price, o.quantity, o.orderType));
  }

  /**
   * Calculate total fees saved by using LIMIT (maker) vs MARKET (taker).
   */
  static estimateFeeSavings(brokerId: string, totalValue: number): number {
    const broker = this.BROKER_FEES[brokerId];
    const takerRate = broker?.taker || this.DEFAULT_TAKER;
    const makerRate = broker?.maker || this.DEFAULT_MAKER;
    return totalValue * (takerRate - makerRate);
  }

  /** Calculate creator earnings from fees per v15 model */
  static calculateCreatorEarnings(fees: FeeBreakdown[], creatorLevel: 1 | 2 | 3): number {
    // v15 creator splits: L1 70%, L2 80%, L3 90%
    const share = creatorLevel === 3 ? 0.9 : creatorLevel === 2 ? 0.8 : 0.7;
    return fees.reduce((sum, f) => sum + f.feeAmount * share, 0);
  }
}

// ═══════════════ Stop-Loss / Take-Profit Engine ═══════════

export class StopLossEngine {
  /**
   * Calculate stop-loss and take-profit prices.
   */
  static calculate(
    entryPrice: number,
    side: 'BUY' | 'SELL',
    config: StopLossConfig,
  ): { stopPrice?: number; takeProfitPrice?: number } {
    let stopPrice: number | undefined;
    let takeProfitPrice: number | undefined;

    const direction = side === 'BUY' ? 1 : -1;

    switch (config.type) {
      case 'fixed':
        stopPrice = config.stopPrice;
        break;

      case 'percentage':
        if (config.stopPercent) {
          stopPrice = entryPrice * (1 - direction * Math.abs(config.stopPercent) / 100);
        }
        if (config.takeProfitPercent) {
          takeProfitPrice = entryPrice * (1 + direction * Math.abs(config.takeProfitPercent) / 100);
        }
        break;

      case 'trailing':
        if (config.trailingDistance) {
          stopPrice = entryPrice - direction * config.trailingDistance;
        }
        break;

      case 'atr':
        if (config.atrMultiplier && config.atrValue) {
          stopPrice = entryPrice - direction * config.atrMultiplier * config.atrValue;
        }
        break;
    }

    return { stopPrice, takeProfitPrice };
  }

  /**
   * Update trailing stop based on latest price.
   * Only moves stop UP for long positions, DOWN for short positions.
   */
  static updateTrailingStop(
    currentStopPrice: number,
    latestPrice: number,
    side: 'BUY' | 'SELL',
    trailingDistance: number,
  ): number {
    if (side === 'BUY') {
      const newStop = latestPrice - trailingDistance;
      return newStop > currentStopPrice ? newStop : currentStopPrice;
    } else {
      const newStop = latestPrice + trailingDistance;
      return newStop < currentStopPrice ? newStop : currentStopPrice;
    }
  }

  /**
   * Check if stop-loss or take-profit has been triggered.
   */
  static checkTrigger(
    currentPrice: number,
    side: 'BUY' | 'SELL',
    stopPrice?: number,
    takeProfitPrice?: number,
  ): { stopTriggered: boolean; takeProfitTriggered: boolean } {
    let stopTriggered = false;
    let takeProfitTriggered = false;

    if (stopPrice) {
      if (side === 'BUY') {
        stopTriggered = currentPrice <= stopPrice;
      } else {
        stopTriggered = currentPrice >= stopPrice;
      }
    }

    if (takeProfitPrice) {
      if (side === 'BUY') {
        takeProfitTriggered = currentPrice >= takeProfitPrice;
      } else {
        takeProfitTriggered = currentPrice <= takeProfitPrice;
      }
    }

    return { stopTriggered, takeProfitTriggered };
  }
}

// ═══════════════ Position PnL ═════════════════════════════

export class PnLCalculator {
  /**
   * Calculate unrealized PnL for a position.
   */
  static calculateUnrealized(
    entryPrice: number,
    currentPrice: number,
    quantity: number,
    side: 'BUY' | 'SELL',
  ): { unrealizedPnl: number; unrealizedPnlPct: number } {
    const multiplier = side === 'BUY' ? 1 : -1;
    const unrealizedPnl = (currentPrice - entryPrice) * quantity * multiplier;
    const initialValue = entryPrice * quantity;
    const unrealizedPnlPct = initialValue > 0 ? (unrealizedPnl / initialValue) * 100 : 0;

    return { unrealizedPnl, unrealizedPnlPct };
  }

  /**
   * Full position PnL: unrealized + realized + fee deduction.
   */
  static fullPositionPnL(
    symbol: string,
    entryPrice: number,
    currentPrice: number,
    quantity: number,
    side: 'BUY' | 'SELL',
    brokerId: string,
    realizedPnl = 0,
    slConfig?: StopLossConfig,
  ): PositionPnL {
    const { unrealizedPnl, unrealizedPnlPct } = this.calculateUnrealized(entryPrice, currentPrice, quantity, side);
    const fees = FeeCalculator.calculateFee(brokerId, symbol, currentPrice, quantity, 'MARKET');
    const stopResult = slConfig ? StopLossEngine.calculate(entryPrice, side, slConfig) : {};
    const trigger = StopLossEngine.checkTrigger(currentPrice, side, stopResult.stopPrice, stopResult.takeProfitPrice);

    return {
      symbol,
      entryPrice,
      currentPrice,
      quantity,
      side,
      unrealizedPnl,
      unrealizedPnlPct,
      realizedPnl,
      fees,
      stopPrice: stopResult.stopPrice,
      takeProfitPrice: stopResult.takeProfitPrice,
      stopTriggered: trigger.stopTriggered,
      takeProfitTriggered: trigger.takeProfitTriggered,
    };
  }

  /**
   * Batch PnL for multiple positions.
   */
  static batchPnL(positions: Array<{
    symbol: string; entryPrice: number; currentPrice: number; quantity: number;
    side: 'BUY' | 'SELL'; brokerId: string; realizedPnl?: number; slConfig?: StopLossConfig;
  }>): PositionPnL[] {
    return positions.map((p) =>
      this.fullPositionPnL(p.symbol, p.entryPrice, p.currentPrice, p.quantity, p.side, p.brokerId, p.realizedPnl || 0, p.slConfig),
    );
  }

  /**
   * Portfolio summary: total equity, total PnL, ROI.
   */
  static portfolioSummary(
    positions: PositionPnL[],
    initialCapital: number,
  ): { totalEquity: number; totalUnrealizedPnl: number; totalRealizedPnl: number; totalFees: number; roiPct: number } {
    const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const totalRealizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0);
    const totalFees = positions.reduce((sum, p) => sum + p.fees.feeAmount, 0);
    const totalEquity = initialCapital + totalUnrealizedPnl + totalRealizedPnl - totalFees;
    const roiPct = initialCapital > 0 ? ((totalEquity - initialCapital) / initialCapital) * 100 : 0;

    return { totalEquity, totalUnrealizedPnl, totalRealizedPnl, totalFees, roiPct };
  }
}
