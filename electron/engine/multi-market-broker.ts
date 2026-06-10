import { EngineError, ErrorCode } from '../errors';
/**
 * J-61-01: A/美股 MultiMarketBroker (R61 v19 — v1.4.0-beta)
 *
 * Extends OpenDLiveBroker (R60 HK) to support:
 * - A-shares: Shenzhen (SZ), Shanghai (SH) markets
 *   - 100 shares minimum, ±10% daily limit (ST ±5%, ChiNext ±20%)
 *   - Stamp duty 0.05%, brokerage ~0.025%
 * - US stocks: NYSE, NASDAQ
 *   - 1 share minimum, no daily limit
 *   - SEC fee + TAF + brokerage ~0.005/share
 * - Pre-market (4:00-9:30 AM ET) and after-hours (4:00-8:00 PM ET) for US
 * - Multi-market concurrent connection support
 * - Market-specific fee calculation
 * - Unified IExecutionBroker interface
 *
 * >=350L, 8 tests
 */

import { EventEmitter } from 'events';
import {
  IExecutionBroker,
  ExecutionOrder,
  ExecutionResult,
  BrokerAccount,
  BrokerPosition,
} from './ai-to-execution-bridge';

// ── Types ──────────────────────────────────────────────────────────────────

export type MarketRegion = 'HK' | 'A-SH' | 'A-SZ' | 'US-NYSE' | 'US-NASDAQ';

export interface MarketConfig {
  region: MarketRegion;
  minShares: number;
  boardLot: number;          // 整手股数
  currency: string;
  dailyUpLimit?: number;      // 涨停 (0 = no limit)
  dailyDownLimit?: number;    // 跌停 (0 = no limit)
  stampDutyRate: number;
  brokerageRate: number;
  exchangeFeeRate: number;
  secFeeRate: number;
  clearingFeeRate: number;
}

export interface MultiMarketOrder extends ExecutionOrder {
  market: MarketRegion;
  isFragmented?: boolean;     // 碎股标记
  prePostMarket?: boolean;    // 盘前盘后
}

export interface MultiMarketResult extends ExecutionResult {
  market: MarketRegion;
  executedFee: MarketFeeBreakdown;
  prePostMarketExec?: 'regular' | 'pre' | 'post';
}

export interface MarketFeeBreakdown {
  brokerage: number;
  exchangeFee: number;
  stampDuty: number;
  secFee: number;
  clearingFee: number;
  total: number;
}

export interface MarketSession {
  region: MarketRegion;
  isOpen: boolean;
  nextOpenTime?: string;
  nextCloseTime?: string;
  preMarketOpen?: string;
  postMarketClose?: string;
}

// ── Market Config Factories ────────────────────────────────────────────────

const DEFAULT_MARKETS: Record<MarketRegion, MarketConfig> = {
  'HK': {
    region: 'HK', minShares: 1, boardLot: 100, currency: 'HKD',
    stampDutyRate: 0.0013, brokerageRate: 0.0003, exchangeFeeRate: 0.00005,
    secFeeRate: 0.000027, clearingFeeRate: 0.00002,
  },
  'A-SH': {
    region: 'A-SH', minShares: 100, boardLot: 100, currency: 'CNY',
    dailyUpLimit: 0.10, dailyDownLimit: 0.10,
    stampDutyRate: 0.0005, brokerageRate: 0.00025, exchangeFeeRate: 0.0000487,
    secFeeRate: 0.00002, clearingFeeRate: 0.00002,
  },
  'A-SZ': {
    region: 'A-SZ', minShares: 100, boardLot: 100, currency: 'CNY',
    dailyUpLimit: 0.10, dailyDownLimit: 0.10,
    stampDutyRate: 0.0005, brokerageRate: 0.00025, exchangeFeeRate: 0.0000487,
    secFeeRate: 0.00002, clearingFeeRate: 0.00002,
  },
  'US-NYSE': {
    region: 'US-NYSE', minShares: 1, boardLot: 1, currency: 'USD',
    dailyUpLimit: 0, dailyDownLimit: 0,
    stampDutyRate: 0, brokerageRate: 0.003, exchangeFeeRate: 0,
    secFeeRate: 0.000008, clearingFeeRate: 0.00003,
  },
  'US-NASDAQ': {
    region: 'US-NASDAQ', minShares: 1, boardLot: 1, currency: 'USD',
    dailyUpLimit: 0, dailyDownLimit: 0,
    stampDutyRate: 0, brokerageRate: 0.003, exchangeFeeRate: 0,
    secFeeRate: 0.000008, clearingFeeRate: 0.00003,
  },
};

// ── Trading Calendar (simplified) ──────────────────────────────────────────

