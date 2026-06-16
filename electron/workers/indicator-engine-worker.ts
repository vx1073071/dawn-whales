// QUANT MOO R113 - Indicator Engine Worker
// Web Worker: 20 core technical indicators parallel computing
// Input: { bars: KlineBar[], indicators: IndicatorRequest[] }
// Output: { results: IndicatorResult[], elapsed: number }
// PM: quote upgrade v2.0 module 2 P0 - benchmark Futu 80+ indicators, 20 core first

import {
  calcSMA, calcEMA, calcWMA, calcBOLL, calcMACD, calcRSI, calcKDJ,
  calcWR, calcCCI, calcATR, calcStdDev, calcOBV, calcVWAP, calcMFI,
  calcSAR, calcIchimoku, calcPivot, calcMAEnvelope, calcEMACross,
} from '../../src/lib/chart/indicator-engine';

export interface IndicatorRequest {
  id: string;
  params: Record<string, number>;
}

export interface KlineBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorWorkerRequest {
  taskId: string;
  bars: KlineBar[];
  indicators: IndicatorRequest[];
}

export interface IndicatorResult {
  id: string;
  label: string;
  data: (number | null)[];
  multi?: (number | null)[][];
}

export interface IndicatorWorkerResponse {
  taskId: string;
  results: IndicatorResult[];
  barCount: number;
  elapsedMs: number;
  error?: string;
}

function wrapMulti(id: string, label: string, multi: (number | null)[][]): IndicatorResult {
  return { id, label, data: multi[0] || [], multi };
}

function wrapSingle(id: string, label: string, data: (number | null)[]): IndicatorResult {
  return { id, label, data };
}

export function computeIndicators(req: IndicatorWorkerRequest): IndicatorWorkerResponse {
  const start = performance.now();
  const { taskId, bars, indicators } = req;
  const results: IndicatorResult[] = [];

  try {
    for (const ind of indicators) {
      const p = ind.params || {};
      switch (ind.id) {
        case 'ma': results.push(wrapSingle('ma', 'MA(' + (p.period || 20) + ')', calcSMA(bars, p.period || 20))); break;
        case 'ema': results.push(wrapSingle('ema', 'EMA(' + (p.period || 20) + ')', calcEMA(bars, p.period || 20))); break;
        case 'wma': results.push(wrapSingle('wma', 'WMA(' + (p.period || 20) + ')', calcWMA(bars, p.period || 20))); break;
        case 'boll': {
          const [mid, up, low] = calcBOLL(bars, p.period || 20, p.multiplier || 2);
          results.push(wrapMulti('boll', 'BOLL(' + (p.period || 20) + ',' + (p.multiplier || 2) + ')', [mid, up, low]));
          break;
        }
        case 'macd': {
          const [diff, dea, hist] = calcMACD(bars, p.fast || 12, p.slow || 26, p.signal || 9);
          results.push(wrapMulti('macd', 'MACD(' + (p.fast || 12) + ',' + (p.slow || 26) + ',' + (p.signal || 9) + ')', [diff, dea, hist]));
          break;
        }
        case 'rsi': results.push(wrapSingle('rsi', 'RSI(' + (p.period || 14) + ')', calcRSI(bars, p.period || 14))); break;
        case 'kdj': {
          const [k, d, j] = calcKDJ(bars, p.n || 9, p.m1 || 3, p.m2 || 3);
          results.push(wrapMulti('kdj', 'KDJ(' + (p.n || 9) + ',' + (p.m1 || 3) + ',' + (p.m2 || 3) + ')', [k, d, j]));
          break;
        }
        case 'wr': results.push(wrapSingle('wr', 'WR(' + (p.period || 14) + ')', calcWR(bars, p.period || 14))); break;
        case 'cci': results.push(wrapSingle('cci', 'CCI(' + (p.period || 20) + ')', calcCCI(bars, p.period || 20))); break;
        case 'atr': results.push(wrapSingle('atr', 'ATR(' + (p.period || 14) + ')', calcATR(bars, p.period || 14))); break;
        case 'stddev': results.push(wrapSingle('stddev', 'StdDev(' + (p.period || 20) + ')', calcStdDev(bars, p.period || 20))); break;
        case 'obv': results.push(wrapSingle('obv', 'OBV', calcOBV(bars))); break;
        case 'vwap': results.push(wrapSingle('vwap', 'VWAP', calcVWAP(bars))); break;
        case 'mfi': results.push(wrapSingle('mfi', 'MFI(' + (p.period || 14) + ')', calcMFI(bars, p.period || 14))); break;
        case 'sar': results.push(wrapSingle('sar', 'SAR(' + (p.af || 0.02).toFixed(2) + ')', calcSAR(bars, p.af || 0.02, p.maxAf || 0.2))); break;
        case 'ichimoku': {
          const [ten, kij, senA, senB, chi] = calcIchimoku(bars);
          results.push(wrapMulti('ichimoku', 'Ichimoku', [ten, kij, senA, senB, chi]));
          break;
        }
        case 'pivot': {
          const [r3, r2, r1, pp, s1, s2, s3] = calcPivot(bars);
          results.push(wrapMulti('pivot', 'Pivot', [r3, r2, r1, pp, s1, s2, s3]));
          break;
        }
        case 'ma-envelope': {
          const [up, mid, low] = calcMAEnvelope(bars, p.period || 20, p.pct || 3);
          results.push(wrapMulti('ma-envelope', 'MA Envelope(' + (p.period || 20) + ',' + (p.pct || 3) + '%)', [up, mid, low]));
          break;
        }
        case 'ema-cross': results.push(wrapSingle('ema-cross', 'EMA Cross(' + (p.fast || 12) + '/' + (p.slow || 26) + ')', calcEMACross(bars, p.fast || 12, p.slow || 26))); break;
        default: break;
      }
    }
  } catch (err: any) {
    return { taskId, results: [], barCount: bars.length, elapsedMs: performance.now() - start, error: err.message || 'Unknown indicator error' };
  }
  return { taskId, results, barCount: bars.length, elapsedMs: +(performance.now() - start).toFixed(2) };
}