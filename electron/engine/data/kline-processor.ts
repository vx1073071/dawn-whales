/**
 * Kline processor stub (created to fix import resolution)
 */
export function getKLineProcessor(): any {
  if (!instance) {
    instance = { processKLines: (tf: string, klines: any[]) => klines };
  }
  return instance;
}

let instance: any = null;

export function processKline(data: any): any {
  return data;
}

export function aggregateKlines(klines: any[], interval: string): any[] {
  return klines;
}
