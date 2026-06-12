// ── DAWN WHALES — OAuth Broker Integration Tests ───────────────────────
// R3 OAU-05: Validates all 4 OAuth adapters register with BrokerManagerV2
// Tests factory registration + basic creation verification

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron-log before any adapter imports
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { BrokerManagerV2 } from '../../../electron/broker/BrokerManagerV2';
import { SchwabAdapter } from '../../../electron/broker/adapters/SchwabAdapter';
import { ETRADEAdapter } from '../../../electron/broker/adapters/ETRADEAdapter';
import { eToroAdapter } from '../../../electron/broker/adapters/eToroAdapter';
import { WebullAdapter } from '../../../electron/broker/adapters/WebullAdapter';
import { registerOAuthBrokerFactories, OAUTH_BROKER_DEFAULTS } from '../../../electron/broker/oauth-ipc-registration';
import type { BrokerConfig } from '../../../electron/broker/IBrokerAdapter';

// Mock fetch for all adapters (OAuth flows trigger HTTP calls)
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock electron shell.openExternal
vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
  app: { getPath: vi.fn().mockReturnValue('/mock/path') },
}));

describe('OAuth Adapter Registration (R3 OAU-05)', () => {
  let manager: BrokerManagerV2;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BrokerManagerV2({ autoReconnect: false });
  });

  // ═══ Factory Registration ═══════════════════════════

  it('should register all 4 OAuth factories without errors', () => {
    expect(() => registerOAuthBrokerFactories(manager)).not.toThrow();
  });

  it('should create SchwabAdapter from factory (OAuth2 PKCE)', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('schwab')({
      id: 'test-schwab', name: 'Test Schwab', type: 'schwab',
      host: 'api.schwabapi.com', port: 443, enabled: true,
      apiKey: 'mock-client-id', secretKey: 'mock-client-secret',
    });
    expect(adapter).toBeInstanceOf(SchwabAdapter);
    expect(adapter.id).toBe('test-schwab');
    expect(adapter.name).toBe('Test Schwab');
    expect(adapter.getBrokerType()).toBe('schwab');
  });

  it('should create ETRADEAdapter from factory (OAuth1.0a)', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('etrade')({
      id: 'test-etrade', name: 'Test E*TRADE', type: 'etrade',
      host: 'api.etrade.com', port: 443, enabled: true,
      apiKey: 'mock-consumer-key', secretKey: 'mock-consumer-secret',
    });
    expect(adapter).toBeInstanceOf(ETRADEAdapter);
    expect(adapter.id).toBe('test-etrade');
    expect(adapter.getBrokerType()).toBe('etrade');
  });

  it('should create eToroAdapter from factory (OAuth2)', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('etoro')({
      id: 'test-etoro', name: 'Test eToro', type: 'etoro',
      host: 'api.etoro.com', port: 443, enabled: true,
      apiKey: 'mock-api-key', secretKey: 'mock-secret',
    });
    expect(adapter).toBeInstanceOf(eToroAdapter);
    expect(adapter.id).toBe('test-etoro');
    expect(adapter.getBrokerType()).toBe('etoro');
  });

  it('should create WebullAdapter from factory (OAuth2 + Paper)', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('webull')({
      id: 'test-webull', name: 'Test Webull', type: 'webull',
      host: 'api.webull.com', port: 443, enabled: true,
      apiKey: 'mock-client-id', secretKey: 'mock-secret',
      options: { paperTrading: true },
    });
    expect(adapter).toBeInstanceOf(WebullAdapter);
    expect(adapter.id).toBe('test-webull');
    expect(adapter.getBrokerType()).toBe('webull');
  });

  // ═══ OAuth Adapter Properties ════════════════════════

  it('all 4 adapters should implement getMarkets()', () => {
    registerOAuthBrokerFactories(manager);
    const adapters = createAllAdapters(manager);
    for (const a of adapters) {
      const markets = a.getMarkets();
      expect(Array.isArray(markets)).toBe(true);
      expect(markets.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all 4 adapters should implement getSupportedOrderTypes()', () => {
    registerOAuthBrokerFactories(manager);
    const adapters = createAllAdapters(manager);
    for (const a of adapters) {
      const types = a.getSupportedOrderTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toContain('MARKET');
      expect(types).toContain('LIMIT');
    }
  });

  it('all 4 adapters should implement getBrokerType() with correct value', () => {
    registerOAuthBrokerFactories(manager);
    const types: Array<[string, string]> = [
      ['schwab', 'schwab'], ['etrade', 'etrade'], ['etoro', 'etoro'], ['webull', 'webull'],
    ];
    for (const [t, expected] of types) {
      const adapter = (manager as any).adapterFactory.get(t)({
        id: `test-${t}`, name: t, type: t,
        host: '', port: 443, enabled: false,
        apiKey: 'key', secretKey: 'secret',
      });
      expect(adapter.getBrokerType()).toBe(expected);
    }
  });

  it('all 4 adapters should implement requiresLocalGateway() = false', () => {
    registerOAuthBrokerFactories(manager);
    const adapters = createAllAdapters(manager);
    for (const a of adapters) {
      expect(a.requiresLocalGateway()).toBe(false);
    }
  });

  it('all 4 adapters should implement ping()', async () => {
    // Mock ping success
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ accountId: '123', accountType: 'CASH' }]),
      text: () => Promise.resolve(''),
    });

    registerOAuthBrokerFactories(manager);
    const adapters = createAllAdapters(manager);

    for (const a of adapters) {
      // Manually set token to mock auth
      (a as any).token = {
        accessToken: 'mock-token',
        accessTokenSecret: 'mock-secret',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
      };

      const result = await a.ping!();
      expect(result).toHaveProperty('latency');
      expect(result).toHaveProperty('timestamp');
    }
  });

  it('all 4 adapters should implement getConnectionStatus()', () => {
    registerOAuthBrokerFactories(manager);
    const adapters = createAllAdapters(manager);

    for (const a of adapters) {
      const status = a.getConnectionStatus!();
      expect(status).toHaveProperty('brokerId');
      expect(status).toHaveProperty('brokerName');
      expect(status).toHaveProperty('brokerType');
      expect(status).toHaveProperty('connected');
      expect(status.brokerId).toBe(a.id);
      expect(status.connected).toBe(false); // No auth, not connected
    }
  });

  // ═══ OAUTH_BROKER_DEFAULTS ══════════════════════════

  it('OAUTH_BROKER_DEFAULTS should contain 4 entries with unique ids', () => {
    expect(OAUTH_BROKER_DEFAULTS).toHaveLength(4);
    const ids = OAUTH_BROKER_DEFAULTS.map(d => d.id);
    expect(new Set(ids).size).toBe(4); // all unique
  });

  it('OAUTH_BROKER_DEFAULTS should all have enabled=false', () => {
    for (const def of OAUTH_BROKER_DEFAULTS) {
      expect(def.enabled).toBe(false);
    }
  });

  it('OAUTH_BROKER_DEFAULTS should all have BrokerManagerV2-registrable types', () => {
    registerOAuthBrokerFactories(manager);
    for (const def of OAUTH_BROKER_DEFAULTS) {
      const factory = (manager as any).adapterFactory.get(def.type);
      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');

      const adapter = factory(def as BrokerConfig);
      expect(adapter).toBeDefined();
      expect(adapter.id).toBe(def.id);
    }
  });

  // ═══ Adapter-Specific Features ═════════════════════

  it('SchwabAdapter should have getOptionChain(), getMovers(), getMarketHours()', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('schwab')({
      id: 's', name: 's', type: 'schwab', host: '', port: 443, enabled: false,
      apiKey: 'k', secretKey: 's',
    }) as SchwabAdapter;

    expect(typeof adapter.getOptionChain).toBe('function');
    expect(typeof adapter.getMovers).toBe('function');
    expect(typeof adapter.getMarketHours).toBe('function');
  });

  it('ETRADEAdapter should have getOptionChain(), getAlerts()', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('etrade')({
      id: 'e', name: 'e', type: 'etrade', host: '', port: 443, enabled: false,
      apiKey: 'k', secretKey: 's',
    }) as ETRADEAdapter;

    expect(typeof adapter.getOptionChain).toBe('function');
    expect(typeof adapter.getAlerts).toBe('function');
  });

  it('eToroAdapter should have getAgentPortfolio(), copyTrader()', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('etoro')({
      id: 'e', name: 'e', type: 'etoro', host: '', port: 443, enabled: false,
      apiKey: 'k', secretKey: 's',
    }) as eToroAdapter;

    expect(typeof adapter.getAgentPortfolio).toBe('function');
    expect(typeof adapter.copyTrader).toBe('function');
  });

  it('WebullAdapter should have getExtendedHoursQuote(), setPaperMode()', () => {
    registerOAuthBrokerFactories(manager);
    const adapter = (manager as any).adapterFactory.get('webull')({
      id: 'w', name: 'w', type: 'webull', host: '', port: 443, enabled: false,
      apiKey: 'k', secretKey: 's', options: { paperTrading: true },
    }) as WebullAdapter;

    expect(typeof adapter.getExtendedHoursQuote).toBe('function');
    expect(typeof adapter.setPaperMode).toBe('function');
  });
});

// ═══ Helper ════════════════════════════════════════════

function createAllAdapters(manager: BrokerManagerV2) {
  const types = ['schwab', 'etrade', 'etoro', 'webull'] as const;
  return types.map(t =>
    (manager as any).adapterFactory.get(t)({
      id: `test-${t}`, name: t, type: t,
      host: '', port: 443, enabled: false,
      apiKey: 'key', secretKey: 'secret',
    })
  );
}
