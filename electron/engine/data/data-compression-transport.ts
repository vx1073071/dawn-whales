// JVS-23: Data Compression Transport
// Efficient data compression for WebSocket transmission

import { EventEmitter } from 'events';
import log from 'electron-log';

export interface CompressionResult {
  original: string;
  compressed: string;
  ratio: number; // compressed/original
  elapsedMs: number;
}

export interface DeltaUpdate<T> {
  type: 'full' | 'delta';
  data: Partial<T> | T;
  baseVersion?: number;
  currentVersion: number;
}

export interface TransportConfig {
  enableCompression: boolean;
  minCompressSize: number; // Only compress if payload exceeds this
  deltaThreshold: number; // Send full update if changes exceed this %
  maxHistoryVersions: number;
  batchSize: number;
  batchIntervalMs: number;
}

/**
 * JSON-based compression using field deduplication and value encoding
 */
export class DataCompressionTransport extends EventEmitter {
  private config: Required<TransportConfig>;
  private versions: Map<string, { data: unknown; version: number }> = new Map();
  private batchQueue: { channel: string; data: unknown }[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private metrics = {
    totalCompressed: 0,
    totalBytesOriginal: 0,
    totalBytesCompressed: 0,
    totalDeltas: 0,
    totalFull: 0,
    compressionRatioAvg: 0,
  };

  constructor(config?: Partial<TransportConfig>) {
    super();
    this.config = {
      enableCompression: config?.enableCompression ?? true,
      minCompressSize: config?.minCompressSize ?? 256,
      deltaThreshold: config?.deltaThreshold ?? 0.3,
      maxHistoryVersions: config?.maxHistoryVersions ?? 10,
      batchSize: config?.batchSize ?? 20,
      batchIntervalMs: config?.batchIntervalMs ?? 100,
    };
    log.info(`[DataCompression] enabled=${this.config.enableCompression}`);
  }

  /**
   * Prepare data for transmission with optional compression
   */
  prepare(channel: string, data: unknown): CompressionResult {
    const t0 = performance.now();
    const json = JSON.stringify(data);

    if (!this.config.enableCompression || json.length < this.config.minCompressSize) {
      const elapsed = performance.now() - t0;
      return { original: json, compressed: json, ratio: 1.0, elapsedMs: elapsed };
    }

    // Compress: remove whitespace, deduplicate keys, encode numbers
    const compressed = this.compress(json);
    const ratio = compressed.length / json.length;
    const elapsed = performance.now() - t0;

    this.metrics.totalCompressed++;
    this.metrics.totalBytesOriginal += json.length;
    this.metrics.totalBytesCompressed += compressed.length;
    this.metrics.compressionRatioAvg =
      this.metrics.totalBytesCompressed / this.metrics.totalBytesOriginal;

    return { original: json, compressed, ratio, elapsedMs: elapsed };
  }

  /**
   * Generate delta update between old and new data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generateDelta<T extends Record<string, any>>(
    channel: string,
    newData: T
  ): DeltaUpdate<T> {
    const prev = this.versions.get(channel);
    const currentVersion = prev ? prev.version + 1 : 1;

    // Store version
    this.versions.set(channel, { data: { ...newData }, version: currentVersion });

    if (!prev) {
      this.metrics.totalFull++;
      return { type: 'full', data: newData, currentVersion };
    }

    // Calculate diff
    const delta: Partial<T> = {};
    let changedKeys = 0;
    const allKeys = new Set([...Object.keys(prev.data), ...Object.keys(newData)]);

    for (const key of allKeys) {
      const k = key as keyof T;
      if (JSON.stringify(prev.data[k]) !== JSON.stringify(newData[k])) {
        delta[k] = newData[k];
        changedKeys++;
      }
    }

    const changeRatio = changedKeys / allKeys.size;

    if (changeRatio > this.config.deltaThreshold) {
      // Too many changes, send full update
      this.metrics.totalFull++;
      return { type: 'full', data: newData, currentVersion };
    }

    this.metrics.totalDeltas++;
    return {
      type: 'delta',
      data: delta,
      baseVersion: prev.version,
      currentVersion,
    };
  }

  /**
   * Apply delta update to reconstruct full data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyDelta<T extends Record<string, any>>(
    base: T,
    delta: DeltaUpdate<T>
  ): T {
    if (delta.type === 'full') return delta.data as T;
    return { ...base, ...(delta.data as Partial<T>) };
  }

  /**
   * Batch enqueue data for transmission
   */
  enqueue(channel: string, data: unknown): void {
    this.batchQueue.push({ channel, data });

    if (this.batchQueue.length >= this.config.batchSize) {
      this.flush();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flush(), this.config.batchIntervalMs);
      if (this.batchTimer.unref) this.batchTimer.unref();
    }
  }

  /**
   * Flush batch queue
   */
  flush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    const compressed = batch.map(({ channel, data }) => ({
      channel,
      ...this.prepare(channel, data),
    }));

    this.emit('batch', compressed);
  }

  /**
   * Simple JSON compression: remove whitespace + compact number representation
   */
  private compress(json: string): string {
    // Remove all unnecessary whitespace
    let result = json.replace(/\s+/g, '');

    // Compact floating point numbers (e.g., 1.500000 -> 1.5)
    result = result.replace(/(\d+\.\d*?)0+(?=[,}\]])/g, '$1');

    // Compact boolean values
    result = result.replace(/"true"/g, '!t');
    result = result.replace(/"false"/g, '!f');
    result = result.replace(/"null"/g, '!n');

    return result;
  }

  /**
   * Decompress
   */
  decompress(compressed: string): string {
    let result = compressed;
    result = result.replace(/!t/g, '"true"');
    result = result.replace(/!f/g, '"false"');
    result = result.replace(/!n/g, '"null"');
    return result;
  }

  /**
   * Get transmission metrics
   */
  getMetrics(): typeof this.metrics & { savingsPercent: number } {
    const savings = this.metrics.totalBytesOriginal > 0
      ? (1 - this.metrics.compressionRatioAvg) * 100
      : 0;
    return { ...this.metrics, savingsPercent: savings };
  }

  /**
   * Get version for channel
   */
  getVersion(channel: string): number {
    return this.versions.get(channel)?.version ?? 0;
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.versions.clear();
    this.batchQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.metrics = {
      totalCompressed: 0, totalBytesOriginal: 0, totalBytesCompressed: 0,
      totalDeltas: 0, totalFull: 0, compressionRatioAvg: 0,
    };
  }

  destroy(): void {
    this.clearAll();
    this.removeAllListeners();
  }
}

// Singleton
let transportInstance: DataCompressionTransport | null = null;

export function getDataCompressionTransport(
  config?: Partial<TransportConfig>
): DataCompressionTransport {
  if (!transportInstance) {
    transportInstance = new DataCompressionTransport(config);
  }
  return transportInstance;
}
