<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: JVS
purpose: (auto-generated, needs review)
-->

# Engine Core API Reference

> TradingEasy — Core Engine Module Public API
> Generated: 2026-06-11 | Version: 1.10.0-alpha.1

---

## Overview

The `electron/engine/core/` directory contains the foundational infrastructure modules
that power all higher-level engines (agents, analysis, backtest, data, portfolio, risk).

All modules are re-exported via `electron/engine/core/index.ts` for unified import:

```typescript
import { EngineError, EngineRegistry, RateLimiter } from '../engine/core';
```

**Module Count**: 36 modules | **Total Lines**: ~50,000

---

## Module Reference

### 1. Error Handling

#### `engine-error.ts` (7.5 KB)

Structured error types replacing raw `throw new Error`.

```typescript
class EngineError extends Error {
  code: ErrorCode;
  domain: ErrorDomain;
  details?: Record<string, unknown>;
  timestamp: number;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>);

  // Static factories
  static brokerError(message: string, details?: object): EngineError;
  static strategyError(message: string, details?: object): EngineError;
  static riskError(message: string, details?: object): EngineError;
  static dataError(message: string, details?: object): EngineError;
  static ipcError(message: string, details?: object): EngineError;
}

enum ErrorDomain {
  BROKER = 'broker',
  STRATEGY = 'strategy',
  RISK = 'risk',
  DATA = 'data',
  IPC = 'ipc',
  SYSTEM = 'system',
  BILLING = 'billing',
  NETWORK = 'network',
}

enum ErrorCode {
  BROKER_CONNECT_FAILED = 'BROKER_CONNECT_FAILED',
  BROKER_TIMEOUT = 'BROKER_TIMEOUT',
  STRATEGY_INVALID = 'STRATEGY_INVALID',
  RISK_LIMIT_EXCEEDED = 'RISK_LIMIT_EXCEEDED',
  // ... 50+ codes
}
```

**Migration**: Replace `throw new Error(msg)` with `throw new EngineError(ErrorCode.XXX, msg)`.
See `docs/engine-error-guide.md` for full migration guide.

---

#### `error-handler.ts` (8.1 KB)

Global error handler with crash protection.

```typescript
class ErrorHandler {
  static init(): void;                           // Initialize global handlers
  static handle(err: Error | EngineError): void; // Process error
  static getHistory(): ErrorRecord[];            // Get recent errors
  static clear(): void;                          // Clear history
}
```

---

### 2. Engine Registry

#### `engine-registry.ts` (6.4 KB)

Central registry for all engine modules. Enables discovery and lifecycle management.

```typescript
class EngineRegistry {
  static register(name: string, engine: EngineModule): void;
  static get(name: string): EngineModule | undefined;
  static getAll(): Map<string, EngineModule>;
  static initAll(): Promise<void>;
  static shutdownAll(): Promise<void>;
  static healthCheck(): HealthReport;
}

interface EngineModule {
  name: string;
  version: string;
  init(): Promise<void>;
  shutdown(): Promise<void>;
  health(): ModuleHealth;
}
```

---

### 3. Condition System

#### `condition-engine.ts` (8.1 KB)

Rule-based condition evaluation engine.

```typescript
class ConditionEngine {
  evaluate(rule: ConditionRule): ConditionResult;
  evaluateBatch(rules: ConditionRule[]): ConditionResult[];
  validate(rule: ConditionRule): ValidationResult;
}

interface ConditionRule {
  id: string;
  type: 'price' | 'volume' | 'indicator' | 'custom';
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | string;
  symbol?: string;
}
```

#### `condition-watcher.ts` (12.1 KB)

Real-time condition monitoring with alert triggers.

```typescript
class ConditionWatcher {
  watch(rule: ConditionRule, callback: AlertCallback): WatchHandle;
  unwatch(handle: WatchHandle): void;
  getActiveWatches(): WatchHandle[];
  pause(handle: WatchHandle): void;
  resume(handle: WatchHandle): void;
}
```

#### `condition-trade-bridge.ts` (9.7 KB)

Bridges condition triggers to trade execution pipeline.

```typescript
class ConditionTradeBridge {
  constructor(config: BridgeConfig);
  trigger(signal: TradeSignal): Promise<ExecutionResult>;
  setThrottle(ms: number): void;
  getStats(): BridgeStats;
  pause(): void;
  resume(): void;
}
```

---

### 4. Scheduling

#### `cron-scheduler.ts` (10.1 KB)

Cron-based task scheduling.

```typescript
class CronScheduler {
  schedule(name: string, cron: string, task: () => Promise<void>): JobHandle;
  cancel(handle: JobHandle): void;
  list(): JobInfo[];
  pause(handle: JobHandle): void;
  resume(handle: JobHandle): void;
  nextRun(handle: JobHandle): Date;
}
```

