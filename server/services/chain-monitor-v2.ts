// @ts-nocheck
/**
 * DAWN WHALES R148 J03 — Chain Monitor v2: Resilience
 * 
 * Extends chain-monitor.ts with:
 *   - Exponential backoff reconnection
 *   - Checkpoint-based block scanning (断点续传)
 *   - RPC failover (primary→secondary→tertiary endpoints)
 *   - Health check for chain connectivity
 * 
 * Supported chains: TRC-20 (TronGrid), ERC-20 (Infura/Alchemy)
 * 
 * ≥250L
 */

export type ChainNetwork = 'TRC20' | 'ERC20' | 'BEP20';

export interface ChainRpcEndpoint {
  url: string;
  priority: number; // 1=primary, 2=secondary, 3=tertiary
  status: 'online' | 'offline' | 'degraded';
  lastCheck: number;
  latencyMs: number;
}

export interface Checkpoint {
  network: ChainNetwork;
  address: string;
  lastBlockScanned: number;
  lastTxHash: string;
  updatedAt: string;
}

export interface ChainStatus {
  network: ChainNetwork;
  connected: boolean;
  currentBlock: number;
  endpoints: ChainRpcEndpoint[];
}

// ═══════════════ Reconnection Config ═══════════════════════════════════

const RECONNECT_CONFIG = {
  initialDelayMs: 1000,
  maxDelayMs: 300000,      // 5 min max
  backoffMultiplier: 2,
  maxRetries: 10,          // 10 retries then escalate
  healthCheckIntervalMs: 30000,  // 30s health check
  staleCheckpointHours: 24,      // Mark checkpoint as stale after 24h
};

// ═══════════════ Default RPC Endpoints ═════════════════════════════════

const DEFAULT_RPC_ENDPOINTS: Record<ChainNetwork, ChainRpcEndpoint[]> = {
  TRC20: [
    { url: 'https://api.trongrid.io', priority: 1, status: 'online', lastCheck: 0, latencyMs: 0 },
    { url: 'https://api.trongrid.io/v2', priority: 2, status: 'online', lastCheck: 0, latencyMs: 0 },
  ],
  ERC20: [
    { url: 'https://mainnet.infura.io/v3/default', priority: 1, status: 'online', lastCheck: 0, latencyMs: 0 },
    { url: 'https://eth-mainnet.g.alchemy.com/v2/default', priority: 2, status: 'online', lastCheck: 0, latencyMs: 0 },
    { url: 'https://rpc.ankr.com/eth', priority: 3, status: 'online', lastCheck: 0, latencyMs: 0 },
  ],
  BEP20: [
    { url: 'https://bsc-dataseed.binance.org', priority: 1, status: 'online', lastCheck: 0, latencyMs: 0 },
    { url: 'https://bsc-dataseed1.defibit.io', priority: 2, status: 'online', lastCheck: 0, latencyMs: 0 },
  ],
};

// ═══════════════ Chain Monitor v2 ═══════════════════════════════════════

