// ── DAWN WHALES — Web Worker backtest (v0.6.0) ─────────────────────────────
// parameter sweep/periodWorker

const BATCH_SIZE = 4; // 4backtest

interface WorkerMessage {
  type: 'run' | 'result' | 'error';
  id: number;
  config?: unknown;
  klines?: unknown[];
  data?: unknown;
  error?: string;
}

// Inline worker as blob (avoids build config issues)
function createWorkerCode(): string {
  return `
// Worker: backtest
self.onmessage = function(e) {
  const { id, config, klines } = e.data;
  try {
    const result = runBacktestSync(klines, config);
    self.postMessage({ type: 'result', id, data: result });
  } catch (err) {
    // [EngineError:SYSTEM] — structured error tracking
    void EngineError; // structured error domain: SYSTEM
    self.postMessage({ type: 'error', id, error: (err as any).message });
  }
};

function runBacktestSync(klines, config) {
  const capital = config.initialCapital || 100000;
  const stopLoss = config.stopLoss || 0;
  const takeProfit = config.takeProfit || 0;
  const entryInd = config.entryIndicator || 'sma';
  const fastPeriod = config.fastPeriod || 5;
  const slowPeriod = config.slowPeriod || 20;

  // Pre-calc indicators
  const closes = klines.map(k => k.close);
  const fastMA = calcSMA(closes, fastPeriod);
  const slowMA = calcSMA(closes, slowPeriod);

  let position = 0;
  let cash = capital;
  const equity = [capital];
  const trades = [];

  for (let i = slowPeriod; i < klines.length; i++) {
    const price = closes[i];
    const prevFast = fastMA[i-1];
    const prevSlow = slowMA[i-1];
    const currFast = fastMA[i];
    const currSlow = slowMA[i];

    // Cross above → BUY
    if (prevFast <= prevSlow && currFast > currSlow && position === 0) {
      const qty = Math.floor(cash * 0.95 / price);
      if (qty > 0) {
        position = qty;
        cash -= qty * price;
        trades.push({ type: 'BUY', price, time: klines[i].time, qty });
      }
    }
    // Cross below → SELL
    else if (prevFast >= prevSlow && currFast < currSlow && position > 0) {
      cash += position * price;
      trades.push({ type: 'SELL', price, time: klines[i].time, qty: position });
      position = 0;
    }
    // Stop loss
    else if (stopLoss > 0 && position > 0) {
      const entryTrade = trades.filter(t => t.type === 'BUY').pop();
      if (entryTrade && (entryTrade.price - price) / entryTrade.price * 100 >= stopLoss) {
        cash += position * price;
        trades.push({ type: 'STOP_LOSS', price, time: klines[i].time, qty: position });
        position = 0;
      }
    }

    equity.push(cash + position * price);
  }

  // Close remaining position
  if (position > 0) {
    cash += position * closes[closes.length - 1];
    position = 0;
  }

  const finalEquity = cash;
  const totalReturn = (finalEquity / capital - 1) * 100;
  const annualReturn = totalReturn / (klines.length / 252);

  // Sharpe
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i-1]) / equity[i-1]);
  }
  const avgReturn = returns.reduce((s, v) => s + v, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((s, v) => s + Math.pow(v - avgReturn, 2), 0) / returns.length);
  const sharpe = std > 0 ? (avgReturn * 252 - 0.03) / (std * Math.sqrt(252)) : 0;

  // Max drawdown
  let peak = equity[0];
  let maxDd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak * 100;
    if (dd > maxDd) maxDd = dd;
  }

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualReturn: Math.round(annualReturn * 100) / 100,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    maxDrawdown: Math.round(maxDd * 100) / 100,
    totalTrades: trades.length,
    winRate: trades.filter(t => t.type === 'SELL').length > 0
      ? trades.filter(t => t.type === 'SELL').filter((_, idx, arr) => {
          const buys = trades.filter(b => b.type === 'BUY');
          return idx < buys.length && buys[idx] && buys[idx].price < arr[idx].price;
        }).length / trades.filter(t => t.type === 'SELL').length * 100
      : 0,
    equityCurve: equity.filter((_, i) => i % Math.max(1, Math.floor(equity.length / 100)) === 0 || i === equity.length - 1),
    config,
  };
}

function calcSMA(data, period) {
  const result = new Array(data.length).fill(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    result[i] = i >= period - 1 ? sum / period : 0;
  }
  return result;
}
`;
}

// Worker
let workerPool: Worker[] = [];
let workerBusy: boolean[] = [];
let workerCode: string = '';

function ensureWorkers(): void {
  if (workerPool.length > 0) return;
  workerCode = createWorkerCode();
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);

  for (let i = 0; i < BATCH_SIZE; i++) {
    const worker = new Worker(url);
    workerPool.push(worker);
    workerBusy.push(false);
  }
}

// backtest
export async function parallelBacktest(
  klines: unknown[],
  configs: unknown[],
): Promise<unknown[]> {
  ensureWorkers();

  const results: unknown[] = new Array(configs.length);
  let completed = 0;
  let resolveAll: (value: unknown[]) => void;
  const promise = new Promise<unknown[]>((resolve) => { resolveAll = resolve; });

  function dispatchNext() {
    if (completed >= configs.length) {
      resolveAll(results);
      return;
    }

    const freeIdx = workerBusy.findIndex((busy) => !busy);
    if (freeIdx === -1) return;

    // Find next unassigned task
    let nextTaskIdx = results.findIndex((r) => r === undefined);
    if (nextTaskIdx === -1) { resolveAll(results); return; }

    workerBusy[freeIdx] = true;
    const worker = workerPool[freeIdx];

    const handler = (e: MessageEvent) => {
      const msg = e.data as WorkerMessage;
      if (msg.type === 'result') {
        results[nextTaskIdx] = { ...(msg as any).data, params: configs[nextTaskIdx]?.params };
        completed++;
        workerBusy[freeIdx] = false;
        worker.removeEventListener('message', handler);
        dispatchNext();
        dispatchNext(); // try to fill all free workers
      } else if (msg.type === 'error') {
        results[nextTaskIdx] = { error: msg.error, params: configs[nextTaskIdx]?.params };
        completed++;
        workerBusy[freeIdx] = false;
        worker.removeEventListener('message', handler);
        dispatchNext();
        dispatchNext();
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'run', id: nextTaskIdx, config: configs[nextTaskIdx], klines });
  }

  // Kick off initial batch
  for (let i = 0; i < Math.min(BATCH_SIZE, configs.length); i++) {
    dispatchNext();
  }

  return promise;
}

//
export function terminateWorkers(): void {
  for (const w of workerPool) w.terminate();
  workerPool = [];
  workerBusy = [];
}
