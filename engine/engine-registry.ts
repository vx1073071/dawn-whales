/**
 * EngineRegistry - Global singleton registry for managing all engine instances
 * 
 * Solves circular dependency issues:
 * - ConditionEngine ↔ TradeExecutor ↔ RiskEngine
 * - Provides getEngine(name) interface for dynamic access
 * - Centralized lifecycle management (init/start/stop/destroy)
 */

import { EventEmitter } from 'events';
import { ConditionEngine } from './condition-engine';
import { TradeExecutor, TradingConfig } from './trade-executor';
import { RiskEngine, RiskConfig } from './risk-engine';
import { ClosedLoopExecutor, ClosedLoopConfig } from './closed-loop-executor';
import { RebalanceEngine, RebalanceConfig } from './rebalance-engine';
import { PositionMonitor, PositionConfig } from './position-monitor';
import { PerformanceTracker, PerformanceConfig } from './performance-tracker';
import { ConditionTradeBridge, BridgeConfig } from './condition-trade-bridge';

// Engine types
export type EngineName = 
  | 'condition'
  | 'trade'
  | 'risk'
  | 'closedLoop'
  | 'rebalance'
  | 'position'
  | 'performance'
  | 'bridge';

export interface EngineInstance {
  name: EngineName;
  instance: any;
  config: any;
  status: 'initialized' | 'starting' | 'running' | 'stopped' | 'error';
  dependencies: EngineName[];
  initializedAt?: number;
  startedAt?: number;
  error?: Error;
}

export interface RegistryConfig {
  enableAutoStart: boolean;
  enableHealthCheck: boolean;
  healthCheckIntervalMs: number;
  maxInitRetries: number;
  initRetryDelayMs: number;
}

export class EngineRegistry extends EventEmitter {
  private static instance: EngineRegistry | null = null;
  
  private engines: Map<EngineName, EngineInstance> = new Map();
  private config: RegistryConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private isInitializing: boolean = false;
  private isShuttingDown: boolean = false;

  private constructor(config: Partial<RegistryConfig> = {}) {
    super();
    
    this.config = {
      enableAutoStart: true,
      enableHealthCheck: true,
      healthCheckIntervalMs: 30000, // 30 seconds
      maxInitRetries: 3,
      initRetryDelayMs: 1000,
      ...config
    };
  }

  // Singleton pattern
  public static getInstance(config?: Partial<RegistryConfig>): EngineRegistry {
    if (!EngineRegistry.instance) {
      EngineRegistry.instance = new EngineRegistry(config);
    }
    return EngineRegistry.instance;
  }

  public static resetInstance(): void {
    if (EngineRegistry.instance) {
      EngineRegistry.instance.destroy();
      EngineRegistry.instance = null;
    }
  }

  // Register an engine
  public register<T>(
    name: EngineName,
    engineInstance: T,
    config: any,
    dependencies: EngineName[] = []
  ): void {
    if (this.engines.has(name)) {
      this.emit('warning', {
        message: `Engine ${name} already registered. Overwriting.`,
        previous: this.engines.get(name)
      });
    }

    const engineRecord: EngineInstance = {
      name,
      instance: engineInstance,
      config,
      status: 'initialized',
      dependencies,
      initializedAt: Date.now()
    };

    this.engines.set(name, engineRecord);
    
    this.emit('engineRegistered', {
      name,
      dependencies,
      timestamp: Date.now()
    });
  }

  // Get engine by name
  public getEngine<T = any>(name: EngineName): T | undefined {
    const record = this.engines.get(name);
    if (!record) {
      this.emit('engineNotFound', { name });
      return undefined;
    }
    return record.instance as T;
  }

  // Get engine status
  public getEngineStatus(name: EngineName): EngineInstance | undefined {
    return this.engines.get(name);
  }

  // Get all engines
  public getAllEngines(): EngineInstance[] {
    return Array.from(this.engines.values());
  }

  // Check if engine is registered
  public hasEngine(name: EngineName): boolean {
    return this.engines.has(name);
  }