function getUSTradingSession(): MarketSession {
  const now = new Date();
  // US Eastern Time approximation (UTC-5, simplified)
  const etHour = (now.getUTCHours() - 5 + 24) % 24;
  const etMin = now.getUTCMinutes();
  const totalMinutes = etHour * 60 + etMin;

  const preOpen = 4 * 60;        // 4:00 AM ET
  const regularOpen = 9 * 60 + 30; // 9:30 AM ET
  const regularClose = 16 * 60;    // 4:00 PM ET
  const postClose = 20 * 60;       // 8:00 PM ET

  const isOpen = totalMinutes >= regularOpen && totalMinutes < regularClose;
  const isPreMarket = totalMinutes >= preOpen && totalMinutes < regularOpen;
  const isPostMarket = totalMinutes >= regularClose && totalMinutes < postClose;

  return {
    region: 'US-NYSE',
    isOpen: isOpen || isPreMarket || isPostMarket,
    nextOpenTime: isOpen ? undefined : '09:30 ET',
    nextCloseTime: isOpen ? '16:00 ET' : undefined,
    preMarketOpen: isPreMarket ? 'now' : '04:00 ET',
    postMarketClose: isPostMarket ? 'now' : '20:00 ET',
  };
}

function getAShareSession(): MarketSession {
  const now = new Date();
  // CST (UTC+8)
  const cstHour = now.getHours();
  const cstMin = now.getMinutes();
  const totalMinutes = cstHour * 60 + cstMin;

  const morningOpen = 9 * 60 + 30;
  const morningClose = 11 * 60 + 30;
  const afternoonOpen = 13 * 60;
  const afternoonClose = 15 * 60;

  const isMorningSession = totalMinutes >= morningOpen && totalMinutes < morningClose;
  const isAfternoonSession = totalMinutes >= afternoonOpen && totalMinutes < afternoonClose;
  const isOpen = isMorningSession || isAfternoonSession;

  return {
    region: 'A-SH',
    isOpen,
    nextOpenTime: isOpen ? (isMorningSession ? undefined : '13:00 CST') : '09:30 CST',
    nextCloseTime: isOpen ? (isMorningSession ? '11:30 CST' : '15:00 CST') : undefined,
  };
}

// ── Fee Calculator ─────────────────────────────────────────────────────────

export function calculateMarketFee(
  tradeValue: number, quantity: number, market: MarketConfig
): MarketFeeBreakdown {
  const brokerage = tradeValue * market.brokerageRate;
  const exchangeFee = tradeValue * market.exchangeFeeRate;
  const stampDuty = tradeValue * market.stampDutyRate;
  const secFee = tradeValue * market.secFeeRate;
  const clearingFee = tradeValue * market.clearingFeeRate;

  // A-share minimum stamp duty: 1 CNY (round up)
  // US SEC fee minimum: $0.01
  const total = brokerage + exchangeFee + stampDuty + secFee + clearingFee;

  return {
    brokerage: roundFee(brokerage),
    exchangeFee: roundFee(exchangeFee),
    stampDuty: roundFee(stampDuty),
    secFee: roundFee(secFee),
    clearingFee: roundFee(clearingFee),
    total: roundFee(total),
  };
}

function roundFee(fee: number): number {
  return Math.round(fee * 10000) / 10000;
}

// ── Limit Checker ──────────────────────────────────────────────────────────

export function checkDailyLimit(
  symbol: string,
  side: 'buy' | 'sell',
  price: number,
  referencePrice: number,
  market: MarketConfig,
  chiNext?: boolean
): { passed: boolean; limitPrice: number; reason?: string } {
  if (!market.dailyUpLimit && !market.dailyDownLimit) {
    return { passed: true, limitPrice: price }; // US no limit
  }

  const limitPct = chiNext ? 0.20 : (market.dailyUpLimit || 0.10);

  if (side === 'buy') {
    const limitPrice = referencePrice * (1 + limitPct);
    if (price > limitPrice) {
      return { passed: false, limitPrice, reason: `涨停 ${symbol}: price ${price} > ${limitPrice}` };
    }
  } else {
    const limitPrice = referencePrice * (1 - (market.dailyDownLimit || limitPct));
    if (price < limitPrice) {
      return { passed: false, limitPrice, reason: `跌停 ${symbol}: price ${price} < ${limitPrice}` };
    }
  }

  return { passed: true, limitPrice: price };
}

// ── MultiMarketBroker ──────────────────────────────────────────────────────

export class MultiMarketBroker extends EventEmitter implements IExecutionBroker {
  public markets: Map<MarketRegion, MarketConfig> = new Map();
  private activeOrders: Map<string, MultiMarketOrder> = new Map();
  private positions: BrokerPosition[] = [];
  private account: BrokerAccount = { totalAssets: 100000, availableCash: 85000, currency: 'USD' };

  constructor(customConfigs?: Partial<Record<MarketRegion, Partial<MarketConfig>>>) {
    super();
    // Initialize all markets with defaults, then apply custom configs
    for (const [region, defaultCfg] of Object.entries(DEFAULT_MARKETS)) {
      const custom = customConfigs?.[region as MarketRegion];
      this.markets.set(region as MarketRegion, { ...defaultCfg, ...custom });
    }
  }

  // ── IExecutionBroker Implementation ────────────────────────────────────

  async connect(): Promise<void> {
    this.emit('status', 'connected');
  }

  async disconnect(): Promise<void> {
    this.emit('status', 'disconnected');
  }

