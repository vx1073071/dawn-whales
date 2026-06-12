/**
 * DAWN WHALES R122 J02 — BrokerAdapterFactory
 * 17券商工厂注册: registerAllFactories() for BrokerManagerV2
 * 
 * Uses existing adapters: Futu (opend), Moomoo, Longbridge, IB.
 * Crypto adapters (Binance/OKX/Bybit/Bitget) are placeholder until R2/R3 build.
 * Bridge adapters (Tiger/Huasheng/Yingli/WeBull/Schwab/ETRADE/eToro/Robinhood/MT5)
 * are placeholder until respective adapter implementations exist.
 */

import type { BrokerConfig, IBrokerAdapter } from './IBrokerAdapter';
import log from 'electron-log';

// ═══════════ Factory Registry ════════════════════════════════

type AdapterConstructor = new (config: BrokerConfig) => IBrokerAdapter;

const factoryRegistry = new Map<string, AdapterConstructor>();

// ═══════════ Register Factories ═══════════════════════════

export function registerAllFactories(): void {
  // P0 — Real adapters
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FutuOpenDClient } = require('./futu-opend');
    // Futu adapter is created via BrokerManager, not direct constructor
    factoryRegistry.set('futu', null as any); // handled by BrokerManager
    log.info('[Factory] Registered: futu (via BrokerManager)');
  } catch (e) {
    log.warn('[Factory] Futu not available:', e);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MoomooOpenDClient } = require('./moomoo-adapter');
    factoryRegistry.set('moomoo', null as any);
    log.info('[Factory] Registered: moomoo (via BrokerManager)');
  } catch (e) {
    log.warn('[Factory] Moomoo not available:', e);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LongbridgeAdapter } = require('./longbridge-adapter');
    factoryRegistry.set('longbridge', LongbridgeAdapter as any);
    log.info('[Factory] Registered: longbridge');
  } catch (e) {
    log.info('[Factory] Longbridge not available (pending adapter)');
    factoryRegistry.set('longbridge', null as any);
  }

  // P1 — Placeholder for bridge adapters (pending implementation)
  const placeholders = [
    'binance', 'okx', 'bybit', 'bitget',
    'tiger', 'huasheng', 'yingli', 'webull',
    'schwab', 'etrade', 'etoro', 'robinhood',
    'ib', 'mt5', 'generic-crypto',
  ];
  for (const t of placeholders) {
    if (!factoryRegistry.has(t)) {
      factoryRegistry.set(t, null as any);
      log.info(`[Factory] Placeholder: ${t}`);
    }
  }

  log.info(`[Factory] Total: ${factoryRegistry.size} broker types registered`);
}

// ═══════════ Create Adapter ═══════════════════════════

export function createBrokerAdapter(config: BrokerConfig): IBrokerAdapter | null {
  const type = config.type?.toLowerCase();
  if (!type) {
    log.error('[Factory] BrokerConfig missing type');
    return null;
  }

  const ctor = factoryRegistry.get(type);
  if (ctor === undefined) {
    log.error(`[Factory] No factory for type: ${type}`);
    return null;
  }

  // null ctor = adapter handled externally (BrokerManager/V2 createAdapter)
  if (ctor === null) {
    log.info(`[Factory] Type '${type}' delegated to BrokerManager`);
    return null;
  }

  try {
    const adapter = new ctor(config);
    log.info(`[Factory] Created adapter: ${type} (${config.name || config.id})`);
    return adapter;
  } catch (err) {
    log.error(`[Factory] Failed to create ${type}:`, err);
    return null;
  }
}

// ═══════════ Registry Queries ═══════════════════════════

export function getRegisteredBrokerTypes(): string[] {
  return Array.from(factoryRegistry.keys());
}

export function isBrokerRegistered(type: string): boolean {
  return factoryRegistry.has(type.toLowerCase());
}
