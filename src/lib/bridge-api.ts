// ── DAWN WHALES — IPC API Client (直连 OpenD，通过 Electron IPC) ──────────────
// Replaces the old bridge-api.ts that used HTTP to the Bridge.
// Now communicates directly with OpenD via Electron Main Process.

declare global {
  interface Window {
    api: {
      broker: {
        connect: (config: any) => Promise<any>;
        disconnect: () => Promise<any>;
        getAccounts: () => Promise<any>;
        getFunds: (accountId: string) => Promise<any>;
        getPositions: (accountId: string) => Promise<any>;
        getQuotes: (codes: string[]) => Promise<any>;
        getKlines: (code: string, period: string, count: number) => Promise<any>;
        placeOrder: (order: any) => Promise<any>;
        cancelOrder: (orderId: string) => Promise<any>;
        getOrders: (accountId: string) => Promise<any>;
      };
      strategy: {
        create: (dsl: any) => Promise<any>;
        backtest: (config: any) => Promise<any>;
        startLive: (id: string) => Promise<any>;
        stopLive: (id: string) => Promise<any>;
      };
      db: {
        getStrategies: () => Promise<any>;
        saveStrategy: (s: any) => Promise<any>;
        getSettings: () => Promise<any>;
        saveSettings: (s: any) => Promise<any>;
      };
      app: {
        getInfo: () => Promise<any>;
        getMemoryUsage: () => Promise<any>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

function hasIPC(): boolean {
  return typeof window !== 'undefined' && !!window.api?.broker;
}

export async function getKlines(code: string, period: string = 'daily', count: number = 200): Promise<any[]> {
  if (!hasIPC()) return generateDemoKlines(count);
  const result = await window.api.broker.getKlines(code, period, count);
  if (result?.success && result.klines?.length > 0) return result.klines;
  return generateDemoKlines(count);
}

export async function getAccounts(): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getAccounts();
  if (result?.success) return result.accounts || [];
  return [];
}

export async function getFunds(accountId: string): Promise<any> {
  if (!hasIPC()) return null;
  const result = await window.api.broker.getFunds(accountId);
  if (result?.success) return result.funds;
  return null;
}

export async function getPositions(accountId: string): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getPositions(accountId);
  if (result?.success) return result.positions || [];
  return [];
}

export async function isConnected(): Promise<boolean> {
  if (!hasIPC()) {
    console.log('[API] No IPC available (not in Electron)');
    return false;
  }
  try {
    const result = await window.api.broker.getAccounts();
    console.log('[API] isConnected:', result);
    return result?.success === true;
  } catch (err) {
    console.log('[API] isConnected error:', err);
    return false;
  }
}

export async function getQuotes(codes: string[] = []): Promise<any[]> {
  if (!hasIPC()) return [];
  const result = await window.api.broker.getQuotes(codes);
  console.log('[API] getQuotes result:', result?.success, result?.quotes?.length);
  if (result?.success) return result.quotes || [];
  return [];
}

// Demo K-line generator (fallback when OpenD kline fails)
function generateDemoKlines(count: number): any[] {
  const data: any[] = [];
  let price = 100 + Math.random() * 50;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 86400;
  const startTime = now - count * daySeconds;

  for (let i = 0; i < count; i++) {
    const volatility = 0.02 + Math.random() * 0.03;
    const change = (Math.random() - 0.48) * volatility * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    data.push({
      time: startTime + i * daySeconds,
      open: +open.toFixed(2), high: +high.toFixed(2),
      low: +low.toFixed(2), close: +close.toFixed(2), volume,
    });
    price = close;
  }
  return data;
}
