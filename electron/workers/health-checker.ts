// T57: IPC Health Check + Circuit Breaker
import { ipcMain, ipcRenderer } from 'electron';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';


export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
  lastChecked: number;
}

export interface HealthReport {
  overall: HealthStatus;
  components: ComponentHealth[];
  uptime: number;
  timestamp: number;
}

export class HealthChecker {
  private components = new Map<string, () => Promise<{ status: HealthStatus; latencyMs: number; error?: string }>>();
  private startTime = Date.now();

  register(name: string, checker: () => Promise<{ status: HealthStatus; latencyMs: number; error?: string }>): void {
    this.components.set(name, checker);
  }

  unregister(name: string): void {
    this.components.delete(name);
  }

  async check(): Promise<HealthReport> {
    const components: ComponentHealth[] = [];
    const results = await Promise.allSettled(
      Array.from(this.components.entries()).map(async ([name, fn]) => {
        try {
          const r = await fn();
          components.push({ name, ...r, lastChecked: Date.now() });
        } catch (e) {
          components.push({
            name,
            status: 'unhealthy',
            error: e.message,
            lastChecked: Date.now(),
          });
        }
      })
    );

    const overall: HealthStatus = components.some(c => c.status === 'unhealthy') ? 'unhealthy'
      : components.some(c => c.status === 'degraded') ? 'degraded'
      : 'healthy';

    return { overall, components, uptime: Date.now() - this.startTime, timestamp: Date.now() };
  }
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold = 5,
    private resetTimeoutMs = 30000,
    private halfOpenMax = 3
  ) {}

  getState(): 'closed' | 'open' | 'half-open' {
    if (this.state === 'open' && Date.now() - this.lastFailure > this.resetTimeoutMs) {
      this.state = 'half-open';
      this.failures = 0;
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, 'Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (e) {
      this._onFailure();
      throw e;
    }
  }

  private _onSuccess(): void {
    if (this.state === 'half-open') {
      this.failures = 0;
      this.state = 'closed';
    }
  }

  private _onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
  }
}

export const appHealth = new HealthChecker();
export const openDCircuitBreaker = new CircuitBreaker(5, 30000);
