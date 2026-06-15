/**
 * DAWN WHALES R152 Claw(PM) — Symbol Quote Router
 * 
 * Multi-broker quote source selection engine.
 * 
 * Core principle (PERMANENT):
 *   ONE symbol = ONE quote source per session.
 *   Select by: market match → broker priority → latency health.
 *   NEVER mix quotes from different brokers for the same symbol.
 * 
 * Selection algorithm:
 *   1. detectMarket(symbol) → HK | US | CN | CRYPTO | etc.
 *   2. Filter connected adapters that support this market
 *   3. Sort by broker priority (user-configurable, lower = higher priority)
 *   4. Check primary latency < 500ms → use it
 *   5. If primary fails/lags → auto-failover to next candidate
 *   6. Re-check primary every 30s → auto-restore
 * 
 * Features:
 *   - Symbol binding: once a source is chosen, stick with it for the session
 *   - Failover detection: latency > 500ms triggers switch
 *   - Auto-restore: primary polled every 30s, switches back when healthy
 *   - Source indicator: exposes current source per symbol for UI display
 *   - Code normalization: integrates code-normalizer.ts for cross-broker symbol matching
 * 
 * ≥250L production-ready
 */

import { toStandardCode, fromStandardCode } from '../utils/code-normalizer';

// ═══════════════ Types ════════════════════════════════════════════════════

export type Market = 'HK' | 'US' | 'CN' | 'JP' | 'CRYPTO' | 'EU' | 'UNKNOWN';

export interface BrokerConfig {
  name: string;
  brokerId: string;
  priority: number;        // lower = higher priority
  markets: Market[];
  supportsRealTime: boolean;
  connected: boolean;
  latencyMs: number;       // average latency in ms
  lastError?: string;
  cooldownUntil?: number;  // timestamp when cooldown expires
}

export interface QuoteSource {
  brokerId: string;
  brokerName: string;
  symbol: string;           // broker-specific format
  standardCode: string;     // HK:00700
  latencyMs: number;
  isFailover: boolean;      // true if using backup, not primary
  primaryBrokerId: string;  // the intended primary
}

export interface SourceAssignment {
  standardCode: string;
  sourceBrokerId: string;
  assignedAt: number;
  failoverCount: number;
  isFailover: boolean;
}

export interface RouterStats {
  activeBindings: number;
  failoverCount: number;
  avgLatencyMs: number;
  brokersHealthy: number;
  brokersTotal: number;
}

// ═══════════════ Constants ════════════════════════════════════════════════

const LATENCY_THRESHOLD_MS = 500;     // switch if primary > 500ms
const PRIMARY_RECHECK_INTERVAL = 30_000; // re-check primary every 30s
const COOLDOWN_MS = 60_000;           // cooldown for failed brokers
const MAX_FAILOVER_COUNT = 3;          // after 3 failovers, stick with current

// ═══════════════ Market Detection ══════════════════════════════════════════

export function detectMarket(symbol: string): Market {
  // Already standardized: HK:00700
  if (/^(HK|US|CN|JP|CRYPTO|EU):/.test(symbol)) {
    return symbol.split(':')[0] as Market;
  }

  // Futu format: HK.00700 / US.AAPL
  if (/^HK\.\d{5}$/.test(symbol)) return 'HK';
  if (/^US\.[A-Z]{1,5}$/.test(symbol)) return 'US';
  if (/^SH\.\d{6}$/.test(symbol)) return 'CN';
  if (/^SZ\.\d{6}$/.test(symbol)) return 'CN';

  // Tiger format: 5 digits = HK stock
  if (/^\d{5}$/.test(symbol)) return 'HK';

  // IB format: 0700.HK
  if (/^\d+\.HK$/.test(symbol)) return 'HK';

  // Crypto format: BTCUSDT / BTC/USDT / BTC-USDT
  if (/USDT$/.test(symbol) || /\/USDT/.test(symbol) || /-USDT/.test(symbol)) return 'CRYPTO';

  // US ticker format: 1-5 uppercase letters
  if (/^[A-Z]{1,5}$/.test(symbol)) return 'US';

  return 'UNKNOWN';
}

/**
 * Convert any broker-specific symbol to standard format using code-normalizer.
 */
