// T97: Query Plan Optimizer
export interface TableStats {
  name: string;
  rowCount: number;
  columns: { name: string; type: string; indexed: boolean; distinctCount: number }[];
}

export interface QueryPlan {
  steps: QueryStep[];
  estimatedCost: number;
  estimatedRows: number;
  hints: string[];
}

export interface QueryStep {
  type: 'scan' | 'filter' | 'sort' | 'join' | 'aggregate' | 'project';
  table?: string;
  condition?: string;
  cost: number;
  outputRows: number;
  detail: string;
}

export class QueryOptimizer {
  private stats = new Map<string, TableStats>();

  registerStats(stats: TableStats): void {
    this.stats.set(stats.name, stats);
  }

  plan(operation: { from: string; where?: string; orderBy?: string; join?: { table: string; on: string }; select?: string }): QueryPlan {
    const steps: QueryStep[] = [];
    const hints: string[] = [];
    let cost = 0;

    const tableStats = this.stats.get(operation.from);
    if (!tableStats) {
      return { steps: [{ type: 'scan', table: operation.from, cost: 1, outputRows: 1, detail: `Unknown table ${operation.from}` }], estimatedCost: 1, estimatedRows: 1, hints: [] };
    }

    // Step 1: Scan
    let rows = tableStats.rowCount;
    steps.push({ type: 'scan', table: operation.from, cost: rows, outputRows: rows, detail: `Full scan: ${rows} rows` });
    cost += rows;
    hints.push(`Scan ${operation.from} (${rows} rows)`);

    // Step 2: Filter (push-down)
    if (operation.where) {
      const selectivity = this._estimateSelectivity(operation.where, tableStats);
      const filteredRows = Math.ceil(rows * selectivity);
      cost += rows; // filter cost
      steps.push({ type: 'filter', condition: operation.where, cost: rows, outputRows: filteredRows, detail: `Filter ${operation.where} → ${filteredRows} rows` });
      rows = filteredRows;
      hints.push(`Filter reduces to ~${filteredRows} rows (sel=${selectivity.toFixed(2)})`);
    }

    // Step 3: Join
    if (operation.join) {
      const joinStats = this.stats.get(operation.join.table);
      const joinRows = joinStats?.rowCount || 1000;
      const joinedRows = rows * joinRows * 0.1; // assume 10% match rate
      cost += rows * joinRows;
      steps.push({ type: 'join', table: operation.join.table, cost: rows * joinRows, outputRows: joinedRows, detail: `JOIN ${operation.join.table} ON ${operation.join.on}` });
      rows = joinedRows;
      if (rows > 1000000) hints.push('Consider index on join column');
    }

    // Step 4: Sort
    if (operation.orderBy) {
      cost += rows * Math.log2(Math.max(rows, 1));
      steps.push({ type: 'sort', cost: rows * Math.log2(Math.max(rows, 1)), outputRows: rows, detail: `Sort by ${operation.orderBy}` });
      if (rows > 500000) hints.push('Sort on large dataset — add LIMIT or index');
    }

    // Step 5: Project
    if (operation.select) {
      steps.push({ type: 'project', cost: rows * 0.01, outputRows: rows, detail: `Project ${operation.select}` });
    }

    // Check indexed columns
    if (operation.where) {
      const col = operation.where.match(/(\w+)\s*[=<>]/)?.[1];
      if (col && tableStats.columns.find(c => c.name === col && c.indexed)) {
        hints.push(`Index available on ${col} — use index scan`);
        steps[0].cost *= 0.01; // indexed scan is much cheaper
        steps[0].detail += ' (indexed)';
      } else if (col) {
        hints.push(`Consider adding index on ${col} (${tableStats.rowCount} rows scanned)`);
      }
    }

    return { steps, estimatedCost: cost, estimatedRows: rows, hints };
  }

  private _estimateSelectivity(where: string, stats: TableStats): number {
    // Simple heuristic: '=' is very selective, '>' is less
    if (where.includes('=') && !where.includes('>') && !where.includes('<')) return 1 / Math.max(stats.rowCount, 1);
    if (where.includes('BETWEEN') || where.includes('>') || where.includes('<')) return 0.3;
    if (where.includes('LIKE')) return 0.1;
    if (where.includes('IN')) return 0.05;
    return 0.5;
  }
}
