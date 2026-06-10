// OpenD WebSocket Client Stub
// Real implementation should connect to Futu OpenD WebSocket API

export class OpenDClient {
  private ws: WebSocket | null = null;
  private callbacks: Map<string, ((data: unknown) => void)[]> = new Map();

  async connect(url: string, codes: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
          // Subscribe to stock quotes
          this.ws?.send(JSON.stringify({ cmd: 'subscribe', codes }));
          resolve();
        };
        this.ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          const handlers = this.callbacks.get(data.type) || [];
          handlers.forEach((cb) => cb(data));
        };
        this.ws.onerror = (err) => reject(err);
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  on(type: string, callback: (data: unknown) => void): void {
    const handlers = this.callbacks.get(type) || [];
    handlers.push(callback);
    this.callbacks.set(type, handlers);
  }

  off(type: string, callback: (data: unknown) => void): void {
    const handlers = this.callbacks.get(type) || [];
    this.callbacks.set(
      type,
      handlers.filter((cb) => cb !== callback)
    );
  }

  async getQuotes(codes: string[]): Promise<any[]> {
    // Fallback: return mock data if WebSocket is not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return codes.map((code) => ({
        code,
        price: 0,
        change: 0,
        changePercent: 0,
        volume: 0,
      }));
    }
    return new Promise((resolve) => {
      const handler = (data: unknown) => {
        if (data.type === 'quotes') {
          this.off('quotes', handler);
          resolve(data.quotes || []);
        }
      };
      this.on('quotes', handler);
      this.ws?.send(JSON.stringify({ cmd: 'getQuotes', codes }));
    });
  }
}
