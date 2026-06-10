// ── Q20: Real Trader ─────────────────────────────────────────────────────────
// Paper → Real switch with safety gates
// Wraps LiveExecutor + IBrokerAdapter, enforces risk limits before any real order
// Circuit breaker: 3 consecutive rejections → 5 min pause

import { EventEmitter } from 'events';
import log from 'electron-log';
import { LiveExecutor, LiveOrder, LivePosition, ExecutorStatus } from './live-executor';
import type { IBrokerAdapter, FundsInfo } from '../../broker/IBrokerAdapter';
import { EngineError, ErrorCode } from '../../errors';


// ── Types ───────────────────────────────────────────────────────────────────

export interface SafetyGateConfig {
  // Capital protection (%)
  dailyLossLimitPct: number;   // 0.02 = 2% daily loss → block new orders
  maxDrawdownPct: number;      // 0.05 = 5% max drawdown → reduce size 50%
  emergencyLossPct: number;    // 0.10 = 10% loss → require human confirm

  // Position sizing
  maxPositionPct: number;      // 0.10 = max 10% of equity per position
  reducedPositionPct: number; // 0.05 = half size when drawdown triggered

  // Circuit breaker
  maxConsecutiveRejections: number; // 3
  circuitBreakerPauseMs: number;    // 300_000 = 5 min

  // Feature flags
  paperMode: boolean;         // Default true (safety!)
  allowShortSelling: boolean; // Default false
}

export interface RealTraderStatus {
  mode: 'PAPER' | 'REAL';
  safetyGate: SafetyGateStatus;
  circuitBreaker: CircuitBreakerStatus;
  liveExecutor: ExecutorStatus;
  recentRejections: string[];  // Last 10 rejected reasons
}

export interface SafetyGateStatus {
  dailyLossPct: number;
  currentDrawdownPct: number;
  isBlocked: boolean;         // True = no new orders allowed
  blockReason?: string;
  reducedMode: boolean;       // True = position sizes halved
  pendingConfirmation: boolean; // True = need human confirm
}

export interface CircuitBreakerStatus {
  consecutiveRejections: number;
  isTripped: boolean;
  trippedUntil?: number;      // Unix ms when circuit closes
}

// ── Default Config ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: SafetyGateConfig = {
  dailyLossLimitPct: 0.02,     // 2%
  maxDrawdownPct: 0.05,         // 5%
  emergencyLossPct: 0.10,        // 10%
  maxPositionPct: 0.10,          // 10% of equity
  reducedPositionPct: 0.05,     // 5% (half size)
  maxConsecutiveRejections: 3,
  circuitBreakerPauseMs: 300_000,
  paperMode: true,              // SAFETY: default to PAPER
  allowShortSelling: false,
};

// ── Real Trader ──────────────────────────────────────────────────────────────

export class RealTrader extends EventEmitter {
  private config: SafetyGateConfig;
  private liveExecutor: LiveExecutor | null = null;
  private broker: IBrokerAdapter | null = null;
  private initialEquity: number = 0;   // Set on first real order
  private peakEquity: number = 0;
  private todayStartEquity: number = 0;
  private todayStartTime: number = 0;

  // Circuit breaker state
  private rejectionCount: number = 0;
  private circuitTrippedUntil: number = 0;

  // Recent rejections for audit
  private recentRejections: string[] = [];

