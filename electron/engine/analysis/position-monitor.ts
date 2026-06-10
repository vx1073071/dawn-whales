import { EventEmitter } from 'events';
import log from 'electron-log';
import { EngineError, ErrorCode } from '../../errors';


// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface TrackedPosition {
  id: string;
  code: string;
  side: 'long' | 'short';
  qty: number;
  entryPrice: number;
  entryTime: number;          // timestamp ms
  stopLoss?: number;          // absolute price
  takeProfit?: number;        // absolute price
  trailingStopPct?: number;   // percentage trailing stop (e.g. 3.5 = 3.5%)
  trailingStopPrice?: number; // calculated trailing stop price
  timeExitMinutes?: number;   // exit after N minutes
  highestPrice?: number;      // highest price seen (for long trailing stop)
  lowestPrice?: number;       // lowest price seen (for short trailing stop)
}

export interface ExitSignal {
  positionId: string;
  code: string;
  side: 'long' | 'short';
  exitType: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'time_exit';
  currentPrice: number;
  entryPrice: number;
  pnlPct: number;
  reason: string;
  timestamp: number;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export interface PositionMonitorEvents {
  'exit-signal': (signal: ExitSignal) => void;
  'position-added': (position: TrackedPosition) => void;
  'position-removed': (position: TrackedPosition) => void;
  'price-updated': (code: string, price: number, signals: ExitSignal[]) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of exited positions to retain in history for stats */
const MAX_EXIT_HISTORY = 500;

/** Minimum price movement (%) to trigger trailing stop recalculation */
const TRAILING_STOP_MIN_TICK_PCT = 0.05;

// ─── PositionMonitor ────────────────────────────────────────────────────────

/**
 * PositionMonitor — monitors open positions and triggers
 * stop-loss / take-profit / trailing-stop / time-exit signals.
 *
 * Usage:
 *   const monitor = new PositionMonitor();
 *   const id = monitor.trackPosition({ code: 'SH600519', side: 'long', qty: 100, entryPrice: 1800, entryTime: Date.now() });
 *   monitor.on('exit-signal', (signal) => { ... });
 *   const exits = monitor.updatePrice('SH600519', 1850);
 */
export class PositionMonitor extends EventEmitter {
  /** Active positions indexed by ID */
  private positions: Map<string, TrackedPosition> = new Map();

  /** Monotonically increasing position counter */
  private nextId = 1;

  /** Historical exit signals for stats */
  private exitHistory: ExitSignal[] = [];

  /** Total realised PnL (%) across all exited positions */
  private totalPnl = 0;

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  constructor() {
    super();
    this.setMaxListeners(50);
    log.info('[PositionMonitor] Initialized');
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Start tracking a new position.
   * Returns the generated position ID.
   */
  public trackPosition(position: Omit<TrackedPosition, 'id'>): string {
    const id = this.generateId();

    const tracked: TrackedPosition = {
      ...position,
      id,
      highestPrice: position.side === 'long' ? position.entryPrice : undefined,
      lowestPrice: position.side === 'short' ? position.entryPrice : undefined,
    };

    // Validate inputs
    this.validatePosition(tracked);

    // Initialise trailing stop price if trailingStopPct provided
    if (tracked.trailingStopPct !== undefined && tracked.trailingStopPct > 0) {
      if (tracked.side === 'long') {
        tracked.trailingStopPrice = this.calcTrailingStopLong(
          tracked.entryPrice,
          tracked.trailingStopPct,
        );
      } else {
        tracked.trailingStopPrice = this.calcTrailingStopShort(
          tracked.entryPrice,
          tracked.trailingStopPct,
        );
      }
    }

    this.positions.set(id, tracked);

    log.info(
      `[PositionMonitor] Tracking position ${id} | ${tracked.code} ${tracked.side} ` +
        `qty=${tracked.qty} entry=${tracked.entryPrice} SL=${tracked.stopLoss ?? '-'} ` +
        `TP=${tracked.takeProfit ?? '-'} trail=${tracked.trailingStopPct ?? '-'}% ` +
        `timeExit=${tracked.timeExitMinutes ?? '-'}min`,
    );

    this.emit('position-added', tracked);

    return id;
  }

  /**
   * Remove a tracked position by ID.
   * Returns true if found and removed.
   */
  public removePosition(id: string): boolean {
    const position = this.positions.get(id);
    if (!position) {
      log.warn(`[PositionMonitor] removePosition: ID ${id} not found`);
      return false;
    }

    this.positions.delete(id);

    log.info(
      `[PositionMonitor] Removed position ${id} | ${position.code} ${position.side}`,
    );

    this.emit('position-removed', position);

    return true;
  }

  /**
   * Get a single tracked position by ID.
   */
  public getPosition(id: string): TrackedPosition | undefined {
    return this.positions.get(id);
  }

  /**
   * Get all currently tracked positions.
   */
  public getAllPositions(): TrackedPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Update price for a given stock code.
   * Checks all positions for this code against exit conditions.
   * Returns array of triggered exit signals.
   */
  public updatePrice(code: string, currentPrice: number): ExitSignal[] {
    if (currentPrice <= 0 || !Number.isFinite(currentPrice)) {
      log.warn(`[PositionMonitor] Invalid price for ${code}: ${currentPrice}`);
      return [];
    }

    const signals: ExitSignal[] = [];
    const matchingPositions = this.getPositionsByCode(code);

    for (const position of matchingPositions) {
      // Update high/low watermark
      this.updateWatermark(position, currentPrice);

      // Update trailing stop price if applicable
      this.recalcTrailingStop(position);

      // Check exit conditions in priority order
      const signal = this.evaluateExit(position, currentPrice);

      if (signal) {
        signals.push(signal);
        this.recordExit(signal);
        this.positions.delete(position.id);

        log.info(
          `[PositionMonitor] EXIT ${signal.exitType} | ${signal.positionId} ${signal.code} ` +
            `${signal.side} | entry=${signal.entryPrice} current=${signal.currentPrice} ` +
            `pnl=${signal.pnlPct.toFixed(2)}% | ${signal.reason}`,
        );

        this.emit('exit-signal', signal);
      }
    }

    if (signals.length > 0 || matchingPositions.length > 0) {
      this.emit('price-updated', code, currentPrice, signals);
    }

    return signals;
  }

  // ─── Individual Exit Checks ─────────────────────────────────────────────

  /**
   * Check if stop-loss is triggered.
   * Long: current price <= stopLoss
   * Short: current price >= stopLoss
   */
  public checkStopLoss(position: TrackedPosition, currentPrice: number): boolean {
    if (position.stopLoss === undefined) {
      return false;
    }

    if (position.side === 'long') {
      return currentPrice <= position.stopLoss;
    }

    // short
    return currentPrice >= position.stopLoss;
  }

  /**
   * Check if take-profit is triggered.
   * Long: current price >= takeProfit
   * Short: current price <= takeProfit
   */
  public checkTakeProfit(position: TrackedPosition, currentPrice: number): boolean {
    if (position.takeProfit === undefined) {
      return false;
    }

    if (position.side === 'long') {
      return currentPrice >= position.takeProfit;
    }

    // short
    return currentPrice <= position.takeProfit;
  }

  /**
   * Check if trailing stop is triggered.
   * Uses the dynamically updated trailingStopPrice.
   */
  public checkTrailingStop(position: TrackedPosition, currentPrice: number): boolean {
    if (
      position.trailingStopPct === undefined ||
      position.trailingStopPct <= 0 ||
      position.trailingStopPrice === undefined
    ) {
      return false;
    }

    if (position.side === 'long') {
      return currentPrice <= position.trailingStopPrice;
    }

    // short
    return currentPrice >= position.trailingStopPrice;
  }

  /**
   * Check if time-based exit is triggered.
   */
  public checkTimeExit(position: TrackedPosition): boolean {
    if (
      position.timeExitMinutes === undefined ||
      position.timeExitMinutes <= 0
    ) {
      return false;
    }

    const elapsed = Date.now() - position.entryTime;
    const thresholdMs = position.timeExitMinutes * 60 * 1000;

    return elapsed >= thresholdMs;
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  /**
   * Get summary statistics.
   */
  public getStats(): { tracked: number; exits: number; totalPnl: number } {
    return {
      tracked: this.positions.size,
      exits: this.exitHistory.length,
      totalPnl: this.totalPnl,
    };
  }

  /**
   * Get full exit history.
   */
  public getExitHistory(): ReadonlyArray<ExitSignal> {
    return this.exitHistory;
  }

  /**
   * Clear all tracked positions without generating exit signals.
   */
  public clearAll(): void {
    const count = this.positions.size;
    this.positions.clear();
    log.info(`[PositionMonitor] Cleared all positions (${count} removed)`);
  }

  /**
   * Reset stats (exit history + total PnL).
   */
  public resetStats(): void {
    this.exitHistory = [];
    this.totalPnl = 0;
    log.info('[PositionMonitor] Stats reset');
  }

  // ─── Batch Operations ───────────────────────────────────────────────────

  /**
   * Update prices for multiple codes at once.
   * Returns aggregated exit signals.
   */
  public updatePrices(priceMap: Map<string, number>): ExitSignal[] {
    const allSignals: ExitSignal[] = [];

    for (const [code, price] of priceMap.entries()) {
      const signals = this.updatePrice(code, price);
      allSignals.push(...signals);
    }

    return allSignals;
  }

  /**
   * Get all positions for a specific stock code.
   */
  public getPositionsByCode(code: string): TrackedPosition[] {
    const result: TrackedPosition[] = [];

    for (const position of this.positions.values()) {
      if (position.code === code) {
        result.push(position);
      }
    }

    return result;
  }

  /**
   * Get all unique stock codes currently being tracked.
   */
  public getTrackedCodes(): string[] {
    const codes = new Set<string>();

    for (const position of this.positions.values()) {
      codes.add(position.code);
    }

    return Array.from(codes);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  /**
   * Generate a unique position ID.
   */
  private generateId(): string {
    const id = `pos_${this.nextId.toString(36)}_${Date.now().toString(36)}`;
    this.nextId++;
    return id;
  }

  /**
   * Validate position fields.
   */
  private validatePosition(position: TrackedPosition): void {
    if (!position.code || position.code.trim().length === 0) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, '[PositionMonitor] Position code is required');
    }

    if (position.side !== 'long' && position.side !== 'short') {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid side: ${position.side}`);
    }

    if (position.qty <= 0 || !Number.isFinite(position.qty)) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid qty: ${position.qty}`);
    }

    if (position.entryPrice <= 0 || !Number.isFinite(position.entryPrice)) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid entryPrice: ${position.entryPrice}`);
    }

    if (position.entryTime <= 0) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid entryTime: ${position.entryTime}`);
    }

    if (position.stopLoss !== undefined && position.stopLoss <= 0) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid stopLoss: ${position.stopLoss}`);
    }

    if (position.takeProfit !== undefined && position.takeProfit <= 0) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid takeProfit: ${position.takeProfit}`);
    }

    if (
      position.trailingStopPct !== undefined &&
      (position.trailingStopPct <= 0 || position.trailingStopPct >= 100)
    ) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid trailingStopPct: ${position.trailingStopPct} (must be 0-100)`,);
    }

    if (
      position.timeExitMinutes !== undefined &&
      position.timeExitMinutes <= 0
    ) {
      throw new EngineError(ErrorCode.MONITORING_ERROR, `[PositionMonitor] Invalid timeExitMinutes: ${position.timeExitMinutes}`,);
    }

    // Semantic validation: stop-loss should be below entry for long, above for short
    if (position.stopLoss !== undefined) {
      if (position.side === 'long' && position.stopLoss >= position.entryPrice) {
        log.warn(
          `[PositionMonitor] Warning: stopLoss (${position.stopLoss}) >= entryPrice ` +
            `(${position.entryPrice}) for long position`,
        );
      }
      if (position.side === 'short' && position.stopLoss <= position.entryPrice) {
        log.warn(
          `[PositionMonitor] Warning: stopLoss (${position.stopLoss}) <= entryPrice ` +
            `(${position.entryPrice}) for short position`,
        );
      }
    }

    // Semantic validation: take-profit should be above entry for long, below for short
    if (position.takeProfit !== undefined) {
      if (position.side === 'long' && position.takeProfit <= position.entryPrice) {
        log.warn(
          `[PositionMonitor] Warning: takeProfit (${position.takeProfit}) <= entryPrice ` +
            `(${position.entryPrice}) for long position`,
        );
      }
      if (position.side === 'short' && position.takeProfit >= position.entryPrice) {
        log.warn(
          `[PositionMonitor] Warning: takeProfit (${position.takeProfit}) >= entryPrice ` +
            `(${position.entryPrice}) for short position`,
        );
      }
    }
  }

  /**
   * Update high/low watermark for trailing stop tracking.
   */
  private updateWatermark(position: TrackedPosition, currentPrice: number): void {
    if (position.side === 'long') {
      if (position.highestPrice === undefined || currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
      }
    } else {
      if (position.lowestPrice === undefined || currentPrice < position.lowestPrice) {
        position.lowestPrice = currentPrice;
      }
    }
  }

  /**
   * Recalculate trailing stop price based on latest watermark.
   */
  private recalcTrailingStop(position: TrackedPosition): void {
    if (
      position.trailingStopPct === undefined ||
      position.trailingStopPct <= 0
    ) {
      return;
    }

    if (position.side === 'long') {
      if (position.highestPrice === undefined) {
        return;
      }

      const newStop = this.calcTrailingStopLong(
        position.highestPrice,
        position.trailingStopPct,
      );

      // Only move trailing stop upward (never downward)
      if (
        position.trailingStopPrice === undefined ||
        newStop > position.trailingStopPrice
      ) {
        // Require minimum tick to avoid micro-adjustments
        if (
          position.trailingStopPrice === undefined ||
          this.pctDiff(newStop, position.trailingStopPrice) >= TRAILING_STOP_MIN_TICK_PCT
        ) {
          log.debug(
            `[PositionMonitor] Trailing stop updated for ${position.id}: ` +
              `${position.trailingStopPrice?.toFixed(4) ?? 'none'} → ${newStop.toFixed(4)} ` +
              `(highest=${position.highestPrice.toFixed(4)})`,
          );
          position.trailingStopPrice = newStop;
        }
      }
    } else {
      // short
      if (position.lowestPrice === undefined) {
        return;
      }

      const newStop = this.calcTrailingStopShort(
        position.lowestPrice,
        position.trailingStopPct,
      );

      // Only move trailing stop downward (never upward)
      if (
        position.trailingStopPrice === undefined ||
        newStop < position.trailingStopPrice
      ) {
        if (
          position.trailingStopPrice === undefined ||
          this.pctDiff(position.trailingStopPrice, newStop) >= TRAILING_STOP_MIN_TICK_PCT
        ) {
          log.debug(
            `[PositionMonitor] Trailing stop updated for ${position.id}: ` +
              `${position.trailingStopPrice?.toFixed(4) ?? 'none'} → ${newStop.toFixed(4)} ` +
              `(lowest=${position.lowestPrice.toFixed(4)})`,
          );
          position.trailingStopPrice = newStop;
        }
      }
    }
  }

  /**
   * Calculate trailing stop price for a long position.
   * trailingStopPrice = referencePrice * (1 - pct / 100)
   */
  private calcTrailingStopLong(referencePrice: number, pct: number): number {
    return referencePrice * (1 - pct / 100);
  }

  /**
   * Calculate trailing stop price for a short position.
   * trailingStopPrice = referencePrice * (1 + pct / 100)
   */
  private calcTrailingStopShort(referencePrice: number, pct: number): number {
    return referencePrice * (1 + pct / 100);
  }

  /**
   * Evaluate all exit conditions for a position at the current price.
   * Returns an ExitSignal if any condition is met, or null.
   *
   * Priority order:
   * 1. Stop-loss (capital preservation first)
   * 2. Take-profit (lock in gains)
   * 3. Trailing-stop (protect profits from reversal)
   * 4. Time-exit (stale position cleanup)
   */
  private evaluateExit(
    position: TrackedPosition,
    currentPrice: number,
  ): ExitSignal | null {
    // 1. Stop-loss
    if (this.checkStopLoss(position, currentPrice)) {
      return this.buildExitSignal(position, currentPrice, 'stop_loss');
    }

    // 2. Take-profit
    if (this.checkTakeProfit(position, currentPrice)) {
      return this.buildExitSignal(position, currentPrice, 'take_profit');
    }

    // 3. Trailing stop
    if (this.checkTrailingStop(position, currentPrice)) {
      return this.buildExitSignal(position, currentPrice, 'trailing_stop');
    }

    // 4. Time exit
    if (this.checkTimeExit(position)) {
      return this.buildExitSignal(position, currentPrice, 'time_exit');
    }

    return null;
  }

  /**
   * Build an ExitSignal object.
   */
  private buildExitSignal(
    position: TrackedPosition,
    currentPrice: number,
    exitType: ExitSignal['exitType'],
  ): ExitSignal {
    const pnlPct = this.calcPnlPct(position, currentPrice);
    const reason = this.buildExitReason(position, currentPrice, exitType);

    const signal: ExitSignal = {
      positionId: position.id,
      code: position.code,
      side: position.side,
      exitType,
      currentPrice,
      entryPrice: position.entryPrice,
      pnlPct,
      reason,
      timestamp: Date.now(),
    };

    return signal;
  }

  /**
   * Calculate PnL percentage for a position.
   */
  private calcPnlPct(position: TrackedPosition, currentPrice: number): number {
    if (position.side === 'long') {
      return ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    }

    // short: profit when price drops
    return ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
  }

  /**
   * Build a human-readable exit reason string.
   */
  private buildExitReason(
    position: TrackedPosition,
    currentPrice: number,
    exitType: ExitSignal['exitType'],
  ): string {
    switch (exitType) {
      case 'stop_loss': {
        return (
          `Stop-loss triggered: price ${currentPrice.toFixed(4)} ` +
          `${position.side === 'long' ? '<=' : '>='} SL ${position.stopLoss?.toFixed(4)}`
        );
      }

      case 'take_profit': {
        return (
          `Take-profit triggered: price ${currentPrice.toFixed(4)} ` +
          `${position.side === 'long' ? '>=' : '<='} TP ${position.takeProfit?.toFixed(4)}`
        );
      }

      case 'trailing_stop': {
        const watermark =
          position.side === 'long'
            ? `highest=${position.highestPrice?.toFixed(4) ?? '?'}`
            : `lowest=${position.lowestPrice?.toFixed(4) ?? '?'}`;

        return (
          `Trailing stop triggered: price ${currentPrice.toFixed(4)} ` +
          `${position.side === 'long' ? '<=' : '>='} trail ${position.trailingStopPrice?.toFixed(4)} ` +
          `(${watermark}, ${position.trailingStopPct}%)`
        );
      }

      case 'time_exit': {
        const elapsedMin = ((Date.now() - position.entryTime) / 60000).toFixed(1);
        return (
          `Time exit triggered: held ${elapsedMin}min >= ${position.timeExitMinutes}min limit`
        );
      }

      default:
        return `Unknown exit type: ${exitType}`;
    }
  }

  /**
   * Record an exit signal in history and accumulate PnL.
   */
  private recordExit(signal: ExitSignal): void {
    this.exitHistory.push(signal);
    this.totalPnl += signal.pnlPct;

    // Trim history if too large
    if (this.exitHistory.length > MAX_EXIT_HISTORY) {
      const excess = this.exitHistory.length - MAX_EXIT_HISTORY;
      this.exitHistory = this.exitHistory.slice(excess);
    }
  }

  /**
   * Calculate percentage difference between two values.
   */
  private pctDiff(a: number, b: number): number {
    if (b === 0) return Math.abs(a) * 100;
    return Math.abs(((a - b) / b) * 100);
  }
}

// ─── Default Export ─────────────────────────────────────────────────────────

export default PositionMonitor;
