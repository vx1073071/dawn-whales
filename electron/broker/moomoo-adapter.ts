/**
 * Moomoo OpenD Adapter — Extends OpenDBaseAdapter
 *
 * Implements IBrokerAdapter for Moomoo broker integration via the shared
 * OpenD base class. Moomoo uses the same OpenD protocol as Futu but with
 * different defaults (port 11211) and Moomoo-specific features:
 *
 *   - Mock mode (default fallback, no network required)
 *   - Auto-fallback to mock if TCP connection fails
 *   - Multi-currency support (USD, HKD, SGD)
 *   - Configurable language and market preferences
 *   - Currency conversion utility
 *
 * J-29-01: Refactored to extend OpenDBaseAdapter
 */

import log from 'electron-log';
import type {
  BrokerConfig,
  AccountInfo,
  FundsInfo,
  QuoteInfo,
  PlaceOrderRequest,
} from './IBrokerAdapter';
import {
  OpenDBaseAdapter,
  type ContractInfo,
  type OpenDBaseConfig,
} from './opend-base-adapter';

// ── Constants ───────────────────────────────────────────────────────────────

/** Default Moomoo OpenD port */
const DEFAULT_PORT = 11211;

// ── Moomoo-Specific Types ───────────────────────────────────────────────────

export interface MoomooConfig extends BrokerConfig {
  language?: 'en' | 'zh-CN' | 'zh-HK';
  market?: 'US' | 'HK' | 'SG';
  currency?: 'USD' | 'HKD' | 'SGD';
  /** Maximum reconnect attempts before giving up */
  maxReconnectAttempts?: number;
  /** Enable auto-reconnect on disconnect */
  autoReconnect?: boolean;
}

// ── Moomoo Contract Mapping ─────────────────────────────────────────────────

/** Moomoo-specific security contract information */
const MOOMOO_CONTRACTS: Record<string, ContractInfo> = {
  'US.AAPL':  { name: 'Apple Inc.',        market: 'US', lotSize: 1,   basePrice: 155, currency: 'USD' },
  'US.TSLA':  { name: 'Tesla Inc.',        market: 'US', lotSize: 1,   basePrice: 210, currency: 'USD' },
  'US.NVDA':  { name: 'NVIDIA Corp.',      market: 'US', lotSize: 1,   basePrice: 880, currency: 'USD' },
  'US.MSFT':  { name: 'Microsoft Corp.',   market: 'US', lotSize: 1,   basePrice: 420, currency: 'USD' },
  'US.GOOGL': { name: 'Alphabet Inc.',     market: 'US', lotSize: 1,   basePrice: 155, currency: 'USD' },
  'US.AMZN':  { name: 'Amazon.com Inc.',   market: 'US', lotSize: 1,   basePrice: 185, currency: 'USD' },
  'US.META':  { name: 'Meta Platforms',    market: 'US', lotSize: 1,   basePrice: 490, currency: 'USD' },
  'US.SPY':   { name: 'SPDR S&P 500 ETF', market: 'US', lotSize: 1,   basePrice: 520, currency: 'USD' },
  'US.QQQ':   { name: 'Invesco QQQ Trust', market: 'US', lotSize: 1,   basePrice: 445, currency: 'USD' },
  'US.TQQQ':  { name: 'ProShares UltraPro QQQ', market: 'US', lotSize: 1, basePrice: 52, currency: 'USD' },
  'US.SQQQ':  { name: 'ProShares UltraPro Short QQQ', market: 'US', lotSize: 1, basePrice: 28, currency: 'USD' },
  'US.SOXL':  { name: 'Direxion Daily Semiconductor Bull 3X', market: 'US', lotSize: 1, basePrice: 35, currency: 'USD' },
  'US.SOXS':  { name: 'Direxion Daily Semiconductor Bear 3X', market: 'US', lotSize: 1, basePrice: 22, currency: 'USD' },
  'US.IWM':   { name: 'iShares Russell 2000 ETF', market: 'US', lotSize: 1, basePrice: 200, currency: 'USD' },
  'US.GLD':   { name: 'SPDR Gold Shares',  market: 'US', lotSize: 1,   basePrice: 215, currency: 'USD' },
  'HK.00700': { name: 'Tencent Holdings',  market: 'HK', lotSize: 100, basePrice: 380, currency: 'HKD' },
  'HK.09988': { name: 'Alibaba HK',        market: 'HK', lotSize: 100, basePrice: 85,  currency: 'HKD' },
  'SG.D05':   { name: 'DBS Group',         market: 'SG', lotSize: 100, basePrice: 35,  currency: 'SGD' },
};

// ── Currency Exchange Rates ─────────────────────────────────────────────────

/** Static exchange rate table for mock-mode currency conversion */
const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  'USD': { 'HKD': 7.78, 'SGD': 1.35 },
  'HKD': { 'USD': 0.128, 'SGD': 0.174 },
  'SGD': { 'USD': 0.74, 'HKD': 5.76 },
};

// ── MoomooAdapter Class ─────────────────────────────────────────────────────

/**
 * Moomoo OpenD adapter extending the shared OpenDBaseAdapter.
 *
 * Adds Moomoo-specific behavior on top of the base class:
 *   - Connect with mock-first fallback (TCP attempt → mock on failure)
 *   - MoomooConfig with language/market/currency preferences
 *   - Currency conversion utility
 *   - Customizable mock accounts/positions/funds with Moomoo branding
 */
