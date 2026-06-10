// ── OpenD Connection Validator (JVS-47) ─────────────────────────────────────
// Validates futu-opend connectivity and basic API calls
// Tests: connectivity, getGlobalState, getSnapshot, market availability

export interface OpenDConnectionConfig {
  host: string;
  port: number;
  timeout: number;
}

export interface OpenDValidationResult {
  connected: boolean;
  connectionTime: number;
  error?: string;
  globalState?: unknown;
  snapshot?: unknown;
  availableMarkets: string[];
  latency: number;
}

export interface MarketAvailability {
  market: string;
  available: boolean;
  lastUpdate?: number;
  error?: string;
}

const DEFAULT_CONFIG: OpenDConnectionConfig = {
  host: '127.0.0.1',
  port: 11111,
  timeout: 10000,
};

// ── OpenD Connection Tester ────────────────────────────────────────────────

export class OpenDConnectionValidator {
  private config: OpenDConnectionConfig;
  private opendClient: unknown = null;

  constructor(config?: Partial<OpenDConnectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Test basic TCP connectivity to OpenD
   */
  async testConnectivity(): Promise<{ connected: boolean; latency: number; error?: string }> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(this.config.timeout);
      
      socket.connect(this.config.port, this.config.host, () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({ connected: true, latency });
      });
      
      socket.on('error', (err) => {
        socket.destroy();
        resolve({ 
          connected: false, 
          latency: Date.now() - startTime,
          error: `Connection failed: ${err.message}`
        });
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ 
          connected: false, 
          latency: Date.now() - startTime,
          error: 'Connection timeout'
        });
      });
    });
  }

  /**
   * Test getGlobalState API call
   */
  async testGetGlobalState(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      // Try to get global state via IPC
      const { ipcRenderer } = require('electron');
      const result = await ipcRenderer.invoke('broker:getGlobalState');
      
      if (result && result.success) {
        return { success: true, data: result.data };
      } else {
        return { success: false, error: result?.error || 'Unknown error' };
      }
    } catch (err: unknown) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Test getSnapshot API call
   */
  async testGetSnapshot(symbol: string = 'HK.00700'): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const { ipcRenderer } = require('electron');
      const result = await ipcRenderer.invoke('broker:getSnapshot', { code: symbol });
      
      if (result && result.success) {
        return { success: true, data: result.snapshot };
      } else {
        return { success: false, error: result?.error || 'Unknown error' };
      }
    } catch (err: unknown) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Test market availability by trying to fetch quotes
   */
  async testMarketAvailability(markets: string[] = ['HK', 'US', 'CN']): Promise<MarketAvailability[]> {
    const results: MarketAvailability[] = [];
    
    const testSymbols: Record<string, string> = {
      'HK': 'HK.00700',  // Tencent
      'US': 'US.AAPL',   // Apple
      'CN': 'CN.600519', // Moutai
    };

    for (const market of markets) {
      const symbol = testSymbols[market];
      if (!symbol) {
        results.push({ market, available: false, error: 'Unknown market' });
        continue;
      }

      try {
        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('broker:getQuotes', { codes: [symbol] });
        
        if (result && result.success && result.quotes && result.quotes.length > 0) {
          results.push({ 
            market, 
            available: true, 
            lastUpdate: Date.now()
          });
        } else {
          results.push({ 
            market, 
            available: false, 
            error: result?.error || 'No data'
          });
        }
      } catch (err: unknown) {
        results.push({ market, available: false, error: err.message });
      }
    }

    return results;
  }

  /**
   * Run full validation
   */
  async validate(): Promise<OpenDValidationResult> {
    const startTime = Date.now();
    
    // Step 1: Test connectivity
    const connectivity = await this.testConnectivity();
    
    if (!connectivity.connected) {
      return {
        connected: false,
        connectionTime: connectivity.latency,
        error: connectivity.error,
        availableMarkets: [],
        latency: connectivity.latency,
      };
    }

    // Step 2: Test getGlobalState
    const globalStateResult = await this.testGetGlobalState();
    
    // Step 3: Test getSnapshot
    const snapshotResult = await this.testGetSnapshot();
    
    // Step 4: Test market availability
    const marketAvailability = await this.testMarketAvailability();
    const availableMarkets = marketAvailability
      .filter(m => m.available)
      .map(m => m.market);

    const connectionTime = Date.now() - startTime;

    return {
      connected: true,
      connectionTime,
      globalState: globalStateResult.data,
      snapshot: snapshotResult.data,
      availableMarkets,
      latency: connectivity.latency,
    };
  }

  /**
   * Get connection status summary
   */
  async getStatus(): Promise<{
    connected: boolean;
    latency: number;
    availableMarkets: string[];
    lastValidation?: number;
  }> {
    const result = await this.validate();
    
    return {
      connected: result.connected,
      latency: result.latency,
      availableMarkets: result.availableMarkets,
      lastValidation: Date.now(),
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let validatorInstance: OpenDConnectionValidator | null = null;

export function getOpenDValidator(config?: Partial<OpenDConnectionConfig>): OpenDConnectionValidator {
  if (!validatorInstance) {
    validatorInstance = new OpenDConnectionValidator(config);
  }
  return validatorInstance;
}
