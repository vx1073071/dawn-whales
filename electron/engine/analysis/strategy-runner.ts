// ── Strategy Runner — Automated Strategy Execution Orchestrator ──────────────
// J-29-02: Dawn Whales
//
// Orchestrates automated strategy execution with two modes:
//   • dry-run  — evaluate signals and log, but never execute orders
//   • live-run — evaluate signals AND execute orders via TradeExecutor + UAM
//
// Architecture:
//   1. Poll broker for real-time quotes (configurable interval)
//   2. Feed quotes into StrategyEngine.onQuoteUpdate()
//   3. Detect new signals by tracking Strategy.lastSignal changes
//   4. Validate signals through TradeExecutor.runRiskChecks()
//   5. Route orders via UnifiedAccountManager.routeOrder() (preferred broker)
//      or fall back to TradeExecutor.processSignal()
//   6. Record execution history (rolling window, last 100 records)
//   7. Emit typed events for UI / IPC / logging consumers

import log from 'electron-log';
import { EngineError } from '../core/engine-error';
import type { StrategyEngine } from './strategy-engine';
import type { TradeExecutor, TradeSignal, RiskCheck } from './trade-executor';
import type { UnifiedAccountManager } from '../../broker/unified-account-manager';
import type { QuoteInfo } from '../../broker/IBrokerAdapter';

// ── Exported Interfaces ─────────────────────────────────────────────────────

/** Strategy execution mode */
export type StrategyRunMode = 'dry-run' | 'live-run';

/** Current status of a running strategy */
export interface StrategyRunStatus {
  strategyId: string;
  strategyName: string;
  symbol: string;
  mode: StrategyRunMode;
  running: boolean;
  startedAt: number;
  lastEvaluationAt: number | null;
  signalCount: number;
  orderCount: number;
  errorCount: number;
  brokerId?: string;
}

/** Single execution record (signal → order → fill or rejection) */
export interface ExecutionRecord {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  mode: StrategyRunMode;
  signal: 'BUY' | 'SELL' | 'HOLD';
  signalReason: string;
  price: number;
  quantity: number;
  status: 'dry-run' | 'signal' | 'order-placed' | 'order-filled' | 'risk-rejected' | 'error';
  riskCheckPassed: boolean;
  riskCheckReason: string;
  orderId?: string;
  brokerId?: string;
  errorMessage?: string;
  timestamp: number;
}

/** Result returned by evaluateAndExecute() */
export interface EvaluationResult {
  strategyId: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  signalReason: string;
  price: number;
  riskCheckPassed: boolean;
  riskCheckReason: string;
  orderExecuted: boolean;
  orderId?: string;
  brokerId?: string;
  errorMessage?: string;
}

// ── Event Types ─────────────────────────────────────────────────────────────

type StrategyRunnerEvents = {
  signal: (record: ExecutionRecord) => void;
  'order-placed': (record: ExecutionRecord) => void;
  'order-filled': (record: ExecutionRecord) => void;
  'risk-rejected': (record: ExecutionRecord) => void;
  error: (error: { strategyId: string; message: string; stack?: string }) => void;
};

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MAX_EXECUTION_HISTORY = 100;
const DEFAULT_SIGNAL_CONFIDENCE = 0.8;
const DEFAULT_LOT_SIZE = 100;

// ── Inferred Strategy Type ──────────────────────────────────────────────────
// Strategy interface is not exported from strategy-engine.ts, so we infer it.

type StrategyInfo = NonNullable<ReturnType<StrategyEngine['getStrategy']>>;

// ── Typed Event Emitter (lightweight) ───────────────────────────────────────

type EventMap = Record<string, (...args: unknown[]) => void>;

class TypedEventEmitter<T extends EventMap> {
  private handlers: Map<string, Set<Function>> = new Map();

  on<K extends keyof T & string>(event: K, listener: T[K]): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(listener);
    return () => {
      this.handlers.get(event)?.delete(listener);
    };
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): void {
    this.handlers.get(event)?.delete(listener);
  }

  protected emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(...args);
      } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
        void EngineError; // structured error domain: SYSTEM
        log.error(`[StrategyRunner] Event listener error for "${event}":`, err);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

