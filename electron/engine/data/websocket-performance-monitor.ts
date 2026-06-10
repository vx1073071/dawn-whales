// JVS-116: WebSocket Performance Monitor
// Real-time monitoring of WebSocket connection performance metrics

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface ConnectionMetrics {
  clientId: string;
  connectedAt: number;
  lastPing: number;
  latencyMs: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  errorCount: number;
  reconnectCount: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  totalClients: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  totalMessages: number;
  totalBytes: number;
  errorRate: number;
}

export interface MonitorConfig {
  snapshotIntervalMs: number;
  maxHistorySize: number;
  latencyWarningThresholdMs: number;
  enableAutoSnapshot: boolean;
}

export class WebSocketPerformanceMonitor extends EventEmitter {
  private config: Required<MonitorConfig>;
  private metrics: Map<string, ConnectionMetrics> = new Map();
  private history: PerformanceSnapshot[] = [];
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MonitorConfig>) {
    super();
    this.config = {
      snapshotIntervalMs: config?.snapshotIntervalMs ?? 10_000,
      maxHistorySize: config?.maxHistorySize ?? 100,
      latencyWarningThresholdMs: config?.latencyWarningThresholdMs ?? 500,
      enableAutoSnapshot: config?.enableAutoSnapshot ?? true,
    };

    if (this.config.enableAutoSnapshot) {
      this.startAutoSnapshot();
    }

    log.info(`[WS PerfMonitor] Initialized (interval=${this.config.snapshotIntervalMs}ms)`);
  }

  /**
   * Track new client connection
   */
  trackConnection(clientId: string): void {
    this.metrics.set(clientId, {
      clientId,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      latencyMs: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      errorCount: 0,
      reconnectCount: 0,
    });
    this.emit('connection', { clientId, timestamp: Date.now() });
  }

  /**
   * Track client disconnection
   */
  trackDisconnection(clientId: string): void {
    this.metrics.delete(clientId);
    this.emit('disconnection', { clientId, timestamp: Date.now() });
  }

  /**
   * Update ping latency
   */
  updateLatency(clientId: string, latencyMs: number): void {
    const m = this.metrics.get(clientId);
    if (!m) return;

    m.lastPing = Date.now();
    m.latencyMs = latencyMs;

    if (latencyMs > this.config.latencyWarningThresholdMs) {
      this.emit('latencyWarning', { clientId, latencyMs });
      log.warn(`[WS PerfMonitor] High latency for ${clientId}: ${latencyMs}ms`);
    }
  }

  /**
   * Track outgoing message
   */
  trackMessageSent(clientId: string, bytes: number): void {
    const m = this.metrics.get(clientId);
    if (!m) return;
    m.messagesSent++;
    m.bytesTransferred += bytes;
  }

  /**
   * Track incoming message
   */
  trackMessageReceived(clientId: string, bytes: number): void {
    const m = this.metrics.get(clientId);
    if (!m) return;
    m.messagesReceived++;
    m.bytesTransferred += bytes;
  }

  /**
   * Track error
   */
  trackError(clientId: string): void {
    const m = this.metrics.get(clientId);
    if (!m) return;
    m.errorCount++;
  }

  /**
   * Track reconnection
   */
  trackReconnection(clientId: string): void {
    const m = this.metrics.get(clientId);
    if (!m) return;
    m.reconnectCount++;
    m.connectedAt = Date.now();
  }

  /**
   * Get metrics for specific client
   */
  getClientMetrics(clientId: string): ConnectionMetrics | null {
    return this.metrics.get(clientId) ?? null;
  }

  /**
   * Get all client metrics
   */
  getAllMetrics(): ConnectionMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Take performance snapshot
   */
  takeSnapshot(): PerformanceSnapshot {
    const allMetrics = this.getAllMetrics();
    const totalClients = allMetrics.length;
    const latencies = allMetrics.map(m => m.latencyMs).filter(l => l > 0);

    const snapshot: PerformanceSnapshot = {
      timestamp: Date.now(),
      totalClients,
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((s, l) => s + l, 0) / latencies.length : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      totalMessages: allMetrics.reduce((s, m) => s + m.messagesSent + m.messagesReceived, 0),
      totalBytes: allMetrics.reduce((s, m) => s + m.bytesTransferred, 0),
      errorRate: totalClients > 0 ? allMetrics.reduce((s, m) => s + m.errorCount, 0) / totalClients : 0,
    };

    this.history.push(snapshot);
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }

    this.emit('snapshot', snapshot);
    return snapshot;
  }

  /**
   * Get performance history
   */
  getHistory(limit?: number): PerformanceSnapshot[] {
    return limit ? this.history.slice(-limit) : this.history;
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalClients: number;
    totalMessages: number;
    totalBytes: number;
    totalErrors: number;
    totalReconnections: number;
    avgLatencyMs: number;
    uptimeMs: number;
  } {
    const all = this.getAllMetrics();
    const latencies = all.map(m => m.latencyMs).filter(l => l > 0);

    return {
      totalClients: all.length,
      totalMessages: all.reduce((s, m) => s + m.messagesSent + m.messagesReceived, 0),
      totalBytes: all.reduce((s, m) => s + m.bytesTransferred, 0),
      totalErrors: all.reduce((s, m) => s + m.errorCount, 0),
      totalReconnections: all.reduce((s, m) => s + m.reconnectCount, 0),
      avgLatencyMs: latencies.length > 0 ? latencies.reduce((s, l) => s + l, 0) / latencies.length : 0,
      uptimeMs: all.length > 0 ? Date.now() - Math.min(...all.map(m => m.connectedAt)) : 0,
    };
  }

  /**
   * Start auto snapshot
   */
  private startAutoSnapshot(): void {
    this.snapshotTimer = setInterval(() => {
      this.takeSnapshot();
    }, this.config.snapshotIntervalMs);

    if (this.snapshotTimer.unref) this.snapshotTimer.unref();
  }

  /**
   * Stop auto snapshot
   */
  stopAutoSnapshot(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.metrics.clear();
    this.history = [];
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.stopAutoSnapshot();
    this.clearAll();
    this.removeAllListeners();
  }
}

// Singleton
let monitorInstance: WebSocketPerformanceMonitor | null = null;

export function getWebSocketPerformanceMonitor(
  config?: Partial<MonitorConfig>
): WebSocketPerformanceMonitor {
  if (!monitorInstance) {
    monitorInstance = new WebSocketPerformanceMonitor(config);
  }
  return monitorInstance;
}
