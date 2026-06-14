// ── R174 D5: Factor → Trade Execution Pipeline ──────────────────────────────
// Converts factor strategies into actual orders with position sizing,
// fee calculation, and multi-asset execution routing.
//
// Flow: FactorStrategy.weights → PositionSizer.calc() → OrderExecutor.place() → FeeCalculator
//
// Asset classes: US_STOCK, HK_STOCK, ETF, CRYPTO_SPOT, CRYPTO_FUTURES
// Fee structure: 0.1% stock, 0.02% futures, min 2 USDT
//
// Connects to: D4 signal pipeline, existing billing infrastructure

import log from 'electron-log';
import type { FactorSignal, FactorStrategy } from './factor-signal-pipeline';
import { getFactorSignalPipeline } from './factor-signal-pipeline';

// ── Types ───────────────────────────────────────────────────────────────────

export type AssetClass = 'US_STOCK' | 'HK_STOCK' | 'ETF' | 'CRYPTO_SPOT' | 'CRYPTO_FUTURES';

export type OrderSide = 'BUY' | 'SELL';

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS';

export type OrderStatus = 'PENDING' | 'SUBMITTED' | 'FILLED' | 'PARTIAL_FILLED' | 'CANCELLED' | 'REJECTED';

/** Position sizing input */
export interface PositionSizeRequest {
  symbol: string;
  assetClass: AssetClass;
  currentPrice: number;
  accountEquity: number;
  factorWeight: number;       // 0-1 weight from factor strategy
  maxPositionPct: number;     // Max % of equity per position (default 0.2)
  riskPerTradePct: number;    // Max % risk per trade (default 0.02)
  volatility20d?: number;     // Annualized volatility for ATR-based sizing
}

/** Position sizing result */
export interface PositionSizeResult {
  symbol: string;
  assetClass: AssetClass;
  side: OrderSide;
  quantity: number;
  quantityType: 'shares' | 'contracts' | 'units';
  notionalValue: number;
  positionPct: number;        // % of account equity
  riskAmount: number;         // Max loss if stop triggered
  stopLossPrice?: number;
  sizingMethod: string;       // 'equal_weight' | 'risk_parity' | 'vol_targeted'
  maxQuantity: number;        // Max allowed by constraints
}

/** Fee structure per asset class */
export interface FeeEstimate {
  assetClass: AssetClass;
  commissionRate: number;      // e.g., 0.001 = 0.1%
  minCommission: number;       // Minimum fee in USDT
  platformFee: number;         // Platform fee per trade
  totalFee: number;            // Total estimated fee
  feeInBps: number;            // Fee in basis points
  effective: boolean;          // Whether fee ≤ 2% of trade value
}

/** Order request */
export interface OrderRequest {
  symbol: string;
  assetClass: AssetClass;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;             // For LIMIT/STOP orders
  stopPrice?: number;          // For STOP_LOSS
  feeEstimate: FeeEstimate;
  strategyId: string;
  signalIds: string[];
}

/** Order confirmation */
export interface OrderConfirmation {
  orderId: string;
  request: OrderRequest;
  status: OrderStatus;
  filledQuantity: number;
  averagePrice: number;
  filledAt: number;
  fee: FeeEstimate;
  notes: string;
}

// ── Fee Schedule ────────────────────────────────────────────────────────────

const FEE_SCHEDULE: Record<AssetClass, { commissionRate: number; minCommission: number; platformFee: number }> = {
  US_STOCK:        { commissionRate: 0.001,  minCommission: 2.0, platformFee: 0 },
  HK_STOCK:        { commissionRate: 0.001,  minCommission: 2.0, platformFee: 0.5 },
  ETF:             { commissionRate: 0.0005, minCommission: 1.0, platformFee: 0 },
  CRYPTO_SPOT:     { commissionRate: 0.002,  minCommission: 2.0, platformFee: 0 },
  CRYPTO_FUTURES:  { commissionRate: 0.0002, minCommission: 2.0, platformFee: 0 },
};

// ── Position Sizer ──────────────────────────────────────────────────────────

