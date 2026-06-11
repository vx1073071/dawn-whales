/**
 * Services Barrel — R108 S-34
 *
 * Central import point for all service modules.
 * Replace direct bridge-api calls with these typed service facades.
 *
 * @example
 * ```ts
 * import { brokerService, pointsService } from '../services';
 * const balance = await pointsService.getBalance();
 * ```
 */

export { brokerService, marketDataService, accountService, orderService, watchlistService, strategyService } from './trading-service';
export type { BrokerConfig, OrderRequest, StrategyConfig, BacktestRequest, QuoteData, Position, AccountInfo, KlineData, SignalEntry } from './trading-types';
export { portfolioService } from './portfolio-service';
export { riskService } from './risk-service';
export type { RiskConfig, RiskAlert } from './risk-service';
export { marketService } from './market-service';
export { pointsService } from './points-service';
export type { PointsBalance, PointsTransaction, ExchangeRate, FeeScheduleEntry } from './points-service';
