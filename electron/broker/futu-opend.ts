// ── Futu OpenD Client — TCP 直连（和富途牛牛一样的连接方式）──────────────
import net from 'net';
import log from 'electron-log';

export class FutuOpenDClient {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  public version = '';
  private connected = false;
  private reqId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function; timer: NodeJS.Timeout }>();

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.connect(this.port, this.host, () => {
        this.connected = true;
        this.version = 'OpenD connected';
        log.info(`[FutuOpenD] Connected to ${this.host}:${this.port}`);
        resolve();
      });

      this.socket.on('error', (err) => {
        log.error('[FutuOpenD] Connection error:', err.message);
        this.connected = false;
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        log.info('[FutuOpenD] Disconnected');
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });
    });
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
    this.connected = false;
    // Reject all pending
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
      req.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();
  }

  private handleData(data: Buffer) {
    // TODO: Parse protobuf response from OpenD
    // For now, this is a placeholder for the full protocol implementation
    log.debug('[FutuOpenD] Received', data.length, 'bytes');
  }

  // ── Market Data API ─────────────────────────────────────────────

  async getQuotes(codes: string[]): Promise<any> {
    // TODO: Implement GetStockQuote protobuf
    return { success: true, quotes: codes.map(c => ({
      code: c, name: '', price: 0, change: 0, changePct: 0,
      volume: 0, high: 0, low: 0, open: 0, prevClose: 0,
    }))};
  }

  async getKlines(code: string, period: string, count: number): Promise<any> {
    // TODO: Implement RequestHistoryKline / RequestHistoryKline protobuf
    return { success: true, klines: [] };
  }

  // ── Trading API ─────────────────────────────────────────────────

  async getAccounts(): Promise<any> {
    // TODO: Implement TrdGetAccList protobuf
    return { success: true, accounts: [] };
  }

  async getFunds(accountId: string): Promise<any> {
    // TODO: Implement TrdGetFunds protobuf
    return { success: true, funds: {} };
  }

  async getPositions(accountId: string): Promise<any> {
    // TODO: Implement TrdGetPositionList protobuf
    return { success: true, positions: [] };
  }

  async getOrders(accountId: string): Promise<any> {
    // TODO: Implement TrdGetOrderList protobuf
    return { success: true, orders: [] };
  }

  async placeOrder(order: any): Promise<any> {
    // TODO: Implement TrdPlaceOrder protobuf
    log.info('[FutuOpenD] Place order:', order);
    return { success: true, orderId: `ORD-${Date.now()}` };
  }

  async cancelOrder(orderId: string): Promise<any> {
    // TODO: Implement TrdCancelOrder protobuf
    log.info('[FutuOpenD] Cancel order:', orderId);
    return { success: true };
  }
}
