// JVS-101: Real-time Data Visualization Service
import log from 'electron-log';
// Real-time market data stream with WebSocket push

export interface RealtimeVisualizationConfig {
  symbols: string[];
  updateInterval: number;  // ms
  enableWebSocket: boolean;
}

export class RealtimeVisualizationService {
  private config: RealtimeVisualizationConfig;
  private isRunning: boolean = false;
  private updateTimer: NodeJS.Timeout | null = null;
  private wsClients: Set<any> = new Set();

  constructor(config?: Partial<RealtimeVisualizationConfig>) {
    this.config = {
      symbols: config?.symbols || [],
      updateInterval: config?.updateInterval || 1000,
      enableWebSocket: config?.enableWebSocket ?? true,
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.updateTimer = setInterval(() => {
      this.fetchAndBroadcast();
    }, this.config.updateInterval);

    log.info(`[RealtimeVisualization] Started with ${this.config.symbols.length} symbols`);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    log.info('[RealtimeVisualization] Stopped');
  }

  addWebSocketClient(client: unknown): void {
    this.wsClients.add(client);
    log.info(`[RealtimeVisualization] Client connected, total: ${this.wsClients.size}`);
  }

  removeWebSocketClient(client: unknown): void {
    this.wsClients.delete(client);
    log.info(`[RealtimeVisualization] Client disconnected, total: ${this.wsClients.size}`);
  }

  private async fetchAndBroadcast(): Promise<void> {
    try {
      // Fetch real-time data for all symbols
      const data = await this.fetchRealtimeData();
      
      // Broadcast to all WebSocket clients
      this.broadcast(data);
    } catch (err) {
      log.error('[RealtimeVisualization] Fetch error:', err);
    }
  }

  private async fetchRealtimeData(): Promise<any> {
    // v1.9.0: data fetching via real-data-orchestrator
    // For now, return mock data
    return {
      timestamp: Date.now(),
      symbols: this.config.symbols.map(symbol => ({
        symbol,
        price: Math.random() * 100,
        change: (Math.random() - 0.5) * 10,
        volume: Math.floor(Math.random() * 1000000)
      }))
    };
  }

  private broadcast(data: unknown): void {
    const message = JSON.stringify(data);
    this.wsClients.forEach(client => {
      try {
        if (client.readyState === 1) { // OPEN
          client.send(message);
        }
      } catch (err) {
        log.error('[RealtimeVisualization] Broadcast error:', err);
      }
    });
  }

  getStatus(): { isRunning: boolean; clientCount: number; symbolCount: number } {
    return {
      isRunning: this.isRunning,
      clientCount: this.wsClients.size,
      symbolCount: this.config.symbols.length
    };
  }
}

let instance: RealtimeVisualizationService | null = null;

export function getRealtimeVisualizationService(): RealtimeVisualizationService {
  if (!instance) {
    instance = new RealtimeVisualizationService();
  }
  return instance;
}