  // Initialize all engines (respecting dependencies)
  public async initializeAll(): Promise<void> {
    if (this.isInitializing) {
      throw new Error('Initialization already in progress');
    }

    this.isInitializing = true;
    this.emit('initializationStarted', {
      timestamp: Date.now(),
      engineCount: this.engines.size
    });

    try {
      // Topological sort based on dependencies
      const sortedEngines = this.topologicalSort();
      
      // Initialize in order
      for (const engineName of sortedEngines) {
        await this.initializeEngine(engineName);
      }

      this.emit('initializationCompleted', {
        timestamp: Date.now(),
        engines: sortedEngines
      });
    } catch (error) {
      this.emit('initializationFailed', {
        error,
        timestamp: Date.now()
      });
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  // Initialize single engine
  private async initializeEngine(name: EngineName, retryCount: number = 0): Promise<void> {
    const record = this.engines.get(name);
    if (!record) {
      throw new Error(`Engine ${name} not registered`);
    }

    // Check dependencies
    for (const dep of record.dependencies) {
      const depRecord = this.engines.get(dep);
      if (!depRecord || depRecord.status === 'error') {
        throw new Error(`Dependency ${dep} for engine ${name} not ready`);
      }
    }

    // Skip if already initialized
    if (record.status === 'initialized' && record.instance) {
      this.emit('engineAlreadyInitialized', { name });
      return;
    }

    try {
      record.status = 'starting';
      this.emit('engineInitializing', { name, attempt: retryCount + 1 });

      // Call initialize method if it exists
      if (typeof record.instance.initialize === 'function') {
        await record.instance.initialize();
      }

      record.status = 'initialized';
      this.emit('engineInitialized', { name, timestamp: Date.now() });
    } catch (error) {
      record.status = 'error';
      record.error = error as Error;

      if (retryCount < this.config.maxInitRetries) {
        this.emit('engineInitRetry', {
          name,
          attempt: retryCount + 1,
          maxRetries: this.config.maxInitRetries,
          error
        });
        
        await this.delay(this.config.initRetryDelayMs * Math.pow(2, retryCount));
        return this.initializeEngine(name, retryCount + 1);
      }

      this.emit('engineInitFailed', { name, error, timestamp: Date.now() });
      throw error;
    }
  }

  // Start all engines
  public async startAll(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('Cannot start engines during shutdown');
    }

    this.emit('startAllStarted', { timestamp: Date.now() });

    const sortedEngines = this.topologicalSort();
    
    for (const engineName of sortedEngines) {
      await this.startEngine(engineName);
    }

    // Start health check if enabled
    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }

    this.emit('startAllCompleted', { timestamp: Date.now() });
  }

  // Start single engine
  private async startEngine(name: EngineName): Promise<void> {
    const record = this.engines.get(name);
    if (!record) {
      throw new Error(`Engine ${name} not registered`);
    }

    if (record.status === 'running') {
      this.emit('engineAlreadyRunning', { name });
      return;
    }

    try {
      record.status = 'starting';
      this.emit('engineStarting', { name });

      // Call start method if it exists
      if (typeof record.instance.start === 'function') {
        await record.instance.start();
      }

      record.status = 'running';
      record.startedAt = Date.now();
      
      this.emit('engineStarted', { name, timestamp: Date.now() });
    } catch (error) {
      record.status = 'error';
      record.error = error as Error;
      
      this.emit('engineStartFailed', { name, error, timestamp: Date.now() });
      throw error;
    }
  }

  // Stop all engines
  public async stopAll(): Promise<void> {
    this.isShuttingDown = true;
    this.emit('stopAllStarted', { timestamp: Date.now() });

    // Stop health check
    this.stopHealthCheck();

    // Stop in reverse order
    const sortedEngines = this.topologicalSort().reverse();
    
    for (const engineName of sortedEngines) {
      await this.stopEngine(engineName);
    }

    this.isShuttingDown = false;
    this.emit('stopAllCompleted', { timestamp: Date.now() });
  }

  // Stop single engine
  private async stopEngine(name: EngineName): Promise<void> {
    const record = this.engines.get(name);
    if (!record) {
      return;
    }

    if (record.status === 'stopped' || record.status === 'initialized') {
      this.emit('engineAlreadyStopped', { name });
      return;
    }

    try {
      this.emit('engineStopping', { name });

      // Call stop method if it exists
      if (typeof record.instance.stop === 'function') {
        await record.instance.stop();
      }

      record.status = 'stopped';
      
      this.emit('engineStopped', { name, timestamp: Date.now() });
    } catch (error) {
      record.status = 'error';
      record.error = error as Error;
      
      this.emit('engineStopFailed', { name, error, timestamp: Date.now() });
      // Don't throw - attempt to stop other engines
    }
  }