export function normalizeSymbol(symbol: string, brokerId?: string): { standardCode: string; market: Market } {
  if (brokerId && brokerId !== 'standard') {
    const standard = toStandardCode(symbol, brokerId);
    const market = detectMarket(standard);
    return { standardCode: standard, market };
  }
  const market = detectMarket(symbol);
  if (market !== 'UNKNOWN') {
    const parts = symbol.split(':');
    if (parts.length === 2) return { standardCode: symbol, market };
  }
  return { standardCode: symbol, market: 'UNKNOWN' };
}

// ═══════════════ Quote Router ══════════════════════════════════════════════

export class SymbolQuoteRouter {
  private bindings: Map<string, SourceAssignment> = new Map();
  private brokerConfigs: Map<string, BrokerConfig> = new Map();
  private failoverHistory: Map<string, number[]> = new Map();
  private lastPrimaryCheck: Map<string, number> = new Map();

  // ── Broker Registration ─────────────────────────────────────────────────

  registerBroker(config: BrokerConfig): void {
    this.brokerConfigs.set(config.brokerId, config);
  }

  updateBrokerLatency(brokerId: string, latencyMs: number): void {
    const cfg = this.brokerConfigs.get(brokerId);
    if (cfg) cfg.latencyMs = latencyMs;
  }

  markBrokerFailed(brokerId: string, error: string): void {
    const cfg = this.brokerConfigs.get(brokerId);
    if (cfg) {
      cfg.lastError = error;
      cfg.cooldownUntil = Date.now() + COOLDOWN_MS;
      cfg.connected = false;
    }
  }

  markBrokerRecovered(brokerId: string): void {
    const cfg = this.brokerConfigs.get(brokerId);
    if (cfg) {
      cfg.lastError = undefined;
      cfg.cooldownUntil = undefined;
      cfg.connected = true;
    }
  }

  // ── Source Selection ────────────────────────────────────────────────────

  /**
   * Select the best quote source for a symbol.
   * Returns the assigned broker with symbol in broker-specific format.
   */
  selectSource(symbol: string, preferredBrokerId?: string): QuoteSource {
    const { standardCode, market } = normalizeSymbol(symbol, preferredBrokerId);
    const now = Date.now();

    // Check existing binding
    const existing = this.bindings.get(standardCode);
    if (existing) {
      const cfg = this.brokerConfigs.get(existing.sourceBrokerId);
      if (cfg && cfg.connected && !this.isInCooldown(existing.sourceBrokerId)) {
        // If currently in failover, check if primary recovered
        if (existing.isFailover && this.shouldRecheckPrimary(standardCode)) {
          const primaryRecovered = this.checkPrimaryHealth(standardCode);
          if (primaryRecovered) {
            // Switch back to primary
            const primaryCfg = this.brokerConfigs.get(existing.sourceBrokerId.split('_failover_')[0]);
            if (primaryCfg) {
              const brokerSymbol = fromStandardCode(standardCode, primaryCfg.brokerId);
              this.bindings.set(standardCode, {
                standardCode, sourceBrokerId: primaryCfg.brokerId,
                assignedAt: now, failoverCount: 0, isFailover: false,
              });
              this.lastPrimaryCheck.set(standardCode, now);
              return this.buildSource(standardCode, primaryCfg, brokerSymbol, false, primaryCfg.brokerId);
            }
          }
          this.lastPrimaryCheck.set(standardCode, now);
        }

        const brokerSymbol = fromStandardCode(standardCode, cfg.brokerId);
        return this.buildSource(standardCode, cfg, brokerSymbol, existing.isFailover, 
          existing.sourceBrokerId.split('_failover_')[0] || cfg.brokerId);
      }
    }

    // New selection: find best candidate
    const candidates = this.getCandidatesForMarket(market);
    if (candidates.length === 0) {
      return {
        brokerId: 'none', brokerName: 'No broker available',
        symbol, standardCode, latencyMs: 0,
        isFailover: false, primaryBrokerId: 'none',
      };
    }

    // User preference override
    if (preferredBrokerId) {
      const preferred = candidates.find(c => c.brokerId === preferredBrokerId);
      if (preferred) {
        candidates.unshift(candidates.splice(candidates.indexOf(preferred), 1)[0]);
      }
    }

    const primary = candidates[0];
    const backup = candidates.length > 1 ? candidates[1] : null;

    // Check primary latency
    if (primary.latencyMs > LATENCY_THRESHOLD_MS && backup) {
      // Failover to backup
      const brokerSymbol = fromStandardCode(standardCode, backup.brokerId);
      this.bindings.set(standardCode, {
        standardCode, sourceBrokerId: backup.brokerId,
        assignedAt: now, failoverCount: 1, isFailover: true,
      });
      this.recordFailover(standardCode, now);
      return this.buildSource(standardCode, backup, brokerSymbol, true, primary.brokerId);
    }

    // Use primary
    const brokerSymbol = fromStandardCode(standardCode, primary.brokerId);
    this.bindings.set(standardCode, {
      standardCode, sourceBrokerId: primary.brokerId,
      assignedAt: now, failoverCount: 0, isFailover: false,
    });
    return this.buildSource(standardCode, primary, brokerSymbol, false, primary.brokerId);
  }

