// T102: Hot/Warm/Cold Data Tiering
export type TierLevel = 'hot' | 'warm' | 'cold';

export interface TierRule {
  tier: TierLevel;
  maxAgeMs: number;
  maxAccessGapMs: number;
  storageType: 'memory' | 'disk' | 'archive';
}

export interface TieredEntry {
  key: string;
  data: unknown;
  tier: TierLevel;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

export class DataTiering {
  private entries = new Map<string, TieredEntry>();
  private rules: TierRule[] = [
    { tier: 'hot', maxAgeMs: 3600000, maxAccessGapMs: 600000, storageType: 'memory' },
    { tier: 'warm', maxAgeMs: 86400000, maxAccessGapMs: 3600000, storageType: 'disk' },
    { tier: 'cold', maxAgeMs: 31536000000, maxAccessGapMs: 86400000, storageType: 'archive' },
  ];
  private stats = { promotions: 0, demotions: 0, evictions: 0 };

  set(key: string, data: unknown): void {
    const now = Date.now();
    if (this.entries.has(key)) {
      const entry = this.entries.get(key)!;
      entry.data = data;
      entry.lastAccessed = now;
      entry.accessCount++;
      return;
    }
    this.entries.set(key, { key, data, tier: 'hot', createdAt: now, lastAccessed: now, accessCount: 1 });
  }

  get(key: string): unknown | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    return entry.data;
  }

  classify(): { promotions: TieredEntry[]; demotions: TieredEntry[] } {
    const now = Date.now();
    const promotions: TieredEntry[] = [];
    const demotions: TieredEntry[] = [];

    for (const [, entry] of this.entries) {
      const age = now - entry.createdAt;
      const gap = now - entry.lastAccessed;

      // Check each tier rule
      for (let i = 0; i < this.rules.length; i++) {
        const rule = this.rules[i];

        if (age > rule.maxAgeMs || gap > rule.maxAccessGapMs) {
          // Demote to next tier
          if (i < this.rules.length - 1 && entry.tier === rule.tier) {
            entry.tier = this.rules[i + 1].tier;
            demotions.push(entry);
          }
          // Evict from last tier
          if (i === this.rules.length - 1 && entry.tier === 'cold') {
            this.entries.delete(entry.key);
            this.stats.evictions++;
          }
          break;
        }
      }

      // Promote if frequently accessed
      if (entry.accessCount > 10 && entry.tier !== 'hot' && age < this.rules[1].maxAgeMs) {
        entry.tier = 'hot';
        promotions.push(entry);
        this.stats.promotions++;
      }
    }

    return { promotions, demotions };
  }

  getByTier(tier: TierLevel): TieredEntry[] {
    return Array.from(this.entries.values()).filter(e => e.tier === tier);
  }

  getStats(): { hot: number; warm: number; cold: number; total: number; stats: typeof this.stats } {
    return {
      hot: this.getByTier('hot').length,
      warm: this.getByTier('warm').length,
      cold: this.getByTier('cold').length,
      total: this.entries.size,
      stats: { ...this.stats },
    };
  }
}
