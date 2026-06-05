// T95: Multi-Level Aggregation Pipeline
export interface AggLevel {
  name: string;
  windowMs: number;
  fields: { source: string; agg: 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last' | 'count'; target: string }[];
}

export interface AggBucket {
  start: number;
  end: number;
  values: Record<string, number>;
  count: number;
}

export class AggregationPipeline {
  private levels: AggLevel[] = [];
  private raw = new Map<string, { timestamp: number; data: Record<string, number> }[]>();
  private buckets = new Map<string, AggBucket[]>();

  addLevel(level: AggLevel): void {
    this.levels.push(level);
    this.buckets.set(level.name, []);
  }

  feed(stream: string, timestamp: number, data: Record<string, number>): void {
    if (!this.raw.has(stream)) this.raw.set(stream, []);
    this.raw.get(stream)!.push({ timestamp, data });

    for (const level of this.levels) {
      this._updateBucket(stream, level, timestamp, data);
    }
  }

  private _updateBucket(stream: string, level: AggLevel, ts: number, data: Record<string, number>): void {
    const windowMs = level.windowMs;
    const bucketStart = Math.floor(ts / windowMs) * windowMs;
    const bucketEnd = bucketStart + windowMs;

    let buckets = this.buckets.get(level.name)!;
    let bucket = buckets.find(b => b.start === bucketStart);

    if (!bucket) {
      bucket = {
        start: bucketStart,
        end: bucketEnd,
        values: {},
        count: 0,
      };
      buckets.push(bucket);
      // Keep last 100 buckets
      if (buckets.length > 100) buckets.shift();
    }

    for (const field of level.fields) {
      const val = data[field.source] ?? 0;
      const prev = bucket.values[field.target] ?? 0;
      const cnt = bucket.count;

      switch (field.agg) {
        case 'sum': bucket.values[field.target] = prev + val; break;
        case 'avg': bucket.values[field.target] = cnt > 0 ? (prev * cnt + val) / (cnt + 1) : val; break;
        case 'min': bucket.values[field.target] = cnt === 0 ? val : Math.min(prev, val); break;
        case 'max': bucket.values[field.target] = Math.max(prev, val); break;
        case 'first': if (cnt === 0) bucket.values[field.target] = val; break;
        case 'last': bucket.values[field.target] = val; break;
        case 'count': bucket.values[field.target] = prev + 1; break;
      }
    }
    bucket.count++;
  }

  getBuckets(levelName: string, limit = 20): AggBucket[] {
    const buckets = this.buckets.get(levelName) || [];
    return buckets.slice(-limit);
  }

  getLatest(levelName: string): AggBucket | null {
    const buckets = this.buckets.get(levelName) || [];
    return buckets[buckets.length - 1] || null;
  }
}