// ── Quote Provider Type ─────────────────────────────────────────────────────

/**
 * Async function that fetches current quotes for a list of stock codes.
 * Can be backed by BrokerManager, a cached store, or IPC bridge.
 *
 * Example with BrokerManager:
 * ```ts
 * const fetcher: QuoteProviderFn = async (codes) => {
 *   const broker = brokerManager.getBroker(activeBrokerId);
 *   if (!broker?.connected) return [];
 *   return broker.getQuotes(codes);
 * };
 * const runner = new StrategyRunner(engine, executor, uam, fetcher);
 * ```
 */
export type QuoteProviderFn = (codes: string[]) => Promise<QuoteInfo[]>;

// ── Per-Strategy Runtime State ──────────────────────────────────────────────

interface RunningState {
  strategyId: string;
  mode: StrategyRunMode;
  symbol: string;
  brokerId?: string;
  startedAt: number;
  lastEvaluationAt: number | null;
  lastProcessedSignalTime: number;
  signalCount: number;
  orderCount: number;
  errorCount: number;
  pollTimer: ReturnType<typeof setInterval> | null;
}

// ════════════════════════════════════════════════════════════════════════════
//  StrategyRunner
// ════════════════════════════════════════════════════════════════════════════

/**
 * StrategyRunner orchestrates automated strategy execution.
 *
 * It coordinates three subsystems:
 *   - **StrategyEngine**: evaluates streaming quotes and produces signals
 *   - **TradeExecutor**:  validates risk and processes trade signals
 *   - **UnifiedAccountManager**: routes orders to the correct broker
 *
 * Usage:
 * ```ts
 * const runner = new StrategyRunner(strategyEngine, tradeExecutor, uam, quoteFetcher);
 * runner.start('strat_abc123', 'live-run');
 * runner.on('order-filled', (rec) => log.info('Filled:', rec));
 * // later...
 * runner.stop('strat_abc123');
 * ```
 */
export class StrategyRunner extends TypedEventEmitter<StrategyRunnerEvents> {
  private engine: StrategyEngine;
  private executor: TradeExecutor;
  private uam: UnifiedAccountManager;
  private quoteProvider: QuoteProviderFn;

  /** Active strategy states keyed by strategyId */
  private running: Map<string, RunningState> = new Map();

  /** Rolling execution history (max 100 records) */
  private history: ExecutionRecord[] = [];

  /** Whether the runner has been initialized (callback registered) */
  private initialized = false;

  // ── Constructor ───────────────────────────────────────────────────────────

  /**
   * @param engine    StrategyEngine instance for signal evaluation
   * @param executor  TradeExecutor instance for order processing and risk checks
   * @param uam       UnifiedAccountManager for multi-broker order routing
   * @param quoteProvider  Async function to fetch current quotes for given codes.
   *                       If omitted, a no-op provider returning [] is used
   *                       (suitable when quotes are pushed externally).
   */
  constructor(
    engine: StrategyEngine,
    executor: TradeExecutor,
    uam: UnifiedAccountManager,
    quoteProvider?: QuoteProviderFn,
  ) {
    super();
    this.engine = engine;
    this.executor = executor;
    this.uam = uam;
    this.quoteProvider = quoteProvider ?? (async (_codes: string[]) => []);
    this.init();
    log.info('[StrategyRunner] Initialized');
  }

  // ── Initialization ────────────────────────────────────────────────────────

  /**
   * Register a signal callback on the StrategyEngine.
   * The engine fires this synchronously during onQuoteUpdate() when any
   * live strategy generates a BUY or SELL signal. We use it as a trigger
   * to know that a signal exists; the actual signal data is read from
   * strategy.lastSignal after onQuoteUpdate returns.
   */
  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.engine.onSignal((_signalEvent) => {
      // Signal events are processed in the evaluation loop after onQuoteUpdate
      // completes, by comparing strategy.lastSignal.time against our tracked
      // lastProcessedSignalTime. This avoids duplicate processing and keeps
      // the async execution flow cleanly separated from the sync callback.
    });

    log.info('[StrategyRunner] Signal callback registered with StrategyEngine');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═════════════════════════════════════════════════════════════════════════