#### `async-io-scheduler.ts` (26.5 KB)

Priority-based async I/O task scheduler with backpressure.

```typescript
class AsyncIOScheduler {
  constructor(config?: SchedulerConfig);
  submit<T>(task: () => Promise<T>, priority?: number): Promise<T>;
  getQueueSize(): number;
  getActiveCount(): number;
  setConcurrency(n: number): void;
  drain(): Promise<void>;
  shutdown(): Promise<void>;
}

interface SchedulerConfig {
  maxConcurrency: number;    // Default: 10
  maxQueueSize: number;      // Default: 1000
  timeoutMs: number;         // Default: 30000
  retryCount: number;        // Default: 3
}
```

---

### 5. Monitoring & Metrics

#### `monitoring-engine.ts` (13.2 KB)

System monitoring with configurable metrics collection.

```typescript
class MonitoringEngine {
  start(config?: MonitorConfig): void;
  stop(): void;
  getMetrics(): SystemMetrics;
  addCustomMetric(name: string, fn: () => number): void;
  onAlert(callback: AlertCallback): void;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  openDConnection: boolean;
  activeStrategies: number;
  ipcLatencyMs: number;
  engineHealth: Record<string, string>;
}
```

#### `prometheus-metrics.ts` (18.6 KB)

Prometheus-compatible metrics collection and exposition.

```typescript
class PrometheusMetrics {
  counter(name: string, help: string): Counter;
  gauge(name: string, help: string): Gauge;
  histogram(name: string, help: string, buckets?: number[]): Histogram;
  summary(name: string, help: string): Summary;
  serialize(): string;  // Prometheus text format
}
```

#### `smart-monitor.ts` (19.6 KB)

Intelligent monitoring with anomaly detection.

```typescript
class SmartMonitor {
  watch(key: string, valueFn: () => number): void;
  getAnomalies(): Anomaly[];
  setThreshold(key: string, min: number, max: number): void;
  getReport(): MonitorReport;
}
```

---

### 6. Security

#### `security-engine.ts` (11.4 KB)

Security policy enforcement.

```typescript
class SecurityEngine {
  validateInput(channel: string, data: unknown): ValidationResult;
  sanitizeUrl(url: string): string;
  checkRateLimit(channel: string): boolean;
  auditLog(action: string, details: object): void;
}
```

#### `security-guard.ts` (5.3 KB)

Guard against common attack vectors.

```typescript
class SecurityGuard {
  static sanitizeHtml(input: string): string;
  static validateExternalUrl(url: string): boolean;
  static checkXss(input: string): boolean;
  static enforceMaxLength(input: string, max: number): string;
}
```

#### `sandbox-exec.ts` (4.9 KB)

Sandboxed code execution for user-defined strategies.

```typescript
class SandboxExec {
  run(code: string, context: SandboxContext): SandboxResult;
  validate(code: string): ValidationResult;
  setTimeout(ms: number): void;
}
```

---

### 7. Rate Limiting

#### `rate-limiter.ts` (11.5 KB)

Token-bucket rate limiter for IPC channels.

```typescript
class RateLimiter {
  constructor(config?: RateLimitConfig);
  allow(key: string): boolean;
  wait(key: string): Promise<void>;
  reset(key: string): void;
  getStats(): RateLimitStats;
}

interface RateLimitConfig {
  maxTokens: number;       // Bucket size
  refillRate: number;      // Tokens per second
  refillInterval: number;  // Refill interval in ms
}
```

---

### 8. Caching

#### `smart-cache.ts` (10.0 KB)

Multi-layer cache with TTL and LRU eviction.

```typescript
class SmartCache<T> {
  constructor(config?: CacheConfig);
  get(key: string): T | undefined;
  set(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
  getStats(): CacheStats;
  has(key: string): boolean;
  keys(): string[];
}

interface CacheConfig {
  maxSize: number;      // Default: 1000
  defaultTtl: number;   // Default: 60000 (1 min)
  evictionPolicy: 'lru' | 'fifo';
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;       // 0-1
  size: number;
  evictions: number;
}
```

---

### 9. i18n Engine

#### `i18n-engine.ts` (19.2 KB)

Internationalization engine with 11 locale support.

```typescript
class I18nEngine {
  constructor(defaultLocale?: string);
  t(key: string, params?: Record<string, string>): string;
  setLocale(locale: string): void;
  getLocale(): string;
  getSupportedLocales(): string[];
  addTranslations(locale: string, translations: Record<string, string>): void;
  getMissingKeys(locale: string): string[];
}
```

**Supported Locales**: zh-CN, en, zh-HK, zh-TW, ja, ko, fr, de, it, es, ru

#### `i18n-data.ts` (13.2 KB)

Translation data storage and loading.

#### `i18n-data-pipeline.ts` (9.8 KB)

Translation sync pipeline (source → all locales).

---