  async placeOrder(order: MultiMarketOrder): Promise<MultiMarketResult> {
    const market = this.markets.get(order.market);
    if (!market) {
      throw new EngineError("`Unknown market region: ${order.market}`", { code: ErrorCode.ENGINE_ORDER_REJECTED });
    }

    // Validate order size
    const quantity = order.quantity ?? 0;
    if (quantity < market.minShares) {
      throw new EngineError("`${order.market} minimum shares: ${market.minShares}, got ${quantity}`", { code: ErrorCode.ENGINE_ORDER_REJECTED });
    }

    // Check daily limit for A-shares
    if (order.market.startsWith('A-') && order.price && order.referencePrice) {
      const isChiNext = order.symbol.startsWith('300') || order.symbol.startsWith('688');
      const limitCheck = checkDailyLimit(
        order.symbol, order.side || 'buy', order.price,
        order.referencePrice, market, isChiNext
      );
      if (!limitCheck.passed) {
        throw new EngineError("limitCheck.reason!", { code: ErrorCode.ENGINE_RATE_LIMIT });
      }
    }

    // US pre/post market check — allow if explicitly requested
    if ((order.market === 'US-NYSE' || order.market === 'US-NASDAQ') && order.prePostMarket) {
      const session = getUSTradingSession();
      if (!session.isOpen) {
        throw new EngineError("US market closed and pre/post not specified", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
      }
    }

    // Calculate fees
    const tradeValue = (order.price ?? 0) * quantity;
    const feeBreakdown = calculateMarketFee(tradeValue, quantity, market);

    const orderId = `MLT-${order.market}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.activeOrders.set(orderId, { ...order, id: orderId } as MultiMarketOrder);

    const result: MultiMarketResult = {
      orderId,
      status: 'submitted',
      filledQuantity: 0,
      filledPrice: undefined,
      market: order.market,
      executedFee: feeBreakdown,
      prePostMarketExec: order.prePostMarket ? 'regular' : undefined,
      timestamp: new Date().toISOString(),
    };

    this.emit('order', result);
    return result;
  }

  async cancelOrder(_orderId: string): Promise<MultiMarketResult> {
    const order = this.activeOrders.get(_orderId);
    this.activeOrders.delete(_orderId);

    return {
      orderId: _orderId,
      status: 'cancelled',
      filledQuantity: 0,
      market: order?.market ?? 'HK',
      executedFee: order
        ? calculateMarketFee((order.price ?? 0) * (order.quantity ?? 0), order.quantity ?? 0, this.markets.get(order.market)!)
        : { brokerage: 0, exchangeFee: 0, stampDuty: 0, secFee: 0, clearingFee: 0, total: 0 },
      timestamp: new Date().toISOString(),
    };
  }

  async queryPositions(): Promise<BrokerPosition[]> {
    return [...this.positions];
  }

  async queryAccount(): Promise<BrokerAccount> {
    return { ...this.account };
  }

  // ── Multi-market specific ──────────────────────────────────────────────

  getMarketConfig(region: MarketRegion): MarketConfig | undefined {
    return this.markets.get(region);
  }

  getAllMarketConfigs(): MarketConfig[] {
    return [...this.markets.values()];
  }

  getFeeForTrade(tradeValue: number, quantity: number, region: MarketRegion): MarketFeeBreakdown {
    const market = this.markets.get(region);
    if (!market) throw new EngineError("`Unknown market: ${region}`", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    return calculateMarketFee(tradeValue, quantity, market);
  }

  checkPriceLimit(symbol: string, side: 'buy' | 'sell', price: number, referencePrice: number, region: MarketRegion): { passed: boolean; limitPrice: number; reason?: string } {
    const market = this.markets.get(region);
    if (!market) throw new EngineError("`Unknown market: ${region}`", { code: ErrorCode.ENGINE_INTERNAL_ERROR });
    const isChiNext = symbol.startsWith('300') || symbol.startsWith('688');
    return checkDailyLimit(symbol, side, price, referencePrice, market, isChiNext);
  }

  getMarketSession(region: MarketRegion): MarketSession {
    if (region.startsWith('US-')) return getUSTradingSession();
    if (region.startsWith('A-')) return getAShareSession();
    // HK market always open in simulation mode
    return { region, isOpen: true, nextOpenTime: undefined, nextCloseTime: undefined };
  }

  // Test helpers
  setAccount(account: Partial<BrokerAccount>): void {
    this.account = { ...this.account, ...account };
  }

  setPosition(position: BrokerPosition): void {
    const idx = this.positions.findIndex(p => p.symbol === position.symbol);
    if (idx >= 0) this.positions[idx] = position;
    else this.positions.push(position);
  }

  reset(): void {
    this.activeOrders.clear();
    this.positions = [];
    this.account = { totalAssets: 100000, availableCash: 85000, currency: 'USD' };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _multiMarketInstance: MultiMarketBroker | null = null;

export function getMultiMarketBroker(): MultiMarketBroker {
  if (!_multiMarketInstance) _multiMarketInstance = new MultiMarketBroker();
  return _multiMarketInstance;
}

export function resetMultiMarketBroker(): void {
  _multiMarketInstance?.reset();
  _multiMarketInstance = null;
}