export class PositionSizer {
  /**
   * Calculate position size from factor strategy weights.
   */
  calc(request: PositionSizeRequest): PositionSizeResult {
    const {
      symbol, assetClass, currentPrice, accountEquity,
      factorWeight, maxPositionPct = 0.2, riskPerTradePct = 0.02, volatility20d,
    } = request;

    // Method 1: Equal weight allocation (factor weight × account × maxPct)
    const navWeighted = accountEquity * factorWeight * maxPositionPct;
    const qtyWeighted = Math.floor(navWeighted / currentPrice);

    // Method 2: Risk parity (size based on risk budget)
    const riskBudget = accountEquity * riskPerTradePct;
    const qtyRisk = volatility20d && volatility20d > 0
      ? Math.floor(riskBudget / (currentPrice * volatility20d))
      : qtyWeighted;

    // Method 3: Vol-targeted (if volatility info available)
    let sizingMethod = 'equal_weight';
    let quantity = qtyWeighted;
    let stopLossPrice: number | undefined;

    if (volatility20d && volatility20d > 0) {
      sizingMethod = 'vol_targeted';
      quantity = qtyRisk;
      stopLossPrice = currentPrice * (1 - volatility20d * 2); // 2σ stop
    }

    // Apply asset-specific quantity constraints
    const maxQuantity = this.getMaxQuantity(assetClass, accountEquity, currentPrice, maxPositionPct);
    quantity = Math.min(quantity, maxQuantity);
    quantity = Math.max(1, quantity); // At least 1 unit

    const notionalValue = quantity * currentPrice;
    const positionPct = notionalValue / accountEquity;

    return {
      symbol, assetClass,
      side: factorWeight > 0 ? 'BUY' : 'SELL',
      quantity,
      quantityType: this.getQuantityType(assetClass),
      notionalValue: Math.round(notionalValue * 100) / 100,
      positionPct: Math.round(positionPct * 10000) / 100,
      riskAmount: Math.round(riskPerTradePct * accountEquity * 100) / 100,
      stopLossPrice: stopLossPrice ? Math.round(stopLossPrice * 100) / 100 : undefined,
      sizingMethod,
      maxQuantity,
    };
  }

  private getMaxQuantity(assetClass: AssetClass, equity: number, price: number, maxPct: number): number {
    const maxNotional = equity * maxPct;
    return Math.floor(maxNotional / price);
  }

  private getQuantityType(assetClass: AssetClass): PositionSizeResult['quantityType'] {
    switch (assetClass) {
      case 'US_STOCK':
      case 'HK_STOCK':
      case 'ETF':
        return 'shares';
      case 'CRYPTO_SPOT':
        return 'units';
      case 'CRYPTO_FUTURES':
        return 'contracts';
      default:
        return 'shares';
    }
  }
}

// ── Fee Calculator ──────────────────────────────────────────────────────────

export class FeeCalculator {
  /**
   * Estimate fees for a proposed trade.
   */
  estimate(assetClass: AssetClass, notionalValue: number): FeeEstimate {
    const schedule = FEE_SCHEDULE[assetClass];
    const commission = notionalValue * schedule.commissionRate;
    const minCommission = schedule.minCommission;
    const platformFee = schedule.platformFee;
    const totalFee = Math.max(commission, minCommission) + platformFee;
    const feeInBps = notionalValue > 0 ? (totalFee / notionalValue) * 10000 : 0;

    return {
      assetClass,
      commissionRate: schedule.commissionRate,
      minCommission,
      platformFee,
      totalFee: Math.round(totalFee * 100) / 100,
      feeInBps: Math.round(feeInBps * 10) / 10,
      effective: totalFee / Math.max(notionalValue, 1) <= 0.02, // ≤2% of trade
    };
  }

  /**
   * Check if a trade is economically viable (fee ≤ 2% of value).
   */
  isViable(assetClass: AssetClass, notionalValue: number): boolean {
    return this.estimate(assetClass, notionalValue).effective;
  }
}

// ── Order Executor ──────────────────────────────────────────────────────────

export class OrderExecutor {
  private feeCalc = new FeeCalculator();
  private pendingOrders: Map<string, OrderConfirmation> = new Map();

  /**
   * Place an order from a position size result.
   */
  async placeOrder(
    position: PositionSizeResult,
    strategyId: string,
    signalIds: string[],
  ): Promise<OrderConfirmation> {
    const feeEstimate = this.feeCalc.estimate(position.assetClass, position.notionalValue);

    if (!feeEstimate.effective) {
      return this.buildRejection(position, strategyId, signalIds, feeEstimate,
        `交易不经济: 费用${feeEstimate.feeInBps}bps超过2%阈值`);
    }

    const request: OrderRequest = {
      symbol: position.symbol,
      assetClass: position.assetClass,
      side: position.side,
      type: 'MARKET',
      quantity: position.quantity,
      stopPrice: position.stopLossPrice,
      feeEstimate,
      strategyId,
      signalIds,
    };

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Simulate execution (in production: call broker API)
    const confirmation: OrderConfirmation = {
      orderId,
      request,
      status: 'FILLED',
      filledQuantity: position.quantity,
      averagePrice: position.notionalValue / Math.max(1, position.quantity),
      filledAt: Date.now(),
      fee: feeEstimate,
      notes: `${position.sizingMethod} sizing, ${position.quantity} ${position.quantityType}`,
    };

    this.pendingOrders.set(orderId, confirmation);
    log.info(`[OrderExecutor] ${position.side} ${position.symbol} ×${position.quantity} @ ~${confirmation.averagePrice.toFixed(2)}, fee=${feeEstimate.totalFee}U`);

    return confirmation;
  }

