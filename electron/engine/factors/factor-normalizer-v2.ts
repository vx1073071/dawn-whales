// R192: Preprocessing Pipeline V2 - Sector Neutralization + Rank Normalization

export type NormMethod = "percentile" | "zscore";
export type SectorKeyFunc = (symbol: string, market: string) => string;

export interface NormalizerV2Config {
  method: NormMethod;
  winsorize?: [number, number];
  minSectorSize?: number;
  getSector?: SectorKeyFunc;
}

export interface SectorNeutralizationResult {
  factorId: string; sector: string;
  rawMean: number; residualMean: number;
  sectorCount: number;
}

export interface FactorValue {
  symbol: string; market: string;
  value: number; sector?: string; rawValue?: number;
}

export interface NormalizedFactorValue extends FactorValue {
  normalizedValue: number;
  percentile?: number;
  zScore?: number;
  sectorResidual?: number;
}

export class FactorNormalizerV2 {
  private config: Required<NormalizerV2Config>;

  constructor(config: NormalizerV2Config = { method: "percentile" }) {
    this.config = {
      method: config.method,
      winsorize: config.winsorize ?? [0.01, 0.99],
      minSectorSize: config.minSectorSize ?? 5,
      getSector: config.getSector ?? ((_s, _m) => "OTHER"),
    };
  }

  normalize(values: FactorValue[], factorId: string): NormalizedFactorValue[] {
    if (values.length === 0) return [];
    const winsorized = this.winsorizeValues(values);

    const sectors = new Map<string, { idx: number; value: number }[]>();
    winsorized.forEach((v, i) => {
      const sec = this.config.getSector(v.symbol, v.market);
      if (!sectors.has(sec)) sectors.set(sec, []);
      sectors.get(sec)!.push({ idx: i, value: v.value });
    });

    const results: NormalizedFactorValue[] = winsorized.map(v => ({
      ...v, normalizedValue: v.value,
    }));

    const sectorEntries = Array.from(sectors.entries());
    for (const [sector, group] of sectorEntries) {
      if (group.length < this.config.minSectorSize) continue;
      const secMean = group.reduce((a,g) => a + g.value, 0) / group.length;
      group.forEach(g => { results[g.idx].sectorResidual = g.value - secMean; });
    }

    if (this.config.method === "percentile") {
      this.rankNormPercentile(results);
    } else {
      this.rankNormZScore(results);
    }
    return results;
  }

  private winsorizeValues(values: FactorValue[]): FactorValue[] {
    const [lo, hi] = this.config.winsorize;
    const sorted = [...values].sort((a,b) => a.value - b.value);
    if (sorted.length < 3) return values;
    const loVal = sorted[Math.floor(sorted.length * lo)].value;
    const hiVal = sorted[Math.ceil(sorted.length * hi) - 1].value;
    return values.map(v => ({
      ...v, value: Math.max(loVal, Math.min(hiVal, v.value)),
    }));
  }

  private rankNormPercentile(vals: NormalizedFactorValue[]): void {
    const n = vals.length;
    if (n < 2) { vals.forEach(v => { v.normalizedValue = 0.5; v.percentile = 0.5; }); return; }
    const indexed = vals.map((v,i) => ({ v: v.sectorResidual ?? v.value, i })).sort((a,b) => a.v - b.v);
    indexed.forEach((item, rank) => {
      vals[item.i].percentile = rank / (n - 1);
      vals[item.i].normalizedValue = vals[item.i].percentile! * 2 - 1;
    });
  }

  private rankNormZScore(vals: NormalizedFactorValue[]): void {
    const n = vals.length;
    if (n < 2) { vals.forEach(v => { v.normalizedValue = 0; v.zScore = 0; }); return; }
    const residuals = vals.map(v => v.sectorResidual ?? v.value);
    const mean = residuals.reduce((a,b) => a+b,0) / n;
    const variance = residuals.reduce((s,r) => s + (r-mean)**2, 0) / n;
    const std = Math.sqrt(variance);
    vals.forEach((v,i) => {
      const z = std > 0 ? (residuals[i] - mean) / std : 0;
      v.zScore = z;
      v.normalizedValue = Math.tanh(z);
    });
  }

  getConfig(): Readonly<Required<NormalizerV2Config>> { return this.config; }
}

export const HK_SECTORS: Record<string, string[]> = {
  FINANCIALS: ["HK.0005","HK.0011","HK.2388","HK.2888","HK.1299"],
  PROPERTY: ["HK.0016","HK.0017","HK.0083","HK.0101","HK.0688","HK.1109","HK.1113"],
  TECH: ["HK.0700","HK.9988","HK.9999","HK.9618","HK.9888","HK.3690","HK.2015"],
  CONSUMER: ["HK.0992","HK.2331","HK.1876","HK.1929","HK.2020"],
  ENERGY: ["HK.0857","HK.0883","HK.0386","HK.1171","HK.1088"],
};

export const US_SECTORS: Record<string, string[]> = {
  TECH: ["AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA"],
  FINANCIALS: ["JPM","BAC","WFC","GS","MS","C","BLK"],
  HEALTHCARE: ["JNJ","PFE","UNH","MRK","ABBV","LLY","TMO"],
  CONSUMER_DISC: ["AMZN","TSLA","HD","MCD","NKE","SBUX","LOW"],
  ENERGY: ["XOM","CVX","COP","EOG","SLB","PSX","MPC"],
  INDUSTRIALS: ["CAT","BA","GE","HON","UNP","UPS","LMT"],
  COMMS: ["GOOGL","META","NFLX","DIS","CMCSA","VZ","T"],
  UTILITIES: ["NEE","DUK","SO","D","AEP","SRE","EXC"],
  MATERIALS: ["LIN","APD","SHW","ECL","NEM","FCX","DOW"],
  REAL_ESTATE: ["AMT","PLD","CCI","EQIX","SPG","O","DLR"],
  CONSUMER_STAPLES: ["PG","KO","PEP","WMT","COST","PM","MO"],
};

export function defaultHKSectorKey(symbol: string): string {
  for (const [sec, syms] of Object.entries(HK_SECTORS)) {
    if (syms.includes(symbol)) return sec;
  }
  return "OTHER";
}

export function defaultUSSectorKey(symbol: string): string {
  for (const [sec, syms] of Object.entries(US_SECTORS)) {
    if (syms.includes(symbol)) return sec;
  }
  return "OTHER";
}