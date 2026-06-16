import { EngineError, ErrorCode } from '../../errors';
/**
 * Trade Execution Engine
 * Sprint 2 Phase 2 - QUANT MOO
 *
 * Handles trade signal processing, risk management, order execution,
 * and trade logging for both paper and real trading modes.
 */

import log from 'electron-log';
import { generateId } from '../utils/id';

// ============================================================
// Type-Safe Event Emitter
// ============================================================

class TypeSafeEventEmitter<T extends Record<string, Function>> {
  private listeners: Map<string, Set<Function>> = new Map();
  private onceListeners: Map<string, Set<Function>> = new Map();

  on<K extends keyof T & string>(event: K, listener: T[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.off(event, listener);
    };
  }

  once<K extends keyof T & string>(event: K, listener: T[K]): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(listener);

    return () => {
      this.onceListeners.get(event)?.delete(listener);
    };
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): void {
    this.listeners.get(event)?.delete(listener);
    this.onceListeners.get(event)?.delete(listener);
  }

  emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): void {
    const regularListeners = this.listeners.get(event);
    if (regularListeners) {
      for (const listener of regularListeners) {
        try {
          listener(...args);
        } catch (err) {
          log.error(`[TradeExecutor] Event listener error for "${event}":`, err);
        }
      }
    }

    const onceListeners = this.onceListeners.get(event);
    if (onceListeners) {
      for (const listener of onceListeners) {
        try {
          listener(...args);
        } catch (err) {
          log.error(`[TradeExecutor] Once listener error for "${event}":`, err);
        }
      }
      this.onceListeners.delete(event);
    }
  }

  removeAllListeners<K extends keyof T & string>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  listenerCount<K extends keyof T & string>(event: K): number {
    const regular = this.listeners.get(event)?.size ?? 0;
    const once = this.onceListeners.get(event)?.size ?? 0;
    return regular + once;
  }
}

// ============================================================
// Interfaces
// ============================================================










// ============================================================
// Constants
// ============================================================

const DEFAULT_CONFIG: ExecutionConfig = {
  mode: 'paper',
  maxPositionSizePct: 10,
  maxDailyLossPct: 3,
  maxOpenOrders: 20,
  defaultCommission: 0.0003,
  slippageBps: 5,
  requireConfirmation: false,
};

const DUPLICATE_SIGNAL_WINDOW_MS = 60_000;
const ORDER_TIMEOUT_MS = 300_000;
const MAX_ORDER_HISTORY = 10_000;
const MAX_TRADE_LOG = 5_000;
const TRADING_HOURS_DEFAULT = {
  morning: { start: '09:15', end: '11:30' },
  afternoon: { start: '13:00', end: '15:00' },
};

// ============================================================
// Utility Functions
// ============================================================


function generateSignalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `SIG-${timestamp}-${random}`.toUpperCase();
}

function toISOString(timestamp?: number): string {
  return new Date(timestamp ?? Date.now()).toISOString();
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundPrice(price: number, tickSize: number = 0.01): number {
  return Math.round(price / tickSize) * tickSize;
}

function calculateSlippage(price: number, side: 'BUY' | 'SELL', slippageBps: number): number {
  const slippageFactor = slippageBps / 10_000;
  if (side === 'BUY') {
    return roundPrice(price * (1 + slippageFactor));
  }
  return roundPrice(price * (1 - slippageFactor));
}

function isValidStockCode(code: string): boolean {
  // Support A-share codes (6 digits), HK codes (5 digits), US symbols
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (trimmed.length === 0) return false;
  // A-share: 600xxx, 601xxx, 603xxx, 000xxx, 002xxx, 300xxx, 688xxx
  if (/^\d{6}$/.test(trimmed)) return true;
  // HK: up to 5 digits
  if (/^\d{1,5}$/.test(trimmed)) return true;
  // US: alphabetic symbols 1-5 chars
  if (/^[A-Z]{1,5}$/.test(trimmed)) return true;
  // With exchange prefix like SH600000, SZ000001
  if (/^(SH|SZ|HK|US)\d{1,6}$/i.test(trimmed)) return true;
  return /^[A-Z0-9.]+$/.test(trimmed);
}

// ============================================================
// Trade Executor
// ============================================================