### 10. Notification

#### `notification-engine.ts` (12.6 KB)

Multi-channel notification system.

```typescript
class NotificationEngine {
  send(notification: Notification): Promise<void>;
  getHistory(): Notification[];
  markRead(id: string): void;
  subscribe(channel: string, callback: NotificationCallback): Unsubscribe;
  clear(): void;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  channel?: string;
  timestamp: number;
  read?: boolean;
}
```

---

### 11. Infrastructure

#### `cloud-opend-fragment.ts` (10.8 KB)

Cloud-hosted OpenD connection management.

```typescript
class CloudOpenDManager {
  connect(config: CloudOpenDConfig): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): CloudOpenDStatus;
  getFragmentation(): FragmentInfo;
}
```

#### `crash-protection.ts` (11.2 KB)

Process crash protection and recovery.

```typescript
class CrashProtection {
  enable(): void;
  disable(): void;
  onCrash(callback: CrashCallback): void;
  getRecoveryState(): RecoveryState;
  forceCheckpoint(): void;
}
```

#### `version-control-service.ts` (14.0 KB)

Strategy version management (create/compare/rollback).

```typescript
class VersionControlService {
  createVersion(strategyId: string): Version;
  listVersions(strategyId: string): Version[];
  rollback(strategyId: string, versionId: string): Promise<void>;
  diff(v1: Version, v2: Version): VersionDiff;
}
```

#### `server-deployment.ts` (12.1 KB)

Server deployment configuration and management.

#### `platform-packaging.ts` (11.0 KB)

Cross-platform packaging (Windows/macOS/Linux).

#### `desktop-cleanup.ts` (9.0 KB)

Desktop environment cleanup utilities.

#### `launch-checklist.ts` (8.7 KB)

Pre-launch validation checklist.

#### `deployment-docs.ts` (6.3 KB)

Deployment documentation generator.

#### `emi-unified.ts` (14.2 KB)

Unified EMI (External Module Interface) framework.

#### `engine-stability.ts` (6.4 KB)

Engine stability monitoring and circuit breaker.

#### `stability-hardening.ts` (15.4 KB)

System stability hardening (retry, timeout, circuit breaker patterns).

#### `benchmark.ts` (4.0 KB)

Performance benchmarking utilities.

#### `alert-engine.ts` (2.8 KB)

Alert generation and routing.

#### `constants.ts` (4.1 KB)

Global constants and configuration values.

#### `typescript-strict-utilities.ts` (11.3 KB)

Type-safe utility functions for TypeScript strict mode.

#### `monitoring.ts` (6.1 KB)

Low-level monitoring primitives.

---

## Module Dependency Graph

```
engine-error ──── error-handler ──── crash-protection
     │                                    │
     ▼                                    ▼
engine-registry ──── engine-stability ── stability-hardening
     │
     ├── rate-limiter
     ├── smart-cache
     ├── cron-scheduler ──── async-io-scheduler
     ├── condition-engine ── condition-watcher ── condition-trade-bridge
     ├── monitoring-engine ── smart-monitor ── prometheus-metrics
     ├── security-engine ── security-guard ── sandbox-exec
     ├── notification-engine
     └── i18n-engine ── i18n-data ── i18n-data-pipeline
```

---

## Usage Patterns

### Creating a new engine module

```typescript
import { EngineModule, EngineRegistry, EngineError, ErrorCode } from '../core';

class MyEngine implements EngineModule {
  name = 'my-engine';
  version = '1.0.0';

  async init(): Promise<void> {
    // Initialize resources
  }

  async shutdown(): Promise<void> {
    // Cleanup resources
  }

  health(): ModuleHealth {
    return { status: 'healthy', uptime: process.uptime() };
  }

  doWork(input: string): Result {
    if (!input) {
      throw new EngineError(
        ErrorCode.STRATEGY_INVALID,
        'Input required',
        { received: input }
      );
    }
    // Business logic
    return { success: true };
  }
}

// Register
EngineRegistry.register('my-engine', new MyEngine());
```

### Using SmartCache

```typescript
import { SmartCache } from '../core';

const quoteCache = new SmartCache<Quote>({
  maxSize: 500,
  defaultTtl: 5000,  // 5 seconds
  evictionPolicy: 'lru',
});

async function getQuote(code: string): Promise<Quote> {
  const cached = quoteCache.get(code);
  if (cached) return cached;

  const quote = await fetchQuote(code);
  quoteCache.set(code, quote);
  return quote;
}
```

### Using RateLimiter

```typescript
import { RateLimiter } from '../core';

const limiter = new RateLimiter({
  maxTokens: 10,
  refillRate: 5,
  refillInterval: 1000,
});

async function handleRequest(channel: string) {
  if (!limiter.allow(channel)) {
    await limiter.wait(channel);  // Wait for token
  }
  // Process request
}
```
