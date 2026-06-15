/**
 * Points Service — R108 S-34
 *
 * USDT Points / Credits management.
 * Integrates with usdt-points-manager, exchange-rate-engine, fee-calculator.
 *
 * @module services/points-service
 */

import * as bridgeApiRaw from '../lib/bridge-api'; const bridgeApi = bridgeApiRaw as any;

export interface PointsBalance {
  available: number;
  frozen: number;
  total: number;
  currency: 'USDT';
  updatedAt: string;
}

export interface PointsTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'charge' | 'refund' | 'transfer_in' | 'transfer_out';
  amount: number;
  fee: number;
  status: 'pending' | 'completed' | 'failed' | 'frozen';
  remark: string;
  timestamp: string;
}

export interface ExchangeRate {
  from: string;
  to: 'USDT';
  rate: number;
  updatedAt: string;
  source: string;
}

export interface FeeScheduleEntry {
  service: string;
  description: string;
  fee: number;
  feeType: 'fixed' | 'percentage';
  currency: 'USDT';
}

export const pointsService = {
  /** Get current USDT balance */
  getBalance: () => (bridgeApi as any).invoke('points:balance', {}),

  /** Top up USDT points */
  topUp: (amount: number, txHash?: string) =>
    (bridgeApi as any).invoke('points:topup', { amount, txHash }),

  /** Withdraw USDT points */
  withdraw: (amount: number, address: string) =>
    (bridgeApi as any).invoke('points:withdraw', { amount, address }),

  /** Get transaction history */
  getHistory: (params?: { limit?: number; offset?: number }) =>
    (bridgeApi as any).invoke('points:history', params || {}),

  /** Get current exchange rate (fiat → USDT) */
  getExchangeRate: () => (bridgeApi as any).invoke('points:exchange-rate', {}),

  /** Get fee schedule for all services */
  getFeeSchedule: () => (bridgeApi as any).invoke('points:fee-schedule', {}),

  /** Calculate fee for a specific operation */
  calculateFee: (service: string, amount: number) =>
    (bridgeApi as any).invoke('points:calculate-fee', { service, amount }),

  /** Get settlement status */
  getSettlementStatus: () => (bridgeApi as any).invoke('points:settlement', {}),
};
