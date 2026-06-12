/**
 * Broker Manager — 券商连接管理器
 * 统一管理多个券商适配器的生命周期
 */
import type { IBrokerAdapter, BrokerCredentials } from './types';
import { BinanceAdapter } from './adapters/binance-adapter';

export interface BrokerConfig {
  name: string;
  adapter: string;
  credentials: BrokerCredentials;
  enabled: boolean;
  priority: number; // 优先级, 高优先级先尝试获取行情
}

export class BrokerManager {
  private adapters = new Map<string, IBrokerAdapter>();
  private configs = new Map<string, BrokerConfig>();

  /** 注册内置适配器 */
  static createAdapter(type: string): IBrokerAdapter {
    switch (type.toLowerCase()) {
      case 'binance': return new BinanceAdapter();
      // TODO: add more adapters
      // case 'futu': return new FutuAdapter();
      // case 'tiger': return new TigerAdapter();
      // case 'ib': return new IBAdapter();
      // case 'okx': return new OKXAdapter();
      // case 'bybit': return new BybitAdapter();
      default:
        throw new Error(`Unknown broker adapter: ${type}`);
    }
  }

  /** 添加券商配置 */
  addBroker(config: BrokerConfig): void {
    this.configs.set(config.name, config);
  }

  /** 连接指定券商 */
  async connect(name: string): Promise<IBrokerAdapter> {
    const config = this.configs.get(name);
    if (!config) throw new Error(`Broker config not found: ${name}`);
    if (!config.enabled) throw new Error(`Broker disabled: ${name}`);

    const adapter = BrokerManager.createAdapter(config.adapter);
    await adapter.connect(config.credentials);
    this.adapters.set(name, adapter);
    return adapter;
  }

  /** 断开指定券商 */
  async disconnect(name: string): Promise<void> {
    const adapter = this.adapters.get(name);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(name);
    }
  }

  /** 获取适配器实例 */
  getAdapter(name: string): IBrokerAdapter | undefined {
    return this.adapters.get(name);
  }

  /** 获取所有已连接适配器 */
  getAllAdapters(): IBrokerAdapter[] {
    return Array.from(this.adapters.values());
  }

  /** 获取所有已连接且支持实时的适配器 */
  getRealTimeAdapters(): IBrokerAdapter[] {
    return this.getAllAdapters().filter(a => a.supportsRealTime);
  }

  /** 获取最优行情 (按优先级) */
  async getBestQuote(symbol: string): Promise<ReturnType<IBrokerAdapter['getQuote']>> {
    const adapters = this.getRealTimeAdapters();
    if (adapters.length === 0) throw new Error('No real-time broker connected');

    // Try all adapters, return first success
    const results = await Promise.allSettled(
      adapters.map(a => a.getQuote(symbol))
    );
    const success = results.find(r => r.status === 'fulfilled');
    if (success && success.status === 'fulfilled') return success.value;
    throw new Error(`All brokers failed to get quote for ${symbol}`);
  }

  /** 断开所有 */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.adapters.keys()).map(name => this.disconnect(name))
    );
  }
}

// Singleton instance
let manager: BrokerManager | null = null;
export function getBrokerManager(): BrokerManager {
  if (!manager) manager = new BrokerManager();
  return manager;
}