  // Health check
  private startHealthCheck(): void {
    this.stopHealthCheck(); // Clear any existing timer
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private async performHealthCheck(): Promise<void> {
    const healthResults = {
      timestamp: Date.now(),
      engines: {} as Record<string, any>
    };

    for (const [name, record] of this.engines.entries()) {
      const health = {
        status: record.status,
        healthy: record.status === 'running' || record.status === 'initialized',
        error: record.error?.message
      };

      // Call health check method if it exists
      if (typeof record.instance.healthCheck === 'function') {
        try {
          const customHealth = await record.instance.healthCheck();
          Object.assign(health, customHealth);
        } catch (error) {
          health.healthy = false;
          health.error = (error as Error).message;
        }
      }

      healthResults.engines[name] = health;
    }

    this.emit('healthCheck', healthResults);

    // Log unhealthy engines
    const unhealthyEngines = Object.entries(healthResults.engines)
      .filter(([_, h]: [string, any]) => !h.healthy)
      .map(([name]) => name);

    if (unhealthyEngines.length > 0) {
      this.emit('unhealthyEngines', {
        engines: unhealthyEngines,
        timestamp: Date.now()
      });
    }
  }

  // Get registry statistics
  public getStats(): {
    totalEngines: number;
    running: number;
    stopped: number;
    error: number;
    initialized: number;
    uptime: number;
  } {
    const stats = {
      totalEngines: this.engines.size,
      running: 0,
      stopped: 0,
      error: 0,
      initialized: 0,
      uptime: 0
    };

    for (const record of this.engines.values()) {
      switch (record.status) {
        case 'running':
          stats.running++;
          break;
        case 'stopped':
        case 'initialized':
          stats.stopped++;
          break;
        case 'error':
          stats.error++;
          break;
      }
      
      if (record.status === 'initialized' || record.status === 'running') {
        stats.initialized++;
      }
    }

    // Calculate uptime (based on earliest started engine)
    const startedTimes = Array.from(this.engines.values())
      .map(r => r.startedAt)
      .filter(t => t !== undefined) as number[];
    
    if (startedTimes.length > 0) {
      const earliestStart = Math.min(...startedTimes);
      stats.uptime = Date.now() - earliestStart;
    }

    return stats;
  }

  // Destroy registry (cleanup)
  public async destroy(): Promise<void> {
    this.emit('destroyStarted', { timestamp: Date.now() });

    await this.stopAll();

    // Clear all engines
    this.engines.clear();

    // Remove all listeners
    this.removeAllListeners();

    this.emit('destroyCompleted', { timestamp: Date.now() });
  }

  // Helper methods

  private topologicalSort(): EngineName[] {
    const visited = new Set<EngineName>();
    const result: EngineName[] = [];
    
    const visit = (name: EngineName) => {
      if (visited.has(name)) return;
      visited.add(name);
      
      const record = this.engines.get(name);
      if (record) {
        for (const dep of record.dependencies) {
          visit(dep);
        }
      }
      
      result.push(name);
    };
    
    for (const name of this.engines.keys()) {
      visit(name);
    }
    
    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export factory function
export function createEngineRegistry(config?: Partial<RegistryConfig>): EngineRegistry {
  return EngineRegistry.getInstance(config);
}

// Export helper to setup default engines
export function setupDefaultEngines(registry: EngineRegistry): void {
  // This function would be called to register all default engines
  // Implementation depends on your specific engine constructors and configs
  
  // Example:
  // const conditionEngine = new ConditionEngine(...);
  // const tradeExecutor = new TradeExecutor(...);
  // const riskEngine = new RiskEngine(...);
  
  // registry.register('condition', conditionEngine, conditionConfig, []);
  // registry.register('trade', tradeExecutor, tradeConfig, ['condition']);
  // registry.register('risk', riskEngine, riskConfig, ['trade']);
  
  // etc.
}
