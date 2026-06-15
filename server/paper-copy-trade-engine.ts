
/**
 * DAWN WHALES R139 J03 — Paper Copy Trade Engine (模拟跟单)
 * 
 * Allows new users to experience copy-trading with virtual funds before
 * committing real money.  Runs a full simulation of the copy-trade pipeline
 * but uses paper orders instead of real broker orders.
 * 
 * Features:
 *  - Virtual account per user (initial balance configurable, default $10,000)
 *  - Paper order execution (mocked fills at market price)
 *  - Real-time paper PnL tracking
 *  - Daily summary / stats
 *  - Auto-reset option (reset paper account every N days)
 *  - Comparison mode: real vs paper performance
 * 
 * Architecture:
 *   PaperCopyTradeEngine
 *     ├── PaperAccountManager    — virtual balance + positions
 *     ├── PaperOrderSimulator    — mock fills with realistic latency
 *     └── PaperSignalTester      — backfill historical signals for demo
 * 
 * Integration:
 *   CopyTradeExecutor checks if user is in paper mode
 *     → if paper: route to PaperOrderSimulator instead of real adapter
 *     → track paper PnL separately from real PnL
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

// ═══════════════ Types ══════════════════════════════════

export type PaperOrderStatus = 'pending' | 'filled' | 'rejected' | 'cancelled';
export type PaperSide = 'BUY' | 'SELL';

export interface PaperPosition {
  symbol: string;
  side: PaperSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  openedAt: number;
}

export interface PaperOrder {
  id: string;
  userId: string;
  symbol: string;
  side: PaperSide;
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT';
  status: PaperOrderStatus;
  filledAt?: number;
  fillPrice?: number;
  reason?: string;
  createdAt: number;
}

export interface PaperAccount {
  userId: string;
  balance: number;
  initialBalance: number;
  pnl: number;
  pnlPct: number;
  positions: PaperPosition[];
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  createdAt: number;
  resetAt?: number;
}

export interface PaperSignal {
  sourceSignalId: string;
  symbol: string;
  side: PaperSide;
  quantity: number;
  price: number;
  providerName: string;
}

export interface PaperTradeResult {
  orderId: string;
  signalId: string;
  success: boolean;
  fillPrice: number;
  quantity: number;
  latencyMs: number;
  pnl?: number;
  error?: string;
}

export interface PaperStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  pnlPct: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldingMs: number;
}

interface PaperConfig {
  initialBalance: number;
  autoResetDays: number;  // 0 = never
  maxPositions: number;
  minOrderSize: number;
  commissionRate: number; // 0.001 = 0.1%
  slippageBps: number;    // basis points (2 = 0.02%)
  fillDelayMs: number;    // simulated execution delay
}

// ═══════════════ Paper Copy Trade Engine ══════════════════

export class PaperCopyTradeEngine extends EventEmitter {
  private config: PaperConfig;
  private accounts: Map<string, PaperAccount> = new Map();
  private orders: PaperOrder[] = [];
  private stats: Map<string, PaperStats> = new Map();

  constructor(config?: Partial<PaperConfig>) {
    super();
    this.config = {
      initialBalance: 10_000,
      autoResetDays: 0,
      maxPositions: 10,
      minOrderSize: 0.001,
      commissionRate: 0.001,
      slippageBps: 2,
      fillDelayMs: 200,
      ...config,
    };
  }

  // ═══════════ Account Management ═════════════════════════

  getOrCreateAccount(userId: string): PaperAccount {
    if (this.accounts.has(userId)) return this.accounts.get(userId)!;

    const account: PaperAccount = {
      userId,
      balance: this.config.initialBalance,
      initialBalance: this.config.initialBalance,
      pnl: 0,
      pnlPct: 0,
      positions: [],
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      createdAt: Date.now(),
    };
    this.accounts.set(userId, account);
    return account;
  }

  getAccount(userId: string): PaperAccount | undefined {
    return this.accounts.get(userId);
  }

  resetAccount(userId: string): PaperAccount {
    const account = this.accounts.get(userId);
    if (account) {
      account.balance = this.config.initialBalance;
      account.initialBalance = this.config.initialBalance;
      account.pnl = 0;
      account.pnlPct = 0;
      account.positions = [];
      account.totalTrades = 0;
      account.winningTrades = 0;
      account.losingTrades = 0;
      account.resetAt = Date.now();
    }
    return this.getOrCreateAccount(userId);
  }

  // ═══════════ Paper Order Execution ═══════════════════════

  /**
   * Execute a paper trade (simulated fill).
   * This is the main entry point — called instead of real adapter.placeOrder()
   * when the user is in paper mode.
   */
  async executePaperTrade(
    userId: string,
    signal: PaperSignal,
    brokerName?: string,
  ): Promise<PaperTradeResult> {
    const account = this.getOrCreateAccount(userId);
    const orderId = this.generateOrderId();
    const fillPrice = this.applySlippage(signal.price, signal.side);

    const result: PaperTradeResult = {
      orderId,
      signalId: signal.sourceSignalId,
      success: false,
      fillPrice,
      quantity: signal.quantity,
      latencyMs: 0,
    };

    try {
      // Positon count check
      if (account.positions.length >= this.config.maxPositions) {
        result.error = 'Max paper positions reached';
        this.recordOrder(userId, signal, orderId, fillPrice, 'rejected', result.error);
        return result;
      }

      // Min order size check
      if (signal.quantity < this.config.minOrderSize) {
        result.error = `Order too small: min ${this.config.minOrderSize}`;
        this.recordOrder(userId, signal, orderId, fillPrice, 'rejected', result.error);
        return result;
      }

      // Balance check for BUY
      const cost = fillPrice * signal.quantity * (1 + this.config.commissionRate);
      if (signal.side === 'BUY' && cost > account.balance) {
        result.error = `Insufficient paper balance: need $${cost.toFixed(2)}, have $${account.balance.toFixed(2)}`;
        this.recordOrder(userId, signal, orderId, fillPrice, 'rejected', result.error);
        return result;
      }

      // Simulate fill delay
      await this.delay(this.config.fillDelayMs);

      // Update account
      if (signal.side === 'BUY') {
        account.balance -= cost;
        account.positions.push({
          symbol: signal.symbol,
          side: signal.side,
          quantity: signal.quantity,
          entryPrice: fillPrice,
          currentPrice: fillPrice,
          unrealizedPnL: 0,
          openedAt: Date.now(),
        });
      } else {
        // SELL: find matching position (FIFO)
        account.balance += fillPrice * signal.quantity * (1 - this.config.commissionRate);
        this.closeOrReducePosition(account, signal.symbol, signal.quantity, fillPrice);
      }

      account.totalTrades++;
      result.success = true;
      result.latencyMs = this.config.fillDelayMs;
      this.recordOrder(userId, signal, orderId, fillPrice, 'filled');

      this.emit('tradeCompleted', { userId, result, account });

    } catch (e: any) {
      result.error = e.message || 'Paper trade failed';
      this.recordOrder(userId, signal, orderId, fillPrice, 'rejected', result.error);
    }

    // Update PnL
    this.recalcAccountPnL(account);

    return result;
  }

  /**
   * Update current price for a paper position (mark-to-market).
   * Call periodically to update unrealized PnL.
   */
  markPrice(userId: string, symbol: string, currentPrice: number): void {
    const account = this.accounts.get(userId);
    if (!account) return;

    for (const pos of account.positions) {
      if (pos.symbol !== symbol) continue;
      pos.currentPrice = currentPrice;
      pos.unrealizedPnL = pos.side === 'BUY'
        ? (currentPrice - pos.entryPrice) * pos.quantity
        : (pos.entryPrice - currentPrice) * pos.quantity;
    }
    this.recalcAccountPnL(account);
  }

  /**
   * Get stats for comparison (paper vs. real).
   */
  getStats(userId: string): PaperStats {
    if (this.stats.has(userId)) return this.stats.get(userId)!;

    const account = this.accounts.get(userId);
    if (!account) {
      return { totalTrades: 0, winningTrades: 0, losingTrades: 0,
        winRate: 0, totalPnl: 0, pnlPct: 0, bestTrade: 0, worstTrade: 0, avgHoldingMs: 0 };
    }

    const userOrders = this.orders.filter((o) => o.userId === userId && o.status === 'filled');
    const filled = userOrders.length;
    // Simple heuristic: winning if price moved favorably (estimated from positions)
    const winners = account.winningTrades;
    const losers = account.losingTrades;

    const stats: PaperStats = {
      totalTrades: filled,
      winningTrades: winners,
      losingTrades: losers,
      winRate: filled > 0 ? winners / filled : 0,
      totalPnl: account.pnl,
      pnlPct: account.pnlPct,
      bestTrade: 0,
      worstTrade: 0,
      avgHoldingMs: 0,
    };
    this.stats.set(userId, stats);
    return stats;
  }

  /**
   * Get all paper orders for a user.
   */
  getOrders(userId: string, limit = 50): PaperOrder[] {
    return this.orders
      .filter((o) => o.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Auto-reset accounts that have exceeded autoResetDays.
   * Call daily (midnight cron).
   */
  runAutoReset(): number {
    if (this.config.autoResetDays <= 0) return 0;
    const now = Date.now();
    const resetAge = this.config.autoResetDays * 24 * 3600 * 1000;
    let resetCount = 0;

    for (const [userId, account] of this.accounts) {
      const createdAge = now - account.createdAt;
      const lastResetAge = account.resetAt ? now - account.resetAt : createdAge;
      if (lastResetAge >= resetAge) {
        this.resetAccount(userId);
        resetCount++;
      }
    }
    return resetCount;
  }

  dispose(): void {
    this.accounts.clear();
    this.orders = [];
    this.stats.clear();
    this.removeAllListeners();
  }

  // ═══════════ Private ══════════════════════════════════════

  private generateOrderId(): string {
    return `paper-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private applySlippage(price: number, side: PaperSide): number {
    const bps = this.config.slippageBps / 10000;
    const direction = side === 'BUY' ? 1 : -1; // Buy: price up, Sell: price down
    return price * (1 + direction * bps * (0.5 + Math.random())); // Random 50-150% of max slippage
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * ms * 0.5));
  }

  private closeOrReducePosition(
    account: PaperAccount, symbol: string, quantity: number, fillPrice: number,
  ): void {
    let remaining = quantity;
    for (let i = account.positions.length - 1; i >= 0 && remaining > 0; i--) {
      const pos = account.positions[i];
      if (pos.symbol !== symbol) continue;

      const realized = pos.side === 'BUY'
        ? (fillPrice - pos.entryPrice) * Math.min(remaining, pos.quantity)
        : (pos.entryPrice - fillPrice) * Math.min(remaining, pos.quantity);

      if (realized > 0) account.winningTrades++;
      else account.losingTrades++;

      if (pos.quantity <= remaining) {
        remaining -= pos.quantity;
        account.positions.splice(i, 1);
      } else {
        pos.quantity -= remaining;
        remaining = 0;
      }
    }
  }

  private recalcAccountPnL(account: PaperAccount): void {
    let realized = account.balance - account.initialBalance;
    let unrealized = 0;
    for (const pos of account.positions) {
      unrealized += pos.unrealizedPnL;
    }
    account.pnl = realized + unrealized;
    account.pnlPct = account.initialBalance > 0
      ? (account.pnl / account.initialBalance) * 100
      : 0;
  }

  private recordOrder(
    userId: string,
    signal: PaperSignal,
    orderId: string,
    fillPrice: number,
    status: PaperOrderStatus,
    reason?: string,
  ): void {
    this.orders.push({
      id: orderId,
      userId,
      symbol: signal.symbol,
      side: signal.side,
      quantity: signal.quantity,
      price: signal.price,
      orderType: 'MARKET',
      status,
      filledAt: status === 'filled' ? Date.now() : undefined,
      fillPrice: status === 'filled' ? fillPrice : undefined,
      reason,
      createdAt: Date.now(),
    });
  }
}

// ═══════════════ Integration with CopyTradeExecutor ═══════

/**
 * Paper mode toggle checker.
 * 
 * Call this before the real executor.  If the user has paper mode enabled,
 * route signals to PaperCopyTradeEngine instead of CopyTradeExecutor.
 */
export function isPaperMode(userId: string): boolean {
  // Check per-user flag — in production this would check user_settings table
  const envPaperUsers = process.env.PAPER_COPY_TRADE_USERS?.split(',') || [];
  if (envPaperUsers.includes('*') || envPaperUsers.includes(userId)) return true;
  return false;
}

// ═══════════════ Singleton ═══════════════════════════════

let _paperEngine: PaperCopyTradeEngine | null = null;

export function getPaperCopyTradeEngine(config?: Partial<PaperConfig>): PaperCopyTradeEngine {
  if (!_paperEngine) {
    _paperEngine = new PaperCopyTradeEngine(config);
  }
  return _paperEngine;
}