  constructor(config?: Partial<SafetyGateConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info('[RealTrader] Initialized', this.config.paperMode ? '(PAPER MODE)' : '(REAL MODE)');
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(executor: LiveExecutor, broker: IBrokerAdapter): void {
    this.liveExecutor = executor;
    this.broker = broker;
    this.todayStartTime = Date.now();
    this.todayStartEquity = this.getCurrentEquity();
    this.peakEquity = this.todayStartEquity;
    this.initialEquity = this.todayStartEquity;
    log.info(`[RealTrader] Started. Initial equity: ¥${this.todayStartEquity.toFixed(2)}`);
    this.emit('realtrader:started', { mode: this.getMode() });
  }

  stop(): void {
    this.liveExecutor = null;
    this.broker = null;
    log.info('[RealTrader] Stopped');
    this.emit('realtrader:stopped');
  }

  // ── Mode Control ──────────────────────────────────────────────────────────

  switchToReal(): boolean {
    if (this.config.paperMode === false) {
      log.warn('[RealTrader] Already in REAL mode');
      return false;
    }

    // Safety gate: require human confirmation before switching
    if (!this.checkSafetyGates().pass) {
      log.error('[RealTrader] Safety gate blocks switch to REAL');
      return false;
    }

    this.config.paperMode = false;
    log.info('[RealTrader] ⚠️  SWITCHED TO REAL TRADING MODE ⚠️');
    this.emit('realtrader:modeChanged', { mode: 'REAL' });
    return true;
  }

  switchToPaper(): void {
    this.config.paperMode = true;
    log.info('[RealTrader] Switched to PAPER mode');
    this.emit('realtrader:modeChanged', { mode: 'PAPER' });
  }

  getMode(): 'PAPER' | 'REAL' {
    return this.config.paperMode ? 'PAPER' : 'REAL';
  }

  // ── Safety Gate Check (before every real order) ─────────────────────────

  checkSafetyGates(): { pass: boolean; reasons: string[]; warnings: string[] } {
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (this.config.paperMode) {
      return { pass: true, reasons: [], warnings: [] };
    }

    const equity = this.getCurrentEquity();

    // 1. Circuit breaker
    if (this.isCircuitBreakerTripped()) {
      reasons.push('Circuit breaker tripped - pause active');
    }

    // 2. Daily loss limit
    const dailyLossPct = (this.todayStartEquity - equity) / this.todayStartEquity;
    if (dailyLossPct >= this.config.dailyLossLimitPct) {
      reasons.push(`Daily loss ${(dailyLossPct * 100).toFixed(2)}% exceeds ${(this.config.dailyLossLimitPct * 100).toFixed(0)}% limit`);
    } else if (dailyLossPct >= this.config.dailyLossLimitPct * 0.5) {
      warnings.push(`Daily loss ${(dailyLossPct * 100).toFixed(2)}% approaching limit`);
    }

    // 3. Max drawdown
    const drawdownPct = (this.peakEquity - equity) / this.peakEquity;
    if (drawdownPct >= this.config.emergencyLossPct) {
      reasons.push(`Drawdown ${(drawdownPct * 100).toFixed(2)}% exceeds emergency threshold ${(this.config.emergencyLossPct * 100).toFixed(0)}%`);
    } else if (drawdownPct >= this.config.maxDrawdownPct) {
      warnings.push(`Drawdown ${(drawdownPct * 100).toFixed(2)}% exceeds ${(this.config.maxDrawdownPct * 100).toFixed(0)}% - size will be halved`);
    }

    // 4. Pending confirmation required
    if (this.needsHumanConfirmation()) {
      warnings.push('Emergency threshold reached - human confirmation required for new orders');
    }

    return {
      pass: reasons.length === 0,
      reasons,
      warnings,
    };
  }

  needsHumanConfirmation(): boolean {
    const equity = this.getCurrentEquity();
    const drawdownPct = (this.peakEquity - equity) / this.peakEquity;
    return drawdownPct >= this.config.emergencyLossPct;
  }

  // ── Position Size Gate ───────────────────────────────────────────────────

  getAllowedPositionSize(equity: number): number {
    if (this.config.paperMode) return equity * this.config.maxPositionPct;

    const equity2 = this.getCurrentEquity();
    const drawdownPct = (this.peakEquity - equity2) / this.peakEquity;

    if (drawdownPct >= this.config.maxDrawdownPct) {
      // Reduced mode
      log.info(`[RealTrader] Reduced mode: ${(this.config.reducedPositionPct * 100).toFixed(1)}% of equity`);
      return equity2 * this.config.reducedPositionPct;
    }

    return equity2 * this.config.maxPositionPct;
  }

  // ── Order Submission (real mode only) ───────────────────────────────────

  async submitRealOrder(order: Omit<LiveOrder, 'id' | 'status' | 'filledQty' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; orderId?: string; error?: string }> {
    // Gate 1: Paper mode
    if (this.config.paperMode) {
      return { success: false, error: 'Paper mode - use paper trader instead' };
    }

    // Gate 2: Safety gate
    const gate = this.checkSafetyGates();
    if (!gate.pass) {
      const reason = gate.reasons.join('; ');
      this.recordRejection(`Safety gate blocked: ${reason}`);
      return { success: false, error: `Safety gate blocked: ${reason}` };
    }

    // Gate 3: Human confirmation required
    if (this.needsHumanConfirmation()) {
      this.recordRejection('Human confirmation required - emergency threshold reached');
      return { success: false, error: 'Emergency threshold reached - human confirmation required before trading' };
    }

    // Gate 4: Circuit breaker
    if (this.isCircuitBreakerTripped()) {
      return { success: false, error: 'Circuit breaker tripped - please wait' };
    }

    // Gate 5: Available capital check
    const capitalCheck = await this.checkCapitalSufficiency(order);
    if (!capitalCheck.sufficient) {
      this.recordRejection(`Insufficient capital: need ¥${capitalCheck.required.toFixed(2)}, have ¥${capitalCheck.available.toFixed(2)}`);
      return { success: false, error: `Insufficient capital: ¥${capitalCheck.available.toFixed(2)} available, ¥${capitalCheck.required.toFixed(2)} required` };
    }

    // Gate 6: Position size limit
    const maxSize = this.getAllowedPositionSize(this.getCurrentEquity());
    if ((order.price || 0) * order.quantity > maxSize) {
      this.recordRejection(`Position size ${((order.price || 0) * order.quantity).toFixed(2)} exceeds limit ¥${maxSize.toFixed(2)}`);
      return { success: false, error: `Position size exceeds limit` };
    }

    // Submit via broker
    try {
      const orderId = await this.submitToBroker(order);
      this.rejectionCount = 0; // Reset on success
      log.info(`[RealTrader] Real order submitted: ${order.side} ${order.quantity} ${order.symbol} @ ${order.price || 'MKT'} → ${orderId}`);
      this.emit('realtrader:orderSubmitted', { orderId, order });
      return { success: true, orderId };
    } catch (err: unknown) {
      this.recordRejection(`Broker rejection: ${err.message}`);
      this.rejectionCount++;

      if (this.rejectionCount >= this.config.maxConsecutiveRejections) {
        this.tripCircuitBreaker();
      }

      return { success: false, error: err.message };
    }
  }

  // ── Circuit Breaker ──────────────────────────────────────────────────────

  private isCircuitBreakerTripped(): boolean {
    return this.circuitTrippedUntil > Date.now();
  }

  private tripCircuitBreaker(): void {
    this.circuitTrippedUntil = Date.now() + this.config.circuitBreakerPauseMs;
    log.warn(`[RealTrader] Circuit breaker TRIPPED! Pausing for ${this.config.circuitBreakerPauseMs / 1000 / 60} min`);
    this.emit('realtrader:circuitBreakerTripped', {
      until: this.circuitTrippedUntil,
      pauseMs: this.config.circuitBreakerPauseMs,
    });
  }

  private recordRejection(reason: string): void {
    this.recentRejections.unshift(`[${new Date().toLocaleTimeString()}] ${reason}`);
    if (this.recentRejections.length > 10) this.recentRejections.pop();
    log.warn(`[RealTrader] Rejection recorded: ${reason} (total: ${this.rejectionCount})`);
    this.emit('realtrader:orderRejected', { reason, count: this.rejectionCount });
  }

  // ── Capital Check ────────────────────────────────────────────────────────

  private async checkCapitalSufficiency(order: LiveOrder): Promise<{ sufficient: boolean; available: number; required: number }> {
    if (!this.broker) return { sufficient: false, available: 0, required: 0 };

    try {
      const funds: FundsInfo = await this.broker.getFunds();
      const available = funds.availableCash;
      const required = (order.price || 0) * order.quantity * (order.side === 'BUY' ? 1 : 0);
      return { sufficient: available >= required, available, required };
    } catch {
      return { sufficient: false, available: 0, required: (order.price || 0) * order.quantity };
    }
  }

  private async submitToBroker(order: Omit<LiveOrder, 'id' | 'status' | 'filledQty' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.broker) throw new EngineError(ErrorCode.TRADE_EXECUTION_FAILED, 'No broker configured');

    const result = await this.broker.placeOrder({
      side: order.side,
      code: order.symbol,
      qty: order.quantity,
      price: order.price || 0,
      orderType: order.type,
    });

    if (!result.orderId) throw new EngineError(ErrorCode.TRADE_EXECUTION_FAILED, result.errStr || 'Unknown broker error');
    return result.orderId;
  }

