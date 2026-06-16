// ── Futu OpenD TCP Client — Extends OpenDBaseAdapter ─────────────────────────
// Futu-specific adapter using the shared OpenD base class for TCP connection,
// protocol framing, quote parsing, and order management.
//
// Keeps: Futu-specific contract mapping, client ID, default port (11111),
//        and legacy single-callback push API for backward compatibility.
//
// Ported from trading-blueprint-git/bridge-source/index.ts
// Uses futu-api protobuf definitions + raw TCP (net.Socket)
//
// J-29-01: Refactored to extend OpenDBaseAdapter

import log from 'electron-log';
import {
  OpenDBaseAdapter,
  type ContractInfo,
} from './opend-base-adapter';
import type { QuoteInfo } from './IBrokerAdapter';

// ── Futu-Specific Contract Mapping ──────────────────────────────────────────

/** Futu-specific security contract information */
const FUTU_CONTRACTS: Record<string, ContractInfo> = {
  'US.AAPL':  { name: 'Apple Inc.',        market: 'US', lotSize: 1,   basePrice: 155 },
  'US.TSLA':  { name: 'Tesla Inc.',        market: 'US', lotSize: 1,   basePrice: 210 },
  'US.NVDA':  { name: 'NVIDIA Corp.',      market: 'US', lotSize: 1,   basePrice: 880 },
  'US.MSFT':  { name: 'Microsoft Corp.',   market: 'US', lotSize: 1,   basePrice: 420 },
  'US.GOOGL': { name: 'Alphabet Inc.',     market: 'US', lotSize: 1,   basePrice: 155 },
  'US.AMZN':  { name: 'Amazon.com Inc.',   market: 'US', lotSize: 1,   basePrice: 185 },
  'US.META':  { name: 'Meta Platforms',    market: 'US', lotSize: 1,   basePrice: 490 },
  'US.SPY':   { name: 'SPDR S&P 500 ETF', market: 'US', lotSize: 1,   basePrice: 520 },
  'US.QQQ':   { name: 'Invesco QQQ Trust', market: 'US', lotSize: 1,   basePrice: 445 },
  'US.TQQQ':  { name: 'ProShares UltraPro QQQ', market: 'US', lotSize: 1, basePrice: 52 },
  'US.SQQQ':  { name: 'ProShares UltraPro Short QQQ', market: 'US', lotSize: 1, basePrice: 28 },
  'US.SOXL':  { name: 'Direxion Daily Semiconductor Bull 3X', market: 'US', lotSize: 1, basePrice: 35 },
  'US.SOXS':  { name: 'Direxion Daily Semiconductor Bear 3X', market: 'US', lotSize: 1, basePrice: 22 },
  'US.IWM':   { name: 'iShares Russell 2000 ETF', market: 'US', lotSize: 1, basePrice: 200 },
  'US.GLD':   { name: 'SPDR Gold Shares',  market: 'US', lotSize: 1,   basePrice: 215 },
  'HK.00700': { name: 'Tencent Holdings',  market: 'HK', lotSize: 100, basePrice: 380 },
  'HK.09988': { name: 'Alibaba HK',        market: 'HK', lotSize: 100, basePrice: 85 },
  'HK.03690': { name: 'Meituan',           market: 'HK', lotSize: 100, basePrice: 130 },
  'HK.09888': { name: 'Baidu HK',          market: 'HK', lotSize: 50,  basePrice: 95 },
  'HK.01810': { name: 'Xiaomi Corp.',      market: 'HK', lotSize: 200, basePrice: 18 },
};

// ── FutuOpenDClient Class ───────────────────────────────────────────────────

/**
 * Futu OpenD TCP client adapter.
 * Extends OpenDBaseAdapter with Futu-specific defaults:
 *   - Default port: 11111
 *   - Client ID: "QuantMoo-Desktop"
 *   - Futu contract mapping with HK + US securities
 *   - Simple connect (no mock fallback — throws on failure)
 */
export class FutuOpenDClient extends OpenDBaseAdapter {
  readonly id: string;
  readonly type: string = 'futu';
  readonly name: string;

  constructor(host: string = '127.0.0.1', port: number = 11111) {
    super({ host, port });
    this.id = `futu-${host}:${port}`;
    this.name = 'Futu OpenD';
    log.info(`[FutuOpenD] Initialized: ${this.id} (${host}:${port})`);
  }

  // ── Abstract Method Implementations ───────────────────────────────────

  getAdapterName(): string {
    return 'FutuOpenD';
  }

  getDefaultPort(): number {
    return 11111;
  }

  getClientId(): string {
    return 'QuantMoo-Desktop';
  }

  getContractMapping(): Record<string, ContractInfo> {
    return FUTU_CONTRACTS;
  }

  /**
   * Generate a mock quote for the given security code using Futu contract data.
   * Produces realistic random price movement around the contract base price.
   */
  generateMockQuote(code: string): QuoteInfo {
    const contract = FUTU_CONTRACTS[code];
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

  // ── Connection Override (no mock fallback) ────────────────────────────

  /**
   * Connect to Futu OpenD via TCP.
   * Unlike MoomooAdapter, this does NOT fall back to mock mode on failure —
   * it throws the error directly for the caller to handle.
   */
  async connect(): Promise<void> {
    log.info(`[FutuOpenD] Connecting to ${this.host}:${this.port}...`);
    await this.connectTCP();
  }

  // ── Backward-Compatible Push API ──────────────────────────────────────

  /**
   * Override base class onQuotePush for backward compatibility.
   * The original FutuOpenDClient used a single-callback model (set, not add).
   * BrokerManager and main.ts rely on this replace semantics.
   */
  onQuotePush(callback: (quotes: any[]) => void): void {
    // Clear all existing callbacks and set this one (replace semantics)
    this.quoteCallbacks = [callback];
  }

  /**
   * Override base class onDisconnect for backward compatibility.
   * Same single-callback replace semantics as onQuotePush.
   */
  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks = [callback];
  }
}