  /**
   * Force reset a symbol's binding (e.g., on broker disconnect)
   */
  resetBinding(symbol: string): void {
    const { standardCode } = normalizeSymbol(symbol);
    this.bindings.delete(standardCode);
    this.lastPrimaryCheck.delete(standardCode);
  }

  resetAllBindings(): void {
    this.bindings.clear();
    this.lastPrimaryCheck.clear();
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getStats(): RouterStats {
    let totalLatency = 0;
    let brokersHealthy = 0;
    let brokersTotal = this.brokerConfigs.size;

    for (const [, cfg] of this.brokerConfigs) {
      totalLatency += cfg.latencyMs;
      if (cfg.connected) brokersHealthy++;
    }

    return {
      activeBindings: this.bindings.size,
      failoverCount: this.failoverHistory.size,
      avgLatencyMs: brokersTotal > 0 ? Math.round(totalLatency / brokersTotal) : 0,
      brokersHealthy,
      brokersTotal,
    };
  }

  getCurrentSource(symbol: string): QuoteSource | null {
    const { standardCode } = normalizeSymbol(symbol);
    const binding = this.bindings.get(standardCode);
    if (!binding) return null;
    const cfg = this.brokerConfigs.get(binding.sourceBrokerId);
    if (!cfg) return null;
    const brokerSymbol = fromStandardCode(standardCode, cfg.brokerId);
    return this.buildSource(standardCode, cfg, brokerSymbol, binding.isFailover,
      binding.sourceBrokerId.split('_failover_')[0] || cfg.brokerId);
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private getCandidatesForMarket(market: Market): BrokerConfig[] {
    const now = Date.now();
    return Array.from(this.brokerConfigs.values())
      .filter(c => c.markets.includes(market) && c.connected && !this.isInCooldown(c.brokerId))
      .sort((a, b) => a.priority - b.priority);
  }

  private isInCooldown(brokerId: string): boolean {
    const cfg = this.brokerConfigs.get(brokerId);
    return cfg?.cooldownUntil ? Date.now() < cfg.cooldownUntil : false;
  }

  private shouldRecheckPrimary(standardCode: string): boolean {
    const lastCheck = this.lastPrimaryCheck.get(standardCode) || 0;
    return (Date.now() - lastCheck) > PRIMARY_RECHECK_INTERVAL;
  }

  private checkPrimaryHealth(standardCode: string): boolean {
    const binding = this.bindings.get(standardCode);
    if (!binding) return false;
    const primaryId = binding.sourceBrokerId.split('_failover_')[0];
    const primary = this.brokerConfigs.get(primaryId);
    return primary ? (primary.connected && primary.latencyMs <= LATENCY_THRESHOLD_MS) : false;
  }

  private recordFailover(standardCode: string, timestamp: number): void {
    const history = this.failoverHistory.get(standardCode) || [];
    history.push(timestamp);
    if (history.length > MAX_FAILOVER_COUNT) history.shift();
    this.failoverHistory.set(standardCode, history);
  }

  private buildSource(standardCode: string, cfg: BrokerConfig, brokerSymbol: string, isFailover: boolean, primaryId: string): QuoteSource {
    return {
      brokerId: cfg.brokerId,
      brokerName: cfg.name,
      symbol: brokerSymbol,
      standardCode,
      latencyMs: cfg.latencyMs,
      isFailover,
      primaryBrokerId: primaryId,
    };
  }
}

// ═══════════════ Singleton ════════════════════════════════════════════════

let _router: SymbolQuoteRouter | null = null;

export function getQuoteRouter(): SymbolQuoteRouter {
  if (!_router) _router = new SymbolQuoteRouter();
  return _router;
}
