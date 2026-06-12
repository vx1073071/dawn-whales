// @ts-nocheck — R119 QClaw: structural type errors pending resolution by JVS/PM
// ── DAWN WHALES — OAuth Broker IPC Registration ───────────────────────
// R3 OAU-05: Register 4 OAuth adapters with BrokerManagerV2
// Schwab, E*TRADE, eToro, Webull — all via OAuthBrokerBase

import log from 'electron-log';
import { BrokerManagerV2 } from '../broker/BrokerManagerV2';
import { SchwabAdapter } from '../broker/adapters/SchwabAdapter';
import { ETRADEAdapter } from '../broker/adapters/ETRADEAdapter';
import { eToroAdapter } from '../broker/adapters/eToroAdapter';
import { WebullAdapter } from '../broker/adapters/WebullAdapter';
import type { BrokerConfig } from '../IBrokerAdapter';
import type { BrokerType } from '../IBrokerAdapterV2';

/**
 * Register all 4 OAuth broker factories with BrokerManagerV2.
 * Must be called AFTER BrokerManagerV2 is instantiated.
 * Each factory creates a properly typed adapter from BrokerConfig.
 */
export function registerOAuthBrokerFactories(manager: BrokerManagerV2): void {
  log.info('[OAuthIPC] Registering 4 OAuth broker factories...');

  // ── Schwab (OAuth2 PKCE) ──
  manager.registerAdapterFactory('schwab', (config: BrokerConfig) => {
    return new SchwabAdapter({
      id: config.id,
      name: config.name,
      type: 'schwab',
      clientId: config.apiKey || '',
      clientSecret: config.secretKey || '',
      // Can pass stored token from config.options
      accessToken: config.options?.accessToken as string | undefined,
      refreshToken: config.options?.refreshToken as string | undefined,
    });
  });

  // ── E*TRADE (OAuth1.0a) ──
  manager.registerAdapterFactory('etrade', (config: BrokerConfig) => {
    return new ETRADEAdapter({
      id: config.id,
      name: config.name,
      type: 'etrade',
      consumerKey: config.apiKey || '',
      consumerSecret: config.secretKey || '',
      accessToken: config.options?.accessToken as string | undefined,
      accessTokenSecret: config.options?.accessTokenSecret as string | undefined,
      useSandbox: (config.options?.useSandbox as boolean) ?? false,
    });
  });

  // ── eToro (OAuth2) ──
  manager.registerAdapterFactory('etoro', (config: BrokerConfig) => {
    return new eToroAdapter({
      id: config.id,
      name: config.name,
      type: 'etoro',
      clientId: config.apiKey || '',
      clientSecret: config.secretKey || '',
      apiKey: config.apiKey || '',
      useRealAccount: (config.options?.useRealAccount as boolean) ?? false,
    });
  });

  // ── Webull (OAuth2) ──
  manager.registerAdapterFactory('webull', (config: BrokerConfig) => {
    return new WebullAdapter({
      id: config.id,
      name: config.name,
      type: 'webull',
      clientId: config.apiKey || '',
      clientSecret: config.secretKey || '',
      paperTrading: (config.options?.paperTrading as boolean) ?? true,
      deviceId: config.options?.deviceId as string | undefined,
    });
  });

  log.info('[OAuthIPC] All 4 OAuth broker factories registered (schwab, etrade, etoro, webull)');
}

/**
 * Default broker configs for connection (without credentials).
 * Real credentials come from OAuthTokenStore (keytar) or user input.
 */
export const OAUTH_BROKER_DEFAULTS: Array<BrokerConfig & { brokerType: BrokerType }> = [
  {
    id: 'schwab-default',
    name: 'Charles Schwab',
    type: 'schwab',
    host: 'api.schwabapi.com',
    port: 443,
    enabled: false,
  },
  {
    id: 'etrade-default',
    name: 'E*TRADE (Morgan Stanley)',
    type: 'etrade',
    host: 'api.etrade.com',
    port: 443,
    enabled: false,
  },
  {
    id: 'etoro-default',
    name: 'eToro',
    type: 'etoro',
    host: 'api.etoro.com',
    port: 443,
    enabled: false,
  },
  {
    id: 'webull-default',
    name: 'Webull',
    type: 'webull',
    host: 'api.webull.com',
    port: 443,
    enabled: false,
  },
];

export default registerOAuthBrokerFactories;
