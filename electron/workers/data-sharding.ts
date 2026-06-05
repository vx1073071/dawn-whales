// T94: Data Sharding Engine
export interface ShardStrategy {
  type: 'time' | 'symbol' | 'hash' | 'range';
  field: string;
  shardCount: number;
  intervals?: { name: string; days: number }[];
}

export interface ShardInfo {
  id: string;
  name: string;
  range: { start: string; end?: string };
  rowCount: number;
  sizeBytes: number;
  lastAccessed: number;
}

export class DataSharding {
  private shards = new Map<string, Map<string, any[]>>();
  private strategies = new Map<string, ShardStrategy>();

  registerStrategy(table: string, strategy: ShardStrategy): void {
    this.strategies.set(table, strategy);
    this.shards.set(table, new Map());
  }

  private _shardKey(table: string, row: Record<string, any>): string {
    const strategy = this.strategies.get(table);
    if (!strategy) return 'default';

    switch (strategy.type) {
      case 'symbol': return String(row[strategy.field] || 'unknown');
      case 'hash': {
        const val = String(row[strategy.field] || '');
        let hash = 0;
        for (let i = 0; i < val.length; i++) hash = ((hash << 5) - hash + val.charCodeAt(i)) | 0;
        return `shard_${Math.abs(hash) % strategy.shardCount}`;
      }
      case 'time': {
        const ts = new Date(row[strategy.field] || Date.now()).getTime();
        for (const interval of strategy.intervals || []) {
          if (ts > Date.now() - interval.days * 86400000) return interval.name;
        }
        return 'archive';
      }
      case 'range': {
        const val = Number(row[strategy.field]) || 0;
        const bucket = Math.floor(val / (strategy.shardCount || 1));
        return `bucket_${bucket}`;
      }
      default: return 'default';
    }
  }

  insert(table: string, rows: Record<string, any>[]): void {
    if (!this.shards.has(table)) this.shards.set(table, new Map());
    const tableShards = this.shards.get(table)!;

    for (const row of rows) {
      const key = this._shardKey(table, row);
      if (!tableShards.has(key)) tableShards.set(key, []);
      tableShards.get(key)!.push(row);
    }
  }

  query(table: string, filter?: (row: any) => boolean): any[] {
    const tableShards = this.shards.get(table);
    if (!tableShards) return [];

    const results: any[] = [];
    for (const [, rows] of tableShards) {
      for (const row of rows) {
        if (!filter || filter(row)) results.push(row);
      }
    }
    return results;
  }

  getShardInfo(table: string): ShardInfo[] {
    const tableShards = this.shards.get(table);
    if (!tableShards) return [];

    return Array.from(tableShards.entries()).map(([key, rows]) => ({
      id: key,
      name: key,
      range: { start: rows[0]?.timestamp || 'unknown', end: rows[rows.length - 1]?.timestamp },
      rowCount: rows.length,
      sizeBytes: JSON.stringify(rows).length,
      lastAccessed: Date.now(),
    }));
  }

  dropShard(table: string, shardId: string): boolean {
    return this.shards.get(table)?.delete(shardId) ?? false;
  }

  stats(): { table: string; shards: number; totalRows: number }[] {
    return Array.from(this.shards.entries()).map(([table, shards]) => ({
      table,
      shards: shards.size,
      totalRows: Array.from(shards.values()).reduce((s, r) => s + r.length, 0),
    }));
  }
}