export class MoomooAdapter extends OpenDBaseAdapter {
  readonly id: string;
  readonly type: string = 'moomoo';
  readonly name: string;

  private config: MoomooConfig;

  constructor(config: MoomooConfig) {
    super({
      host: config.host || '127.0.0.1',
      port: config.port || DEFAULT_PORT,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 20,
      autoReconnect: config.autoReconnect ?? true,
    });

    this.id = config.id || 'moomoo-default';
    this.name = config.name || 'Moomoo';
    this.config = {
      ...config,
      host: this.host,
      port: this.port,
      language: config.language || 'en',
      market: config.market || 'US',
      currency: config.currency || 'USD',
      maxReconnectAttempts: config.maxReconnectAttempts ?? 20,
      autoReconnect: config.autoReconnect ?? true,
    };

    log.info(`[MoomooAdapter] Initialized: ${this.id} (${this.host}:${this.port})`);
  }

  // ── Abstract Method Implementations ───────────────────────────────────

  getAdapterName(): string {
    return 'MoomooAdapter';
  }

  getDefaultPort(): number {
    return DEFAULT_PORT;
  }

  getClientId(): string {
    return 'DawnWhales-Moomoo';
  }

  getContractMapping(): Record<string, ContractInfo> {
    return MOOMOO_CONTRACTS;
  }

  /**
   * Generate a mock quote for the given security code.
   * Uses Moomoo contract base prices for realistic simulation.
   */
  generateMockQuote(code: string): QuoteInfo {
    const contract = MOOMOO_CONTRACTS[code];
    const basePrice = contract?.basePrice ?? 100;
    const change = (Math.random() - 0.48) * basePrice * 0.03;
    const price = basePrice + change;
    const prevClose = basePrice - (Math.random() - 0.5) * basePrice * 0.02;

    return {
      code,
      price: +price.toFixed(2),
      change: +(price - prevClose).toFixed(2),
      changePct: +(((price - prevClose) / prevClose) * 100).toFixed(2),
      volume: Math.floor(Math.random() * 1000000) + 100000,
      turnover: Math.floor(Math.random() * 100000000),
      high: +(price + Math.random() * basePrice * 0.01).toFixed(2),
      low: +(price - Math.random() * basePrice * 0.01).toFixed(2),
      open: +(basePrice + (Math.random() - 0.5) * basePrice * 0.01).toFixed(2),
      prevClose: +prevClose.toFixed(2),
      time: new Date().toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONNECTION — Mock-first with auto-fallback
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Connect to Moomoo OpenD. Tries TCP first; if it fails, automatically
   * falls back to mock mode (no throw). This is the key difference from
   * FutuOpenDClient which throws on connection failure.
   */
  async connect(): Promise<void> {
    log.info(`[MoomooAdapter] Connecting to ${this.host}:${this.port}...`);

    const tcpOk = await this.connectReal();

    if (!tcpOk) {
      log.warn('[MoomooAdapter] TCP connection unavailable — falling back to mock mode');
      this.mockMode = true;
    }

    this.connected = true;
    this.startQuotePushIfNeeded();
    log.info(`[MoomooAdapter] Connected (mock=${this.mockMode})`);
  }

  /**
   * Attempt a real TCP connection to Moomoo OpenD.
   * Returns true on success, false on failure (never throws).
   * On failure, cleans up socket state gracefully.
   */
  private async connectReal(): Promise<boolean> {
    try {
      await this.connectTCP();
      return true;
    } catch (err) {
      log.warn(`[MoomooAdapter] TCP connect failed: ${err.message}`);
      this.cleanupSocket();
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  MOCK DATA OVERRIDES — Moomoo-branded accounts/positions/funds
  // ════════════════════════════════════════════════════════════════════════

  protected getMockAccounts(): AccountInfo[] {
    return [
      {
        accountId: 'MOOMOO-001',
        name: 'Moomoo Demo Account',
        currency: this.config.currency || 'USD',
        netAssets: 100000,
        totalAssets: 100000,
        cash: 50000,
        marketValue: 50000,
      },
    ];
  }

  protected getMockFunds(): FundsInfo {
    return {
      totalAssets: 100000,
      cash: 50000,
      marketValue: 50000,
      frozenCash: 0,
      availableCash: 50000,
      currency: this.config.currency || 'USD',
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CURRENCY CONVERSION (Moomoo-specific)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Convert an amount between currencies using static exchange rates.
   * Returns the original amount if from === to.
   */
  async convertCurrency(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const rate = EXCHANGE_RATES[from]?.[to] || 1.0;
    return amount * rate;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CONFIG ACCESSOR
  // ════════════════════════════════════════════════════════════════════════

  /** Get a copy of the Moomoo-specific configuration */
  getConfig(): MoomooConfig {
    return { ...this.config };
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createMoomooAdapter(config?: Partial<MoomooConfig>): MoomooAdapter {
  return new MoomooAdapter({
    id: config?.id || 'moomoo-default',
    name: config?.name || 'Moomoo',
    type: 'moomoo',
    host: config?.host || '127.0.0.1',
    port: config?.port || DEFAULT_PORT,
    enabled: config?.enabled !== false,
    ...config,
  } as MoomooConfig);
}
