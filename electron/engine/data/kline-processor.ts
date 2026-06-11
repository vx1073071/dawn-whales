/**
 * Kline processor stub (created to fix import resolution)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getKLineProcessor(): any {
  if (!instance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instance = { processKLines: (tf: string, klines: any[]) => klines };
  }
  return instance;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let instance: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processKline(data: any): any {
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aggregateKlines(klines: any[], interval: string): any[] {
  return klines;
}
