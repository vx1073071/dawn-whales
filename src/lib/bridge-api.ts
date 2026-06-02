// ── DAWN WHALES — Bridge API Client ────────────────────────────────────────
// Connects to the running Futu Bridge (http://127.0.0.1:38901)
// The bridge handles OpenD protobuf communication

const BRIDGE_URL = 'http://127.0.0.1:38901';

interface BridgeQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  amplitude: number;
  updateTime: string;
}

interface BridgeAccount {
  accId: string;
  trdEnv: string;
  totalAssets: number;
  cash: number;
  power: number;
  marketVal: number;
  todayPnl: number;
  currency: string;
  positions?: any[];
}

async function bridgeFetch(path: string): Promise<any> {
  try {
    const r = await fetch(`${BRIDGE_URL}${path}`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export async function getHealth(): Promise<any> {
  return bridgeFetch('/api/status');
}

export async function getQuotes(): Promise<BridgeQuote[]> {
  // Bridge uses /api/watchlist (returns array directly, not {quotes:[...]})
  const data = await bridgeFetch('/api/watchlist');
  if (Array.isArray(data)) return data;
  return data?.quotes || [];
}

export async function getAccounts(): Promise<BridgeAccount[]> {
  const data = await bridgeFetch('/api/accounts');
  return data?.accounts || [];
}

export async function getKlines(code: string, period: string = 'daily', count: number = 200): Promise<any[]> {
  // Bridge doesn't have /api/klines yet — generate demo data for K-line display
  // TODO: Add real kline endpoint to bridge
  return generateDemoKlines(count);
}

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
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });
    price = close;
  }
  return data;
}

export async function isBridgeAlive(): Promise<boolean> {
  try {
    const r = await fetch(`${BRIDGE_URL}/api/status`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}
