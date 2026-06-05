// T93: Data Warehouse / OLAP Aggregations
export interface DimensionQuery {
  groupBy: string[];
  metrics: {
    name: string;
    agg: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';
    field: string;
  }[];
  filters?: { field: string; op: string; value: any }[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export interface CubeCell {
  dimensions: Record<string, any>;
  metrics: Record<string, number>;
}

export class DataWarehouse {
  private tables = new Map<string, Record<string, any>[]>();

  createTable(name: string, rows: Record<string, any>[]): void {
    this.tables.set(name, rows);
  }

  insertRows(table: string, rows: Record<string, any>[]): void {
    if (!this.tables.has(table)) this.tables.set(table, []);
    this.tables.get(table)!.push(...rows);
  }

  query(table: string, query: DimensionQuery): CubeCell[] {
    const rows = this.tables.get(table) || [];
    let filtered = rows;

    // Apply filters
    if (query.filters) {
      filtered = filtered.filter(row => {
        return query.filters!.every(f => this._matchFilter(row[f.field], f.op, f.value));
      });
    }

    // Group by
    const groups = new Map<string, Record<string, any>[]>();
    for (const row of filtered) {
      const key = query.groupBy.map(f => String(row[f])).join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    // Aggregate
    const results: CubeCell[] = [];
    for (const [key, groupRows] of groups) {
      const dimValues = key.split('|');
      const dimensions: Record<string, any> = {};
      query.groupBy.forEach((f, i) => { dimensions[f] = dimValues[i]; });

      const metrics: Record<string, number> = {};
      for (const metric of query.metrics) {
        metrics[metric.name] = this._aggregate(groupRows, metric.field, metric.agg);
      }

      results.push({ dimensions, metrics });
    }

    // Order
    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = a.metrics[query.orderBy!.field] || 0;
        const bVal = b.metrics[query.orderBy!.field] || 0;
        return query.orderBy!.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    // Limit
    if (query.limit) {
      return results.slice(0, query.limit);
    }

    return results;
  }

  private _matchFilter(value: any, op: string, target: any): boolean {
    switch (op) {
      case '=': return value == target;
      case '!=': return value != target;
      case '>': return Number(value) > Number(target);
      case '<': return Number(value) < Number(target);
      case '>=': return Number(value) >= Number(target);
      case '<=': return Number(value) <= Number(target);
      case 'in': return Array.isArray(target) && target.includes(value);
      case 'contains': return String(value).includes(String(target));
      default: return true;
    }
  }

  private _aggregate(rows: Record<string, any>[], field: string, agg: string): number {
    const values = rows.map(r => r[field]).filter(v => v != null);
    switch (agg) {
      case 'sum': return values.reduce((a, b) => a + Number(b), 0);
      case 'avg': return values.length ? values.reduce((a, b) => a + Number(b), 0) / values.length : 0;
      case 'count': return values.length;
      case 'min': return values.length ? Math.min(...values.map(Number)) : 0;
      case 'max': return values.length ? Math.max(...values.map(Number)) : 0;
      case 'count_distinct': return new Set(values).size;
      default: return 0;
    }
  }
}
