// @ts-nocheck
/**
 * DAWN WHALES R130 J03 — Cloud Broker Adapter Factory
 * 
 * Registry and factory for server-side cloud broker adapters.
 * Supports lazy initialization: only load/connect the adapter
 * when a user actually uses that broker.
 */

import { ICloudBrokerAdapter, CloudBrokerConfig, CloudBrokerType } from '../../electron/broker/ICloudBrokerAdapter';
import { getConfig } from '../config-manager';

// ═══════════════ Factory Registration ════════════════════

type AdapterConstructor = new (config: CloudBrokerConfig) => ICloudBrokerAdapter;

class AdapterRegistry {
  private registrations: Map<string, { ctor: AdapterConstructor; label: string }> = new Map();
  private instances: Map<string, ICloudBrokerAdapter> = new Map();
  private initialized = false;

  /** Register an adapter constructor for a broker type */
  register(type: string, ctor: AdapterConstructor, label = ''): void {
    this.registrations.set(type, { ctor, label: label || type });
  }

  /** Register all known adapters (lazy imports to avoid circular deps) */
  registerAll(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Crypto — Direct REST+WS
    this.register('binance', require('./binance-adapter').BinanceAdapter, 'Binance');
    this.register('binance-testnet', require('./binance-adapter').BinanceAdapter, 'Binance Testnet');
    this.register('okx', require('./okx-adapter').OkxAdapter, 'OKX');
    this.register('okx-testnet', require('./okx-adapter').OkxAdapter, 'OKX Testnet');

    // More adapters added in R131-R134:
    // this.register('bybit', ...)
    // this.register('bitget', ...)
    // this.register('tiger', ...)
  }

  /** Create and connect an adapter */
  async create(config: CloudBrokerConfig): Promise<ICloudBrokerAdapter> {
    const reg = this.registrations.get(config.type);
    if (!reg) {
      throw new Error(`No adapter registered for broker type: ${config.type}`);
    }

    const adapter = new reg.ctor(config);
    await adapter.connect();

    // Register callbacks
    adapter.onError((e) => {
      console.error(`[AdapterFactory] ${config.brokerId}: ${e.message}`);
    });

    this.instances.set(config.brokerId, adapter);
    return adapter;
  }

  /** Get an already-connected adapter */
  get(brokerId: string): ICloudBrokerAdapter | undefined {
    return this.instances.get(brokerId);
  }

  /** Get or create adapter (singleton pattern per brokerId) */
  async getOrCreate(config: CloudBrokerConfig): Promise<ICloudBrokerAdapter> {
    const existing = this.instances.get(config.brokerId);
    if (existing && existing.isConnected()) {
      return existing;
    }
    return this.create(config);
  }

  /** Disconnect and remove an adapter */
  async destroy(brokerId: string): Promise<void> {
    const adapter = this.instances.get(brokerId);
    if (adapter) {
      await adapter.disconnect();
      adapter.dispose();
      this.instances.delete(brokerId);
    }
  }

  /** List all active adapters */
  listActive(): { brokerId: string; type: string; connected: boolean }[] {
    return Array.from(this.instances.entries()).map(([id, a]) => ({
      brokerId: id,
      type: a.brokerType,
      connected: a.isConnected(),
    }));
  }

  /** Health check all active adapters */
  async healthCheckAll(): Promise<{ brokerId: string; ok: boolean; latencyMs: number }[]> {
    const results: { brokerId: string; ok: boolean; latencyMs: number }[] = [];
    for (const [id, adapter] of this.instances) {
      try {
        const hc = await adapter.healthCheck();
        results.push({ brokerId: id, ...hc });
      } catch {
        results.push({ brokerId: id, ok: false, latencyMs: -1 });
      }
    }
    return results;
  }

  /** Disconnect all adapters (graceful shutdown) */
  async shutdownAll(): Promise<void> {
    for (const [id] of this.instances) {
      await this.destroy(id);
    }
  }

  /** How many adapters are registered */
  get registeredCount(): number {
    return this.registrations.size;
  }

  /** How many adapters are connected */
  get activeCount(): number {
    return Array.from(this.instances.values()).filter((a) => a.isConnected()).length;
  }
}

// ═══════════════ Singleton ═══════════════════════════════

let _registry: AdapterRegistry | null = null;

export function getAdapterRegistry(): AdapterRegistry {
  if (!_registry) {
    _registry = new AdapterRegistry();
  }
  return _registry;
}

/** One-time init: register all known adapters */
export function initAdapterRegistry(): AdapterRegistry {
  const reg = getAdapterRegistry();
  reg.registerAll();
  return reg;
}

// ═══════════════ Config Builder ═══════════════════════════

/**
 * Build a CloudBrokerConfig from decrypted API key material.
 * Called by the API Key management layer (R129-P04).
 */
export function buildCloudConfig(
  brokerId: string,
  brokerType: CloudBrokerType,
  apiKey: string,
  secretKey: string,
  passphrase?: string,
  restBaseUrl?: string,
  wsBaseUrl?: string,
): CloudBrokerConfig {
  const defaultUrls: Record<string, { rest: string; ws: string }> = {
    'binance': { rest: 'https://api.binance.com', ws: 'wss://stream.binance.com:9443' },
    'binance-testnet': { rest: 'https://testnet.binance.vision', ws: 'wss://testnet.binance.vision' },
    'okx': { rest: 'https://www.okx.com', ws: 'wss://ws.okx.com:8443/ws/v5' },
    'okx-testnet': { rest: 'https://www.okx.com', ws: 'wss://wspap.okx.com:8443/ws/v5/public?brokerId=0' },
  };

  const urls = defaultUrls[brokerType] || { rest: 'https://api.example.com', ws: 'wss://ws.example.com' };

  return {
    brokerId,
    name: brokerType,
    type: brokerType,
    apiKey,
    secretKey,
    passphrase,
    restBaseUrl: restBaseUrl || urls.rest,
    wsBaseUrl: wsBaseUrl || urls.ws,
  };
}
