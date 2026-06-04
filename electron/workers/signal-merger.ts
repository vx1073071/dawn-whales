// T76: Multi-Strategy Signal Merger
export interface TradeSignal {
  symbol: string;
  direction: 'long' | 'short' | 'close';
  strength: number; // 0-1
  source: string; // strategy name
  reason: string;
  timestamp: number;
  price?: number;
}

export interface MergedSignal extends TradeSignal {
  sources: string[];
  consensus: number; // 0-1 agreement level
  conflicts: number;
}

export type MergeStrategy = 'majority' | 'weighted' | 'unanimous' | 'strongest';

export class SignalMerger {
  private signals = new Map<string, TradeSignal[]>(); // keyed by symbol+direction
  private windowMs = 60000; // signals within this window are merged
  private weights = new Map<string, number>(); // strategy weights

  setWindow(ms: number): void { this.windowMs = ms; }

  setWeight(strategy: string, weight: number): void {
    this.weights.set(strategy, weight);
  }

  addSignal(signal: TradeSignal): MergedSignal | null {
    const key = `${signal.symbol}:${signal.direction}`;

    // Clean old signals
    if (this.signals.has(key)) {
      const existing = this.signals.get(key)!;
      const fresh = existing.filter(s => signal.timestamp - s.timestamp < this.windowMs);
      this.signals.set(key, fresh);
    }

    if (!this.signals.has(key)) this.signals.set(key, []);
    this.signals.get(key)!.push(signal);

    const group = this.signals.get(key)!;
    if (group.length < 2) return null; // need at least 2 sources to merge

    return this._merge(key, group);
  }

  merge(strategy: MergeStrategy = 'weighted'): MergedSignal[] {
    const results: MergedSignal[] = [];
    for (const [key, group] of this.signals) {
      if (group.length >= 2) {
        results.push(this._merge(key, group, strategy));
      }
    }
    return results;
  }

  private _merge(key: string, group: TradeSignal[], strategy: MergeStrategy = 'weighted'): MergedSignal {
    const [symbol, direction] = key.split(':') as [string, TradeSignal['direction']];
    const sources = group.map(s => s.source);
    const uniqueSources = [...new Set(sources)];

    let consensus: number;
    let strength: number;

    switch (strategy) {
      case 'unanimous':
        consensus = uniqueSources.length >= group.length ? 1 : 0;
        strength = consensus === 1 ? Math.max(...group.map(s => s.strength)) : 0;
        break;
      case 'strongest':
        const strongest = group.reduce((a, b) => a.strength > b.strength ? a : b);
        strength = strongest.strength;
        consensus = uniqueSources.length / group.length;
        break;
      case 'weighted':
      case 'majority':
      default:
        const totalWeight = group.reduce((s, sig) => s + (this.weights.get(sig.source) || 1), 0);
        strength = group.reduce((s, sig) => s + sig.strength * (this.weights.get(sig.source) || 1), 0) / totalWeight;
        consensus = uniqueSources.length / Math.max(group.length, 1);
        break;
    }

    return {
      symbol,
      direction,
      strength,
      source: uniqueSources.join('+'),
      reason: `Merged from ${uniqueSources.length} sources: ${uniqueSources.join(', ')}`,
      timestamp: Math.max(...group.map(s => s.timestamp)),
      sources: uniqueSources,
      consensus,
      conflicts: group.length - uniqueSources.length,
    };
  }

  clear(): void {
    this.signals.clear();
  }
}

export const signalMerger = new SignalMerger();
