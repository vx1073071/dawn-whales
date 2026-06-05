// T100: Real-time Deduplication Engine
export interface DedupConfig {
  windowMs: number;
  maxSize?: number;
  hashFields?: string[];
}

export class DedupEngine {
  private config: DedupConfig;
  private bloomFilter: boolean[];
  private hashFunctions: number;
  private window = new Map<string, number>(); // hash → timestamp

  constructor(config: DedupConfig) {
    this.config = config;
    this.hashFunctions = 3;
    const size = config.maxSize || 10000;
    this.bloomFilter = new Array(size).fill(false);
  }

  isDuplicate(item: Record<string, any> | string): boolean {
    const now = Date.now();
    const hash = this._hash(item);

    // Clean expired
    for (const [key, ts] of this.window) {
      if (now - ts > this.config.windowMs) this.window.delete(key);
    }

    // Check sliding window
    if (this.window.has(hash)) {
      return true;
    }

    // Check bloom filter
    const bloomHit = this._checkBloom(hash);
    if (bloomHit) {
      // Possible duplicate — verify in window
      return false; // false positive, let it through
    }

    // First time seen
    this.window.set(hash, now);
    this._addBloom(hash);
    return false;
  }

  deduplicate(items: (Record<string, any> | string)[]): { unique: any[]; duplicates: number } {
    const unique: any[] = [];
    let duplicates = 0;

    for (const item of items) {
      if (this.isDuplicate(item)) {
        duplicates++;
      } else {
        unique.push(item);
      }
    }

    return { unique, duplicates };
  }

  stats(): { windowSize: number; bloomSize: number; hashFunctions: number } {
    return {
      windowSize: this.window.size,
      bloomSize: this.bloomFilter.length,
      hashFunctions: this.hashFunctions,
    };
  }

  private _hash(item: Record<string, any> | string): string {
    if (typeof item === 'string') return item;

    if (this.config.hashFields && this.config.hashFields.length > 0) {
      const parts = this.config.hashFields.map(f => String(item[f] ?? ''));
      return parts.join(':');
    }

    return JSON.stringify(item);
  }

  private _checkBloom(hash: string): boolean {
    for (let i = 0; i < this.hashFunctions; i++) {
      const idx = this._bloomIdx(hash, i);
      if (!this.bloomFilter[idx]) return false;
    }
    return true;
  }

  private _addBloom(hash: string): void {
    for (let i = 0; i < this.hashFunctions; i++) {
      this.bloomFilter[this._bloomIdx(hash, i)] = true;
    }
  }

  private _bloomIdx(hash: string, seed: number): number {
    let h = seed;
    for (let i = 0; i < hash.length; i++) {
      h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % this.bloomFilter.length;
  }
}