  /**
   * Execute all positions from a factor strategy.
   */
  async executeStrategy(
    strategy: FactorStrategy,
    positions: PositionSizeResult[],
  ): Promise<OrderConfirmation[]> {
    const confirmations: OrderConfirmation[] = [];
    const signalIds = strategy.signals.map(s => s.signalId);

    for (const position of positions) {
      const conf = await this.placeOrder(position, strategy.strategyId, signalIds);
      confirmations.push(conf);
    }

    const totalFee = confirmations.reduce((s, c) => s + c.fee.totalFee, 0);
    log.info(`[OrderExecutor] Strategy "${strategy.name}": ${confirmations.length} orders, total fee=${totalFee.toFixed(2)}U`);

    return confirmations;
  }

  /** Get order by ID */
  getOrder(orderId: string): OrderConfirmation | undefined {
    return this.pendingOrders.get(orderId);
  }

  /** Cancel a pending order */
  cancelOrder(orderId: string): boolean {
    const order = this.pendingOrders.get(orderId);
    if (order && order.status === 'PENDING') {
      order.status = 'CANCELLED';
      return true;
    }
    return false;
  }

  private buildRejection(
    position: PositionSizeResult,
    strategyId: string,
    signalIds: string[],
    fee: FeeEstimate,
    reason: string,
  ): OrderConfirmation {
    return {
      orderId: `rej-${Date.now()}`,
      request: {
        symbol: position.symbol,
        assetClass: position.assetClass,
        side: position.side,
        type: 'MARKET',
        quantity: position.quantity,
        feeEstimate: fee,
        strategyId,
        signalIds,
      },
      status: 'REJECTED',
      filledQuantity: 0,
      averagePrice: 0,
      filledAt: Date.now(),
      fee,
      notes: reason,
    };
  }
}

// ── Trade Pipeline (Fluent Builder) ─────────────────────────────────────────

export class FactorTradePipeline {
  private sizer = new PositionSizer();
  private executor = new OrderExecutor();
  private feeCalc = new FeeCalculator();

  /**
   * Full pipeline: strategy → position sizing → fee check → order execution.
   */
  async executeStrategy(params: {
    strategy: FactorStrategy;
    symbols: Array<{ symbol: string; assetClass: AssetClass; currentPrice: number; volatility20d?: number }>;
    accountEquity: number;
    maxPositionPct?: number;
  }): Promise<{
    strategy: FactorStrategy;
    positions: PositionSizeResult[];
    orders: OrderConfirmation[];
    totalFee: number;
    totalNotional: number;
    viable: boolean;
  }> {
    const { strategy, symbols, accountEquity, maxPositionPct = 0.2 } = params;

    // Map factors to symbols (simple: one symbol per factor)
    const positions: PositionSizeResult[] = [];
    for (let i = 0; i < Math.min(strategy.factors.length, symbols.length); i++) {
      const factor = strategy.factors[i];
      const sym = symbols[i];

      const size = this.sizer.calc({
        symbol: sym.symbol,
        assetClass: sym.assetClass,
        currentPrice: sym.currentPrice,
        accountEquity,
        factorWeight: factor.weight,
        maxPositionPct,
        riskPerTradePct: 0.02,
        volatility20d: sym.volatility20d,
      });

      positions.push(size);
    }

    // Check viability
    const totalNotional = positions.reduce((s, p) => s + p.notionalValue, 0);
    const allViable = positions.every(p => this.feeCalc.isViable(p.assetClass, p.notionalValue));
    const totalFee = positions.reduce((s, p) => s + this.feeCalc.estimate(p.assetClass, p.notionalValue).totalFee, 0);

    // Execute orders
    const orders = await this.executor.executeStrategy(strategy, positions);

    return {
      strategy,
      positions,
      orders,
      totalFee: Math.round(totalFee * 100) / 100,
      totalNotional: Math.round(totalNotional * 100) / 100,
      viable: allViable,
    };
  }

  /** Get fee estimate for a batch of positions */
  estimateFees(positions: PositionSizeResult[]): { totalFee: number; perPosition: FeeEstimate[] } {
    const perPosition = positions.map(p => this.feeCalc.estimate(p.assetClass, p.notionalValue));
    const totalFee = perPosition.reduce((s, f) => s + f.totalFee, 0);
    return { totalFee: Math.round(totalFee * 100) / 100, perPosition };
  }

  reset(): void { log.info('[TradePipeline] Reset'); }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _tradePipeline: FactorTradePipeline | null = null;

export function getFactorTradePipeline(): FactorTradePipeline {
  if (!_tradePipeline) _tradePipeline = new FactorTradePipeline();
  return _tradePipeline;
}

export function resetFactorTradePipeline(): void {
  _tradePipeline?.reset();
  _tradePipeline = null;
}