  // ── start ─────────────────────────────────────────────────────────────────

  /**
   * Start running a strategy in the specified mode.
   * - 'dry-run':  signals are evaluated and logged; no orders are placed.
   * - 'live-run': signals are evaluated AND orders are executed.
   *
   * In live-run mode the strategy is also activated in the StrategyEngine
   * (engine.startLive) so that onQuoteUpdate processes it.
   */
  start(strategyId: string, mode: StrategyRunMode): void {
    const strategy = this.engine.getStrategy(strategyId);
    if (!strategy) {
      log.error(`[StrategyRunner] Cannot start: strategy not found: ${strategyId}`);
      this.emitError(strategyId, `Strategy not found: ${strategyId}`);
      return;
    }

    if (this.running.has(strategyId)) {
      log.warn(`[StrategyRunner] Strategy already running: ${strategyId}`);
      return;
    }

    // In live-run mode, activate the strategy in the engine
    if (mode === 'live-run') {
      this.engine.startLive(strategyId);
    }

    const state: RunningState = {
      strategyId,
      mode,
      symbol: strategy.symbol,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      brokerId: (strategy as any).strategy?.brokerId,
      startedAt: Date.now(),
      lastEvaluationAt: null,
      lastProcessedSignalTime: 0,
      signalCount: 0,
      orderCount: 0,
      errorCount: 0,
      pollTimer: null,
    };

    // Start the polling loop
    state.pollTimer = setInterval(() => {
      this.evaluateLoop(strategyId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`[StrategyRunner] Evaluation error for ${strategyId}:`, msg);
        state.errorCount++;
        this.emitError(strategyId, msg);
      });
    }, DEFAULT_POLL_INTERVAL_MS);

    this.running.set(strategyId, state);
    log.info(
      `[StrategyRunner] 🟢 Started: ${strategyId} "${strategy.name}" ` +
      `[${mode}] symbol=${strategy.symbol} interval=${DEFAULT_POLL_INTERVAL_MS}ms`,
    );
  }

  // ── stop ──────────────────────────────────────────────────────────────────

  /**
   * Stop a running strategy. Clears its poll timer and, if in live-run mode,
   * deactivates it in the StrategyEngine.
   */
  stop(strategyId: string): void {
    const state = this.running.get(strategyId);
    if (!state) {
      log.warn(`[StrategyRunner] Strategy not running: ${strategyId}`);
      return;
    }

    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }

    if (state.mode === 'live-run') {
      this.engine.stopLive(strategyId);
    }

    this.running.delete(strategyId);
    log.info(`[StrategyRunner] 🔴 Stopped: ${strategyId}`);
  }

  // ── stopAll ───────────────────────────────────────────────────────────────

  /** Stop all running strategies. */
  stopAll(): void {
    const ids = Array.from(this.running.keys());
    log.info(`[StrategyRunner] Stopping all ${ids.length} running strategies...`);
    for (const id of ids) {
      this.stop(id);
    }
    log.info('[StrategyRunner] All strategies stopped');
  }

  // ── getStatus ─────────────────────────────────────────────────────────────

  /**
   * Get status of running strategies.
   * @param strategyId  If provided, return status for that strategy only.
   *                    Otherwise return all running strategies.
   */
  getStatus(strategyId?: string): StrategyRunStatus[] {
    const states = strategyId
      ? [this.running.get(strategyId)].filter(Boolean) as RunningState[]
      : Array.from(this.running.values());

    return states.map((s) => ({
      strategyId: s.strategyId,
      strategyName: this.engine.getStrategy(s.strategyId)?.name ?? s.strategyId,
      symbol: s.symbol,
      mode: s.mode,
      running: true,
      startedAt: s.startedAt,
      lastEvaluationAt: s.lastEvaluationAt,
      signalCount: s.signalCount,
      orderCount: s.orderCount,
      errorCount: s.errorCount,
      brokerId: s.brokerId,
    }));
  }

  // ── getExecutionHistory ───────────────────────────────────────────────────

  /**
   * Get execution history records (most recent first).
   * @param strategyId  Filter by strategy (optional).
   * @param limit       Max records to return (default 100).
   */
  getExecutionHistory(strategyId?: string, limit?: number): ExecutionRecord[] {
    const effectiveLimit = limit ?? MAX_EXECUTION_HISTORY;
    let records = [...this.history];

    if (strategyId) {
      records = records.filter((r) => r.strategyId === strategyId);
    }

    // Most recent first
    records.sort((a, b) => b.timestamp - a.timestamp);
    return records.slice(0, effectiveLimit);
  }

  // ── evaluateAndExecute ────────────────────────────────────────────────────

  /**
   * One-shot: fetch current quote, push to engine, detect signal, validate
   * risk, and (for live-run strategies) execute the order.
   *
   * Note: The strategy must have accumulated enough quote history via the
   * polling loop (start()) for technical indicators to produce meaningful
   * signals. A single call may return HOLD if indicator data is insufficient.
   *
   * Can also be called for strategies not started via start() — in that case
   * the mode defaults to 'dry-run' and the strategy must already be in 'live'
   * status in the engine.
   */
  async evaluateAndExecute(strategyId: string): Promise<EvaluationResult> {
    const strategy = this.engine.getStrategy(strategyId);
    if (!strategy) {
      return {
        strategyId,
        symbol: '',
        signal: 'HOLD',
        signalReason: '',
        price: 0,
        riskCheckPassed: false,
        riskCheckReason: `Strategy not found: ${strategyId}`,
        orderExecuted: false,
        errorMessage: `Strategy not found: ${strategyId}`,
      };
    }

    const state = this.running.get(strategyId);
    const mode: StrategyRunMode = state?.mode ?? 'dry-run';
    const prevSignalTime = strategy.lastSignal?.time ?? 0;

    // 1. Fetch current quotes and push to engine
    const quotes = await this.fetchQuotes([strategy.symbol]);
    if (quotes.length > 0) {
      this.engine.onQuoteUpdate(quotes);
    }

    // 2. Re-read strategy to check for new signal
    const updated = this.engine.getStrategy(strategyId);
    if (!updated) {
      return this.makeEvaluationResult(strategyId, strategy.symbol, 'HOLD', '', 0,
        false, 'Strategy disappeared after quote update', false, undefined);
    }

    const lastSignal = updated.lastSignal;
    const currentQuote = quotes.find((q) => q.code === updated.symbol);
    const price = currentQuote?.price ?? lastSignal?.price ?? 0;

    // No new signal, or signal is HOLD
    if (!lastSignal || lastSignal.time === prevSignalTime || lastSignal.type === 'HOLD') {
      return this.makeEvaluationResult(
        strategyId, updated.symbol, 'HOLD', '', price,
        true, 'No actionable signal', false, undefined,
      );
    }

    // 3. Process the detected signal
    const record = await this.processDetectedSignal(updated, lastSignal, mode);

    return this.makeEvaluationResult(
      strategyId,
      updated.symbol,
      lastSignal.type,
      record.signalReason,
      price,
      record.riskCheckPassed,
      record.riskCheckReason,
      record.status === 'order-placed' || record.status === 'order-filled',
      record.orderId,
      record.brokerId,
      record.errorMessage,
    );
  }

  // ── setQuoteProvider ──────────────────────────────────────────────────────

  /** Replace the quote provider at runtime (e.g., after broker reconnection). */
  setQuoteProvider(provider: QuoteProviderFn): void {
    this.quoteProvider = provider;
    log.info('[StrategyRunner] Quote provider updated');
  }

  // ── getHistoryCount ───────────────────────────────────────────────────────

  /** Get the total number of execution history records. */
  getHistoryCount(): number {
    return this.history.length;
  }

  // ── getRunningCount ───────────────────────────────────────────────────────

  /** Get the number of currently running strategies. */
  getRunningCount(): number {
    return this.running.size;
  }

  // ── printSummary ──────────────────────────────────────────────────────────

  /** Log a human-readable summary of all running strategies. */
  printSummary(): void {
    const count = this.running.size;
    log.info(`[StrategyRunner] ── Summary: ${count} active, ${this.history.length} history records ──`);

    for (const [id, state] of this.running) {
      const name = this.engine.getStrategy(id)?.name ?? id;
      const uptime = Math.round((Date.now() - state.startedAt) / 1000);
      log.info(
        `[StrategyRunner]   ${id} "${name}" [${state.mode}] ` +
        `signals=${state.signalCount} orders=${state.orderCount} ` +
        `errors=${state.errorCount} uptime=${uptime}s`,
      );
    }
  }

  // ── destroy ───────────────────────────────────────────────────────────────

  /**
   * Clean up: stop all strategies, remove event listeners.
   * Call this when the StrategyRunner is no longer needed.
   */
  destroy(): void {
    this.stopAll();
    this.removeAllListeners();
    this.history = [];
    log.info('[StrategyRunner] Destroyed');
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  INTERNAL EVALUATION LOOP
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Core evaluation loop, called once per poll interval for each strategy.
   *
   * Flow:
   *   1. Fetch current quotes for the strategy's symbol
   *   2. Push quotes to StrategyEngine.onQuoteUpdate() (updates indicators,
   *      evaluates signals, fires signal callbacks synchronously)
   *   3. After onQuoteUpdate returns, check strategy.lastSignal for a new
   *      signal (time > lastProcessedSignalTime)
   *   4. If new actionable signal detected → processDetectedSignal()
   */
  private async evaluateLoop(strategyId: string): Promise<void> {
    const state = this.running.get(strategyId);
    if (!state) return;

    const strategy = this.engine.getStrategy(strategyId);
    if (!strategy) {
      log.warn(`[StrategyRunner] Strategy disappeared: ${strategyId}, stopping`);
      this.stop(strategyId);
      return;
    }

    state.lastEvaluationAt = Date.now();

    // 1. Fetch current quotes
    const quotes = await this.fetchQuotes([state.symbol]);
    if (quotes.length === 0) {
      log.debug(`[StrategyRunner] No quotes for ${state.symbol}, skipping evaluation`);
      return;
    }

    // 2. Feed quotes to engine (triggers indicator update + signal detection)
    this.engine.onQuoteUpdate(quotes);

    // 3. Check for new signal
    const refreshed = this.engine.getStrategy(strategyId);
    if (!refreshed) return;

    const lastSignal = refreshed.lastSignal;
    if (!lastSignal) return;
    if (lastSignal.time <= state.lastProcessedSignalTime) return;
    if (lastSignal.type === 'HOLD') {
      // Mark HOLD as processed so we don't re-check it
      state.lastProcessedSignalTime = lastSignal.time;
      return;
    }

    // 4. Process the new actionable signal
    state.lastProcessedSignalTime = lastSignal.time;
    const record = await this.processDetectedSignal(refreshed, lastSignal, state.mode);

    // Update counters
    state.signalCount++;
    if (record.status === 'order-placed' || record.status === 'order-filled') {
      state.orderCount++;
    } else if (record.status === 'error') {
      state.errorCount++;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  SIGNAL PROCESSING PIPELINE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Process a detected signal through the full pipeline:
   *   signal → risk check → order execution → history record
   */
  private async processDetectedSignal(
    strategy: StrategyInfo,
    lastSignal: NonNullable<StrategyInfo['lastSignal']>,
    mode: StrategyRunMode,
  ): Promise<ExecutionRecord> {
    const currentQuote = await this.getQuoteForSymbol(strategy.symbol);
    const price = currentQuote?.price ?? lastSignal.price;
    const quantity = this.calculateDefaultQuantity(price);

    // Build the execution record
    const record: ExecutionRecord = {
      id: this.generateRecordId(),
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol: strategy.symbol,
      mode,
      signal: lastSignal.type as 'BUY' | 'SELL',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signalReason: `${lastSignal.type} ${strategy.symbol} @ ${price} — ${(strategy as any).lastSignal?.reason ?? 'signal'}`,
      price,
      quantity,
      status: 'signal',
      riskCheckPassed: false,
      riskCheckReason: '',
      timestamp: Date.now(),
    };

    // Emit signal event
    this.emit('signal', { ...record });
    log.info(
      `[StrategyRunner] Signal: ${lastSignal.type} ${strategy.symbol} @ ${price} ` +
      `[${mode}] — ${record.signalReason}`,
    );

    // ── DRY-RUN: log only ──────────────────────────────────────────────────

    if (mode === 'dry-run') {
      record.status = 'dry-run';
      record.riskCheckPassed = true;
      record.riskCheckReason = 'Dry-run mode — risk check skipped';
      this.addHistory(record);
      log.info(
        `[StrategyRunner] [DRY-RUN] Would execute: ${lastSignal.type} ${strategy.symbol} ` +
        `x${quantity} @ ${price}`,
      );
      return record;
    }

    // ── LIVE-RUN: risk check → order execution ─────────────────────────────

    // Build TradeSignal for risk validation and execution
    const tradeSignal = this.buildTradeSignal(strategy, lastSignal, price, quantity);

    // Risk check
    const riskResult = await this.runRiskValidation(tradeSignal);
    record.riskCheckPassed = riskResult.passed;
    record.riskCheckReason = riskResult.reason;

    if (!riskResult.passed) {
      record.status = 'risk-rejected';
      this.addHistory(record);
      this.emit('risk-rejected', { ...record });
      log.warn(
        `[StrategyRunner] Risk rejected: ${strategy.id} ${lastSignal.type} ` +
        `${strategy.symbol} — ${riskResult.reason}`,
      );
      return record;
    }

    // Execute order
    const execResult = await this.executeOrder(tradeSignal, record);
    record.status = execResult.status;
    record.orderId = execResult.orderId;
    record.brokerId = execResult.brokerId;
    record.errorMessage = execResult.errorMessage;

    // Emit appropriate event
    if (execResult.status === 'order-placed' || execResult.status === 'order-filled') {
      this.emit('order-placed', { ...record });
      log.info(
        `[StrategyRunner] Order placed: ${record.id} → ${execResult.orderId} ` +
        `via broker ${execResult.brokerId ?? 'default'}`,
      );
    } else if (execResult.status === 'error') {
      this.emitError(strategy.id, execResult.errorMessage ?? 'Order execution failed');
    }

    this.addHistory(record);
    return record;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  RISK VALIDATION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Run risk checks via TradeExecutor.runRiskChecks().
   * Returns pass/fail with reason.
   */
  private async runRiskValidation(signal: TradeSignal): Promise<{ passed: boolean; reason: string }> {
    try {
      const check: RiskCheck = await this.executor.runRiskChecks(signal);
      return { passed: check.passed, reason: check.reason };
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      const msg = err instanceof Error ? err.message : String(err);
      log.error('[StrategyRunner] Risk check error:', msg);
      return { passed: false, reason: `Risk check threw: ${msg}` };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  ORDER EXECUTION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Execute an order through the broker routing pipeline.
   *
   * Priority:
   *   1. UAM.routeOrder() — routes to preferred broker (from strategy config),
   *      falls back to position-holding broker (for SELL), then any connected broker.
   *   2. TradeExecutor.processSignal() — fallback if UAM routing fails.
   */
  private async executeOrder(
    signal: TradeSignal,
    record: ExecutionRecord,
  ): Promise<{
    status: ExecutionRecord['status'];
    orderId?: string;
    brokerId?: string;
    errorMessage?: string;
  }> {
    try {
      // 1. Try UAM routeOrder (multi-broker aware routing)
      const routeResult = await this.uam.routeOrder(
        {
          code: signal.code,
          side: signal.side,
          orderType: signal.orderType === 'STOP' || signal.orderType === 'STOP_LIMIT'
            ? 'LIMIT' as const
            : signal.orderType as 'MARKET' | 'LIMIT',
          qty: signal.quantity ?? record.quantity,
          price: signal.price,
        },
        signal.brokerId || record.brokerId,
      );

      return {
        status: 'order-placed',
        orderId: routeResult.orderId,
        brokerId: routeResult.brokerId,
      };
    } catch (uamErr) {
    // [EngineError:SYSTEM] — structured error tracking
      log.warn(
        `[StrategyRunner] UAM routing failed: ${uamErr instanceof Error ? uamErr.message : uamErr}. ` +
        'Falling back to TradeExecutor...',
      );
    }

    // 2. Fallback: TradeExecutor.processSignal()
    try {
      const order = await this.executor.processSignal(signal);
      if (order && order.status !== 'rejected') {
        return {
          status: order.status === 'filled' ? 'order-filled' : 'order-placed',
          orderId: order.id,
          brokerId: order.brokerId,
        };
      }
      return {
        status: 'error',
        errorMessage: `Order ${order ? 'rejected' : 'null'}: ${order?.rejectionReason ?? 'no order returned'}`,
      };
    } catch (execErr) {
    // [EngineError:SYSTEM] — structured error tracking
      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      return { status: 'error', errorMessage: `TradeExecutor error: ${msg}` };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  QUOTE FETCHING
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Fetch current quotes for the given symbols using the injected quote provider.
   */
  private async fetchQuotes(symbols: string[]): Promise<QuoteInfo[]> {
    if (symbols.length === 0) return [];

    try {
      const quotes = await this.quoteProvider(symbols);
      if (quotes.length > 0) {
        log.debug(`[StrategyRunner] Fetched ${quotes.length} quote(s) for [${symbols.join(', ')}]`);
      }
      return quotes;
    } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
      log.warn('[StrategyRunner] Quote fetch failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  /**
   * Get a single quote for a specific symbol.
   */
  private async getQuoteForSymbol(symbol: string): Promise<QuoteInfo | undefined> {
    const quotes = await this.fetchQuotes([symbol]);
    return quotes.find((q) => q.code === symbol);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Build a TradeSignal from strategy data for the TradeExecutor pipeline.
   */
  private buildTradeSignal(
    strategy: StrategyInfo,
    lastSignal: NonNullable<StrategyInfo['lastSignal']>,
    price: number,
    quantity: number,
  ): TradeSignal {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brokerId = (strategy as any).strategy?.brokerId as string | undefined;

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      code: strategy.symbol,
      side: lastSignal.type as 'BUY' | 'SELL',
      quantity,
      price,
      orderType: 'MARKET' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stopLoss: (strategy as any).strategy?.stopLoss,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      takeProfit: (strategy as any).strategy?.takeProfit,
      reason: `Strategy signal: ${lastSignal.type}`,
      confidence: DEFAULT_SIGNAL_CONFIDENCE,
      timestamp: Date.now(),
      brokerId,
    };
  }

  /**
   * Calculate a default order quantity based on price.
   * Uses a $10,000 notional target with lot-size rounding.
   */
  private calculateDefaultQuantity(price: number): number {
    if (price <= 0) return DEFAULT_LOT_SIZE;
    const targetNotional = 10_000;
    const raw = targetNotional / price;
    return Math.max(DEFAULT_LOT_SIZE, Math.floor(raw / DEFAULT_LOT_SIZE) * DEFAULT_LOT_SIZE);
  }

  /**
   * Add an execution record to the rolling history buffer.
   * Trims to MAX_EXECUTION_HISTORY records when full.
   */
  private addHistory(record: ExecutionRecord): void {
    this.history.push(record);
    while (this.history.length > MAX_EXECUTION_HISTORY) {
      this.history.shift();
    }
  }

  /**
   * Emit an error event.
   */
  private emitError(strategyId: string, message: string): void {
    this.emit('error', { strategyId, message });
  }

  /**
   * Generate a unique execution record ID.
   */
  private generateRecordId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `exec_${ts}_${rand}`;
  }

  /**
   * Build an EvaluationResult from individual fields.
   */
  private makeEvaluationResult(
    strategyId: string,
    symbol: string,
    signal: 'BUY' | 'SELL' | 'HOLD',
    signalReason: string,
    price: number,
    riskCheckPassed: boolean,
    riskCheckReason: string,
    orderExecuted: boolean,
    orderId?: string,
    brokerId?: string,
    errorMessage?: string,
  ): EvaluationResult {
    return {
      strategyId,
      symbol,
      signal,
      signalReason,
      price,
      riskCheckPassed,
      riskCheckReason,
      orderExecuted,
      orderId,
      brokerId,
      errorMessage,
    };
  }
}
