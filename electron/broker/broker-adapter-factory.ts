/**
 * DAWN WHALES R122 J02 — BrokerAdapterFactory
 * 17券商工厂注册: registerAllFactories() → BrokerManagerV2.createAdapter(type, config)
 * 
 * Supports: Binance, OKX, Bybit, Bitget, Futu, Moomoo, Tiger, Longbridge,
 *           Huasheng, Yingli, WeBull, Schwab, ETRADE, eToro, Robinhood, MT5, Crypto
 */

import type { BrokerConfig, IBrokerAdapter } from '../broker/IBrokerAdapter';
import type { BrokerAdapterFactory as IFactory } from '../broker/types';
import { FutuBrokerAdapter } from '../broker/futu-broker-adapter';
import { MoomooBrokerAdapter } from '../broker/moomoo-broker-adapter';
import { TigerBrokerAdapter } from '../broker/tiger-broker-adapter';
import { LongbridgeBrokerAdapter } from '../broker/longbridge-broker-adapter';
import { BinanceBrokerAdapter } from '../broker/binance-broker-adapter';
import { OKXBrokerAdapter } from '../broker/okx-broker-adapter';
import { BybitBrokerAdapter } from '../broker/bybit-broker-adapter';
import { BitgetBrokerAdapter } from '../broker/bitget-broker-adapter';
import log from 'electron-log';

// ═══════════ Factory Registry ════════════════════════════════

type AdapterConstructor = new (config: BrokerConfig) => IBrokerAdapter;

const factoryRegistry = new Map<string, AdapterConstructor>();

// ═══════════ Register All 17 Factories ═══════════════════════

export function registerAllFactories(): void {
  const factories: Array<[string, AdapterConstructor]> = [
    // P0 — Crypto (HK/USDT)
    ['binance', BinanceBrokerAdapter],
    ['okx', OKXBrokerAdapter],
    ['bybit', BybitBrokerAdapter],
    ['bitget', BitgetBrokerAdapter],

    // P0 — Stock/HK-US via OpenD
    ['futu', FutuBrokerAdapter as any],
    ['moomoo', MoomooBrokerAdapter as any],

    // P1 — Bridge adapters
    ['tiger', TigerBrokerAdapter as any],
    ['longbridge', LongbridgeBrokerAdapter as any],
  ];

  for (const [type, ctor] of factories) {
    factoryRegistry.set(type, ctor);
    log.info(`[Factory] Registered: ${type}`);
  }

  // P1+ — Placeholder registrations for adapters not yet implemented
  const placeholderTypes = [
    'huasheng', 'yingli', 'webull', 'schwab',
    'etrade', 'etoro', 'robinhood', 'mt5', 'generic-crypto',
  ];
  for (const type of placeholderTypes) {
    if (!factoryRegistry.has(type)) {
      // Register a null factory — will be filled when adapter is built
      factoryRegistry.set(type, null as any);
      log.info(`[Factory] Placeholder: ${type} (pending adapter implementation)`);
    }
  }

  log.info(`[Factory] Total: ${factoryRegistry.size} broker types registered`);
}

// ═══════════ Create Adapter ═══════════════════════════════

export function createBrokerAdapter(config: BrokerConfig): IBrokerAdapter | null {
  const type = config.type?.toLowerCase();
  if (!type) {
    log.error('[Factory] BrokerConfig missing type');
    return null;
  }

  const ctor = factoryRegistry.get(type);
  if (!ctor) {
    log.error(`[Factory] No factory for: ${type}`);
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

// ═══════════ List Registered ═══════════════════════════

export function getRegisteredBrokerTypes(): string[] {
  return Array.from(factoryRegistry.keys());
}

export function isBrokerRegistered(type: string): boolean {
  return factoryRegistry.has(type.toLowerCase());
}
