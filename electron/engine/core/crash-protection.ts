// ── J-76-03 R76 VFINAL: ErrorBoundary + Crash Protection ──────────────────
// Global error boundary + crash auto-restart + state recovery
// v1.8.0 GA: production-grade resilience

import { EventEmitter } from "events";
import log from 'electron-log';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CrashReport {
  id: string;
  timestamp: number;
  error: string;
  stack: string;
  componentStack: string | null;
  userAction: string | null;
  platform: string;
  appVersion: string;
  recovered: boolean;
}

export interface ErrorBoundaryConfig {
  maxCrashCount: number;       // crash per window before force quit
  windowMs: number;            // sliding window for crash counting
  autoRestart: boolean;
  recoveryTimeoutMs: number;   // how long to wait before declaring recovery
  saveStateIntervalMs: number; // how often to save UI state for recovery
  reportUrl: string | null;    // optional crash reporting endpoint
  silent: boolean;
}

export interface RecoverableState {
  route: string;
  panels: Array<{ id: string; open: boolean; position: { x: number; y: number } }>;
  settings: Record<string, unknown>;
  activeSymbol: string | null;
  lastInteraction: number;
}

const DEFAULT_CONFIG: ErrorBoundaryConfig = {
  maxCrashCount: 3,
  windowMs: 60_000,
  autoRestart: true,
  recoveryTimeoutMs: 5000,
  saveStateIntervalMs: 30000,
  reportUrl: null,
  silent: false,
};

// ── Error Boundary Engine ─────────────────────────────────────────────────

export class ErrorBoundaryEngine extends EventEmitter {
  private config: ErrorBoundaryConfig;
  private crashHistory: Array<{ time: number }> = [];
  private currentState: Partial<RecoverableState> = {};
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private crashes: CrashReport[] = [];
  private isRecovering = false;

  constructor(config?: Partial<ErrorBoundaryConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startAutoSave();
  }

  // ── Error Handling ────────────────────────────────────────────────────