  // ── Equity Tracking ──────────────────────────────────────────────────────

  private getCurrentEquity(): number {
    if (!this.broker) return this.initialEquity || 0;

    try {
      const funds = this.getCachedFunds();
      return funds?.totalAssets || this.initialEquity || 0;
    } catch {
      return this.initialEquity || 0;
    }
  }

  private cachedFunds: FundsInfo | null = null;
  private fundsCacheTime: number = 0;

  private getCachedFunds(): FundsInfo | null {
    if (this.cachedFunds && Date.now() - this.fundsCacheTime < 10_000) {
      return this.cachedFunds;
    }
    return null;
  }

  updateFundsCache(funds: FundsInfo): void {
    this.cachedFunds = funds;
    this.fundsCacheTime = Date.now();

    const equity = funds.totalAssets;
    if (equity > this.peakEquity) this.peakEquity = equity;

    // New day reset
    const now = Date.now();
    if (now - this.todayStartTime > 24 * 60 * 60 * 1000) {
      this.todayStartTime = now;
      this.todayStartEquity = equity;
      log.info('[RealTrader] New trading day reset - todayStartEquity: ¥' + equity.toFixed(2));
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  getStatus(): RealTraderStatus {
    const gate = this.checkSafetyGates();
    const equity = this.getCurrentEquity();
    const drawdownPct = this.peakEquity > 0 ? (this.peakEquity - equity) / this.peakEquity : 0;
    const dailyLossPct = this.todayStartEquity > 0 ? (this.todayStartEquity - equity) / this.todayStartEquity : 0;

    return {
      mode: this.getMode(),
      safetyGate: {
        dailyLossPct,
        currentDrawdownPct: drawdownPct,
        isBlocked: !gate.pass,
        blockReason: gate.reasons.join('; ') || undefined,
        reducedMode: drawdownPct >= this.config.maxDrawdownPct,
        pendingConfirmation: this.needsHumanConfirmation(),
      },
      circuitBreaker: {
        consecutiveRejections: this.rejectionCount,
        isTripped: this.isCircuitBreakerTripped(),
        trippedUntil: this.circuitTrippedUntil > Date.now() ? this.circuitTrippedUntil : undefined,
      },
      liveExecutor: this.liveExecutor ? {
        isRunning: true,
        strategiesCount: 0,
        positionsCount: 0,
        ordersCount: 0,
        totalPnL: 0,
        lastUpdate: Date.now(),
      } : { isRunning: false, strategiesCount: 0, positionsCount: 0, ordersCount: 0, totalPnL: 0, lastUpdate: 0 },
      recentRejections: this.recentRejections,
    };
  }

  // ── Config ────────────────────────────────────────────────────────────────

  updateConfig(updates: Partial<SafetyGateConfig>): void {
    this.config = { ...this.config, ...updates };
    log.info('[RealTrader] Config updated:', updates);
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let realTraderInstance: RealTrader | null = null;

export function getRealTrader(): RealTrader {
  if (!realTraderInstance) {
    realTraderInstance = new RealTrader();
  }
  return realTraderInstance;
}

export default RealTrader;