export class ChainMonitorV2 {
  private endpoints: Map<ChainNetwork, ChainRpcEndpoint[]> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();
  private reconnectState: Map<ChainNetwork, { retries: number; nextDelay: number; timer?: NodeJS.Timeout }> = new Map();
  private healthCheckTimers: Map<ChainNetwork, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize default endpoints
    for (const [network, eps] of Object.entries(DEFAULT_RPC_ENDPOINTS)) {
      this.endpoints.set(network as ChainNetwork, [...eps]);
      this.reconnectState.set(network as ChainNetwork, { retries: 0, nextDelay: RECONNECT_CONFIG.initialDelayMs });
    }
  }

  /**
   * Get active endpoint for a chain (highest priority online endpoint).
   */
  getActiveEndpoint(network: ChainNetwork): ChainRpcEndpoint | null {
    const eps = this.endpoints.get(network) || [];
    const online = eps
      .filter(e => e.status !== 'offline')
      .sort((a, b) => a.priority - b.priority);
    return online[0] || null;
  }

  /**
   * Mark an endpoint as offline and switch to next.
   */
  markOffline(network: ChainNetwork, url: string, reason: string): ChainRpcEndpoint | null {
    const eps = this.endpoints.get(network);
    if (!eps) return null;

    const ep = eps.find(e => e.url === url);
    if (ep) {
      ep.status = 'offline';
      ep.lastCheck = Date.now();
      console.warn(`[ChainMonitor] ${network} endpoint ${url} marked offline: ${reason}`);
    }

    // Trigger reconnection
    this.scheduleReconnect(network);
    return this.getActiveEndpoint(network);
  }

  /**
   * Schedule exponential backoff reconnection.
   */
  private scheduleReconnect(network: ChainNetwork): void {
    const state = this.reconnectState.get(network);
    if (!state) return;

    if (state.retries >= RECONNECT_CONFIG.maxRetries) {
      console.error(`[ChainMonitor] ${network}: max retries (${RECONNECT_CONFIG.maxRetries}) reached — escalating`);
      return;
    }

    // Clear existing timer
    if (state.timer) clearTimeout(state.timer);

    state.timer = setTimeout(() => {
      this.attemptReconnect(network);
    }, state.nextDelay);

    // Update for next retry
    state.nextDelay = Math.min(
      state.nextDelay * RECONNECT_CONFIG.backoffMultiplier,
      RECONNECT_CONFIG.maxDelayMs,
    );
  }

  /**
   * Attempt to reconnect offline endpoints.
   */
  private async attemptReconnect(network: ChainNetwork): Promise<void> {
    const eps = this.endpoints.get(network) || [];
    const state = this.reconnectState.get(network);
    if (!state) return;

    const offline = eps.filter(e => e.status === 'offline');
    if (offline.length === 0) {
      // All online, reset state
      state.retries = 0;
      state.nextDelay = RECONNECT_CONFIG.initialDelayMs;
      return;
    }

    console.log(`[ChainMonitor] ${network}: attempt reconnect #${state.retries + 1}`);

    let anyRecovered = false;
    for (const ep of offline) {
      const online = await this.probeEndpoint(ep.url);
      if (online) {
        ep.status = 'online';
        ep.lastCheck = Date.now();
        ep.latencyMs = online;
        anyRecovered = true;
        console.log(`[ChainMonitor] ${network}: ${ep.url} recovered (${online}ms)`);
      }
    }

    if (anyRecovered) {
      state.retries = 0;
      state.nextDelay = RECONNECT_CONFIG.initialDelayMs;
    } else {
      state.retries++;
      this.scheduleReconnect(network);
    }
  }

  /**
   * Probe an endpoint for connectivity.
   */
  private async probeEndpoint(url: string): Promise<number | false> {
    try {
      const start = Date.now();
      // Mock probe — production would do actual HTTP JSON-RPC call
      // e.g. POST {jsonrpc:"2.0",method:"eth_blockNumber",params:[],id:1}
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        return Date.now() - start;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ═══════════════ Checkpoint (断点续传) ═════════════════════════════════

  /**
   * Save block scanning checkpoint.
   */
  saveCheckpoint(network: ChainNetwork, address: string, blockNumber: number, txHash: string): void {
    const key = `${network}:${address}`;
    this.checkpoints.set(key, {
      network, address,
      lastBlockScanned: blockNumber,
      lastTxHash: txHash,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Get checkpoint for resume scanning.
   */
  getCheckpoint(network: ChainNetwork, address: string): Checkpoint | null {
    const key = `${network}:${address}`;
    return this.checkpoints.get(key) || null;
  }

  /**
   * Resume scanning from last checkpoint.
   */
  getResumeBlock(network: ChainNetwork, address: string, currentBlock: number): number {
    const cp = this.getCheckpoint(network, address);
    if (!cp) return 0; // No checkpoint, scan from genesis

    const age = Date.now() - new Date(cp.updatedAt).getTime();
    if (age > RECONNECT_CONFIG.staleCheckpointHours * 3600000) {
      console.warn(`[ChainMonitor] Checkpoint for ${network}:${address} is stale (${age/3600000}h), may miss data`);
    }

    return Math.max(cp.lastBlockScanned, 0);
  }

  /**
   * Clear checkpoint.
   */
  clearCheckpoint(network: ChainNetwork, address: string): void {
    const key = `${network}:${address}`;
    this.checkpoints.delete(key);
  }

  // ═══════════════ Health Check ═════════════════════════════════════════

  /**
   * Get health status for all chains.
   */
  async getStatus(): Promise<ChainStatus[]> {
    const results: ChainStatus[] = [];

    for (const [network, eps] of this.endpoints) {
      const onlineEp = eps.filter(e => e.status === 'online');
      results.push({
        network: network as ChainNetwork,
        connected: onlineEp.length > 0,
        currentBlock: 0, // Would query actual chain
        endpoints: eps.map(e => ({ ...e })),
      });
    }

    return results;
  }

  /**
   * Start periodic health checks.
   */
  startHealthChecks(): void {
    for (const network of ['TRC20', 'ERC20', 'BEP20'] as ChainNetwork[]) {
      if (this.healthCheckTimers.has(network)) continue;

      const timer = setInterval(() => {
        this.probeAllEndpoints(network);
      }, RECONNECT_CONFIG.healthCheckIntervalMs);

      this.healthCheckTimers.set(network, timer);
    }
    console.log('[ChainMonitor] Health checks started (30s interval)');
  }

  /**
   * Stop periodic health checks.
   */
  stopHealthChecks(): void {
    for (const [network, timer] of this.healthCheckTimers) {
      clearInterval(timer);
      this.healthCheckTimers.delete(network);
    }
    console.log('[ChainMonitor] Health checks stopped');
  }

  private async probeAllEndpoints(network: ChainNetwork): Promise<void> {
    const eps = this.endpoints.get(network);
    if (!eps) return;

    for (const ep of eps) {
      const latency = await this.probeEndpoint(ep.url);
      if (typeof latency === 'number') {
        ep.status = latency < 2000 ? 'online' : 'degraded';
        ep.latencyMs = latency;
        ep.lastCheck = Date.now();
      } else {
        ep.status = 'offline';
        ep.lastCheck = Date.now();
      }
    }
  }
}

// ═══════════════ Helper ═════════════════════════════════════════════════

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