  /** Called by React ErrorBoundary componentDidCatch */
  handleError(error: Error, componentStack: string | null, userAction?: string): CrashReport {
    const report: CrashReport = {
      id: `crash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack ?? "",
      componentStack,
      userAction: userAction ?? null,
      platform: process.platform,
      appVersion: process.env.npm_package_version ?? "1.8.0",
      recovered: false,
    };

    this.crashes.push(report);
    this.crashHistory.push({ time: Date.now() });

    // Prune old crashes
    const cutoff = Date.now() - this.config.windowMs;
    this.crashHistory = this.crashHistory.filter((c) => c.time > cutoff);

    // Limit stored crashes
    if (this.crashes.length > 50) {
      this.crashes = this.crashes.slice(-50);
    }

    // Emit for UI
    this.emit("crash", report);

    // Log
    if (!this.config.silent) {
      log.error(`[CrashProtection] Error captured:`, error.message);
      if (componentStack) log.error(`[CrashProtection] Component:`, componentStack);
    }

    // Check crash storm
    if (this.crashHistory.length >= this.config.maxCrashCount) {
      this.emit("crash-storm", { count: this.crashHistory.length, windowMs: this.config.windowMs });
      log.error(`[CrashProtection] Crash storm detected: ${this.crashHistory.length} crashes in ${this.config.windowMs}ms`);
    }

    // Send to crash reporting if configured
    if (this.config.reportUrl) {
      this.sendCrashReport(report).catch(() => {
        // Silent fail — don't crash the crash reporter
      });
    }

    return report;
  }

  /** Attempt recovery after a crash */
  async attemptRecovery(): Promise<{ success: boolean; state: Partial<RecoverableState> | null }> {
    if (!this.config.autoRestart) {
      return { success: false, state: null };
    }

    this.isRecovering = true;
    this.emit("recovery-started");

    return new Promise((resolve) => {
      this.recoveryTimer = setTimeout(() => {
        this.isRecovering = false;
        if (this.currentState.route) {
          this.emit("recovery-complete", { state: this.currentState });
          resolve({ success: true, state: this.currentState });
        } else {
          this.emit("recovery-failed");
          resolve({ success: false, state: null });
        }
      }, this.config.recoveryTimeoutMs);
    });
  }

  // ── State Persistence ─────────────────────────────────────────────────

  /** Save current UI state for crash recovery */
  saveState(state: Partial<RecoverableState>): void {
    this.currentState = {
      ...this.currentState,
      ...state,
      lastInteraction: Date.now(),
    };
  }

  /** Get last saved state */
  getLastState(): Partial<RecoverableState> | null {
    if (Object.keys(this.currentState).length === 0) return null;
    return { ...this.currentState };
  }

  /** Clear saved state (e.g., after successful recovery) */
  clearState(): void {
    this.currentState = {};
  }

  // ── Crash Reports ─────────────────────────────────────────────────────

  getCrashHistory(): CrashReport[] {
    return [...this.crashes];
  }

  getCrashCount(windowMs?: number): number {
    if (!windowMs) return this.crashes.length;
    const cutoff = Date.now() - windowMs;
    return this.crashes.filter((c) => c.timestamp > cutoff).length;
  }

  /** Mark a crash as recovered */
  markRecovered(crashId: string): void {
    const report = this.crashes.find((c) => c.id === crashId);
    if (report) report.recovered = true;
  }

  // ── Safe Wrappers ─────────────────────────────────────────────────────

  /**
   * Wrap a potentially-throwing function with try/catch.
   * Returns { success, data, error }
   */
  static safeCall<T>(fn: () => T): { success: true; data: T; error: null } | { success: false; data: null; error: string } {
    try {
      return { success: true, data: fn(), error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: e?.message ?? "Unknown error" };
    }
  }

  /** Wrap an async function with try/catch + timeout */
  static async safeAsync<T>(fn: () => Promise<T>, timeoutMs = 10000): Promise<{ success: true; data: T; error: null } | { success: false; data: null; error: string }> {
    try {
      const data = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: e?.message ?? "Unknown error" };
    }
  }

  // ── Engine Wrappers ───────────────────────────────────────────────────

  /**
   * Safely execute an engine/agent call with boundary protection.
   * If it throws, log + return safe default, never propagate.
   */
  static async safeEngine<T>(
    engineName: string,
    fn: () => Promise<T>,
    fallback: T,
    timeoutMs = 15000,
  ): Promise<{ data: T; error: string | null; recovered: boolean }> {
    const result = await ErrorBoundaryEngine.safeAsync(fn, timeoutMs);
    if (result.success) {
      return { data: result.data, error: null, recovered: false };
    }
    log.error(`[SafeEngine] ${engineName} failed:`, result.error);
    return { data: fallback, error: result.error, recovered: true };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private startAutoSave(): void {
    this.saveTimer = setInterval(() => {
      this.emit("auto-save", { state: this.currentState, time: Date.now() });
    }, this.config.saveStateIntervalMs);
  }

  private async sendCrashReport(report: CrashReport): Promise<void> {
    if (!this.config.reportUrl) return;
    try {
      await fetch(this.config.reportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
    } catch {
      // Crash reporting failure should not propagate
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  isRecoveringNow(): boolean {
    return this.isRecovering;
  }

  updateConfig(cfg: Partial<ErrorBoundaryConfig>): void {
    this.config = { ...this.config, ...cfg };
  }

  getConfig(): ErrorBoundaryConfig {
    return { ...this.config };
  }

  destroy(): void {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.removeAllListeners();
  }
}

// ── React ErrorBoundary Component Template ────────────────────────────────

/**
 * USAGE (React):
 *
 * <CrashBoundary engine={crashEngine} fallback={<CrashFallback />}>
 *   <App />
 * </CrashBoundary>
 */

export interface CrashBoundaryConfig {
  engine: ErrorBoundaryEngine;
  fallbackComponent: string;  // component name to render on crash
  onRecovered?: () => void;
}

// ── Engine-level safe wrappers (10+ locations) ────────────────────────────

/** Array of engine names that have been hardened */
export const HARDENED_ENGINES = [
  "FundamentalsAgent",
  "TechnicalAgent",
  "SentimentAgent",
  "MacroAgent",
  "MultiLLMRouter",
  "AIDrawingEngine",
  "AIPatternRecognitionEngine",
  "ParameterSmartEngine",
  "RealDataOrchestrator",
  "MultiMarketQuoteEngine",
  "FactorCompatibilityEngine",
  "TemplateCompatibilityEngine",
];

// ── Factory ──────────────────────────────────────────────────────────────

let _instance: ErrorBoundaryEngine | null = null;

export function getErrorBoundaryEngine(config?: Partial<ErrorBoundaryConfig>): ErrorBoundaryEngine {
  if (!_instance) _instance = new ErrorBoundaryEngine(config);
  return _instance;
}

export function resetErrorBoundaryEngine(): void {
  _instance?.destroy();
  _instance = null;
}

export default ErrorBoundaryEngine;
